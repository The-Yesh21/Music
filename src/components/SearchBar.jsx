import React, { useState } from 'react';

export default function SearchBar({ onSearch }) {
  const [query, setQuery] = useState('');

  const handleChange = (e) => {
    setQuery(e.target.value);
    if (onSearch) onSearch(e.target.value);
  };

  return (
    <div style={{ position: 'relative', marginBottom: 20 }}>
      <i className="fas fa-search" style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', color: '#56567A' }} />
      <input
        type="text"
        placeholder="Search songs, artists..."
        value={query}
        onChange={handleChange}
        style={{
          width: '100%',
          padding: '14px 16px 14px 44px',
          borderRadius: 14,
          background: 'var(--glass)',
          border: '1px solid var(--border-light)',
          color: '#fff',
          outline: 'none',
          fontSize: 16,
          transition: 'border-color 0.3s, background 0.3s, box-shadow 0.3s',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,107,53,0.4)';
          e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
          e.currentTarget.style.boxShadow = '0 0 20px rgba(255,107,53,0.1)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--border-light)';
          e.currentTarget.style.background = 'var(--glass)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
    </div>
  );
}
