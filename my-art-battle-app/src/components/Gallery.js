import React, { useEffect, useState } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import socket from '../socket';
import GalleryVoting from './GalleryVoting';

const PALETTE = [
  '#e63946', '#457b9d', '#f1faee', '#ffbe0b', '#8338ec', '#cddafd', '#bee1e6', '#b8c1ec'
];

function getRandomPaletteColor(idx) {
  return PALETTE[idx % PALETTE.length];
}

export default function Gallery() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [liked, setLiked] = useState({});
  const [votingDone, setVotingDone] = useState(false);
  const [votes, setVotes] = useState(null); // { playerId: [ratings...] }
  const [winnerId, setWinnerId] = useState(null);

  // Pull artworks, winner, hostId, and roundDuration out of location.state
  const {
    artworks = {},
    winner: winnerFromState = null,
    hostId   = null,
    roundDuration: durationFromState = null,
  } = useLocation().state || {};

  const roundDuration = durationFromState ?? 15;

  useEffect(() => {
    const onStartGame = ({ roundDuration }) => {
      navigate(`/game/${id}`, { state: { roundDuration } });
    };
    socket.on('start-game', onStartGame);
    return () => {
      socket.off('start-game', onStartGame);
    };
  }, [id, navigate]);

  const isHost = socket.id === hostId;

  const handlePlayAgain = () => {
    // Emit clear-canvas to everyone in the room before starting the new round
    socket.emit('clear-canvas', id);
    socket.emit('start-game', id, roundDuration);
  };

  const handleLike = (playerId) => {
    setLiked(like => ({ ...like, [playerId]: !like[playerId] }));
  };

  // Voting logic: handle multiplayer voting results
  const handleVotingComplete = (result) => {
    // result: { winner, tallies }
    if (result && result.winner) {
      setWinnerId(result.winner);
      setVotes(result.tallies);
      setVotingDone(true);
    }
  };

  // If voting not done and no winner, show voting scene
  const hasRealWinner = winnerFromState && Object.keys(artworks).includes(winnerFromState);
  if (!votingDone && !hasRealWinner) {
    return (
      <GalleryVoting
        artworks={artworks}
        localUserId={socket.id}
        onComplete={handleVotingComplete}
      />
    );
  }

  // Winner: from voting or state
  const winner = winnerFromState || winnerId;

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-start bg-gradient-to-br from-[#fff1e6] via-[#cddafd] to-[#bee1e6] py-8 px-2">
      <h2 className="text-4xl md:text-5xl font-extrabold mb-2 text-[#5b5f97] drop-shadow-lg tracking-tight">
        <span className="bg-gradient-to-r from-[#e63946] via-[#ffbe0b] to-[#8338ec] bg-clip-text text-transparent">Gallery</span>
      </h2>
      <div className="mb-8 text-lg text-[#5b5f97] font-medium">See everyone's masterpieces below!</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8 w-full max-w-6xl">
        {Object.entries(artworks).map(([playerId, data], idx) => {
          const isWinner = playerId === winner;
          return (
            <div
              key={playerId}
              className={`relative flex flex-col items-center bg-white/80 rounded-3xl shadow-xl border-4 p-4 transition-transform duration-200 hover:-translate-y-2 hover:shadow-2xl ${isWinner ? 'border-yellow-400 ring-4 ring-yellow-200' : 'border-[#e2ece9]'}`}
              style={{ borderColor: isWinner ? '#FFD700' : getRandomPaletteColor(idx) }}
            >
              <div className="absolute top-2 right-2 flex gap-1 z-10">
                <button
                  className={`text-2xl transition-all ${liked[playerId] ? 'text-pink-500 scale-110' : 'text-[#b8c1ec] hover:text-pink-400'}`}
                  onClick={() => handleLike(playerId)}
                  title={liked[playerId] ? 'Unlike' : 'Like'}
                  aria-label="Like this artwork"
                >
                  {liked[playerId] ? '❤️' : '🤍'}
                </button>
                {isWinner && <span className="text-2xl" title="Winner!">🏆</span>}
              </div>
              <img
                src={data.image}
                alt={`art from ${data.nickname || playerId}`}
                className="w-full h-64 object-contain rounded-2xl shadow-md mb-3 bg-[#f1faee] border-2 border-[#b8c1ec]"
                style={{ background: '#f1faee' }}
              />
              <div className="font-bold text-lg text-[#5b5f97] flex items-center gap-2">
                {data.nickname || playerId}
              </div>
              {/* Optional: Show prompt/round info here if available */}
              {/* <div className="text-xs text-[#a685e2] mt-1">Prompt: ...</div> */}
            </div>
          );
        })}
      </div>
      {isHost && (
        <button
          className="mt-10 px-8 py-3 rounded-full bg-gradient-to-r from-[#cddafd] via-[#bee1e6] to-[#fad2e1] text-[#5b5f97] font-extrabold text-lg shadow-lg hover:scale-105 hover:shadow-xl border-2 border-[#e2ece9] transition-all duration-150"
          onClick={handlePlayAgain}
        >
          Play Again
        </button>
      )}
    </div>
  );
}

