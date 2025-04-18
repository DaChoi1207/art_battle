import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';

function Home() {
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const navigate = useNavigate();

  const create = () => {
    // Nickname is optional; if blank, pass undefined
    socket.emit('create-lobby', (lobbyId) => {
      navigate(`/lobby/${lobbyId}`, { state: { nickname: nickname.trim() || undefined } });
    });
  };

  const join = () => {
    // Nickname is optional; if blank, pass undefined
    socket.emit('join-lobby', code, nickname.trim() || undefined, (ok) => {
      if (ok) navigate(`/lobby/${code}`, { state: { nickname: nickname.trim() || undefined } });
      else alert('Invalid code');
    });
  };

  // Listen for kicked event
  useEffect(() => {
    const handler = () => {
      setNickname('');
      alert('You have been kicked from the lobby.');
      navigate('/');
    };
    socket.on('kicked', handler);
    return () => socket.off('kicked', handler);
  }, [navigate]);

  return (
    <div className="p-4">
      <div className="mb-4">
        <input
          placeholder="Enter your nickname"
          value={nickname}
          onChange={e => setNickname(e.target.value)}
          className="input"
          maxLength={18}
        />
      </div>
      <button onClick={create} className="btn">Create Lobby</button>
      <div className="mt-4">
        <input
          placeholder="Enter lobby code"
          value={code} onChange={e=>setCode(e.target.value)}
          className="input"
        />
        <button onClick={join} className="btn ml-2">Join Lobby</button>
      </div>
    </div>
  );
}

export default Home;
