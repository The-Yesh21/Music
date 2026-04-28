import React, { useState, useRef } from 'react';
import { useMusic } from '../context/MusicContext';

const formatTime = (totalSeconds) => {
  if (!totalSeconds || isNaN(totalSeconds)) return '0:00';
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default function PlayerScreen({ onClose }) {
  const { state, togglePlay, skipNext, skipPrev, seekTo, toggleFavorite, toggleDislike, playSong } = useMusic();
  const { currentSong, isPlaying, positionMillis, durationMillis, isBuffering, queue } = state;
  const [isClosing, setIsClosing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const progressRef = useRef(null);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 350);
  };

  if (!currentSong) return null;

  const pos = positionMillis / 1000;
  const dur = durationMillis / 1000 || currentSong.duration || 1;
  const progressPercent = Math.min(100, Math.max(0, (pos / dur) * 100));

  const handleSeek = (e) => {
    if (!progressRef.current) return;
    const rect = progressRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    seekTo(percent * durationMillis);
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    handleSeek(e);
  };

  const handleMouseMove = (e) => {
    if (isDragging) handleSeek(e);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const upcomingSongs = queue.slice(queue.findIndex(s => s.id === currentSong.id) + 1).slice(0, 15);

  return (
    <div 
      className="player-screen" 
      style={{ 
        position: 'fixed', 
        top: 0, 
        left: 0, 
        right: 0, 
        bottom: 0, 
        zIndex: 100, 
        display: 'flex',
        flexDirection: 'column',
        animation: isClosing ? 'slideDown 0.4s cubic-bezier(0.65, 0, 0.35, 1) forwards' : 'slideUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Animated Glassmorphism Dynamic Background */}
      <div 
        className="player-bg-blur"
        style={{
          position: 'absolute', 
          top: '-15%', 
          left: '-15%', 
          right: '-15%', 
          bottom: '-15%',
          backgroundImage: `url(${currentSong.artwork})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(80px) brightness(0.4) saturate(1.8)',
          zIndex: 1,
          transform: isPlaying ? 'scale(1.05)' : 'scale(1)',
          transition: 'transform 8s ease-in-out, background-image 0.8s ease-in-out'
        }}
      />

      {/* Gradient overlay for better contrast */}
      <div 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0, 
          background: 'linear-gradient(180deg, rgba(6,6,14,0.3) 0%, rgba(6,6,14,0.6) 50%, rgba(6,6,14,0.85) 100%)',
          zIndex: 2 
        }} 
      />

      {/* Main Content */}
      <div 
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          height: '100%', 
          position: 'relative', 
          zIndex: 3,
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div 
          className="player-header"
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '24px 28px',
            flexShrink: 0
          }}
        >
          <button 
            onClick={handleClose} 
            className="player-btn-icon"
            style={{ 
              background: 'rgba(255,255,255,0.06)', 
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#fff', 
              fontSize: 18, 
              width: 44, 
              height: 44, 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              cursor: 'pointer',
              transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.12)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            <i className="fas fa-chevron-down" />
          </button>
          
          <div style={{ textAlign: 'center' }}>
            <div 
              style={{ 
                fontSize: '11px', 
                color: 'rgba(255,255,255,0.4)', 
                fontWeight: 700, 
                letterSpacing: '2px', 
                textTransform: 'uppercase'
              }}
            >
              Now Playing
            </div>
            <div 
              className="album-text"
              style={{ 
                fontSize: '13px', 
                color: 'rgba(255,255,255,0.7)', 
                fontWeight: 600, 
                marginTop: 4,
                maxWidth: '200px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {currentSong.album}
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 10 }}>
            <button 
              onClick={() => toggleDislike(currentSong.id)} 
              className="player-btn-icon"
              style={{ 
                background: state.dislikes?.has(currentSong.id) ? 'rgba(255,60,111,0.2)' : 'rgba(255,255,255,0.06)', 
                border: '1px solid rgba(255,255,255,0.08)',
                color: state.dislikes?.has(currentSong.id) ? 'var(--danger)' : '#fff', 
                fontSize: 16, 
                width: 44, 
                height: 44, 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <i className={state.dislikes?.has(currentSong.id) ? "fas fa-thumbs-down" : "far fa-thumbs-down"} />
            </button>
            <button 
              onClick={() => toggleFavorite(currentSong.id)} 
              className="player-btn-icon"
              style={{ 
                background: state.favorites?.has(currentSong.id) ? 'rgba(255,107,53,0.2)' : 'rgba(255,255,255,0.06)', 
                border: '1px solid rgba(255,255,255,0.08)',
                color: state.favorites?.has(currentSong.id) ? 'var(--accent)' : '#fff', 
                fontSize: 16, 
                width: 44, 
                height: 44, 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <i className={state.favorites?.has(currentSong.id) ? "fas fa-heart" : "far fa-heart"} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div 
          style={{ 
            flex: 1, 
            overflowY: 'auto',
            overflowX: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            padding: '0 28px 24px'
          }}
        >
          {/* Artwork */}
          <div 
            style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              padding: '20px 0 30px',
              flexShrink: 0
            }}
          >
            <div 
              className="artwork-container"
              style={{
                position: 'relative',
                transform: isPlaying ? 'scale(1)' : 'scale(0.97)',
                transition: 'transform 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
              }}
            >
              <img 
                src={currentSong.artwork} 
                alt={currentSong.title} 
                className="player-artwork"
                style={{ 
                  width: 'min(320px, 65vw)', 
                  height: 'min(320px, 65vw)',
                  maxWidth: 340,
                  maxHeight: 340,
                  borderRadius: 24, 
                  objectFit: 'cover', 
                  boxShadow: isPlaying 
                    ? '0 25px 60px rgba(0,0,0,0.6), 0 0 60px rgba(255,107,53,0.15), 0 0 100px rgba(199,125,255,0.1)' 
                    : '0 15px 40px rgba(0,0,0,0.5), 0 0 30px rgba(255,107,53,0.08)',
                  transition: 'box-shadow 0.6s ease, border-radius 0.3s ease'
                }} 
              />
              {isBuffering && (
                <div 
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.4)',
                    borderRadius: 24,
                    backdropFilter: 'blur(4px)'
                  }}
                >
                  <i className="fas fa-circle-notch fa-spin" style={{ fontSize: 40, color: 'var(--accent)' }} />
                </div>
              )}
            </div>
          </div>

          {/* Song Info */}
          <div style={{ textAlign: 'center', marginBottom: 28, flexShrink: 0 }}>
            <h1 
              className="song-title"
              style={{ 
                color: '#fff', 
                fontSize: 'clamp(22px, 5vw, 32px)', 
                fontWeight: 800, 
                marginBottom: 8,
                letterSpacing: '-0.02em',
                lineHeight: 1.2
              }}
            >
              {currentSong.title}
            </h1>
            <p 
              className="artist-name"
              style={{ 
                color: 'rgba(255,255,255,0.6)', 
                fontSize: 'clamp(14px, 3vw, 18px)', 
                fontWeight: 500,
                letterSpacing: '0.01em'
              }}
            >
              {currentSong.artist}
            </p>
          </div>

          {/* Progress Bar */}
          <div 
            ref={progressRef}
            style={{ 
              width: '100%', 
              height: 24,
              display: 'flex',
              alignItems: 'center',
              cursor: 'pointer',
              marginBottom: 8,
              flexShrink: 0
            }}
            onClick={handleSeek}
            onMouseDown={handleMouseDown}
          >
            <div 
              style={{ 
                width: '100%', 
                height: 5, 
                background: 'rgba(255,255,255,0.12)', 
                borderRadius: 3, 
                overflow: 'visible',
                position: 'relative'
              }}
            >
              <div 
                style={{ 
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: `${progressPercent}%`, 
                  height: '100%', 
                  background: 'var(--accent-gradient)', 
                  borderRadius: 3,
                  transition: isDragging ? 'none' : 'width 0.1s linear'
                }} 
              />
              <div 
                style={{
                  position: 'absolute',
                  left: `${progressPercent}%`,
                  top: '50%',
                  transform: `translate(-50%, -50%) scale(${isDragging ? 1.4 : 0})`,
                  width: 16,
                  height: 16,
                  background: '#fff',
                  borderRadius: '50%',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                  transition: 'transform 0.15s ease, left 0.1s linear',
                  opacity: isDragging ? 1 : 0
                }}
              />
            </div>
          </div>
          
          {/* Time Display */}
          <div 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              marginBottom: 24, 
              color: 'rgba(255,255,255,0.4)', 
              fontSize: 13, 
              fontWeight: 600,
              letterSpacing: '0.02em',
              flexShrink: 0
            }}
          >
            <span>{formatTime(pos)}</span>
            <span>{formatTime(dur)}</span>
          </div>

          {/* Controls */}
          <div 
            style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: 'clamp(24px, 8vw, 48px)',
              marginBottom: 32,
              flexShrink: 0
            }}
          >
            <button 
              onClick={skipPrev} 
              className="control-btn"
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: 'rgba(255,255,255,0.8)', 
                fontSize: 24, 
                width: 52,
                height: 52,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            >
              <i className="fas fa-step-backward" />
            </button>
            
            <button 
              onClick={togglePlay} 
              className="play-btn"
              style={{ 
                background: 'var(--accent-gradient)', 
                border: 'none', 
                color: '#fff', 
                width: 72, 
                height: 72, 
                borderRadius: '50%', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                fontSize: 26, 
                cursor: 'pointer',
                boxShadow: isPlaying 
                  ? '0 8px 32px rgba(255,107,53,0.4), 0 0 0 1px rgba(255,255,255,0.1) inset' 
                  : '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1) inset',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.08)';
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(255,107,53,0.5), 0 0 0 1px rgba(255,255,255,0.15) inset';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = isPlaying 
                  ? '0 8px 32px rgba(255,107,53,0.4), 0 0 0 1px rgba(255,255,255,0.1) inset' 
                  : '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1) inset';
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1.08)'}
            >
              <i 
                className={isPlaying ? "fas fa-pause" : "fas fa-play"} 
                style={{ marginLeft: isPlaying ? 0 : 3 }} 
              />
            </button>

            <button 
              onClick={() => skipNext()} 
              className="control-btn"
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: 'rgba(255,255,255,0.8)', 
                fontSize: 24, 
                width: 52,
                height: 52,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            >
              <i className="fas fa-step-forward" />
            </button>
          </div>

          {/* Up Next Section */}
          {upcomingSongs.length > 0 && (
            <div 
              className="up-next-section"
              style={{ 
                background: 'rgba(255,255,255,0.03)', 
                padding: '24px', 
                borderRadius: 24,
                border: '1px solid rgba(255,255,255,0.06)',
                backdropFilter: 'blur(10px)',
                flexShrink: 0,
                marginBottom: 20
              }}
            >
              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: 20 
                }}
              >
                <h3 
                  style={{ 
                    fontSize: 16, 
                    fontWeight: 700, 
                    color: 'rgba(255,255,255,0.9)', 
                    letterSpacing: '-0.01em'
                  }}
                >
                  Up Next
                </h3>
                <span 
                  style={{ 
                    fontSize: 12, 
                    color: 'rgba(255,255,255,0.35)', 
                    fontWeight: 500 
                  }}
                >
                  {upcomingSongs.length} songs
                </span>
              </div>
              
              <div 
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: 10
                }}
              >
                {upcomingSongs.map((s, i) => (
                  <div 
                    key={`${s.id}-${i}`} 
                    className="up-next-item"
                    onClick={() => playSong(s)} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 14,
                      padding: '10px 12px',
                      borderRadius: 12,
                      cursor: 'pointer',
                      transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      background: 'transparent'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                      e.currentTarget.style.transform = 'translateX(4px)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.transform = 'translateX(0)';
                    }}
                  >
                    <div style={{ position: 'relative' }}>
                      <img 
                        src={s.artwork} 
                        alt={s.title}
                        style={{ 
                          width: 48, 
                          height: 48, 
                          borderRadius: 8, 
                          objectFit: 'cover',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                        }} 
                      />
                      <div 
                        className="play-overlay"
                        style={{
                          position: 'absolute',
                          inset: 0,
                          background: 'rgba(0,0,0,0.5)',
                          borderRadius: 8,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0,
                          transition: 'opacity 0.2s ease'
                        }}
                      >
                        <i className="fas fa-play" style={{ color: '#fff', fontSize: 16 }} />
                      </div>
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                      <div 
                        style={{ 
                          fontSize: 15, 
                          fontWeight: 600, 
                          color: '#fff', 
                          whiteSpace: 'nowrap', 
                          textOverflow: 'ellipsis', 
                          overflow: 'hidden',
                          letterSpacing: '-0.01em',
                          marginBottom: 3
                        }}
                      >
                        {s.title}
                      </div>
                      <div 
                        style={{ 
                          fontSize: 13, 
                          color: 'rgba(255,255,255,0.45)', 
                          whiteSpace: 'nowrap', 
                          textOverflow: 'ellipsis', 
                          overflow: 'hidden',
                          fontWeight: 500
                        }}
                      >
                        {s.artist}
                      </div>
                    </div>
                    <i 
                      className="fas fa-chevron-right" 
                      style={{ 
                        color: 'rgba(255,255,255,0.2)', 
                        fontSize: 12,
                        transition: 'color 0.2s ease, transform 0.2s ease'
                      }} 
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
