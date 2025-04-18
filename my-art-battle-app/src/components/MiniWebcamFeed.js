import React, { useEffect, useRef } from 'react';
import socket from '../socket';

// Mini webcam for lobby (local user)
export function MiniWebcamFeed({ lobbyId, enabled }) {
  const videoRef = useRef(null);
  const intervalRef = useRef(null);

  useEffect(() => {
    let stream;
    if (!enabled) return;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) videoRef.current.srcObject = stream;
        // Send frames every 100ms, lower JPEG quality
        intervalRef.current = setInterval(() => {
          if (!videoRef.current) return;
          const canvas = document.createElement('canvas');
          canvas.width = 160;
          canvas.height = 120;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const image = canvas.toDataURL('image/jpeg', 0.3);
          socket.emit('lobby-video-frame', { lobbyId, image });
        }, 100);
      } catch (err) {
        // ignore
      }
    })();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [enabled, lobbyId]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      width={80}
      height={60}
      style={{ borderRadius: 8, background: '#222', objectFit: 'cover', width: 80, height: 60 }}
    />
  );
}

// Mini remote webcam (for remote users)
export function MiniRemoteWebcam({ peerId, lobbyId, frame }) {
  return frame ? (
    <img
      src={frame}
      alt={`Webcam of ${peerId}`}
      width={80}
      height={60}
      style={{ borderRadius: 8, background: '#222', objectFit: 'cover', width: 80, height: 60 }}
    />
  ) : (
    <div style={{ width: 80, height: 60, borderRadius: 8, background: '#bbb', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', fontSize: 14 }}>
      <span>🙈</span>
    </div>
  );
}
