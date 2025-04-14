import React, { useRef, useEffect, useState } from 'react';

// IMPORTANT: Hands and HAND_CONNECTIONS are loaded globally via CDN script in public/index.html
// <script src="https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js"></script>

// --- Gesture Detection Functions (ported from hand_detection.py) ---

function is_open_palm(lm) {
  // Thumb extended if tip (4) is RIGHT of 3 (for left hand)
  if (!(lm[4].x > lm[3].x)) return false;
  // Index, middle, ring, pinky: tip.y < pip.y
  return lm[8].y < lm[6].y && lm[12].y < lm[10].y && lm[16].y < lm[14].y && lm[20].y < lm[18].y;
}

function is_pointer(lm) {
  // Only index up: index extended, all others folded
  return (
    lm[8].y < lm[6].y && // index up
    lm[12].y > lm[10].y && // middle folded
    lm[16].y > lm[14].y && // ring folded
    lm[20].y > lm[18].y && // pinky folded
    !(lm[4].x > lm[3].x) // thumb folded
  );
}

function is_two_fingers(lm) {
  // Index and middle up, ring/pinky/thumb folded
  return (
    lm[8].y < lm[6].y &&
    lm[12].y < lm[10].y &&
    lm[16].y > lm[14].y &&
    lm[20].y > lm[18].y &&
    !(lm[4].x > lm[3].x)
  );
}

function is_three_fingers(lm) {
  // Index, middle, ring up, pinky/thumb folded
  return (
    lm[8].y < lm[6].y &&
    lm[12].y < lm[10].y &&
    lm[16].y < lm[14].y &&
    lm[20].y > lm[18].y &&
    !(lm[4].x > lm[3].x)
  );
}

function is_four_fingers(lm) {
  // Four up, thumb folded
  return (
    !(lm[4].x > lm[3].x) &&
    lm[8].y < lm[6].y &&
    lm[12].y < lm[10].y &&
    lm[16].y < lm[14].y &&
    lm[20].y < lm[18].y
  );
}

function is_yolo(lm) {
  // Left-hand YOLO: Index, pinky, thumb up; middle and ring folded
  return (
    lm[8].y < lm[6].y &&
    lm[20].y < lm[18].y &&
    lm[4].x > lm[3].x &&
    lm[12].y > lm[10].y &&
    lm[16].y > lm[14].y
  );
}

// --- Right-hand gesture detection ---
// Mirror thumb logic is applied (notice the x comparisons are reversed)
function is_open_palm_right(lm) {
  if (!(lm[4].x < lm[3].x)) return false;
  return lm[8].y < lm[6].y && lm[12].y < lm[10].y && lm[16].y < lm[14].y && lm[20].y < lm[18].y;
}

function is_pointer_right(lm) {
  return (
    lm[8].y < lm[6].y &&
    lm[12].y > lm[10].y &&
    lm[16].y > lm[14].y &&
    lm[20].y > lm[18].y &&
    !(lm[4].x < lm[3].x)
  );
}

function is_two_fingers_right(lm) {
  return (
    lm[8].y < lm[6].y &&
    lm[12].y < lm[10].y &&
    lm[16].y > lm[14].y &&
    lm[20].y > lm[18].y &&
    !(lm[4].x < lm[3].x)
  );
}

function is_three_fingers_right(lm) {
  return (
    lm[8].y < lm[6].y &&
    lm[12].y < lm[10].y &&
    lm[16].y < lm[14].y &&
    lm[20].y > lm[18].y &&
    !(lm[4].x < lm[3].x)
  );
}

function is_four_fingers_right(lm) {
  return (
    !(lm[4].x < lm[3].x) &&
    lm[8].y < lm[6].y &&
    lm[12].y < lm[10].y &&
    lm[16].y < lm[14].y &&
    lm[20].y < lm[18].y
  );
}

function is_five_fingers_right(lm) {
  return (
    (lm[4].x < lm[3].x) &&
    lm[8].y < lm[6].y &&
    lm[12].y < lm[10].y &&
    lm[16].y < lm[14].y &&
    lm[20].y < lm[18].y
  );
}

// --- New YOLO function for right-hand branch ---
// This applies to the physical left hand (detected as "Right") so that users making the YOLO sign with their left hand are recognized.
function is_yolo_right(lm) {
  return (
    lm[8].y < lm[6].y &&         // index up
    lm[20].y < lm[18].y &&       // pinky up
    lm[4].x < lm[3].x &&         // thumb up (mirrored condition)
    lm[12].y > lm[10].y &&       // middle folded
    lm[16].y > lm[14].y          // ring folded
  );
}

function WebcamFeed({ onHandLandmarks }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [mediapipeError, setMediapipeError] = useState(null);
  const [showFallback, setShowFallback] = useState(false);
  const [fingerMsg, setFingerMsg] = useState('');

  useEffect(() => {
    let camera = null;
    let hands = null;
    let videoStream = null;
    let cancelled = false;

    async function setup() {
      // Use Hands and HAND_CONNECTIONS from the global window object
      const Hands = window.Hands;
      const HAND_CONNECTIONS = window.HAND_CONNECTIONS;
      if (!Hands || !HAND_CONNECTIONS) {
        setMediapipeError('window.Hands or window.HAND_CONNECTIONS not found. Did you add the CDN script to public/index.html?');
        setShowFallback(true);
        return;
      }
      try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = videoStream;
        }
        hands = new window.Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
        });
        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7,
        });
        hands.onResults((results) => {
          try {
            const canvas = canvasRef.current;
            if (!canvas) {
              // Canvas is not mounted, skip drawing
              return;
            }
            // Create (or reuse) an offscreen canvas for logic and drawing
            if (!window._offscreenCanvas || window._offscreenCanvas.width !== canvas.width || window._offscreenCanvas.height !== canvas.height) {
              window._offscreenCanvas = document.createElement('canvas');
              window._offscreenCanvas.width = canvas.width;
              window._offscreenCanvas.height = canvas.height;
            }
            const offCtx = window._offscreenCanvas.getContext('2d');
            offCtx.save();
            offCtx.clearRect(0, 0, canvas.width, canvas.height);
            // Draw video frame (not mirrored)
            offCtx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
            // Draw landmarks (not mirrored)
            let leftGesture = '', rightGesture = '';
            if (results.multiHandLandmarks && results.multiHandedness) {
              for (let i = 0; i < results.multiHandLandmarks.length; ++i) {
                const handType = results.multiHandedness[i].label; // "Left" or "Right"
                const lm = results.multiHandLandmarks[i];
                window.drawConnectors(offCtx, lm, window.HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
                window.drawLandmarks(offCtx, lm, { color: '#FF0000', lineWidth: 1 });
                // Gesture detection
                // For the physical right hand, MediaPipe labels it "Left"
                if (handType === "Left") {
                  if (is_open_palm(lm)) leftGesture = 'Open Palm';
                  else if (is_pointer(lm)) leftGesture = 'Pointer';
                  else if (is_two_fingers(lm)) leftGesture = 'Two Fingers';
                  else if (is_three_fingers(lm)) leftGesture = 'Three Fingers';
                  else if (is_four_fingers(lm)) leftGesture = 'Four Fingers';
                  else leftGesture = 'Other';
                }
                // For the physical left hand, MediaPipe labels it "Right"
                if (handType === "Right") {
                  if (is_open_palm_right(lm)) rightGesture = 'Open Palm';
                  // Check YOLO here so that a left-hand YOLO gesture is detected
                  else if (is_yolo_right(lm)) rightGesture = 'YOLO';
                  else if (is_pointer_right(lm)) rightGesture = 'Pointer';
                  else if (is_two_fingers_right(lm)) rightGesture = 'Two Fingers';
                  else if (is_three_fingers_right(lm)) rightGesture = 'Three Fingers';
                  else if (is_four_fingers_right(lm)) rightGesture = 'Four Fingers';
                  else if (is_five_fingers_right(lm)) rightGesture = 'Five Fingers';
                  else rightGesture = 'Other';
                }
              }
              // Swap display so MediaPipe 'Left' = UI 'Right hand' and 'Right' = UI 'Left hand'
              let msg = '';
              if (rightGesture) msg += `Left hand: ${rightGesture}. `;
              if (leftGesture) msg += `Right hand: ${leftGesture}.`;
              setFingerMsg(msg);
              // (Optional) Use gestures for drawing logic here
              // ...
            } else {
              setFingerMsg('');
            }
            offCtx.restore();
            // Now mirror the offscreen canvas onto the visible canvas for display
            const ctx = canvas.getContext('2d');
            ctx.save();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(window._offscreenCanvas, 0, 0, canvas.width, canvas.height);
            ctx.restore();
          } catch (err) {
            setMediapipeError('Error drawing results: ' + err.message);
            setShowFallback(true);
          }
        });
        if (videoRef.current) {
          camera = new window.Camera(videoRef.current, {
            onFrame: async () => {
              try {
                await hands.send({ image: videoRef.current });
              } catch (err) {
                setMediapipeError('Error sending frame to MediaPipe: ' + err.message);
                setShowFallback(true);
              }
            },
            width: 640,
            height: 480,
          });
          camera.start();
        } else {
          setMediapipeError('videoRef.current is null');
          setShowFallback(true);
        }
      } catch (err) {
        setMediapipeError('MediaPipe setup error: ' + err.message);
        setShowFallback(true);
      }
    }
    setup();
    return () => {
      cancelled = true;
      if (camera) camera.stop();
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [onHandLandmarks]);

  if (showFallback) {
    return (
      <div>
        <video
          ref={videoRef}
          width={640}
          height={480}
          autoPlay
          style={{ border: '1px solid #333', transform: 'scaleX(-1)' }}
        />
        <div style={{ color: 'red', marginTop: 8 }}>{mediapipeError || 'MediaPipe failed. Showing fallback.'}</div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: 640, height: 480 }}>
      <div style={{ position: 'absolute', top: -20, left: 0, width: 320, color: '#1976d2', fontWeight: 'bold', textAlign: 'center', zIndex: 2 }}>
        {fingerMsg}
      </div>
      <video
        ref={videoRef}
        style={{ display: 'none' }}
        width={640}
        height={480}
        autoPlay
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        style={{ position: 'absolute', left: 0, top: 0, border: '1px solid #333' }}
      />
    </div>
  );
}

export default WebcamFeed;
