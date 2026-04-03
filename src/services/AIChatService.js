import { loadGroqKey } from './StorageService';

export const processAIQuery = async (userMessage) => {
  try {
    const key = loadGroqKey();
    if (!key) {
      throw new Error("API_KEY_MISSING");
    }

    const systemPrompt = `You are an AI DJ for a music streaming app.
Your goal is to return EXACTLY 5 highly accurate song search queries that match the user's request.
Your response MUST be exclusively a raw, complete JSON array of strings in the exact format: ["Song Name - Artist Name", "Song Name - Artist Name"]. Do not include any conversational text.`;

    const payload = {
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],
      temperature: 0.7,
      max_completion_tokens: 1024,
      top_p: 1,
      stream: false
    };

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Groq API Error details:', errText);
      throw new Error(`API_ERROR: ${response.status}`);
    }

    const data = await response.json();
    let rawText = data.choices[0].message.content;
    
    // Clean up potential markdown formatting that blocks JSON parsing
    rawText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    const queries = JSON.parse(rawText);
    
    if (queries && Array.isArray(queries.queries)) {
       return queries.queries;
    }
    
    if (Array.isArray(queries)) {
      return queries;
    }
    
    return [];

  } catch (error) {
    if (error.message === "API_KEY_MISSING") {
        throw error;
    }
    console.error('AIChatService Execution Error:', error);
    throw error;
  }
};
