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

// Deduplicate songs by id, excluding already-queued and disliked songs
const deduplicate = (songs, existingIds, dislikedIds) => {
  const seen = new Set(existingIds);
  return songs.filter(s => {
    if (seen.has(s.id) || dislikedIds.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
};

// ─── Main Radio Builder ──────────────────────────────────────────────────────

export const buildRadioPlaylist = async (seedSong, { existingQueueIds = new Set(), dislikedIds = new Set() } = {}) => {
  const results = [];
  const existingIds = new Set(existingQueueIds);

  // Strategy 1: JioSaavn native suggestions (always available, fast)
  try {
    const suggestions = await JioSaavnAPI.getSuggestions(seedSong.id);
    const fresh = deduplicate(suggestions, existingIds, dislikedIds);
    results.push(...fresh);
    fresh.forEach(s => existingIds.add(s.id));
  } catch (e) {
    console.warn('Radio: JioSaavn suggestions failed:', e);
  }

  // Strategy 2: Genre-based JioSaavn searches (parallel)
  const genre = detectGenre(seedSong);
  if (genre && GENRE_QUERIES[genre]) {
    const genreSearches = GENRE_QUERIES[genre].map(async (query) => {
      try {
        const songs = await JioSaavnAPI.searchSongs(query);
        return deduplicate(songs, existingIds, dislikedIds);
      } catch { return []; }
    });

    const genreBatches = await Promise.all(genreSearches);
    genreBatches.flat().forEach(s => {
      if (!existingIds.has(s.id) && !dislikedIds.has(s.id)) {
        results.push(s);
        existingIds.add(s.id);
      }
    });
  }

  // Strategy 3: Last.fm similar tracks → JioSaavn mapping (parallel with AI)
  const lastFmPromise = (async () => {
    try {
      const queries = await getSimilarTracksFromLastFm(seedSong.title, seedSong.artist);
      if (queries.length > 0) {
        const songs = await resolveQueriesToSongs(queries, 1);
        return deduplicate(songs, existingIds, dislikedIds);
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
          return deduplicate(songs, existingIds, dislikedIds);
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
          return deduplicate(songs, existingIds, dislikedIds);
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
          return deduplicate(songs, existingIds, dislikedIds);
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
          return deduplicate(songs, existingIds, dislikedIds);
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
          return deduplicate(songs, existingIds, dislikedIds);
        }
      } catch {}
      return [];
    })(),
  ];

  // Wait for all parallel strategies
  const [lastFmSongs, ...aiBatches] = await Promise.all([lastFmPromise, ...aiPromises]);

  // Merge Last.fm results
  lastFmSongs.forEach(s => {
    if (!existingIds.has(s.id) && !dislikedIds.has(s.id)) {
      results.push(s);
      existingIds.add(s.id);
    }
  });

  // Merge AI results
  aiBatches.flat().forEach(s => {
    if (!existingIds.has(s.id) && !dislikedIds.has(s.id)) {
      results.push(s);
      existingIds.add(s.id);
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
        return deduplicate(songs, existingIds, dislikedIds);
      } catch { return []; }
    });

    const fallbackBatches = await Promise.all(fallbackSearches);
    fallbackBatches.flat().forEach(s => {
      if (!existingIds.has(s.id) && !dislikedIds.has(s.id)) {
        results.push(s);
        existingIds.add(s.id);
      }
    });
  }

  // Strategy 6: Final desperation — trending + random popular searches
  if (results.length < MIN_QUEUE_SIZE) {
    try {
      const trending = await JioSaavnAPI.getTrending();
      const fresh = deduplicate(trending, existingIds, dislikedIds);
      fresh.forEach(s => {
        if (results.length < MIN_QUEUE_SIZE) {
          results.push(s);
          existingIds.add(s.id);
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

export const extendRadioQueue = async (currentSong, { existingQueueIds = new Set(), dislikedIds = new Set() } = {}) => {
  try {
    const newSongs = await buildRadioPlaylist(currentSong, { existingQueueIds, dislikedIds });
    return newSongs.slice(0, 10); // Add 10 more at a time
  } catch (e) {
    console.error('Radio extension failed:', e);
    return [];
  }
};
