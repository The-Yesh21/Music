/**
 * EchoTune ML Decision Tree & Hierarchical Recommendation Engine
 * Built to parse the user's top 200 songs, cluster them into a binary/hierarchical tree,
 * track user listening state in real-time, and continuously predict the best songs.
 */

import tasteSongsRaw from '../constants/taste_songs.json';

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
  
  // Calculate average BPM for the split
  const bpms = rootSongs.map(s => s.bpm);
  const medianBpm = bpms.sort((a, b) => a - b)[Math.floor(bpms.length / 2)] || 100;

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

  const alpha = 0.25; // Learning rate for exponential moving average
  
  if (actionType === 'PLAY') {
    // 1. Learn BPM preference
    userState.averageBpm = (1 - alpha) * userState.averageBpm + alpha * song.bpm;
    
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
    
    // Shift BPM target faster towards liked song
    userState.averageBpm = (1 - 0.4) * userState.averageBpm + 0.4 * song.bpm;
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
