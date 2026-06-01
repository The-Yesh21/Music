import { loadLastFmKey } from './StorageService';

export const getSimilarTracksFromLastFm = async (trackName, artistName) => {
  try {
    const key = loadLastFmKey();
    if (!key) {
      console.log('Last.fm recommendations bypassed (key not configured).');
      return [];
    }

    const response = await fetch(`https://ws.audioscrobbler.com/2.0/?method=track.getsimilar&artist=${encodeURIComponent(artistName)}&track=${encodeURIComponent(trackName)}&api_key=${key}&format=json&limit=15`);

    if (!response.ok) {
      console.error('Last.fm API Error:', response.statusText);
      return [];
    }

    const data = await response.json();
    
    // Check if Last.fm returned an error (it uses 200 OK with an error body sometimes)
    if (data.error) {
      console.error('Last.fm JSON Error:', data.message);
      return [];
    }

    if (data.similartracks && Array.isArray(data.similartracks.track)) {
      return data.similartracks.track.map(t => `${t.name} - ${t.artist.name}`);
    }

    return [];
  } catch (error) {
    console.error('LastFm Service Execution Error:', error);
    return [];
  }
};
