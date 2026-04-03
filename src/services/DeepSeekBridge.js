import { loadDeepSeekKey } from './StorageService';

export const getDeepSeekRecommendations = async (seedSong, seedArtist) => {
  try {
    const key = loadDeepSeekKey();
    if (!key) {
      console.warn('DeepSeek AI Key is missing. Fallback to native suggestions.');
      return [];
    }

    const systemPrompt = `You are an expert Music Producer and DJ AI. 
The user is listening to a seed track. You must return EXACTLY 15 highly accurate song recommendations that perfectly match the genre, tempo, mood, and acoustic vibe of the seed track.
Your response MUST be ONLY a raw, complete JSON array of strings in the exact format: ["Song Name - Artist Name", "Song Name - Artist Name"].
Do not include markdown tags (\`\`\`json). Do not include any text, explanations, or dialogue outside of the JSON array.`;

    const userPrompt = `Seed Track: "${seedSong}" by "${seedArtist}"`;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      console.error('DeepSeek API Error:', response.statusText);
      return [];
    }

    const data = await response.json();
    let rawText = data.choices[0].message.content.trim();
    
    // Strip markdown JSON block if the LLM forcefully injects it
    if (rawText.startsWith('```json')) {
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    } else if (rawText.startsWith('```')) {
      rawText = rawText.replace(/```/g, '').trim();
    }

    const queries = JSON.parse(rawText);
    
    if (Array.isArray(queries)) {
      return queries;
    }
    
    return [];

  } catch (error) {
    console.error('DeepSeek Bridge Execution Error:', error);
    return [];
  }
};
