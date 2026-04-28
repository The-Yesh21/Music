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

// API Keys
export const saveGroqKey = (key) => {
  if (key) localStorage.setItem('groq_key', key);
  else localStorage.removeItem('groq_key');
};
export const loadGroqKey = () => localStorage.getItem('groq_key');

export const saveLastFmKey = (key) => {
  if (key) localStorage.setItem('lastfm_key', key);
  else localStorage.removeItem('lastfm_key');
};
export const loadLastFmKey = () => localStorage.getItem('lastfm_key');

// DeepSeek API Key
export const saveDeepSeekKey = (key) => {
  if (key) localStorage.setItem('deepseek_key', key);
  else localStorage.removeItem('deepseek_key');
};
export const loadDeepSeekKey = () => localStorage.getItem('deepseek_key');

// Spotify API Keys (clientId and clientSecret)
export const saveSpotifyKeys = (clientId, clientSecret) => {
  if (clientId) localStorage.setItem('spotify_client_id', clientId);
  else localStorage.removeItem('spotify_client_id');
  if (clientSecret) localStorage.setItem('spotify_client_secret', clientSecret);
  else localStorage.removeItem('spotify_client_secret');
};
export const loadSpotifyKeys = () => ({
  clientId: localStorage.getItem('spotify_client_id') || '',
  clientSecret: localStorage.getItem('spotify_client_secret') || ''
});

// Hugging Face API Token
export const saveHuggingFaceKey = (key) => {
  if (key) localStorage.setItem('hf_token', key);
  else localStorage.removeItem('hf_token');
};
export const loadHuggingFaceKey = () => localStorage.getItem('hf_token');

// User Data
