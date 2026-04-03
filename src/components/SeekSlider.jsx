import React from 'react';
import { formatMillis } from '../constants/songs';

export default function SeekSlider({ position, duration, onSeek }) {
  const progress = duration > 0 ? position / duration : 0;

  return (
    <div style={{ width: '100%' }}>
      <div style={{ position: 'relative', marginBottom: 8 }}>
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={position}
          onChange={(e) => onSeek(Number(e.target.value))}
          style={{
            width: '100%',
            background: `linear-gradient(to right, #7C5CBF ${progress * 100}%, #252540 ${progress * 100}%)`
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: '#B3B3B3', fontSize: 12 }}>{formatMillis(position)}</span>
        <span style={{ color: '#6B6B8A', fontSize: 12 }}>{formatMillis(duration)}</span>
      </div>
    </div>
  );
}
