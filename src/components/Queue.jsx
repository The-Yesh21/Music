import React, { useState } from 'react';
import { useMusic } from '../context/MusicContext';
import { formatDuration } from '../constants/songs';

export default function Queue({ onClose }) {
  const { state, setQueue, clearQueue, playSong } = useMusic();
  const { queue, currentSong } = state;
  const [draggedIndex, setDraggedIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newQueue = [...queue];
    const [draggedItem] = newQueue.splice(draggedIndex, 1);
    newQueue.splice(targetIndex, 0, draggedItem);
    
    setQueue(newQueue);
    setDraggedIndex(null);
  };

  return (
    <div className={`queue-panel ${onClose ? 'mobile-sheet' : ''}`}>
      <div className="queue-header">
        <h3>Up Next</h3>
        <div className="queue-header-actions">
          <button className="queue-clear-btn" onClick={clearQueue}>
            Clear
          </button>
          {onClose && (
            <button className="queue-close-btn mobile-only-close" onClick={onClose} aria-label="Close Queue">
              <i className="fas fa-times" />
            </button>
          )}
        </div>
      </div>

      <div className="queue-list">
        {queue.length === 0 ? (
          <div className="queue-empty">Queue is empty</div>
        ) : (
          queue.map((song, index) => {
            const isCurrent = currentSong && song.id === currentSong.id;
            return (
              <div
                key={`${song.id}-${index}`}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                onClick={() => playSong(song)}
                className={`queue-item ${isCurrent ? 'active' : ''}`}
              >
                <div className="queue-item-drag-handle" onClick={(e) => e.stopPropagation()}>
                  <i className="fas fa-grip-vertical" />
                </div>
                <img
                  src={song.artwork}
                  alt={song.title}
                  className="queue-item-art"
                  onError={(e) => { e.target.src = 'https://picsum.photos/seed/default/400/400'; }}
                />
                <div className="queue-item-details">
                  <span className="queue-item-title">{song.title}</span>
                  <span className="queue-item-artist">{song.artist}</span>
                </div>
                <span className="queue-item-duration">
                  {formatDuration(song.duration)}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
