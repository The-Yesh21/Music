import React from 'react';
import './ThemeToggle.css';

export default function ThemeToggle({ theme, toggleTheme }) {
  // If theme is 'light', the checkbox is checked, showing the Sun (day mode).
  return (
    <div className="toggleWrapper">
      <input 
        className="input" 
        id="dn" 
        type="checkbox" 
        checked={theme === 'light'} 
        onChange={toggleTheme} 
      />
      <label className="toggle" htmlFor="dn">
        <span className="toggle__handler">
          <span className="crater crater--1"></span>
          <span className="crater crater--2"></span>
          <span className="crater crater--3"></span>
        </span>
        <span className="star star--1"></span>
        <span className="star star--2"></span>
        <span className="star star--3"></span>
        <span className="star star--4"></span>
        <span className="star star--5"></span>
        <span className="star star--6"></span>
      </label>
    </div>
  );
}
