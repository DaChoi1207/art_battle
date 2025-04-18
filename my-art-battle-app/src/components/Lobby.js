import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../socket';

function Lobby() {
  const [handedness, setHandedness] = useState('right');
  const [copyMsg, setCopyMsg] = useState('');
  const { id } = useParams();
  const [players, setPlayers] = useState([]);
  const [roundDuration, setRoundDuration] = useState('15');
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

    // Handle being kicked
    socket.on('kicked', () => {
      alert('You have been kicked from the lobby.');
      navigate('/');
    });

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
      {isHost && (
        <div className="mb-2">
          <button
            className="btn btn-sm"
            onClick={async () => {
              await navigator.clipboard.writeText(window.location.origin + '/lobby/' + id);
              setCopyMsg('Link copied!');
              setTimeout(() => setCopyMsg(''), 1500);
            }}
          >
            Copy link
          </button>
          {copyMsg && <span className="ml-2 text-green-600">{copyMsg}</span>}
        </div>
      )}
      <ul>
        {playerList.map(p => (
          <li key={p.id}>
            {p.nickname || p.id}
            {p.id === socket.id ? ' (You)' : ''}
            {playerList[0] && p.id === playerList[0].id ? ' (Host)' : ''}
            {isHost && p.id !== socket.id && (
              <button
                className="ml-2 text-red-600 underline text-xs"
                onClick={() => {
                  if (window.confirm(`Kick ${p.nickname || p.id}?`)) {
                    socket.emit('kick-player', id, p.id);
                  }
                }}
              >
                Kick
              </button>
            )}
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
        <>
          <div className="mt-4">
            <label>
              Round duration (seconds):
              <input
                type="number"
                min={5}
                max={1200}
                value={roundDuration}
                onChange={e => {
                  // Allow blank, strip leading zeros
                  let val = e.target.value.replace(/^0+(?=\d)/, '');
                  if (val === '' || /^[0-9]*$/.test(val)) {
                    setRoundDuration(val);
                  }
                }}
                className="input ml-2 w-20"
              />
            </label>
          </div>
          <button
            onClick={() => {
              // Only allow valid durations
              const durationNum = Number(roundDuration);
              if (!durationNum || durationNum < 5 || durationNum > 1200) {
                alert('Please enter a round duration between 5 and 1200 seconds.');
                return;
              }
              socket.emit('start-game', id, durationNum);
            }}
            className="btn mt-4"
          >
            Start Game
          </button>
        </>
      )}
    </div>
  );
}

export default Lobby;
