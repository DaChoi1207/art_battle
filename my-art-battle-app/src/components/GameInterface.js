// src/components/GameInterface.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../socket';
import WebcamFeed from './WebcamFeed';

export default function GameInterface() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState(null);

  // 1) Listen for the prompt (hosts + late joiners)
  useEffect(() => {
    socket.on('new-prompt', setPrompt);
    socket.emit('get-prompt', id);
    return () => {
      socket.off('new-prompt', setPrompt);
    };
  }, [id]);

  // 2) When the round is over, clean up socket listeners and navigate to the gallery
  useEffect(() => {
    const handleShowGallery = ({ artworks, winner }) => {
      // tear down any drawing/video listeners so they won't fire once the DOM changes
      socket.off('peer-draw');
      socket.off('peer-video');
      socket.off('clear-canvas');
      socket.off('start-game');
      socket.off('game-over');

      navigate(`/gallery/${id}`, { state: { artworks, winner } });
    };

    socket.on('show-gallery', handleShowGallery);
    return () => {
      socket.off('show-gallery', handleShowGallery);
    };
  }, [id, navigate]);

  // 3) Render a waiting message until we have a prompt
  if (!prompt) {
    return (
      <div className="p-4 text-center">
        <h2>Waiting for prompt…</h2>
      </div>
    );
  }

  // 4) Once we have a prompt, show the drawing interface
  return (
    <div className="p-4">
      <div className="mb-4 p-2 bg-yellow-100 rounded text-xl font-bold text-center">
        Draw this: <span className="text-blue-600">{prompt}</span>
      </div>
      <WebcamFeed roomId={id} />
    </div>
  );
}
