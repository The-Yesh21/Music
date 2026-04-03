import React, { useState } from 'react';
import { formatDuration } from '../constants/songs';
import { useMusic } from '../context/MusicContext';

export default function SongCard({ song, onPress, showArtist = true }) {
  const { state, toggleFavorite } = useMusic();
  const isPlaying = state.currentSong?.id === song.id && state.isPlaying;
  const isFav = state.favorites.has(song.id);
  const playCount = state.stats[song.id]?.playCount || 0;
  const [favAnim, setFavAnim] = useState(false);

  const handleFav = (e) => {
    e.stopPropagation();
    setFavAnim(true);
    toggleFavorite(song.id);
    setTimeout(() => setFavAnim(false), 350);
  };

  return (
    <div className="pressable" onClick={onPress} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px',
      borderRadius: 14,
      background: isPlaying
        ? 'linear-gradient(135deg, rgba(199,125,255,0.15), rgba(255,107,53,0.08))'
        : 'rgba(20,20,40,0.6)',
      border: `1px solid ${isPlaying ? 'rgba(199,125,255,0.35)' : 'rgba(255,255,255,0.06)'}`,
      cursor: 'pointer', marginBottom: 8,
      transition: 'background 0.3s, border-color 0.3s',
      backdropFilter: 'blur(10px)',
    }}>
      {/* Artwork */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <img src={song.artwork} alt={song.title} style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover' }}
          onError={(e) => { e.target.src = 'https://picsum.photos/seed/default/400/400'; }} />
        {isPlaying && (
          <div style={{
            position: 'absolute', inset: 0, borderRadius: 10,
            background: 'rgba(199,125,255,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className="fas fa-music" style={{ color: '#fff', fontSize: 16 }} />
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 700, fontSize: 14,
          color: isPlaying ? 'var(--accent-secondary)' : '#fff',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{song.title}</div>
        {showArtist && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {song.artist}
            {playCount > 0 && <span style={{ color: '#56567A', marginLeft: 6 }}>· {playCount} plays</span>}
          </div>
        )}
      </div>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          className={favAnim ? 'heart-pop' : ''}
          onClick={handleFav}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <i className={`${isFav ? 'fas' : 'far'} fa-heart`} style={{ fontSize: 16, color: isFav ? 'var(--like)' : '#56567A' }} />
        </button>
        <span style={{ color: '#56567A', fontSize: 12 }}>{formatDuration(song.duration)}</span>
      </div>
    </div>
  );
}
