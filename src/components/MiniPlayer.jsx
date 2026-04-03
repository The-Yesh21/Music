import React from 'react';
import { useMusic } from '../context/MusicContext';
import ControlButtons from './ControlButtons';

export default function MiniPlayer({ onPress }) {
  const { state, togglePlay, skipNext, skipPrev } = useMusic();
  const { currentSong, isPlaying, isBuffering, playbackError, positionMillis, durationMillis } = state;

  if (!currentSong) return null;

  const progress = durationMillis > 0 ? (positionMillis / durationMillis) * 100 : 0;

  return (
    <div>
      <div className="mini-player-progress">
        <div className="mini-player-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="mini-player" onClick={onPress} style={{ cursor: 'pointer', position: 'relative' }}>
        <div style={{ position: 'relative' }}>
          <img
            src={currentSong.artwork}
            alt={currentSong.title}
            style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', flexShrink: 0, opacity: isBuffering ? 0.5 : 1 }}
            onError={(e) => { e.target.src = 'https://picsum.photos/seed/default/400/400'; }}
          />
          {isBuffering && <i className="fas fa-circle-notch fa-spin" style={{ position: 'absolute', top: 14, left: 14, color: 'var(--accent)' }} />}
          {playbackError && <i className="fas fa-exclamation-circle" style={{ position: 'absolute', top: 14, left: 14, color: 'var(--danger)' }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="marquee-wrap">
            <span className="marquee-inner" style={{ fontWeight: 700, fontSize: 13 }}>
              {currentSong.title}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{currentSong.title}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{currentSong.artist}</div>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <ControlButtons isPlaying={isPlaying} onPlay={togglePlay} onPrev={skipPrev} onNext={skipNext} size="small" />
        </div>
      </div>
    </div>
  );
}
