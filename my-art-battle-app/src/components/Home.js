import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';

function Home() {
  const [code, setCode] = useState('');
  const navigate = useNavigate();

  const create = () => {
    socket.emit('create-lobby', (lobbyId) => {
      navigate(`/lobby/${lobbyId}`);
    });
  };

  const join = () => {
    socket.emit('join-lobby', code, (ok) => {
      if (ok) navigate(`/lobby/${code}`);
      else alert('Invalid code');
    });
  };

  return (
    <div className="p-4">
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
