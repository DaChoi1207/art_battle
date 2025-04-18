import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../socket';

function Lobby() {
  const [handedness, setHandedness] = useState('right');
  const { id } = useParams();
  const [players, setPlayers] = useState([]);
  const navigate = useNavigate();
  const nickname = (typeof window !== 'undefined' && window.history.state && window.history.state.usr && window.history.state.usr.nickname) || '';
  

  useEffect(() => {
    // Join lobby when component mounts
    socket.emit('join-lobby', id, nickname, ok => {
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

  // players is now an array of {id, nickname}
  const playerList = Array.isArray(players) ? players : [];
  // First player is the host
  const isHost = playerList.length > 0 && playerList[0].id === socket.id;

  return (
    <div className="p-4">
      <h1>Lobby {id}</h1>
      <ul>
        {playerList.map(p => (
          <li key={p.id}>
            {p.nickname || p.id}
            {p.id === socket.id ? ' (You)' : ''}
            {playerList[0] && p.id === playerList[0].id ? ' (Host)' : ''}
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
