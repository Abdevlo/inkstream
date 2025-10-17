// ResizableContainerWithGSAP.tsx
"use client";

import React, { useEffect, useRef } from "react";
import gsap from "gsap";
import { Draggable } from "gsap/Draggable";

gsap.registerPlugin(Draggable);

/**
 * Resizable + Draggable container with persistent size/position (localStorage).
 *
 * Props:
 *  - componentId: unique id used for persistence (required if you want persistence)
 *  - initialWidth/initialHeight: default size if nothing stored
 *  - initialX/initialY: initial pixel position (optional)
 *  - initialLeftPercent/initialTopPercent: initial normalized (0..1) position (optional)
 *  - avoidOverlap: if true, on first mount this component will attempt to shift itself
 *                  so it doesn't overlap any existing saved components in localStorage.
 *  - overlapOffset: px to nudge by when avoiding overlap (default 32)
 *  - minWidth/minHeight, className, children
 */

type Props = {
  componentId?: string;
  initialWidth?: number;
  initialHeight?: number;
  initialX?: number; // px - absolute x relative to viewport left
  initialY?: number; // px
  initialLeftPercent?: number; // 0..1 relative to viewport available area
  initialTopPercent?: number; // 0..1
  minWidth?: number;
  minHeight?: number;
  avoidOverlap?: boolean;
  overlapOffset?: number;
  className?: string;
  children?: React.ReactNode;
};

type SavedState = {
  width: number;
  height: number;
  x_px: number;
  y_px: number;
  leftPercent?: number;
  topPercent?: number;
  ts?: number;
};

const LS_PREFIX = "resizable:";

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function debounce<T extends (...args: any[]) => void>(fn: T, wait = 150) {
  let t: number | undefined;
  return (...args: Parameters<T>) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), wait);
  };
}

// get bounding rect relative to page
function getBoxLeftTop(box: HTMLElement) {
  const rect = box.getBoundingClientRect();
  return { left: rect.left + window.scrollX, top: rect.top + window.scrollY, width: rect.width, height: rect.height };
}
// compute percent from box using viewport coordinates (no scroll)
function computePercentFromBox(box: HTMLElement) {
  const rect = box.getBoundingClientRect(); // viewport coords
  const left = rect.left; // <-- viewport-relative
  const top = rect.top;
  const width = rect.width;
  const height = rect.height;

  const availW = Math.max(1, window.innerWidth - width);
  const availH = Math.max(1, window.innerHeight - height);

  return {
    leftPercent: clamp(left / availW, 0, 1),
    topPercent: clamp(top / availH, 0, 1),
  };
}

// convert percents back to px (these px are viewport-relative left/top)
function pxFromPercentForSize(width: number, height: number, leftPercent?: number, topPercent?: number) {
  const availW = Math.max(0, window.innerWidth - width);
  const availH = Math.max(0, window.innerHeight - height);
  return {
    x_px: leftPercent != null ? Math.round(availW * clamp(leftPercent, 0, 1)) : 0,
    y_px: topPercent != null ? Math.round(availH * clamp(topPercent, 0, 1)) : 0,
  };
}


// read all saved states from localStorage under LS_PREFIX
function readAllSavedStates(): Record<string, SavedState> {
  const out: Record<string, SavedState> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith(LS_PREFIX)) {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          out[key.slice(LS_PREFIX.length)] = JSON.parse(raw) as SavedState;
        } catch {}
      }
    }
  } catch {}
  return out;
}

// check rect overlap
function rectsOverlap(a: { left: number; top: number; width: number; height: number }, b: { left: number; top: number; width: number; height: number }) {
  return !(
    a.left + a.width <= b.left ||
    b.left + b.width <= a.left ||
    a.top + a.height <= b.top ||
    b.top + b.height <= a.top
  );
}

export default function Resizable({
  componentId = "default",
  initialWidth = 820,
  initialHeight = 420,
  initialX,
  initialY,
  initialLeftPercent,
  initialTopPercent,
  minWidth = 320,
  minHeight = 200,
  avoidOverlap = false,
  overlapOffset = 32,
  className = "",
  children,
}: Props) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const handlesRef = useRef<Record<string, HTMLDivElement | null>>({});
  const containerDraggableRef = useRef<any>(null);
  const resizeDraggablesRef = useRef<any[]>([]);

  const lsKey = `${LS_PREFIX}${componentId}`;
  const saveToStorage = (state: SavedState) => {
    try {
      localStorage.setItem(lsKey, JSON.stringify({ ...state, ts: Date.now() }));
    } catch (e) {
      console.warn("Failed to save resizable state", e);
    }
  };
  const debouncedSave = useRef(debounce(saveToStorage, 150)).current;

  useEffect(() => {
    const box = boxRef.current!;
    if (!box) return;

    // read saved
    let saved: SavedState | null = null;
    try {
      const raw = localStorage.getItem(lsKey);
      if (raw) saved = JSON.parse(raw);
    } catch (e) {
      console.warn("failed to parse saved resizable state", e);
    }

    // Determine initial width/height and initial x/y
    const startW = saved?.width ?? initialWidth;
    const startH = saved?.height ?? initialHeight;

    // compute initial pixel x/y from priorities:
    // 1) saved percents -> px
    // 2) saved x_px/y_px
    // 3) initialLeftPercent/initialTopPercent (props)
    // 4) initialX/initialY (props)
    // 5) default 0,0
    let startX = 0;
    let startY = 0;

    if (saved) {
      if (saved.leftPercent != null || saved.topPercent != null) {
        const px = pxFromPercentForSize(startW, startH, saved.leftPercent, saved.topPercent);
        startX = px.x_px;
        startY = px.y_px;
      } else {
        startX = saved.x_px ?? 0;
        startY = saved.y_px ?? 0;
      }
    } else if (initialLeftPercent != null || initialTopPercent != null) {
      const px = pxFromPercentForSize(startW, startH, initialLeftPercent, initialTopPercent);
      startX = px.x_px;
      startY = px.y_px;
    } else if (initialX != null || initialY != null) {
      startX = initialX ?? 0;
      startY = initialY ?? 0;
    }

    // apply initial size and pos
    gsap.set(box, { width: startW, height: startH, x: startX, y: startY });

    // If avoidOverlap is enabled and there's no saved state (first time),
    // try to nudge this box until it doesn't overlap other saved boxes.
    if (avoidOverlap && !saved) {
      try {
        const others = readAllSavedStates();
        // compute this box rect (left/top relative to page)
        const thisRect = () => {
          const { left, top, width, height } = getBoxLeftTop(box);
          return { left, top, width, height };
        };

        let j = 0;
        let maxTries = 30;
        while (j < maxTries) {
          const rect = thisRect();
          let collided = false;
          for (const [otherId, s] of Object.entries(others)) {
            // compute other rect in px
            const otherPx = pxFromPercentForSize(s.width, s.height, s.leftPercent, s.topPercent);
            // other left/top are relative to viewport available area -> convert to page coords (no scroll considered here)
            // For saved x_px/y_px we can use them directly; for robust approach, compute left/top same way:
            const otherLeft = otherPx.x_px;
            const otherTop = otherPx.y_px;
            const otherRect = { left: otherLeft, top: otherTop, width: s.width, height: s.height };
            if (rectsOverlap(rect, otherRect)) {
              collided = true;
              break;
            }
          }
          if (!collided) break;

          // nudge this box to the right then down, wrapping if necessary
          const curX = (containerDraggableRef.current && containerDraggableRef.current.x) || 0;
          const curY = (containerDraggableRef.current && containerDraggableRef.current.y) || 0;
          let nextX = curX + overlapOffset;
          let nextY = curY;
          // if off-screen to the right, wrap to left and push down
          const visibleWidth = window.innerWidth;
          if (nextX + box.offsetWidth > visibleWidth) {
            nextX = 0;
            nextY = curY + overlapOffset;
          }
          gsap.set(box, { x: nextX, y: nextY });
          j++;
        }
      } catch (e) {
        // non-fatal
      }
    }

    // make the whole box draggable
    containerDraggableRef.current = Draggable.create(box, {
      type: "x,y",
      edgeResistance: 0.65,
      bounds: window,
      inertia: true,
      allowContextMenu: true,
      onDragStart() {
        box.style.zIndex = "1000";
      },
      onDragEnd() {
        box.style.zIndex = "";
        const state: SavedState = {
          width: box.offsetWidth,
          height: box.offsetHeight,
          x_px: Math.round(this.x),
          y_px: Math.round(this.y),
          ...computePercentFromBox(box),
        };
        debouncedSave(state);
      },
    })[0];

    const setBox = (props: { width?: number; height?: number; x?: number; y?: number }) => {
      gsap.set(box, props);
    };

    // create resize draggables
    const createResize = (handleEl: HTMLElement | null, dir: string) => {
      if (!handleEl) return null;

      return Draggable.create(handleEl, {
        type: "x,y",
        onDragStart(this: any) {
          containerDraggableRef.current?.disable();
          this.startWidth = box.offsetWidth;
          this.startHeight = box.offsetHeight;

          const matrix = window.getComputedStyle(box).transform;
          let tx = 0,
            ty = 0;
          if (matrix && matrix !== "none") {
            const vals = matrix.match(/matrix\((.+)\)/);
            if (vals && vals[1]) {
              const parts = vals[1].split(",").map((p) => parseFloat(p));
              tx = parts[4] || 0;
              ty = parts[5] || 0;
            }
          }
          this.startX = tx;
          this.startY = ty;
        },
        onDrag(this: any) {
          const dx = this.x;
          const dy = this.y;

          let newW = this.startWidth;
          let newH = this.startHeight;
          let newX = this.startX;
          let newY = this.startY;

          // Handle horizontal resizing
          if (dir.includes("right")) {
            newW = Math.max(minWidth, Math.round(this.startWidth + dx));
          }
          if (dir.includes("left")) {
            const proposedW = Math.max(minWidth, Math.round(this.startWidth - dx));
            const deltaW = this.startWidth - proposedW;
            newW = proposedW;
            newX = Math.round(this.startX + deltaW);
          }
          
          // Handle vertical resizing
          if (dir.includes("bottom")) {
            newH = Math.max(minHeight, Math.round(this.startHeight + dy));
          }
          if (dir.includes("top")) {
            const proposedH = Math.max(minHeight, Math.round(this.startHeight - dy));
            const deltaH = this.startHeight - proposedH;
            newH = proposedH;
            newY = Math.round(this.startY + deltaH);
          }

          setBox({ width: newW, height: newH, x: newX, y: newY });
        },
        onRelease(this: any) {
          containerDraggableRef.current?.enable();
          gsap.set(this.target, { x: 0, y: 0 });

          const currentX = (containerDraggableRef.current && containerDraggableRef.current.x) || 0;
          const currentY = (containerDraggableRef.current && containerDraggableRef.current.y) || 0;
          
          const state: SavedState = {
            width: box.offsetWidth,
            height: box.offsetHeight,
            x_px: Math.round(currentX),
            y_px: Math.round(currentY),
            ...computePercentFromBox(box),
          };
          debouncedSave(state);
        },
        onKill(this: any) {
          try {
            gsap.set(this.target, { x: 0, y: 0 });
          } catch {}
        },
      })[0];
    };

    const handleMap: Record<string, string> = {
      right: "right",
      left: "left",
      top: "top",
      bottom: "bottom",
      topLeft: "top left",
      topRight: "top right",
      bottomLeft: "bottom left",
      bottomRight: "bottom right",
    };

    resizeDraggablesRef.current = Object.keys(handleMap)
      .map((key) => {
        const el = handlesRef.current[key];
        return createResize(el, handleMap[key]);
      })
      .filter(Boolean);

    // window resize listener: maintain relative positioning on viewport changes
    const onWinResize = () => {
      try {
        const raw = localStorage.getItem(lsKey);
        if (!raw) return;
        const s: SavedState = JSON.parse(raw);
        if (!s) return;
        
        // Always prefer percentage-based positioning if available
        if (s.leftPercent != null && s.topPercent != null) {
          const px = pxFromPercentForSize(s.width ?? box.offsetWidth, s.height ?? box.offsetHeight, s.leftPercent, s.topPercent);
          gsap.set(box, { 
            x: px.x_px, 
            y: px.y_px, 
            width: s.width ?? box.offsetWidth, 
            height: s.height ?? box.offsetHeight 
          });
          // Update the draggable instance position
          if (containerDraggableRef.current) {
            containerDraggableRef.current.x = px.x_px;
            containerDraggableRef.current.y = px.y_px;
          }
        } else if (s.x_px != null && s.y_px != null) {
          // Clamp absolute positions to current viewport
          const maxX = Math.max(0, window.innerWidth - (s.width ?? box.offsetWidth));
          const maxY = Math.max(0, window.innerHeight - (s.height ?? box.offsetHeight));
          const newX = clamp(s.x_px, 0, maxX);
          const newY = clamp(s.y_px, 0, maxY);
          gsap.set(box, { x: newX, y: newY });
          // Update the draggable instance position
          if (containerDraggableRef.current) {
            containerDraggableRef.current.x = newX;
            containerDraggableRef.current.y = newY;
          }
        }
      } catch (e) {
        console.warn('Failed to handle window resize for resizable component:', e);
      }
    };
    window.addEventListener("resize", onWinResize);

    // cleanup
    return () => {
      window.removeEventListener("resize", onWinResize);
      containerDraggableRef.current?.kill && containerDraggableRef.current.kill();
      resizeDraggablesRef.current.forEach((d) => d?.kill && d.kill());
      resizeDraggablesRef.current = [];
    };
  }, [
    componentId,
    initialWidth,
    initialHeight,
    initialX,
    initialY,
    initialLeftPercent,
    initialTopPercent,
    minWidth,
    minHeight,
    avoidOverlap,
    overlapOffset,
    debouncedSave,
  ]);

  // Dot handle: wrapper is larger (20x20) for easy hit; visual dot small.
  const Dot = ({ k }: { k: string }) => (
    <div
      ref={(el) => {
        handlesRef.current[k] = el;
      }}
      style={{
        position: "relative",
        width: 20,
        height: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 2000,
        pointerEvents: "auto",
        touchAction: "none",
      }}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <div
        style={{
          width: 8,
          height: 8,
          borderRadius: 9999,
          background: "#ffde5a",
          boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
          pointerEvents: "none",
        }}
      />
    </div>
  );

  return (
    <div
      ref={boxRef}
      className={`relative ${className}`}
      style={{ touchAction: "none" }}
    >
      <div className="w-full h-full rounded-lg overflow-hidden">{children}</div>

      {/* Edge midpoints (20x20 wrapper for easier touch) */}
      <div style={{ top: 0, left: "50%", position: "absolute", transform: "translate(-50%,-10px)" }}>
        <Dot k="top" />
      </div>
      <div style={{ bottom: 0, left: "50%", position: "absolute", transform: "translate(-50%,10px)" }}>
        <Dot k="bottom" />
      </div>
      <div style={{ left: 0, top: "50%", position: "absolute", transform: "translate(-10px,-50%)" }}>
        <Dot k="left" />
      </div>
      <div style={{ right: 0, top: "50%", position: "absolute", transform: "translate(10px,-50%)" }}>
        <Dot k="right" />
      </div>

      {/* corners */}
      <div style={{ top: 0, left: 0, position: "absolute", transform: "translate(-10px,-10px)" }}>
        <Dot k="topLeft" />
      </div>
      <div style={{ top: 0, right: 0, position: "absolute", transform: "translate(10px,-10px)" }}>
        <Dot k="topRight" />
      </div>
      <div style={{ bottom: 0, left: 0, position: "absolute", transform: "translate(-10px,10px)" }}>
        <Dot k="bottomLeft" />
      </div>
      <div style={{ bottom: 0, right: 0, position: "absolute", transform: "translate(10px,10px)" }}>
        <Dot k="bottomRight" />
      </div>

      <div className="pointer-events-none absolute inset-0 rounded-lg border border-[#ffde5a]/60" />
    </div>
  );
}
