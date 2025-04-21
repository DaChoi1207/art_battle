import React, { useEffect, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import socket from '../socket';
import '../styles/heart-animation.css';
import VoiceChat from './VoiceChat';
import { updateStats } from '../utils/stats';

const PALETTE = [
  '#e63946', '#457b9d', '#f1faee', '#ffbe0b',
  '#8338ec', '#cddafd', '#bee1e6', '#b8c1ec'
];

function getRandomPaletteColor(idx) {
  return PALETTE[idx % PALETTE.length];
}


export default function Gallery() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    artworks = {},
    winner: winnerFromState = null,
    hostId = null,
    roundDuration: durationFromState = 15,
    handedness = 'right'
  } = useLocation().state || {};

  const roundDuration = durationFromState;
  const isHost = socket.id === hostId;
  const winner = winnerFromState;

  // 1) Load the logged‑in user
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    fetch('/profile', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(setProfile)
      .catch(console.error);
  }, []);

  // 2) Once we know who they are, update games_played / games_won
  useEffect(() => {
    if (!profile?.id) return;
    const won = profile.id === winner;
    updateStats({ userId: profile.id, won })
      .then(r => console.log('Stats updated:', r))
      .catch(console.error);
  }, [profile, winner]);

  // 3) Allow “Play Again” for the host
  useEffect(() => {
    const onStartGame = ({ roundDuration }) => {
      navigate(`/game/${id}`, { state: { roundDuration, handedness } });
    };
    socket.on('start-game', onStartGame);
    return () => socket.off('start-game', onStartGame);
  }, [id, navigate, handedness]);

  // likeCounts[artistId] = total number of likes they’ve received
  const [likeCounts, setLikeCounts] = useState({});
  // likedByMe[artistId] = whether this user clicked “like” on that artwork
  const [likedByMe, setLikedByMe] = useState({});
  // Store randomized heart params per artwork (playerId)
  const heartParamsRef = React.useRef({});

  // listen for backend “someone liked this artist” events
  useEffect(() => {
    socket.on('artwork-liked', ({ artistId, count }) => {
      setLikeCounts(prev => ({ ...prev, [artistId]: count }));
    });
    return () => {
      socket.off('artwork-liked');
    };
  }, []);

  const handleLike = artistId => {
    setLikedByMe(prev => {
      const newLiked = !prev[artistId];
      socket.emit('like-artwork', { galleryId: id, artistId, liked: newLiked });
      return { ...prev, [artistId]: newLiked };
    });
  };


  const handlePlayAgain = () => {
    socket.emit('clear-canvas', id);
    socket.emit('start-game', id, roundDuration);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start bg-gradient-to-br from-[#fff1e6] via-[#cddafd] to-[#bee1e6] py-8 px-2 title-font">
      <VoiceChat roomId={id} />
      <h2 className="text-4xl md:text-5xl font-extrabold mb-2 text-[#5b5f97]
                     drop-shadow-lg tracking-tight title-font">
        <span className="bg-gradient-to-r from-[#e63946] via-[#ffbe0b] to-[#8338ec]
                         bg-clip-text text-transparent">
          Gallery
        </span>
      </h2>
      <div className="mb-8 text-lg text-[#5b5f97] font-medium title-font">
        See everyone's masterpieces below!
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4
                      gap-8 w-full max-w-6xl title-font">
        {Object.entries(artworks).map(([playerId, data], idx) => {
          const isWinner = playerId === winner;
          const hearts = likeCounts[playerId] || 0;

          return (
            <div
              key={playerId}
              className={`relative flex flex-col items-center bg-white/80 backdrop-blur-sm
                          rounded-3xl shadow-xl border-4 p-4 transition-transform duration-200
                          hover:-translate-y-2 hover:shadow-2xl
                          ${isWinner ? 'border-yellow-400 ring-4 ring-yellow-200' : 'border-[#e2ece9]'}`}
              style={{ borderColor: isWinner ? '#FFD700' : getRandomPaletteColor(idx) }}
            >
              {/* Like button + trophy */}
              <div className="absolute top-2 right-2 flex gap-1 z-10">
                <button
                  className={`text-2xl transition-all ${
                    likedByMe[playerId]
                      ? 'text-pink-500 scale-110'
                      : 'text-[#b8c1ec] hover:text-pink-400'
                  }`}
                  onClick={() => handleLike(playerId)}
                  aria-label={likedByMe[playerId] ? 'Unlike' : 'Like'}
                >
                  {likedByMe[playerId] ? '❤️' : '🤍'}
                </button>
                {isWinner && <span className="text-2xl">🏆</span>}
              </div>

              {/* Falling hearts: only visible to the *artist* (socket.id) */}
              {socket.id === playerId && hearts > 0 && (
                <div className="pointer-events-none absolute inset-0 w-full h-full z-20">
                  {(() => {
                    // Ensure we have a params array for this artwork
                    if (!heartParamsRef.current[playerId]) heartParamsRef.current[playerId] = [];
                    const paramsArr = heartParamsRef.current[playerId];
                    // If heart count increased, add new random params
                    while (paramsArr.length < hearts) {
                      paramsArr.push({
                        left: Math.random() * 80 + 10, // percent
                        topStart: Math.random() * 40, // percent
                        fallDistance: 60 + Math.random() * 30, // percent
                        duration: (1 + Math.random() * 0.4).toFixed(2),
                        rotate: Math.random() * 40 - 20, // deg
                        drift: Math.random() * 60 - 30, // px
                        delay: paramsArr.length * 0.18 + Math.random() * 0.12
                      });
                    }
                    // If heart count decreased, trim
                    if (paramsArr.length > hearts) paramsArr.length = hearts;
                    return paramsArr.map((params, i) => (
                      <span
                        key={i}
                        className="absolute text-pink-400 text-4xl"
                        style={{
                          left: `${params.left}%`,
                          top: `${params.topStart}%`,
                          animation: `heart-fall-custom-${playerId}-${i} ${params.duration}s cubic-bezier(0.45,0.1,0.6,1.1)`,
                          animationDelay: `${params.delay}s`,
                          transform: `rotate(${params.rotate}deg) translateX(${params.drift}px)`
                        }}
                      >
                        ❤️
                        <style>{`
                          @keyframes heart-fall-custom-${playerId}-${i} {
                            0% { opacity: 0; transform: translateY(0) scale(1.2) rotate(${params.rotate}deg) translateX(${params.drift}px); }
                            10% { opacity: 1; }
                            80% { opacity: 1; transform: translateY(${params.fallDistance}%) scale(1.1) rotate(${params.rotate + 16}deg) translateX(${params.drift + 10}px); }
                            100% { opacity: 0; transform: translateY(${params.fallDistance + 30}%) scale(0.9) rotate(${params.rotate - 8}deg) translateX(${params.drift - 8}px); }
                          }
                        `}</style>
                      </span>
                    ));
                  })()}
                </div>
              )}

              {/* Artwork */}
              <img
                src={data.image}
                alt={`art by ${data.nickname || playerId}`}
                className="w-full h-64 object-contain rounded-2xl shadow-md mb-3
                           bg-[#f1faee] border-2 border-[#b8c1ec]"
              />

              <div className="font-bold text-lg text-[#5b5f97] flex items-center gap-2 title-font">
                {data.nickname || playerId}
              </div>
            </div>
          );
        })}
      </div>

      {isHost && (
        <button
          className="mt-10 px-8 py-3 rounded-full
                     bg-gradient-to-r from-[#cddafd] via-[#bee1e6] to-[#fad2e1]
                     text-[#5b5f97] font-extrabold text-lg shadow-lg
                     hover:scale-105 hover:shadow-xl border-2 border-[#e2ece9]
                     transition-all duration-150 title-font"
          onClick={handlePlayAgain}
        >
          Play Again
        </button>
      )}
    </div>
  );
}