'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Move, RotateCcw } from 'lucide-react';

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface ResizableCardProps {
  id: string;
  title: string;
  children: React.ReactNode;
  initialPosition?: Position;
  initialSize?: Size;
  onClose?: () => void;
  onPositionChange?: (position: Position) => void;
  onSizeChange?: (size: Size) => void;
  isDarkMode?: boolean;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export function ResizableCard({
  id,
  title,
  children,
  initialPosition = { x: 100, y: 100 },
  initialSize = { width: 300, height: 200 },
  onClose,
  onPositionChange,
  onSizeChange,
  isDarkMode = false,
  minWidth = 200,
  minHeight = 150,
  maxWidth = 800,
  maxHeight = 600
}: ResizableCardProps) {
  const [position, setPosition] = useState<Position>(initialPosition);
  const [size, setSize] = useState<Size>(initialSize);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string>('');
  const [dragStart, setDragStart] = useState<Position>({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState<{ pos: Position; size: Size }>({
    pos: { x: 0, y: 0 },
    size: { width: 0, height: 0 }
  });

  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newPosition = {
          x: position.x + (e.clientX - dragStart.x),
          y: position.y + (e.clientY - dragStart.y)
        };
        setPosition(newPosition);
        onPositionChange?.(newPosition);
        setDragStart({ x: e.clientX, y: e.clientY });
      }

      if (isResizing) {
        const deltaX = e.clientX - resizeStart.pos.x;
        const deltaY = e.clientY - resizeStart.pos.y;
        let newSize = { ...resizeStart.size };

        switch (resizeHandle) {
          case 'se': // Bottom-right
            newSize.width = Math.min(maxWidth, Math.max(minWidth, resizeStart.size.width + deltaX));
            newSize.height = Math.min(maxHeight, Math.max(minHeight, resizeStart.size.height + deltaY));
            break;
          case 'sw': // Bottom-left
            newSize.width = Math.min(maxWidth, Math.max(minWidth, resizeStart.size.width - deltaX));
            newSize.height = Math.min(maxHeight, Math.max(minHeight, resizeStart.size.height + deltaY));
            if (newSize.width !== resizeStart.size.width) {
              setPosition(prev => ({ ...prev, x: position.x + (resizeStart.size.width - newSize.width) }));
            }
            break;
          case 'ne': // Top-right
            newSize.width = Math.min(maxWidth, Math.max(minWidth, resizeStart.size.width + deltaX));
            newSize.height = Math.min(maxHeight, Math.max(minHeight, resizeStart.size.height - deltaY));
            if (newSize.height !== resizeStart.size.height) {
              setPosition(prev => ({ ...prev, y: position.y + (resizeStart.size.height - newSize.height) }));
            }
            break;
          case 'nw': // Top-left
            newSize.width = Math.min(maxWidth, Math.max(minWidth, resizeStart.size.width - deltaX));
            newSize.height = Math.min(maxHeight, Math.max(minHeight, resizeStart.size.height - deltaY));
            setPosition(prev => ({
              x: position.x + (resizeStart.size.width - newSize.width),
              y: position.y + (resizeStart.size.height - newSize.height)
            }));
            break;
          case 'n': // Top
            newSize.height = Math.min(maxHeight, Math.max(minHeight, resizeStart.size.height - deltaY));
            if (newSize.height !== resizeStart.size.height) {
              setPosition(prev => ({ ...prev, y: position.y + (resizeStart.size.height - newSize.height) }));
            }
            break;
          case 's': // Bottom
            newSize.height = Math.min(maxHeight, Math.max(minHeight, resizeStart.size.height + deltaY));
            break;
          case 'w': // Left
            newSize.width = Math.min(maxWidth, Math.max(minWidth, resizeStart.size.width - deltaX));
            if (newSize.width !== resizeStart.size.width) {
              setPosition(prev => ({ ...prev, x: position.x + (resizeStart.size.width - newSize.width) }));
            }
            break;
          case 'e': // Right
            newSize.width = Math.min(maxWidth, Math.max(minWidth, resizeStart.size.width + deltaX));
            break;
        }

        setSize(newSize);
        onSizeChange?.(newSize);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle('');
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, resizeStart, position, size, resizeHandle, onPositionChange, onSizeChange, minWidth, minHeight, maxWidth, maxHeight]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('drag-handle')) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  };

  const handleResizeStart = (handle: string) => (e: React.MouseEvent) => {
    setIsResizing(true);
    setResizeHandle(handle);
    setResizeStart({
      pos: { x: e.clientX, y: e.clientY },
      size: { ...size }
    });
    e.preventDefault();
    e.stopPropagation();
  };

  const resetSize = () => {
    const newSize = { width: 300, height: 200 };
    setSize(newSize);
    onSizeChange?.(newSize);
  };

  return (
    <div
      ref={cardRef}
      className={`absolute select-none shadow-2xl rounded-lg border backdrop-blur-md z-10 flex flex-col ${
        isDarkMode 
          ? 'bg-gray-900/95 border-gray-700' 
          : 'bg-white/95 border-gray-200'
      } ${isDragging ? 'cursor-grabbing' : 'cursor-default'}`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
      }}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between p-3 border-b cursor-grab drag-handle ${
          isDarkMode 
            ? 'border-gray-700 bg-gray-800/50' 
            : 'border-gray-200 bg-gray-50/50'
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <Move size={16} className={isDarkMode ? 'text-gray-400' : 'text-gray-500'} />
          <h3 className={`text-sm font-medium ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={resetSize}
            className={`p-1 rounded transition-colors ${
              isDarkMode 
                ? 'text-gray-400 hover:bg-gray-700 hover:text-white' 
                : 'text-gray-500 hover:bg-gray-200 hover:text-gray-700'
            }`}
            title="Reset Size"
          >
            <RotateCcw size={14} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className={`p-1 rounded transition-colors ${
                isDarkMode 
                  ? 'text-gray-400 hover:bg-red-900/30 hover:text-red-400' 
                  : 'text-gray-500 hover:bg-red-100 hover:text-red-600'
              }`}
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-3 overflow-hidden">
        <div className="w-full h-full overflow-auto">
          {children}
        </div>
      </div>

      {/* Resize Handles - Larger hit areas */}
      <div
        className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize"
        onMouseDown={handleResizeStart('nw')}
        style={{ background: 'transparent' }}
      />
      <div
        className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize"
        onMouseDown={handleResizeStart('ne')}
        style={{ background: 'transparent' }}
      />
      <div
        className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize"
        onMouseDown={handleResizeStart('sw')}
        style={{ background: 'transparent' }}
      />
      <div
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        onMouseDown={handleResizeStart('se')}
        style={{ background: 'transparent' }}
      />

      {/* Edge resize handles */}
      <div
        className="absolute top-0 left-4 right-4 h-2 cursor-n-resize"
        onMouseDown={handleResizeStart('n')}
        style={{ background: 'transparent' }}
      />
      <div
        className="absolute bottom-0 left-4 right-4 h-2 cursor-s-resize"
        onMouseDown={handleResizeStart('s')}
        style={{ background: 'transparent' }}
      />
      <div
        className="absolute left-0 top-4 bottom-4 w-2 cursor-w-resize"
        onMouseDown={handleResizeStart('w')}
        style={{ background: 'transparent' }}
      />
      <div
        className="absolute right-0 top-4 bottom-4 w-2 cursor-e-resize"
        onMouseDown={handleResizeStart('e')}
        style={{ background: 'transparent' }}
      />

      {/* Visual resize indicators */}
      <div className={`absolute bottom-0 right-0 w-3 h-3 ${
        isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
      }`} style={{ 
        clipPath: 'polygon(100% 0%, 0% 100%, 100% 100%)',
        pointerEvents: 'none'
      }} />
    </div>
  );
}