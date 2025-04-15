import React, { useRef, useEffect } from 'react';

function WebcamFeed() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const drawingCanvasRef = useRef(null);
  const lastDrawingPosRef = useRef(null);
  const brushSizeRef = useRef(4);
  const lineColorRef = useRef("red");

  useEffect(() => {
    let camera = null;
    let hands = null;
    let videoStream = null;

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
        if (
          handedness === "Right" &&
          extended.thumb && extended.index && !extended.middle &&
          !extended.ring && extended.pinky
        ) {
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

            const displayLabel = rawLabel === "Left" ? "Right (Draw)" : "Left (Mode)";
            const textX = rawLabel === "Right" ? 10 : canvas.width - 150;
            const textY = 30 + i * 30;

            window.drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
            window.drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 1 });

            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.font = "24px Arial";
            ctx.fillStyle = "yellow";
            ctx.fillText(`${displayLabel}: ${gesture}`, textX, textY);
            ctx.restore();

            if (rawLabel === "Right") {
              leftHandGesture = gesture;
              if (gesture === "yolo") shouldClearCanvas = true;
              else if (gesture === "pointer") isDrawingActive = true;
              else if (gesture === "two_finger") isErasingActive = true;
              else if (gesture === "three_finger") isBrushResizeActive = true;
              else if (gesture === "open_palm") isColorChangeActive = true;
            } else if (rawLabel === "Left") {
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
