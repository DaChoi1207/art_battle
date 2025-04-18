import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';

function Home() {
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const navigate = useNavigate();

  const create = () => {
    if (!nickname.trim()) {
      alert('Please enter a nickname');
      return;
    }
    socket.emit('create-lobby', (lobbyId) => {
      navigate(`/lobby/${lobbyId}`, { state: { nickname } });
    });
  };

  const join = () => {
    if (!nickname.trim()) {
      alert('Please enter a nickname');
      return;
    }
    socket.emit('join-lobby', code, nickname, (ok) => {
      if (ok) navigate(`/lobby/${code}`, { state: { nickname } });
      else alert('Invalid code');
    });
  };

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
