'use client';

import { useEffect, RefObject } from 'react';
import gsap from 'gsap';
import { Draggable } from 'gsap/Draggable';

export function useDraggableDock(dockRef: RefObject<HTMLElement>) {
  useEffect(() => {
    if (!dockRef.current) return;

    // Register GSAP Draggable plugin
    gsap.registerPlugin(Draggable);

    const dockElement = dockRef.current;

    // Set initial rotation
    gsap.set(dockElement, {
      rotation: 0,
    });

    // Create draggable instance with trigger limited to non-interactive areas
    const draggableInstance = Draggable.create(dockElement, {
      type: 'x,y',
      edgeResistance: 0.65,
      bounds: window,
      inertia: true,
      allowEventDefault: true,
      dragClickables: false,
      onPress: function(e: any) {
        // Prevent dragging if starting on interactive elements
        const target = e.target as HTMLElement;
        const isInteractive =
          target.closest('input') ||
          target.closest('textarea') ||
          target.closest('button') ||
          target.closest('select') ||
          target.closest('a') ||
          target.closest('label') ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'BUTTON' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'LABEL' ||
          target.tagName === 'A';

        if (isInteractive) {
          this.endDrag();
        }
      },
    });

    // Cleanup
    return () => {
      if (draggableInstance && draggableInstance[0]) {
        draggableInstance[0].kill();
      }
    };
  }, [dockRef]);
}
