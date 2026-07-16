import { useState, useEffect, useRef } from 'react';
import likedSongsData from './liked_songs.json';
import './index.css';

function SongCard({ song, onPlay }) {
  const [imgUrl, setImgUrl] = useState(null);

  useEffect(() => {
    // Dynamically fetch thumbnail on load
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
    <div className="song-card" onClick={() => onPlay(song, imgUrl)}>
      <div className="song-image-placeholder">
        {imgUrl && <img src={imgUrl} alt={song.Title} />}
        <div className="play-overlay">
          <button className="play-btn">
            <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
          </button>
        </div>
      </div>
      <div className="song-info">
        <h3>{song.Title}</h3>
        <p>{song.Artist}</p>
      </div>
      {song.Mood && <div className="mood-chip">{song.Mood}</div>}
    </div>
  );
}

function App() {
  const [songs, setSongs] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    setSongs(likedSongsData);
  }, []);

  const searchAndPlay = async (song, preloadedImgUrl) => {
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
        const downloadUrl = track.downloadUrl.find(url => url.quality === '320kbps') || track.downloadUrl[0];
        
        setCurrentSong({
          ...song,
          apiData: track,
          streamUrl: downloadUrl.url,
          image: preloadedImgUrl || track.image.find(img => img.quality === '500x500')?.url || track.image[0]?.url
        });
        
        setIsPlaying(true);
      } else {
        alert("Song not found on JioSaavn");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to fetch song from JioSaavn");
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
    if (!currentSong || songs.length === 0) return;
    let nextIndex;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * songs.length);
    } else {
      const currentIndex = songs.findIndex(s => s.Title === currentSong.Title);
      nextIndex = (currentIndex + 1) % songs.length;
    }
    searchAndPlay(songs[nextIndex]);
  };

  const playPrev = () => {
    if (!currentSong || songs.length === 0) return;
    const currentIndex = songs.findIndex(s => s.Title === currentSong.Title);
    const prevIndex = (currentIndex - 1 + songs.length) % songs.length;
    searchAndPlay(songs[prevIndex]);
  };

  return (
    <div className="app-container">
      {/* Sidebar */}
      <div className="sidebar glass">
        <div className="logo">EchoTube</div>
        <div className="nav-links">
          <a href="#" className="nav-link active">Home</a>
          <a href="#" className="nav-link">Discover</a>
          <a href="#" className="nav-link">Library</a>
          <a href="#" className="nav-link">Liked Songs</a>
        </div>
        <button className="upgrade-btn">Upgrade to Pro</button>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="header">
          <h1>Your Liked Songs</h1>
          <p>Curated from your spreadsheet</p>
        </div>

        <div className="song-grid">
          {songs.map((song, idx) => (
            <SongCard key={idx} song={song} onPlay={searchAndPlay} />
          ))}
        </div>
      </div>

      {/* Bottom Player */}
      <div className="bottom-player glass">
        <div className="now-playing-info">
          {currentSong && currentSong.image && (
            <img src={currentSong.image} alt="cover" className="now-playing-img" />
          )}
          {!currentSong?.image && <div className="now-playing-img"></div>}
          
          <div className="song-info">
            <h3 style={{ margin: 0 }}>{currentSong ? currentSong.Title : 'No track playing'}</h3>
            <p style={{ margin: 0 }}>{currentSong ? currentSong.Artist : ''}</p>
          </div>
        </div>

        <div className="player-controls">
          <div className="control-buttons">
            <button className={`icon-btn ${isShuffle ? 'active-shuffle' : ''}`} onClick={() => setIsShuffle(!isShuffle)} style={{ color: isShuffle ? 'var(--primary-accent)' : '' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/></svg>
            </button>
            <button className="icon-btn" onClick={playPrev}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
            </button>
            <button className="icon-btn primary" onClick={togglePlay}>
              {isPlaying ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>
            <button className="icon-btn" onClick={playNext}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
          </div>
          <div className="progress-container">
            <span style={{ minWidth: 32 }}>{currentSong ? '0:00' : '--:--'}</span>
            <div className="progress-bar-bg" onClick={handleProgressClick}>
              <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
            </div>
            <span style={{ minWidth: 32 }}>{currentSong ? '3:00' : '--:--'}</span>
          </div>
        </div>
        
        <div className="extra-controls"></div>
      </div>

      <audio 
        ref={audioRef} 
        src={currentSong?.streamUrl} 
        onTimeUpdate={handleTimeUpdate}
        onEnded={playNext}
      />
    </div>
  );
}

export default App;
