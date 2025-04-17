import React from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import socket from '../socket';

export default function Gallery() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { artworks, winner } = useLocation().state || { artworks: {}, winner: null };

  const isHost = Object.keys(artworks)[0] === socket.id; // adjust logic if needed

  console.log('ARTWORKS:', artworks);
  console.log('WINNER:', winner);

  return (
    <div className="p-4 text-center">
      <h2 className="text-2xl font-bold mb-4">Gallery</h2>
      <div className="flex flex-wrap justify-center gap-4">
        {Object.entries(artworks).map(([playerId, img]) => (
          <div key={playerId} className="border p-2 rounded">
            <p>{playerId}{playerId === winner && ' 🏆 Winner!'}</p>
            <img src={img} alt={`art from ${playerId}`} width={300} />
          </div>
        ))}
      </div>

      {isHost && (
        <button
          className="mt-6 btn"
          onClick={() => socket.emit('start-game', id)}
        >
          Play Again
        </button>
      )}
    </div>
  );
}
