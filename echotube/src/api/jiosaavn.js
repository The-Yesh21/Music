// JioSaavn API client with fallback endpoints and retry logic
const ENDPOINTS = [
  'https://jio-blue.vercel.app/api/search/songs',
  'https://jiosaavn-api.vercel.app/api/search/songs',
  'https://saavn-api.vercel.app/api/search/songs',
  'https://jiosaavn.me/api/search/songs',
];

const DEFAULT_LIMIT = 20;
const REQUEST_TIMEOUT = 10000;
const MAX_RETRIES = 2;
const RETRY_DELAY = 500;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

async function tryEndpoint(endpoint, query, limit = DEFAULT_LIMIT) {
  const url = `${endpoint}?query=${encodeURIComponent(query)}&limit=${limit}`;
  const response = await fetchWithTimeout(url);
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  
  const data = await response.json();
  
  // Normalize different API response formats
  if (data.success && data.data?.results) {
    return data.data.results;
  }
  if (data.results) {
    return data.results;
  }
  if (Array.isArray(data)) {
    return data;
  }
  throw new Error('Unexpected response format');
}

export async function searchSongs(query, limit = DEFAULT_LIMIT) {
  if (!query?.trim()) return [];
  
  const errors = [];
  
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    for (const endpoint of ENDPOINTS) {
      try {
        const results = await tryEndpoint(endpoint, query, limit);
        if (results?.length) {
          return results;
        }
      } catch (err) {
        errors.push(`${endpoint}: ${err.message}`);
        // Continue to next endpoint
      }
    }
    
    // Wait before retry
    if (attempt < MAX_RETRIES) {
      await new Promise(r => setTimeout(r, RETRY_DELAY * (attempt + 1)));
    }
  }
  
  console.warn('All JioSaavn endpoints failed:', errors.join('; '));
  return [];
}

export function getBestImage(images) {
  if (!Array.isArray(images) || images.length === 0) return null;
  return images.find(img => img.quality === '500x500')?.url 
    || images.find(img => img.quality === '150x150')?.url
    || images[0]?.url 
    || null;
}

export function getBestStreamUrl(downloadUrls) {
  if (!Array.isArray(downloadUrls) || downloadUrls.length === 0) return null;

  const ranked = [...downloadUrls].sort((a, b) => {
    const aBitrate = Number.parseInt(String(a.quality).replace(/\D/g, ''), 10) || 0;
    const bBitrate = Number.parseInt(String(b.quality).replace(/\D/g, ''), 10) || 0;
    return bBitrate - aBitrate;
  });

  const preferred = ranked.find(url => /320/i.test(String(url.quality))) || ranked[0];
  return preferred?.url || null;
}

export function getTrackArtists(track) {
  if (track.artists?.primary?.length) {
    return track.artists.primary.map(a => a.name).join(', ');
  }
  return track.primaryArtists || track.artists?.all?.map(a => a.name).join(', ') || 'Unknown artist';
}

export function mapApiTrackToSong(track, category) {
  return {
    Title: track.name || track.title || 'Unknown',
    Artist: getTrackArtists(track),
    Category: category,
    Mood: '',
    Genre: track.language || '',
    image: getBestImage(track.image),
    streamUrl: getBestStreamUrl(track.downloadUrl),
    isNew: true,
    apiId: track.id,
  };
}