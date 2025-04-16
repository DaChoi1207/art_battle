import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import socket from '../socket';
import WebcamFeed from './WebcamFeed';

export default function GameInterface() {
  const { id } = useParams();  
  const [prompt, setPrompt] = useState(null);

  useEffect(() => {
    // Listen for any prompt broadcasts:
    socket.on('new-prompt', setPrompt);

    // Ask the server for the prompt (hosts and late-joiners):
    socket.emit('get-prompt', id);

    return () => {
      socket.off('new-prompt');
    };
  }, [id]);

  if (!prompt) {
    return (
      <div className="p-4 text-center">
        <h2>Waiting for prompt…</h2>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="mb-4 p-2 bg-yellow-100 rounded text-xl font-bold text-center">
        Draw this: <span className="text-blue-600">{prompt}</span>
      </div>
      <WebcamFeed roomId={id} />
      {/* TODO: timer overlay */}
    </div>
  );
}
