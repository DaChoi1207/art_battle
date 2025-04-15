import React, { useRef, useEffect } from 'react';

function WebcamFeed() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const drawingCanvasRef = useRef(null);
  const lastDrawingPosRef = useRef(null);
  // Ref to store the current brush size.
  const brushSizeRef = useRef(4);
  // Ref to store the current drawing color.
  const lineColorRef = useRef("red");

  useEffect(() => {
    let camera = null;
    let hands = null;
    let videoStream = null;

    async function setup() {
      // Ensure MediaPipe's Hands API is loaded.
      const Hands = window.Hands;
      const HAND_CONNECTIONS = window.HAND_CONNECTIONS;
      if (!Hands || !HAND_CONNECTIONS) {
        console.error(
          'MediaPipe Hands or HAND_CONNECTIONS not found. Please include the CDN scripts in public/index.html.'
        );
        return;
      }

      // Get access to the webcam.
      try {
        videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = videoStream;
        }
      } catch (err) {
        console.error('Error accessing webcam: ', err);
        return;
      }

      // Initialize MediaPipe Hands.
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

      // --- Helper Functions for Gesture Detection ---
      function countExtendedFingers(landmarks, handedness) {
        const indexExtended = landmarks[8].y < landmarks[6].y;
        const middleExtended = landmarks[12].y < landmarks[10].y;
        const ringExtended = landmarks[16].y < landmarks[14].y;
        const pinkyExtended = landmarks[20].y < landmarks[18].y;
        let thumbExtended = false;
        if (handedness === "Left") {
          thumbExtended = landmarks[4].x > landmarks[3].x;
        } else if (handedness === "Right") {
          thumbExtended = landmarks[4].x < landmarks[3].x;
        }
        const count = (thumbExtended ? 1 : 0) +
                      (indexExtended ? 1 : 0) +
                      (middleExtended ? 1 : 0) +
                      (ringExtended ? 1 : 0) +
                      (pinkyExtended ? 1 : 0);
        return { thumb: thumbExtended, index: indexExtended, middle: middleExtended, ring: ringExtended, pinky: pinkyExtended, count };
      }

      // For the mode selector we use left hand's (physical left) gesture
      // which comes as raw "Right", and for drawing we use the right hand's coordinates
      // which come as raw "Left".
      function getGestureName(extended, handedness) {
        // For mode selection (left hand), consider:
        //   open palm → color–change mode.
        if (handedness === "Right" && extended.count === 5) {
          return "open_palm";
        }
        if (extended.count === 1 && extended.index) return "pointer";
        if (extended.count === 2 && extended.index && extended.middle) return "two_finger";
        if (extended.count === 3 && extended.index && extended.middle && extended.ring) return "three_finger";
        if (extended.count === 4 && extended.index && extended.middle && extended.ring && extended.pinky) return "four_finger";
        if (extended.count === 5) return "open_palm";
        return "unknown";
      }

      // Process each frame.
      hands.onResults((results) => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Apply horizontal flip (mirror effect).
        ctx.save();
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

        // --- Swap Hand Assignment per Mirroring Logic ---
        let leftHandLandmarks = null;  // Will hold mode gestures (from raw "Right").
        let rightHandLandmarks = null; // Will hold drawing coordinates (from raw "Left").
        let leftHandGesture = null;
        let rightHandGesture = null;

        if (results.multiHandLandmarks && results.multiHandedness) {
          results.multiHandLandmarks.forEach((landmarks, i) => {
            const rawHandLabel = results.multiHandedness[i].label; // "Left" or "Right"
            const extended = countExtendedFingers(landmarks, rawHandLabel);
            const gesture = getGestureName(extended, rawHandLabel);
            // Draw landmarks for debugging.
            window.drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
            window.drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 1 });
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            // For display, use the raw label.
            const textX = rawHandLabel === "Left" ? 10 : canvas.width - 150;
            const textY = 30 + i * 30;
            ctx.font = "24px Arial";
            ctx.fillStyle = "yellow";
            ctx.fillText(`${rawHandLabel}: ${gesture}`, textX, textY);
            ctx.restore();

            // IMPORTANT: Swap the assignments.
            // Use raw "Right" as left-hand (mode selector).
            if (rawHandLabel === "Right") {
              leftHandLandmarks = landmarks;
              leftHandGesture = gesture;
            }
            // Use raw "Left" as right-hand (drawing coordinates).
            else if (rawHandLabel === "Left") {
              rightHandLandmarks = landmarks;
              rightHandGesture = gesture;
            }
          });
        }
        ctx.restore();

        // --- Define Mode Flags Based on the Left Hand Gesture (mode selector) ---
        const isDrawingActive = leftHandGesture === "pointer";
        const isErasingActive = leftHandGesture === "two_finger";
        const isBrushResizeActive = leftHandGesture === "three_finger";
        const isUndoRedoActive = leftHandGesture === "four_finger";
        const isColorChangeActive = leftHandGesture === "open_palm";

        // --- Get Drawing Canvas Context ---
        const drawingCanvas = drawingCanvasRef.current;
        const drawingCtx = drawingCanvas.getContext('2d');

        // (You can include additional modes like canvas clearing here if needed.)

        // --- Handle Brush Resize Mode ---
        if (isBrushResizeActive && rightHandLandmarks) {
          const thumb = rightHandLandmarks[4];
          const index = rightHandLandmarks[8];
          const dx = (thumb.x - index.x) * canvas.width;
          const dy = (thumb.y - index.y) * canvas.height;
          const distance = Math.sqrt(dx * dx + dy * dy) / 2;
          const newBrushSize = Math.max(4, Math.min(distance, 50));
          brushSizeRef.current = newBrushSize;
          ctx.save();
          ctx.font = "32px Arial";
          ctx.fillStyle = "#fff";
          ctx.fillRect(10, 10, 60, 40);
          ctx.fillStyle = "#222";
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          ctx.fillText(Math.round(newBrushSize), 20, 18);
          ctx.restore();
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
        }
        // --- Handle Color Change Mode ---
        else if (isColorChangeActive && rightHandLandmarks) {
          // Use right hand gesture for color selection:
          // pointer => blue, two_finger => green, three_finger => red,
          // four_finger => yellow, open_palm => white.
          if (rightHandGesture === "pointer") {
            lineColorRef.current = "blue";
          } else if (rightHandGesture === "two_finger") {
            lineColorRef.current = "green";
          } else if (rightHandGesture === "three_finger") {
            lineColorRef.current = "red";
          } else if (rightHandGesture === "four_finger") {
            lineColorRef.current = "yellow";
          } else if (rightHandGesture === "open_palm") {
            lineColorRef.current = "white";
          }
          ctx.save();
          ctx.font = "32px Arial";
          ctx.fillStyle = "#fff";
          ctx.fillRect(10, 60, 200, 40);
          ctx.fillStyle = "#222";
          ctx.textAlign = "left";
          ctx.textBaseline = "top";
          ctx.fillText(`Color: ${lineColorRef.current}`, 20, 68);
          ctx.restore();
        }
        // --- Handle Normal Drawing / Erasing ---
        else if ((isDrawingActive || isErasingActive) && rightHandLandmarks) {
          const indexTip = rightHandLandmarks[8];
          const x = canvas.width - (indexTip.x * canvas.width);
          const y = indexTip.y * canvas.height;
          if (isDrawingActive) {
            drawingCtx.lineCap = 'round';
            drawingCtx.lineJoin = 'round';
            // Use current color.
            drawingCtx.strokeStyle = lineColorRef.current;
            drawingCtx.fillStyle = lineColorRef.current;
            if (!lastDrawingPosRef.current) {
              drawingCtx.beginPath();
              drawingCtx.arc(x, y, brushSizeRef.current / 2, 0, Math.PI * 2);
              drawingCtx.fill();
              lastDrawingPosRef.current = { x, y };
            } else {
              drawingCtx.beginPath();
              drawingCtx.moveTo(lastDrawingPosRef.current.x, lastDrawingPosRef.current.y);
              drawingCtx.lineTo(x, y);
              drawingCtx.lineWidth = brushSizeRef.current;
              drawingCtx.stroke();
              lastDrawingPosRef.current = { x, y };
            }
          } else if (isErasingActive) {
            drawingCtx.save();
            drawingCtx.globalCompositeOperation = "destination-out";
            drawingCtx.beginPath();
            if (!lastDrawingPosRef.current) {
              lastDrawingPosRef.current = { x, y };
            }
            drawingCtx.moveTo(lastDrawingPosRef.current.x, lastDrawingPosRef.current.y);
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
    }

    setup();

    return () => {
      if (camera) camera.stop();
      if (videoStream) {
        videoStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: 640, height: 480 }}>
      <video ref={videoRef} style={{ display: 'none' }} width={640} height={480} autoPlay />
      <canvas ref={canvasRef} width={640} height={480} style={{ border: '1px solid #333', position: 'absolute', top: 0, left: 0 }} />
      <canvas ref={drawingCanvasRef} width={640} height={480} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} />
    </div>
  );
}

export default WebcamFeed;
