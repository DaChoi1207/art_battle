import React, { useRef, useEffect } from 'react';

// AnimatedBackground: vibrant, beautiful, floating pastel circles using canvas

export default function AnimatedBackground() {
  const canvasRef = useRef(null);
  const animationRef = useRef();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let dpr = window.devicePixelRatio || 1;
    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Vibrant, beautiful floating pastel circles
    const NUM_CIRCLES = 18;
    const pastelPalette = [
      'rgba(250,130,170,0.55)',   // richer pink
      'rgba(255,182,193,0.52)',   // classic light pink
      'rgba(136,176,255,0.54)',   // richer blue
      'rgba(100,149,237,0.52)',   // cornflower blue
      'rgba(180,140,255,0.52)',   // richer lavender
      'rgba(221,160,221,0.50)',   // plum
      'rgba(255,249,196,0.46)',   // soft yellow
      'rgba(255,255,255,0.32)',   // white for layering
      'rgba(245,213,255,0.50)',   // pinkish lavender
      'rgba(210,160,255,0.50)'    // soft purple
    ];
    const circles = Array.from({ length: NUM_CIRCLES }).map((_, i) => {
      const color = pastelPalette[Math.floor(Math.random() * pastelPalette.length)];
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        r: 64 + Math.random() * 52, // bigger
        dx: (Math.random() - 0.5) * 0.25,
        dy: (Math.random() - 0.5) * 0.25,
        baseAlpha: 0.32 + Math.random() * 0.10, // more visible
        color,
        pulseSeed: Math.random() * 1000,
        glow: 32 + Math.random() * 22 // bolder glow
      };
    });

    function drawCircle(c, t) {
      ctx.save();
      ctx.beginPath();
      // Gentle pulsing
      let pulse = 1 + Math.sin(t/1800 + c.pulseSeed) * 0.09;
      ctx.arc(c.x, c.y, c.r * pulse, 0, 2 * Math.PI);
      ctx.globalAlpha = c.baseAlpha + Math.sin(t/2400 + c.pulseSeed) * 0.06;
      ctx.fillStyle = c.color;
      ctx.shadowColor = c.color.replace(/, [\d.]+\)/, ', 0.75)');
      ctx.shadowBlur = c.glow;
      ctx.fill();
      ctx.restore();
    }

    function animate() {
      ctx.clearRect(0, 0, width, height);
      const t = Date.now();
      circles.forEach((c) => {
        drawCircle(c, t);
        c.x += c.dx;
        c.y += c.dy;
        // Wrap around screen
        if (c.x < -60) c.x = width + 30;
        if (c.x > width + 60) c.x = -30;
        if (c.y < -60) c.y = height + 30;
        if (c.y > height + 60) c.y = -30;
      });
      animationRef.current = requestAnimationFrame(animate);
    }
    animate();
    // Resize handler
    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        opacity: 0.7,
        filter: 'blur(1.2px) saturate(1.07)',
        transition: 'opacity 0.7s',
      }}
      aria-hidden="true"
    />
  );
}



