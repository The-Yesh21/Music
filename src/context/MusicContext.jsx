import React, { createContext, useContext, useReducer, useRef, useEffect } from 'react';
import AudioService from '../services/AudioService';
import { JioSaavnAPI } from '../services/JioSaavnAPI';
import { buildRadioPlaylist, extendRadioQueue } from '../services/PlaylistService';
import {
  loadStats, loadFavorites, loadHistory, loadDislikes,
  incrementPlayCount, incrementSkipCount, saveFavorites, saveDislikes,
  addToHistory, addListeningTime,
} from '../services/StorageService';
import { updateMLModel } from '../services/MLTreeEngine';

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
  vocalClarityActive: true,
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
    case 'SET_CLARITY': return { ...state, vocalClarityActive: action.value };
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
      if (status.vocalClarityActive !== undefined) {
        dispatch({ type: 'SET_CLARITY', value: status.vocalClarityActive });
      }
    });
    return () => AudioService.setStatusCallback(null);
    // eslint-disable-next-line
  }, []);

  const playSong = async (song, queueOpt = null) => {
    try {
      dispatch({ type: 'SET_BUFFERING', value: true });

      // Resolve streaming URL dynamically if song is a local taste song or lacks a valid URL
      let playableSong = { ...song };
      if (!song.uri || String(song.id).startsWith('taste_')) {
        try {
          const searchResults = await JioSaavnAPI.searchSongs(`${song.title} ${song.artist}`);
          if (searchResults && searchResults.length > 0) {
            const match = searchResults[0];
            playableSong = {
              ...match,
              // Retain local ML variables for training
              bpm: song.bpm || match.bpm || 100,
              mood: song.mood || match.mood || 'Neutral',
              rating: song.rating || match.rating || 50
            };
          }
        } catch (e) {
          console.warn('Failed to dynamically resolve JioSaavn stream:', e);
        }
      }

      // If a queue is explicitly provided (e.g. from search/AI results), use it
      if (queueOpt && queueOpt.length > 1) {
        const updatedQueue = queueOpt.map(q => q.id === song.id ? playableSong : q);
        dispatch({ type: 'SET_QUEUE', queue: updatedQueue });
      } 
      // If the song is already in the existing queue, preserve the queue (replacing the placeholder if needed)
      else if (stateRef.current.queue.some(q => q.id === song.id)) {
        const updatedQueue = stateRef.current.queue.map(q => q.id === song.id ? playableSong : q);
        dispatch({ type: 'SET_QUEUE', queue: updatedQueue });
      } 
      // Otherwise, collapse the queue to this single song and let the radio build recommendations
      else {
        dispatch({ type: 'SET_QUEUE', queue: [playableSong] });
      }

      const s = stateRef.current;
      let stats = incrementPlayCount(playableSong.id, s.stats);
      dispatch({ type: 'SET_STATS', stats });
      let history = addToHistory(playableSong, s.history);
      dispatch({ type: 'SET_HISTORY', history });
      
      dispatch({ type: 'SET_SONG', song: playableSong });
      await AudioService.loadAndPlay(playableSong.uri);
      
      // Update ML Decision Tree weights
      updateMLModel(playableSong, 'PLAY');

      // Build a 20+ song radio playlist in the background
      (async () => {
        try {
          const existingQueueIds = new Set(stateRef.current.queue.map(sq => sq.id));
          const dislikedIds = stateRef.current.dislikes;
          
          const radioSongs = await buildRadioPlaylist(playableSong, { existingQueueIds, dislikedIds });
          
          if (radioSongs.length > 0) {
            const currentQueue = stateRef.current.queue;
            const currentIds = new Set(currentQueue.map(sq => sq.id));
            const freshSongs = radioSongs.filter(sq => !currentIds.has(sq.id) && !stateRef.current.dislikes.has(sq.id));
            
            if (freshSongs.length > 0) {
              dispatch({ type: 'SET_QUEUE', queue: [...currentQueue, ...freshSongs] });
            }
          }
        } catch (e) {
          console.error('Radio playlist build failed:', e);
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
      await AudioService.play();
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
      updateMLModel(s.currentSong, 'SKIP');
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
    
    // Infinite Radio Engine: extend the queue with more genre-matched songs
    try {
      const existingQueueIds = new Set(updatedState.queue.map(sq => sq.id));
      const extensionSongs = await extendRadioQueue(updatedState.currentSong, { existingQueueIds: existingQueueIds, dislikedIds: updatedState.dislikes });
      
      if (extensionSongs.length > 0) {
        const newQueue = [...updatedState.queue, ...extensionSongs];
        dispatch({ type: 'SET_QUEUE', queue: newQueue });
        await playSong(extensionSongs[0]);
      } else {
        // Last resort: JioSaavn native suggestions
        const suggestions = await JioSaavnAPI.getSuggestions(updatedState.currentSong.id);
        const filtered = suggestions.filter(s => 
          s.id !== updatedState.currentSong.id && 
          !updatedState.dislikes.has(s.id)
        );
        if (filtered.length > 0) {
          dispatch({ type: 'SET_QUEUE', queue: [...updatedState.queue, ...filtered] });
          await playSong(filtered[0]);
        } else if (updatedState.queue.length > 0) {
          await playSong(updatedState.queue[0]);
        }
      }
    } catch (e) {
      console.error('Infinite Radio failed:', e);
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
    const isFav = favs.has(songId);
    if (isFav) favs.delete(songId);
    else favs.add(songId);
    dispatch({ type: 'SET_FAVORITES', favorites: favs });
    saveFavorites(favs);

    // Update ML model
    const song = stateRef.current.queue.find(s => s.id === songId) || 
                 stateRef.current.history.find(s => s.id === songId) ||
                 stateRef.current.currentSong;
    if (song) {
      updateMLModel(song, isFav ? 'UNLIKE' : 'LIKE');
    }
  };

  const toggleDislike = (songId) => {
    const dislikes = new Set(stateRef.current.dislikes);
    const isDisliked = dislikes.has(songId);
    if (isDisliked) dislikes.delete(songId);
    else dislikes.add(songId);
    dispatch({ type: 'SET_DISLIKES', dislikes });
    saveDislikes(dislikes);

    // Update ML model
    const song = stateRef.current.queue.find(s => s.id === songId) || 
                 stateRef.current.history.find(s => s.id === songId) ||
                 stateRef.current.currentSong;
    if (song) {
      updateMLModel(song, isDisliked ? 'UNDISLIKE' : 'DISLIKE');
    }
  };

  const toggleVocalClarity = () => {
    const nextState = !stateRef.current.vocalClarityActive;
    AudioService.setVocalClarityMode(nextState);
  };

  return (
    <MusicContext.Provider value={{ 
      state, 
      playSong,
      togglePlay, skipNext, skipPrev, seekTo, toggleFavorite, toggleDislike, toggleVocalClarity,
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
