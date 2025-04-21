import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import socket from '../socket';
import Toast from './Toast';
import '../index.css';    // ← make sure this is here!
import { FcHighPriority } from "react-icons/fc";
import { GoogleIcon, DiscordIcon } from './AuthIcons';
import HowToPlayModal from "./HowToPlayModal";
import HowToPlaySlideshow from "./HowToPlaySlideshow";
import { openOAuthPopup } from '../utils/auth';
import ProfileMenu from './ProfileMenu';

export default function Home() {
  const [showHowTo, setShowHowTo] = useState(false);
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  const [toast, setToast] = useState({ show: false, message: '' });
  const showToast = (message) => setToast({ show: true, message });

  // Check authentication on mount
  useEffect(() => {
    fetch('http://localhost:3001/profile', { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(setUser);
  }, []);

  const handleLogin = (provider) => {
    openOAuthPopup(provider, () => {
      fetch('http://localhost:3001/profile', { credentials: 'include' })
        .then(res => res.ok ? res.json() : null)
        .then(setUser);
    });
  };

  const handleLogout = () => {
    fetch('http://localhost:3001/logout', { credentials: 'include' })
      .then(() => setUser(null));
  };

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
      {/* Auth/Profile Bar */}
      <div className="w-full flex justify-end p-4">
        <ProfileMenu user={user} onLogout={handleLogout} />
      </div>
      {/* How To Play Button - on corner of main box */}
      <div
        className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-[#f0efeb] via-[#cddafd] to-[#fad2e1] px-4"
      >
        <div className="relative w-full max-w-4xl bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl p-0 flex flex-row items-stretch border-2 border-[#e2ece9] overflow-hidden">
          {/* Left Section: Main Actions */}
          <div className="flex-1 p-10 flex flex-col items-center space-y-6">
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

          {/* Right Section: How To Play + Authentication */}
          <div className="flex flex-col justify-between items-center w-96 bg-gradient-to-br from-[#e0c3fc] via-[#b9deff] to-[#bee1e6] p-6 border-l-2 border-[#e2ece9]">
            {/* How To Play Slideshow (top half) */}
            <div className="w-full flex flex-col items-center justify-center mb-2 mt-4">
              <h2 className="text-2xl font-bold mb-2 text-gray-800">How To Play</h2>
              <HowToPlaySlideshow onGestureClick={() => setShowHowTo(true)} />
            </div>
            {/* Authentication (bottom half) */}
            <div className="w-full flex flex-col items-center justify-end flex-1 mt-2">
              {!user ? (
                <>
                  <h2 className="text-2xl font-bold mb-6 text-gray-800">Authenticate</h2>
                  <button
                    onClick={() => handleLogin('google')}
                    className="w-full px-4 py-3 rounded-full bg-gradient-to-r from-blue-100 via-pink-100 to-purple-100 text-blue-900 font-semibold text-lg mb-4 border border-blue-200 flex items-center justify-center gap-2 hover:scale-105 hover:shadow-lg transition-transform duration-150"
                  >
                    <GoogleIcon className="w-5 h-5 relative top-[1px]" /> Login with Google
                  </button>
                  <button
                    onClick={() => handleLogin('discord')}
                    className="w-full px-4 py-3 rounded-full bg-gradient-to-r from-blue-100 via-pink-100 to-purple-100 text-indigo-900 font-semibold text-lg border border-blue-200 flex items-center justify-center gap-2 hover:scale-105 hover:shadow-lg transition-transform duration-150"
                  >
                    <DiscordIcon className="w-5 h-5 relative top-[1px]" /> Login with Discord
                  </button>
                  <div className="mt-4 text-xs text-gray-600 text-center">
                    Or continue as guest<br/>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center w-full">
                  <div className="mb-4">
                    <span className="text-lg font-semibold text-gray-700">Welcome, {user.username}!</span>
                  </div>
                  <div className="w-full flex flex-col gap-2 bg-white/80 rounded-lg p-4 shadow">
                    <div className="text-sm text-gray-500">Email: {user.email}</div>
                    <div className="text-sm text-gray-500">Provider: {user.auth_provider}</div>
                    <div className="text-sm text-gray-500">Games Played: {user.games_played ?? 0}</div>
                    <div className="text-sm text-gray-500">Games Won: {user.games_won ?? 0}</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="mt-6 w-full px-4 py-2 rounded bg-red-100 hover:bg-red-200 text-red-700 font-semibold text-sm shadow"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </>
  );
}
