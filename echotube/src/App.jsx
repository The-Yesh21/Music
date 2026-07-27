import { useState, useEffect, useRef } from 'react';
import categorizedSongsData from './categorized_songs.json';
import ThemeToggle from './ThemeToggle';
import './index.css';

const CATEGORIES = ['Happy', 'Lonely', 'Enjoyment'];

function formatTime(seconds) {
  if (!seconds || Number.isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function SongRow({ song, onPlay, isActive }) {
  const [imgUrl, setImgUrl] = useState(song.image || null);

  useEffect(() => {
    if (song.image) {
      setImgUrl(song.image);
      return;
    }

    const fetchThumbnail = async () => {
      try {
        let query = encodeURIComponent(`${song.Title} ${song.Artist}`);
        let res = await fetch(`https://jio-blue.vercel.app/api/search/songs?query=${query}`);
        let data = await res.json();

        if (!data.success || !data.data || data.data.results.length === 0) {
          query = encodeURIComponent(song.Title);
          res = await fetch(`https://jio-blue.vercel.app/api/search/songs?query=${query}`);
          data = await res.json();
        }

        if (data.success && data.data && data.data.results.length > 0) {
          const track = data.data.results[0];
          const bestImg = track.image.find(img => img.quality === '500x500')?.url || track.image[0]?.url;
          setImgUrl(bestImg);
        }
      } catch (err) {
        console.error('Failed to fetch thumbnail for', song.Title);
      }
    };

    fetchThumbnail();
  }, [song]);

  return (
    <button
      type="button"
      className={`song-row ${isActive ? 'active' : ''}`}
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
  const audioRef = useRef(null);

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
  }, [theme]);

  useEffect(() => {
    setSongs(categorizedSongsData.filter(s => CATEGORIES.includes(s.Category)));
  }, []);

  const categorySongs = songs.filter(s => s.Category === activeCategory);

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

      let query = encodeURIComponent(`${song.Title} ${song.Artist}`);
      let res = await fetch(`https://jio-blue.vercel.app/api/search/songs?query=${query}`);
      let data = await res.json();

      if (!data.success || !data.data || data.data.results.length === 0) {
        query = encodeURIComponent(song.Title);
        res = await fetch(`https://jio-blue.vercel.app/api/search/songs?query=${query}`);
        data = await res.json();
      }

      if (data.success && data.data && data.data.results.length > 0) {
        const track = data.data.results[0];
        const downloadUrl = track.downloadUrl.find(url => url.quality === '320kbps') || track.downloadUrl[0];

        setCurrentSong({
          ...song,
          apiData: track,
          streamUrl: downloadUrl.url,
          image: preloadedImgUrl || track.image.find(img => img.quality === '500x500')?.url || track.image[0]?.url
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
    let nextIndex;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * categorySongs.length);
    } else {
      const currentIndex = categorySongs.findIndex(s => s.Title === currentSong.Title);
      nextIndex = (currentIndex + 1) % categorySongs.length;
    }
    searchAndPlay(categorySongs[nextIndex]);
  };

  const playPrev = () => {
    if (!currentSong || categorySongs.length === 0) return;
    const currentIndex = categorySongs.findIndex(s => s.Title === currentSong.Title);
    const prevIndex = (currentIndex - 1 + categorySongs.length) % categorySongs.length;
    searchAndPlay(categorySongs[prevIndex]);
  };

  return (
    <div className={`app-container ${theme}`}>
      <header className="app-header">
        <div className="app-header-top">
          <div>
            <p className="app-eyebrow">Your music</p>
            <h1 className="app-title">EchoTube</h1>
          </div>
          <ThemeToggle theme={theme} toggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
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
                onClick={() => setActiveCategory(category)}
              >
                <span className="category-btn-label">{category}</span>
                <span className="category-btn-count">{count}</span>
              </button>
            );
          })}
        </div>
      </header>

      <main className="main-content">
        <div className="section-header">
          <h2>{activeCategory}</h2>
          <p>{categorySongs.length} song{categorySongs.length === 1 ? '' : 's'}</p>
        </div>

        {categorySongs.length === 0 ? (
          <div className="empty-state">
            <p>No songs in this category yet.</p>
          </div>
        ) : (
          <div className="song-list">
            {categorySongs.map((song, idx) => (
              <SongRow
                key={`${song.Title}-${idx}`}
                song={song}
                onPlay={searchAndPlay}
                isActive={currentSong?.Title === song.Title}
              />
            ))}
          </div>
        )}
      </main>

      <div className="bottom-player glass">
        <div className="now-playing-info">
          {currentSong?.image ? (
            <img src={currentSong.image} alt="cover" className="now-playing-img" />
          ) : (
            <div className="now-playing-img" />
          )}

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
              onClick={() => setIsShuffle(!isShuffle)}
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
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={playNext}
      />
    </div>
  );
}

export default App;
