import React, { useState } from 'react';
import { setClickSfxVolume } from '../utils/useClickSfx';
import { FaCog } from 'react-icons/fa';

export default function SfxSettings() {
  const [musicVolume, setMusicVolume] = useState(() => {
    const saved = localStorage.getItem('musicVolume');
    return saved !== null ? Number(saved) : 50;
  });
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

  const handleMusicVolumeChange = e => {
    const val = Number(e.target.value);
    setMusicVolume(val);
    localStorage.setItem('musicVolume', val);
    window.dispatchEvent(new CustomEvent('music-volume-change', { detail: val }));
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
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/20"
            onClick={() => setOpen(false)}
          />
          {/* Popup */}
          <div
            className="mt-2 p-6 bg-white/90 rounded-3xl shadow-2xl border-2 border-[#e2ece9] flex flex-col items-center min-w-[220px] animate-fade-in absolute left-0 top-12 z-50"
            onClick={e => e.stopPropagation()}
          >
            <span className="mb-3 text-lg text-[#22223b] title-font tracking-wide">SFX Volume</span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={handleVolumeChange}
              className="w-full accent-pink-400 h-2 rounded-lg outline-none transition-all duration-200 mb-2"
              aria-label="SFX Volume"
            />
            <span className="mt-1 text-sm text-[#6c757d] fun-font bg-white/60 px-3 py-1 rounded-full shadow">{volume}%</span>

            <span className="mb-3 mt-4 text-lg text-[#22223b] title-font tracking-wide">Music Volume</span>
            <input
              type="range"
              min="0"
              max="100"
              value={musicVolume}
              onChange={handleMusicVolumeChange}
              className="w-full accent-pink-400 h-2 rounded-lg outline-none transition-all duration-200 mb-2"
              aria-label="Music Volume"
            />
            <span className="mt-1 text-sm text-[#6c757d] fun-font bg-white/60 px-3 py-1 rounded-full shadow">{musicVolume}%</span>
          </div>
        </>
      )}
    </div>
  );
}
