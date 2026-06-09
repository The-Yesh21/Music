import { create } from 'zustand';

export const usePlayerStore = create((set, get) => ({
  queue: [],
  currentIndex: 0,
  currentSong: null,
  isPlaying: false,
  shuffle: false,
  repeat: 'none',   // 'none' | 'one' | 'all'
  toggleShuffle: () => set(s => ({ shuffle: !s.shuffle })),
  setRepeat: () => set(s => ({
    repeat: s.repeat === 'none' ? 'all' : s.repeat === 'all' ? 'one' : 'none'
  })),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentSong: (song) => set({ currentSong: song }),
  setQueue: (queue) => set({ queue }),
  setCurrentIndex: (index) => set({ currentIndex: index }),
  playNext: () => {
    const { queue, currentIndex, shuffle, repeat } = get();
    if (!queue.length) return;
    let next;
    if (shuffle) {
      do { next = Math.floor(Math.random() * queue.length); }
      while (next === currentIndex && queue.length > 1);
    } else {
      next = currentIndex + 1;
      if (next >= queue.length) next = repeat === 'all' ? 0 : -1;
    }
    if (next === -1) { set({ isPlaying: false }); return; }
    set({ currentIndex: next, currentSong: queue[next], isPlaying: true });
  },
  playPrev: () => {
    const { queue, currentIndex, shuffle } = get();
    if (!queue.length) return;
    let prev;
    if (shuffle) {
      do { prev = Math.floor(Math.random() * queue.length); }
      while (prev === currentIndex && queue.length > 1);
    } else {
      prev = currentIndex - 1;
      if (prev < 0) prev = queue.length - 1;
    }
    set({ currentIndex: prev, currentSong: queue[prev], isPlaying: true });
  },
}));
