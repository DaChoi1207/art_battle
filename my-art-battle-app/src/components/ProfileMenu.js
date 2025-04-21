import React, { useState, useRef, useEffect } from 'react';

export default function ProfileMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef();

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-gray-500 font-medium">Playing as Guest</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200 focus:outline-none shadow"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="font-semibold">{user.username}</span>
        <span className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-300 to-pink-300 flex items-center justify-center text-lg">
          {user.username ? user.username[0].toUpperCase() : '?'}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 p-5 flex flex-col gap-3">
          <div className="flex items-center gap-3 mb-2">
            <span className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-300 to-pink-300 flex items-center justify-center text-2xl font-bold">
              {user.username ? user.username[0].toUpperCase() : '?'}
            </span>
            <div className="flex flex-col">
              <span className="font-bold text-lg leading-tight">{user.username}</span>
              <span className="text-xs text-gray-400">{user.email}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100">
              {user.auth_provider === 'google' && <span className='text-[#4285F4]'><svg width="16" height="16" viewBox="0 0 48 48"><path fill="#4285F4" d="M44.5 20H24v8.5h11.7C34.5 32.6 29.7 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c2.7 0 5.1.9 7 2.4l6.3-6.3C33.5 5.6 28.1 3.5 24 3.5 12.8 3.5 3.5 12.8 3.5 24S12.8 44.5 24 44.5c11.2 0 20.5-9.3 20.5-20.5 0-1.4-.1-2.7-.3-4z"/><path fill="#34A853" d="M6.3 14.7l7 5.1C15.5 16.2 19.4 13.5 24 13.5c2.7 0 5.1.9 7 2.4l6.3-6.3C33.5 5.6 28.1 3.5 24 3.5c-7.3 0-13.5 4.2-16.7 10.2z"/><path fill="#FBBC05" d="M24 44.5c5.7 0 10.5-1.9 14.1-5.1l-6.5-5.3c-2 1.3-4.5 2-7.6 2-5.7 0-10.5-3.9-12.2-9.1l-7 5.4C7.7 39.8 15.3 44.5 24 44.5z"/><path fill="#EA4335" d="M44.5 20H24v8.5h11.7c-1.1 3.1-4.5 7.5-11.7 7.5-6.6 0-12-5.4-12-12s5.4-12 12-12c2.7 0 5.1.9 7 2.4l6.3-6.3C33.5 5.6 28.1 3.5 24 3.5c-7.3 0-13.5 4.2-16.7 10.2z"/></svg></span>}
              {user.auth_provider === 'discord' && <span className='text-[#5865F2]'><svg width="16" height="16" viewBox="0 0 127.14 96.36"><g><path fill="#5865F2" d="M107.46 8.62A105.15 105.15 0 0 0 81.13.36a.38.38 0 0 0-.4.19c-1.7 3-3.6 6.93-4.9 10.06a99.13 99.13 0 0 0-29.5 0c-1.32-3.15-3.2-7-4.9-10.06a.37.37 0 0 0-.4-.19A105.2 105.2 0 0 0 19.68 8.62a.34.34 0 0 0-.16.13C3.21 32.23-1.18 55.13.43 77.7a.4.4 0 0 0 .15.27c12.6 9.25 24.85 14.86 36.89 18.53a.38.38 0 0 0 .41-.14c2.84-3.87 5.37-7.95 7.48-12.23a.37.37 0 0 0-.2-.51c-4-1.53-7.83-3.34-11.56-5.38a.37.37 0 0 1-.04-.62c.78-.59 1.56-1.2 2.31-1.81a.38.38 0 0 1 .39-.06c24.3 11.13 50.6 11.13 74.82 0a.38.38 0 0 1 .4.05c.75.61 1.53 1.22 2.31 1.81a.37.37 0 0 1-.03.62c-3.73 2.04-7.56 3.85-11.56 5.38a.37.37 0 0 0-.2.51c2.11 4.28 4.64 8.36 7.48 12.23a.38.38 0 0 0 .41.14c12.05-3.67 24.3-9.28 36.89-18.53a.4.4 0 0 0 .15-.27c1.64-22.57-2.74-45.47-19.09-68.95a.34.34 0 0 0-.16-.13zM42.13 65.94c-7.07 0-12.87-6.5-12.87-14.5s5.7-14.5 12.87-14.5c7.18 0 12.88 6.5 12.88 14.5s-5.7 14.5-12.88 14.5zm42.88 0c-7.07 0-12.87-6.5-12.87-14.5s5.7-14.5 12.87-14.5c7.18 0 12.88 6.5 12.88 14.5s-5.7 14.5-12.88 14.5z"/></g></svg></span>}
              <span className="capitalize font-semibold">{user.auth_provider}</span>
            </span>
          </div>
          <div className="flex gap-3 justify-between mt-2">
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
            onClick={onLogout}
            className="w-full px-3 py-2 mt-3 rounded bg-gradient-to-r from-red-100 to-pink-100 hover:from-red-200 hover:to-pink-200 text-red-700 font-semibold text-sm shadow-sm border border-red-200"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
