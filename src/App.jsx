import React, { useState, useEffect } from 'react';
import HomeScreen from './screens/HomeScreen';
import LibraryScreen from './screens/LibraryScreen';
import PlayerScreen from './screens/PlayerScreen';
import InsightsScreen from './screens/InsightsScreen';
import LandingScreen from './screens/LandingScreen';
import MiniPlayer from './components/MiniPlayer';
import AIChatPanel from './components/AIChatPanel';
import SettingsModal from './components/SettingsModal';
import { useMusic } from './context/MusicContext';

export default function App() {
  const [activeTab, setActiveTab] = useState('landing');
  const [showPlayer, setShowPlayer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { state } = useMusic();

  useEffect(() => {
    const hasVisited = localStorage.getItem('hasVisitedEchoTune');
    if (hasVisited) {
      setActiveTab('home');
    }
  }, []);

  const renderScreen = () => {
    switch (activeTab) {
      case 'landing': return <LandingScreen onGetStarted={() => setActiveTab('home')} />;
      case 'home': return <HomeScreen onNavigate={setActiveTab} />;
      case 'library': return <LibraryScreen />;
      case 'insights': return <InsightsScreen />;
      default: return <HomeScreen onNavigate={setActiveTab} />;
    }
  };

  if (activeTab === 'landing') {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', background: 'var(--bg-dark)' }}>
        {renderScreen()}
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Main Content Area */}
      <div className="app-main-content">
        <div className="app-screen-area">
          {renderScreen()}
        </div>

        {/* MiniPlayer Dock - sits naturally at the bottom of the content area */}
        {state.currentSong && (
          <div className="mini-player-container">
            <MiniPlayer onPress={() => setShowPlayer(true)} />
          </div>
        )}
        
        <AIChatPanel />
      </div>

      {/* Tab Bar / Sidebar */}
      <div className="tab-bar">
        <div className="desktop-only-logo">
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', color: 'transparent' }}>EchoTune</h1>
        </div>
        <div className={`tab-item ${activeTab === 'home' ? 'active' : ''}`} onClick={() => setActiveTab('home')}>
          <i className="fas fa-house" />
          <span>Home</span>
        </div>
        <div className={`tab-item ${activeTab === 'library' ? 'active' : ''}`} onClick={() => setActiveTab('library')}>
          <i className="fas fa-search" />
          <span>Search</span>
        </div>
        <div className={`tab-item ${activeTab === 'insights' ? 'active' : ''}`} onClick={() => setActiveTab('insights')}>
          <i className="fas fa-chart-line" />
          <span>Insights</span>
        </div>
        <div style={{ flex: 1 }} className="desktop-flex-spacer"></div>
        <div className="tab-item" onClick={() => setShowSettings(true)}>
          <i className="fas fa-gear" />
          <span>Config</span>
        </div>
      </div>

      {showPlayer && <PlayerScreen onClose={() => setShowPlayer(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
