// Identical algorithm to the React Native version
import { SONGS } from '../constants/songs';

export const getRecommendations = ({ stats = { totalTime: 0, tracks: {} }, favorites = new Set(), currentSongId = null, limit = 5, penalizedMoods = new Set() }) => {
  const now = Date.now();
  const hour = new Date().getHours();
  
  let currentMood = 'energetic';
  if (hour >= 5 && hour < 12) currentMood = 'calm';
  else if (hour >= 18 || hour < 5) currentMood = 'chill';

  const scored = SONGS.map((song) => {
    const s = stats.tracks ? (stats.tracks[song.id] || { playCount: 0, skipCount: 0, lastPlayed: null }) : (stats[song.id] || { playCount: 0, skipCount: 0, lastPlayed: null });

    let recentBonus = 0;
    if (s.lastPlayed && (now - s.lastPlayed) <= 24 * 60 * 60 * 1000) {
      recentBonus = 5;
    }

    let moodBonus = 0;
    if (song.mood === currentMood) moodBonus = 10;

    let skipPenalty = s.skipCount * 1.5;
    if (penalizedMoods.has(song.mood)) skipPenalty += 20;

    const score = (s.playCount * 2) - skipPenalty + recentBonus + moodBonus + (favorites.has(song.id) ? 5 : 0);
    return { song, score };
  });
  return scored
    .filter(({ song }) => song.id !== currentSongId)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ song }) => song);
};

export const getRecentlyPlayed = (history = [], limit = 6) => {
  const seen = new Set();
  return history.filter((s) => { if (seen.has(s.id)) return false; seen.add(s.id); return true; }).slice(0, limit);
};

export const getMostPlayed = (stats = {}, limit = 5) =>
  SONGS.filter((s) => (stats[s.id]?.playCount || 0) > 0)
    .sort((a, b) => (stats[b.id]?.playCount || 0) - (stats[a.id]?.playCount || 0))
    .slice(0, limit);
