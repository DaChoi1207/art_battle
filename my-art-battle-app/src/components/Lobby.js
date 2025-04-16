import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../socket';

function Lobby() {
  const { id } = useParams();
  const [players, setPlayers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Join lobby when component mounts
    socket.emit('join-lobby', id, ok => {
      if (!ok) {
        alert('Invalid lobby code');
        return navigate('/');
      }
    });

    // Update player list
    socket.on('lobby-update', setPlayers);

    // When host starts game, navigate everyone
    socket.on('start-game', () => {
      navigate(`/game/${id}`);
    });

    socket.on('start-game', () => {
      navigate(`/game/${id}`);
    });

    return () => {
      socket.off('lobby-update');
      socket.off('start-game');
    };
  }, [id, navigate]);

  // Remove duplicates in case of multiple joins
  const uniquePlayers = Array.from(new Set(players));
  // First player is the host
  const isHost = uniquePlayers[0] === socket.id;

  return (
    <div className="p-4">
      <h1>Lobby {id}</h1>
      <ul>
        {uniquePlayers.map(pid => (
          <li key={pid}>
            {pid}{pid === socket.id ? ' (You)' : ''}
          </li>
        ))}
      </ul>

      {isHost && (
  <button
    onClick={() => {
      // 1. You navigate immediately:
      navigate(`/game/${id}`);
      // 2. Then tell the server to start the game for everyone else:
      socket.emit('start-game', id);
    }}
    className="btn mt-4"
  >
    Start Game
  </button>
)}
    </div>
  );
}

export default Lobby;
