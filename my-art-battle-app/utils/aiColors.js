// utils/aiColors.js
// Handles calling the GROQ LLM API for color suggestions
const fetch = require('node-fetch');

const API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant'; // Free, production Groq model

function buildSystemPrompt(drawingPrompt, currentPalette) {
  return `You are a professional color analyst and palette designer. Given the drawing subject: "${drawingPrompt}", and the current palette: ${Array.isArray(currentPalette) ? JSON.stringify(currentPalette) : '[unknown]'}, generate exactly 5 distinct, visually harmonious hex color codes that best fit the prompt and subject. Only change colors the user specifies (by index or description), keep others the same. If the user does not specify any color, generate a completely new harmonious palette. Output ONLY a JSON array of 5 hex codes, e.g. ["#FF5733", "#123456", ...]. Do not include any explanations or extra text.`;
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
