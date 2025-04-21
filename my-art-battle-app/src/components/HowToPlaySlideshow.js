import { useEffect, useRef, useState } from 'react';

const SLIDES = [
  {
    title: 'Gather Friends',
    desc: 'Join or create a lobby with your friends!'
  },
  {
    title: 'Turn on Camera',
    desc: 'Bring your biggest smiles and turn on your webcam!'
  },
  {
    title: 'Start Drawing!',
    desc: 'Use your hands to draw on the screen using gesture controls.'
  },
  {
    title: 'Beat Everyone!',
    desc: 'Compete to draw the best and beat your friends!'
  }
];

export default function HowToPlaySlideshow({ onGestureClick }) {
  const [idx, setIdx] = useState(0);
  const timeoutRef = useRef();

  useEffect(() => {
    timeoutRef.current = setTimeout(() => {
      setIdx(i => (i + 1) % SLIDES.length);
    }, 4000);
    return () => clearTimeout(timeoutRef.current);
  }, [idx]);

  return (
    <div className="w-full flex flex-col items-center justify-center">
      <div className="bg-transparent rounded-xl border-2 border-[#bfc9d1] p-4 w-full mb-2 transition-all duration-300 min-h-[90px] h-[110px] flex flex-col items-center justify-center">
        <div className="text-xl font-bold text-[#5b5f97] mb-2">{idx + 1}. {SLIDES[idx].title}</div>
        <div className="text-base text-gray-700 text-center">{SLIDES[idx].desc}</div>
      </div>
      <div className="flex gap-2 mb-4">
        {SLIDES.map((_, i) => (
          <span
            key={i}
            className={`w-3 h-3 rounded-full ${i === idx ? 'bg-[#5b5f97]' : 'bg-gray-300'} transition-all`}
          />
        ))}
      </div>
      <button
        onClick={onGestureClick}
        className="w-full px-4 py-2 rounded-full bg-gradient-to-r from-blue-100 via-pink-100 to-purple-100 text-blue-900 font-semibold text-base border border-blue-200 flex items-center justify-center gap-2 hover:scale-105 hover:shadow-lg transition-transform duration-150"
      >
        Gesture Control
      </button>
    </div>
  );
}
