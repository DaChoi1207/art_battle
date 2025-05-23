import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

import { useLocation, useParams, useNavigate } from 'react-router-dom';
import socket from '../socket';
import useClickSfx from '../utils/useClickSfx';

const PALETTE = [
  '#e63946', '#457b9d', '#f1faee', '#ffbe0b', '#8338ec', '#cddafd', '#bee1e6', '#b8c1ec'
];

function getRandomPaletteColor(idx) {
  return PALETTE[idx % PALETTE.length];
}

function Star({ filled, half, animated, ...props }) {
  return (
    <motion.svg
      viewBox="0 0 24 24"
      width={48}
      height={48}
      initial={false}
      animate={ animated ? { scale: [1, 1.25, 1] } : { scale: 1 } }
      transition={ animated ? {
        type: 'tween',
        times: [0, 0.5, 1],
        duration: 0.5,
        ease: 'easeInOut'
      } : {} }
      {...props}
    >
      <defs>
        <linearGradient id="half-star">
          <stop offset="50%" stopColor="#FFD700" />
          <stop offset="50%" stopColor="#e2ece9" />
        </linearGradient>
      </defs>
      <path
        d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01z"
        fill={half ? 'url(#half-star)' : (filled ? '#FFD700' : '#e2ece9')}
        stroke="#FFD700"
        strokeWidth="1.5"
      />
    </motion.svg>
  );
}



export default function GalleryVoting(props) {
  const location = useLocation();
  const { id : lobbyId } = useParams();
  const navigate = useNavigate();
  const playClick = useClickSfx();


  // Try to get from props, else from location.state
  const artworks = props.artworks || location.state?.artworks || {};
  const localUserId = props.localUserId || location.state?.profileId || null;
  const onComplete = props.onComplete || (() => {});

  // All hooks must be called unconditionally
  const artworkEntries = Object.entries(artworks).filter(([id]) => id !== localUserId);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [ratings, setRatings] = useState({});
  const [hovered, setHovered] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showRipple, setShowRipple] = useState(false);
  const [waitingForResults, setWaitingForResults] = useState(false);
  const [results, setResults] = useState(null);

  React.useEffect(() => {
    function onVotingResults({ winner, tallies }) {
      setWaitingForResults(false);
      setResults({ winner, tallies });
      onComplete({ winner, tallies });

      navigate(`/gallery/${lobbyId}`, {

        state: {
          artworks,
          winner,
          hostId: location.state?.hostId,
          roundDuration: location.state?.roundDuration,
          handedness: location.state?.handedness
        }
      });
    }
    socket.on('voting-results', onVotingResults);
    return () => socket.off('voting-results', onVotingResults);
  }, [lobbyId, navigate, artworks]);

  // Fallback UI if artworks is missing or empty
  let noArtworksUI = null;
  const noArtworks = !artworks || Object.keys(artworks).length === 0;
  // Redirect to home after 3 seconds if no artworks
  useEffect(() => {
    if (noArtworks) {
      const timeout = setTimeout(() => {
        navigate('/');
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [noArtworks, navigate]);
  if (noArtworks) {
    noArtworksUI = (
      <div className="p-8 flex flex-col items-center justify-center text-center">
        <div className="bg-gradient-to-br from-[#fff1e6] via-[#cddafd] to-[#bee1e6] rounded-3xl shadow-lg border-2 border-[#e2ece9] px-8 py-8 max-w-md w-full animate-fade-in">
          <div className="flex flex-col items-center gap-2">
            <span className="text-4xl mb-2" role="img" aria-label="no-art">🎨</span>
            <span className="text-2xl font-bold text-[#5b5f97] title-font">No artworks to vote on!</span>
            <span className="text-base text-[#a685e2] mt-2">Looks like nobody submitted an artwork this round.</span>
            <span className="text-sm text-[#b8c1ec] mt-4">Redirecting to home...</span>
          </div>
        </div>
      </div>
    );
  }

  const current = artworkEntries[currentIdx];
  if ((!current && !waitingForResults) || noArtworksUI) return noArtworksUI;
  const [playerId, data] = current || [];
  const userRating = ratings[playerId] || 0;

  function handleStarClick(starIdx) {
    setRatings(r => ({ ...r, [playerId]: starIdx }));
  }

  function handleSubmit() {
    setSubmitting(true);
    setShowRipple(true);
    setTimeout(() => {
      setShowRipple(false);
      setSubmitting(false);
      if (currentIdx + 1 < artworkEntries.length) {
        setCurrentIdx(idx => idx + 1);
      } else {
        // Emit votes to server
        setWaitingForResults(true);
        socket.emit('submit-votes', { ratings, lobbyId });
        // onComplete will be called when 'voting-results' is received
      }
    }, 700);
  }

  // 5 stars, each with .5 increments (10 states), accessible and animated
  // Render exactly 5 visible stars, each split into left/right halves for 0.5 increments
  function renderStars() {
    const displayValue = hovered !== null ? hovered : userRating;
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      const leftValue = i - 0.5;
      const rightValue = i;
      stars.push(
        <span key={`star-${i}`} className="relative inline-block group" style={{ width: 48, height: 48 }}>
          {/* Left half (0.5 increment) */}
          <button
            type="button"
            aria-label={`${leftValue} stars`}
            tabIndex={0}
            className="absolute left-0 top-0 w-1/2 h-full bg-transparent p-0 m-0 border-none appearance-none z-10 focus:outline-none"
            style={{ width: '50%', height: '100%' }}
            onMouseEnter={() => setHovered(leftValue)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(leftValue)}
            onBlur={() => setHovered(null)}
            onClick={() => handleStarClick(leftValue)}
          />
          {/* Right half (full star) */}
          <button
            type="button"
            aria-label={`${rightValue} stars`}
            tabIndex={0}
            className="absolute right-0 top-0 w-1/2 h-full bg-transparent p-0 m-0 border-none appearance-none z-10 focus:outline-none"
            style={{ left: '50%', width: '50%', height: '100%' }}
            onMouseEnter={() => setHovered(rightValue)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(rightValue)}
            onBlur={() => setHovered(null)}
            onClick={() => handleStarClick(rightValue)}
          />
          {/* Left half-star SVG (for .5 increments) */}
          <Star
            filled={displayValue >= rightValue}
            half={displayValue >= leftValue && displayValue < rightValue}
            animated={false}
          />
          {/* Right full-star SVG (for full increments) */}
          {displayValue >= rightValue && (
            <Star
              filled={true}
              half={false}
              animated={false}
              style={{ position: 'absolute', left: 0, top: 0 }}
            />
          )}
        </span>
      );
    }
    return (
      <div className="flex gap-2" role="radiogroup" aria-label="Artwork rating">
        {stars}
      </div>
    );
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
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gradient-to-br from-[#bde0fe] via-[#cddafd] to-[#ffc8dd] py-8 px-2">
      <div className="max-w-lg w-full bg-white/90 rounded-3xl shadow-2xl border-4 border-[#e2ece9] flex flex-col items-center p-8 relative">
        <div className="title-font text-3xl text-[#5b5f97] mb-3 drop-shadow-lg tracking-tight">
          <span role="img" aria-label="sparkle">✨</span> Rate This Artwork! <span role="img" aria-label="sparkle">✨</span>
        </div>
        <div className="mb-3 fun-font text-[#a685e2] font-bold text-lg flex items-center gap-2">
          <span role="img" aria-label="artist">🎨</span> {data.nickname || playerId}
        </div>
        <div className="w-full flex justify-center mb-4">
          <img
            src={data.image}
            alt={`art from ${data.nickname || playerId}`}
            className="w-full h-80 object-contain rounded-2xl shadow-md border-4 border-[#b8c1ec] bg-[#f1faee]"
            style={{ background: '#f1faee' }}
          />
        </div>
        <div className="flex justify-center items-center mb-6" style={{ position: 'relative' }}>
          {renderStars()}
          {/* Ripple Effect */}
          <AnimatePresence>
            {showRipple && (
              <motion.div
                key="ripple"
                initial={{ scale: 0.2, opacity: 0.5 }}
                animate={{ scale: 2.6, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: 90,
                  height: 90,
                  background: 'radial-gradient(circle, #cddafd 60%, #a685e2 100%)',
                  borderRadius: '50%',
                  pointerEvents: 'none',
                  zIndex: 20,
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 18px 10px #cddafd44'
                }}
              />
            )}
          </AnimatePresence>
        </div>
        <button
          className="mt-2 px-10 py-3 rounded-full bg-gradient-to-r from-[#cddafd] via-[#bee1e6] to-[#fad2e1] title-font text-[#5b5f97] font-extrabold text-xl shadow hover:scale-105 hover:shadow-xl border-2 border-[#e2ece9] transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!ratings[playerId] || submitting}
          onClick={e => { playClick(); handleSubmit() }}
        >
          Submit Rating
        </button>
        <div className="mt-8 text-[#5b5f97] text-base fun-font font-medium">
          Artwork <span className="font-bold">{currentIdx + 1}</span> of <span className="font-bold">{artworkEntries.length}</span>
        </div>
      </div>
    </div>
  );
}
