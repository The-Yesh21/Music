// localStorage-based persistence — web equivalent of AsyncStorage

const KEYS = {
  STATS: 'echotune_stats',
  FAVORITES: 'echotune_favorites',
  DISLIKES: 'echotune_dislikes',
  HISTORY: 'echotune_history',
  GEMINI_KEY: 'echotune_gemini_config'
};

const get = (key) => {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
};
const set = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
};

// ─── Stats & Global Tracking ───────────────────────────────────────────────────
export const loadStats = () => get(KEYS.STATS) || { totalTime: 0, tracks: {} };
export const saveStats = (stats) => set(KEYS.STATS, stats);

export const incrementPlayCount = (songId, currentStats) => {
  const stats = { ...currentStats, tracks: { ...currentStats.tracks } };
  if (!stats.tracks[songId]) stats.tracks[songId] = { playCount: 0, skipCount: 0, lastPlayed: null };
  stats.tracks[songId].playCount += 1;
  stats.tracks[songId].lastPlayed = Date.now();
  saveStats(stats);
  return stats;
};

export const incrementSkipCount = (songId, currentStats) => {
  const stats = { ...currentStats, tracks: { ...currentStats.tracks } };
  if (!stats.tracks[songId]) stats.tracks[songId] = { playCount: 0, skipCount: 0, lastPlayed: null };
  stats.tracks[songId].skipCount += 1;
  saveStats(stats);
  return stats;
};

export const addListeningTime = (seconds, currentStats) => {
  const stats = { ...currentStats };
  stats.totalTime = (stats.totalTime || 0) + seconds;
  saveStats(stats);
  return stats;
};

// ─── Favorites & Dislikes ──────────────────────────────────────────────────────
export const loadFavorites = () => new Set(get(KEYS.FAVORITES) || []);
export const saveFavorites = (favSet) => set(KEYS.FAVORITES, [...favSet]);

export const loadDislikes = () => new Set(get(KEYS.DISLIKES) || []);
export const saveDislikes = (dislikeSet) => set(KEYS.DISLIKES, [...dislikeSet]);

// ─── History ──────────────────────────────────────────────────────────────────
export const loadHistory = () => get(KEYS.HISTORY) || [];
export const saveHistory = (history) => set(KEYS.HISTORY, history);

export const addToHistory = (song, currentHistory) => {
  const filtered = currentHistory.filter((s) => s.id !== song.id);
  const updated = [{ ...song, playedAt: Date.now() }, ...filtered].slice(0, 30);
  saveHistory(updated);
  return updated;
};

// ─── Gemini AI Config ──────────────────────────────────────────────────────
export const loadGeminiKey = () => get(KEYS.GEMINI_KEY) || '';
export const saveGeminiKey = (key) => set(KEYS.GEMINI_KEY, key);
