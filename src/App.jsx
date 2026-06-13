import React, { useState, useEffect } from 'react';
import HomeScreen from './screens/HomeScreen';
import LibraryScreen from './screens/LibraryScreen';
import PlayerScreen from './screens/PlayerScreen';
import InsightsScreen from './screens/InsightsScreen';
import LandingScreen from './screens/LandingScreen';
import Sidebar from './components/Sidebar';
import PlayerBar from './components/PlayerBar';
import Queue from './components/Queue';
import AIChatPanel from './components/AIChatPanel';
import SettingsModal from './components/SettingsModal';
import { useMusic } from './context/MusicContext';
import MLTasteTreeScreen from './screens/MLTasteTreeScreen';
import { audioEngine } from './services/audioEngine';

export default function App() {
  const [activeTab, setActiveTab] = useState('landing');
  const [showPlayer, setShowPlayer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const { state } = useMusic();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    handleResize(); // Sync immediately on mount
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const unlock = () => audioEngine.resume();
    document.addEventListener('click', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
  }, []);

  useEffect(() => {
    const hasVisited = localStorage.getItem('hasVisitedEchoTune');
    if (hasVisited) {
      setActiveTab('home');
    }
    
    // Request notification permission for background playback on Android
    if (typeof Notification !== 'undefined' && Notification.requestPermission) {
      Notification.requestPermission().catch(err => {
        console.warn('Notification permission request failed:', err);
      });
    }
  }, []);

  const renderScreen = () => {
    switch (activeTab) {
      case 'landing': return <LandingScreen onGetStarted={() => setActiveTab('home')} />;
      case 'home': return <HomeScreen onNavigate={setActiveTab} />;
      case 'library': return <LibraryScreen />;
      case 'insights': return <InsightsScreen />;
      case 'taste-tree': return <MLTasteTreeScreen />;
      default: return <HomeScreen onNavigate={setActiveTab} />;
    }
  };

  if (activeTab === 'landing') {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100%', background: 'var(--bg-dark)' }}>
        {renderScreen()}
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Sidebar on desktop / Tab Bar on mobile */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} setShowSettings={setShowSettings} />

      {/* Main Content Area */}
      <div className="app-main-content">
        <div className="app-screen-area">
          {renderScreen()}
        </div>

        {/* PlayerBar - bottom fixed player bar */}
        {state.currentSong && (
          <PlayerBar 
            onToggleQueue={() => setShowQueue(!showQueue)} 
            showQueue={showQueue} 
            onPress={() => setShowPlayer(true)}
          />
        )}
        
        <AIChatPanel />
      </div>

      {/* Queue panel on the right side of App layout on desktop */}
      {showQueue && !isMobile && <Queue />}

      {/* Queue bottom sheet on mobile */}
      {showQueue && isMobile && (
        <Queue onClose={() => setShowQueue(false)} />
      )}

      {showPlayer && <PlayerScreen onClose={() => setShowPlayer(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}
