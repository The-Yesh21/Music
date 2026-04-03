import { loadSpotifyKeys } from './StorageService';

// Caches the token for 1 hour
let accessTokenCache = null;
let tokenExpiresAt = 0;

const getAccessToken = async () => {
  const keys = loadSpotifyKeys();
  if (!keys.clientId || !keys.clientSecret) {
    throw new Error('Spotify keys are missing.');
  }

  // Return cached token if valid
  if (accessTokenCache && Date.now() < tokenExpiresAt) {
    return accessTokenCache;
  }

  const credentials = btoa(`${keys.clientId}:${keys.clientSecret}`);

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    console.error("Spotify Auth Failed", response.statusText);
    throw new Error('Spotify Authentication Failed. Check your keys.');
  }

  const data = await response.json();
  accessTokenCache = data.access_token;
  tokenExpiresAt = Date.now() + (data.expires_in * 1000) - 60000; // subtract 1 min buffer
  return accessTokenCache;
};

// Gets the Spotify ID for a specific song name and artist
const getSpotifyTrackId = async (songName, artistName, token) => {
  const query = encodeURIComponent(`${songName} ${artistName}`);
  const response = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) throw new Error('Failed to search Spotify for Seed Track');
  
  const data = await response.json();
  if (data.tracks.items.length > 0) {
    return data.tracks.items[0].id; // Returns Spotify Track ID
  }
  return null;
};

// Returns an array of search strings ["Song - Artist"] based on Spotify ML Recommendations
export const getSpotifyRecommendations = async (seedSong, seedArtist) => {
  try {
    const token = await getAccessToken();
    const seedId = await getSpotifyTrackId(seedSong, seedArtist, token);

    if (!seedId) {
      console.warn("Could not find matching seed song on Spotify to build radio.");
      return [];
    }

    // Fetch 15 highly-related tracks based on that seed track
    const response = await fetch(`https://api.spotify.com/v1/recommendations?seed_tracks=${seedId}&limit=15`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) throw new Error('Spotify Recommendations API failed');

    const data = await response.json();
    
    // Map the highly accurate ML recommendations into flat text search strings
    return data.tracks.map(t => {
      const artist = t.artists.length > 0 ? t.artists[0].name : '';
      return `${t.name} ${artist}`;
    });

  } catch (error) {
    console.error('Spotify Bridge Error:', error);
    return [];
  }
};
