// utils/aiColors.js
// Handles calling the GROQ LLM API for color suggestions
const fetch = require('node-fetch');

const API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant'; // Free, production Groq model

function buildSystemPrompt(drawingPrompt, currentPalette) {
  let base = `You are a professional colour picker. The user has a current palette: ${Array.isArray(currentPalette) ? JSON.stringify(currentPalette) : '[unknown]'}. The drawing subject is: ${drawingPrompt}. When the user gives a request, only change the colors they specify (by index or description), and keep all other colors the same. Always return a JSON array of 5 hex colors, e.g. ["#FF5733", "#123456", ...]. Do not explain your answer, just return the array.`;
  return base;
}

async function getColorsFromLLM({ userPrompt, drawingPrompt, currentPalette, apiKey }) {
  const systemPrompt = buildSystemPrompt(drawingPrompt, currentPalette);
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ];
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model: MODEL, messages })
  });
  if (!res.ok) throw new Error('GROQ API error: ' + (await res.text()));
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || '';
  console.log('[GROQ AI RAW CONTENT]', content);
  // Try to parse JSON array from LLM output
  try {
    const match = content.match(/\[.*\]/s);
    if (match) return JSON.parse(match[0]);
    return [];
  } catch {
    return [];
  }
}

module.exports = { getColorsFromLLM };
