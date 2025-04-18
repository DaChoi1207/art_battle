import { useEffect } from 'react';

export default function Toast({ message, show, onClose, duration = 1400, icon }) {
  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [show, duration, onClose]);

  return (
    <div
      className={`
        fixed left-1/2 top-8 z-50
        -translate-x-1/2
        px-8 py-4
        bg-gradient-to-r from-[#cddafd] via-[#bee1e6] to-[#fad2e1]
        text-[var(--color-text)]
        rounded-2xl shadow-2xl
        border-2 border-[#e2ece9]
        title-font tracking-wide
        text-lg
        transition-all duration-500
        ${show ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}
      `}
      role="alert"
      style={{ fontFamily: 'var(--font-title)' }}
    >
      <div className="flex items-center gap-3">
        {icon && <span className="text-2xl flex-shrink-0">{icon}</span>}
        <span>{message}</span>
      </div>
    </div>
  );
}
