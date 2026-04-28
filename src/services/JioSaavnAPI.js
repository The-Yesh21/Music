const API_BASE = 'https://jio-blue.vercel.app/api';

const decodeEntity = (str) => {
  if (!str) return '';
  return str.replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'")
            .replace(/&apos;/g, "'");
};

const mapSong = (s) => {
  // Explicitly hunt for 320kbps for 5G High Quality stream. 
  // If not available, fallback seamlessly.
  const highQualityUrl = s.downloadUrl?.find(d => d.quality === '320kbps')?.url 
    || s.downloadUrl?.find(d => d.quality === '160kbps')?.url
    || s.downloadUrl?.[0]?.url;

  // Extract 500x500 image for Player UI glassmorphism
  const artworkUrl = s.image?.find(i => i.quality === '500x500')?.url 
    || s.image?.find(i => i.quality === '150x150')?.url
    || s.image?.[0]?.url;

  return {
    id: s.id,
    title: decodeEntity(s.title || s.name),
    artist: decodeEntity(s.primaryArtists || s.singers || s.artists?.primary?.[0]?.name || s.artists?.all?.[0]?.name || 'Unknown Artist'),
    album: decodeEntity(s.album?.name || s.album || 'Unknown Album'),
    duration: s.duration,
    artwork: artworkUrl || 'https://picsum.photos/seed/default/400/400',
    uri: highQualityUrl,
    year: s.year,
    genre: s.language || 'Global',
  };
};

export const JioSaavnAPI = {
  searchSongs: async (query) => {
    try {
      const resp = await fetch(`${API_BASE}/search/songs?query=${encodeURIComponent(query)}`);
      if (!resp.ok) throw new Error('Failed to fetch from proxy');
      const json = await resp.json();
      if (!json.success || !json.data?.results) return [];
      
      return json.data.results.map(mapSong);
    } catch (e) {
      console.error('API Error (Search):', e);
      return [];
    }
  },

  getTrending: async () => {
    // There isn't a universal "trending" endpoint without a specific token, so we 
    // simulate the home screen "Discover" feed by searching a popular keyword.
    return await JioSaavnAPI.searchSongs('Top 2024');
  },

  searchByGenre: async (genre, limit = 10) => {
    try {
      // Map genre to search queries that JioSaavn understands
      const genreMap = {
        'Pop': 'Pop hits',
        'Rock': 'Rock songs',
        'Hip-Hop': 'Hip hop songs',
        'R&B': 'R&B songs',
        'Classical': 'Classical music',
        'Jazz': 'Jazz music',
        'EDM': 'EDM songs',
        'Indie': 'Indie music',
        'Bollywood': 'Bollywood hits',
        'K-Pop': 'K-Pop songs',
        'Metal': 'Metal songs',
        'Country': 'Country music',
        'Lo-Fi': 'Lo-fi beats',
        'Latin': 'Latin hits',
        'Punjabi': 'Punjabi hits',
        'Sufi': 'Sufi music',
        'Carnatic': 'Carnatic music',
        'Reggaeton': 'Reggaeton hits',
        'Synthwave': 'Synthwave',
        'Ambient': 'Ambient music',
        'Electronic': 'Electronic music',
        'Chill': 'Chill music',
      };
      const query = genreMap[genre] || genre;
      const results = await JioSaavnAPI.searchSongs(query);
      return results.slice(0, limit);
    } catch (e) {
      console.error('API Error (Genre Search):', e);
      return [];
    }
  },

  getSuggestions: async (songId) => {
    try {
      const resp = await fetch(`${API_BASE}/songs/${songId}/suggestions`);
      if (!resp.ok) throw new Error('Failed to fetch suggestions');
      const json = await resp.json();
      if (!json.success || !json.data) return [];
      
      // The suggestions endpoint returns an array of songs directly in `data`
      return json.data.map(mapSong);
    } catch (e) {
      console.error('API Error (Suggestions):', e);
      return [];
    }
  }
};
