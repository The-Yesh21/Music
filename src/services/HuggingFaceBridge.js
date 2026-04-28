import { loadHuggingFaceKey } from './StorageService';

// Hugging Face Inference API Bridge for Gemma-2-2b
// Provides music recommendations using open-source LLM

const HF_API_URL = 'https://api-inference.huggingface.co/models/google/gemma-2-2b';

export const getHuggingFaceRecommendations = async (seedSong, seedArtist) => {
  try {
    const token = loadHuggingFaceKey();
    if (!token) {
      console.warn('Hugging Face token is missing. Skipping HF recommendations.');
      return [];
    }

    const systemPrompt = `You are an expert Music Curator AI. Your task is to recommend songs similar to the user's current track.

Rules:
1. Recommend EXACTLY 15 songs that match the genre, mood, tempo, and style of the seed track
2. Return ONLY a JSON array in this exact format: ["Song Name - Artist Name", "Song Name - Artist Name"]
3. No explanations, no markdown, no extra text - only the JSON array
4. Ensure all recommendations are real songs from real artists
5. Prioritize songs from the same genre and similar era

Example response: ["Blinding Lights - The Weeknd", "Save Your Tears - The Weeknd", "Levitating - Dua Lipa"]`;

    const userPrompt = `Seed Track: "${seedSong}" by "${seedArtist}"

Provide 15 similar song recommendations as a JSON array.`;

    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: `${systemPrompt}\n\n${userPrompt}`,
        parameters: {
          max_new_tokens: 500,
          temperature: 0.7,
          return_full_text: false,
          stop: ["\n\n", "```"]
        }
      })
    });

    if (!response.ok) {
      // Model might be loading (HF free tier behavior)
      if (response.status === 503) {
        console.warn('Hugging Face model is loading. Retry in a few seconds.');
        return [];
      }
      console.error('Hugging Face API Error:', response.statusText);
      return [];
    }

    const data = await response.json();
    
    // HF returns array of generation results
    let rawText = '';
    if (Array.isArray(data) && data.length > 0) {
      rawText = data[0].generated_text || '';
    } else if (data.generated_text) {
      rawText = data.generated_text;
    }

    // Clean up the response
    rawText = rawText.trim();
    
    // Extract JSON array from response (handle various formats)
    let jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      // Try to find array-like content
      jsonMatch = rawText.match(/\[.*\]/s);
    }
    
    if (jsonMatch) {
      const queries = JSON.parse(jsonMatch[0]);
      if (Array.isArray(queries)) {
        return queries.slice(0, 15);
      }
    }

    return [];

  } catch (error) {
    console.error('Hugging Face Bridge Execution Error:', error);
    return [];
  }
};

// Alternative: Use HF's serverless inference with specific model endpoints
export const getHuggingFaceRecommendationsV2 = async (seedSong, seedArtist) => {
  try {
    const token = loadHuggingFaceKey();
    if (!token) return [];

    // Use text-generation-inference format
    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: `<start_of_turn>user
Recommend 15 songs similar to "${seedSong}" by ${seedArtist}. Same genre and vibe. Return as JSON array: ["Song - Artist", ...]
<end_of_turn>
<start_of_turn>model
`,
        parameters: {
          max_new_tokens: 400,
          temperature: 0.6,
          top_p: 0.9,
          return_full_text: false
        }
      })
    });

    if (!response.ok) return [];

    const data = await response.json();
    const rawText = Array.isArray(data) ? data[0]?.generated_text : data.generated_text;
    
    if (!rawText) return [];

    // Extract JSON array
    const jsonMatch = rawText.match(/\[[\s\S]*?\]/);
    if (jsonMatch) {
      const queries = JSON.parse(jsonMatch[0]);
      if (Array.isArray(queries)) return queries.slice(0, 15);
    }

    return [];
  } catch (error) {
    console.error('Hugging Face V2 Error:', error);
    return [];
  }
};
