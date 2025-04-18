import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';
import Toast from './Toast';
import '../index.css';    // ← make sure this is here!
import { FcHighPriority } from "react-icons/fc";
import HowToPlayModal from "./HowToPlayModal";

export default function Home() {
  const [showHowTo, setShowHowTo] = useState(false);
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const navigate = useNavigate();

  const [toast, setToast] = useState({ show: false, message: '' });
  const showToast = (message) => setToast({ show: true, message });

  const create = () => {
    socket.emit('create-lobby', (lobbyId) => {
      navigate(`/lobby/${lobbyId}`, {
        state: { nickname: nickname.trim() || undefined }
      });
    });
  };

  const join = () => {
    socket.emit(
      'join-lobby',
      code,
      nickname.trim() || undefined,
      ok => {
        if (ok)
          navigate(`/lobby/${code}`, {
            state: { nickname: nickname.trim() || undefined }
          });
        else showToast('Invalid lobby code!');
      }
    );
  };

  useEffect(() => {
    const handler = () => {
      setNickname('');
      showToast('You have been kicked from the lobby.');
      navigate('/');
    };
    socket.on('kicked', handler);
    return () => void socket.off('kicked', handler);
  }, [navigate]);

  const joinPublic = () => {
    socket.emit(
      'join-random-public-room',
      nickname.trim() || undefined,
      ok => {
        if (typeof ok === 'string') {
          navigate(`/lobby/${ok}`, {
            state: { nickname: nickname.trim() || undefined }
          });
        } else {
          showToast('No public rooms available!');
        }
      }
    );
  };

  return (
    <>
      <Toast
        message={toast.message}
        show={toast.show}
        onClose={() => setToast({ ...toast, show: false })}
        icon={toast.message ? <FcHighPriority /> : null}
      />
      <HowToPlayModal open={showHowTo} onClose={() => setShowHowTo(false)} />
      <div
        className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#f0efeb] via-[#cddafd] to-[#fad2e1] px-4"
      >
        <div className="relative w-full max-w-md bg-white/80 backdrop-blur-sm rounded-3xl shadow-2xl p-8 flex flex-col items-center space-y-6 border-2 border-[#e2ece9]">
          {/* How To Play Button */}
          <button
            onClick={() => setShowHowTo(true)}
            type="button"
            className="absolute left-0 top-0 -translate-x-1/3 -translate-y-1/3 -rotate-[36deg] bg-gradient-to-r from-[#fad2e1] via-[#bee1e6] to-[#fff1e6] text-[#a685e2] px-5 py-2 rounded-[1.5rem] border-2 border-[#e2ece9] shadow-xl drop-shadow text-lg font-extrabold tracking-wide title-font scale-y-105 scale-x-100 select-none transition-all duration-200 hover:scale-110 hover:shadow-[0_4px_16px_0_rgba(250,210,225,0.5)] hover:border-[#fad2e1] focus:outline-none focus:ring-2 focus:ring-[#fad2e1] focus:ring-opacity-50"
            style={{ zIndex: 10, textShadow: '0 2px 6px #fff, 0 1px 0 #fff' }}
          >
            How To Play?
          </button>

          {/* Logo */}
          <div className="w-24 h-24 rounded-full bg-[#bee1e6] flex items-center justify-center shadow-inner">
            <span className="text-5xl select-none">🎨</span>
          </div>

          {/* Title */}
          <h1 className="text-4xl font-semibold title-font tracking-wide text-[var(--color-text)] text-center drop-shadow-sm">
            DrawLive
          </h1>

          {/* Nickname + Actions */}
          <div className="w-full space-y-4">
            <input
              type="text"
              placeholder="Enter Your Nickname!"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              className="
                w-full title-font tracking-wide
                bg-white border-2 border-[#e2ece9]
                focus:border-[#bfc9d1] focus:ring-2 focus:ring-[#e2ece9]/60
                text-lg py-3 px-4
                rounded-full
                transition
                placeholder:title-font placeholder:tracking-wide
              "
              maxLength={18}
            />
            <button
              onClick={create}
              className="
                w-full
                bg-gradient-to-r from-[#cddafd] via-[#dfe7fd] to-[#bee1e6]
                text-[var(--color-text)] font-semibold
                py-3
                rounded-full
                shadow-lg hover:shadow-2xl
                transform hover:-translate-y-1
                transition
                border border-[#e2ece9]
                hover:from-[#bee1e6] hover:via-[#f0efeb] hover:to-[#fad2e1]
              "
            >
              Create Lobby
            </button>
            <button
              onClick={joinPublic}
              className="
                w-full
                bg-gradient-to-r from-[#fde2e4] via-[#fad2e1] to-[#fff1e6]
                text-[var(--color-text)] font-semibold
                py-3
                rounded-full
                shadow-lg hover:shadow-2xl
                transform hover:-translate-y-1
                transition
                border border-[#eae4e9]
                hover:from-[#fad2e1] hover:via-[#fff1e6] hover:to-[#e2ece9]
              "
            >
              Join Public Room
            </button>
          </div>

          {/* Join by Code */}
          <div className="w-full flex gap-3">
            <input
              type="text"
              placeholder="Have a Lobby Code?"
              value={code}
              onChange={e => setCode(e.target.value)}
              className="
                flex-1 title-font tracking-wide
                bg-white border-2 border-[#e2ece9]
                focus:border-[#bfc9d1] focus:ring-2 focus:ring-[#e2ece9]/60
                text-lg py-3 px-4
                rounded-full
                transition
                placeholder:title-font placeholder:tracking-wide
              "
            />
            <button
              onClick={join}
              className="
                bg-gradient-to-r from-[#fde2e4] via-[#fad2e1] to-[#fff1e6]
                text-[var(--color-text)] font-semibold
                py-3 px-6
                rounded-full
                shadow-lg hover:shadow-2xl
                transform hover:-translate-y-1
                transition
                border border-[#eae4e9]
                hover:from-[#fad2e1] hover:via-[#fff1e6] hover:to-[#e2ece9]
              "
            >
              Join
            </button>
          </div>
        </div>
      </div>
  </>
);
}
