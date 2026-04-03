import { loadGeminiKey } from './StorageService';

export const getGeminiRecommendations = async (seedSong, seedArtist) => {
  try {
    const key = loadGeminiKey();
    if (!key) {
      console.warn('Gemini AI Key is missing. Fallback to native suggestions.');
      return [];
    }

    const systemPrompt = `You are an expert Music Producer and DJ AI. 
The user is listening to a seed track. You must return EXACTLY 15 highly accurate song recommendations that perfectly match the genre, tempo, mood, and acoustic vibe of the seed track.
Your response MUST be exclusively a raw, complete JSON array of strings in the exact format: ["Song Name - Artist Name", "Song Name - Artist Name"].`;

    const userPrompt = `Seed Track: "${seedSong}" by "${seedArtist}"`;

    const payload = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        role: "user",
        parts: [{ text: userPrompt }]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.7,
      }
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      console.error('Gemini API Error:', response.statusText);
      return [];
    }

    const data = await response.json();
    const rawText = data.candidates[0].content.parts[0].text;
    
    const queries = JSON.parse(rawText);
    
    if (Array.isArray(queries)) {
      return queries;
    }
    
    return [];

  } catch (error) {
    console.error('Gemini Bridge Execution Error:', error);
    return [];
  }
};
