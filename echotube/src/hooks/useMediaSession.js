import { useEffect, useRef, useCallback } from 'react';

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
  onSeek,
}) {
  const handlersRef = useRef({ onPlay, onPause, onNext, onPrev, onSeek });
  handlersRef.current = { onPlay, onPause, onNext, onPrev, onSeek };
  // Latest position so the (mount-once) seek handlers can read current time.
  const positionRef = useRef({ currentTime, duration });
  positionRef.current = { currentTime, duration };
  const wakeLockRef = useRef(null);

  const requestWakeLock = useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        wakeLockRef.current.addEventListener('release', () => {
          wakeLockRef.current = null;
        });
      } catch (err) {
        console.warn('Wake Lock failed:', err.name, err.message);
      }
    }
  }, []);

  const releaseWakeLock = useCallback(() => {
    if (wakeLockRef.current) {
      wakeLockRef.current.release();
      wakeLockRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;

    // setActionHandler throws for actions a browser doesn't support, so guard each.
    const setHandler = (action, handler) => {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch {
        // Action unsupported in this browser; ignore.
      }
    };

    setHandler('play', () => handlersRef.current.onPlay());
    setHandler('pause', () => handlersRef.current.onPause());
    setHandler('previoustrack', () => handlersRef.current.onPrev());
    setHandler('nexttrack', () => handlersRef.current.onNext());
    setHandler('seekto', (details) => {
      if (details && details.seekTime != null && handlersRef.current.onSeek) {
        handlersRef.current.onSeek(details.seekTime);
      }
    });
    setHandler('seekforward', (details) => {
      if (!handlersRef.current.onSeek) return;
      const { currentTime: pos, duration: dur } = positionRef.current;
      const offset = (details && details.seekOffset) || 10;
      const target = (pos || 0) + offset;
      handlersRef.current.onSeek(dur ? Math.min(target, dur) : target);
    });
    setHandler('seekbackward', (details) => {
      if (!handlersRef.current.onSeek) return;
      const { currentTime: pos } = positionRef.current;
      const offset = (details && details.seekOffset) || 10;
      handlersRef.current.onSeek(Math.max((pos || 0) - offset, 0));
    });

    return () => {
      ['play', 'pause', 'previoustrack', 'nexttrack', 'seekto', 'seekforward', 'seekbackward'].forEach((action) => {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {
          // ignore
        }
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

    if (isPlaying) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
  }, [currentSong, isPlaying, activeCategory, requestWakeLock, releaseWakeLock]);

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

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && wakeLockRef.current === null && isPlaying) {
        requestWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPlaying, requestWakeLock]);

  return { requestWakeLock, releaseWakeLock };
}
