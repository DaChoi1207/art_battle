// src/utils/stats.js
// Utility for updating stats via backend API

export async function updateStats({ userId, won }) {
  try {
    const res = await fetch('/api/update-stats', {
      method: 'POST',
      credentials: 'include',            // <-- include cookies so /profile works
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, won })
    });
    if (!res.ok) throw new Error('Failed to update stats');
    return await res.json();
  } catch (err) {
    console.error('Failed to update stats:', err);
    return null;
  }
}
