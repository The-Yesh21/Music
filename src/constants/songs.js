export const SONGS = [
  { id: '1', title: 'Midnight Reverie', artist: 'Luna Waves', album: 'Dreamscape', duration: 213, artwork: 'https://picsum.photos/seed/song1/400/400', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', genre: 'Ambient', year: 2024, mood: 'chill' },
  { id: '2', title: 'Neon Horizon', artist: 'Synthwave Echo', album: 'Cyber Pulse', duration: 187, artwork: 'https://picsum.photos/seed/song2/400/400', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', genre: 'Synthwave', year: 2024, mood: 'energetic' },
  { id: '3', title: 'Aurora Drift', artist: 'Stellar Beats', album: 'Cosmos', duration: 241, artwork: 'https://picsum.photos/seed/song3/400/400', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', genre: 'Chill', year: 2023, mood: 'calm' },
  { id: '4', title: 'Electric Cathedral', artist: 'Void Runner', album: 'Infinite Loop', duration: 198, artwork: 'https://picsum.photos/seed/song4/400/400', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', genre: 'Electronic', year: 2024, mood: 'energetic' },
  { id: '5', title: 'Shadow Garden', artist: 'Phantom Keys', album: 'Dark Bloom', duration: 225, artwork: 'https://picsum.photos/seed/song5/400/400', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', genre: 'Indie', year: 2023, mood: 'chill' },
  { id: '6', title: 'Velvet Thunder', artist: 'Crystal Storm', album: 'Tempest', duration: 176, artwork: 'https://picsum.photos/seed/song6/400/400', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3', genre: 'Electronic', year: 2024, mood: 'energetic' },
  { id: '7', title: 'Frozen Stars', artist: 'Nebula Crest', album: 'Galactic Suite', duration: 259, artwork: 'https://picsum.photos/seed/song7/400/400', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3', genre: 'Ambient', year: 2023, mood: 'calm' },
  { id: '8', title: 'Crimson Tide', artist: 'Wave Forme', album: 'Oceanic', duration: 193, artwork: 'https://picsum.photos/seed/song8/400/400', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', genre: 'Chill', year: 2024, mood: 'chill' },
  { id: '9', title: 'Digital Rain', artist: 'Binary Ghost', album: 'Matrix Dreams', duration: 208, artwork: 'https://picsum.photos/seed/song9/400/400', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3', genre: 'Synthwave', year: 2023, mood: 'energetic' },
  { id: '10', title: 'Golden Abyss', artist: 'Echo Chamber', album: 'Resonance', duration: 231, artwork: 'https://picsum.photos/seed/song10/400/400', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', genre: 'Electronic', year: 2024, mood: 'chill' },
  { id: '11', title: 'Pale Blue Dot', artist: 'Cosmos Theory', album: 'Voyager', duration: 244, artwork: 'https://picsum.photos/seed/song11/400/400', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3', genre: 'Ambient', year: 2024, mood: 'calm' },
  { id: '12', title: 'Quantum Pulse', artist: 'Voltage Kids', album: 'Electric Youth', duration: 182, artwork: 'https://picsum.photos/seed/song12/400/400', uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3', genre: 'Electronic', year: 2023, mood: 'energetic' },
];

export const formatDuration = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export const formatMillis = (millis) => formatDuration(Math.floor(millis / 1000));
