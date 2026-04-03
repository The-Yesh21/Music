import React, { useState, useEffect } from 'react';
import { useMusic } from '../context/MusicContext';
import { JioSaavnAPI } from '../services/JioSaavnAPI';
import { loadTasteProfile, clearTasteProfile, getPersonalizedPlaylist } from '../services/TasteService';
import SongCard from '../components/SongCard';
import TasteWizard from '../components/TasteWizard';

export default function HomeScreen({ onNavigate }) {
  const { state, playSong } = useMusic();
  const { currentSong } = state;

  const [trending, setTrending] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tasteProfile, setTasteProfile] = useState(null);
  const [showWizard, setShowWizard] = useState(false);
  const [personalizedSongs, setPersonalizedSongs] = useState([]);
  const [isPersonalizing, setIsPersonalizing] = useState(false);

  // Load taste profile from localStorage
  useEffect(() => {
    const profile = loadTasteProfile();
    setTasteProfile(profile);
  }, []);

  // Fetch trending
  useEffect(() => {
    async function fetch() {
      const data = await JioSaavnAPI.getTrending();
      setTrending(data);
      setIsLoading(false);
    }
    fetch();
  }, []);

  // Fetch personalized songs when taste profile exists
  useEffect(() => {
    if (!tasteProfile) return;
    setIsPersonalizing(true);
    getPersonalizedPlaylist(tasteProfile)
      .then((songs) => {
        setPersonalizedSongs(songs);
        setIsPersonalizing(false);
      })
      .catch(() => setIsPersonalizing(false));
  }, [tasteProfile]);

  const recommendedSongs = trending.slice(0, 4);
  const recentSongs = trending.slice(4, 10);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const handleWizardComplete = (profile) => {
    setTasteProfile(profile);
    setShowWizard(false);
  };

  const handleRetakeQuiz = () => {
    clearTasteProfile();
    setTasteProfile(null);
    setPersonalizedSongs([]);
    setShowWizard(true);
  };

  return (
    <div className="screen fade-in" style={{ padding: '40px 20px 80px' }}>

      {/* ── Greeting ────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>{getGreeting()}</h1>
          <p className="gradient-text" style={{ fontWeight: 700, marginTop: 4, fontSize: 15 }}>Ready to listen?</p>
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: '50%',
          background: 'var(--accent-gradient)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 0 20px var(--accent-glow)',
        }}>
          <i className="fas fa-user" style={{ color: '#fff' }} />
        </div>
      </div>

      {/* ── Discover Your Sound (Hero Card) ────────── */}
      {!tasteProfile && (
        <div className="discover-hero" onClick={() => setShowWizard(true)}>
          <div style={{ position: 'relative', zIndex: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <span style={{ fontSize: 36 }}>🎵</span>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: '#fff' }}>Discover Your Sound</h2>
                <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Tell us your music taste and get a personalized playlist
                </p>
              </div>
            </div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '10px 20px', borderRadius: 'var(--radius-full)',
              background: 'var(--accent-gradient)',
              color: '#fff', fontSize: 13, fontWeight: 700,
              boxShadow: '0 4px 16px var(--accent-glow)',
              marginTop: 8,
            }}>
              <i className="fas fa-wand-magic-sparkles" />
              Take the Quiz
              <i className="fas fa-arrow-right" style={{ fontSize: 11 }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Personalized Mix Section ──────────────── */}
      {tasteProfile && (
        <div className="personalized-section">
          <div className="personalized-header">
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>
                <i className="fas fa-wand-magic-sparkles" style={{ color: 'var(--accent)', marginRight: 8, fontSize: 16 }} />
                Your Personalized Mix
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
                Curated based on your taste profile
              </p>
            </div>
            <button className="retake-btn" onClick={handleRetakeQuiz}>
              <i className="fas fa-arrows-rotate" />
              Retake Quiz
            </button>
          </div>

          {/* Taste Summary Chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
            {tasteProfile.genres?.slice(0, 3).map((g) => (
              <span key={g} style={{
                padding: '4px 12px', borderRadius: 'var(--radius-full)',
                background: 'rgba(255,107,53,0.12)', border: '1px solid rgba(255,107,53,0.25)',
                color: 'var(--accent-light)', fontSize: 11, fontWeight: 600,
              }}>{g}</span>
            ))}
            {tasteProfile.moods?.slice(0, 2).map((m) => (
              <span key={m} style={{
                padding: '4px 12px', borderRadius: 'var(--radius-full)',
                background: 'rgba(199,125,255,0.12)', border: '1px solid rgba(199,125,255,0.25)',
                color: 'var(--accent-secondary)', fontSize: 11, fontWeight: 600,
              }}>{m}</span>
            ))}
          </div>

          {isPersonalizing ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '40px 0' }}>
              <i className="fas fa-circle-notch fa-spin" style={{ color: 'var(--accent)', fontSize: 32, marginBottom: 12 }} />
              <span style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600 }}>Curating your perfect mix...</span>
            </div>
          ) : personalizedSongs.length > 0 ? (
            <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 10 }}>
              {personalizedSongs.slice(0, 8).map((song) => (
                <div key={song.id} style={{ minWidth: 140, cursor: 'pointer' }} onClick={() => playSong(song, personalizedSongs)}>
                  <img src={song.artwork} alt={song.title} style={{
                    width: 140, height: 140, borderRadius: 14, objectFit: 'cover', marginBottom: 8,
                    border: '1px solid rgba(255,255,255,0.06)',
                  }} />
                  <div style={{ color: '#fff', fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{song.title}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>{song.artist}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      )}

      {/* Section Divider */}
      {tasteProfile && <div className="section-divider" />}

      {/* ── Recommended for you ─────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>Recommended for you</h2>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '40px 0' }}>
            <i className="fas fa-circle-notch fa-spin" style={{ color: 'var(--accent)', fontSize: 32 }} />
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 10 }}>
            {recommendedSongs.map((song) => (
              <div key={song.id} style={{ minWidth: 140, cursor: 'pointer' }} onClick={() => playSong(song, trending)}>
                <img src={song.artwork} alt={song.title} style={{
                  width: 140, height: 140, borderRadius: 14, objectFit: 'cover', marginBottom: 8,
                  border: '1px solid rgba(255,255,255,0.06)',
                }} />
                <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{song.title}</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{song.artist}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Top Charts ──────────────────────────────── */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Top Charts</h2>
        {isLoading ? (
          <div style={{ color: 'var(--text-secondary)' }}>Loading...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {recentSongs.map((song) => (
              <SongCard key={song.id} song={song} onPress={() => playSong(song, trending)} />
            ))}
          </div>
        )}
      </div>

      {/* ── Taste Wizard Overlay ────────────────────── */}
      {showWizard && (
        <TasteWizard
          onComplete={handleWizardComplete}
          onClose={() => setShowWizard(false)}
        />
      )}
    </div>
  );
}
