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

  // Extract unique artists and albums from the results
  const songs = results.slice(0, 6);
  
  const uniqueArtists = [];
  const seenArtists = new Set();
  results.forEach(item => {
    if (item.artist && !seenArtists.has(item.artist.toLowerCase())) {
      seenArtists.add(item.artist.toLowerCase());
      uniqueArtists.push({ name: item.artist, songSeed: item });
    }
  });
  const artists = uniqueArtists.slice(0, 3);

  const uniqueAlbums = [];
  const seenAlbums = new Set();
  results.forEach(item => {
    if (item.album && !seenAlbums.has(item.album.toLowerCase())) {
      seenAlbums.add(item.album.toLowerCase());
      uniqueAlbums.push({ name: item.album, songSeed: item });
    }
  });
  const albums = uniqueAlbums.slice(0, 3);

  const handleArtistClick = async (artistName) => {
    setIsSearching(true);
    const artistSongs = await JioSaavnAPI.searchSongs(artistName);
    if (artistSongs && artistSongs.length > 0) {
      playSong(artistSongs[0], artistSongs);
    }
    setIsSearching(false);
  };

  const handleAlbumClick = async (albumName) => {
    setIsSearching(true);
    const albumSongs = await JioSaavnAPI.searchSongs(albumName);
    if (albumSongs && albumSongs.length > 0) {
      playSong(albumSongs[0], albumSongs);
    }
    setIsSearching(false);
  };

  return (
    <div className="screen fade-in search-screen-container">
      <div className="search-sticky-header">
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 16 }}>Search</h1>
        <SearchBar onSearch={setQuery} />
      </div>
      
      <div className="search-results-area">
        {isSearching ? (
          <div className="empty-state">
            <i className="fas fa-circle-notch fa-spin" style={{ fontSize: 40, color: 'var(--accent)', marginBottom: 16 }} />
            <p style={{ color: 'var(--text-secondary)' }}>Searching globally...</p>
          </div>
        ) : results.length === 0 && query.trim() ? (
          <div className="empty-state">
            <i className="fas fa-search" style={{ fontSize: 40, color: 'rgba(255,255,255,0.15)', marginBottom: 16 }} />
            <p style={{ color: 'var(--text-secondary)' }}>No globally matching tracks found.</p>
          </div>
        ) : results.length === 0 && !query.trim() ? (
          <div className="empty-state">
            <i className="fas fa-globe" style={{ fontSize: 40, color: 'rgba(255,255,255,0.15)', marginBottom: 16 }} />
            <p style={{ color: 'var(--text-secondary)' }}>Search over 50 million songs globally.</p>
          </div>
        ) : (
          <div className="search-results-grouped">
            {/* Songs Section */}
            {songs.length > 0 && (
              <div className="search-result-section">
                <h2 className="search-section-title">Songs</h2>
                <div className="songs-list-rows">
                  {songs.map((song, index) => (
                    <SongCard 
                      key={song.id} 
                      song={song} 
                      index={index + 1}
                      variant="row" 
                      onPress={() => playSong(song, results)} 
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Artists Section */}
            {artists.length > 0 && (
              <div className="search-result-section" style={{ marginTop: 24 }}>
                <h2 className="search-section-title">Artists</h2>
                <div className="artists-list-grouped">
                  {artists.map((artist, idx) => (
                    <div 
                      key={idx} 
                      className="search-artist-row" 
                      onClick={() => handleArtistClick(artist.name)}
                    >
                      <div className="artist-row-avatar">
                        <i className="fas fa-user-circle" />
                      </div>
                      <span className="artist-row-name">{artist.name}</span>
                      <i className="fas fa-play artist-row-play" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Albums Section */}
            {albums.length > 0 && (
              <div className="search-result-section" style={{ marginTop: 24 }}>
                <h2 className="search-section-title">Albums</h2>
                <div className="albums-list-grouped">
                  {albums.map((album, idx) => (
                    <div 
                      key={idx} 
                      className="search-album-row" 
                      onClick={() => handleAlbumClick(album.name)}
                    >
                      <div className="album-row-avatar">
                        <i className="fas fa-compact-disc" />
                      </div>
                      <div className="album-row-text">
                        <span className="album-row-name">{album.name}</span>
                        <span className="album-row-artist">by {album.songSeed.artist}</span>
                      </div>
                      <i className="fas fa-play album-row-play" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
