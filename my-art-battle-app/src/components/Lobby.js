import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../socket';

function Lobby() {
  const [handedness, setHandedness] = useState('right');
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

    // When host starts game, grab roundDuration & handedness, then navigate
    socket.on('start-game', ({ roundDuration }) => {
      console.log('Received start-game event:', { roundDuration });
      navigate(`/game/${id}`, { state: { roundDuration, handedness } });
    });

    return () => {
      socket.off('lobby-update');
      socket.off('start-game');
    };
  }, [id, navigate, handedness]);

  // Remove duplicates in case of multiple joins
  let playerList = players;
  if (players && typeof players === 'object' && !Array.isArray(players)) {
    // Handle the { players: [...], dominance: ... } shape
    playerList = players.players || [];
  }
  const uniquePlayers = Array.from(new Set(playerList));
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

      <div className="mt-4">
        <label>
          <input
            type="radio"
            value="right"
            checked={handedness === 'right'}
            onChange={() => setHandedness('right')}
          />{' '}
          Right‑hand dominant
        </label>
        <label className="ml-4">
          <input
            type="radio"
            value="left"
            checked={handedness === 'left'}
            onChange={() => setHandedness('left')}
          />{' '}
          Left‑hand dominant
        </label>
      </div>

      {isHost && (
        <button
          onClick={() => {
            // Send handedness to server before starting game
            // Just start the game. We'll pass handedness locally.
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
