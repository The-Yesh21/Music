import React, { useState, useEffect } from 'react';
import { useMusic } from '../context/MusicContext';
import { JioSaavnAPI } from '../services/JioSaavnAPI';
import SearchBar from '../components/SearchBar';
import SongCard from '../components/SongCard';
import './Library.css';

export default function LibraryScreen() {
  const { playSong } = useMusic();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    
    const timeout = setTimeout(async () => {
      setIsSearching(true);
      const data = await JioSaavnAPI.searchSongs(query);
      setResults(data);
      setIsSearching(false);
    }, 600);

    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="screen fade-in" style={{ padding: '40px 20px 80px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 20 }}>Your Library</h1>
      
      <SearchBar onSearch={setQuery} />

      <div className="songs-list" style={{ paddingBottom: 100, marginTop: 20 }}>
        {isSearching ? (
          <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 60 }}>
            <i className="fas fa-circle-notch fa-spin" style={{ fontSize: 40, color: 'var(--accent)', marginBottom: 16 }} />
            <p style={{ color: '#56567A' }}>Searching globally...</p>
          </div>
        ) : results.length === 0 && query.trim() ? (
          <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 60 }}>
            <i className="fas fa-search" style={{ fontSize: 40, color: 'rgba(255,255,255,0.15)', marginBottom: 16 }} />
            <p style={{ color: '#56567A' }}>No globally matching tracks found.</p>
          </div>
        ) : results.length === 0 && !query.trim() ? (
          <div className="empty-state" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 60 }}>
            <i className="fas fa-globe" style={{ fontSize: 40, color: 'rgba(255,255,255,0.15)', marginBottom: 16 }} />
            <p style={{ color: '#56567A' }}>Search over 50 million songs globally.</p>
          </div>
        ) : (
          results.map((song) => (
            <SongCard key={song.id} song={song} onPress={() => playSong(song, results)} />
          ))
        )}
      </div>
    </div>
  );
}
