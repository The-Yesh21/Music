import { useEffect, useRef } from 'react';

export function useMediaSession({
  currentSong,
  isPlaying,
  activeCategory,
  currentTime,
  duration,
  onPlay,
  onPause,
  onNext,
  onPrev,
}) {
  const handlersRef = useRef({ onPlay, onPause, onNext, onPrev });
  handlersRef.current = { onPlay, onPause, onNext, onPrev };

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => handlersRef.current.onPlay());
    navigator.mediaSession.setActionHandler('pause', () => handlersRef.current.onPause());
    navigator.mediaSession.setActionHandler('previoustrack', () => handlersRef.current.onPrev());
    navigator.mediaSession.setActionHandler('nexttrack', () => handlersRef.current.onNext());

    return () => {
      ['play', 'pause', 'previoustrack', 'nexttrack'].forEach((action) => {
        navigator.mediaSession.setActionHandler(action, null);
      });
    };
  }, []);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    if (currentSong) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentSong.Title,
        artist: currentSong.Artist || 'Unknown artist',
        album: activeCategory,
        artwork: currentSong.image
          ? [
              { src: currentSong.image, sizes: '96x96', type: 'image/jpeg' },
              { src: currentSong.image, sizes: '256x256', type: 'image/jpeg' },
              { src: currentSong.image, sizes: '512x512', type: 'image/jpeg' },
            ]
          : [
              { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
              { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
            ],
      });
    }

    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [currentSong, isPlaying, activeCategory]);

  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentSong || !duration) return;

    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: 1,
        position: Math.min(currentTime, duration),
      });
    } catch {
      // Some browsers reject invalid position state during track load.
    }
  }, [currentSong, currentTime, duration]);
}
