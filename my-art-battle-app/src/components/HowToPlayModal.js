import { IoMdClose } from "react-icons/io";

export default function HowToPlayModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border-2 border-[#e2ece9] animate-fade-in title-font"
        onClick={e => e.stopPropagation()}
      >
        <button
          className="absolute top-3 right-3 text-2xl text-[#f28482] hover:text-[#a685e2] focus:outline-none"
          onClick={onClose}
          aria-label="Close"
        >
          <IoMdClose />
        </button>

        <h2 className="text-2xl font-bold mb-4 text-center text-[#5b5f97]">Gesture Controls</h2>

        <ul className="space-y-3 text-base text-gray-700 mb-6">
          <li>☝️ <span className="font-bold text-[#a685e2]">One Finger</span> = Draw</li>
          <li>✌️ <span className="font-bold text-[#a685e2]">Two Fingers</span> = Erase</li>
          <li>🖖 <span className="font-bold text-[#a685e2]">Three Fingers</span> = Change Color</li>
          <li>✋ <span className="font-bold text-[#a685e2]">Open Palm</span> = Resize Brush</li>
        </ul>

        <div className="text-sm text-[#a685e2] mt-4 text-center">Tip: Use a nickname and invite your friends for more fun!</div>
      </div>
    </div>
  );
}
