import React, { useState, useEffect, useMemo } from 'react';
import { useMusic } from '../context/MusicContext';
import { buildDecisionTree, computePredictionTree, getMLUserState, getMLTreeRecommendations } from '../services/MLTreeEngine';
import SongCard from '../components/SongCard';

export default function MLTasteTreeScreen() {
  const { playSong, state } = useMusic();
  const [tree, setTree] = useState(null);
  const [userState, setUserState] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [activePath, setActivePath] = useState([]);

  // Load and update the ML prediction tree dynamically when play history, skips, or favorites change
  useEffect(() => {
    const rawTree = buildDecisionTree();
    const computed = computePredictionTree(rawTree);
    setTree(computed);
    setUserState(getMLUserState());
    setPredictions(getMLTreeRecommendations(10));
  }, [state.history, state.favorites, state.dislikes]);

  // Compute active predicted path down the tree
  useEffect(() => {
    if (!tree) return;
    const path = ['root'];
    
    let current = tree;
    while (current && current.children) {
      // Find child with highest confidence score
      const sorted = [...current.children].sort((a, b) => b.confidence - a.confidence);
      if (sorted.length > 0 && sorted[0].confidence > 25) {
        path.push(sorted[0].id);
        current = sorted[0];
      } else {
        break;
      }
    }
    setActivePath(path);
    
    // Automatically select the leaf node in the predicted path by default
    if (path.length > 0 && !selectedNode) {
      const leafId = path[path.length - 1];
      const findNode = (n) => {
        if (n.id === leafId) return n;
        if (n.children) {
          for (let child of n.children) {
            const found = findNode(child);
            if (found) return found;
          }
        }
        return null;
      };
      const activeLeaf = findNode(tree);
      if (activeLeaf) setSelectedNode(activeLeaf);
    }
  }, [tree, selectedNode]);

  const handlePlayNodeSongs = (node) => {
    if (node && node.songs && node.songs.length > 0) {
      // Convert node songs to format context expects if they aren't already
      playSong(node.songs[0], node.songs);
    }
  };

  // Helper to render tree nodes recursively
  const renderTreeNode = (node, depth = 0) => {
    if (!node) return null;

    const isLeaf = node.type === 'leaf';
    const isActive = activePath.includes(node.id);
    const isSelected = selectedNode?.id === node.id;

    return (
      <div 
        key={node.id} 
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flex: 1,
          minWidth: isLeaf ? '140px' : '220px',
          margin: '0 8px',
          position: 'relative'
        }}
      >
        {/* Node Box */}
        <div 
          onClick={() => setSelectedNode(node)}
          style={{
            width: '100%',
            background: isSelected 
              ? 'linear-gradient(135deg, rgba(255,107,53,0.15), rgba(199,125,255,0.1))'
              : 'rgba(20, 20, 38, 0.4)',
            border: isSelected
              ? '2px solid var(--accent)'
              : isActive
                ? '1px dashed rgba(199, 125, 255, 0.6)'
                : '1px solid rgba(255,255,255,0.06)',
            borderRadius: '16px',
            padding: '16px',
            cursor: 'pointer',
            textAlign: 'center',
            backdropFilter: 'blur(10px)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: isActive 
              ? '0 0 25px rgba(199, 125, 255, 0.15)' 
              : '0 4px 12px rgba(0,0,0,0.2)',
            transform: isSelected ? 'scale(1.03)' : 'scale(1)',
          }}
          onMouseEnter={(e) => {
            if (!isSelected) {
              e.currentTarget.style.borderColor = 'rgba(255,107,53,0.4)';
              e.currentTarget.style.boxShadow = '0 0 16px rgba(255,107,53,0.1)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isSelected) {
              e.currentTarget.style.borderColor = isActive ? 'rgba(199, 125, 255, 0.6)' : 'rgba(255,255,255,0.06)';
              e.currentTarget.style.boxShadow = isActive ? '0 0 25px rgba(199, 125, 255, 0.15)' : 'none';
            }
          }}
        >
          {/* Active predictor beacon */}
          {isActive && (
            <div style={{
              position: 'absolute',
              top: '-6px',
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'var(--accent-gradient)',
              color: '#fff',
              fontSize: '9px',
              fontWeight: 800,
              padding: '2px 8px',
              borderRadius: '99px',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              boxShadow: '0 0 10px var(--accent-glow)'
            }}>
              Active Vibe
            </div>
          )}

          <div style={{ fontSize: isLeaf ? '20px' : '24px', marginBottom: '8px' }}>
            {isLeaf ? '🍃' : depth === 0 ? '🌳' : '🌿'}
          </div>

          <h4 style={{ 
            fontSize: '14px', 
            fontWeight: 700, 
            color: isSelected ? '#fff' : 'rgba(255,255,255,0.9)',
            marginBottom: '4px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {node.name}
          </h4>

          {node.feature && (
            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Split: <span style={{ fontWeight: 600, color: 'var(--accent-secondary)' }}>{node.feature}</span>
            </div>
          )}

          {/* Confidence Slider / Match Score */}
          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginBottom: '4px' }}>
              <span>Match Confidence</span>
              <span style={{ fontWeight: 700, color: node.confidence > 70 ? 'var(--accent-light)' : 'var(--text-secondary)' }}>
                {node.confidence}%
              </span>
            </div>
            <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ 
                width: `${node.confidence}%`, 
                height: '100%', 
                background: isActive ? 'var(--accent-gradient)' : 'rgba(255,255,255,0.2)',
                borderRadius: '2px',
                transition: 'width 0.5s ease-out'
              }} />
            </div>
          </div>
        </div>

        {/* Connectors & Children */}
        {node.children && node.children.length > 0 && (
          <div style={{ display: 'flex', width: '100%', marginTop: '24px', position: 'relative' }}>
            {/* Horizontal connection line */}
            <div style={{
              position: 'absolute',
              top: '-12px',
              left: '25%',
              right: '25%',
              height: '1px',
              background: 'rgba(255,255,255,0.1)'
            }} />
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="screen fade-in" style={{ padding: '40px 20px 100px', overflowX: 'hidden' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 800 }}>Taste Tree Model</h1>
          <p className="gradient-text" style={{ fontWeight: 700, marginTop: '4px', fontSize: '15px' }}>
            Hierarchical ML Decision Tree Mapping Your 200 Top Songs
          </p>
        </div>
        <div style={{
          background: 'rgba(255,107,53,0.1)',
          border: '1px solid rgba(255,107,53,0.2)',
          padding: '8px 16px',
          borderRadius: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <i className="fas fa-brain" style={{ color: 'var(--accent)', fontSize: '16px' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-light)' }}>Tree Model Active</span>
        </div>
      </div>

      {/* User ML State Summary */}
      {userState && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
          background: 'var(--glass)',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          padding: '20px'
        }}>
          <div>
            <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: '4px' }}>
              Tempo EMA
            </span>
            <span style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>
              {Math.round(userState.averageBpm)} <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>BPM</span>
            </span>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: '4px' }}>
              Active Play / Skip Ratio
            </span>
            <span style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>
              {Object.values(userState.playCounts).reduce((a, b) => a + b, 0)}
              <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}> plays</span> / {Object.values(userState.skipCounts).reduce((a, b) => a + b, 0)}
              <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}> skips</span>
            </span>
          </div>
          <div>
            <span style={{ display: 'block', fontSize: '11px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: '4px' }}>
              Active Tree Leaf
            </span>
            <span style={{ fontSize: '15px', fontWeight: 800, color: 'var(--accent-light)', display: 'block', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '240px' }}>
              {selectedNode ? selectedNode.name : 'Resolving Vibe...'}
            </span>
          </div>
        </div>
      )}

      {/* Interactive Tree Visualizer */}
      <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '16px' }}>Decision Split View</h2>
      <div 
        className="taste-tree-scroll"
        style={{
          width: '100%',
          overflowX: 'auto',
          padding: '24px 0',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.03)',
          marginBottom: '40px',
          display: 'flex',
          justifyContent: 'flex-start'
        }}
      >
        <div style={{ display: 'inline-flex', padding: '0 40px' }}>
          {tree ? renderTreeNode(tree) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}>
              <i className="fas fa-circle-notch fa-spin" /> Fitting decision tree splits...
            </div>
          )}
        </div>
      </div>

      {/* Selected Node / Playlist Grid */}
      {selectedNode && (
        <div style={{
          background: 'var(--glass)',
          border: '1px solid var(--border)',
          borderRadius: '24px',
          padding: '24px',
          marginBottom: '40px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#fff' }}>
                <span style={{ marginRight: '8px' }}>📁</span>
                {selectedNode.name}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Found {selectedNode.songs?.length || 0} classified matches, sorted by taste rating.
              </p>
            </div>
            {selectedNode.songs && selectedNode.songs.length > 0 && (
              <button 
                onClick={() => handlePlayNodeSongs(selectedNode)}
                style={{
                  background: 'var(--accent-gradient)',
                  color: '#fff',
                  border: 'none',
                  padding: '12px 24px',
                  borderRadius: '14px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 16px var(--accent-glow)'
                }}
              >
                <i className="fas fa-play" />
                Play Node Playlist
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
            {selectedNode.songs && selectedNode.songs.length > 0 ? (
              selectedNode.songs.slice(0, 12).map((song) => (
                <SongCard 
                  key={song.id} 
                  song={song} 
                  onPress={() => playSong(song, selectedNode.songs)} 
                />
              ))
            ) : (
              <div style={{ padding: '20px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                No songs clustered under this branch yet.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Model Output: Continuous Live Predictions */}
      <div>
        <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#fff', marginBottom: '16px' }}>
          🎯 Live Top predictions
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {predictions.map((song) => (
            <SongCard 
              key={song.id} 
              song={song} 
              onPress={() => playSong(song, predictions)} 
            />
          ))}
        </div>
      </div>

    </div>
  );
}
