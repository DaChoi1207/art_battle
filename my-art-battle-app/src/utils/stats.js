// src/utils/stats.js
// Utility for updating user stats (games played & won) via backend API

/**
 * Increment games_played for every user, and games_won if they won.
 * @param {{ userId: number|string, won: boolean }} params
 * @returns {Promise<boolean>} true if update succeeded, false otherwise
 */
export async function updateStats({ userId, won }) {
  try {
    const res = await fetch('/api/update-stats', {
      method: 'POST',
      credentials: 'include',            // include session cookie
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, won }),
    });
    if (!res.ok) {
      console.error('Stats update failed:', await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('Failed to update stats:', err);
    return false;
  }
}
