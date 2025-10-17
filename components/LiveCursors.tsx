'use client';

import { useEffect, useState } from 'react';
import { getHybridClient } from '@/lib/hybrid/hybrid-client';

interface CursorData {
  socketId: string;
  x: number;
  y: number;
  userId?: string;
  timestamp: number;
}

interface LiveCursorsProps {
  sessionId: string;
  userId?: string;
}

export function LiveCursors({ sessionId, userId }: LiveCursorsProps) {
  const [cursors, setCursors] = useState<Map<string, CursorData>>(new Map());
  const wsClient = getHybridClient();

  useEffect(() => {
    // Listen for cursor movements from other users
    const handleCursorMove = (data: CursorData) => {
      // Validate cursor data
      if (!data || !data.socketId || typeof data.x !== 'number' || typeof data.y !== 'number') {
        console.warn('Invalid cursor data received:', data);
        return;
      }

      // Don't show our own cursor
      if (data.userId === userId) {
        return;
      }

      setCursors(prev => {
        const newCursors = new Map(prev);
        newCursors.set(data.socketId, data);
        return newCursors;
      });

      // Remove old cursors after 3 seconds of inactivity
      setTimeout(() => {
        setCursors(prev => {
          const newCursors = new Map(prev);
          const cursor = newCursors.get(data.socketId);
          if (cursor && cursor.timestamp === data.timestamp) {
            newCursors.delete(data.socketId);
          }
          return newCursors;
        });
      }, 3000);
    };

    // Listen for users leaving
    const handleUserLeft = (data: { socketId?: string; userId?: string }) => {
      if (!data || (!data.socketId && !data.userId)) {
        return;
      }

      setCursors(prev => {
        const newCursors = new Map(prev);
        
        // Try to remove by socketId first, then by userId
        if (data.socketId) {
          newCursors.delete(data.socketId);
        } else if (data.userId) {
          // Find and remove cursor by userId
          for (const [socketId, cursor] of newCursors.entries()) {
            if (cursor.userId === data.userId) {
              newCursors.delete(socketId);
              break;
            }
          }
        }
        
        return newCursors;
      });
    };

    wsClient.on('cursor-moved', handleCursorMove);
    wsClient.on('user-left', handleUserLeft);

    // Track mouse movements and send to other users
    const handleMouseMove = (e: MouseEvent) => {
      const rect = document.body.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Throttle cursor updates (send max 10 times per second)
      if (!handleMouseMove.lastSent || Date.now() - handleMouseMove.lastSent > 100) {
        wsClient.sendCursorMove(x, y, userId);
        handleMouseMove.lastSent = Date.now();
      }
    };

    // Add mouse tracking
    document.addEventListener('mousemove', handleMouseMove);

    return () => {
      wsClient.off('cursor-moved', handleCursorMove);
      wsClient.off('user-left', handleUserLeft);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [sessionId, userId]);

  return (
    <div className="fixed inset-0 pointer-events-none z-50">
      {Array.from(cursors.entries())
        .filter(([socketId, cursor]) => socketId && cursor && typeof cursor.x === 'number' && typeof cursor.y === 'number')
        .map(([socketId, cursor]) => (
        <div
          key={socketId}
          className="absolute transition-all duration-100 ease-out"
          style={{
            left: cursor.x,
            top: cursor.y,
            transform: 'translate(-2px, -2px)'
          }}
        >
          {/* Cursor pointer */}
          <div className="relative">
            <svg width="20" height="20" viewBox="0 0 20 20" className="drop-shadow-lg">
              <path
                d="M0 0L0 16L5.5 12.5L8.5 20L11 18.5L8 10.5L16 10.5L0 0Z"
                fill="#3B82F6"
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            
            {/* Cursor label */}
            <div className="absolute top-5 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
              {cursor.userId ? `User ${cursor.userId.slice(-4)}` : `User ${socketId?.slice(-4) || 'Unknown'}`}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Add static property for throttling
declare global {
  interface Function {
    lastSent?: number;
  }
}