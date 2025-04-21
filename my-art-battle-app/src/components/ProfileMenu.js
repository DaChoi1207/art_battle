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
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 z-50 p-4 flex flex-col gap-2">
          <div className="font-semibold text-lg mb-1">{user.username}</div>
          <div className="text-xs text-gray-500 mb-2">{user.email}</div>
          <div className="text-xs text-gray-400 mb-2">Provider: {user.auth_provider}</div>
          <div className="text-xs text-gray-700 mb-2">Games Played: {user.games_played ?? 0}</div>
          <div className="text-xs text-gray-700 mb-2">Games Won: {user.games_won ?? 0}</div>
          <button
            onClick={onLogout}
            className="w-full px-3 py-2 mt-2 rounded bg-red-100 hover:bg-red-200 text-red-700 font-semibold text-sm"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
