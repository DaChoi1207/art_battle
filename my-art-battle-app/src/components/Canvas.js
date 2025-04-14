import React, { useRef, useEffect, useState } from 'react';

function Canvas({ drawingData, onDrawLine }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [lastPos, setLastPos] = useState(null);

  // Draw all lines from drawingData
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);

    drawingData.forEach(cmd => {
      context.strokeStyle = cmd.color || '#000';
      context.lineWidth = cmd.thickness || 2;
      context.beginPath();
      context.moveTo(...cmd.from);
      context.lineTo(...cmd.to);
      context.stroke();
    });
  }, [drawingData]);

  // Mouse event handlers
  const handleMouseDown = (e) => {
    setDrawing(true);
    const rect = canvasRef.current.getBoundingClientRect();
    setLastPos([
      e.clientX - rect.left,
      e.clientY - rect.top
    ]);
  };

  const handleMouseMove = (e) => {
    if (!drawing) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const newPos = [
      e.clientX - rect.left,
      e.clientY - rect.top
    ];
    if (lastPos && onDrawLine) {
      // Notify parent about the new line segment
      onDrawLine({
        from: lastPos,
        to: newPos,
        color: '#000',      // You can make this dynamic
        thickness: 2        // You can make this dynamic
      });
    }
    setLastPos(newPos);
  };

  const handleMouseUp = () => {
    setDrawing(false);
    setLastPos(null);
  };

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={480}
      style={{ border: '1px solid #000' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    />
  );
}

export default Canvas;