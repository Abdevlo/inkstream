'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface BentoWidget {
  id: string;
  component: React.ReactNode;
  gridSize: 'small' | 'medium' | 'large' | 'wide' | 'tall';
}

interface BentoGridProps {
  widgets: BentoWidget[];
  onWidgetMove?: (fromIndex: number, toIndex: number) => void;
}

const GRID_SIZES = {
  small: 'col-span-1 row-span-1',
  medium: 'col-span-2 row-span-1', 
  large: 'col-span-2 row-span-2',
  wide: 'col-span-3 row-span-1',
  tall: 'col-span-1 row-span-2'
};

export function BentoGrid({ widgets, onWidgetMove }: BentoGridProps) {
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((widgetId: string, e: React.DragEvent) => {
    setDraggedWidget(widgetId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', widgetId);
    
    // Create a custom drag image
    if (e.currentTarget instanceof HTMLElement) {
      const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
      dragImage.style.transform = 'rotate(2deg)';
      dragImage.style.opacity = '0.8';
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 50, 50);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedWidget(null);
    setDragOverIndex(null);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverIndex(index);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if we're leaving the grid entirely
    if (!gridRef.current?.contains(e.relatedTarget as Node)) {
      setDragOverIndex(null);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const draggedWidgetId = e.dataTransfer.getData('text/plain');
    
    if (draggedWidget && onWidgetMove) {
      const draggedIndex = widgets.findIndex(w => w.id === draggedWidgetId);
      if (draggedIndex !== -1 && draggedIndex !== dropIndex) {
        onWidgetMove(draggedIndex, dropIndex);
      }
    }
    
    setDraggedWidget(null);
    setDragOverIndex(null);
  }, [draggedWidget, widgets, onWidgetMove]);

  return (
    <div 
      ref={gridRef}
      className="grid grid-cols-4 gap-4 auto-rows-min p-4 min-h-screen"
      style={{ gridAutoRows: 'minmax(200px, auto)' }}
    >
      <AnimatePresence>
        {widgets.map((widget, index) => {
          const isDragging = draggedWidget === widget.id;
          const isDropZone = dragOverIndex === index;
          
          return (
            <motion.div
              key={widget.id}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: isDragging ? 0.5 : 1, 
                scale: isDragging ? 1.05 : 1,
                rotateZ: isDragging ? 2 : 0
              }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ 
                layout: { duration: 0.3, ease: "easeInOut" },
                opacity: { duration: 0.2 },
                scale: { duration: 0.2 },
                rotateZ: { duration: 0.2 }
              }}
              className={`
                ${GRID_SIZES[widget.gridSize]}
                relative cursor-move select-none
                ${isDragging ? 'z-50' : 'z-10'}
                ${isDropZone && !isDragging ? 'ring-2 ring-[#ffde5a] ring-opacity-60' : ''}
              `}
            >
              {/* Drop zone indicator */}
              {isDropZone && !isDragging && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-[#ffde5a]/10 border-2 border-dashed border-[#ffde5a] rounded-lg z-0 pointer-events-none"
                />
              )}
              
              {/* Widget content */}
              <div
                className="relative z-10 h-full"
                draggable
                onDragStart={(e: React.DragEvent<HTMLDivElement>) => handleDragStart(widget.id, e)}
                onDragEnd={(e: React.DragEvent<HTMLDivElement>) => { handleDragEnd(); }}
                onDragOver={(e: React.DragEvent<HTMLDivElement>) => handleDragOver(e, index)}
                onDragLeave={(e: React.DragEvent<HTMLDivElement>) => handleDragLeave(e)}
                onDrop={(e: React.DragEvent<HTMLDivElement>) => handleDrop(e, index)}
              >
                {widget.component}
              </div>
              
              {/* Drag handle indicator */}
              <div className="absolute top-2 right-2 opacity-30 hover:opacity-60 transition-opacity pointer-events-none">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M8 6.5C8 7.32843 7.32843 8 6.5 8C5.67157 8 5 7.32843 5 6.5C5 5.67157 5.67157 5 6.5 5C7.32843 5 8 5.67157 8 6.5Z" fill="#ffde5a"/>
                  <path d="M8 12C8 12.8284 7.32843 13.5 6.5 13.5C5.67157 13.5 5 12.8284 5 12C5 11.1716 5.67157 10.5 6.5 10.5C7.32843 10.5 8 11.1716 8 12Z" fill="#ffde5a"/>
                  <path d="M8 17.5C8 18.3284 7.32843 19 6.5 19C5.67157 19 5 18.3284 5 17.5C5 16.6716 5.67157 16 6.5 16C7.32843 16 8 16.6716 8 17.5Z" fill="#ffde5a"/>
                  <path d="M13.5 6.5C13.5 7.32843 12.8284 8 12 8C11.1716 8 10.5 7.32843 10.5 6.5C10.5 5.67157 11.1716 5 12 5C12.8284 5 13.5 5.67157 13.5 6.5Z" fill="#ffde5a"/>
                  <path d="M13.5 12C13.5 12.8284 12.8284 13.5 12 13.5C11.1716 13.5 10.5 12.8284 10.5 12C10.5 11.1716 11.1716 10.5 12 10.5C12.8284 10.5 13.5 11.1716 13.5 12Z" fill="#ffde5a"/>
                  <path d="M13.5 17.5C13.5 18.3284 12.8284 19 12 19C11.1716 19 10.5 18.3284 10.5 17.5C10.5 16.6716 11.1716 16 12 16C12.8284 16 13.5 16.6716 13.5 17.5Z" fill="#ffde5a"/>
                  <path d="M19 6.5C19 7.32843 18.3284 8 17.5 8C16.6716 8 16 7.32843 16 6.5C16 5.67157 16.6716 5 17.5 5C18.3284 5 19 5.67157 19 6.5Z" fill="#ffde5a"/>
                  <path d="M19 12C19 12.8284 18.3284 13.5 17.5 13.5C16.6716 13.5 16 12.8284 16 12C16 11.1716 16.6716 10.5 17.5 10.5C18.3284 10.5 19 11.1716 19 12Z" fill="#ffde5a"/>
                  <path d="M19 17.5C19 18.3284 18.3284 19 17.5 19C16.6716 19 16 18.3284 16 17.5C16 16.6716 16.6716 16 17.5 16C18.3284 16 19 16.6716 19 17.5Z" fill="#ffde5a"/>
                </svg>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}