// ─── Playlist Radio Engine ──────────────────────────────────────────────────
// Builds a minimum 20-song playlist matching the seed song's genre/vibe
// by combining multiple recommendation sources in parallel.

import { JioSaavnAPI } from './JioSaavnAPI';
import { getSimilarTracksFromLastFm } from './LastFmService';
import { getDeepSeekRecommendations } from './DeepSeekBridge';
import { getGeminiRecommendations } from './GeminiBridge';
import { getSpotifyRecommendations } from './SpotifyBridge';
import { getHuggingFaceRecommendations } from './HuggingFaceBridge';
import { loadGroqKey } from './StorageService';
import { processAIQuery } from './AIChatService';
import { getPythonServerUrl } from './MLTreeEngine';

const MIN_QUEUE_SIZE = 20;

// Genre-to-search-keyword mapping for JioSaavn fallback
const GENRE_QUERIES = {
  'Pop': ['Pop hits', 'Top pop songs', 'Pop music'],
  'Rock': ['Rock anthems', 'Rock hits', 'Alternative rock'],
  'Hip-Hop': ['Hip hop hits', 'Rap songs', 'Hip hop music'],
  'R&B': ['R&B hits', 'Rhythm and blues', 'R&B songs'],
  'Classical': ['Classical music', 'Indian classical', 'Carnatic music'],
  'Jazz': ['Jazz music', 'Jazz classics', 'Smooth jazz'],
  'EDM': ['EDM hits', 'Electronic dance music', 'EDM bangers'],
  'Indie': ['Indie music', 'Indie pop', 'Indie rock'],
  'Bollywood': ['Bollywood hits', 'Bollywood songs', 'Hindi film songs'],
  'K-Pop': ['K-Pop hits', 'Korean pop', 'K-Pop songs'],
  'Metal': ['Metal songs', 'Heavy metal', 'Metalcore'],
  'Country': ['Country music', 'Country hits', 'Country songs'],
  'Lo-Fi': ['Lo-fi beats', 'Lo-fi study', 'Chill lo-fi'],
  'Latin': ['Latin hits', 'Reggaeton', 'Latin pop'],
  'Punjabi': ['Punjabi hits', 'Punjabi songs', 'Punjabi music'],
  'Sufi': ['Sufi music', 'Sufi songs', 'Qawwali'],
  'Carnatic': ['Carnatic music', 'Carnatic vocal', 'Carnatic songs'],
  'Reggaeton': ['Reggaeton hits', 'Reggaeton songs', 'Latin reggaeton'],
  'Synthwave': ['Synthwave', 'Retrowave', 'Synthwave hits'],
  'Ambient': ['Ambient music', 'Ambient chill', 'Atmospheric music'],
  'Electronic': ['Electronic music', 'Electronic hits', 'Electro songs'],
  'Chill': ['Chill music', 'Chill vibes', 'Chill songs'],
  'Global': ['Top hits', 'Trending songs', 'Popular music'],
};

// Detect genre from song metadata
const detectGenre = (song) => {
  if (song.genre && song.genre !== 'Global') return song.genre;
  if (song.language && song.language !== 'English') {
    const langMap = { 'Hindi': 'Bollywood', 'Korean': 'K-Pop', 'Spanish': 'Latin', 'Punjabi': 'Punjabi', 'Tamil': 'Bollywood', 'Telugu': 'Bollywood' };
    return langMap[song.language] || null;
  }
  return null;
};

// Helper to construct a normalized lookup key for deduplication
const getSongKey = (song) => {
  if (!song) return '';
  const title = (song.title || song.Title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const artist = (song.artist || song.Artist || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${title}_${artist}`;
};

// Resolve text queries ("Song - Artist") into JioSaavn song objects in parallel
const resolveQueriesToSongs = async (queries, maxPerQuery = 1) => {
  const fetchPromises = queries.slice(0, 25).map(async (query) => {
    try {
      const results = await JioSaavnAPI.searchSongs(query);
      return results.length > 0 ? results.slice(0, maxPerQuery) : [];
    } catch { return []; }
  });
  const batches = await Promise.all(fetchPromises);
  return batches.flat();
};

// Deduplicate songs by id and normalized key, excluding already-queued and disliked songs
const deduplicate = (songs, existingIds, existingKeys, dislikedIds) => {
  return songs.filter(s => {
    if (!s) return false;
    if (existingIds.has(s.id) || dislikedIds.has(s.id)) return false;
    const key = getSongKey(s);
    if (existingKeys.has(key)) return false;
    
    existingIds.add(s.id);
    existingKeys.add(key);
    return true;
  });
};

// ─── Main Radio Builder ──────────────────────────────────────────────────────

export const buildRadioPlaylist = async (seedSong, { existingQueue = [], dislikedIds = new Set(), favorites = new Set(), history = [] } = {}) => {
  const results = [];
  const existingIds = new Set(existingQueue.map(s => s.id));
  const existingKeys = new Set(existingQueue.map(s => getSongKey(s)));

  // Exclude the seed song itself from recommendations
  existingIds.add(seedSong.id);
  existingKeys.add(getSongKey(seedSong));

  // Strategy 0: Local Python ML Recommendation Server (Content-Based Filtering on Top100 xlsx/csv)
  try {
    const pyUrl = getPythonServerUrl();
    
    // Map favorite IDs to title-artist pairs using the queue and history to find details
    const favsPayload = Array.from(favorites).map(id => {
      const match = [...existingQueue, ...history].find(s => s.id === id);
      return match ? { title: match.title, artist: match.artist } : null;
    }).filter(Boolean);

    const histPayload = history.map(h => ({ title: h.title, artist: h.artist }));

    const pyResponse = await fetch(`${pyUrl}/api/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seed_title: seedSong.title || '',
        seed_artist: seedSong.artist || '',
        favorites: favsPayload,
        dislikes: [], 
        history: histPayload,
        limit: 15
      }),
      signal: AbortSignal.timeout(1500) // fast timeout
    });

    if (pyResponse.ok) {
      const pyRecs = await pyResponse.json();
      if (Array.isArray(pyRecs) && pyRecs.length > 0) {
        console.log(`Radio: Fetched ${pyRecs.length} high-fidelity recommendations from local Python ML backend.`);
        
        // Map Python recommended songs to playable JioSaavn search items in parallel (fast)
        const pyQueries = pyRecs.map(r => `${r.title} ${r.artist}`);
        const pyResolvedSongs = await resolveQueriesToSongs(pyQueries, 1);
        
        const freshPySongs = deduplicate(pyResolvedSongs, existingIds, existingKeys, dislikedIds);
        results.push(...freshPySongs);
      }
    }
  } catch (e) {
    console.warn('Radio: Python recommendation server offline, skipping Python ML channel.');
  }

  // Strategy 1: JioSaavn native suggestions (always available, fast)
  try {
    const suggestions = await JioSaavnAPI.getSuggestions(seedSong.id);
    const fresh = deduplicate(suggestions, existingIds, existingKeys, dislikedIds);
    results.push(...fresh);
  } catch (e) {
    console.warn('Radio: JioSaavn suggestions failed:', e);
  }

  // Strategy 2: Genre-based JioSaavn searches (parallel)
  const genre = detectGenre(seedSong);
  if (genre && GENRE_QUERIES[genre]) {
    const genreSearches = GENRE_QUERIES[genre].map(async (query) => {
      try {
        const songs = await JioSaavnAPI.searchSongs(query);
        return deduplicate(songs, existingIds, existingKeys, dislikedIds);
      } catch { return []; }
    });

    const genreBatches = await Promise.all(genreSearches);
    genreBatches.flat().forEach(s => {
      const key = getSongKey(s);
      if (!existingIds.has(s.id) && !existingKeys.has(key) && !dislikedIds.has(s.id)) {
        results.push(s);
        existingIds.add(s.id);
        existingKeys.add(key);
      }
    });
  }

  // Strategy 3: Last.fm similar tracks → JioSaavn mapping (parallel with AI)
  const lastFmPromise = (async () => {
    try {
      const queries = await getSimilarTracksFromLastFm(seedSong.title, seedSong.artist);
      if (queries.length > 0) {
        const songs = await resolveQueriesToSongs(queries, 1);
        return deduplicate(songs, existingIds, existingKeys, dislikedIds);
      }
    } catch (e) {
      console.warn('Radio: Last.fm failed:', e);
    }
    return [];
  })();

  // Strategy 4: AI-powered recommendations (parallel — try all available)
  const aiPromises = [
    // DeepSeek
    (async () => {
      try {
        const queries = await getDeepSeekRecommendations(seedSong.title, seedSong.artist);
        if (queries.length > 0) {
          const songs = await resolveQueriesToSongs(queries, 1);
          return deduplicate(songs, existingIds, existingKeys, dislikedIds);
        }
      } catch {}
      return [];
    })(),

    // Gemini
    (async () => {
      try {
        const queries = await getGeminiRecommendations(seedSong.title, seedSong.artist);
        if (queries.length > 0) {
          const songs = await resolveQueriesToSongs(queries, 1);
          return deduplicate(songs, existingIds, existingKeys, dislikedIds);
        }
      } catch {}
      return [];
    })(),

    // Spotify
    (async () => {
      try {
        const queries = await getSpotifyRecommendations(seedSong.title, seedSong.artist);
        if (queries.length > 0) {
          const songs = await resolveQueriesToSongs(queries, 1);
          return deduplicate(songs, existingIds, existingKeys, dislikedIds);
        }
      } catch {}
      return [];
    })(),

    // Groq AI (uses the AIChatService)
    (async () => {
      try {
        const key = loadGroqKey();
        if (!key) return [];
        const queries = await processAIQuery(`Recommend songs similar to "${seedSong.title}" by ${seedSong.artist}, same genre and vibe`);
        if (queries.length > 0) {
          const songs = await resolveQueriesToSongs(queries, 1);
          return deduplicate(songs, existingIds, existingKeys, dislikedIds);
        }
      } catch {}
      return [];
    })(),

    // Hugging Face (Gemma-2-2b open-source LLM)
    (async () => {
      try {
        const queries = await getHuggingFaceRecommendations(seedSong.title, seedSong.artist);
        if (queries.length > 0) {
          const songs = await resolveQueriesToSongs(queries, 1);
          return deduplicate(songs, existingIds, existingKeys, dislikedIds);
        }
      } catch {}
      return [];
    })(),
  ];

  // Wait for all parallel strategies
  const [lastFmSongs, ...aiBatches] = await Promise.all([lastFmPromise, ...aiPromises]);

  // Merge Last.fm results
  lastFmSongs.forEach(s => {
    const key = getSongKey(s);
    if (!existingIds.has(s.id) && !existingKeys.has(key) && !dislikedIds.has(s.id)) {
      results.push(s);
      existingIds.add(s.id);
      existingKeys.add(key);
    }
  });

  // Merge AI results
  aiBatches.flat().forEach(s => {
    const key = getSongKey(s);
    if (!existingIds.has(s.id) && !existingKeys.has(key) && !dislikedIds.has(s.id)) {
      results.push(s);
      existingIds.add(s.id);
      existingKeys.add(key);
    }
  });

  // Strategy 5: If still under MIN_QUEUE_SIZE, do broad genre/artist searches
  if (results.length < MIN_QUEUE_SIZE) {
    const fallbackQueries = [
      `${seedSong.artist} songs`,
      `${seedSong.artist} hits`,
      genre ? `${genre} top songs` : 'Top trending songs',
      genre ? `Best ${genre} tracks` : 'Popular music 2024',
      `${seedSong.title} similar`,
    ];

    const fallbackSearches = fallbackQueries.map(async (query) => {
      try {
        const songs = await JioSaavnAPI.searchSongs(query);
        return deduplicate(songs, existingIds, existingKeys, dislikedIds);
      } catch { return []; }
    });

    const fallbackBatches = await Promise.all(fallbackSearches);
    fallbackBatches.flat().forEach(s => {
      const key = getSongKey(s);
      if (!existingIds.has(s.id) && !existingKeys.has(key) && !dislikedIds.has(s.id)) {
        results.push(s);
        existingIds.add(s.id);
        existingKeys.add(key);
      }
    });
  }

  // Strategy 6: Final desperation — trending + random popular searches
  if (results.length < MIN_QUEUE_SIZE) {
    try {
      const trending = await JioSaavnAPI.getTrending();
      const fresh = deduplicate(trending, existingIds, existingKeys, dislikedIds);
      fresh.forEach(s => {
        if (results.length < MIN_QUEUE_SIZE) {
          results.push(s);
          existingIds.add(s.id);
          existingKeys.add(getSongKey(s));
        }
      });
    } catch {}
  }

  // Shuffle the results slightly for variety (keep first 3 as most relevant)
  const topPicks = results.slice(0, 3);
  const rest = results.slice(3);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }

  return [...topPicks, ...rest].slice(0, Math.max(MIN_QUEUE_SIZE, results.length));
};

// ─── Quick Queue Extension ──────────────────────────────────────────────────
// When the queue runs low during playback, extend it with more songs

export const extendRadioQueue = async (currentSong, { existingQueue = [], dislikedIds = new Set(), favorites = new Set(), history = [] } = {}) => {
  try {
    const newSongs = await buildRadioPlaylist(currentSong, { existingQueue, dislikedIds, favorites, history });
    return newSongs.slice(0, 10); // Add 10 more at a time
  } catch (e) {
    console.error('Radio extension failed:', e);
    return [];
  }
};
