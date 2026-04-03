import React, { useMemo, useState, useEffect } from 'react';
import { useMusic } from '../context/MusicContext';
import { loadGeminiKey, saveGeminiKey } from '../services/StorageService';
import SongCard from '../components/SongCard';

const formatTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
};

export default function InsightsScreen() {
  const { state, playSong } = useMusic();
  const { stats, history } = state;

  const [geminiKey, setGeminiKey] = useState('');

  useEffect(() => {
    setGeminiKey(loadGeminiKey() || 'AIzaSyDsVRrq69x_IG-c9RSUQh3gxUIRSYeN3dI');
  }, []);

  const handleSaveKey = () => {
    saveGeminiKey(geminiKey);
    alert('Gemini AI Bridge Key Saved Securely!');
  };

  const topSongs = useMemo(() => {
    if (!stats.tracks) return [];
    return history
      .slice()
      .sort((a, b) => (stats.tracks[b.id]?.playCount || 0) - (stats.tracks[a.id]?.playCount || 0))
      .filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i)
      .slice(0, 5);
  }, [stats, history]);

  const topArtist = useMemo(() => {
    if (!history || history.length === 0) return 'None yet';
    const artistCounts = {};
    history.forEach((song) => {
      const pc = stats.tracks[song.id]?.playCount || 1;
      if (song.artist) {
        artistCounts[song.artist] = (artistCounts[song.artist] || 0) + pc;
      }
    });

    const sortedArtists = Object.entries(artistCounts).sort((a, b) => b[1] - a[1]);
    return sortedArtists.length > 0 ? sortedArtists[0][0] : 'None yet';
  }, [history, stats]);

  return (
    <div className="screen fade-in" style={{ padding: '40px 20px 100px' }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Your Insights</h1>
      <p className="gradient-text" style={{ fontWeight: 700, marginBottom: 32, fontSize: 15 }}>Discover your listening habits</p>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 32 }}>
        <div style={{ flex: 1, background: 'var(--glass)', padding: 20, borderRadius: 20, border: '1px solid var(--border)' }}>
          <i className="fas fa-music" style={{ color: 'var(--accent)', fontSize: 24, marginBottom: 12 }}></i>
          <h3 style={{ fontSize: 20, color: '#fff', fontWeight: 700 }}>{history.length}</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>Total Tracks</p>
        </div>
        <div style={{ flex: 1, background: 'var(--glass)', padding: 20, borderRadius: 20, border: '1px solid var(--border)' }}>
          <i className="fas fa-star" style={{ color: 'var(--glow)', fontSize: 24, marginBottom: 12 }}></i>
          <h3 style={{ fontSize: 20, color: '#fff', fontWeight: 700, textTransform: 'capitalize' }}>
            {topArtist}
          </h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>Top Artist</p>
        </div>
      </div>

      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Your All-Time Top 5</h2>
      {topSongs.length > 0 ? (
        topSongs.map((song, idx) => (
          <div key={song.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 24, fontWeight: 800, color: '#56567A', textAlign: 'center' }}>{idx + 1}</div>
            <div style={{ flex: 1 }}>
              <SongCard song={song} onPress={() => playSong(song)} />
            </div>
          </div>
        ))
      ) : (
        <div style={{ padding: 20, textAlign: 'center', background: 'var(--glass)', borderRadius: 12, border: '1px solid var(--border)' }}>
          <p style={{ color: '#56567A' }}>Listen to more music to see your top tracks here.</p>
        </div>
      )}

      {/* Gemini Bridge Config Vault */}
      <div style={{ marginTop: 60, padding: 24, borderRadius: 24, background: 'linear-gradient(145deg, rgba(255,107,53,0.08), rgba(199,125,255,0.06), rgba(255,179,71,0.04))', border: '1px solid rgba(255,107,53,0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <i className="fas fa-sparkles" style={{ fontSize: 28, color: 'var(--accent-secondary)' }} />
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Gemini AI Radio Vault</h2>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Power your JioSaavn radio using Google's Gemini-1.5-Pro.</p>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Gemini API Key</label>
            <input 
              type="password" 
              value={geminiKey} 
              onChange={e => setGeminiKey(e.target.value)}
              style={{ width: '100%', background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border-light)', padding: '12px 16px', borderRadius: 12, color: '#fff', fontSize: 14, outline: 'none', transition: 'border-color 0.3s' }} 
              placeholder="AIzaSy..."
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border-light)'}
            />
          </div>
          <button onClick={handleSaveKey} style={{ background: 'var(--accent-gradient)', color: '#fff', border: 'none', padding: '14px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s', boxShadow: '0 4px 16px var(--accent-glow)' }} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.98)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
            Save Authentication Key
          </button>
        </div>
      </div>

    </div>
  );
}
