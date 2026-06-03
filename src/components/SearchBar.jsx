import React, { useState } from 'react';

export default function SearchBar({ onSearch }) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleChange = (e) => {
    setQuery(e.target.value);
    if (onSearch) onSearch(e.target.value);
  };

  return (
    <div className={`search-bar-sticky ${isFocused ? 'focused' : ''}`}>
      <i className="fas fa-search search-icon" />
      <input
        type="text"
        placeholder="Search songs, artists, albums..."
        value={query}
        onChange={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        className="search-input"
        aria-label="Search"
      />
    </div>
  );
}
