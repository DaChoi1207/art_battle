import React, { useEffect } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import socket from '../socket';

export default function Gallery() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    artworks = {},
    winner = null,
    hostId = null
  } = useLocation().state || {};

  const isHost = socket.id === hostId;

  // Listen for the server's 'start-game' broadcast and navigate everyone back to /game/:id
  useEffect(() => {
    const onStartGame = () => {
      navigate(`/game/${id}`);
    };
    socket.on('start-game', onStartGame);
    return () => {
      socket.off('start-game', onStartGame);
    };
  }, [id, navigate]);

  const handlePlayAgain = () => {
    // Only emit — navigation will happen when 'start-game' arrives
    socket.emit('start-game', id);
  };

  return (
    <div className="p-4 text-center">
      <h2 className="text-2xl font-bold mb-4">Gallery</h2>

      <div className="flex flex-wrap justify-center gap-4">
        {Object.entries(artworks).map(([playerId, img]) => (
          <div key={playerId} className="border p-2 rounded">
            <p>
              {playerId}
              {playerId === winner && ' 🏆 Winner!'}
            </p>
            <img src={img} alt={`art from ${playerId}`} width={300} />
          </div>
        ))}
      </div>

      {isHost && (
        <button
          className="mt-6 btn"
          onClick={handlePlayAgain}
        >
          Play Again
        </button>
      )}
    </div>
  );
}