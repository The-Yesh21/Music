import React from 'react';

export default function AlbumArt({ artwork, isPlaying, size = 220, style = {} }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
      boxShadow: '0 0 40px rgba(124,92,191,0.4), 0 8px 32px rgba(0,0,0,0.6)',
      border: '3px solid rgba(124,92,191,0.3)',
      ...style,
    }}>
      <img
        src={artwork || 'https://picsum.photos/seed/default/400/400'}
        alt="Album Art"
        className={isPlaying ? 'album-spinning' : 'album-paused'}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={(e) => { e.target.src = 'https://picsum.photos/seed/default/400/400'; }}
      />
    </div>
  );
}
