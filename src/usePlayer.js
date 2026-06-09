import { useEffect, useRef } from 'react';
import { usePlayerStore } from './playerStore';
import { getSongDetails } from './services/JioSaavnAPI';
import { audioEngine } from './services/audioEngine';

export default function usePlayer(audioRef) {
  const { currentSong, playNext } = usePlayerStore();
  
  const playNextRef = useRef(null);
  useEffect(() => { playNextRef.current = playNext; });  // no deps — always fresh

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnded = () => {
      const { repeat } = usePlayerStore.getState();
      if (repeat === 'one') {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      } else {
        playNextRef.current?.();
      }
    };
    audio.addEventListener('ended', onEnded);
    return () => audio.removeEventListener('ended', onEnded);
  }, [audioRef]);

  useEffect(() => {
    if (!currentSong?.id) return;
    const load = async () => {
      const fresh = await getSongDetails(currentSong.id);
      const urls = fresh?.data?.[0]?.downloadUrl;
      const url = Array.isArray(urls) ? urls[4]?.url || urls.at(-1)?.url : null;
      if (!url) { setTimeout(() => playNextRef.current?.(), 1000); return; }
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      audio.src = url;
      audio.load();
      audio.addEventListener('canplay', () => {
        audioEngine.init(audio);
        audioEngine.resume();
        audio.play().then(() => {
          // STEP B — In usePlayer.js, after audio.play() succeeds, register Media Session:
          if ('mediaSession' in navigator) {
            navigator.mediaSession.metadata = new MediaMetadata({
              title: currentSong.name || currentSong.title || 'Unknown',
              artist: currentSong.artists?.primary?.[0]?.name || currentSong.artist || '',
              album: currentSong.album?.name || currentSong.album || '',
              artwork: [{ src: (currentSong.image && currentSong.image[2]?.url) || currentSong.artwork || '', sizes: '512x512', type: 'image/jpeg' }]
            });
            navigator.mediaSession.playbackState = 'playing';
            navigator.mediaSession.setActionHandler('play', () => {
              audioRef.current.play();
              usePlayerStore.getState().setIsPlaying(true);
            });
            navigator.mediaSession.setActionHandler('pause', () => {
              audioRef.current.pause();
              usePlayerStore.getState().setIsPlaying(false);
            });
            navigator.mediaSession.setActionHandler('nexttrack', () => playNextRef.current?.());
            navigator.mediaSession.setActionHandler('previoustrack', () => usePlayerStore.getState().playPrev());
          }
        }).catch(() => usePlayerStore.getState().setIsPlaying(false));
      }, { once: true });
      setTimeout(() => { if (audio.paused) audio.play().catch(() => {}); }, 5000);
    };
    load();
  }, [currentSong?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handlePlay = () => {
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    };
    const handlePause = () => {
      if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    };
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, [audioRef]);
}
