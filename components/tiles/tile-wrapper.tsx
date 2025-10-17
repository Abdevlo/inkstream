'use client';

import { useState, useRef, useCallback } from 'react';

interface TileWrapperProps {
  id: string;
  title: string;
  initialX?: number;
  initialY?: number;
  initialWidth?: number;
  initialHeight?: number;
  children: React.ReactNode;
  onClose?: () => void;
  onPositionChange?: (x: number, y: number) => void;
  onSizeChange?: (width: number, height: number) => void;
  isResizable?: boolean;
}

export function TileWrapper({
  id,
  title,
  initialX = 100,
  initialY = 100,
  initialWidth = 400,
  initialHeight = 300,
  children,
  onClose,
  onPositionChange,
  onSizeChange,
  isResizable = true,
}: TileWrapperProps) {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const tileRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!tileRef.current) return;
    
    e.preventDefault();
    setIsDragging(true);
    
    const rect = tileRef.current.getBoundingClientRect();
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragRef.current) return;
      
      const deltaX = moveEvent.clientX - dragRef.current.startX;
      const deltaY = moveEvent.clientY - dragRef.current.startY;
      
      const newX = Math.max(0, dragRef.current.startPosX + deltaX);
      const newY = Math.max(0, dragRef.current.startPosY + deltaY);
      
      setPosition({ x: newX, y: newY });
      onPositionChange?.(newX, newY);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [position, onPositionChange]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (!isResizable) return;
    e.preventDefault();
    e.stopPropagation(); // Prevent triggering drag
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = size.width;
    const startHeight = size.height;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(300, startWidth + (moveEvent.clientX - startX));
      const newHeight = Math.max(200, startHeight + (moveEvent.clientY - startY));
      setSize({ width: newWidth, height: newHeight });
      onSizeChange?.(newWidth, newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [size, isResizable, onSizeChange]);

  return (
    <div
      ref={tileRef}
      className="absolute bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden"
      style={{
        width: size.width,
        height: size.height,
        left: position.x,
        top: position.y,
        zIndex: isResizing || isDragging ? 1000 : 10,
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
      {/* Header */}
      <div 
        className="tile-header bg-gray-100 px-4 py-2 flex items-center justify-between cursor-move border-b border-gray-200 select-none"
        onMouseDown={handleDragStart}
      >
        <h3 className="font-semibold text-gray-800">{title}</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 focus:outline-none"
            onMouseDown={(e) => e.stopPropagation()} // Prevent drag when clicking close
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="h-[calc(100%-40px)] overflow-auto">
        {children}
      </div>

      {/* Resize Handle */}
      {isResizable && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={handleResizeStart}
        >
          <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 16 16">
            <path d="M14 14V8h-2v6H8v2h6zM8 0v2h4v4h2V0H8z" />
          </svg>
        </div>
      )}
    </div>
  );
}
