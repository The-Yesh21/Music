import React, { useState, useRef, useEffect } from 'react';
import { useMusic } from '../context/MusicContext';
import { JioSaavnAPI } from '../services/JioSaavnAPI';
import { processAIQuery } from '../services/AIChatService';

export default function AIChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'bot', type: 'text', content: "Hi! I'm your AI DJ. What kind of music are you in the mood for?" }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const { playSong, state } = useMusic();

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessage = inputText.trim();
    setInputText('');
    setMessages(prev => [...prev, { role: 'user', type: 'text', content: userMessage }]);
    setIsTyping(true);

    try {
      const queries = await processAIQuery(userMessage);

      if (queries.length === 0) {
        setMessages(prev => [...prev, { role: 'bot', type: 'text', content: "I couldn't find anything matching that. Try describing it differently!" }]);
        setIsTyping(false);
        return;
      }

      // Fetch songs from JioSaavn for the queries
      const fetchPromises = queries.map(async (query) => {
        try {
          const results = await JioSaavnAPI.searchSongs(query);
          return results.length > 0 ? results[0] : null;
        } catch (e) {
          return null;
        }
      });

      const fetchedSongs = await Promise.all(fetchPromises);
      const validSongs = fetchedSongs.filter(s => s !== null);

      if (validSongs.length > 0) {
        setMessages(prev => [
            ...prev, 
            { role: 'bot', type: 'songs', content: "Here are some tracks I found for you:", songs: validSongs }
        ]);
      } else {
        setMessages(prev => [...prev, { role: 'bot', type: 'text', content: "I understood your request but couldn't find matching songs on JioSaavn right now." }]);
      }

    } catch (e) {
      if (e.message === "API_KEY_MISSING") {
        setMessages(prev => [...prev, { role: 'bot', type: 'text', content: "My Gemini API Key is missing. Please add it to your setup so I can help!" }]);
      } else {
        setMessages(prev => [...prev, { role: 'bot', type: 'text', content: "Oops, something went wrong on my end. Please try again." }]);
      }
    } finally {
      setIsTyping(false);
    }
  };

  const handlePlayAll = (songs) => {
    if (songs && songs.length > 0) {
      playSong(songs[0], songs);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <>
      <div 
        className={`ai-chat-overlay ${isOpen ? 'open' : ''}`}
        style={{
             bottom: state.currentSong ? 100 : 0
        }}
      >
        <div className="ai-chat-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="ai-avatar">
              <i className="fas fa-wand-magic-sparkles" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>AI DJ</h3>
            </div>
          </div>
          <button className="ai-close-btn" onClick={() => setIsOpen(false)}>
            <i className="fas fa-chevron-down" />
          </button>
        </div>

        <div className="ai-chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`ai-msg ${msg.role === 'user' ? 'ai-msg-user' : 'ai-msg-bot'}`}>
              {msg.type === 'text' && (
                <div className="ai-msg-bubble">{msg.content}</div>
              )}
              {msg.type === 'songs' && (
                <div className="ai-msg-bubble ai-msg-songs-container">
                  <div style={{ marginBottom: 12 }}>{msg.content}</div>
                  <div className="ai-song-results-scroll">
                    {msg.songs.map((song, sIdx) => (
                      <div key={sIdx} className="ai-song-result" onClick={() => playSong(song, msg.songs)}>
                        <img src={song.artwork} alt={song.title} />
                        <div className="ai-song-info">
                          <div className="ai-song-title">{song.title}</div>
                          <div className="ai-song-artist">{song.artist}</div>
                        </div>
                        <i className="fas fa-play ai-song-play-icon" />
                      </div>
                    ))}
                  </div>
                  <button className="ai-play-all-btn" onClick={() => handlePlayAll(msg.songs)}>
                     <i className="fas fa-play" style={{ marginRight: 6 }}/> Play All
                  </button>
                </div>
              )}
            </div>
          ))}
          {isTyping && (
            <div className="ai-msg ai-msg-bot">
              <div className="ai-msg-bubble ai-typing-indicator">
                <span className="dot"></span><span className="dot"></span><span className="dot"></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="ai-chat-input-container">
          <input 
            type="text" 
            className="ai-chat-input" 
            placeholder="E.g. Play some energetic workout songs..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
          />
          <button className="ai-send-btn" onClick={handleSend} disabled={!inputText.trim()}>
            <i className="fas fa-arrow-up" />
          </button>
        </div>
      </div>

      {!isOpen && (
        <button 
            className="ai-fab" 
            onClick={() => setIsOpen(true)}
            style={{
                bottom: state.currentSong ? 120 : 24
            }}
        >
          <i className="fas fa-wand-magic-sparkles" />
        </button>
      )}
    </>
  );
}
