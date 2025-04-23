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
    fetch(`${process.env.REACT_APP_API_URL}/profile`, { credentials: 'include' })
      .then(res => res.ok ? res.json() : null)
      .then(profile => {
        setUser(profile);
        if (profile && profile.id) {
          socket.emit('identify-user', profile.id);
        }
      });

    // Listen for OAuth success message from popup
    function handleOAuthMessage(e) {
      // Only accept messages from your backend origin in production
      if (e.origin === process.env.REACT_APP_API_URL && e.data === "oauth-success") {
        fetch(`${process.env.REACT_APP_API_URL}/profile`, { credentials: 'include' })
          .then(res => res.ok ? res.json() : null)
          .then(profile => {
            console.log('[Home.js] OAuth /profile fetch result:', profile);
            setUser(profile);
            if (profile && profile.id) {
              socket.emit('identify-user', profile.id);
            }
          });
      }
    }
    window.addEventListener('message', handleOAuthMessage);
    return () => window.removeEventListener('message', handleOAuthMessage);
  }, []);

  const handleLogin = (provider) => {
    openOAuthPopup(provider, () => {
      fetch(`${process.env.REACT_APP_API_URL}/profile`, { credentials: 'include' }).then(res => res.ok ? res.json() : null)
        .then(profile => {
          setUser(profile);
          if (profile && profile.id) {
            socket.emit('identify-user', profile.id);
          }
        });
    });
  };

  const handleLogout = () => {
    fetch(`${process.env.REACT_APP_API_URL}/logout`, { credentials: 'include' })
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
      {/* ProfileMenu floating in top-right */}
      <div style={{ position: 'absolute', top: 20, right: 24, zIndex: 50 }}>
        <ProfileMenu user={user} onLogout={handleLogout} onProfileUpdate={setUser} />
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
              DrawCam
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
                    Or continue as guest<br />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center w-full">
                  <div className="flex items-center justify-center mb-4 w-full">
                    <span className="title-font tracking-wide text-2xl text-gray-800">Welcome, {user.username}!</span>
                  </div>
                  {/* <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100">
                      {user.auth_provider === 'google' && <span className='text-[#4285F4]'><svg width='16' height='16' viewBox='0 0 48 48'><path fill='#4285F4' d='M44.5 20H24v8.5h11.7C34.5 32.6 29.7 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c2.7 0 5.1.9 7 2.4l6.3-6.3C33.5 5.6 28.1 3.5 24 3.5 12.8 3.5 3.5 12.8 3.5 24S12.8 44.5 24 44.5c11.2 0 20.5-9.3 20.5-20.5 0-1.4-.1-2.7-.3-4z'/><path fill='#34A853' d='M6.3 14.7l7 5.1C15.5 16.2 19.4 13.5 24 13.5c2.7 0 5.1.9 7 2.4l6.3-6.3C33.5 5.6 28.1 3.5 24 3.5c-7.3 0-13.5 4.2-16.7 10.2z'/><path fill='#FBBC05' d='M24 44.5c5.7 0 10.5-1.9 14.1-5.1l-6.5-5.3c-2 1.3-4.5 2-7.6 2-5.7 0-10.5-3.9-12.2-9.1l-7 5.4C7.7 39.8 15.3 44.5 24 44.5z'/><path fill='#EA4335' d='M44.5 20H24v8.5h11.7c-1.1 3.1-4.5 7.5-11.7 7.5-6.6 0-12-5.4-12-12s5.4-12 12-12c2.7 0 5.1.9 7 2.4l6.3-6.3C33.5 5.6 28.1 3.5 24 3.5c-7.3 0-13.5 4.2-16.7 10.2z'/></svg></span>}
                      {user.auth_provider === 'discord' && <span className='text-[#5865F2]'><svg width='16' height='16' viewBox='0 0 127.14 96.36'><g><path fill='#5865F2' d='M107.46 8.62A105.15 105.15 0 0 0 81.13.36a.38.38 0 0 0-.4.19c-1.7 3-3.6 6.93-4.9 10.06a99.13 99.13 0 0 0-29.5 0c-1.32-3.15-3.2-7-4.9-10.06a.37.37 0 0 0-.4-.19A105.2 105.2 0 0 0 19.68 8.62a.34.34 0 0 0-.16.13C3.21 32.23-1.18 55.13.43 77.7a.4.4 0 0 0 .15.27c12.6 9.25 24.85 14.86 36.89 18.53a.38.38 0 0 0 .41-.14c2.84-3.87 5.37-7.95 7.48-12.23a.37.37 0 0 0-.2-.51c-4-1.53-7.83-3.34-11.56-5.38a.37.37 0 0 1-.04-.62c.78-.59 1.56-1.2 2.31-1.81a.38.38 0 0 1 .39-.06c24.3 11.13 50.6 11.13 74.82 0a.38.38 0 0 1 .4.05c.75.61 1.53 1.22 2.31 1.81a.37.37 0 0 1-.03.62c-3.73 2.04-7.56 3.85-11.56 5.38a.37.37 0 0 0-.2.51c2.11 4.28 4.64 8.36 7.48 12.23a.38.38 0 0 0 .41.14c12.05-3.67 24.3-9.28 36.89-18.53a.4.4 0 0 0 .15-.27c1.64-22.57-2.74-45.47-19.09-68.95a.34.34 0 0 0-.16-.13zM42.13 65.94c-7.07 0-12.87-6.5-12.87-14.5s5.7-14.5 12.87-14.5c7.18 0 12.88 6.5 12.88 14.5s-5.7 14.5-12.88 14.5zm42.88 0c-7.07 0-12.87-6.5-12.87-14.5s5.7-14.5 12.87-14.5c7.18 0 12.88 6.5 12.88 14.5s-5.7 14.5-12.88 14.5z'/></g></svg></span>}
                      <span className='capitalize font-semibold'>{user.auth_provider}</span>
                    </span>
                  </div> */}
                  <div className="flex gap-3 justify-between mt-2 w-full max-w-xs">
                    <div className="flex-1 flex flex-col items-center bg-blue-50 rounded-lg py-2">
                      <span className="text-xs text-gray-400">Games Played</span>
                      <span className="font-bold text-xl text-blue-900">{user.games_played ?? 0}</span>
                    </div>
                    <div className="flex-1 flex flex-col items-center bg-pink-50 rounded-lg py-2">
                      <span className="text-xs text-gray-400">Games Won</span>
                      <span className="font-bold text-xl text-pink-900">{user.games_won ?? 0}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="mt-6 w-full px-4 py-2 rounded bg-gradient-to-r from-red-100 to-pink-100 hover:from-red-200 hover:to-pink-200 text-red-700 font-semibold text-sm shadow-sm border border-red-200"
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
