import React, { useState, useEffect } from 'react';
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

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(onClose, 350);
  };

  if (!currentSong) return null;

  const pos = positionMillis / 1000;
  const dur = durationMillis / 1000 || currentSong.duration || 1;
  const progressPercent = Math.min(100, Math.max(0, (pos / dur) * 100));

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    seekTo(percent * durationMillis);
  };

  return (
    <div className="player-screen fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, overflow: 'hidden', animation: isClosing ? 'slideUp 0.4s reverse' : 'slideUp 0.4s cubic-bezier(0.34,1.56,0.64,1)' }}>
      
      {/* Glassmorphism Dynamic Background */}
      <div style={{
        position: 'absolute', top: '-10%', left: '-10%', right: '-10%', bottom: '-10%',
        backgroundImage: `url(${currentSong.artwork})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'blur(60px) brightness(0.35) saturate(1.6)',
        zIndex: 1,
        transition: 'background-image 1s ease-in-out'
      }}></div>

      {/* Solid overlay for contrast */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(11, 11, 20, 0.45)', zIndex: 2 }}></div>

      {/* Main Content Pane */}
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', zIndex: 3, padding: '40px 20px', paddingBottom: 60 }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <button onClick={handleClose} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff', fontSize: 20, width: 44, height: 44, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(10px)' }}>
            <i className="fas fa-chevron-down" />
          </button>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Now Playing</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', fontWeight: 700, marginTop: 4 }}>{currentSong.album}</div>
          </div>
          {/* Action Row */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => toggleDislike(currentSong.id)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: state.dislikes?.has(currentSong.id) ? 'var(--danger)' : '#fff', fontSize: 18, width: 44, height: 44, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(10px)' }}>
              <i className={state.dislikes?.has(currentSong.id) ? "fas fa-thumbs-down" : "far fa-thumbs-down"} />
            </button>
            <button onClick={() => toggleFavorite(currentSong.id)} style={{ background: 'rgba(255,255,255,0.08)', border: 'none', color: state.favorites?.has(currentSong.id) ? 'var(--accent)' : '#fff', fontSize: 18, width: 44, height: 44, borderRadius: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', backdropFilter: 'blur(10px)' }}>
              <i className={state.favorites?.has(currentSong.id) ? "fas fa-heart" : "far fa-heart"} />
            </button>
          </div>
        </div>

        {/* Artwork */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '20px 0' }}>
          <img src={currentSong.artwork} alt={currentSong.title} 
            style={{ 
              width: '100%', maxWidth: 320, aspectRatio: '1/1', 
              borderRadius: 24, objectFit: 'cover', 
              boxShadow: '0 20px 50px rgba(0,0,0,0.5), 0 0 40px rgba(255,107,53,0.1)',
              transform: state.isPlaying ? 'scale(1.02)' : 'scale(0.98)',
              transition: 'transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
            }} 
          />
        </div>

        {/* Info & Controls */}
        <div style={{ padding: '0 10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div style={{ flex: 1, marginRight: 20 }}>
              <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 800, marginBottom: 8 }}>{currentSong.title}</h2>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 18, fontWeight: 500 }}>{currentSong.artist}</p>
            </div>
          </div>

          {/* Progress */}
          <div style={{ marginTop: 24 }}>
            <div 
              style={{ width: '100%', height: 6, background: 'rgba(255,255,255,0.15)', borderRadius: 3, cursor: 'pointer', overflow: 'hidden' }}
              onClick={handleSeek}
            >
              <div style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--accent-gradient)', borderRadius: 3, transition: 'width 0.1s linear' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, color: 'rgba(255,255,255,0.45)', fontSize: 12, fontWeight: 600 }}>
              <span>{formatTime(pos)}</span>
              <span>{formatTime(dur)}</span>
            </div>
          </div>

          {/* Buffering Indicator Alert */}
          {state.isBuffering && (
            <div style={{ margin: '16px 0', textAlign: 'center' }}>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, opacity: 0.8 }}><i className="fas fa-circle-notch fa-spin" style={{ marginRight: 8, color: 'var(--accent)' }}/>Buffering High-Quality Stream...</span>
            </div>
          )}

          {/* Action Controls */}
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 40, marginTop: state.isBuffering ? 10 : 20, padding: '0 20px', marginBottom: 30 }}>
            <button onClick={skipPrev} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 28, padding: 10, cursor: 'pointer', transition: 'transform 0.2s' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
              <i className="fas fa-step-backward" />
            </button>
            
            <button onClick={togglePlay} style={{ background: 'var(--accent-gradient)', border: 'none', color: '#fff', width: 72, height: 72, borderRadius: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, cursor: 'pointer', boxShadow: '0 8px 28px var(--accent-glow)', transition: 'transform 0.2s, box-shadow 0.2s' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
              <i className={state.isPlaying ? "fas fa-pause" : "fas fa-play"} style={{ marginLeft: state.isPlaying ? 0 : 4 }} />
            </button>

            <button onClick={() => skipNext()} style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 28, padding: 10, cursor: 'pointer', transition: 'transform 0.2s' }} onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.9)'} onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}>
              <i className="fas fa-step-forward" />
            </button>
          </div>

          {/* Up Next Scrolling Queue */}
          <div style={{ marginTop: 20, background: 'rgba(0,0,0,0.25)', padding: '20px', borderRadius: 24, flex: 1, minHeight: 200, border: '1px solid rgba(255,255,255,0.05)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: 16 }}>Up Next</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {queue.slice(queue.findIndex(s => s.id === currentSong.id) + 1).slice(0, 10).map((s, i) => (
                <div key={`${s.id}-${i}`} className="pressable" onClick={() => playSong(s)} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src={s.artwork} style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{s.title}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{s.artist}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
