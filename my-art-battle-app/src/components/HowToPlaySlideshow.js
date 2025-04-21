import { useEffect, useRef, useState } from 'react';



const SLIDES = [
  {
    title: 'CALL YOUR FRIENDS!',
    desc: 'Join or create a lobby with your friends! Or, join a public lobby!'
  },
  {
    title: 'SMILE!',
    desc: 'Bring your biggest smiles and turn on your webcam!'
  },
  {
    title: 'DRAW!',
    desc: 'Use your hands to draw on the screen using gesture controls.'
  },
  {
    title: 'BEAT EVERYONE!',
    desc: 'Compete to draw the best and beat your friends!'
  }
];

export default function HowToPlaySlideshow({ onGestureClick }) {
  const SLIDE_DURATION = 12000; // ms
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0); // 0-1
  const timeoutRef = useRef();
  const intervalRef = useRef();

  useEffect(() => {
    setProgress(0);
    let start = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(elapsed / SLIDE_DURATION, 1));
    }, 50);
    timeoutRef.current = setTimeout(() => {
      setIdx(i => (i + 1) % SLIDES.length);
    }, SLIDE_DURATION);
    return () => {
      clearTimeout(timeoutRef.current);
      clearInterval(intervalRef.current);
    };
  }, [idx]);

  // Manual navigation (now: click perimeter)
  const advance = () => {
    setIdx(i => (i + 1) % SLIDES.length);
    clearTimeout(timeoutRef.current);
    clearInterval(intervalRef.current);
  };
  // Keyboard accessibility
  const handleKeyDown = e => {
    if (e.key === 'Enter' || e.key === ' ') advance();
  };

  return (
    <div className="w-full flex flex-col items-center justify-center">
       <div
          className="bg-transparent rounded-xl border-2 border-[#bfc9d1] p-4 w-full mb-4 transition-all duration-300 min-h-[90px] flex flex-col items-center justify-center cursor-pointer select-none"
          role="button"
          aria-label="Go to next slide"
          tabIndex={0}
          onClick={advance}
          onKeyDown={handleKeyDown}
        >
        <div className="title-font tracking-wide font-bold text-2xl text-[#5b5f97] mb-2">{idx + 1}. {SLIDES[idx].title}</div>
        <div className="title-font tracking-wide text-base text-[#5b5f97] font-semibold text-center mb-2">{SLIDES[idx].desc}</div>
        <div className="flex gap-2 mt-2">
          {SLIDES.map((_, i) => {
            const size = 24;
            const stroke = 3;
            const radius = (size - stroke) / 2;
            const circ = 2 * Math.PI * radius;
            const pct = i === idx ? progress : i < idx ? 1 : 0;
            return (
              <span key={i} style={{ width: size, height: size, display: 'inline-block', position: 'relative' }}>
                <svg width={size} height={size}>
                  <circle
                    cx={size/2}
                    cy={size/2}
                    r={radius}
                    fill="#fff"
                    stroke="#e2ece9"
                    strokeWidth={stroke}
                  />
                  <circle
                    cx={size/2}
                    cy={size/2}
                    r={radius}
                    fill="none"
                    stroke="#5b5f97"
                    strokeWidth={stroke}
                    strokeDasharray={circ}
                    strokeDashoffset={circ * (1 - pct)}
                    style={{ transition: i === idx ? 'none' : 'stroke-dashoffset 0.3s',
                             filter: i === idx ? 'drop-shadow(0 0 2px #5b5f97)' : undefined }}
                  />
                </svg>
                <span
                  className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${i === idx ? 'bg-[#5b5f97]' : 'bg-gray-300'} transition-all`}
                  style={{ zIndex: 2 }}
                />
              </span>
            );
          })}
        </div>
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
