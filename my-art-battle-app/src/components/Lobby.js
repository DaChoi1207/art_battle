import { useState, useEffect, useRef } from 'react';
import { MiniWebcamFeed, MiniRemoteWebcam } from './MiniWebcamFeed';
import { useParams, useNavigate } from 'react-router-dom';
import socket from '../socket';
import { AiOutlineQuestionCircle } from 'react-icons/ai';
import HowToPlayModal from './HowToPlayModal';
import VoiceChat from './VoiceChat';
import { FcCheckmark } from "react-icons/fc";
import SfxSettings from './SfxSettings';

import useClickSfx from '../utils/useClickSfx';


function Lobby() {
  const [showHowTo, setShowHowTo] = useState(false);
  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [gameOngoingMsg, setGameOngoingMsg] = useState("");
  const [handedness, setHandedness] = useState('right');
  const [copyMsg, setCopyMsg] = useState('');
  const { id } = useParams();
  const [players, setPlayers] = useState([]);
  const [isPrivate, setIsPrivate] = useState(true);
  const [roundDuration, setRoundDuration] = useState('180');
  const navigate = useNavigate();
  const nickname = (typeof window !== 'undefined' && window.history.state && window.history.state.usr && window.history.state.usr.nickname) || '';
  const [webcamEnabled, setWebcamEnabled] = useState(false);
  const webcamFrames = useRef({});
  const playClick = useClickSfx();

  useEffect(() => {
    setLoading(true);
    setJoined(false);
    setInvalid(false);
    // Join lobby when component mounts
    socket.emit('join-lobby', id, nickname, ok => {
      // Clear webcam frames on join
      webcamFrames.current = {};
      setLoading(false);
      if (!ok) {
        setInvalid(true);
        setTimeout(() => navigate('/'), 1800);
        return;
      }
      setJoined(true);
    });

    // Update player list
    socket.on('lobby-update', setPlayers);

    // Listen for webcam frames from peers
    socket.on('lobby-peer-video', ({ image, peerId }) => {
      webcamFrames.current = { ...webcamFrames.current, [peerId]: image };
      // force rerender
      setWebcamFramesTick(tick => tick + 1);
    });

    // Handle being kicked
    socket.on('kicked', () => {
      alert('You have been kicked from the lobby.');
      navigate('/');
    });

    // Handle game ongoing
    socket.on('game-ongoing', () => {
      setGameOngoingMsg('A game is ongoing. Please wait for the next round.');
    });
    // When host starts game, grab roundDuration & handedness, then navigate
    socket.on('start-game', ({ roundDuration }) => {
      console.log('Received start-game event:', { roundDuration });
      navigate(`/game/${id}`, { state: { roundDuration, handedness } });
    });

    return () => {
      socket.off('lobby-update');
      socket.off('start-game');
      socket.off('game-ongoing');
      socket.off('lobby-peer-video');
    };
  }, [id, navigate, handedness, nickname]);

  // players is now an array of {id, nickname}
  const playerList = Array.isArray(players) ? players : [];
  // First player is the host
  const isHost = playerList.length > 0 && playerList[0].id === socket.id;
  // force rerender when webcam frames change
  const [, setWebcamFramesTick] = useState(0);

  useEffect(() => {
    // Listen for privacy updates from server
    socket.on('lobby-privacy-update', setIsPrivate);
    return () => socket.off('lobby-privacy-update', setIsPrivate);
  }, [id]);

  if (invalid) return (
    <div className="p-6 text-center text-[#a685e2] title-font text-xl font-semibold">
      Invalid lobby code. Redirecting...
    </div>
  );
  if (loading) return <div className="p-4">Loading...</div>;
  if (!joined) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#fff1e6] via-[#cddafd] to-[#bee1e6] flex flex-col items-center justify-center p-4">
      {/* Top notification for copy link */}
      {copyMsg && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-50 px-8 py-4 bg-gradient-to-r from-[#cddafd] via-[#bee1e6] to-[#fad2e1] text-[var(--color-text)] rounded-2xl shadow-2xl border-2 border-[#e2ece9] title-font tracking-wide text-lg flex items-center gap-3 transition-all duration-500 animate-fade-in">
          <span className="text-2xl flex-shrink-0"><FcCheckmark /></span>
          <span>{copyMsg}</span>
        </div>
      )}
      <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl p-8 border-2 border-[#e2ece9] flex flex-col items-center relative">
        <h1 className="title-font text-3xl font-semibold tracking-wide text-[var(--color-text)] drop-shadow-sm mb-2">Lobby <span className="text-xl font-normal">#{id}</span></h1>
        <div className="mb-6 flex gap-6 flex-wrap justify-center">
          {playerList.map(player => (
            <div key={player.id} className="flex flex-col items-center min-w-[90px] bg-gradient-to-b from-[#bee1e6]/40 to-[#fff1e6]/80 rounded-2xl p-4 shadow-md border border-[#e2ece9]">
              {player.id === socket.id ? (
                webcamEnabled ? <MiniWebcamFeed lobbyId={id} enabled={webcamEnabled} /> : <MiniRemoteWebcam peerId={player.id} lobbyId={id} frame={null} />
              ) : (
                <MiniRemoteWebcam peerId={player.id} lobbyId={id} frame={webcamFrames.current[player.id]} />
              )}
              <VoiceChat roomId={id} />
              <div className="title-font text-base mt-2 text-[var(--color-text)]">{player.nickname || player.id}</div>
              {player.id === socket.id && (
                <button className="mt-2 px-3 py-1 rounded-full bg-gradient-to-r from-[#cddafd] via-[#bee1e6] to-[#fad2e1] text-[var(--color-text)] text-xs font-semibold shadow hover:from-[#fad2e1] hover:to-[#bee1e6] transition" onClick={e => { playClick(); setWebcamEnabled(v => !v); }}>
                  {webcamEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
                </button>
              )}
              {playerList[0] && player.id === playerList[0].id && <span className="text-xs mt-1 text-[#a685e2] font-bold">Host</span>}
              {player.id === socket.id && <span className="text-xs mt-1 text-[#f28482]">(You)</span>}
            </div>
          ))}
        </div>
      {gameOngoingMsg && (
        <div className="mb-3 px-4 py-2 bg-yellow-100 text-yellow-900 rounded-2xl title-font tracking-wide shadow">
          {gameOngoingMsg}
        </div>
      )}
      <div className="mb-4 flex items-center gap-4">
        {isHost ? (
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="privacy"
                value="private"
                checked={isPrivate}
                onChange={() => {
                  setIsPrivate(true);
                  socket.emit('set-lobby-privacy', id, true);
                }}
                className="accent-[#fad2e1] w-4 h-4"
              />
              <span className="title-font">Private</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="privacy"
                value="public"
                checked={!isPrivate}
                onChange={() => {
                  setIsPrivate(false);
                  socket.emit('set-lobby-privacy', id, false);
                }}
                className="accent-[#bee1e6] w-4 h-4"
              />
              <span className="title-font">Public</span>
            </label>
          </div>
        ) : (
          <span className="text-base">Room privacy: <span className="font-semibold">{isPrivate ? 'Private' : 'Public'}</span></span>
        )}
      </div>

        <div className="flex items-center justify-center mt-2 mb-1">
          <span className="text-sm text-[#a685e2] font-medium title-font flex items-center gap-1">
            Choose your dominant hand!
          </span>
        </div>

        <div className="flex gap-6 items-center justify-center">
          <label className="flex items-center gap-2 cursor-pointer title-font">
            <input
              type="radio"
              value="right"
              checked={handedness === 'right'}
              onChange={() => setHandedness('right')}
              className="accent-[#fad2e1] w-4 h-4"
            />
            Right‑hand dominant
          </label>
         <label className="flex items-center gap-2 cursor-pointer title-font">
           <input
             type="radio"
             value="left"
             checked={handedness === 'left'}
             onChange={() => setHandedness('left')}
             className="accent-[#bee1e6] w-4 h-4"
           />
           Left‑hand dominant
         </label>
         <button
           type="button"
           aria-label="How To Play"
           className="ml-2 text-[#a685e2] hover:text-[#f28482] focus:outline-none focus:ring-2 focus:ring-[#fad2e1] rounded-full p-1 transition"
           onClick={() => setShowHowTo(true)}
         >
           <AiOutlineQuestionCircle className="text-2xl align-middle" />
         </button>
       </div>

       <HowToPlayModal open={showHowTo} onClose={() => setShowHowTo(false)} />

      {isHost && (
        <div className="mt-6 w-full flex flex-col items-center">
          <label className="title-font mb-2">
            Round duration (seconds):
            <input
              type="number"
              min={5}
              max={1200}
              value={roundDuration}
              onChange={e => {
                let val = e.target.value.replace(/^0+(?=\d)/, '');
                if (val === '' || /^[0-9]*$/.test(val)) {
                  setRoundDuration(val);
                }
              }}
              className="ml-3 w-24 px-3 py-2 rounded-full border-2 border-[#e2ece9] focus:border-[#bee1e6] focus:ring-2 focus:ring-[#cddafd]/40 text-base title-font tracking-wide transition bg-white outline-none"
            />
          </label>
          {/* Inline error message for invalid duration */}
          {roundDuration && (Number(roundDuration) < 5 || Number(roundDuration) > 1200) && (
            <span className="text-sm text-red-500 mb-2">Please enter a value between 5 and 1200.</span>
          )}
          <div className="flex items-center gap-2 mt-3">
            <button
              className="px-4 py-2 rounded-full bg-gradient-to-r from-[#fad2e1] via-[#fff1e6] to-[#bee1e6] text-[var(--color-text)] font-semibold shadow hover:from-[#bee1e6] hover:to-[#fad2e1] transition"
              onClick={async () => {
                playClick();
                await navigator.clipboard.writeText(window.location.origin + '/lobby/' + id);
                setCopyMsg('Link copied!');
                setTimeout(() => setCopyMsg(''), 1500);
              }}
            >
              Copy Invite Link
            </button>
            <button
              onClick={() => {
                playClick();
                const durationNum = Number(roundDuration);
                if (!durationNum || durationNum < 5 || durationNum > 1200) {
                  return;
                }
                socket.emit('start-game', id, durationNum);
              }}
              className="px-6 py-2 rounded-full bg-gradient-to-r from-[#bee1e6] via-[#fad2e1] to-[#fff1e6] text-[var(--color-text)] font-semibold shadow hover:from-[#fad2e1] hover:to-[#bee1e6] transition title-font tracking-wide"
              disabled={!roundDuration || Number(roundDuration) < 5 || Number(roundDuration) > 1200}
            >
              Start Game
            </button>

          </div>
        </div>
      )}
        {/* Non-hosts: Wait for host message at the very bottom */}
        {!isHost && (
          <div className="mt-8 w-full text-center text-s text-[#a685e2] title-font">
            Wait for the host to start the game!
          </div>
        )}
      </div>
    </div>
  );
}

export default Lobby;
