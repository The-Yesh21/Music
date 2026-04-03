import React, { useState } from 'react';
import HomeScreen from './screens/HomeScreen';
import LibraryScreen from './screens/LibraryScreen';
import PlayerScreen from './screens/PlayerScreen';
import InsightsScreen from './screens/InsightsScreen';
import MiniPlayer from './components/MiniPlayer';
import AIChatPanel from './components/AIChatPanel';
import { useMusic } from './context/MusicContext';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [showPlayer, setShowPlayer] = useState(false);
  const { state } = useMusic();

  const renderScreen = () => {
    switch (activeTab) {
      case 'home': return <HomeScreen onNavigate={setActiveTab} />;
      case 'library': return <LibraryScreen />;
      case 'insights': return <InsightsScreen />;
      default: return <HomeScreen onNavigate={setActiveTab} />;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', position: 'relative' }}>
      
      {/* Desktop Wrapper: Sidebar Left, Content Right */}
      <div style={{ display: 'flex', flex: 1, flexDirection: 'row', overflow: 'hidden' }}>
        
        {/* Tab Bar / Sidebar */}
        <div className="tab-bar">
          <div style={{ padding: '0 16px 32px', display: 'none' }} className="desktop-only-logo">
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
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1, position: 'relative', overflowY: 'auto', paddingBottom: state.currentSong ? 100 : 0 }}>
          {renderScreen()}
        </div>
      </div>

      {/* MiniPlayer Dock */}
      {state.currentSong && (
        <div className="mini-player-container" style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60 }}>
          <MiniPlayer onPress={() => setShowPlayer(true)} />
        </div>
      )}

      {showPlayer && <PlayerScreen onClose={() => setShowPlayer(false)} />}

      <AIChatPanel />
    </div>
  );
}
