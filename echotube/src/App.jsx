import { useState, useEffect, useRef } from 'react';
import categorizedSongsData from './categorized_songs.json';
import Loader from './Loader';
import ThemeToggle from './ThemeToggle';
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
  const [theme, setTheme] = useState('dark');
  const audioRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('custom_songs');
    if (saved) {
      setSongs([...JSON.parse(saved), ...categorizedSongsData]);
    } else {
      setSongs(categorizedSongsData);
    }
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`https://jio-blue.vercel.app/api/search/songs?query=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (data.success && data.data) {
        setSearchResults(data.data.results || []);
      }
    } catch (err) {
      console.error(err);
    }
    setIsSearching(false);
  };

  const addToLibrary = (track) => {
    const newSong = {
      Title: track.name,
      Artist: track.primaryArtists,
      Mood: 'New',
      Genre: 'New'
    };
    if (songs.some(s => s.Title === newSong.Title)) return;
    
    const newSongs = [newSong, ...songs];
    setSongs(newSongs);
    
    const saved = JSON.parse(localStorage.getItem('custom_songs') || '[]');
    localStorage.setItem('custom_songs', JSON.stringify([newSong, ...saved]));
    setSearchResults([]); 
    setSearchQuery('');
  };

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
    <div className={`app-container ${theme}`}>
      {/* Sidebar */}
      <div className="sidebar glass">
        <div className="logo">EchoTube</div>
        <div className="nav-links">
          <a href="#" className="nav-link active">Home</a>
          <a href="#" className="nav-link">Discover</a>
          <a href="#" className="nav-link">Library</a>
          <a href="#" className="nav-link">Liked Songs</a>
        </div>
        <div style={{ marginTop: 'auto', marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
          <ThemeToggle theme={theme} toggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
        </div>
        <button className="upgrade-btn">Upgrade to Pro</button>
      </div>

      {/* Main Content */}
      <div className="main-content">
        <div className="header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1>Your Liked Songs</h1>
            <p>Curated from your spreadsheet</p>
          </div>
          
          <div className="search-container" style={{ position: 'relative', display: 'flex', gap: '8px' }}>
            <input 
              type="text" 
              placeholder="Search to add songs..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--surface-color)', color: 'var(--text-primary)', width: '300px', outline: 'none' }}
            />
            <button className="upgrade-btn" onClick={handleSearch} style={{ margin: 0, padding: '12px 24px' }}>Search</button>
            
            {isSearching && (
              <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', zIndex: 10, display: 'flex', justifyContent: 'center', padding: '40px', background: 'var(--surface-color)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                <Loader />
              </div>
            )}
            
            {!isSearching && searchResults.length > 0 && (
              <div className="search-results glass" style={{ position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', borderRadius: '12px', zIndex: 10, maxHeight: '400px', overflowY: 'auto' }}>
                {searchResults.map(track => (
                  <div key={track.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderBottom: '1px solid var(--border-color)', cursor: 'pointer' }} onClick={() => searchAndPlay({Title: track.name, Artist: track.primaryArtists})}>
                    <img src={track.image.find(img => img.quality === '150x150')?.url || track.image[0]?.url} alt="" style={{width: '40px', height: '40px', borderRadius: '4px'}} />
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)' }}>{track.name}</div>
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{track.primaryArtists}</div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); addToLibrary(track); }} style={{ background: songs.some(s => s.Title === track.name) ? 'var(--border-color)' : 'var(--primary-accent)', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '16px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>
                      {songs.some(s => s.Title === track.name) ? 'Added' : 'Add'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {['Happy', 'Lonely', 'Enjoyment'].map(category => {
          const categorySongs = songs.filter(s => s.Category === category);
          if (categorySongs.length === 0) return null;
          return (
            <div key={category} style={{ marginBottom: '40px' }}>
              <h2 style={{ marginBottom: '16px', color: 'var(--text-primary)', fontSize: '24px', fontWeight: 'bold' }}>{category}</h2>
              <div className="song-grid">
                {categorySongs.map((song, idx) => (
                  <SongCard key={idx} song={song} onPlay={searchAndPlay} />
                ))}
              </div>
            </div>
          );
        })}
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
