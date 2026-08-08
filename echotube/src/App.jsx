import { useState, useEffect, useRef, useCallback } from 'react';
import categorizedSongsData from './categorized_songs.json';
import ThemeToggle from './ThemeToggle';
import InstallBanner from './InstallBanner';
import { useMediaSession } from './hooks/useMediaSession';
import { searchSongs, getBestImage, getBestStreamUrl, getTrackArtists, mapApiTrackToSong } from './api/jiosaavn';
import './index.css';

const CATEGORIES = ['Happy', 'Lonely', 'Enjoyment'];
const CUSTOM_SONGS_KEY = 'echotube_custom_songs';
const REMOVED_SONGS_KEY = 'echotube_removed_songs';
// Cloud persistence: Supabase via the Vercel serverless function at /api/songs.
// The relative path works on the deployed site and with `vercel dev`; when
// running plain `npm run dev` it falls back to localStorage only.
const CLOUD_API = '/api/songs';
// Optional local Flask server (label_server.py): keeps categorized_songs.json in
// sync when developing on this machine.
const LOCAL_FILE_API = 'http://127.0.0.1:5000/api/songs';

function shuffleArray(items) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function formatTime(seconds) {
  if (!seconds || Number.isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function songKey(song) {
  return `${song.Title || ''}::${song.Artist || ''}`.toLowerCase();
}

function dedupeSongs(songs) {
  const seenKeys = new Set();
  const seenApiIds = new Set();
  const unique = [];
  for (const song of songs) {
    const key = songKey(song);
    const apiId = song.apiId;
    if (seenKeys.has(key)) continue;
    if (apiId && seenApiIds.has(apiId)) continue;
    seenKeys.add(key);
    if (apiId) seenApiIds.add(apiId);
    unique.push(song);
  }
  return unique;
}

async function postToCloud(song) {
  try {
    const res = await fetch(CLOUD_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(song),
    });
    if (!res.ok) {
      console.warn('Failed to persist song to cloud', res.status);
    }
  } catch (err) {
    console.warn('Cloud persistence unavailable, saved to localStorage only', err);
  }
}

async function postToLocalFile(song) {
  // Only meaningful when developing on this machine — skip on the deployed site.
  const host = window.location.hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') return;
  try {
    const res = await fetch(LOCAL_FILE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(song),
    });
    if (!res.ok) {
      console.warn('Failed to persist song to local file', res.status);
    }
  } catch {
    // Local dev server not running — cloud/localStorage already cover this.
  }
}

function loadCustomSongs() {
  try {
    const raw = localStorage.getItem(CUSTOM_SONGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(s => CATEGORIES.includes(s.Category)) : [];
  } catch {
    return [];
  }
}

function saveCustomSongs(songs) {
  try {
    localStorage.setItem(CUSTOM_SONGS_KEY, JSON.stringify(songs));
  } catch (err) {
    console.error('Failed to save custom songs', err);
  }
}

function loadRemovedSongKeys() {
  try {
    const raw = localStorage.getItem(REMOVED_SONGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRemovedSongKeys(keys) {
  try {
    localStorage.setItem(REMOVED_SONGS_KEY, JSON.stringify(keys));
  } catch (err) {
    console.error('Failed to save removed songs', err);
  }
}

function SongRow({ song, onPlay, onRemove, isActive }) {
  const [imgUrl, setImgUrl] = useState(song.image || null);

  useEffect(() => {
    if (song.image) {
      setImgUrl(song.image);
      return;
    }

    const fetchThumbnail = async () => {
      try {
        const results = await searchSongs(`${song.Title} ${song.Artist}`);
        
        let track = results[0];
        if (!track) {
          const fallbackResults = await searchSongs(song.Title);
          track = fallbackResults[0];
        }

        if (track) {
          setImgUrl(getBestImage(track.image));
        }
      } catch (err) {
        console.error('Failed to fetch thumbnail for', song.Title, err);
      }
    };

    fetchThumbnail();
  }, [song]);

  return (
    <div className={`song-row ${isActive ? 'active' : ''}`}>
      <button
        type="button"
        className="song-row-main"
        onClick={() => onPlay(song, imgUrl)}
      >
        <div className="song-row-art">
          {imgUrl ? <img src={imgUrl} alt={song.Title} /> : <div className="song-row-art-placeholder" />}
          <span className="song-row-play">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          </span>
        </div>
        <div className="song-row-info">
          <h3>{song.Title}</h3>
          <p>{song.Artist || 'Unknown artist'}</p>
        </div>
      </button>
      <button
        type="button"
        className="song-remove-btn"
        onClick={() => onRemove(song)}
        aria-label={`Remove ${song.Title}`}
        title="Remove from playlist"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
        </svg>
      </button>
    </div>
  );
}

function SearchResultRow({ track, onSelect }) {
  const image = getBestImage(track.image);
  const title = track.name || track.title || 'Unknown';
  const artist = getTrackArtists(track);

  return (
    <button type="button" className="song-row search-result-row" onClick={() => onSelect(track)}>
      <div className="song-row-art">
        {image ? <img src={image} alt={title} /> : <div className="song-row-art-placeholder" />}
        <span className="song-row-play">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
        </span>
      </div>
      <div className="song-row-info">
        <h3>{title}</h3>
        <p>{artist}</p>
      </div>
    </button>
  );
}

function App() {
  const [songs, setSongs] = useState([]);
  const [activeCategory, setActiveCategory] = useState('Happy');
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [pendingTrack, setPendingTrack] = useState(null);
  const audioRef = useRef(null);
  const shuffleQueueRef = useRef([]);
  const searchAbortRef = useRef(null);

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
  }, [theme]);

  useEffect(() => {
    const removedKeys = new Set(loadRemovedSongKeys());
    const baseSongs = categorizedSongsData
      .filter(s => CATEGORIES.includes(s.Category))
      .filter(s => !removedKeys.has(songKey(s)));
    const customSongs = loadCustomSongs().filter(s => !removedKeys.has(songKey(s)));
    const merged = dedupeSongs([...customSongs, ...baseSongs]);
    setSongs(merged);

    // Fetch songs saved in the cloud (Supabase) so songs added on any device
    // — including the deployed app on your phone — show up here too.
    const fetchCloudSongs = async () => {
      try {
        const res = await fetch(CLOUD_API);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success || !Array.isArray(data.songs)) return;
        const cloudSongs = data.songs
          .filter(s => CATEGORIES.includes(s.Category))
          .filter(s => !removedKeys.has(songKey(s)));

        // Sync any local custom songs up to the cloud so they reach other devices.
        const cloudKeys = new Set(cloudSongs.map(songKey));
        customSongs.forEach(s => {
          if (!cloudKeys.has(songKey(s))) postToCloud(s);
        });

        // Merge: newly-added cloud-only songs appear at the top, while existing
        // songs keep their familiar local/base order. Removed songs stay hidden.
        setSongs(prev => {
          const prevKeys = new Set(prev.map(songKey));
          const newCloudSongs = cloudSongs.filter(s => !prevKeys.has(songKey(s)));
          return dedupeSongs([...newCloudSongs, ...prev]);
        });

        // Cache cloud custom songs locally so they survive a temporary outage.
        // Read fresh from localStorage (not the closure) so a song added while
        // the fetch was in flight isn't dropped from the cache.
        const cloudCustom = cloudSongs.filter(s => s.isNew || s.apiId);
        if (cloudCustom.length) {
          saveCustomSongs(dedupeSongs([...cloudCustom, ...loadCustomSongs()]));
        }
      } catch (err) {
        console.warn('Could not fetch cloud songs, using local data only', err);
      }
    };
    fetchCloudSongs();
  }, []);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!query) {
      setSearchResults([]);
      setSearchError('');
      setIsSearching(false);
      return undefined;
    }

    const timer = setTimeout(async () => {
      if (searchAbortRef.current) searchAbortRef.current.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;

      setIsSearching(true);
      setSearchError('');

      try {
        const results = await searchSongs(query);
        if (controller.signal.aborted) return;
        
        if (results.length) {
          setSearchResults(results);
        } else {
          setSearchResults([]);
          setSearchError('No songs found. Try another search.');
        }
      } catch (err) {
        if (err.name === 'AbortError' || controller.signal.aborted) return;
        console.error(err);
        setSearchResults([]);
        setSearchError('Search failed. Please try again.');
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 400);

    return () => {
      clearTimeout(timer);
      if (searchAbortRef.current) searchAbortRef.current.abort();
    };
  }, [searchQuery]);

  const categorySongs = songs.filter(s => s.Category === activeCategory);
  const isSearchMode = searchQuery.trim().length > 0;

  const handleCategoryChange = (category) => {
    setActiveCategory(category);
    setIsShuffle(false);
    shuffleQueueRef.current = [];
    setSearchQuery('');
    setPendingTrack(null);
  };

  const playCategoryShuffle = () => {
    if (categorySongs.length === 0) return;

    const shuffled = shuffleArray(categorySongs);
    shuffleQueueRef.current = shuffled.slice(1);
    setIsShuffle(true);
    searchAndPlay(shuffled[0]);
  };

  const searchAndPlay = async (song, preloadedImgUrl) => {
    try {
      if (song.streamUrl) {
        setCurrentSong({
          ...song,
          streamUrl: song.streamUrl,
          image: preloadedImgUrl || song.image
        });
        setIsPlaying(true);
        return;
      }

      const results = await searchSongs(`${song.Title} ${song.Artist}`);
      
      let track = results[0];
      if (!track) {
        const fallbackResults = await searchSongs(song.Title);
        track = fallbackResults[0];
      }

      if (track) {
        const streamUrl = getBestStreamUrl(track.downloadUrl);

        if (!streamUrl) {
          alert('No playable stream found for this song');
          return;
        }

        setCurrentSong({
          ...song,
          apiData: track,
          streamUrl,
          image: preloadedImgUrl || getBestImage(track.image)
        });

        setIsPlaying(true);
      } else {
        alert('Song not found on JioSaavn');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to fetch song from JioSaavn');
    }
  };

  const previewSearchTrack = (track) => {
    const streamUrl = getBestStreamUrl(track.downloadUrl);
    if (!streamUrl) {
      alert('No playable preview found for this song');
      return;
    }

    const previewSong = mapApiTrackToSong(track, activeCategory);
    setPendingTrack(track);
    setIsShuffle(false);
    shuffleQueueRef.current = [];
    setCurrentSong({
      ...previewSong,
      apiData: track,
      streamUrl,
    });
    setIsPlaying(true);
  };

  const addPendingToCategory = (category) => {
    if (!pendingTrack) return;

    const newSong = mapApiTrackToSong(pendingTrack, category);
    if (!newSong.streamUrl) {
      alert('No playable stream found for this song');
      return;
    }

    const key = songKey(newSong);
    const removedKeys = loadRemovedSongKeys().filter(k => k !== key);
    saveRemovedSongKeys(removedKeys);

    setSongs(prev => {
      const withoutDupes = dedupeSongs(prev.filter(s => songKey(s) !== key));
      const next = dedupeSongs([newSong, ...withoutDupes]);
      saveCustomSongs(next.filter(s => s.isNew || s.apiId));
      return next;
    });

    // Persist to the cloud (Supabase) so the song survives app restarts and
    // shows up on every device. Also best-effort write to the local Flask server
    // so categorized_songs.json stays in sync when developing locally.
    postToCloud(newSong);
    postToLocalFile(newSong);

    setActiveCategory(category);
    setIsShuffle(false);
    shuffleQueueRef.current = [];
    setCurrentSong(prev => (prev ? { ...prev, ...newSong, Category: category } : newSong));
    setIsPlaying(true);
    setPendingTrack(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeSong = (song) => {
    const key = songKey(song);
    const wasPlaying = currentSong && songKey(currentSong) === key;

    setSongs(prev => {
      const next = prev.filter(s => songKey(s) !== key);
      saveCustomSongs(next.filter(s => s.isNew || s.apiId));

      const removedKeys = new Set(loadRemovedSongKeys());
      removedKeys.add(key);
      saveRemovedSongKeys([...removedKeys]);

      return next;
    });

    shuffleQueueRef.current = shuffleQueueRef.current.filter(s => songKey(s) !== key);

    if (wasPlaying) {
      const remainingInCategory = songs.filter(
        s => s.Category === activeCategory && songKey(s) !== key
      );

      if (remainingInCategory.length > 0) {
        const currentIndex = songs
          .filter(s => s.Category === activeCategory)
          .findIndex(s => songKey(s) === key);
        const nextSong = remainingInCategory[currentIndex % remainingInCategory.length]
          || remainingInCategory[0];
        searchAndPlay(nextSong);
      } else {
        setCurrentSong(null);
        setIsPlaying(false);
        setProgress(0);
        setCurrentTime(0);
        setDuration(0);
      }
    }
  };

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => console.log('Playback prevented', e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentSong]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
      const p = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(p || 0);
    }
  };

  const handleProgressClick = (e) => {
    if (audioRef.current && audioRef.current.duration) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const width = rect.width;
      const newTime = (clickX / width) * audioRef.current.duration;
      audioRef.current.currentTime = newTime;
    }
  };

  const togglePlay = () => {
    if (currentSong) {
      setIsPlaying(!isPlaying);
    }
  };

  const playNext = () => {
    if (!currentSong || categorySongs.length === 0) return;

    if (isShuffle) {
      if (shuffleQueueRef.current.length === 0) {
        const reshuffled = shuffleArray(
          categorySongs.filter(s => s.Title !== currentSong.Title)
        );
        const queue = reshuffled.length > 0 ? reshuffled : shuffleArray(categorySongs);
        shuffleQueueRef.current = queue.slice(1);
        searchAndPlay(queue[0]);
        return;
      }

      const nextSong = shuffleQueueRef.current.shift();
      searchAndPlay(nextSong);
      return;
    }

    const currentIndex = categorySongs.findIndex(s => s.Title === currentSong.Title);
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % categorySongs.length;
    searchAndPlay(categorySongs[nextIndex]);
  };

  const playPrev = () => {
    if (!currentSong || categorySongs.length === 0) return;
    const currentIndex = categorySongs.findIndex(s => s.Title === currentSong.Title);
    const prevIndex = currentIndex === -1
      ? 0
      : (currentIndex - 1 + categorySongs.length) % categorySongs.length;
    searchAndPlay(categorySongs[prevIndex]);
  };

  const handleEnded = () => {
    if (pendingTrack) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      return;
    }
    playNext();
  };

  const handlePlay = useCallback(() => {
    if (currentSong) setIsPlaying(true);
  }, [currentSong]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  useMediaSession({
    currentSong,
    isPlaying,
    activeCategory,
    currentTime,
    duration,
    onPlay: handlePlay,
    onPause: handlePause,
    onNext: playNext,
    onPrev: playPrev,
  });

  return (
    <div
      className={`app-container ${theme} mood-${activeCategory.toLowerCase()} ${isPlaying ? 'is-playing' : ''}`}
    >
      <div className="ambient-layer" aria-hidden="true">
        <span className="ambient-orb ambient-orb-a" />
        <span className="ambient-orb ambient-orb-b" />
        <span className="ambient-orb ambient-orb-c" />
        <span className="ambient-wash" />
      </div>

      <InstallBanner />
      <header className="app-header">
        <div className="app-header-top">
          <div>
            <p className="app-eyebrow">Your music</p>
            <h1 className="app-title">EchoTube</h1>
          </div>
          <ThemeToggle theme={theme} toggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
        </div>

        <div className="search-bar">
          <svg className="search-bar-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
          </svg>
          <input
            type="search"
            className="search-input"
            placeholder="Search for a song…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search for a song"
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => {
                setSearchQuery('');
                setPendingTrack(null);
              }}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        <div className="category-buttons" role="tablist" aria-label="Mood categories">
          {CATEGORIES.map(category => {
            const count = songs.filter(s => s.Category === category).length;
            return (
              <button
                key={category}
                type="button"
                role="tab"
                aria-selected={activeCategory === category}
                className={`category-btn category-btn-${category.toLowerCase()} ${activeCategory === category ? 'active' : ''}`}
                onClick={() => handleCategoryChange(category)}
              >
                <span className="category-btn-label">{category}</span>
                <span className="category-btn-count">{count}</span>
              </button>
            );
          })}
        </div>
      </header>

      <main className="main-content">
        {isSearchMode ? (
          <>
            <div className="section-header">
              <h2>Search results</h2>
              <p>
                {isSearching
                  ? 'Searching…'
                  : `${searchResults.length} result${searchResults.length === 1 ? '' : 's'}`}
              </p>
            </div>

            {isSearching && searchResults.length === 0 ? (
              <div className="empty-state">
                <p>Searching for songs…</p>
              </div>
            ) : searchError ? (
              <div className="empty-state">
                <p>{searchError}</p>
              </div>
            ) : (
              <div className="song-list">
                {searchResults.map((track) => (
                  <SearchResultRow
                    key={track.id || `${track.name}-${track.primaryArtists}`}
                    track={track}
                    onSelect={previewSearchTrack}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div className="section-header">
              <h2>{activeCategory}</h2>
              <p>{categorySongs.length} song{categorySongs.length === 1 ? '' : 's'}</p>
            </div>

            {categorySongs.length > 0 && (
              <button
                type="button"
                className={`shuffle-play-btn shuffle-play-btn-${activeCategory.toLowerCase()} ${isShuffle ? 'active' : ''}`}
                onClick={playCategoryShuffle}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" />
                </svg>
                Play list with shuffle
              </button>
            )}

            {categorySongs.length === 0 ? (
              <div className="empty-state">
                <p>No songs in this category yet.</p>
              </div>
            ) : (
              <div className="song-list">
                {categorySongs.map((song, idx) => (
                  <SongRow
                    key={`${song.Title}-${song.Artist}-${idx}`}
                    song={song}
                    onPlay={searchAndPlay}
                    onRemove={removeSong}
                    isActive={currentSong?.Title === song.Title}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {pendingTrack && (
        <div className="category-modal-backdrop" role="presentation">
          <div
            className="category-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-modal-title"
          >
            <div className="category-modal-track">
              {getBestImage(pendingTrack.image) ? (
                <img
                  src={getBestImage(pendingTrack.image)}
                  alt=""
                  className="category-modal-art"
                />
              ) : (
                <div className="category-modal-art" />
              )}
              <div>
                <p className="category-modal-eyebrow">Previewing</p>
                <h3 id="category-modal-title">{pendingTrack.name || pendingTrack.title}</h3>
                <p>{getTrackArtists(pendingTrack)}</p>
              </div>
            </div>

            <p className="category-modal-prompt">Add this song to which category?</p>

            <div className="category-modal-actions">
              {CATEGORIES.map(category => (
                <button
                  key={category}
                  type="button"
                  className={`category-modal-btn category-modal-btn-${category.toLowerCase()}`}
                  onClick={() => addPendingToCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="category-modal-dismiss"
              onClick={() => setPendingTrack(null)}
            >
              Keep previewing without saving
            </button>
          </div>
        </div>
      )}

      <div className={`bottom-player glass ${isPlaying ? 'playing' : ''}`}>
        <div className="now-playing-info">
          <div className={`now-playing-art ${isPlaying ? 'breathing' : ''}`}>
            {currentSong?.image ? (
              <img src={currentSong.image} alt="cover" className="now-playing-img" />
            ) : (
              <div className="now-playing-img" />
            )}
          </div>

          <div className="song-info">
            <h3>{currentSong ? currentSong.Title : 'No track playing'}</h3>
            <p>{currentSong ? currentSong.Artist : 'Pick a song to start'}</p>
          </div>
        </div>

        <div className="player-controls">
          <div className="control-buttons">
            <button
              type="button"
              className={`icon-btn ${isShuffle ? 'active-shuffle' : ''}`}
              onClick={() => {
                setIsShuffle(prev => {
                  if (prev) shuffleQueueRef.current = [];
                  return !prev;
                });
              }}
              aria-label="Toggle shuffle"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z" /></svg>
            </button>
            <button type="button" className="icon-btn" onClick={playPrev} aria-label="Previous song">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" /></svg>
            </button>
            <button type="button" className="icon-btn primary" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
            <button type="button" className="icon-btn" onClick={playNext} aria-label="Next song">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" /></svg>
            </button>
          </div>

          <div className="progress-container">
            <span>{formatTime(currentTime)}</span>
            <div className="progress-bar-bg" onClick={handleProgressClick}>
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={currentSong?.streamUrl}
        playsInline
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={handleEnded}
      />
    </div>
  );
}

export default App;
