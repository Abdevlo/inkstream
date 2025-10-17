// IsolatedMagicCard.tsx
import React, { useRef, useEffect, useCallback } from 'react';
import { gsap } from 'gsap';

export interface SessionCardProps {
  id?: string;
  title?: string;
  sessionId?: string;
  dateOfCreation?: string;
  status:string;
  backgroundColor?: string;
  glowColor?: string; // "r, g, b" e.g. "255, 222, 90"
  particleCount?: number;
  enableTilt?: boolean;
  enableMagnetism?: boolean;
  clickEffect?: boolean;
  disableAnimations?: boolean;
  onClick?: (e: React.MouseEvent) => void; // card click callback
  className?: string;
  style?: React.CSSProperties;
}

const DEFAULT_PARTICLE_COUNT = 10;
const DEFAULT_GLOW_COLOR = '255, 222, 90';
const MOBILE_BREAKPOINT = 768;

const createParticleElement = (x: number, y: number, color = DEFAULT_GLOW_COLOR) => {
  const el = document.createElement('div');
  el.className = 'imc-particle';
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
  el.style.background = `rgba(${color}, 1)`;
  el.style.boxShadow = `0 0 8px rgba(${color}, 0.6)`;
  return el;
};

const SessionCard: React.FC<SessionCardProps> = ({
  id,
  title = 'Title',
  sessionId = 'ID: 1234567890abcdef',
  status = 'active',
  dateOfCreation,
  backgroundColor = 'rgba(36,36,36,0.85)',
  glowColor = DEFAULT_GLOW_COLOR,
  particleCount = DEFAULT_PARTICLE_COUNT,
  enableTilt = true,
  enableMagnetism = true,
  clickEffect = true,
  disableAnimations = false,
  onClick,
  className = '',
  style
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const particlesRef = useRef<HTMLDivElement[]>([]);
  const timeoutsRef = useRef<number[]>([]);
  const isPointerInside = useRef(false);

  // Mobile / small screens -> disable complex animations automatically
  const shouldDisable = disableAnimations || (typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT);

  // Clear and remove particles
  const clearParticles = useCallback(() => {
    timeoutsRef.current.forEach((t) => clearTimeout(t));
    timeoutsRef.current = [];

    particlesRef.current.forEach((p) => {
      try {
        gsap.to(p, {
          scale: 0,
          opacity: 0,
          duration: 0.25,
          ease: 'power2.in',
          onComplete: () => p.remove()
        });
      } catch (e) {
        p.remove();
      }
    });
    particlesRef.current = [];
  }, []);

  // Spawn animated particles at random positions (relative to the card)
  const spawnParticles = useCallback(() => {
    const el = rootRef.current;
    if (!el || shouldDisable) return;

    const rect = el.getBoundingClientRect();
    for (let i = 0; i < particleCount; i++) {
      const px = Math.random() * rect.width;
      const py = Math.random() * rect.height;
      const particle = createParticleElement(px, py, glowColor);
      el.appendChild(particle);
      particlesRef.current.push(particle);

      // initial pop-in
      gsap.fromTo(
        particle,
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(1.6)' }
      );

      // drifting motion
      gsap.to(particle, {
        x: (Math.random() - 0.5) * 120,
        y: (Math.random() - 0.5) * 120,
        rotation: Math.random() * 360,
        duration: 3 + Math.random() * 4,
        ease: 'sine.inOut',
        repeat: -1,
        yoyo: true
      });

      // gentle flicker
      gsap.to(particle, {
        opacity: 0.3 + Math.random() * 0.7,
        duration: 1 + Math.random() * 2,
        ease: 'power1.inOut',
        repeat: -1,
        yoyo: true
      });
    }
  }, [particleCount, glowColor, shouldDisable]);

  // Click ripple effect
  const doClickRipple = useCallback((clientX: number, clientY: number) => {
    const el = rootRef.current;
    if (!el || shouldDisable || !clickEffect) return;

    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    // maximum distance to corners -> ensures ripple covers card
    const maxDistance = Math.max(
      Math.hypot(x, y),
      Math.hypot(x - rect.width, y),
      Math.hypot(x, y - rect.height),
      Math.hypot(x - rect.width, y - rect.height)
    );

    const ripple = document.createElement('div');
    ripple.className = 'imc-ripple';
    ripple.style.width = `${maxDistance * 2}px`;
    ripple.style.height = `${maxDistance * 2}px`;
    ripple.style.left = `${x - maxDistance}px`;
    ripple.style.top = `${y - maxDistance}px`;
    ripple.style.background = `radial-gradient(circle, rgba(${glowColor},0.18) 0%, rgba(${glowColor},0.08) 30%, transparent 70%)`;
    ripple.style.pointerEvents = 'none';
    ripple.style.position = 'absolute';
    ripple.style.borderRadius = '50%';
    ripple.style.zIndex = '60';

    el.appendChild(ripple);

    gsap.fromTo(
      ripple,
      { scale: 0, opacity: 1 },
      {
        scale: 1,
        opacity: 0,
        duration: 0.9,
        ease: 'power2.out',
        onComplete: () => {
          ripple.remove();
        }
      }
    );
  }, [clickEffect, glowColor, shouldDisable]);

  // Pointer move -> tilt & magnetism
  useEffect(() => {
    const el = rootRef.current;
    if (!el || shouldDisable) return;

    let lastTween: gsap.core.Tween | null = null;

    const onPointerMove = (ev: PointerEvent) => {
      // Only update while pointer is inside the card bounds
      const rect = el.getBoundingClientRect();
      const x = ev.clientX - rect.left;
      const y = ev.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      if (enableTilt) {
        const rotateX = ((y - cy) / cy) * -10; // invert for natural tilt
        const rotateY = ((x - cx) / cx) * 10;
        if (lastTween) lastTween.kill();
        lastTween = gsap.to(el, { rotateX, rotateY, duration: 0.12, ease: 'power2.out', transformPerspective: 1000 });
      }

      if (enableMagnetism) {
        const magnetX = (x - cx) * 0.04;
        const magnetY = (y - cy) * 0.04;
        gsap.to(el, { x: magnetX, y: magnetY, duration: 0.28, ease: 'power2.out' });
      }
    };

    const onPointerEnter = () => {
      isPointerInside.current = true;
      spawnParticles();
      gsap.to(el, { scale: 1.02, duration: 0.28, ease: 'power2.out' });
    };

    const onPointerLeave = () => {
      isPointerInside.current = false;
      clearParticles();
      gsap.to(el, { rotateX: 0, rotateY: 0, x: 0, y: 0, scale: 1, duration: 0.35, ease: 'power2.out' });
    };

    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerenter', onPointerEnter);
    el.addEventListener('pointerleave', onPointerLeave);

    return () => {
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerenter', onPointerEnter);
      el.removeEventListener('pointerleave', onPointerLeave);
      lastTween?.kill();
      clearParticles();
    };
  }, [spawnParticles, clearParticles, enableTilt, enableMagnetism, shouldDisable]);

  // Click handler
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const handler = (ev: MouseEvent) => {
      doClickRipple(ev.clientX, ev.clientY);
    };

    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [doClickRipple]);

  return (
    <div
      id={id}
      ref={rootRef}
      role="button"
      tabIndex={0}
      aria-label={title}
      className={`isolated-magic-card ${className}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 16,
        padding: 18,
        minWidth: 240,
        minHeight: 200,
        background: backgroundColor,
        cursor: 'pointer',
        // CSS vars used by the CSS below:
        // --imc-glow: rgba(255,255,255,0.05);
        // --imc-glow-color: 'r g b' is used in CSS via var
        ...style
      }}
      onClick={(e) => {
        if (onClick) onClick(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (onClick) onClick(e as unknown as React.MouseEvent);
          // simulate ripple at center
          const elRect = rootRef.current?.getBoundingClientRect();
          if (elRect) doClickRipple(elRect.left + elRect.width / 2, elRect.top + elRect.height / 2);
        }
      }}
    >
      {/* label */}
      {dateOfCreation && (
        <div className="imc-label" aria-hidden style={{ position: 'absolute', top: 12, left: 12, zIndex: 40 }}>
          {dateOfCreation}
        </div>
      )}

      {/* content */}
      <div style={{ zIndex: 50, position: 'relative' }}>
        <h3 style={{ marginTop: 40, color: 'white', fontSize: 18 }}>{title}</h3>
        <p style={{ marginTop: 4, color: 'rgba(255,255,255,0.9)', fontSize: 13 }}>{sessionId}</p>
        <div className="mt-4 flex items-center justify-between text-sm mb-3">
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            status === 'active'
              ? 'border border-green-700 text-green-700'
              : 'bg-gray-100 text-gray-800'
          }`}
        >
          {status}
        </span>
      </div>
      </div>

      


      {/* subtle inner border glow using CSS variables */}
      <div className="imc-inner-glow" aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 30, pointerEvents: 'none' }} />
      {/* particle elements & ripples are appended directly to the root element */}
      <style>{`
        /* CSS variables for glow color (r g b) */
        .isolated-magic-card {
          --imc-glow-color: ${glowColor};
          --imc-glow-intensity: 0.6;
        }
        .imc-particle {
          position: absolute;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          opacity: 0;
          z-index: 55;
          pointer-events: none;
          transform-origin: center;
        }
        .imc-ripple {
          will-change: transform, opacity;
        }
        .imc-inner-glow{
          background: radial-gradient(circle at var(--glow-x, 50%) var(--glow-y, 50%), rgba(var(--imc-glow-color), calc(var(--imc-glow-intensity) * 0.12)) 0%, transparent 40%);
          transition: background 0.12s linear;
          mix-blend-mode: screen;
        }
        .imc-label {
          background: rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.95);
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          backdrop-filter: blur(6px);
        }
        /* keyboard focus */
        .isolated-magic-card:focus {
          outline: 3px solid rgba(255,222,90,0.12);
          outline-offset: 4px;
        }
        /* make sure ripples/particles don't affect layout */
        .isolated-magic-card > .imc-particle,
        .isolated-magic-card > .imc-ripple {
          position: absolute;
        }
      `}</style>
    </div>
  );
};

export default SessionCard;
