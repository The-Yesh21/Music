import React, { useEffect, useState } from 'react';

export default function LandingScreen({ onGetStarted }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleStart = () => {
    localStorage.setItem('hasVisitedEchoTune', 'true');
    onGetStarted();
  };

  return (
    <div style={{
      flex: 1,
      height: '100%',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      background: 'radial-gradient(circle at 50% -20%, rgba(255,107,53,0.15) 0%, var(--bg-dark) 80%)',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background decorations */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '-10%',
        width: '300px',
        height: '300px',
        background: 'radial-gradient(circle, rgba(199,125,255,0.08) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(40px)'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-10%',
        right: '-10%',
        width: '400px',
        height: '400px',
        background: 'radial-gradient(circle, rgba(255,107,53,0.08) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(40px)'
      }} />

      {/* Main Content */}
      <div style={{
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(20px)',
        transition: 'all 1s cubic-bezier(0.34, 1.56, 0.64, 1)'
      }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'var(--accent-gradient)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '32px',
          boxShadow: '0 0 40px var(--accent-glow)'
        }}>
          <i className="fas fa-headphones-simple" style={{ fontSize: '36px', color: '#fff' }} />
        </div>

        <h1 style={{
          fontSize: '48px',
          fontWeight: 900,
          color: '#fff',
          letterSpacing: '-1px',
          marginBottom: '16px',
          lineHeight: '1.1'
        }}>
          Welcome to <br />
          <span className="gradient-text">EchoTune</span>
        </h1>

        <p style={{
          fontSize: '16px',
          color: 'var(--text-secondary)',
          maxWidth: '320px',
          marginBottom: '48px',
          lineHeight: '1.6'
        }}>
          Experience a new dimension of music discovery powered by infinite AI radio algorithms.
        </p>

        <button 
          className="taste-btn-next pressable"
          onClick={handleStart}
          style={{ width: '100%', maxWidth: '280px', fontSize: '18px', padding: '18px 24px' }}
        >
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            Get Started
            <i className="fas fa-arrow-right" style={{ fontSize: '14px' }} />
          </span>
        </button>
      </div>

    </div>
  );
}
