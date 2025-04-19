import React, { useEffect, useRef } from "react";

/**
 * Renders a popover that closes when clicking outside of it.
 * Usage:
 * <ColorPopover onClose={() => ...}> ...children... </ColorPopover>
 */
export default function ColorPopover({ children, onClose }) {
  const popoverRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div ref={popoverRef} className="absolute z-40 top-14 left-1/2 -translate-x-1/2 bg-white border-2 border-[#e2ece9] shadow-2xl rounded-xl p-3 flex flex-col items-center animate-fade-in min-w-[160px]" style={{ minWidth: 180 }}>
      {children}
    </div>
  );
}
