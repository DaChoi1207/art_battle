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
        <h2 className="header-font text-2xl font-bold mb-4 text-center text-[#a685e2]">Gesture Controls!</h2>

        <div className="mt-6">
          <div className="text-sm text-[#a685e2] mb-2 text-center font-semibold">Choose your dominant hand in the lobby!</div>
          {/* <h3 className="text-lg font-bold text-[#a685e2] mb-2 text-center">Hand Gesture Controls</h3> */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Non-Dominant Hand */}
            <div className="flex-1 bg-[#f8fafc] rounded-xl p-4 border border-[#e2ece9]">
              <h4 className="font-semibold text-[#a685e2] mb-2 text-center">Non-Dominant Hand (Controls)</h4>
              <ul className="space-y-1 text-base text-[var(--color-text)]">
                <li>☝️ <span className="font-bold text-[#a685e2]">Pointer:</span> Draw Mode</li>
                <li>✌️ <span className="font-bold text-[#a685e2]">Two Fingers:</span> Erase Mode</li>
                <li>🖖 <span className="font-bold text-[#a685e2]">Three Fingers:</span> Size Control</li>
                <li>🖐️ <span className="font-bold text-[#a685e2]">Five Fingers:</span> Colour Select</li>
                <li>🤟 <span className="font-bold text-[#a685e2]">Yolo:</span> Clear Board</li>
              </ul>
            </div>
            {/* Dominant Hand */}
            <div className="flex-1 bg-[#f8fafc] rounded-xl p-4 border border-[#e2ece9]">
              <h4 className="font-semibold text-[#a685e2] mb-2 text-center">Dominant Hand (Draw)</h4>
              <ul className="space-y-1 text-base text-[var(--color-text)]">
                <li>☝️ <span className="font-bold text-[#a685e2]">Pointer:</span> Draw/Erase</li>
                <li>🖖 <span className="font-bold text-[#a685e2]">Pointer and Thumb:</span> Pinch to resize</li>
                <li>🖐️ <span className="font-bold text-[#a685e2]">Five Fingers:</span> Pick a Colour (a different colour corresponding to the number of fingers held up!)</li>
                {/* <ul className="ml-6 space-y-0.5 text-sm text-[var(--color-text)]">
                  <li>☝️ <span className="font-bold text-[#a685e2]">Pointer</span> = Colour 1</li>
                  <li>✌️ <span className="font-bold text-[#a685e2]">Two Fingers</span> = Colour 2</li>
                  <li>🖖 <span className="font-bold text-[#a685e2]">Three Fingers</span> = Colour 3</li>
                  <li>✋ <span className="font-bold text-[#a685e2]">Four Fingers</span> = Colour 4</li>
                  <li>🖐️ <span className="font-bold text-[#a685e2]">Open Palm</span> = Colour 5</li>
                </ul> */}
              </ul>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}