// src/components/GameInterface.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../socket';
import WebcamFeed from './WebcamFeed';
import { useLocation } from 'react-router-dom';

export default function GameInterface() {
  const [players, setPlayers] = useState([]);
  const { state } = useLocation();
  // If you came from Lobby with a handedness, use it; otherwise default.
  const handedness = state?.handedness ?? 'right';
  const initialDuration = state?.roundDuration ?? 15;
  const [roundDuration, setRoundDuration] = useState(initialDuration);
  console.log('GameInterface: handedness from location.state:', state?.handedness, 'final:', handedness);
  const { id } = useParams();
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState(null);
  const [invalid, setInvalid] = useState(false);

  // Listen for lobby-update to keep player list in sync (and remove disconnected peers)
  useEffect(() => {
    const handleLobbyUpdate = (playerList) => {
      setPlayers(playerList);
      // Remove DOM elements for players who have left
      if (window && document) {
        const remoteIds = Array.from(document.querySelectorAll('[id^="remote-peer-"]'))
          .map(el => el.id.replace('remote-peer-', ''));
        const currentIds = (playerList || []).map(p => p.id);
        for (const rid of remoteIds) {
          if (!currentIds.includes(rid)) {
            const elem = document.getElementById('remote-peer-' + rid);
            if (elem && elem.parentNode) elem.parentNode.removeChild(elem);
          }
        }
      }
    };
    socket.on('lobby-update', handleLobbyUpdate);
    return () => socket.off('lobby-update', handleLobbyUpdate);
  }, [id]);

  // 1) Listen for the prompt (hosts + late joiners)
  useEffect(() => {
    const handlePrompt = (prompt) => {
      if (!prompt) {
        setInvalid(true);
        setTimeout(() => navigate('/'), 1800);
      } else {
        setPrompt(prompt);
      }
    };
    socket.on('new-prompt', handlePrompt);
    socket.emit('get-prompt', id);
    return () => {
      socket.off('new-prompt', handlePrompt);
    };
  }, [id, navigate]);

  // Listen for start-game to update roundDuration if server sends it (for late joiners)
  useEffect(() => {
    const handler = ({ roundDuration }) => {
      if (roundDuration) setRoundDuration(roundDuration);
    };
    socket.on('start-game', handler);
    return () => socket.off('start-game', handler);
  }, [id]);

  // 2) When the round is over, clean up socket listeners and navigate to the gallery
  useEffect(() => {
    const handleShowGallery = ({ artworks, winner, hostId }) => {
      // tear down any drawing/video listeners so they won't fire once the DOM changes
      socket.off('peer-draw');
      socket.off('peer-video');
      socket.off('clear-canvas');
      socket.off('start-game');
      socket.off('game-over');

      // navigate and pass along the hostId
      navigate(`/gallery/${id}`, { state: { artworks, winner, hostId } });
    };

    socket.on('show-gallery', handleShowGallery);
    return () => {
      socket.off('show-gallery', handleShowGallery);
    };
  }, [id, navigate]);

  // 3) Render a waiting message until we have a prompt
  if (invalid) {
    return (
      <div className="p-6 text-center text-[#a685e2] title-font text-xl font-semibold">
        Invalid game code. Redirecting...
      </div>
    );
  }
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
        Draw this: <span className="text-blue-600">{prompt}</span><br />
        <span className="text-gray-600 text-base">Round duration: {roundDuration} seconds</span>
      </div>
      <WebcamFeed roomId={id} dominance={handedness} />
    </div>
  );
}
