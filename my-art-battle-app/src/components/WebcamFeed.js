import React, { useRef, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import socket from '../socket';
import ColorPopover from './ColorPopover';
import { fetchAiColors } from '../utils/aiColorsClient';


//const socket = io('http://localhost:3001'); // Socket.io connection (adjust port if necessary)

// // Ensure we join the room once connected
// socket.on('connect', () => {
//   console.log('Socket connected:', socket.id);
//   socket.emit('join-room', roomId);
//   console.log('Joined room:', roomId);
// });

function WebcamFeed({ roomId, dominance = 'right', setTimeLeft: setTimeLeftParent, setGameOver: setGameOverParent }) {
  const [showAiHelp, setShowAiHelp] = useState(false);
  // --- AI Color Picker State ---
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  // Optionally, pass drawingPrompt as a prop or get from context if needed
  const drawingPrompt = "your drawing subject"; // TODO: replace with actual prompt if available

  const yoloHoldRef = React.useRef(null);
  // Notification state for gesture and color
  const [gestureNotification, setGestureNotification] = useState("");
  const [selectedColorDisplay, setSelectedColorDisplay] = useState("#e63946"); // default color

  // Artistic hand overlay toggle
  const [showHandOverlay, setShowHandOverlay] = useState(true);

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
  // --- Color Palette State ---
  const defaultPalette = ["#e63946", "#457b9d", "#f1faee", "#ffbe0b", "#8338ec"];
  const [colorPalette, setColorPalette] = useState(() => {
    const stored = localStorage.getItem('artbattle_palette');
    return stored ? JSON.parse(stored) : defaultPalette;
  });

  const colorPaletteRef = useRef(colorPalette);
useEffect(() => {
  colorPaletteRef.current = colorPalette;
}, [colorPalette]);
  // Only initialize palette from backend ONCE per session unless palette is truly different
  const [paletteInitialized, setPaletteInitialized] = useState(false);
  useEffect(() => {
    if (paletteInitialized) return;
    socket.emit('request-palette', (serverPalette) => {
      if (serverPalette && Array.isArray(serverPalette)) {
        // Only set if different from local
        const local = JSON.stringify(colorPalette);
        const remote = JSON.stringify(serverPalette);
        if (local !== remote) {
          setColorPalette(serverPalette);
        }
      }
      setPaletteInitialized(true);
    });
  }, [roomId, paletteInitialized, colorPalette]);
  // -1 means no color popover is open
  const [selectedColorIdx, setSelectedColorIdx] = useState(-1);
  useEffect(() => {
    if (colorPalette && Array.isArray(colorPalette)) {
      localStorage.setItem('artbattle_palette', JSON.stringify(colorPalette));
      // Send palette to server
      socket.emit('update-palette', { palette: colorPalette, roomId });
    }
  }, [colorPalette, roomId]);
  const lineColorRef = useRef();
  // Ensure the initial drawing color matches the first palette color
  useEffect(() => {
    lineColorRef.current = colorPalette[0] || defaultPalette[0];
  }, [colorPalette]);
  
  // We'll store remote container elements by peerId (includes video and drawing canvas)
  const remoteContainersRef = useRef({});

  // Timer state
  const [timeLeft, setTimeLeft] = useState(null);
  const [gameOver, setGameOver] = useState(false);

  // Sync timer/gameOver state to parent if callback provided
  useEffect(() => {
    if (typeof setTimeLeftParent === 'function') setTimeLeftParent(timeLeft);
  }, [timeLeft, setTimeLeftParent]);
  useEffect(() => {
    if (typeof setGameOverParent === 'function') setGameOverParent(gameOver);
  }, [gameOver, setGameOverParent]);
  const intervalRef = useRef(null);

  // Helper: Get (or create) the remote container for a given peer.
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
      peerCanvas.width = 120;
      peerCanvas.height = 90;
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
    // Drawing SYNC: On mount, request all peer drawings and render them
    socket.emit('request-drawing-sync', roomId, (allDrawings) => {
      // 1) Clear *every* remote overlay before re‑drawing
      Object.values(remoteCanvasesRef.current).forEach(canvas => {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });
    
      // 2) Now re‑draw whatever lines the server has (none on a new round)
      if (allDrawings && typeof allDrawings === 'object') {
        Object.entries(allDrawings).forEach(([peerId, lines]) => {
          if (peerId === socket.id) return;
          const container = getOrCreateRemoteContainer(peerId);
          if (!container) return;
          const peerCanvas = container.querySelector('#remote-drawing-' + peerId);
          const ctx = peerCanvas.getContext('2d');
          lines.forEach(({ from, to, color, thickness }) => {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = color;
            ctx.lineWidth = thickness * (peerCanvas.width / 640);
            ctx.beginPath();
            ctx.moveTo(
              from.x * (peerCanvas.width / 640),
              from.y * (peerCanvas.height / 480)
            );
            ctx.lineTo(
              to.x * (peerCanvas.width / 640),
              to.y * (peerCanvas.height / 480)
            );
            ctx.stroke();
          });
        });
      }
    });

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

            // Artistic overlay: pastel colors, drop shadow, toggleable
            if (showHandOverlay) {
              // Soft pastel color palette
              const pastelColors = [
                '#b8c1ec', // soft blue
                '#bee1e6', // soft teal
                '#fad2e1', // soft pink
                '#cddafd', // soft lavender
                '#fff1e6', // soft cream
                '#e2ece9', // pale mint
                '#f1faee', // pale white
                '#ffbe0b', // soft yellow
                '#a685e2'  // soft purple
              ];
              // Artistic connectors: rainbow pastel gradient by index
              window.drawConnectors(ctx, landmarks, HAND_CONNECTIONS, {
                color: pastelColors[i % pastelColors.length],
                lineWidth: 3,
              });
              // Artistic landmarks: soft color, drop shadow
              window.drawLandmarks(ctx, landmarks, {
                color: pastelColors[(i+3) % pastelColors.length],
                lineWidth: 2,
                fillColor: pastelColors[(i+6) % pastelColors.length],
                radius: (data) => 3,
                // Custom draw: add drop shadow
                shadowColor: '#a685e2',
                shadowBlur: 12,
              });
              // Add drop shadow manually for browsers that don't support shadow in drawLandmarks
              // (If needed: draw circles with shadow)
              // for (const pt of landmarks) {
              //   ctx.save();
              //   ctx.beginPath();
              //   ctx.arc(pt.x * canvas.width, pt.y * canvas.height, 7, 0, 2 * Math.PI);
              //   ctx.shadowColor = '#a685e2';
              //   ctx.shadowBlur = 10;
              //   ctx.fillStyle = pastelColors[(i+6) % pastelColors.length];
              //   ctx.globalAlpha = 0.85;
              //   ctx.fill();
              //   ctx.restore();
              // }
            }

            // Removed on-canvas gesture text. Notifications are shown below webcam.

              
            if (isDraw) {
              // This hand is for drawing (respects dominance)
              if (gesture === "yolo") {
                // YOLO gesture: require hold for 2 seconds (minimal, careful change)
                if (!yoloHoldRef.current) {
                  yoloHoldRef.current = Date.now();
                }
                const heldFor = Date.now() - yoloHoldRef.current;
                if (heldFor >= 1000) {
                  shouldClearCanvas = true;
                  setGestureNotification("Canvas Cleared!");
                  yoloHoldRef.current = null;
                } else {
                  setGestureNotification("deleting..");
                }
              } else {
                yoloHoldRef.current = null;
              }
              if (gesture === "pointer") {
                isDrawingActive = true;
                setGestureNotification("Drawing Mode Active!");
              } else if (gesture === "two_finger") {
                isErasingActive = true;
                setGestureNotification("Erasing Mode Active!");
              } else if (gesture === "three_finger") {
                isBrushResizeActive = true;
                setGestureNotification("Brush Resize Mode!");
              } else if (gesture === "open_palm") {
                isColorChangeActive = true;
                setGestureNotification("Color Selection Mode!");
              } else if (gesture !== "yolo") {
                setGestureNotification("");
              }
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
          // Map gestures to palette slots 0-4
          let idx = 0;
          if (rightHandGesture === "pointer") idx = 0;
          else if (rightHandGesture === "two_finger") idx = 1;
          else if (rightHandGesture === "three_finger") idx = 2;
          else if (rightHandGesture === "four_finger") idx = 3;
          else if (rightHandGesture === "open_palm") idx = 4;
          lineColorRef.current = colorPaletteRef.current[idx] || defaultPalette[idx];

          // Update selected color display and show notification for color change
          const newColor = colorPaletteRef.current[idx] || defaultPalette[idx];
          setSelectedColorDisplay(newColor);
        } else if (isBrushResizeActive && rightHandLandmarks) {
          const thumb = rightHandLandmarks[4];
          const index = rightHandLandmarks[8];
          const dx = (thumb.x - index.x) * canvas.width;
          const dy = (thumb.y - index.y) * canvas.height;
          const rawDistance = Math.sqrt(dx * dx + dy * dy);
          const adjustedDistance = Math.max(0, rawDistance - 20) * 0.6; // Subtract 20px offset, then slow growth
          brushSizeRef.current = Math.max(2, Math.min(adjustedDistance, 40));

          const thumbX = canvas.width - (thumb.x * canvas.width);
          const thumbY = thumb.y * canvas.height;
          const indexX = canvas.width - (index.x * canvas.width);
          const indexY = index.y * canvas.height;

          ctx.save();
          ctx.beginPath();
          ctx.moveTo(thumbX, thumbY);
          ctx.lineTo(indexX, indexY);
          ctx.strokeStyle = "black";
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
      // 1) Clear your own drawing canvas
      if (drawingCanvasRef.current) {
        const ctx = drawingCanvasRef.current.getContext('2d');
        ctx.clearRect(0, 0,
          drawingCanvasRef.current.width,
          drawingCanvasRef.current.height
        );
      }
      lastDrawingPosRef.current = null;
    
      // 2) Clear every remote‐overlay canvas
      Object.values(remoteCanvasesRef.current).forEach(canvas => {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      });
    
      // 3) Now kick off the timer
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
      // Clear any client-side drawing state for remote peers (if used)
      // If you cache remote drawing data, reset it here
      if (remoteCanvasesRef.current) {
        Object.keys(remoteCanvasesRef.current).forEach(peerId => {
          // Optionally, you could reset any additional state here if needed
          // e.g., remoteDrawingData[peerId] = [];
        });
      }
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
    <div className="w-full flex flex-col items-center">
      {/* Artistic Hand Overlay Toggle */}
      {/* <div className="flex flex-row items-center gap-4 mb-2 mt-2">
        <button
          className={`relative px-5 py-2 rounded-full border-2 shadow-lg font-semibold transition-all duration-150 focus:outline-none text-base 
            ${showHandOverlay ? 'bg-gradient-to-r from-[#b8c1ec] to-[#fad2e1] text-[#5b5f97] border-[#a685e2] scale-105' : 'bg-white text-[#b8c1ec] border-[#e2ece9] opacity-60'}`}
          style={{ minWidth: 120, boxShadow: showHandOverlay ? '0 4px 16px #a685e248' : 'none' }}
          onClick={() => setShowHandOverlay(v => !v)}
          aria-pressed={showHandOverlay}
        >
          {showHandOverlay ? (
            <span className="flex items-center gap-2">
              <span role="img" aria-label="show">🎨</span> Show Hand Overlay
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <span role="img" aria-label="hide">🚫</span> Hide Hand Overlay
            </span>
          )}
        </button>
        <span className="text-xs text-[#a685e2] font-medium">Toggle artistic hand skeleton overlay</span>
      </div> */}
      {/* Color Palette Picker */}
      <div className="flex flex-col items-center mb-4 w-full">
        <div className="mb-1 text-[#5b5f97] font-bold text-lg flex items-center gap-2">
          <span role="img" aria-label="palette">🎨</span> Change your Palette!
        </div>
        <div className="flex flex-row gap-3 items-center justify-center mt-2 mb-2">
          {colorPalette.map((color, idx) => (
            <div key={idx} className="relative">
              <button
                className={`w-10 h-10 rounded-full border-2 shadow-lg transition-transform duration-100 ${selectedColorIdx === idx ? 'scale-110 border-[#a685e2]' : 'border-[#e2ece9]'}`}
                style={{ background: color }}
                onClick={() => setSelectedColorIdx(idx)}
                aria-label={`Pick color ${idx + 1}`}
              />
              {selectedColorIdx === idx && (
                <ColorPopover onClose={() => setSelectedColorIdx(-1)}>
                  <input
                    type="color"
                    value={color}
                    onChange={e => {
                      const newPalette = [...colorPalette];
                      newPalette[idx] = e.target.value;
                      setColorPalette(newPalette);
                    }}
                    className="w-24 h-12 rounded-lg border-2 border-[#e2ece9] focus:border-[#a685e2]"
                  />
                </ColorPopover>
              )}
            </div>
          ))}
          {/* AI Color Suggestion UI */}
          <div className="flex flex-col items-start ml-6" style={{ minWidth: 220 }}>
            <form
              className="flex flex-row gap-2 items-center"
              onSubmit={async e => {
                e.preventDefault();
                if (!aiPrompt.trim()) return;
                setAiLoading(true);
                setAiError("");
                try {
                  const aiColors = await fetchAiColors({ prompt: aiPrompt, drawingPrompt, currentPalette: colorPalette });
                  if (Array.isArray(aiColors) && aiColors.length === 5) {
                    setColorPalette(aiColors);
                  } else {
                    setAiError("AI did not return 5 colors.");
                  }
                } catch (err) {
                  setAiError("Failed to fetch colors.");
                } finally {
                  setAiLoading(false);
                }
              }}
            >
              <input
                type="text"
                placeholder="Ask AI for palette..."
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                className="w-36 md:w-48 px-3 py-2 border-2 border-[#e2ece9] rounded-lg focus:border-[#a685e2] text-sm"
                disabled={aiLoading}
              />
              <button
                type="submit"
                disabled={aiLoading || !aiPrompt.trim()}
                className="px-3 py-2 rounded-lg bg-gradient-to-r from-[#a685e2] to-[#e2ece9] text-white font-semibold shadow hover:from-[#8f5ee2] hover:to-[#bfc9d1] transition disabled:opacity-60"
                style={{ minWidth: 44 }}
              >
                {aiLoading ? '...' : 'AI 🎨'}
              </button>
            </form>
            {aiError && <div className="text-xs text-red-500 mt-1">{aiError}</div>}
            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
              Change your colour palette with AI!
              <button
                type="button"
                aria-label="AI Color Help"
                className="ml-1 text-[#a685e2] hover:text-[#6c47b7] focus:outline-none"
                onClick={() => setShowAiHelp(true)}
                style={{ fontSize: 16, lineHeight: 1 }}
              >
                <span style={{fontWeight: 'bold', fontSize: 18, verticalAlign: 'middle'}}>?</span>
              </button>
            </div>
            {showAiHelp && (
              <div className="absolute z-50 bg-white border-2 border-[#e2ece9] shadow-xl rounded-xl p-4 text-sm text-gray-700 mt-2 max-w-xs animate-fade-in" style={{ left: 0, right: 0, margin: '0 auto' }}>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-[#a685e2]">AI Color Help</span>
                  <button onClick={() => setShowAiHelp(false)} aria-label="Close Help" className="text-gray-400 hover:text-gray-700 font-bold" style={{ fontSize: 18 }}>&times;</button>
                </div>
                <ul className="list-disc pl-5 mb-2">
                  <li>Type a request to change your color palette.</li>
                  <li>You can ask to change specific colors by number or description.</li>
                  <li>The AI will keep other colors the same.</li>
                  <li>OR... enter any prompt and replace all colours at once!</li>
                </ul>
                <div className="italic text-xs text-gray-500 mb-1">Examples:</div>
                <div className="text-xs text-gray-600">
                  <div>“Change colour 3 to a darker blue”</div>
                  <div>“Change colours 4 and 5 to something related to flowers”</div>
                  <div>“Make colour 2 a nicer red”</div>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="text-xs mt-1 text-[#a685e2] font-medium">
          Tip: Gestures are used to <b>swap</b> between colors.
        </div>
      </div>
  
      {/* Drawing Canvas + Video Feed */}
      <div className="flex flex-col md:flex-row gap-8 w-full justify-center items-start">
        {/* Left column: camera + notification */}
        <div className="flex flex-col items-center">
          <div
            className="relative flex flex-col items-center justify-center
                       bg-gradient-to-br from-[#fff1e6]/80 via-[#cddafd]/80 to-[#bee1e6]/80
                       rounded-2xl shadow-lg border-2 border-[#e2ece9] p-4 mb-2"
            style={{ width: 660, minHeight: 500 }}
          >
            <div className="text-[#5b5f97] font-bold mb-2 text-lg flex items-center gap-2">
              <span role="img" aria-label="you">🖌️</span> Your Drawing Canvas
            </div>
            <div className="relative" style={{ width: 640, height: 480 }}>
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
                className="rounded-xl border-2 border-[#b8c1ec] shadow-md"
                style={{ position: 'absolute', top: 0, left: 0 }}
              />
              <canvas
                ref={drawingCanvasRef}
                width={640}
                height={480}
                className="rounded-xl"
                style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
              />
            </div>
          </div>
  
          {/* Gesture Notification (white background) */}
          {/* Mode + Color notification bar under camera/canvas */}
          <div className="w-full flex flex-row items-center gap-3 mt-2 mb-4" style={{ maxWidth: 660 }}>
            {/* Mode notification */}
            <div
              className="rounded-full px-4 py-2 shadow-lg text-base font-semibold bg-gradient-to-r from-[#cddafd] via-[#bee1e6] to-[#fad2e1] text-[#5b5f97] border-2 border-[#e2ece9] flex items-center min-w-[150px] max-w-[320px] animate-fade-in transition-all duration-200"
              style={{ minHeight: 36 }}
            >
              <span className="text-base font-bold uppercase tracking-wide text-[#5b5f97] mr-3">
                Mode:
              </span>
              <span className="text-base font-bold uppercase tracking-wide text-[#5b5f97]">
                {gestureNotification ? gestureNotification : <span className="text-[#b8c1ec]">None Selected...</span>}
              </span>
            </div>
            {/* Selected color display */}
            <div className="flex items-center gap-3 bg-gradient-to-r from-[#fad2e1] via-[#bee1e6] to-[#cddafd] rounded-full px-6 py-2 shadow-lg border-2 border-[#e2ece9] min-h-[48px]" style={{ height: 48 }}>
              <span className="text-base font-bold uppercase tracking-wide text-[#5b5f97]">Selected Color:</span>
              <span style={{ color: selectedColorDisplay, fontSize: 26, filter: 'drop-shadow(0 1px 2px #fff)' }}>●</span>
            </div>
          </div>
        </div>
  
        {/* Video Call Grid for Other Players */}
        <div className="flex-1 flex flex-col items-center">
          <div className="text-[#5b5f97] font-bold mb-2 text-lg flex items-center gap-2">
            <span role="img" aria-label="peers">🧑‍🤝‍🧑</span> Other Players
          </div>
          <div
            id="remote-container"
            className="grid grid-cols-2 md:grid-cols-3 gap-6 w-full max-w-xl min-h-[200px]"
          />
        </div>
      </div>
    </div>
  );
  
}

export default WebcamFeed;
