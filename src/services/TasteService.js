// ─── Taste Profile Service ──────────────────────────────────────────────────
// Persists user music taste to localStorage and generates smart AI queries.

import { loadGeminiKey } from './StorageService';
import { JioSaavnAPI } from './JioSaavnAPI';

const TASTE_KEY = 'echotune_taste_profile';

// ─── Persistence ────────────────────────────────────────────────────────────

export const saveTasteProfile = (profile) => {
  try {
    localStorage.setItem(TASTE_KEY, JSON.stringify({
      ...profile,
      completedAt: Date.now(),
    }));
  } catch {}
};

export const loadTasteProfile = () => {
  try {
    const raw = localStorage.getItem(TASTE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const clearTasteProfile = () => {
  try { localStorage.removeItem(TASTE_KEY); } catch {}
};

// ─── Query Builder ──────────────────────────────────────────────────────────

export const generateTasteQuery = (profile) => {
  if (!profile) return 'Top 2024 hits';

  const parts = [];

  if (profile.artists?.length > 0) {
    parts.push(profile.artists.slice(0, 3).join(' '));
  }
  if (profile.genres?.length > 0) {
    parts.push(profile.genres.slice(0, 2).join(' '));
  }
  if (profile.moods?.length > 0) {
    parts.push(profile.moods[0] + ' songs');
  }
  if (profile.decades?.length > 0) {
    parts.push(profile.decades[0] + ' hits');
  }
  if (profile.languages?.length > 0 && !profile.languages.includes('English')) {
    parts.push(profile.languages[0] + ' songs');
  }

  return parts.length > 0 ? parts.join(' ') : 'Top 2024 trending';
};

// ─── Gemini AI-Powered Personalized Playlist ────────────────────────────────

export const getPersonalizedPlaylist = async (profile) => {
  try {
    const key = loadGeminiKey();
    
    if (key) {
      // AI-powered route
      const songs = await fetchGeminiPersonalized(profile, key);
      if (songs.length > 0) return songs;
    }

    // Fallback: use taste-query search on JioSaavn
    const query = generateTasteQuery(profile);
    return await JioSaavnAPI.searchSongs(query);

  } catch (error) {
    console.error('Personalized playlist error:', error);
    // Final fallback
    const query = generateTasteQuery(profile);
    return await JioSaavnAPI.searchSongs(query);
  }
};

async function fetchGeminiPersonalized(profile, apiKey) {
  const systemPrompt = `You are an expert Music Curator AI.
Based on the user's detailed taste profile, recommend EXACTLY 15 songs that perfectly match their preferences.
Consider their favorite artists, genres, instruments, mood preferences, favorite decades, preferred languages, and listening occasions.
Return a raw JSON array of strings in the format: ["Song Name - Artist Name", ...]
Be highly specific and accurate. Match the vibe perfectly.`;

  const userPrompt = `My Music Taste Profile:
- Favorite Artists: ${profile.artists?.join(', ') || 'Not specified'}
- Favorite Genres: ${profile.genres?.join(', ') || 'Not specified'}
- Favorite Instruments: ${profile.instruments?.join(', ') || 'Not specified'}
- Mood Preferences: ${profile.moods?.join(', ') || 'Not specified'}
- Favorite Decades: ${profile.decades?.join(', ') || 'Not specified'}
- Preferred Languages: ${profile.languages?.join(', ') || 'Not specified'}
- Listening Occasions: ${profile.occasions?.join(', ') || 'Not specified'}

Generate songs that match ALL of these preferences!`;

  const payload = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.8,
    },
  };

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) return [];

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) return [];

  const queries = JSON.parse(rawText);
  if (!Array.isArray(queries)) return [];

  // Map Gemini text → JioSaavn streams (parallel)
  const fetchPromises = queries.slice(0, 12).map(async (q) => {
    try {
      const results = await JioSaavnAPI.searchSongs(q);
      return results.length > 0 ? results[0] : null;
    } catch { return null; }
  });

  const songs = await Promise.all(fetchPromises);
  return songs.filter(Boolean);
}
