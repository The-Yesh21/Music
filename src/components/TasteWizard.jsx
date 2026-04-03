import React, { useState, useCallback } from 'react';
import { saveTasteProfile } from '../services/TasteService';

// ─── Step Data ──────────────────────────────────────────────────────────────

const STEPS = [
  {
    key: 'artists',
    icon: '🎤',
    title: 'Who are your favorite artists?',
    subtitle: 'Type an artist name and hit enter. Add as many as you like!',
    type: 'tags',
    suggestions: ['Arijit Singh', 'The Weeknd', 'Taylor Swift', 'AR Rahman', 'Drake', 'Ed Sheeran', 'Dua Lipa', 'Pritam', 'Billie Eilish', 'Atif Aslam', 'BTS', 'Shreya Ghoshal'],
  },
  {
    key: 'genres',
    icon: '🎵',
    title: 'What genres do you vibe with?',
    subtitle: 'Pick all the genres that match your taste.',
    type: 'chips',
    options: ['Pop', 'Rock', 'Hip-Hop', 'R&B', 'Classical', 'Jazz', 'EDM', 'Indie', 'Bollywood', 'K-Pop', 'Metal', 'Country', 'Lo-Fi', 'Latin', 'Punjabi', 'Sufi', 'Carnatic', 'Reggaeton', 'Synthwave', 'Ambient'],
  },
  {
    key: 'instruments',
    icon: '🎸',
    title: 'Which instruments move you?',
    subtitle: 'Pick instruments whose sound you love hearing in music.',
    type: 'chips',
    options: ['Guitar', 'Piano', 'Violin', 'Drums', 'Flute', 'Sitar', 'Tabla', 'Saxophone', 'Synthesizer', 'Bass', 'Cello', 'Trumpet', 'Harmonica', 'Veena', 'Ukulele', 'Harp'],
  },
  {
    key: 'moods',
    icon: '🌙',
    title: 'What moods define your music?',
    subtitle: 'What vibe are you usually going for?',
    type: 'chips',
    options: ['Chill', 'Energetic', 'Melancholic', 'Romantic', 'Focus', 'Party', 'Workout', 'Peaceful', 'Dark', 'Euphoric', 'Nostalgic', 'Dreamy'],
  },
  {
    key: 'decades',
    icon: '📅',
    title: 'Favorite music eras?',
    subtitle: 'What decades had the best music for you?',
    type: 'chips',
    options: ['60s Classics', '70s Retro', '80s Synth', '90s Hits', '2000s Pop', '2010s Modern', '2020s Current'],
  },
  {
    key: 'languages',
    icon: '🌍',
    title: 'Preferred languages?',
    subtitle: 'What languages do you enjoy listening to in music?',
    type: 'chips',
    options: ['English', 'Hindi', 'Tamil', 'Telugu', 'Punjabi', 'Korean', 'Spanish', 'Japanese', 'Bengali', 'Kannada', 'Malayalam', 'Marathi', 'French', 'Arabic'],
  },
  {
    key: 'occasions',
    icon: '🎧',
    title: 'When do you listen to music?',
    subtitle: 'What occasions or activities go hand-in-hand with your music?',
    type: 'chips',
    options: ['Commute', 'Study', 'Workout', 'Cooking', 'Sleep', 'Road Trip', 'Party', 'Work', 'Morning Routine', 'Late Night', 'Meditation', 'Gaming'],
  },
];

// ─── Component ──────────────────────────────────────────────────────────────

export default function TasteWizard({ onComplete, onClose }) {
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState({
    artists: [],
    genres: [],
    instruments: [],
    moods: [],
    decades: [],
    languages: [],
    occasions: [],
  });
  const [tagInput, setTagInput] = useState('');

  const currentStep = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  // Toggle a chip selection
  const toggleChip = useCallback((key, value) => {
    setProfile((prev) => {
      const arr = prev[key] || [];
      if (arr.includes(value)) {
        return { ...prev, [key]: arr.filter((v) => v !== value) };
      }
      return { ...prev, [key]: [...arr, value] };
    });
  }, []);

  // Add a tag (for artist input)
  const addTag = useCallback(() => {
    const val = tagInput.trim();
    if (!val) return;
    setProfile((prev) => {
      if (prev.artists.includes(val)) return prev;
      return { ...prev, artists: [...prev.artists, val] };
    });
    setTagInput('');
  }, [tagInput]);

  const removeTag = useCallback((val) => {
    setProfile((prev) => ({
      ...prev,
      artists: prev.artists.filter((a) => a !== val),
    }));
  }, []);

  // Navigation
  const goNext = () => {
    if (isLastStep) {
      saveTasteProfile(profile);
      onComplete(profile);
    } else {
      setStep((s) => s + 1);
    }
  };

  const goBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <div className="taste-wizard-overlay">
      {/* Close Button */}
      <button className="taste-close" onClick={onClose}>
        <i className="fas fa-times" />
      </button>

      <div className="taste-wizard">
        {/* Progress Bar */}
        <div className="taste-progress">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`taste-progress-dot ${i < step ? 'done' : ''} ${i === step ? 'active' : ''}`}
            />
          ))}
        </div>

        {/* Step Content */}
        <div className="taste-step" key={step}>
          <div className="taste-step-icon">{currentStep.icon}</div>
          <h2>{currentStep.title}</h2>
          <p>{currentStep.subtitle}</p>

          {/* Tag Input (for Artists step) */}
          {currentStep.type === 'tags' && (
            <>
              <div className="taste-tag-input-wrap">
                <input
                  className="taste-tag-input"
                  type="text"
                  placeholder="Type an artist name..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                />
                <button className="taste-tag-add-btn" onClick={addTag}>
                  <i className="fas fa-plus" />
                </button>
              </div>

              {/* Existing tags */}
              {profile.artists.length > 0 && (
                <div className="taste-tags">
                  {profile.artists.map((artist) => (
                    <div key={artist} className="taste-tag">
                      {artist}
                      <button onClick={() => removeTag(artist)}>
                        <i className="fas fa-xmark" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick-pick suggestions */}
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 600, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Quick picks
                </div>
                <div className="taste-chips">
                  {currentStep.suggestions
                    .filter((s) => !profile.artists.includes(s))
                    .map((artist) => (
                      <div
                        key={artist}
                        className="taste-chip"
                        onClick={() => {
                          setProfile((prev) => ({
                            ...prev,
                            artists: [...prev.artists, artist],
                          }));
                        }}
                      >
                        <i className="fas fa-plus" style={{ fontSize: 10, opacity: 0.5 }} />
                        {artist}
                      </div>
                    ))}
                </div>
              </div>
            </>
          )}

          {/* Chip Selection */}
          {currentStep.type === 'chips' && (
            <div className="taste-chips">
              {currentStep.options.map((option) => {
                const isSelected = (profile[currentStep.key] || []).includes(option);
                return (
                  <div
                    key={option}
                    className={`taste-chip ${isSelected ? 'selected' : ''}`}
                    onClick={() => toggleChip(currentStep.key, option)}
                  >
                    <span className="chip-check">
                      <i className="fas fa-check" />
                    </span>
                    {option}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="taste-nav">
          {step > 0 ? (
            <button className="taste-btn taste-btn-skip" onClick={goBack}>
              <i className="fas fa-arrow-left" style={{ marginRight: 8 }} />
              Back
            </button>
          ) : (
            <button className="taste-btn taste-btn-skip" onClick={onClose}>
              Skip for now
            </button>
          )}
          <button
            className={`taste-btn ${isLastStep ? 'taste-btn-finish' : 'taste-btn-next'}`}
            onClick={goNext}
          >
            {isLastStep ? (
              <>
                <i className="fas fa-wand-magic-sparkles" style={{ marginRight: 8 }} />
                Generate My Playlist
              </>
            ) : (
              <>
                Next
                <i className="fas fa-arrow-right" style={{ marginLeft: 8 }} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
