import React, { useRef, useEffect } from 'react';

function WebcamFeed() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    let camera = null;
    let hands = null;
    let videoStream = null;

    async function setup() {
      // Ensure MediaPipe's Hands API and connection constants are loaded.
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

      // Initialize the MediaPipe Hands solution.
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
      // Count whether each finger is extended.
      // For index, middle, ring, and pinky, we compare the tip (landmarks 8, 12, 16, 20)
      // to the corresponding pip (landmarks 6, 10, 14, 18).
      // For the thumb, use a horizontal comparison that is reversed for left/right.
      function countExtendedFingers(landmarks, handedness) {
        const indexExtended = landmarks[8].y < landmarks[6].y;
        const middleExtended = landmarks[12].y < landmarks[10].y;
        const ringExtended = landmarks[16].y < landmarks[14].y;
        const pinkyExtended = landmarks[20].y < landmarks[18].y;
        let thumbExtended = false;
        if (handedness === "Left") {
          // For left hand, thumb extended if tip is to the right of landmark 3.
          thumbExtended = landmarks[4].x > landmarks[3].x;
        } else if (handedness === "Right") {
          // For right hand, thumb extended if tip is to the left of landmark 3.
          thumbExtended = landmarks[4].x < landmarks[3].x;
        }
        const count = (thumbExtended ? 1 : 0) +
                      (indexExtended ? 1 : 0) +
                      (middleExtended ? 1 : 0) +
                      (ringExtended ? 1 : 0) +
                      (pinkyExtended ? 1 : 0);
        return {
          thumb: thumbExtended,
          index: indexExtended,
          middle: middleExtended,
          ring: ringExtended,
          pinky: pinkyExtended,
          count: count
        };
      }

      // Determine the gesture based on the extended fingers.
      // Gestures:
      // - "pointer": only index extended.
      // - "two_finger": index + middle.
      // - "three_finger": index + middle + ring.
      // - "four_finger": index + middle + ring + pinky.
      // - "open_palm": all five extended.
      function getGestureName(extended, handedness) {
        // YOLO gesture: index, pinky, thumb out; middle and ring folded (ONLY for user's real left hand, i.e. detected as 'Right')
        if (
          handedness === "Right" &&
          extended.thumb &&
          extended.index &&
          !extended.middle &&
          !extended.ring &&
          extended.pinky
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

      // Set up the onResults callback.
      hands.onResults((results) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        ctx.save();

        // --- Apply a horizontal flip for a mirror-effect ---
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);

        // Draw the latest video frame (flipped).
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

        // Draw landmarks and connectors.
        if (results.multiHandLandmarks) {
          for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            const landmarks = results.multiHandLandmarks[i];
            window.drawConnectors(ctx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 2 });
            window.drawLandmarks(ctx, landmarks, { color: '#FF0000', lineWidth: 1 });
          }
        }

        // --- Gesture Detection & Display ---
        // Note: MediaPipe's handedness is based on the original image.
        // Since we've flipped the canvas, swap the labels so the displayed gesture matches the user.
        if (results.multiHandLandmarks && results.multiHandedness) {
          for (let i = 0; i < results.multiHandLandmarks.length; i++) {
            let handLabel = results.multiHandedness[i].label; // "Left" or "Right" based on original image
            // Swap the label for the mirror view.
            const displayLabel = handLabel === "Left" ? "Right" : "Left";
            const landmarks = results.multiHandLandmarks[i];
            const extended = countExtendedFingers(landmarks, handLabel);
            const gesture = getGestureName(extended, handLabel);

            // Decide display position. Here we show:
            // - Display label for the flipped view along with the detected gesture.
            // To draw readable text, temporarily unflip the context
            ctx.save();
            ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset transform
            let textX = displayLabel === "Left" ? 10 : canvas.width - 150;
            let textY = 30 + i * 30; // Offset if more than one hand is detected.
            ctx.font = "24px Arial";
            ctx.fillStyle = "yellow";
            ctx.fillText(`${displayLabel}: ${gesture}`, textX, textY);
            ctx.restore();
          }
        }

        ctx.restore();
      });

      // Initialize the MediaPipe Camera with the video element.
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

    // Cleanup on component unmount.
    return () => {
      if (camera) camera.stop();
      if (videoStream) {
        videoStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: 640, height: 480 }}>
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
        style={{ border: '1px solid #333' }}
      />
    </div>
  );
}

export default WebcamFeed;
