// JioSaavn API client with fallback endpoints, retry logic, request
// de-duplication, a small concurrency cap, and a session result cache.
//
// Why the extra machinery: inside the native app the player preloads several
// upcoming tracks at once and, on any failure, auto-skips through the queue.
// That previously fired dozens of simultaneous requests at cold free-tier
// endpoints, and nearly all came back "Failed to fetch". Caching + de-duping +
// capping concurrency keeps traffic gentle so a healthy endpoint responds.
//
// Only endpoints verified reachable are kept (the old jiosaavn-api / saavn-api
// / jiosaavn.me instances now return 404 or are unreachable).
const ENDPOINTS = [
  'https://jio-blue.vercel.app/api/search/songs',
  'https://jiosaavn-sigma.vercel.app/api/search/songs',
];

const DEFAULT_LIMIT = 20;
const REQUEST_TIMEOUT = 10000;
const MAX_RETRIES = 1;
const RETRY_DELAY = 600;
const MAX_CONCURRENT = 3;

// query -> results (successful searches, memoized for the session)
const resultCache = new Map();
// query -> in-flight Promise (identical concurrent searches share one request)
const inFlight = new Map();

// Concurrency gate: cap simultaneous searches so a burst of preloads/auto-skips
// can't slam the (cold, rate-limited) endpoints all at once.
let activeCount = 0;
const waiters = [];
function acquireSlot() {
  if (activeCount < MAX_CONCURRENT) {
    activeCount += 1;
    return Promise.resolve();
  }
  return new Promise(resolve => waiters.push(resolve));
}
function releaseSlot() {
  activeCount = Math.max(0, activeCount - 1);
  const next = waiters.shift();
  if (next) {
    activeCount += 1;
    next();
  }
}

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

async function runSearch(query, limit) {
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

export async function searchSongs(query, limit = DEFAULT_LIMIT) {
  const q = query?.trim();
  if (!q) return [];

  const cacheKey = `${q}::${limit}`;
  // Serve memoized results instantly; share an in-flight request for dupes.
  if (resultCache.has(cacheKey)) return resultCache.get(cacheKey);
  if (inFlight.has(cacheKey)) return inFlight.get(cacheKey);

  const promise = (async () => {
    await acquireSlot();
    try {
      const results = await runSearch(q, limit);
      if (results.length) resultCache.set(cacheKey, results);
      return results;
    } finally {
      releaseSlot();
      inFlight.delete(cacheKey);
    }
  })();

  inFlight.set(cacheKey, promise);
  return promise;
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