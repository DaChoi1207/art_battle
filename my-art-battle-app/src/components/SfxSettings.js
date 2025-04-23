import React, { useState } from 'react';
import { setClickSfxVolume } from '../utils/useClickSfx';
import { FaCog } from 'react-icons/fa';

export default function SfxSettings() {
  const [open, setOpen] = useState(false);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('sfxVolume');
    return saved !== null ? Number(saved) : 50;
  });

  const handleVolumeChange = e => {
    const val = Number(e.target.value);
    setVolume(val);
    setClickSfxVolume(val / 100);
    localStorage.setItem('sfxVolume', val);
  };

  return (
    <div className="fixed top-4 left-4 z-50">
      <button
        className="bg-white/80 hover:bg-white/100 p-2 rounded-full shadow-lg border border-[#e2ece9] focus:outline-none"
        aria-label="SFX Settings"
        onClick={() => setOpen(v => !v)}
      >
        <FaCog className="text-2xl text-gray-700" />
      </button>
      {open && (
        <div className="mt-2 p-4 bg-white/95 rounded-2xl shadow-2xl border border-[#e2ece9] flex flex-col items-center min-w-[200px] animate-fade-in">
          <span className="font-semibold mb-2 text-gray-800">SFX Volume</span>
          <input
            type="range"
            min="0"
            max="100"
            value={volume}
            onChange={handleVolumeChange}
            className="w-full accent-pink-400"
            aria-label="SFX Volume"
          />
          <span className="mt-1 text-xs text-gray-500">{volume}%</span>
        </div>
      )}
    </div>
  );
}
