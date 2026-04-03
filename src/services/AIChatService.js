import { loadGeminiKey } from './StorageService';

export const processAIQuery = async (userMessage) => {
  try {
    const key = loadGeminiKey();
    if (!key) {
      throw new Error("API_KEY_MISSING");
    }

    const systemPrompt = `You are an AI DJ for a music streaming app.
The user will ask you for music (e.g. "play some chill lo-fi", "I need workout songs", "play Taylor Swift").
Your goal is to return EXACTLY 5 highly accurate song search queries that match the user's request.
Your response MUST be exclusively a raw, complete JSON array of strings in the exact format: ["Song Name - Artist Name", "Song Name - Artist Name"].`;

    const payload = {
      systemInstruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [{
        role: "user",
        parts: [{ text: userMessage }]
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
      throw new Error("API_ERROR");
    }

    const data = await response.json();
    const rawText = data.candidates[0].content.parts[0].text;
    
    const queries = JSON.parse(rawText);
    
    if (Array.isArray(queries)) {
      return queries;
    }
    
    return [];

  } catch (error) {
    if (error.message === "API_KEY_MISSING") {
        throw error;
    }
    console.error('AIChatService Execution Error:', error);
    return [];
  }
};
