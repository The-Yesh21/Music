import React, { createContext, useContext, useReducer, useRef, useEffect } from 'react';
import AudioService from '../services/AudioService';
import { JioSaavnAPI } from '../services/JioSaavnAPI';
import { getGeminiRecommendations } from '../services/GeminiBridge';
import {
  loadStats, loadFavorites, loadHistory, loadDislikes,
  incrementPlayCount, incrementSkipCount, saveFavorites, saveDislikes,
  addToHistory, addListeningTime,
} from '../services/StorageService';

const MusicContext = createContext(null);
export const useMusic = () => useContext(MusicContext);

const initialState = {
  currentSong: null,
  queue: [],
  isPlaying: false,
  isBuffering: false,
  playbackError: null,

  positionMillis: 0,
  durationMillis: 0,
  stats: loadStats(),
  favorites: loadFavorites(),
  dislikes: loadDislikes(),
  history: loadHistory(),
  // Multi-skip mood penalization memory
  consecutiveSkips: 0,
  penalizedMoods: new Set(),
};

const reducer = (state, action) => {
  switch (action.type) {
    case 'SET_SONG': return { ...state, currentSong: action.song, playbackError: null };
    case 'SET_PLAYING': return { ...state, isPlaying: action.value };
    case 'SET_QUEUE': return { ...state, queue: action.queue };
    case 'SET_BUFFERING': return { ...state, isBuffering: action.value };
    case 'SET_ERROR': return { ...state, playbackError: action.error, isPlaying: false, isBuffering: false };
    case 'SET_POSITION': return { ...state, positionMillis: action.positionMillis, durationMillis: action.durationMillis };
    case 'SET_STATS': return { ...state, stats: action.stats };
    case 'SET_FAVORITES': return { ...state, favorites: action.favorites };
    case 'SET_DISLIKES': return { ...state, dislikes: action.dislikes };
    case 'SET_HISTORY': return { ...state, history: action.history };
    case 'ADD_SKIP':
      const newSkips = state.consecutiveSkips + 1;
      const newPenalized = new Set(state.penalizedMoods);
      if (newSkips >= 3 && state.currentSong?.mood) {
        newPenalized.add(state.currentSong.mood);
      }
      return { ...state, consecutiveSkips: newSkips, penalizedMoods: newPenalized };
    case 'RESET_SKIPS':
      return { ...state, consecutiveSkips: 0, penalizedMoods: new Set() };
    default: return state;
  }
};

export const MusicProvider = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    AudioService.setStatusCallback((status) => {
      const s = stateRef.current;
      
      if (status.error) {
        dispatch({ type: 'SET_ERROR', error: status.error });
        return;
      }
      
      if (status.isBuffering !== undefined) {
        dispatch({ type: 'SET_BUFFERING', value: status.isBuffering });
      }

      if (status.didJustFinish) {
        // Natural end of song -> reset skips and add listen time
        dispatch({ type: 'RESET_SKIPS' });
        const newStats = addListeningTime(Math.floor(s.durationMillis / 1000), s.stats);
        dispatch({ type: 'SET_STATS', stats: newStats });
        skipNext(true); // pass true to indicate natural completion
        return;
      }
      if (status.positionMillis !== undefined) {
        dispatch({ type: 'SET_POSITION', positionMillis: status.positionMillis || 0, durationMillis: status.durationMillis || 0 });
      }
      if (status.isPlaying !== undefined) {
        dispatch({ type: 'SET_PLAYING', value: status.isPlaying });
      }
    });
    return () => AudioService.setStatusCallback(null);
    // eslint-disable-next-line
  }, []);

  const playSong = async (song, queueOpt = null) => {
    try {
      dispatch({ type: 'SET_BUFFERING', isBuffering: true });
      
      // Forcefully collapse the queue explicitly to the chosen song. 
      // This obliterates the 'Search Results' list so the algorithmic radio controls the next track.
      dispatch({ type: 'SET_QUEUE', queue: [song] });

      const s = stateRef.current;
      let stats = incrementPlayCount(song.id, s.stats);
      dispatch({ type: 'SET_STATS', stats });
      let history = addToHistory(song, s.history);
      dispatch({ type: 'SET_HISTORY', history });
      
      dispatch({ type: 'SET_SONG', song });
      await AudioService.loadAndPlay(song.uri);

      // Pre-fetch suggestions
      (async () => {
        try {
          const llmQueries = await getGeminiRecommendations(song.title, song.artist);
          
          if (llmQueries.length > 0) {
            // ML Bridge Success: Rapidly map Gemini text strings into JioSaavn 320kbps URLs
            // We'll scrape the top 10 closely matching songs in parallel
            const fetchPromises = llmQueries.slice(0, 10).map(async (query) => {
              try {
                const results = await JioSaavnAPI.searchSongs(query);
                return results.length > 0 ? results[0] : null;
              } catch (e) { return null; }
            });

            const scrapedSongs = await Promise.all(fetchPromises);
            const validSongs = scrapedSongs.filter(s => s !== null);

            if (validSongs.length > 0) {
              const currentQueueIds = new Set(stateRef.current.queue.map(sq => sq.id));
              const freshSongs = validSongs.filter(sq => !currentQueueIds.has(sq.id) && !stateRef.current.dislikes.has(sq.id));
              // Splice them into queue!
              if (freshSongs.length > 0) {
                dispatch({ type: 'SET_QUEUE', queue: [...stateRef.current.queue, ...freshSongs] });
                return; // End here, LLM succeeded
              }
            }
          }

          // Fallback to Native JioSaavn engine
          const suggestions = await JioSaavnAPI.getSuggestions(song.id);
          const currentQueueIds = new Set(stateRef.current.queue.map(sq => sq.id));
          const freshSongs = suggestions.filter(sq => !currentQueueIds.has(sq.id) && !stateRef.current.dislikes.has(sq.id));
          if (freshSongs.length > 0) {
            dispatch({ type: 'SET_QUEUE', queue: [...stateRef.current.queue, ...freshSongs] });
          }

        } catch (e) {
          console.error("Advanced Prefetch failed:", e);
        }
      })();

    } catch (error) {
      console.error('Playback Error:', error);
      skipNext();
    } finally {
      dispatch({ type: 'SET_BUFFERING', isBuffering: false });
    }
  };

  const togglePlay = async () => {
    if (stateRef.current.isPlaying) {
      await AudioService.pause();
    } else {
      await AudioService.resume();
    }
  };

  const skipNext = async (isNaturalFinish = false) => {
    const s = stateRef.current;
    if (!s.currentSong) return;

    if (!isNaturalFinish) {
      // User aborted song early
      dispatch({ type: 'ADD_SKIP' });
      const stats = incrementSkipCount(s.currentSong.id, s.stats);
      dispatch({ type: 'SET_STATS', stats });
    }

    // Refresh ref due to async closure
    const updatedState = stateRef.current;

    // Dynamic Radio queue system
    const idx = updatedState.queue.findIndex((x) => x.id === updatedState.currentSong.id);
    
    let nextIdx = idx + 1;
    while (nextIdx < updatedState.queue.length && updatedState.dislikes.has(updatedState.queue[nextIdx].id)) {
      nextIdx++;
    }

    if (nextIdx < updatedState.queue.length) {
      await playSong(updatedState.queue[nextIdx]);
      return;
    }
    
    // Infinite Radio Engine: fetch recommendations based on current song
    try {
      const suggestions = await JioSaavnAPI.getSuggestions(updatedState.currentSong.id);
      const filteredSuggestions = suggestions.filter(s => 
        s.id !== updatedState.currentSong.id && 
        !updatedState.dislikes.has(s.id)
      );
      
      if (filteredSuggestions.length > 0) {
          const nextSong = filteredSuggestions[0];
          const newQueue = [...updatedState.queue, ...filteredSuggestions];
          dispatch({ type: 'SET_QUEUE', queue: newQueue });
          playSong(nextSong);
        } else {
          if (updatedState.queue.length > 0) {
            await playSong(updatedState.queue[0]);
          }
        }
      } catch (e) {
        console.error("Infinite Radio failed:", e);
        if (updatedState.queue.length > 0) await playSong(updatedState.queue[0]);
      }
  };

  const skipPrev = async () => {
    const s = stateRef.current;
    if (!s.currentSong || s.queue.length === 0) return;
    
    if (s.positionMillis > 3000) {
      await AudioService.seekTo(0);
      return;
    }
    const idx = s.queue.findIndex((x) => x.id === s.currentSong.id);
    if (idx !== -1) {
      const prev = s.queue[(idx - 1 + s.queue.length) % s.queue.length];
      await playSong(prev);
    }
  };

  const seekTo = async (millis) => await AudioService.seekTo(millis);

  const toggleFavorite = (songId) => {
    const favs = new Set(stateRef.current.favorites);
    if (favs.has(songId)) favs.delete(songId);
    else favs.add(songId);
    dispatch({ type: 'SET_FAVORITES', favorites: favs });
    saveFavorites(favs);
  };

  const toggleDislike = (songId) => {
    const dislikes = new Set(stateRef.current.dislikes);
    if (dislikes.has(songId)) dislikes.delete(songId);
    else dislikes.add(songId);
    dispatch({ type: 'SET_DISLIKES', dislikes });
    saveDislikes(dislikes);
  };

  return (
    <MusicContext.Provider value={{ 
      state, 
      playSong,
      togglePlay, skipNext, skipPrev, seekTo, toggleFavorite, toggleDislike,
      pauseSong: async () => { await AudioService.pause(); dispatch({ type: 'SET_PLAYING', value: false }); },
      resumeSong: async () => { await AudioService.play(); dispatch({ type: 'SET_PLAYING', value: true }); },
      stopSong: async () => { await AudioService.unload(); dispatch({ type: 'SET_PLAYING', value: false }); },
      nextSong: skipNext,
      previousSong: skipPrev,
    }}>
      {children}
    </MusicContext.Provider>
  );
};
