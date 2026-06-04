import React from 'react';
import { useMusic } from '../context/MusicContext';
import { Shuffle, Repeat } from 'lucide-react';

export default function PlayerBar({ onToggleQueue, showQueue, onPress }) {
  const { state, togglePlay, skipNext, skipPrev, seekTo, setVolume, toggleFavorite, toggleShuffle, setRepeat } = useMusic();
  const { currentSong, isPlaying, isBuffering, positionMillis, durationMillis, favorites, shuffle, repeat } = state;

  if (!currentSong) return null;

  // Since favorites is a Set, check if it has the currentSong.id
  const isFav = favorites instanceof Set ? favorites.has(currentSong.id) : Array.isArray(favorites) ? favorites.includes(currentSong.id) : false;
  const progress = durationMillis > 0 ? (positionMillis / durationMillis) * 100 : 0;

  const handleSeekChange = (e) => {
    const pct = Number(e.target.value) / 100;
    seekTo(pct * durationMillis);
  };

  const handleVolumeChange = (e) => {
    const val = Number(e.target.value) / 100;
    setVolume(val);
  };

  return (
    <div className="player-bar-container">
      {/* Top micro progress bar on mobile / integrated progress bar on desktop */}
      <div className="player-progress-wrapper">
        <input
          type="range"
          min={0}
          max={100}
          value={progress}
          onChange={handleSeekChange}
          className="player-seek-bar"
        />
      </div>

      <div className="player-bar-grid">
        {/* Left Column: 30% */}
        <div className="player-bar-left" onClick={onPress} style={{ cursor: 'pointer' }}>
          <img
            src={currentSong.artwork}
            alt={currentSong.title}
            className="player-bar-art"
            onError={(e) => { e.target.src = 'https://picsum.photos/seed/default/400/400'; }}
          />
          <div className="player-bar-details">
            <span className="player-bar-title">{currentSong.title}</span>
            <span className="player-bar-artist">{currentSong.artist}</span>
          </div>
        </div>

        {/* Center Column: 40% */}
        <div className="player-bar-center">
          <div className="player-controls-row">
            {/* Shuffle button — left of prev */}
            <button
              onClick={toggleShuffle}
              title="Shuffle"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: shuffle ? '#ff6b35' : '#7a7a9a',  // accent when active
                fontSize: '18px',
                padding: '8px',
                transition: 'color 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Shuffle size={18} />
            </button>

            <button className="player-nav-btn desktop-only" onClick={skipPrev} aria-label="Previous Song">
              <i className="fas fa-backward" />
            </button>
            <button className="player-main-play-btn" onClick={togglePlay} aria-label={isPlaying ? "Pause" : "Play"}>
              {isBuffering ? (
                <i className="fas fa-circle-notch fa-spin" />
              ) : isPlaying ? (
                <i className="fas fa-pause" />
              ) : (
                <i className="fas fa-play" style={{ transform: 'translateX(1px)' }} />
              )}
            </button>
            <button className="player-nav-btn desktop-only" onClick={skipNext} aria-label="Next Song">
              <i className="fas fa-forward" />
            </button>

            {/* Repeat button — right of next */}
            <button
              onClick={setRepeat}
              title="Repeat"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: repeat !== 'none' ? '#ff6b35' : '#7a7a9a',
                fontSize: '18px',
                padding: '8px',
                position: 'relative',
                transition: 'color 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Repeat size={18} />
              {/* Show "1" badge when repeat one is active */}
              {repeat === 'one' && (
                <span style={{
                  position: 'absolute',
                  top: '2px',
                  right: '2px',
                  fontSize: '9px',
                  color: '#ff6b35',
                  fontWeight: 700,
                }}>1</span>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: 30% */}
        <div className="player-bar-right desktop-only">
          <div className="player-volume-wrapper">
            <i className="fas fa-volume-up player-volume-icon" />
            <input
              type="range"
              min={0}
              max={100}
              defaultValue={80}
              onChange={handleVolumeChange}
              className="player-volume-slider"
            />
          </div>
          <button className={`player-extra-btn ${showQueue ? 'active' : ''}`} onClick={onToggleQueue} aria-label="Toggle Queue">
            <i className="fas fa-list-ul" />
          </button>
          <button className={`player-extra-btn ${isFav ? 'liked' : ''}`} onClick={() => toggleFavorite(currentSong.id)} aria-label="Toggle Favorite">
            <i className={isFav ? "fas fa-heart" : "far fa-heart"} />
          </button>
        </div>
      </div>
    </div>
  );
}
