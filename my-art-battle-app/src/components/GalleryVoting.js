import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import socket from '../socket';

const PALETTE = [
  '#e63946', '#457b9d', '#f1faee', '#ffbe0b', '#8338ec', '#cddafd', '#bee1e6', '#b8c1ec'
];

function getRandomPaletteColor(idx) {
  return PALETTE[idx % PALETTE.length];
}

function Star({ filled, half, ...props }) {
  // SVG star with optional half fill
  if (half) {
    return (
      <svg viewBox="0 0 24 24" width={36} height={36} {...props}>
        <defs>
          <linearGradient id="half-star">
            <stop offset="50%" stopColor="#FFD700" />
            <stop offset="50%" stopColor="#e2ece9" />
          </linearGradient>
        </defs>
        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z" fill="url(#half-star)" stroke="#FFD700" strokeWidth="1.5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={36} height={36} {...props}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z" fill={filled ? '#FFD700' : '#e2ece9'} stroke="#FFD700" strokeWidth="1.5" />
    </svg>
  );
}


export default function GalleryVoting({ artworks, localUserId, onComplete }) {
  const artworkEntries = Object.entries(artworks).filter(([id]) => id !== localUserId);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [ratings, setRatings] = useState({});
  const [hovered, setHovered] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showAnim, setShowAnim] = useState(false);
  const [waitingForResults, setWaitingForResults] = useState(false);
  const [results, setResults] = useState(null);

  React.useEffect(() => {
    function onVotingResults({ winner, tallies }) {
      setWaitingForResults(false);
      setResults({ winner, tallies });
      onComplete({ winner, tallies });
    }
    socket.on('voting-results', onVotingResults);
    return () => socket.off('voting-results', onVotingResults);
  }, [onComplete]);

  const current = artworkEntries[currentIdx];
  if (!current && !waitingForResults) return null;
  const [playerId, data] = current || [];
  const userRating = ratings[playerId] || 0;

  function handleStarClick(starIdx) {
    setRatings(r => ({ ...r, [playerId]: starIdx }));
  }

  function handleSubmit() {
    setSubmitting(true);
    setShowAnim(true);
    setTimeout(() => {
      setShowAnim(false);
      setSubmitting(false);
      if (currentIdx + 1 < artworkEntries.length) {
        setCurrentIdx(idx => idx + 1);
      } else {
        // Emit votes to server
        setWaitingForResults(true);
        socket.emit('submit-votes', { ratings, lobbyId: window.currentLobbyId });
        // onComplete will be called when 'voting-results' is received
      }
    }, 1200);
  }

  // For half-star support (0.5 increments, max 5)
  function renderStars() {
    const stars = [];
    for (let i = 1; i <= 10; i++) {
      const value = i / 2;
      let filled = userRating >= value;
      let half = userRating + 0.5 === value;
      stars.push(
        <span
          key={i}
          className="cursor-pointer inline-block"
          onMouseEnter={() => setHovered(value)}
          onMouseLeave={() => setHovered(null)}
          onClick={() => handleStarClick(value)}
        >
          <Star filled={hovered ? hovered >= value : filled} half={half && !filled} />
        </span>
      );
    }
    return stars;
  }

  if (waitingForResults) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-[#fff1e6] via-[#cddafd] to-[#bee1e6] py-8 px-2">
        <div className="max-w-lg w-full bg-white/80 rounded-3xl shadow-2xl border-4 border-[#e2ece9] flex flex-col items-center p-8 relative animate-pulse">
          <div className="text-[#5b5f97] font-extrabold text-2xl mb-4 drop-shadow-lg">
            Waiting for everyone to finish voting...
          </div>
          <div className="text-5xl mb-2">⏳</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-[#fff1e6] via-[#cddafd] to-[#bee1e6] py-8 px-2">
      <div className="max-w-lg w-full bg-white/80 rounded-3xl shadow-2xl border-4 border-[#e2ece9] flex flex-col items-center p-8 relative">
        <div className="text-[#5b5f97] font-extrabold text-2xl mb-2 drop-shadow-lg">
          Rate this artwork!
        </div>
        <div className="mb-3 text-[#a685e2] font-bold text-lg flex items-center gap-2">
          <span role="img" aria-label="artist">🎨</span> {data.nickname || playerId}
        </div>
        <div className="w-full flex justify-center mb-4">
          <img
            src={data.image}
            alt={`art from ${data.nickname || playerId}`}
            className="w-full h-80 object-contain rounded-2xl shadow-md border-2 border-[#b8c1ec] bg-[#f1faee]"
            style={{ background: '#f1faee' }}
          />
        </div>
        <div className="flex justify-center items-center mb-4">
          {renderStars()}
        </div>
        <button
          className="mt-2 px-8 py-2 rounded-full bg-gradient-to-r from-[#cddafd] via-[#bee1e6] to-[#fad2e1] text-[#5b5f97] font-extrabold text-lg shadow hover:scale-105 hover:shadow-xl border-2 border-[#e2ece9] transition-all duration-150 disabled:opacity-50"
          disabled={!ratings[playerId] || submitting}
          onClick={handleSubmit}
        >
          Submit Rating
        </button>
        <div className="mt-6 text-[#5b5f97] text-sm font-medium">
          Artwork {currentIdx + 1} of {artworkEntries.length}
        </div>
        <AnimatePresence>
          {showAnim && (
            <motion.div
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={{ duration: 0.7 }}
            >
              <motion.div
                className="flex gap-1"
                initial={{ y: 40 }}
                animate={{ y: -60 }}
                transition={{ type: 'spring', stiffness: 200, damping: 10 }}
              >
                {[...Array(Math.round(ratings[playerId] || 0))].map((_, i) => (
                  <motion.span
                    key={i}
                    className="text-4xl"
                    initial={{ y: 0, opacity: 1 }}
                    animate={{ y: -20 - i * 10, opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    ⭐
                  </motion.span>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
