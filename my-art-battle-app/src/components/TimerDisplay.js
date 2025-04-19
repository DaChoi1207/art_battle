import React from 'react';

export default function TimerDisplay({ timeLeft, gameOver }) {
  return (
    <div className="text-lg font-semibold text-[#232136] bg-[#cddafd]/80 px-4 py-2 rounded-xl shadow">
      <span role="img" aria-label="timer">⏰</span>{' '}
      {gameOver ? (
        <span className="text-[#b80c09] font-extrabold animate-pulse">Game Over!</span>
      ) : (
        <span>{timeLeft != null ? `Time Remaining: ${timeLeft} sec` : ''}</span>
      )}
    </div>
  );
}
