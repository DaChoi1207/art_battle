import React, { useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import socket from '../socket';

export default function Gallery() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Pull artworks, winner, hostId, and roundDuration out of location.state
  const {
    artworks = {},
    winner   = null,
    hostId   = null,
    roundDuration: durationFromState = null,
  } = useLocation().state || {};

  // If we got a duration passed in, use it; otherwise default to 15s
  const roundDuration = durationFromState ?? 15;

  // When the server emits start-game, navigate back to /game with our duration
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

  // Host clicks “Play Again” → re‑emit the same duration the gallery was using
  const handlePlayAgain = () => {
    socket.emit('start-game', id, roundDuration);
  };

  return (
    <div className="p-4 text-center">
      <h2 className="text-2xl font-bold mb-4">Gallery</h2>

      <div className="flex flex-wrap justify-center gap-4">
        {Object.entries(artworks).map(([playerId, data]) => (
          <div key={playerId} className="border p-2 rounded">
            <p>
              {data.nickname || playerId}
              {playerId === winner && ' 🏆 Winner!'}
            </p>
            <img src={data.image} alt={`art from ${data.nickname || playerId}`} width={300} />
          </div>
        ))}
      </div>

      {isHost && (
        <button className="mt-6 btn" onClick={handlePlayAgain}>
          Play Again
        </button>
      )}
    </div>
  );
}
