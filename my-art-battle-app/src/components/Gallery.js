import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import socket from '../socket';
import '../styles/heart-animation.css';
import VoiceChat from './VoiceChat';
//import { updateStats } from '../utils/stats';

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

  const [statsUpdated, setStatsUpdated] = useState(false);

  // 1) Load the logged‑in user
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    fetch('/profile', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(setProfile)
      .catch(console.error);
  }, []);

  // 2) Once profile & winner are known, bump stats exactly once
  // useEffect(() => {
  //   if (!profile || statsUpdated) return;
  //   const won = profile.id === winner;
  //   updateStats({ userId: profile.id, won })
  //     .then(success => {
  //       if (success) setStatsUpdated(true);
  //     })
  //     .catch(console.error);
  // }, [profile, winner, statsUpdated]);

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

  // Provide a "Home" option to all users
  useEffect(() => {
    const onHome = () => {
      navigate('/');
    };
    socket.on('home', onHome);
    return () => socket.off('home', onHome);
  }, [navigate]);

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start bg-gradient-to-br from-[#bde0fe] via-[#cddafd] to-[#ffc8dd] py-8 px-2 title-font">
      <VoiceChat roomId={id} />
      <h2 className="text-5xl font-extrabold mb-2 text-[#5b5f97] drop-shadow-lg tracking-tight title-font">
        <span className="bg-gradient-to-r from-[#e63946] via-[#ffbe0b] to-[#8338ec] bg-clip-text text-transparent">Gallery</span>
      </h2>
      <div className="mb-8 text-xl text-[#5b5f97] font-medium fun-font">
        See everyone's masterpieces below!
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-10 w-full max-w-6xl fun-font">
        {Object.entries(artworks).map(([playerId, data], idx) => {
          const isWinner = playerId === winner;
          const hearts = likeCounts[playerId] || 0;
          return (
            <motion.div
              key={playerId}
              className={`relative flex flex-col items-center bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl border-4 p-5 transition-transform duration-200 hover:-translate-y-2 hover:scale-105 hover:shadow-2xl ${isWinner ? 'border-yellow-400 ring-4 ring-yellow-200' : 'border-[#e2ece9]'}`}
              style={{ borderColor: isWinner ? '#FFD700' : getRandomPaletteColor(idx) }}
              initial={{ scale: 1, opacity: 0.96 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.05, boxShadow: "0 8px 36px #a2d2ff55" }}
            >
              {/* Like button + trophy */}
              <div className="absolute top-2 right-2 flex gap-1 z-10">
                <button
                  className={`text-2xl transition-all ${likedByMe[playerId] ? 'text-pink-500 scale-110' : 'text-[#b8c1ec] hover:text-pink-400'}`}
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
                    if (!heartParamsRef.current[playerId]) heartParamsRef.current[playerId] = [];
                    const paramsArr = heartParamsRef.current[playerId];
                    while (paramsArr.length < hearts) {
                      paramsArr.push({
                        left: Math.random() * 80 + 10,
                        topStart: Math.random() * 40,
                        fallDistance: 60 + Math.random() * 30,
                        duration: (1 + Math.random() * 0.4).toFixed(2),
                        rotate: Math.random() * 40 - 20,
                        drift: Math.random() * 60 - 30,
                        delay: paramsArr.length * 0.18 + Math.random() * 0.12
                      });
                    }
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
                className="w-full h-64 object-contain rounded-2xl shadow-md mb-3 bg-[#f1faee] border-4 border-[#b8c1ec]"
              />

              <div className="font-bold text-xl text-[#5b5f97] flex items-center gap-2 title-font">
                {data.nickname || playerId}
              </div>

              <div className="mt-2 flex items-center gap-2">
                <span className="text-pink-400 text-xl">{hearts}</span>
                <span className="text-pink-400 text-lg">❤️</span>
                {isWinner && (
                  <span className="ml-2 px-3 py-1 bg-gradient-to-r from-yellow-100 to-yellow-300 rounded-full text-yellow-700 font-bold text-base fun-font animate-pulse shadow">
                    Winner!
                  </span>
                )}
              </div>

              {/* Winner confetti/shine effect */}
              {isWinner && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
                  <span className="block w-24 h-24 rounded-full bg-gradient-to-br from-yellow-200 via-yellow-100 to-yellow-300 opacity-60 blur-2xl animate-ping" />
                  <span className="block w-20 h-20 rounded-full bg-yellow-100 opacity-50 blur-xl absolute top-2 left-2" />
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-8 mt-16 w-full max-w-lg justify-center items-center">
        {isHost && (
          <button
            className="px-10 py-4 rounded-full bg-gradient-to-r from-[#cddafd] via-[#bee1e6] to-[#fad2e1] text-[#5b5f97] font-extrabold text-2xl shadow-lg hover:scale-105 hover:shadow-xl border-2 border-[#e2ece9] transition-all duration-150 title-font"
            onClick={handlePlayAgain}
          >
            Play Again
          </button>
        )}
        <button
          className="px-10 py-4 rounded-full bg-gradient-to-r from-[#cddafd] via-[#bee1e6] to-[#fad2e1] text-[#5b5f97] font-extrabold text-2xl shadow-lg hover:scale-105 hover:shadow-xl border-2 border-[#e2ece9] transition-all duration-150 title-font"
          onClick={() => navigate('/')}
        >
          Home
        </button>
      </div>
    </div>
  );
}