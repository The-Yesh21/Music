import React, { useState } from 'react';
import { formatDuration } from '../constants/songs';
import { useMusic } from '../context/MusicContext';

export default function SongCard({ song, onPress, index, variant = "row" }) {
  const { state, toggleFavorite } = useMusic();
  const isPlaying = state.currentSong?.id === song.id && state.isPlaying;
  const isFav = state.favorites instanceof Set ? state.favorites.has(song.id) : Array.isArray(state.favorites) ? state.favorites.includes(song.id) : false;
  const [favAnim, setFavAnim] = useState(false);

  const handleFav = (e) => {
    e.stopPropagation();
    setFavAnim(true);
    toggleFavorite(song.id);
    setTimeout(() => setFavAnim(false), 350);
  };

  if (variant === 'grid') {
    return (
      <div className={`song-card-grid ${isPlaying ? 'playing' : ''}`} onClick={onPress}>
        <div className="song-card-grid-artwork-wrapper">
          <img
            src={song.artwork}
            alt={song.title}
            className="song-card-grid-art"
            onError={(e) => { e.target.src = 'https://picsum.photos/seed/default/400/400'; }}
          />
          <div className="song-card-grid-overlay">
            <button className="song-card-grid-play-btn" aria-label={isPlaying ? "Pause" : "Play"}>
              <i className={isPlaying ? "fas fa-pause" : "fas fa-play"} />
            </button>
          </div>
        </div>
        <div className="song-card-grid-info">
          <span className="song-card-grid-title">{song.title}</span>
          <span className="song-card-grid-artist">{song.artist}</span>
        </div>
      </div>
    );
  }

  // Default: variant="row"
  return (
    <div className={`song-card-row ${isPlaying ? 'playing' : ''}`} onClick={onPress}>
      {index !== undefined && (
        <span className="song-card-row-index">{index}</span>
      )}
      <img
        src={song.artwork}
        alt={song.title}
        className="song-card-row-art"
        onError={(e) => { e.target.src = 'https://picsum.photos/seed/default/400/400'; }}
      />
      <div className="song-card-row-info">
        <span className="song-card-row-title">{song.title}</span>
        <span className="song-card-row-artist">{song.artist}</span>
      </div>
      <div className="song-card-row-actions">
        <button
          className={`song-card-row-fav-btn ${favAnim ? 'heart-pop' : ''}`}
          onClick={handleFav}
          aria-label="Favorite"
        >
          <i className={isFav ? "fas fa-heart liked" : "far fa-heart"} />
        </button>
        <span className="song-card-row-duration">
          {formatDuration(song.duration)}
        </span>
      </div>
    </div>
  );
}
