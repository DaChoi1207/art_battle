import { useCallback } from 'react';

const clickUrl = process.env.PUBLIC_URL + '/click-soft.mp3';

let audio = null;
// The new maximum volume is 0.6 (instead of 1.0)
let globalVolume = 0.6;

export function setClickSfxVolume(vol) {
  // vol is 0-1 from the UI. Scale so 1 becomes 0.6 actual volume.
  globalVolume = Math.max(0, Math.min(1, vol)) * 0.6;
  if (audio) audio.volume = globalVolume;
}

export default function useClickSfx() {
  return useCallback(() => {
    if (!audio) {
      audio = new window.Audio(clickUrl);
      audio.volume = globalVolume;
    } else {
      audio.currentTime = 0;
    }
    audio.play();
  }, []);
}
