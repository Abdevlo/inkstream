'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

export function BlobCursor() {
  const blobRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const blob = blobRef.current;
    const dot = dotRef.current;
    if (!blob || !dot) return;

    // Hide default cursor
    document.body.style.cursor = 'none';

    let mouseX = 0;
    let mouseY = 0;
    let prevMouseX = 0;
    let prevMouseY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;

      // Calculate velocity
      const deltaX = mouseX - prevMouseX;
      const deltaY = mouseY - prevMouseY;
      const velocity = Math.sqrt(deltaX ** 2 + deltaY ** 2);
      const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

      prevMouseX = mouseX;
      prevMouseY = mouseY;

      // Update dot position immediately
      gsap.set(dot, {
        x: mouseX,
        y: mouseY,
      });

      // Calculate distortion based on velocity
      const distortion = Math.min(velocity * 0.5, 20);
      const scaleX = 1 + distortion * 0.03;
      const scaleY = 1 - distortion * 0.02;

      // Smooth blob follow with GSAP + distortion
      gsap.to(blob, {
        x: mouseX,
        y: mouseY,
        scaleX: scaleX,
        scaleY: scaleY,
        rotation: angle,
        duration: 0.8,
        ease: 'power2.out',
      });

      // Reset scale gradually when stopped
      gsap.to(blob, {
        scaleX: 1,
        scaleY: 1,
        duration: 0.5,
        delay: 0.1,
        ease: 'power2.out',
      });
    };

    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.body.style.cursor = '';
    };
  }, []);

  return (
    <>
      {/* Blob cursor with delay */}
      <div
        ref={blobRef}
        className="pointer-events-none fixed top-0 left-0 z-[9999] -translate-x-1/2 -translate-y-1/2"
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, #ffde5a 0%, #ffde5a 70%)',
        }}
      />
      {/* Instant dot cursor */}
      <div
        ref={dotRef}
        className="pointer-events-none fixed top-0 left-0 z-[10000] -translate-x-1/2 -translate-y-1/2"
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: 'rgba(255,255,0,1)',
        }}
      />
    </>
  );
}
