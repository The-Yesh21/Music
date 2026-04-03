import React, { useState } from 'react';
import { loadGroqKey, saveGroqKey, loadLastFmKey, saveLastFmKey } from '../services/StorageService';

export default function SettingsModal({ onClose }) {
  const [groqKey, setGroqKey] = useState(loadGroqKey() || '');
  const [lastFmKey, setLastFmKey] = useState(loadLastFmKey() || '');

  const handleSave = () => {
    saveGroqKey(groqKey.trim());
    saveLastFmKey(lastFmKey.trim());
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
      padding: 24
    }}>
      <div className="fade-in" style={{
        background: 'var(--bg-dark)',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '32px',
        borderRadius: '24px',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.8)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 24, fontWeight: 800 }}>Configuration</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 20 }}>
            <i className="fas fa-times" />
          </button>
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Groq API Key (AI AI)
          </label>
          <input 
            type="password" 
            placeholder="gsk_..."
            value={groqKey}
            onChange={(e) => setGroqKey(e.target.value)}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 16, outline: 'none'
            }}
          />
        </div>

        <div style={{ marginBottom: 32 }}>
          <label style={{ display: 'block', color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>
            Last.fm API Key (Radio Alg)
          </label>
          <input 
            type="password" 
            placeholder="32-character key"
            value={lastFmKey}
            onChange={(e) => setLastFmKey(e.target.value)}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: 16, outline: 'none'
            }}
          />
        </div>

        <button 
          className="pressable"
          onClick={handleSave}
          style={{
            width: '100%',
            background: 'var(--accent-gradient)',
            border: 'none',
            padding: '16px',
            color: '#fff',
            fontSize: 16,
            fontWeight: 700,
            borderRadius: 12,
            cursor: 'pointer',
            boxShadow: '0 8px 24px var(--accent-glow)'
          }}
        >
          Save Details
        </button>
      </div>
    </div>
  );
}
