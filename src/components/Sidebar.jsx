import React from 'react';

export default function Sidebar({ activeTab, setActiveTab, setShowSettings }) {
  return (
    <div className="tab-bar">
      <div className="desktop-only-logo">
        <h1 style={{ fontFamily: "'Playfair Display', serif", margin: 0, fontSize: 24, fontWeight: 900, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', color: 'transparent' }}>
          EchoTune
        </h1>
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
      
      <div className={`tab-item ${activeTab === 'taste-tree' ? 'active' : ''}`} onClick={() => setActiveTab('taste-tree')}>
        <i className="fas fa-network-wired" />
        <span>Taste Tree</span>
      </div>
      
      <div style={{ flex: 1 }} className="desktop-flex-spacer"></div>
      
      <div className="tab-item settings-tab" onClick={() => setShowSettings(true)}>
        <i className="fas fa-gear" />
        <span>Config</span>
      </div>
    </div>
  );
}
