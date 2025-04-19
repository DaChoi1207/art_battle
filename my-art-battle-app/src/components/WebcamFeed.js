import React, { useRef, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import socket from '../socket';


//const socket = io('http://localhost:3001'); // Socket.io connection (adjust port if necessary)

// // Ensure we join the room once connected
// socket.on('connect', () => {
//   console.log('Socket connected:', socket.id);
//   socket.emit('join-room', roomId);
//   console.log('Joined room:', roomId);
// });

function WebcamFeed({ roomId, dominance = 'right' }) {
  console.log('WebcamFeed: received dominance prop:', dominance);
  const drawHand = dominance === 'right' ? 'Right' : 'Left';
  const modeHand = dominance === 'right' ? 'Left' : 'Right';
  console.log('WebcamFeed: drawHand:', drawHand, 'modeHand:', modeHand);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const remoteCanvasesRef = useRef({});
  const drawingCanvasRef = useRef(null);
  const lastDrawingPosRef = useRef(null);
  const brushSizeRef = useRef(4);
  const lineColorRef = useRef("red");
  
  // We'll store remote container elements by peerId (includes video and drawing canvas)
  const remoteContainersRef = useRef({});

  // Timer state
  const [timeLeft, setTimeLeft] = useState(null);
  const [gameOver, setGameOver] = useState(false);
  const intervalRef = useRef(null);

  // Helper: Get (or create) the remote container for a given peer.
  // State for popup
  const [enlargedPeerId, setEnlargedPeerId] = useState(null);

  function getOrCreateRemoteContainer(peerId) {
    const parent = document.getElementById('remote-container');
    if (!parent) {
      // we’re no longer on the game screen → skip
      return null;
    }

    let container = document.getElementById("remote-peer-" + peerId);
    if (!container) {
      container = document.createElement('div');
      container.id = "remote-peer-" + peerId;
      container.style.position = 'relative';
      container.style.width = '120px';
      container.style.height = '90px';
      container.style.border = '2px solid #a6adc8';
      container.style.margin = '5px';
      container.style.borderRadius = '8px';
      container.style.overflow = 'hidden';
      container.style.background = '#232136';
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.justifyContent = 'center';
      container.style.cursor = 'pointer';
      container.onclick = () => setEnlargedPeerId(peerId);
      
      // 1) Video element
      const videoElem = document.createElement('img');
      videoElem.id = "remote-video-" + peerId;
      videoElem.style.position = 'absolute';
      videoElem.style.top = '0';
      videoElem.style.left = '0';
      videoElem.style.width = '100%';
      videoElem.style.height = '100%';
      videoElem.style.zIndex = "1";
      container.appendChild(videoElem);
      
      // 2) Drawing overlay canvas (rename to avoid shadowing)
      const peerCanvas = document.createElement('canvas');
      peerCanvas.id = "remote-drawing-" + peerId;
      peerCanvas.width = 640;
      peerCanvas.height = 480;
      peerCanvas.style.position = 'absolute';
      peerCanvas.style.top = '0';
      peerCanvas.style.left = '0';
      peerCanvas.style.pointerEvents = 'none';
      peerCanvas.style.zIndex = "2";
      container.appendChild(peerCanvas);
      
      // 3) Store it _after_ declaration
      remoteCanvasesRef.current[peerId] = peerCanvas;
      
      // 4) Label
      const label = document.createElement('div');
      label.style.position = 'absolute';
      label.style.bottom = '0';
      label.style.left = '0';
      label.style.background = 'rgba(0,0,0,0.5)';
      label.style.color = 'white';
      label.style.fontSize = '12px';
      label.style.padding = '2px';
      label.innerText = peerId;
      container.appendChild(label);
  
      // 5) Add to DOM
      parent.appendChild(container);
    }
    return container;
  }
  

  useEffect(() => {
    // On mount, ask server for current round status (for late joiners)
    socket.emit('get-round-status', roomId, ({ timeLeft }) => {
      if (typeof timeLeft === 'number' && timeLeft > 0) {
        setGameOver(false);
        setTimeLeft(timeLeft);
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
          setTimeLeft(prev => {
            if (prev === 1) {
              clearInterval(intervalRef.current);
              setGameOver(true);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      } else {
        setTimeLeft(null);
        setGameOver(false);
      }
    });

    let camera = null;
    let hands = null;
    let videoStream = null;
    let videoCaptureInterval = null;

    async function setup() {
      const Hands = window.Hands;
      const HAND_CONNECTIONS = window.HAND_CONNECTIONS;
      if (!Hands || !HAND_CONNECTIONS) {
        console.error("MediaPipe Hands or HAND_CONNECTIONS not found.");
        return;
      }

      try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = videoStream;
        }
      } catch (err) {
        console.error("Error accessing webcam: ", err);
        return;
      }

      hands = new Hands({
        locateFile: (file) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
      });
      hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7,
      });

      function countExtendedFingers(landmarks, handedness) {
        const indexExtended = landmarks[8].y < landmarks[6].y;
        const middleExtended = landmarks[12].y < landmarks[10].y;
        const ringExtended = landmarks[16].y < landmarks[14].y;
        const pinkyExtended = landmarks[20].y < landmarks[18].y;
        let thumbExtended = false;
        if (handedness === "Left") {
          thumbExtended = landmarks[4].x > landmarks[3].x;
        } else {
          thumbExtended = landmarks[4].x < landmarks[3].x;
        }
        const count = (thumbExtended ? 1 : 0) +
                      (indexExtended ? 1 : 0) +
                      (middleExtended ? 1 : 0) +
                      (ringExtended ? 1 : 0) +
                      (pinkyExtended ? 1 : 0);
        return { thumb: thumbExtended, index: indexExtended, middle: middleExtended, ring: ringExtended, pinky: pinkyExtended, count };
      }

      function getGestureName(extended, handedness) {
        // YOLO = thumb + index + pinky extended, middle & ring folded
        if (extended.thumb && extended.index && !extended.middle && !extended.ring && extended.pinky) {
          return "yolo";
        }
        if (extended.count === 1 && extended.index) return "pointer";
        if (extended.count === 2 && extended.index && extended.middle) return "two_finger";
        if (extended.count === 3 && extended.index && extended.middle && extended.ring) return "three_finger";
        if (extended.count === 4 && extended.index && extended.middle && extended.ring && extended.pinky) return "four_finger";
        if (extended.count === 5) return "open_palm";
        return "unknown";
      }

      hands.onResults((results) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

        let isDrawingActive = false;
        let isErasingActive = false;
        let isBrushResizeActive = false;
        let isColorChangeActive = false;
        let shouldClearCanvas = false;

        let leftHandGesture = null;
        let rightHandGesture = null;
        let rightHandLandmarks = null;

        if (results.multiHandLandmarks && results.multiHandedness) {
          results.multiHandLandmarks.forEach((landmarks, i) => {
            const rawLabel = results.multiHandedness[i].label;
            const extended = countExtendedFingers(landmarks, rawLabel);
            const gesture = getGestureName(extended, rawLabel);

            // Use drawHand/modeHand for logic, not hardcoded labels
            const isDraw = rawLabel === drawHand;
            const isMode = rawLabel === modeHand;
            const displayLabel = isDraw ? `${drawHand} (Draw)` : `${modeHand} (Mode)`;
            const textX = isDraw ? 10 : canvas.width - 150;
            const textY = 30 + i * 30;

            window.drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
            window.drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 1 });

            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.font = "24px Arial";
            ctx.fillStyle = "yellow";
            ctx.fillText(`${displayLabel}: ${gesture}`, textX, textY);
            ctx.restore();

              
            if (isDraw) {
              // This hand is for drawing (respects dominance)
              if (gesture === "yolo") shouldClearCanvas = true;
              else if (gesture === "pointer") isDrawingActive = true;
              else if (gesture === "two_finger") isErasingActive = true;
              else if (gesture === "three_finger") isBrushResizeActive = true;
              else if (gesture === "open_palm") isColorChangeActive = true;
            } else if (isMode) {
              // This hand is for mode (respects dominance)
              rightHandGesture = gesture;
              rightHandLandmarks = landmarks;
            }
          });
        }
        ctx.restore();

        const drawingCanvas = drawingCanvasRef.current;
        const drawingCtx = drawingCanvas.getContext('2d');

        if (shouldClearCanvas) {
          drawingCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
          lastDrawingPosRef.current = null;
          socket.emit('clear-canvas', roomId);
        } else if (isColorChangeActive && rightHandGesture) {
          if (rightHandGesture === "pointer") lineColorRef.current = "blue";
          else if (rightHandGesture === "two_finger") lineColorRef.current = "green";
          else if (rightHandGesture === "three_finger") lineColorRef.current = "red";
          else if (rightHandGesture === "four_finger") lineColorRef.current = "yellow";
          else if (rightHandGesture === "open_palm") lineColorRef.current = "white";

          ctx.save();
          ctx.font = "28px Arial";
          ctx.fillStyle = "#fff";
          ctx.fillRect(10, 60, 180, 30);
          ctx.fillStyle = "#000";
          ctx.fillText(`Color: ${lineColorRef.current}`, 20, 65);
          ctx.restore();
        } else if (isBrushResizeActive && rightHandLandmarks) {
          const thumb = rightHandLandmarks[4];
          const index = rightHandLandmarks[8];
          const dx = (thumb.x - index.x) * canvas.width;
          const dy = (thumb.y - index.y) * canvas.height;
          const distance = Math.sqrt(dx * dx + dy * dy);
          brushSizeRef.current = Math.max(4, Math.min(distance, 40));

          const thumbX = canvas.width - (thumb.x * canvas.width);
          const thumbY = thumb.y * canvas.height;
          const indexX = canvas.width - (index.x * canvas.width);
          const indexY = index.y * canvas.height;

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(thumbX, thumbY);
          ctx.lineTo(indexX, indexY);
          ctx.strokeStyle = "blue";
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();
        } else if ((isDrawingActive || isErasingActive) && rightHandLandmarks) {
          const indexTip = rightHandLandmarks[8];
          const x = canvas.width - (indexTip.x * canvas.width);
          const y = indexTip.y * canvas.height;

          if (isDrawingActive) {
            drawingCtx.lineCap = 'round';
            drawingCtx.lineJoin = 'round';
            drawingCtx.strokeStyle = lineColorRef.current;
            drawingCtx.fillStyle = lineColorRef.current;

            if (!lastDrawingPosRef.current) {
              drawingCtx.beginPath();
              drawingCtx.arc(x, y, brushSizeRef.current / 2, 0, Math.PI * 2);
              drawingCtx.fill();
              lastDrawingPosRef.current = { x, y };
            } else {
              const previousPos = lastDrawingPosRef.current;
              drawingCtx.beginPath();
              drawingCtx.moveTo(previousPos.x, previousPos.y);
              drawingCtx.lineTo(x, y);
              drawingCtx.lineWidth = brushSizeRef.current;
              drawingCtx.stroke();
              // MULTIPLAYER SYNC: Emit this drawn segment to other players
              socket.emit('draw-line', {
                roomId: roomId,
                from: previousPos,
                to: { x, y },
                color: lineColorRef.current,
                thickness: brushSizeRef.current
              });
              lastDrawingPosRef.current = { x, y };
            }
          } else if (isErasingActive) {
            drawingCtx.save();
            drawingCtx.globalCompositeOperation = "destination-out";
            drawingCtx.beginPath();
            drawingCtx.moveTo(lastDrawingPosRef.current?.x ?? x, lastDrawingPosRef.current?.y ?? y);
            drawingCtx.lineTo(x, y);
            drawingCtx.lineWidth = 20;
            drawingCtx.stroke();
            drawingCtx.restore();
            lastDrawingPosRef.current = { x, y };
          }
        } else {
          lastDrawingPosRef.current = null;
        }
      });

      if (videoRef.current) {
        camera = new window.Camera(videoRef.current, {
          onFrame: async () => {
            await hands.send({ image: videoRef.current });
          },
          width: 640,
          height: 480,
        });
        camera.start();
      }

      // Start sending our webcam frames to other peers.
      // We capture the already drawn (mirrored) canvas as an image.
      videoCaptureInterval = setInterval(() => {
        if (!canvasRef.current) return;
        const dataURL = canvasRef.current.toDataURL('image/jpeg', 0.5);
        console.log('📤 [client] sending video-frame, len=', dataURL.length);
        socket.emit('video-frame', { roomId, image: dataURL, peerId: socket.id });
      }, 50);
    }

    setup();
    socket.emit('join-room', roomId);

    // Listen for start-game event from server
    socket.on('start-game', ({ roundDuration }) => {
      setGameOver(false);
      setTimeLeft(roundDuration);
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev === 1) {
            clearInterval(intervalRef.current);
            setGameOver(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    // Listen for game-over event from server
    socket.on('game-over', () => {
      setGameOver(true);
      setTimeLeft(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
      // Submit the local canvas to the server
      if (drawingCanvasRef.current) {
        const image = drawingCanvasRef.current.toDataURL('image/png');
        socket.emit('submit-image', { roomId, image });
      }
    });
    // Listen for remote drawing events.
    socket.on('peer-draw', ({ from, to, color, thickness, peerId }) => {
      console.log('👀 [client] peer-draw received from', peerId);
      const container = getOrCreateRemoteContainer(peerId);
      if (!container) return;  
      const peerCanvas = container.querySelector('#remote-drawing-' + peerId);
      if (peerCanvas) {
        const ctx = peerCanvas.getContext('2d');
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = color;
        ctx.lineWidth = thickness * (peerCanvas.width / 640);
        ctx.beginPath();
        ctx.moveTo(from.x * (peerCanvas.width / 640), from.y * (peerCanvas.height / 480));
        ctx.lineTo(to.x * (peerCanvas.width / 640), to.y * (peerCanvas.height / 480));
        ctx.stroke();
      }
    });

    // Listen for remote video frames.
    socket.on('peer-video', ({ image, peerId }) => {
      console.log('👀 [client] peer-video received for', peerId, 'len=', image?.length);
      const container = getOrCreateRemoteContainer(peerId);
      const videoElem = container.querySelector('#remote-video-' + peerId);
      if (videoElem) videoElem.src = image;
    });

    // When someone clears, wipe all the remote canvases:
    socket.on('clear-canvas', () => {
      console.log('Received clear-canvas event');
      // Clear the local drawing canvas
      if (drawingCanvasRef.current) {
        const ctx = drawingCanvasRef.current.getContext('2d');
        ctx.clearRect(0, 0, drawingCanvasRef.current.width, drawingCanvasRef.current.height);
      }
      // Clear all remote overlays
      Object.values(remoteCanvasesRef.current).forEach(canvas => {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });
    });

    return () => {
      if (camera) camera.stop();
      if (videoStream) {
        videoStream.getTracks().forEach((track) => track.stop());
      }
      if (videoCaptureInterval) clearInterval(videoCaptureInterval);
      if (intervalRef.current) clearInterval(intervalRef.current);
      socket.off('peer-draw');
      socket.off('peer-video');
      socket.off('clear-canvas');
      socket.off('start-game');
      socket.off('game-over');
    };
  }, [roomId, dominance]);

  return (
    <div>
      <h2>Your Camera</h2>
      {timeLeft !== null && !gameOver && (
        <div className="timer">
          Time left: {timeLeft} seconds
        </div>
      )}
      {gameOver && (
        <div className="timer" style={{ color: 'red', fontWeight: 'bold' }}>
          Game Over!
        </div>
      )}

      <div id="local-container" style={{ position: 'relative', width: 640, height: 480, marginBottom: '20px' }}>
        <video ref={videoRef} style={{ display: 'none' }} width={640} height={480} autoPlay />
        <canvas ref={canvasRef} width={640} height={480} style={{ border: '1px solid #333', position: 'absolute', top: 0, left: 0 }} />
        <canvas ref={drawingCanvasRef} width={640} height={480} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} />
      </div>
      <h2>Other Players</h2>
      <div id="remote-container" style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '12px', alignItems: 'center', minHeight: '100px' }}>
        {/* Remote tiles will be injected here. Ensure they are styled as small tiles. */}
      </div>
    {/* Enlarged remote webcam popup */}
    {enlargedPeerId && (
      <div
        style={{
          position: 'fixed', zIndex: 1000, left: 0, top: 0, width: '100vw', height: '100vh',
          background: 'rgba(24,24,37,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onClick={() => setEnlargedPeerId(null)}
      >
        <div
          style={{ position: 'relative', width: 640, height: 480, background: '#232136', borderRadius: 16, boxShadow: '0 4px 32px #111a', overflow: 'hidden', border: '3px solid #b4befe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Show the enlarged remote video and drawing canvas */}
          <img
            id={`popup-remote-video-${enlargedPeerId}`}
            src={document.getElementById(`remote-video-${enlargedPeerId}`)?.src || ''}
            alt={`peer ${enlargedPeerId}`}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#111', zIndex: 1 }}
          />
          {/* Drawing overlay: clone the remote canvas as an image for the popup */}
          <img
            id={`popup-remote-drawing-${enlargedPeerId}`}
            src={(() => {
              const canvas = document.getElementById(`remote-drawing-${enlargedPeerId}`);
              return canvas ? canvas.toDataURL('image/png') : '';
            })()}
            alt="drawing overlay"
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 2 }}
          />
          {/* Close button */}
          <button
            style={{ position: 'absolute', top: 10, right: 10, background: '#45475a', color: '#f5e0dc', border: 'none', borderRadius: 20, width: 32, height: 32, fontSize: 18, cursor: 'pointer', zIndex: 3 }}
            onClick={() => setEnlargedPeerId(null)}
          >✕</button>
          <div style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', background: 'rgba(24,24,37,0.85)', color: '#b4befe', fontSize: 16, padding: '4px 0', textAlign: 'center', letterSpacing: 1 }}>{enlargedPeerId}</div>
        </div>
      </div>
    )}
  </div>
  );
}

export default WebcamFeed;
