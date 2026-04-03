import React, { useEffect, useState } from 'react';

export default function LandingScreen({ onGetStarted }) {
  const [mounted, setMounted] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleStart = () => {
    setIsExiting(true);
    // Let the exit animation play out before switching
    setTimeout(() => {
      localStorage.setItem('hasVisitedEchoTune', 'true');
      onGetStarted();
    }, 850);
  };

  return (
    <div className={isExiting ? 'landing-exit' : ''} style={{
      flex: 1,
      height: '100vh',
      width: '100vw',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-dark)',
      position: 'relative',
      overflow: 'hidden',
      color: '#fff'
    }}>
      
      {/* ── Dynamic Nebula Background ────────────────── */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '-10%',
        width: '70%',
        height: '70%',
        background: 'radial-gradient(circle, rgba(255,107,53,0.12) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(80px)',
        animation: 'nebulaMove1 12s ease-in-out infinite alternate',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        bottom: '-20%',
        right: '-10%',
        width: '60%',
        height: '60%',
        background: 'radial-gradient(circle, rgba(199,125,255,0.1) 0%, transparent 70%)',
        borderRadius: '50%',
        filter: 'blur(100px)',
        animation: 'nebulaMove2 15s ease-in-out infinite alternate-reverse',
        pointerEvents: 'none'
      }} />
      <div style={{
        position: 'absolute',
        top: '40%',
        left: '20%',
        width: '30%',
        height: '30%',
        background: 'radial-gradient(circle, rgba(255,255,255,0.03) 0%, transparent 60%)',
        borderRadius: '50%',
        filter: 'blur(50px)',
        pointerEvents: 'none'
      }} />

      {/* ── Main Content Container ──────────────────── */}
      <div style={{
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '0 24px'
      }}>
        
        {/* Animated Icon */}
        <div className="text-reveal-stagger" style={{ 
          animationDelay: '0.2s',
          marginBottom: '32px'
        }}>
          <div style={{
            width: '88px',
            height: '88px',
            borderRadius: '28px',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 12px 30px rgba(255,107,53,0.3)',
            transform: 'rotate(-5deg)'
          }}>
            <i className="fas fa-headphones-simple" style={{ fontSize: '38px', color: '#fff' }} />
          </div>
        </div>

        {/* Welcome Text with Staggered Reveal */}
        <div style={{ marginBottom: '24px' }}>
          <h2 className="text-reveal-stagger" style={{ 
            fontSize: '18px', 
            fontWeight: 700, 
            textTransform: 'uppercase', 
            letterSpacing: '4px',
            color: 'rgba(255,255,255,0.5)',
            marginBottom: '12px',
            animationDelay: '0.4s'
          }}>
            Experience the Future
          </h2>
          
          <h1 style={{ lineHeight: '1.1' }}>
            <span className="text-reveal-stagger" style={{ 
                display: 'block',
                fontSize: '42px', 
                fontWeight: 300,
                animationDelay: '0.6s'
            }}>
              Welcome to
            </span>
            <span className="text-reveal-stagger shimmer-active" style={{ 
                fontSize: '72px', 
                fontWeight: 900,
                letterSpacing: '-2px',
                marginTop: '4px',
                animationDelay: '0.9s'
            }}>
              EchoTune
            </span>
          </h1>
        </div>

        <p className="text-reveal-stagger" style={{
          fontSize: '17px',
          color: 'rgba(255,255,255,0.6)',
          maxWidth: '380px',
          marginBottom: '48px',
          lineHeight: '1.6',
          animationDelay: '1.3s'
        }}>
          Your personal AI-curated sound interface. Seamless, high-fidelity, and infinitely yours.
        </p>

        {/* CTA Button */}
        <div className="text-reveal-stagger" style={{ animationDelay: '1.6s', width: '100%', maxWidth: '280px' }}>
          <button 
            className="pressable"
            onClick={handleStart}
            style={{ 
              width: '100%',
              background: 'var(--accent-gradient)',
              color: '#fff',
              fontSize: '18px',
              fontWeight: 700,
              padding: '18px 0',
              borderRadius: '16px',
              boxShadow: '0 8px 25px var(--accent-glow)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px'
            }}
          >
            Launch Experience
            <i className="fas fa-arrow-right" style={{ fontSize: '14px' }} />
          </button>
        </div>
      </div>

      {/* Decorative footer text */}
      <div className="text-reveal-stagger" style={{ 
        position: 'absolute', 
        bottom: '40px',
        fontSize: '12px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '2px',
        color: 'rgba(255,255,255,0.2)',
        animationDelay: '2s'
      }}>
        Powered by Groq & Last.fm
      </div>

    </div>
  );
}
