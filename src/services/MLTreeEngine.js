/**
 * EchoTune ML Decision Tree & Hierarchical Recommendation Engine
 * Built to parse the user's top 200 songs, cluster them into a binary/hierarchical tree,
 * track user listening state in real-time, and continuously predict the best songs.
 */

import tasteSongsRaw from '../constants/taste_songs.json';

// Helper to determine the local Python ML server URL depending on environment
export const getPythonServerUrl = () => {
  const isAndroid = window.Capacitor?.getPlatform() === 'android' || 
                    (window.location && window.location.href && window.location.href.indexOf('android-asset') !== -1) ||
                    /android/i.test(navigator.userAgent);
  if (isAndroid) {
    return 'http://10.0.2.2:5000';
  }
  return 'http://localhost:5000';
};

// Ensure the dataset is valid and fallback values are handled
const tasteSongs = tasteSongsRaw.map((song, index) => ({
  id: song.id || `taste_${index}`,
  title: song.Title,
  artist: song.Artist,
  genre: song.Genre || 'Unknown',
  mood: song.Mood || 'Neutral',
  bpm: Number(song['BPM / Tempo']) || 100,
  rating: Number(song['Rating / Preference Score']) || 50,
  artwork: song.artwork || `https://picsum.photos/seed/tastesong${index}/400/400`,
  uri: song.uri || `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(index % 12) + 1}.mp3`
}));

// Keep track of encountered song details (id -> {title, artist}) to map IDs back to titles/artists for Python backend
const encounteredSongs = new Map();
tasteSongs.forEach(song => {
  encounteredSongs.set(song.id, { title: song.title, artist: song.artist });
});

// User listening state for the ML algorithm
const userState = {
  averageBpm: 100, // Exponential moving average of played songs
  moodWeights: {},  // Frequency weights of played/liked moods
  genreWeights: {}, // Frequency weights of played/liked genres
  playCounts: {},   // Tracks count of individual song plays
  skipCounts: {},   // Tracks skips to penalize branches
  favoriteIds: new Set(),
  dislikeIds: new Set()
};

// Initialize weights
tasteSongs.forEach(song => {
  if (song.mood && !userState.moodWeights[song.mood]) userState.moodWeights[song.mood] = 1.0;
  if (song.genre && !userState.genreWeights[song.genre]) userState.genreWeights[song.genre] = 1.0;
});

// Build the decision tree structure from the 200 songs
export const buildDecisionTree = () => {
  // Level 0: Root (All songs)
  const rootSongs = [...tasteSongs];
  
  // Calculate median BPM for the split (properly handles even-length arrays)
  const sortedBpms = rootSongs.map(s => Number(s.bpm) || 100).sort((a, b) => a - b);
  const mid = Math.floor(sortedBpms.length / 2);
  const medianBpm = sortedBpms.length % 2 !== 0
    ? sortedBpms[mid]
    : Math.round((sortedBpms[mid - 1] + sortedBpms[mid]) / 2) || 100;

  // Split Level 1: Tempo / BPM (Energetic vs. Soulful)
  const highTempoSongs = rootSongs.filter(s => s.bpm > medianBpm);
  const lowTempoSongs = rootSongs.filter(s => s.bpm <= medianBpm);

  // Split Level 2: Mood Groups
  // High Tempo -> Upbeat/Happy vs. Energetic/Nostalgic
  const energeticKeywords = ['energetic', 'upbeat', 'happy', 'party', 'workout', 'fun', 'flirtatious'];
  const nodeHighTempoLeft = highTempoSongs.filter(s => 
    energeticKeywords.some(kw => s.mood.toLowerCase().includes(kw))
  );
  const nodeHighTempoRight = highTempoSongs.filter(s => 
    !energeticKeywords.some(kw => s.mood.toLowerCase().includes(kw))
  );

  // Low Tempo -> Smooth/Romantic vs. Chill/Melancholic
  const chillKeywords = ['chill', 'smooth', 'soulful', 'romantic', 'peaceful', 'calm', 'dreamy'];
  const nodeLowTempoLeft = lowTempoSongs.filter(s => 
    chillKeywords.some(kw => s.mood.toLowerCase().includes(kw))
  );
  const nodeLowTempoRight = lowTempoSongs.filter(s => 
    !chillKeywords.some(kw => s.mood.toLowerCase().includes(kw))
  );

  // Helper to build leaf node categories based on dominant genres
  const buildLeafNodes = (songs, parentId, moodName) => {
    // Group by high-level genre clusters
    const rAndBPop = songs.filter(s => /r&b|pop|indie/i.test(s.genre));
    const alternativeRockBollywood = songs.filter(s => !/r&b|pop|indie/i.test(s.genre));

    return [
      {
        id: `${parentId}_leaf_1`,
        name: `Modern Pop & Indie (${moodName})`,
        type: 'leaf',
        songs: rAndBPop.sort((a, b) => b.rating - a.rating),
        confidence: 50
      },
      {
        id: `${parentId}_leaf_2`,
        name: `Bollywood & Alternative (${moodName})`,
        type: 'leaf',
        songs: alternativeRockBollywood.sort((a, b) => b.rating - a.rating),
        confidence: 50
      }
    ];
  };

  // Compile the tree
  const tree = {
    id: 'root',
    name: 'Taste Horizon (All Songs)',
    type: 'root',
    feature: 'BPM',
    threshold: medianBpm,
    confidence: 100,
    songs: rootSongs,
    children: [
      {
        id: 'high_tempo',
        name: `High Tempo (> ${medianBpm} BPM)`,
        type: 'split',
        feature: 'Mood Type',
        criterion: 'Upbeat / Energetic',
        confidence: 50,
        songs: highTempoSongs,
        children: [
          {
            id: 'high_upbeat',
            name: 'Upbeat & Vibrant Vibes',
            type: 'split',
            feature: 'Genre Cluster',
            confidence: 50,
            songs: nodeHighTempoLeft,
            children: buildLeafNodes(nodeHighTempoLeft, 'high_upbeat', 'Vibrant')
          },
          {
            id: 'high_vibe',
            name: 'Nostalgic & Alternative Beats',
            type: 'split',
            feature: 'Genre Cluster',
            confidence: 50,
            songs: nodeHighTempoRight,
            children: buildLeafNodes(nodeHighTempoRight, 'high_vibe', 'Retro')
          }
        ]
      },
      {
        id: 'low_tempo',
        name: `Low Tempo (≤ ${medianBpm} BPM)`,
        type: 'split',
        feature: 'Mood Type',
        criterion: 'Soulful / Chill',
        confidence: 50,
        songs: lowTempoSongs,
        children: [
          {
            id: 'low_chill',
            name: 'Chill & Soulful Melodies',
            type: 'split',
            feature: 'Genre Cluster',
            confidence: 50,
            songs: nodeLowTempoLeft,
            children: buildLeafNodes(nodeLowTempoLeft, 'low_chill', 'Soulful')
          },
          {
            id: 'low_melancholic',
            name: 'Nostalgic & Quiet Spaces',
            type: 'split',
            feature: 'Genre Cluster',
            confidence: 50,
            songs: nodeLowTempoRight,
            children: buildLeafNodes(nodeLowTempoRight, 'low_melancholic', 'Nostalgic')
          }
        ]
      }
    ]
  };

  return tree;
};

// Parse tree state and calculate prediction scores for all branches based on active user state
export const computePredictionTree = (node) => {
  if (!node) return null;

  let score = 0;

  if (node.type === 'root') {
    score = 100;
  } else {
    // 1. Calculate how well the node's songs match user state features
    const avgBpmDiff = Math.abs(node.songs.reduce((acc, s) => acc + s.bpm, 0) / (node.songs.length || 1) - userState.averageBpm);
    const bpmMatch = Math.max(0, 100 - avgBpmDiff * 2.5); // Score out of 100 for BPM match

    // 2. Mood matches
    let moodMatchSum = 0;
    node.songs.forEach(song => {
      moodMatchSum += userState.moodWeights[song.mood] || 1.0;
    });
    const avgMoodMatch = (moodMatchSum / (node.songs.length || 1)) * 30; // normalized weight

    // 3. Genre matches
    let genreMatchSum = 0;
    node.songs.forEach(song => {
      genreMatchSum += userState.genreWeights[song.genre] || 1.0;
    });
    const avgGenreMatch = (genreMatchSum / (node.songs.length || 1)) * 30; // normalized weight

    // 4. Rating and Playback adjustments
    let engagementBonus = 0;
    let penalty = 0;
    node.songs.forEach(song => {
      engagementBonus += (userState.playCounts[song.id] || 0) * 15;
      if (userState.favoriteIds.has(song.id)) engagementBonus += 30;
      penalty += (userState.skipCounts[song.id] || 0) * 25;
      if (userState.dislikeIds.has(song.id)) penalty += 80;
    });

    const avgEngagement = (engagementBonus - penalty) / (node.songs.length || 1);

    // Compute raw prediction score
    score = Math.max(10, Math.min(99, Math.round((bpmMatch * 0.4) + avgMoodMatch + avgGenreMatch + avgEngagement)));
  }

  node.confidence = score;

  if (node.children) {
    node.children = node.children.map(child => computePredictionTree(child));
  }

  return node;
};

// Track and learn from listening actions to update the ML model weights in real-time
export const updateMLModel = (song, actionType) => {
  if (!song) return;

  // NaN recovery guard — reset to a sane default if averageBpm has gone NaN
  if (isNaN(userState.averageBpm)) userState.averageBpm = 100;

  // Track the song details in our registry so we can map its ID to title/artist for Python recommendation backend
  if (song.id) {
    encounteredSongs.set(song.id, { title: song.title || song.Title, artist: song.artist || song.Artist });
  }

  const alpha = 0.25; // Learning rate for exponential moving average
  
  if (actionType === 'PLAY') {
    // 1. Learn BPM preference (default to 100 if song.bpm is undefined/NaN)
    const bpm = Number(song.bpm) || 100;
    userState.averageBpm = (1 - alpha) * userState.averageBpm + alpha * bpm;
    
    // 2. Increment play count
    userState.playCounts[song.id] = (userState.playCounts[song.id] || 0) + 1;
    
    // 3. Increment mood and genre weights slightly
    if (song.mood) userState.moodWeights[song.mood] = (userState.moodWeights[song.mood] || 1.0) + 0.15;
    if (song.genre) userState.genreWeights[song.genre] = (userState.genreWeights[song.genre] || 1.0) + 0.15;
  } 
  
  else if (actionType === 'LIKE') {
    userState.favoriteIds.add(song.id);
    userState.dislikeIds.delete(song.id); // Remove from dislike if favorited
    
    // Substantial boost to mood and genre weights
    if (song.mood) userState.moodWeights[song.mood] = (userState.moodWeights[song.mood] || 1.0) + 0.6;
    if (song.genre) userState.genreWeights[song.genre] = (userState.genreWeights[song.genre] || 1.0) + 0.6;
    
    // Shift BPM target faster towards liked song (default to 100 if song.bpm is undefined/NaN)
    const bpm = Number(song.bpm) || 100;
    userState.averageBpm = (1 - 0.4) * userState.averageBpm + 0.4 * bpm;
  } 
  
  else if (actionType === 'UNLIKE') {
    userState.favoriteIds.delete(song.id);
    if (song.mood) userState.moodWeights[song.mood] = Math.max(0.2, (userState.moodWeights[song.mood] || 1.0) - 0.4);
    if (song.genre) userState.genreWeights[song.genre] = Math.max(0.2, (userState.genreWeights[song.genre] || 1.0) - 0.4);
  } 
  
  else if (actionType === 'SKIP') {
    userState.skipCounts[song.id] = (userState.skipCounts[song.id] || 0) + 1;
    
    // Apply penalty to associated mood and genre
    if (song.mood) userState.moodWeights[song.mood] = Math.max(0.1, (userState.moodWeights[song.mood] || 1.0) - 0.3);
    if (song.genre) userState.genreWeights[song.genre] = Math.max(0.1, (userState.genreWeights[song.genre] || 1.0) - 0.3);
  } 
  
  else if (actionType === 'DISLIKE') {
    userState.dislikeIds.add(song.id);
    userState.favoriteIds.delete(song.id);
    
    // Extreme penalty to weights
    if (song.mood) userState.moodWeights[song.mood] = Math.max(0.05, (userState.moodWeights[song.mood] || 1.0) - 0.7);
    if (song.genre) userState.genreWeights[song.genre] = Math.max(0.05, (userState.genreWeights[song.genre] || 1.0) - 0.7);
  }
};

// Retrieve flat list of top predicted songs across the highest confidence branches
export const getMLTreeRecommendations = (limit = 15) => {
  const tree = buildDecisionTree();
  const scoredTree = computePredictionTree(tree);
  
  // Find all leaf nodes and flat-map songs with their node confidence modifier
  const leafNodes = [];
  const traverse = (node) => {
    if (!node) return;
    if (node.type === 'leaf') {
      leafNodes.push(node);
    } else if (node.children) {
      node.children.forEach(traverse);
    }
  };
  traverse(scoredTree);

  // Compute recommendation scores for all individual songs
  const songScores = [];
  const seenIds = new Set();

  leafNodes.forEach(node => {
    node.songs.forEach(song => {
      if (seenIds.has(song.id) || userState.dislikeIds.has(song.id)) return;
      seenIds.add(song.id);

      // Score components
      const ratingFactor = song.rating * 0.4;
      const confidenceFactor = node.confidence * 0.6;
      const playCountPenalty = (userState.playCounts[song.id] || 0) * 5; // Slight variety penalty so they don't loop endlessly
      const skipPenalty = (userState.skipCounts[song.id] || 0) * 15;

      let score = ratingFactor + confidenceFactor - playCountPenalty - skipPenalty;

      // Boost if favorited
      if (userState.favoriteIds.has(song.id)) {
        score += 25;
      }

      songScores.push({ song, score });
    });
  });

  // Sort and select top matches
  return songScores
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.song);
};

// Export user state for diagnostic / UI display
export const getMLUserState = () => ({
  ...userState,
  favoriteIds: Array.from(userState.favoriteIds),
  dislikeIds: Array.from(userState.dislikeIds)
});

// Retrieve predictions asynchronously: tries the Python ML server first, falls back to local decision tree.
export const getMLTreeRecommendationsAsync = async (limit = 15, seedSong = null) => {
  const pyUrl = getPythonServerUrl();
  try {
    const favorites = Array.from(userState.favoriteIds).map(id => {
      const details = encounteredSongs.get(id);
      return details ? { title: details.title, artist: details.artist } : null;
    }).filter(Boolean);

    const dislikes = Array.from(userState.dislikeIds).map(id => {
      const details = encounteredSongs.get(id);
      return details ? { title: details.title, artist: details.artist } : null;
    }).filter(Boolean);

    // Call Python ML server
    const response = await fetch(`${pyUrl}/api/recommend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        seed_title: seedSong?.title || '',
        seed_artist: seedSong?.artist || '',
        favorites,
        dislikes,
        history: [], 
        limit
      }),
      signal: (() => { const c = new AbortController(); setTimeout(() => c.abort(), 1500); return c.signal; })() // 1.5s timeout (compatible polyfill)
    });

    if (response.ok) {
      const pyRecs = await response.json();
      if (Array.isArray(pyRecs) && pyRecs.length > 0) {
        console.log(`Successfully fetched ${pyRecs.length} ML recommendations from Python backend.`);
        return pyRecs.map((pySong, index) => {
          // Attempt to find a local match in tasteSongs to get local URI or metadata
          const localMatch = tasteSongs.find(s => 
            s.title.toLowerCase() === pySong.title.toLowerCase() &&
            s.artist.toLowerCase() === pySong.artist.toLowerCase()
          );
          return {
            id: pySong.id || `python_${index}`,
            title: pySong.title,
            artist: pySong.artist,
            genre: pySong.genre,
            mood: pySong.mood,
            bpm: pySong.bpm,
            rating: pySong.rating,
            artwork: pySong.artwork || `https://picsum.photos/seed/pythonsong${index}/400/400`,
            uri: localMatch?.uri || pySong.uri || `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(index % 12) + 1}.mp3`
          };
        });
      }
    }
  } catch (error) {
    console.warn('Python ML recommendations offline, falling back to local Decision Tree model.', error);
  }

  // Fallback to local sync engine
  return getMLTreeRecommendations(limit);
};
