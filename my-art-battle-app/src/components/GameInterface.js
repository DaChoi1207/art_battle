// src/components/GameInterface.js
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../socket';
import WebcamFeed from './WebcamFeed';
import TimerDisplay from './TimerDisplay';
import { useLocation } from 'react-router-dom';

export default function GameInterface() {
  const [timeLeft, setTimeLeft] = useState(null);
  const [gameOver, setGameOver] = useState(false);
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
    // If we navigated from lobby, the event will fire immediately
    // If we navigated from gallery, it will fire on play again
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

      // navigate and pass along the hostId and roundDuration
      navigate(`/gallery/${id}`, { state: { artworks, winner, hostId, roundDuration } });
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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-[#fff1e6] via-[#cddafd] to-[#bee1e6] font-sans">
      {/* Top Bar: Prompt & Timer */}
      <div className="w-full flex items-center justify-between px-8 py-4 bg-white/80 shadow-lg rounded-b-3xl border-b-2 border-[#e2ece9] sticky top-0 z-30">
        <div className="text-2xl font-bold text-[#5b5f97] flex items-center gap-3">
          <span role="img" aria-label="sparkle">🎨</span>
          Drawing Prompt:
          <span className="ml-2 text-[#3b3561] bg-yellow-100 rounded-lg px-3 py-1 font-extrabold shadow-sm text-2xl">{prompt}</span>
        </div>
        <TimerDisplay timeLeft={timeLeft} gameOver={gameOver} />
      </div>

      {/* Main Area: Drawing + Video Grid */}
      <div className="flex-1 flex flex-col md:flex-row gap-8 px-6 py-6 max-w-7xl mx-auto w-full">
        {/* Drawing Canvas Area */}
        <div className="flex-1 flex flex-col items-center justify-center bg-white/80 rounded-3xl shadow-xl border-2 border-[#e2ece9] p-6 min-w-[350px]">
          <WebcamFeed roomId={id} dominance={handedness} setTimeLeft={setTimeLeft} setGameOver={setGameOver} />
        </div>
        {/* Video Call Grid Area (remote-container will be rendered inside WebcamFeed) */}
        {/* Optionally, you could move the remote-container here if you refactor WebcamFeed */}
      </div>

      {/* Bottom Bar: Fun Footer or Controls */}
      <div className="w-full flex items-center justify-center py-4 px-8 bg-gradient-to-r from-[#cddafd]/80 via-[#bee1e6]/80 to-[#fad2e1]/80 shadow-inner rounded-t-3xl border-t-2 border-[#e2ece9] mt-auto">
        <span className="font-bold text-lg text-[#5b5f97] tracking-wide flex items-center gap-2">
          <span role="img" aria-label="battle">⚔️</span>
          Art Battle in Progress! Unleash your creativity!
        </span>
      </div>
    </div>
  );
}
