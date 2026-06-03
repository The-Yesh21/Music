import { tasteProfile } from '../data/tasteProfile';
import { JioSaavnAPI } from './JioSaavnAPI';

// Get taste-matched songs by querying seed songs and fetching their suggestions
export const getDiscoverySongs = async () => {
  const results = [];
  const seen = new Set();

  // Round 1: fetch suggestions for each seed song
  for (const query of tasteProfile.seedSongs.slice(0, 5)) {
    try {
      const searchResult = await JioSaavnAPI.searchSongs(query);
      const topHit = searchResult?.[0];
      if (!topHit?.id) continue;

      const suggestions = await JioSaavnAPI.getSuggestions(topHit.id);
      const songs = suggestions || [];
      for (const song of songs) {
        if (!seen.has(song.id)) {
          seen.add(song.id);
          results.push(song);
        }
      }
    } catch (e) {
      console.error('Discovery error:', e);
    }
  }

  // Round 2: direct artist searches for artists not covered by suggestions
  const artistQueries = [
    "Anuv Jain new songs",
    "Ravyn Lenae songs",
    "Vishal Mishra latest",
    "The Weeknd top songs",
    "Arijit Singh romantic"
  ];

  for (const query of artistQueries) {
    try {
      const result = await JioSaavnAPI.searchSongs(query);
      const songs = result || [];
      for (const song of songs.slice(0, 6)) {
        if (!seen.has(song.id)) {
          seen.add(song.id);
          results.push(song);
        }
      }
    } catch (e) {}
  }

  return results;
};

// Score a song against taste profile (for sorting)
export const scoreSong = (song) => {
  let score = 0;
  const artistNameStr = song.artist?.toLowerCase() || '';

  for (const artist of tasteProfile.topArtists) {
    if (artistNameStr.includes(artist.toLowerCase())) {
      score += 10;
    }
  }

  return score;
};
