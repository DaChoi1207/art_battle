// src/utils/aiColorsClient.js
// Client helper to fetch AI colors from backend
export async function fetchAiColors({ prompt, drawingPrompt, currentPalette }) {
  const res = await fetch('/api/ai-colors', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, drawingPrompt, currentPalette })
  });
  if (!res.ok) throw new Error('AI color API error');
  const data = await res.json();
  return data.colors;
}
