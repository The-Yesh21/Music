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
  activeSoundstage: '3D Immersive BGM',
  shuffle: false,
  repeat: 'none', // 'none' | 'one' | 'all'
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
    case 'SET_SOUNDSTAGE': return { ...state, activeSoundstage: action.value };
    case 'TOGGLE_SHUFFLE': return { ...state, shuffle: !state.shuffle };
    case 'SET_REPEAT':
      const nextRepeat = state.repeat === 'none' ? 'all' : state.repeat === 'all' ? 'one' : 'none';
      return { ...state, repeat: nextRepeat };
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

  const skipNextRef = useRef();
  const skipPrevRef = useRef();
  useEffect(() => {
    skipNextRef.current = skipNext;
    skipPrevRef.current = skipPrev;
  });

  const resolvingSongsRef = useRef(new Set());

  const preResolveNextSong = async (currentSong, currentQueue) => {
    if (!currentSong || !currentQueue || currentQueue.length === 0) return;
    
    // Check repeat one
    if (stateRef.current.repeat === 'one') {
      AudioService.setNextTrack(currentSong);
      return;
    }

    const idx = currentQueue.findIndex((x) => x.id === currentSong.id);
    if (idx === -1) return;

    // Identify songs to resolve (up to 7)
    const songsToResolve = [];
    if (stateRef.current.shuffle) {
      // Resolve up to 7 random songs in the queue that don't have URIs
      const unresolvedIdxs = [];
      currentQueue.forEach((song, i) => {
        const isTaste = String(song.id).startsWith('taste_');
        if (i !== idx && (!song.uri || isTaste) && !resolvingSongsRef.current.has(song.id)) {
          unresolvedIdxs.push(i);
        }
      });
      // Shuffle indices and pick up to 7
      const chosenIdxs = unresolvedIdxs.sort(() => 0.5 - Math.random()).slice(0, 7);
      chosenIdxs.forEach(index => {
        songsToResolve.push({ index, song: currentQueue[index] });
      });
    } else {
      // Resolve the next 7 songs in sequence
      for (let i = 1; i <= 7; i++) {
        const nextIdx = idx + i;
        if (nextIdx < currentQueue.length) {
          const song = currentQueue[nextIdx];
          const isTaste = String(song.id).startsWith('taste_');
          if ((!song.uri || isTaste) && !resolvingSongsRef.current.has(song.id)) {
            songsToResolve.push({ index: nextIdx, song });
          }
        }
      }
    }

    if (songsToResolve.length > 0) {
      songsToResolve.forEach(({ song }) => resolvingSongsRef.current.add(song.id));
      try {
        const updatedQueue = [...currentQueue];
        let queueChanged = false;

        await Promise.all(songsToResolve.map(async ({ index, song }) => {
          try {
            const searchResults = await JioSaavnAPI.searchSongs(`${song.title} ${song.artist}`);
            if (searchResults && searchResults.length > 0) {
              const match = searchResults[0];
              updatedQueue[index] = {
                ...match,
                bpm: song.bpm || match.bpm || 100,
                mood: song.mood || match.mood || 'Neutral',
                rating: song.rating || match.rating || 50
              };
            } else {
              updatedQueue[index] = {
                ...song,
                id: String(song.id).replace('taste_', 'failed_taste_')
              };
            }
            queueChanged = true;
          } catch (e) {
            console.warn(`Failed to resolve queue song at index ${index}:`, e);
            updatedQueue[index] = {
              ...song,
              id: String(song.id).replace('taste_', 'failed_taste_')
            };
            queueChanged = true;
          } finally {
            resolvingSongsRef.current.delete(song.id);
          }
        }));

        if (queueChanged) {
          dispatch({ type: 'SET_QUEUE', queue: updatedQueue });
          currentQueue = updatedQueue;
        }
      } catch (err) {
        console.error('Error pre-resolving queue:', err);
        songsToResolve.forEach(({ song }) => resolvingSongsRef.current.delete(song.id));
      }
    }

    // Set the immediate next track in AudioService
    let nextIdx;
    if (stateRef.current.shuffle && currentQueue.length > 1) {
      let attempts = 0;
      do {
        nextIdx = Math.floor(Math.random() * currentQueue.length);
        attempts++;
      } while ((nextIdx === idx || stateRef.current.dislikes.has(currentQueue[nextIdx].id)) && attempts < 20);
    } else {
      nextIdx = idx + 1;
      while (nextIdx < currentQueue.length && stateRef.current.dislikes.has(currentQueue[nextIdx].id)) {
        nextIdx++;
      }
    }

    if (nextIdx < currentQueue.length) {
      AudioService.setNextTrack(currentQueue[nextIdx]);
    } else {
      // If we are at the end of the queue, and repeat all is enabled, loop back to the start!
      if (stateRef.current.repeat === 'all' && currentQueue.length > 0) {
        let firstIdx = 0;
        while (firstIdx < currentQueue.length && stateRef.current.dislikes.has(currentQueue[firstIdx].id)) {
          firstIdx++;
        }
        if (firstIdx < currentQueue.length) {
          let firstSong = { ...currentQueue[firstIdx] };
          if (!firstSong.uri || String(firstSong.id).startsWith('taste_')) {
            try {
              const searchResults = await JioSaavnAPI.searchSongs(`${firstSong.title} ${firstSong.artist}`);
              if (searchResults && searchResults.length > 0) {
                firstSong = { ...searchResults[0], ...firstSong };
              }
            } catch (e) {
              console.warn('Failed to pre-resolve first song for repeat-all:', e);
            }
          }
          AudioService.setNextTrack(firstSong);
          return;
        }
      }

      // If we are at the end of the queue, extend it in advance!
      try {
        const existingQueueIds = new Set(currentQueue.map(sq => sq.id));
        const extensionSongs = await extendRadioQueue(currentSong, { 
          existingQueueIds: existingQueueIds, 
          dislikedIds: stateRef.current.dislikes 
        });
        
        if (extensionSongs.length > 0) {
          const newQueue = [...currentQueue, ...extensionSongs];
          dispatch({ type: 'SET_QUEUE', queue: newQueue });
          
          let nextSong = { ...extensionSongs[0] };
          if (!nextSong.uri) {
            const searchResults = await JioSaavnAPI.searchSongs(`${nextSong.title} ${nextSong.artist}`);
            if (searchResults && searchResults.length > 0) {
              nextSong = { ...searchResults[0], ...nextSong };
            }
          }
          AudioService.setNextTrack(nextSong);
        }
      } catch (e) {
        console.error('Failed to pre-extend queue:', e);
      }
    }
  };

  // Keep pre-resolved next track in sync with repeat, shuffle, and queue edits
  useEffect(() => {
    if (state.currentSong) {
      preResolveNextSong(state.currentSong, state.queue);
    }
  }, [state.repeat, state.shuffle, state.queue, state.currentSong?.id]);

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

      if (status.userRequestedNext) {
        if (skipNextRef.current) {
          skipNextRef.current(false); // Manual skip
        }
        return;
      }

      if (status.userRequestedPrev) {
        if (skipPrevRef.current) {
          skipPrevRef.current();
        }
        return;
      }

      if (status.didJustFinish) {
        // Natural end of song -> reset skips and add listen time
        dispatch({ type: 'RESET_SKIPS' });
        const newStats = addListeningTime(Math.floor(s.durationMillis / 1000), s.stats);
        dispatch({ type: 'SET_STATS', stats: newStats });

        if (status.nextSongStarted) {
          // Sync transition completed successfully on mobile lock screen
          const nextSong = status.nextSongStarted;
          dispatch({ type: 'SET_SONG', song: nextSong });

          let history = addToHistory(nextSong, s.history);
          dispatch({ type: 'SET_HISTORY', history });

          let playStats = incrementPlayCount(nextSong.id, newStats);
          dispatch({ type: 'SET_STATS', stats: playStats });

          updateMLModel(nextSong, 'PLAY');

          // Build radio playlist and pre-resolve next track
          (async () => {
            try {
              const existingQueueIds = new Set(stateRef.current.queue.map(sq => sq.id));
              const dislikedIds = stateRef.current.dislikes;
              const radioSongs = await buildRadioPlaylist(nextSong, { existingQueueIds, dislikedIds });
              
              let extendedQueue = stateRef.current.queue;
              if (radioSongs.length > 0) {
                const currentIds = new Set(extendedQueue.map(sq => sq.id));
                const freshSongs = radioSongs.filter(sq => !currentIds.has(sq.id) && !stateRef.current.dislikes.has(sq.id));
                if (freshSongs.length > 0) {
                  extendedQueue = [...extendedQueue, ...freshSongs];
                  dispatch({ type: 'SET_QUEUE', queue: extendedQueue });
                }
              }
              await preResolveNextSong(nextSong, extendedQueue);
            } catch (e) {
              console.error('Radio playlist build failed after sync transition:', e);
            }
          })();
        } else {
          if (skipNextRef.current) {
            skipNextRef.current(true); // pass true to indicate natural completion
          }
        }
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
      if (status.activeSoundstage !== undefined) {
        dispatch({ type: 'SET_SOUNDSTAGE', value: status.activeSoundstage });
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
          } else {
            playableSong = {
              ...song,
              id: String(song.id).replace('taste_', 'failed_taste_')
            };
          }
        } catch (e) {
          console.warn('Failed to dynamically resolve JioSaavn stream:', e);
          playableSong = {
            ...song,
            id: String(song.id).replace('taste_', 'failed_taste_')
          };
        }
      }

      let currentQueue = stateRef.current.queue;
      // If a queue is explicitly provided (e.g. from search/AI results), use it
      if (queueOpt && queueOpt.length > 1) {
        currentQueue = queueOpt.map(q => q.id === song.id ? playableSong : q);
        dispatch({ type: 'SET_QUEUE', queue: currentQueue });
      } 
      // If the song is already in the existing queue, preserve the queue (replacing the placeholder if needed)
      else if (stateRef.current.queue.some(q => q.id === song.id)) {
        currentQueue = stateRef.current.queue.map(q => q.id === song.id ? playableSong : q);
        dispatch({ type: 'SET_QUEUE', queue: currentQueue });
      } 
      // Otherwise, collapse the queue to this single song and let the radio build recommendations
      else {
        currentQueue = [playableSong];
        dispatch({ type: 'SET_QUEUE', queue: currentQueue });
      }

      const s = stateRef.current;
      let stats = incrementPlayCount(playableSong.id, s.stats);
      dispatch({ type: 'SET_STATS', stats });
      let history = addToHistory(playableSong, s.history);
      dispatch({ type: 'SET_HISTORY', history });
      
      dispatch({ type: 'SET_SONG', song: playableSong });
      await AudioService.loadAndPlay(playableSong.uri, playableSong);
      
      // Update ML Decision Tree weights
      updateMLModel(playableSong, 'PLAY');

      // Build a 20+ song radio playlist in the background
      (async () => {
        try {
          const existingQueueIds = new Set(currentQueue.map(sq => sq.id));
          const dislikedIds = stateRef.current.dislikes;
          
          const radioSongs = await buildRadioPlaylist(playableSong, { existingQueueIds, dislikedIds });
          
          let extendedQueue = currentQueue;
          if (radioSongs.length > 0) {
            const currentIds = new Set(currentQueue.map(sq => sq.id));
            const freshSongs = radioSongs.filter(sq => !currentIds.has(sq.id) && !stateRef.current.dislikes.has(sq.id));
            
            if (freshSongs.length > 0) {
              extendedQueue = [...currentQueue, ...freshSongs];
              dispatch({ type: 'SET_QUEUE', queue: extendedQueue });
            }
          }
          // Now pre-resolve next song on the extended queue!
          await preResolveNextSong(playableSong, extendedQueue);
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

    // Check repeat one
    if (isNaturalFinish && updatedState.repeat === 'one') {
      await playSong(updatedState.currentSong);
      return;
    }

    // Dynamic Radio queue system
    const idx = updatedState.queue.findIndex((x) => x.id === updatedState.currentSong.id);
    
    let nextIdx;
    if (updatedState.shuffle && updatedState.queue.length > 1) {
      let attempts = 0;
      do {
        nextIdx = Math.floor(Math.random() * updatedState.queue.length);
        attempts++;
      } while ((nextIdx === idx || updatedState.dislikes.has(updatedState.queue[nextIdx].id)) && attempts < 20);
    } else {
      nextIdx = idx + 1;
      while (nextIdx < updatedState.queue.length && updatedState.dislikes.has(updatedState.queue[nextIdx].id)) {
        nextIdx++;
      }
    }

    if (nextIdx < updatedState.queue.length) {
      await playSong(updatedState.queue[nextIdx]);
      return;
    }
    
    // If we are at the end of the queue, and repeat all is enabled, loop back to the start!
    if (updatedState.repeat === 'all' && updatedState.queue.length > 0) {
      let firstIdx = 0;
      while (firstIdx < updatedState.queue.length && updatedState.dislikes.has(updatedState.queue[firstIdx].id)) {
        firstIdx++;
      }
      if (firstIdx < updatedState.queue.length) {
        await playSong(updatedState.queue[firstIdx]);
        return;
      }
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
      let prevIdx;
      if (s.shuffle && s.queue.length > 1) {
        let attempts = 0;
        do {
          prevIdx = Math.floor(Math.random() * s.queue.length);
          attempts++;
        } while ((prevIdx === idx || s.dislikes.has(s.queue[prevIdx].id)) && attempts < 20);
      } else {
        prevIdx = idx <= 0 ? s.queue.length - 1 : idx - 1;
        while (prevIdx !== idx && s.dislikes.has(s.queue[prevIdx].id)) {
          prevIdx = prevIdx <= 0 ? s.queue.length - 1 : prevIdx - 1;
        }
      }
      await playSong(s.queue[prevIdx]);
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
      setVolume: (val) => AudioService.setVolume(val),
      setQueue: (newQueue) => dispatch({ type: 'SET_QUEUE', queue: newQueue }),
      clearQueue: () => {
        const cur = stateRef.current.currentSong;
        dispatch({ type: 'SET_QUEUE', queue: cur ? [cur] : [] });
      },
      pauseSong: async () => { await AudioService.pause(); dispatch({ type: 'SET_PLAYING', value: false }); },
      resumeSong: async () => { await AudioService.play(); dispatch({ type: 'SET_PLAYING', value: true }); },
      stopSong: async () => { await AudioService.unload(); dispatch({ type: 'SET_PLAYING', value: false }); },
      nextSong: skipNext,
      previousSong: skipPrev,
      toggleShuffle: () => dispatch({ type: 'TOGGLE_SHUFFLE' }),
      setRepeat: () => dispatch({ type: 'SET_REPEAT' }),
    }}>
      {children}
    </MusicContext.Provider>
  );
};
