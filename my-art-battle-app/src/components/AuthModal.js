import React from 'react';

import useClickSfx from '../utils/useClickSfx';

export default function AuthModal({ open, onClose, onLogin }) {
  const playClick = useClickSfx();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-xl shadow-2xl p-8 flex flex-col gap-4 min-w-[300px] relative">
        <button
          onClick={e => { playClick(); onClose(e); }}
          className="absolute top-2 right-2 text-gray-400 hover:text-gray-700 text-xl font-bold"
          aria-label="Close"
        >
          ×
        </button>
        <h2 className="text-2xl font-semibold mb-2 text-center">Authenticate</h2>
        <button
          onClick={e => { playClick(); onLogin('google'); }}
          className="w-full px-4 py-3 rounded bg-blue-100 hover:bg-blue-200 text-blue-900 font-semibold text-lg mb-2"
        >
          Login with Google
        </button>
        <button
          onClick={e => { playClick(); onLogin('discord'); }}
          className="w-full px-4 py-3 rounded bg-indigo-100 hover:bg-indigo-200 text-indigo-900 font-semibold text-lg"
        >
          Login with Discord
        </button>
      </div>
    </div>
  );
}
