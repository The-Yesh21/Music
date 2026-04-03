import React from 'react';

const btn = {
  background: 'none', border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'transform 0.1s, opacity 0.1s',
  color: '#fff',
};

export default function ControlButtons({ isPlaying, onPlay, onPrev, onNext, size = 'large' }) {
  const isLarge = size === 'large';

  const handleActive = (e) => { e.currentTarget.style.transform = 'scale(0.88)'; e.currentTarget.style.opacity = '0.7'; };
  const handleRelease = (e) => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.opacity = '1'; };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: isLarge ? 32 : 16 }}>
      {/* Previous */}
      <button style={{ ...btn, width: isLarge ? 48 : 36, height: isLarge ? 48 : 36 }}
        onClick={onPrev} onMouseDown={handleActive} onMouseUp={handleRelease} onTouchStart={handleActive} onTouchEnd={handleRelease}>
        <i className="fas fa-backward-step" style={{ fontSize: isLarge ? 26 : 18, color: 'var(--text-secondary)' }} />
      </button>

      {/* Play / Pause */}
      <button style={{
        ...btn,
        width: isLarge ? 72 : 44, height: isLarge ? 72 : 44,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #FF6B35, #C77DFF)',
        boxShadow: '0 0 30px var(--accent-glow)',
      }} onClick={onPlay} onMouseDown={handleActive} onMouseUp={handleRelease} onTouchStart={handleActive} onTouchEnd={handleRelease}>
        <i className={`fas ${isPlaying ? 'fa-pause' : 'fa-play'}`}
          style={{ fontSize: isLarge ? 26 : 16, color: '#fff', marginLeft: isPlaying ? 0 : (isLarge ? 3 : 2) }} />
      </button>

      {/* Next */}
      <button style={{ ...btn, width: isLarge ? 48 : 36, height: isLarge ? 48 : 36 }}
        onClick={onNext} onMouseDown={handleActive} onMouseUp={handleRelease} onTouchStart={handleActive} onTouchEnd={handleRelease}>
        <i className="fas fa-forward-step" style={{ fontSize: isLarge ? 26 : 18, color: 'var(--text-secondary)' }} />
      </button>
    </div>
  );
}
