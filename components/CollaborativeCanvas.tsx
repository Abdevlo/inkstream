'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { getHybridClient } from '@/lib/hybrid/hybrid-client';
import { 
  MousePointer2, 
  Pen, 
  Square, 
  Circle, 
  ArrowRight, 
  Type, 
  Plus, 
  Minus, 
  Home, 
  Sun, 
  Moon, 
  Trash2,
  Mouse,
  Search,
  GitBranch,
  Diamond,
  Hexagon
} from 'lucide-react';

interface Point {
  x: number;
  y: number;
}

interface DrawingElement {
  id: string;
  type: 'pen' | 'rectangle' | 'circle' | 'text' | 'arrow' | 'flowchart-process' | 'flowchart-decision' | 'flowchart-start' | 'flowchart-connector';
  points: Point[];
  text?: string;
  color: string;
  strokeWidth: number;
  fontFamily?: string;
  fontSize?: number;
  width?: number;
  height?: number;
  timestamp: number;
  userId?: string;
}

interface TextBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface CanvasProps {
  sessionId: string;
  userId?: string;
  isHost: boolean;
  isDarkMode: boolean;
  onToggleDarkMode: () => void;
}

interface ViewPort {
  x: number;
  y: number;
  zoom: number;
}

type Tool = 'pen' | 'rectangle' | 'circle' | 'text' | 'arrow' | 'select' | 'flowchart';

export function CollaborativeCanvas({ 
  sessionId, 
  userId, 
  isHost, 
  isDarkMode, 
  onToggleDarkMode 
}: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentTool, setCurrentTool] = useState<Tool>('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [elements, setElements] = useState<DrawingElement[]>([]);
  const [currentElement, setCurrentElement] = useState<DrawingElement | null>(null);
  const [viewport, setViewport] = useState<ViewPort>({ x: 0, y: 0, zoom: 1 });
  const [currentFont, setCurrentFont] = useState('Arial');
  const [editingText, setEditingText] = useState<{
    element: DrawingElement;
    position: Point;
    screenPosition: Point;
  } | null>(null);
  const [selectedElement, setSelectedElement] = useState<DrawingElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [showFlowchartPanel, setShowFlowchartPanel] = useState(false);
  const [selectedFlowchartShape, setSelectedFlowchartShape] = useState<string>('process');
  const hybridClient = getHybridClient();

  // Drawing state
  const startPoint = useRef<Point | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    console.log('Canvas redraw triggered - elements count:', elements.length, 'viewport:', viewport);
    drawBackground();
    redrawCanvas();
  }, [isDarkMode, elements, viewport]);

  // Focus text input when editing starts
  useEffect(() => {
    if (editingText && textInputRef.current) {
      setTimeout(() => {
        textInputRef.current?.focus();
        textInputRef.current?.select();
      }, 100);
    }
  }, [editingText]);

  // Prevent browser navigation gestures globally
  useEffect(() => {
    const preventNavigation = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      return false;
    };

    const preventTouchNavigation = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    };

    // Add global event listeners to prevent navigation
    document.addEventListener('gesturestart', preventNavigation, { passive: false });
    document.addEventListener('gesturechange', preventNavigation, { passive: false });
    document.addEventListener('gestureend', preventNavigation, { passive: false });
    document.addEventListener('touchstart', preventTouchNavigation, { passive: false });
    document.addEventListener('touchmove', preventTouchNavigation, { passive: false });
    
    // Prevent mouse back/forward buttons
    document.addEventListener('mouseup', (e) => {
      if (e.button === 3 || e.button === 4) { // Back/Forward buttons
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    });

    // Prevent keyboard shortcuts that might trigger navigation
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === '[' || e.key === ']')) {
        e.preventDefault();
        return false;
      }
    });

    return () => {
      document.removeEventListener('gesturestart', preventNavigation);
      document.removeEventListener('gesturechange', preventNavigation);
      document.removeEventListener('gestureend', preventNavigation);
      document.removeEventListener('touchstart', preventTouchNavigation);
      document.removeEventListener('touchmove', preventTouchNavigation);
    };
  }, []);

  useEffect(() => {
    console.log('CollaborativeCanvas: Setting up WebSocket listeners for session:', sessionId, 'userId:', userId, 'isHost:', isHost);
    
    // Set up connection handler
    const connectAndJoin = () => {
      console.log('WebSocket connected, joining session:', sessionId);
      hybridClient.joinSession(sessionId, userId, isHost);
      
      // Send a test event to verify connection
      setTimeout(() => {
        console.log('Sending test ping event');
        hybridClient.sendDrawingEvent({
          type: 'test-ping',
          id: `ping_${Date.now()}`,
          message: `Hello from ${isHost ? 'host' : 'viewer'} ${userId}`
        } as any, userId);
      }, 1000);
    };

    // Check if already connected
    if (hybridClient.isConnected()) {
      connectAndJoin();
    } else {
      // Wait for connection
      hybridClient.on('connect', connectAndJoin);
    }

    // Listen for drawing events from other users
    const handleDrawingEvent = (data: { event: any; userId?: string; socketId?: string }) => {
      console.log('🎨 CollaborativeCanvas received drawing event:', {
        receivedData: data,
        myUserId: userId,
        myIsHost: isHost,
        shouldProcess: data.userId !== userId,
        eventType: data.event?.type
      });
      
      // Only process events from other users (different userId or socketId)
      if (data.userId !== userId) {
        if (data.event.type === 'test-ping') {
          console.log('🎯 Received test ping from other user:', data.event.message);
          return;
        } else if (data.event.type === 'clear') {
          console.log('Clearing canvas from remote user');
          setElements([]);
        } else if (data.event.type === 'viewport-sync' && !isHost) {
          // Sync viewport for viewers
          console.log('Syncing viewport from host:', data.event.viewport);
          setViewport(data.event.viewport);
        } else {
          console.log('Adding drawing element from remote user:', data.event);
          setElements(prev => {
            const filtered = prev.filter(el => el.id !== data.event.id);
            const newElements = [...filtered, data.event];
            console.log('Updated elements array length:', newElements.length, 'New element:', data.event);
            return newElements;
          });
        }
      } else {
        console.log('Ignoring own drawing event (same userId)');
      }
    };

    hybridClient.on('drawing-event', handleDrawingEvent);

    return () => {
      hybridClient.off('drawing-event', handleDrawingEvent);
      hybridClient.off('connect', connectAndJoin);
    };
  }, [userId, sessionId]);

  const drawBackground = () => {
    const canvas = backgroundRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set background color
    ctx.fillStyle = isDarkMode ? '#1a1a1a' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Apply transformations for grid
    ctx.save();
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.zoom, viewport.zoom);

    // Draw dot grid
    const dotSize = 1 / viewport.zoom;
    const spacing = 20;
    ctx.fillStyle = isDarkMode ? '#404040' : '#e0e0e0';

    // Calculate visible area bounds
    const startX = Math.floor(-viewport.x / viewport.zoom / spacing) * spacing;
    const startY = Math.floor(-viewport.y / viewport.zoom / spacing) * spacing;
    const endX = startX + (canvas.width / viewport.zoom) + spacing * 2;
    const endY = startY + (canvas.height / viewport.zoom) + spacing * 2;

    for (let x = startX; x < endX; x += spacing) {
      for (let y = startY; y < endY; y += spacing) {
        ctx.beginPath();
        ctx.arc(x, y, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  };

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply transformations
    ctx.save();
    ctx.translate(viewport.x, viewport.y);
    ctx.scale(viewport.zoom, viewport.zoom);

    // Draw all elements
    elements.forEach(element => {
      drawElement(ctx, element);
    });

    // Draw current element if exists
    if (currentElement) {
      drawElement(ctx, currentElement);
    }

    // Draw selection highlight and handles
    if (selectedElement) {
      drawElementSelection(ctx, selectedElement);
    }

    ctx.restore();
  };

  const drawElement = (ctx: CanvasRenderingContext2D, element: DrawingElement) => {
    ctx.strokeStyle = element.color;
    ctx.lineWidth = element.strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    switch (element.type) {
      case 'pen':
        if (element.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(element.points[0].x, element.points[0].y);
          for (let i = 1; i < element.points.length; i++) {
            ctx.lineTo(element.points[i].x, element.points[i].y);
          }
          ctx.stroke();
        }
        break;

      case 'rectangle':
        if (element.points.length >= 2) {
          const start = element.points[0];
          const end = element.points[element.points.length - 1];
          const width = end.x - start.x;
          const height = end.y - start.y;
          ctx.strokeRect(start.x, start.y, width, height);
        }
        break;

      case 'circle':
        if (element.points.length >= 2) {
          const start = element.points[0];
          const end = element.points[element.points.length - 1];
          const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
          ctx.beginPath();
          ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
        break;

      case 'text':
        if (element.text && element.points.length > 0) {
          ctx.fillStyle = element.color;
          const fontSize = element.fontSize || element.strokeWidth * 8;
          const fontFamily = element.fontFamily || 'Arial';
          ctx.font = `${fontSize}px ${fontFamily}`;
          ctx.fillText(element.text, element.points[0].x, element.points[0].y);
        }
        break;

      case 'arrow':
        if (element.points.length >= 2) {
          const start = element.points[0];
          const end = element.points[element.points.length - 1];
          
          // Draw line
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();

          // Draw arrowhead
          const angle = Math.atan2(end.y - start.y, end.x - start.x);
          const arrowLength = 15;
          const arrowAngle = Math.PI / 6;

          ctx.beginPath();
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(
            end.x - arrowLength * Math.cos(angle - arrowAngle),
            end.y - arrowLength * Math.sin(angle - arrowAngle)
          );
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(
            end.x - arrowLength * Math.cos(angle + arrowAngle),
            end.y - arrowLength * Math.sin(angle + arrowAngle)
          );
          ctx.stroke();
        }
        break;

      case 'flowchart-process':
        if (element.points.length >= 2) {
          const start = element.points[0];
          const end = element.points[element.points.length - 1];
          const width = end.x - start.x;
          const height = end.y - start.y;
          const cornerRadius = 10;
          
          ctx.beginPath();
          ctx.roundRect(start.x, start.y, width, height, cornerRadius);
          ctx.stroke();
          
          // Add text if present
          if (element.text) {
            ctx.fillStyle = element.color;
            ctx.font = `${Math.min(width, height) * 0.2}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(element.text, start.x + width/2, start.y + height/2);
          }
        }
        break;

      case 'flowchart-decision':
        if (element.points.length >= 2) {
          const start = element.points[0];
          const end = element.points[element.points.length - 1];
          const centerX = (start.x + end.x) / 2;
          const centerY = (start.y + end.y) / 2;
          const width = Math.abs(end.x - start.x);
          const height = Math.abs(end.y - start.y);
          
          ctx.beginPath();
          ctx.moveTo(centerX, start.y);
          ctx.lineTo(end.x, centerY);
          ctx.lineTo(centerX, end.y);
          ctx.lineTo(start.x, centerY);
          ctx.closePath();
          ctx.stroke();
          
          // Add text if present
          if (element.text) {
            ctx.fillStyle = element.color;
            ctx.font = `${Math.min(width, height) * 0.15}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(element.text, centerX, centerY);
          }
        }
        break;

      case 'flowchart-start':
        if (element.points.length >= 2) {
          const start = element.points[0];
          const end = element.points[element.points.length - 1];
          const centerX = (start.x + end.x) / 2;
          const centerY = (start.y + end.y) / 2;
          const radiusX = Math.abs(end.x - start.x) / 2;
          const radiusY = Math.abs(end.y - start.y) / 2;
          
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
          ctx.stroke();
          
          // Add text if present
          if (element.text) {
            ctx.fillStyle = element.color;
            ctx.font = `${Math.min(radiusX, radiusY) * 0.4}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(element.text, centerX, centerY);
          }
        }
        break;

      case 'flowchart-connector':
        if (element.points.length >= 2) {
          const start = element.points[0];
          const end = element.points[element.points.length - 1];
          
          // Draw line
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();

          // Draw arrowhead
          const angle = Math.atan2(end.y - start.y, end.x - start.x);
          const arrowLength = 15;
          const arrowAngle = Math.PI / 6;

          ctx.beginPath();
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(
            end.x - arrowLength * Math.cos(angle - arrowAngle),
            end.y - arrowLength * Math.sin(angle - arrowAngle)
          );
          ctx.moveTo(end.x, end.y);
          ctx.lineTo(
            end.x - arrowLength * Math.cos(angle + arrowAngle),
            end.y - arrowLength * Math.sin(angle + arrowAngle)
          );
          ctx.stroke();
        }
        break;
    }
  };

  const drawElementSelection = (ctx: CanvasRenderingContext2D, element: DrawingElement) => {
    let bounds: TextBounds;

    // Get bounds based on element type
    if (element.type === 'text') {
      bounds = getTextBounds(element);
    } else {
      // For shapes and flowcharts, use their bounding box
      if (!element.points || element.points.length < 2) return;
      const start = element.points[0];
      const end = element.points[element.points.length - 1];
      bounds = {
        x: Math.min(start.x, end.x),
        y: Math.min(start.y, end.y),
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y)
      };
    }

    const padding = 4;

    // Draw selection box
    ctx.strokeStyle = '#007AFF';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(
      bounds.x - padding,
      bounds.y - padding,
      bounds.width + padding * 2,
      bounds.height + padding * 2
    );
    ctx.setLineDash([]);

    // Draw resize handles
    const handleSize = 8;
    const handles = [
      { x: bounds.x - padding, y: bounds.y - padding }, // top-left
      { x: bounds.x + bounds.width + padding, y: bounds.y - padding }, // top-right
      { x: bounds.x - padding, y: bounds.y + bounds.height + padding }, // bottom-left
      { x: bounds.x + bounds.width + padding, y: bounds.y + bounds.height + padding }, // bottom-right
    ];

    ctx.fillStyle = '#007AFF';
    handles.forEach(handle => {
      ctx.fillRect(
        handle.x - handleSize / 2,
        handle.y - handleSize / 2,
        handleSize,
        handleSize
      );
    });
  };

  const getMousePos = (e: React.MouseEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - viewport.x) / viewport.zoom;
    const y = (e.clientY - rect.top - viewport.y) / viewport.zoom;
    return { x, y };
  };

  const getScreenPos = (point: Point): Point => {
    return {
      x: point.x * viewport.zoom + viewport.x,
      y: point.y * viewport.zoom + viewport.y
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // If not host, disable all drawing interactions
    if (!isHost) {
      console.log('Viewer mode: drawing disabled');
      return;
    }

    const point = getMousePos(e);
    
    // If we're already editing text, don't interfere
    if (editingText) return;

    // Handle selection tool
    if (currentTool === 'select') {
      console.log('Select tool clicked at:', point);
      console.log('Available text elements:', elements.filter(el => el.type === 'text'));
      
      const textElement = findTextElementAtPoint(point);
      console.log('Found text element:', textElement);
      
      if (textElement) {
        console.log('Selecting text element:', textElement.text);
        setSelectedElement(textElement);
        setDragStart(point);
        setIsDragging(true);
        
        // Check for double-click to edit (only for text elements)
        if (e.detail === 2 && textElement.type === 'text') {
          console.log('Double-click detected, starting edit');
          startEditingExistingText(textElement, point);
        }
        return;
      } else {
        console.log('No text element found, deselecting');
        // Clicked on empty space, deselect
        setSelectedElement(null);
      }
      return;
    }
    
    startPoint.current = point;
    setIsDrawing(true);

    if (currentTool === 'text') {
      console.log('Text tool clicked at:', point);
      
      try {
        const newElement: DrawingElement = {
          id: `${Date.now()}_${userId || 'unknown'}`,
          type: 'text',
          points: [point],
          text: '',
          color: currentColor,
          strokeWidth,
          fontFamily: currentFont,
          fontSize: strokeWidth * 8,
          timestamp: Date.now(),
          userId
        };
        
        const canvas = canvasRef.current;
        if (!canvas) {
          console.error('Canvas ref not found');
          return;
        }
        
        const rect = canvas.getBoundingClientRect();
        const screenPosition = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        
        console.log('Setting editingText with screenPosition:', screenPosition);
        setEditingText({
          element: newElement,
          position: point,
          screenPosition
        });
        
        // No more fallback timer - let the user interact with the UI
        
      } catch (error) {
        console.error('Error in text tool:', error);
        // Ultimate fallback
        const text = prompt('Enter text:');
        if (text) {
          const newElement: DrawingElement = {
            id: `${Date.now()}_${userId || 'unknown'}`,
            type: 'text',
            points: [point],
            text,
            color: currentColor,
            strokeWidth,
            fontFamily: currentFont,
            fontSize: strokeWidth * 8,
            timestamp: Date.now(),
            userId
          };
          setElements(prev => [...prev, newElement]);
          broadcastDrawingEvent(newElement);
        }
      }
      return;
    }

    if (currentTool === 'flowchart') {
      const flowchartType = `flowchart-${selectedFlowchartShape}` as any;
      const newElement: DrawingElement = {
        id: `${Date.now()}_${userId || 'unknown'}`,
        type: flowchartType,
        points: [point],
        color: currentColor,
        strokeWidth,
        timestamp: Date.now(),
        userId
      };
      setCurrentElement(newElement);
      return;
    }

    const newElement: DrawingElement = {
      id: `${Date.now()}_${userId || 'unknown'}`,
      type: currentTool,
      points: [point],
      color: currentColor,
      strokeWidth,
      timestamp: Date.now(),
      userId
    };

    setCurrentElement(newElement);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const point = getMousePos(e);

    // Handle dragging selected text
    if (isDragging && selectedElement && dragStart) {
      const deltaX = point.x - dragStart.x;
      const deltaY = point.y - dragStart.y;

      const updatedElement = {
        ...selectedElement,
        points: [{
          x: selectedElement.points[0].x + deltaX,
          y: selectedElement.points[0].y + deltaY
        }]
      };

      setElements(prev => prev.map(el => 
        el.id === selectedElement.id ? updatedElement : el
      ));
      setSelectedElement(updatedElement);
      setDragStart(point);
      redrawCanvas();
      return;
    }

    // Handle normal drawing
    if (!isDrawing || !currentElement || currentTool === 'select' || currentTool === 'text') return;

    if (currentTool === 'pen') {
      setCurrentElement(prev => prev ? {
        ...prev,
        points: [...prev.points, point]
      } : null);
    } else {
      // For shapes and flowcharts, only keep start and current point
      setCurrentElement(prev => prev ? {
        ...prev,
        points: [prev.points[0], point]
      } : null);
    }

    redrawCanvas();
  };

  const handleMouseUp = () => {
    // Handle end of text dragging
    if (isDragging && selectedElement) {
      setIsDragging(false);
      setDragStart(null);
      broadcastDrawingEvent(selectedElement);
      return;
    }

    // Handle normal drawing
    if (!isDrawing || !currentElement) return;

    setIsDrawing(false);
    setElements(prev => [...prev, currentElement]);
    broadcastDrawingEvent(currentElement);
    setCurrentElement(null);
  };

  const broadcastDrawingEvent = (element: DrawingElement) => {
    console.log('Broadcasting drawing event:', {
      type: element.type,
      id: element.id,
      userId,
      sessionId,
      isHost,
      wsConnected: hybridClient.isConnected(),
      element
    });
    
    try {
      hybridClient.sendDrawingEvent(element, userId);
      console.log('Drawing event sent successfully');
    } catch (error) {
      console.error('Failed to send drawing event:', error);
    }
  };

  const clearCanvas = () => {
    if (!isHost) return; // Only host can clear canvas
    setElements([]);
    const clearEvent: DrawingElement = {
      id: `clear_${Date.now()}`,
      type: 'pen',
      points: [],
      color: '',
      strokeWidth: 0,
      timestamp: Date.now(),
      userId
    };
    hybridClient.sendDrawingEvent({ ...clearEvent, type: 'clear' as any }, userId);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Disable panning/zooming for viewers
    if (!isHost) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (e.shiftKey) {
      // Zoom with Shift + scroll
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05;
      const newZoom = Math.max(0.6, Math.min(1.2, viewport.zoom * zoomFactor));

      // Zoom towards mouse position
      const newX = mouseX - (mouseX - viewport.x) * (newZoom / viewport.zoom);
      const newY = mouseY - (mouseY - viewport.y) * (newZoom / viewport.zoom);

      const newViewport = { x: newX, y: newY, zoom: newZoom };
      setViewport(newViewport);
      
      // Broadcast viewport changes to viewers
      if (isHost) {
        hybridClient.sendDrawingEvent({
          type: 'viewport-sync',
          viewport: newViewport
        } as any, userId);
      }
    } else {
      // Pan with normal scroll
      const newViewport = {
        x: viewport.x - e.deltaX,
        y: viewport.y - e.deltaY,
        zoom: viewport.zoom
      };
      setViewport(newViewport);
      
      // Broadcast viewport changes to viewers
      if (isHost) {
        hybridClient.sendDrawingEvent({
          type: 'viewport-sync',
          viewport: newViewport
        } as any, userId);
      }
    }
  };

  const resetView = () => {
    if (!isHost) return; // Viewers can't reset view
    const newViewport = { x: 0, y: 0, zoom: 1 };
    setViewport(newViewport);
    
    // Broadcast viewport reset to viewers
    hybridClient.sendDrawingEvent({
      type: 'viewport-sync',
      viewport: newViewport
    } as any, userId);
  };

  const zoomIn = () => {
    if (!isHost) return; // Viewers can't zoom
    setViewport(prev => {
      const newViewport = { ...prev, zoom: Math.min(1.2, prev.zoom * 1.1) };
      
      // Broadcast zoom to viewers
      hybridClient.sendDrawingEvent({
        type: 'viewport-sync',
        viewport: newViewport
      } as any, userId);
      
      return newViewport;
    });
  };

  const zoomOut = () => {
    if (!isHost) return; // Viewers can't zoom
    setViewport(prev => {
      const newViewport = { ...prev, zoom: Math.max(0.6, prev.zoom / 1.1) };
      
      // Broadcast zoom to viewers
      hybridClient.sendDrawingEvent({
        type: 'viewport-sync',
        viewport: newViewport
      } as any, userId);
      
      return newViewport;
    });
  };

  const handleTextSubmit = (text: string) => {
    if (!editingText) return;
    
    if (text.trim()) {
      const finalElement = {
        ...editingText.element,
        text: text.trim()
      };
      setElements(prev => [...prev, finalElement]);
      broadcastDrawingEvent(finalElement);
    }
    
    setEditingText(null);
  };

  const handleTextCancel = () => {
    setEditingText(null);
  };

  const getTextBounds = (element: DrawingElement): TextBounds => {
    if (element.type !== 'text' || !element.text) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }

    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, width: 0, height: 0 };

    const ctx = canvas.getContext('2d');
    if (!ctx) return { x: 0, y: 0, width: 0, height: 0 };

    const fontSize = element.fontSize || element.strokeWidth * 8;
    const fontFamily = element.fontFamily || 'Arial';
    ctx.font = `${fontSize}px ${fontFamily}`;

    const metrics = ctx.measureText(element.text);
    const width = metrics.width;
    const height = fontSize;

    // Text is drawn from baseline, so adjust bounds to include the full height
    return {
      x: element.points[0].x,
      y: element.points[0].y - height * 0.8, // Approximate text top
      width,
      height
    };
  };

  const isPointInTextBounds = (point: Point, element: DrawingElement): boolean => {
    if (element.type !== 'text') return false;
    
    const bounds = getTextBounds(element);
    const isInside = (
      point.x >= bounds.x &&
      point.x <= bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y <= bounds.y + bounds.height
    );
    
    console.log('Checking point in text bounds:', {
      point,
      bounds,
      text: element.text,
      isInside
    });
    
    return isInside;
  };

  const findTextElementAtPoint = (point: Point): DrawingElement | null => {
    // Search in reverse order to get the topmost element
    for (let i = elements.length - 1; i >= 0; i--) {
      const element = elements[i];
      
      // Check for text elements
      if (element.type === 'text' && isPointInTextBounds(point, element)) {
        return element;
      }
      
      // Also check flowchart shapes (they can be selected and moved)
      if (element.type.startsWith('flowchart-') && isPointInFlowchartBounds(point, element)) {
        return element;
      }
      
      // Check other shapes too
      if ((element.type === 'rectangle' || element.type === 'circle') && isPointInShapeBounds(point, element)) {
        return element;
      }
    }
    return null;
  };

  const isPointInFlowchartBounds = (point: Point, element: DrawingElement): boolean => {
    if (!element.points || element.points.length < 2) return false;
    
    const start = element.points[0];
    const end = element.points[element.points.length - 1];
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    
    return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
  };

  const isPointInShapeBounds = (point: Point, element: DrawingElement): boolean => {
    if (!element.points || element.points.length < 2) return false;
    
    const start = element.points[0];
    const end = element.points[element.points.length - 1];
    const minX = Math.min(start.x, end.x);
    const maxX = Math.max(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxY = Math.max(start.y, end.y);
    
    return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
  };

  const startEditingExistingText = (element: DrawingElement, _clickPoint: Point) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const screenPosition = getScreenPos(element.points[0]);

    setEditingText({
      element: { ...element },
      position: element.points[0],
      screenPosition: {
        x: screenPosition.x,
        y: screenPosition.y
      }
    });

    // Remove the element from the canvas while editing
    setElements(prev => prev.filter(el => el.id !== element.id));
    setSelectedElement(null);
  };

  const tools = [
    { id: 'select', name: 'Select', icon: MousePointer2 },
    { id: 'pen', name: 'Pen', icon: Pen },
    { id: 'rectangle', name: 'Rectangle', icon: Square },
    { id: 'circle', name: 'Circle', icon: Circle },
    { id: 'arrow', name: 'Arrow', icon: ArrowRight },
    { id: 'text', name: 'Text', icon: Type },
    { id: 'flowchart', name: 'Flowchart', icon: GitBranch },
  ];

  const flowchartShapes = [
    { id: 'process', name: 'Process', icon: Square, description: 'Rectangular process box' },
    { id: 'decision', name: 'Decision', icon: Diamond, description: 'Diamond decision point' },
    { id: 'start', name: 'Start/End', icon: Circle, description: 'Oval start/end' },
    { id: 'connector', name: 'Connector', icon: ArrowRight, description: 'Arrow connector' },
  ];

  const colors = [
    '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff',
    '#ffff00', '#ff00ff', '#00ffff', '#ffa500', '#800080'
  ];

  const fonts = [
    'Arial',
    'Annie Use Your Telescope',
    'Bricolage Grotesque',
    'Caveat',
    'Crafty Girls',
    'Englebert'
  ];

  return (
    <div 
      className="relative w-full h-full"
      style={{
        touchAction: 'none',
        userSelect: 'none',
        overscrollBehavior: 'none'
      }}
      onTouchStart={(e) => e.preventDefault()}
      onTouchMove={(e) => e.preventDefault()}
    >
      {/* Canvas Container - Full Screen */}
      <div 
        className="absolute inset-0 overflow-hidden"
        style={{
          touchAction: 'none',
          overscrollBehavior: 'none'
        }}
      >
        {/* Background Canvas (dots) */}
        <canvas
          ref={backgroundRef}
          className="absolute inset-0 w-full h-full"
          style={{ zIndex: 1 }}
        />
        
        {/* Drawing Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          style={{ 
            zIndex: 2,
            touchAction: 'none'  // Disable browser touch gestures
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onTouchStart={(e) => e.preventDefault()}
          onTouchMove={(e) => e.preventDefault()}
          onTouchEnd={(e) => e.preventDefault()}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {/* Floating Top Toolbar */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
        {/* Viewer Mode Indicator */}
        {!isHost && (
          <div className="mb-2 px-3 py-1 bg-blue-500 text-white text-xs rounded-full text-center">
            👁️ Viewer Mode - Watch Only
          </div>
        )}
        
        <div className={`flex items-center gap-1 p-2 rounded-2xl shadow-lg backdrop-blur-md border ${
          isDarkMode 
            ? 'bg-gray-900/80 border-gray-700' 
            : 'bg-white/80 border-gray-200'
        } ${!isHost ? 'opacity-50 pointer-events-none' : ''}`}>
          {/* Tools */}
          {tools.map((tool) => {
            const IconComponent = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => setCurrentTool(tool.id as Tool)}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 ${
                  currentTool === tool.id
                    ? 'bg-blue-500 text-white shadow-md scale-105'
                    : isDarkMode
                    ? 'text-gray-300 hover:bg-gray-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                title={tool.name}
              >
                <IconComponent size={18} />
              </button>
            );
          })}
          
          <div className={`w-px h-8 mx-2 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`} />
          
          {/* Colors */}
          {colors.slice(0, 6).map((color) => (
            <button
              key={color}
              onClick={() => setCurrentColor(color)}
              className={`w-8 h-8 rounded-lg border-2 transition-all duration-200 ${
                currentColor === color 
                  ? 'border-blue-400 scale-110 shadow-md' 
                  : 'border-transparent hover:scale-105'
              }`}
              style={{ backgroundColor: color }}
              title={color}
            />
          ))}
          
          <div className={`w-px h-8 mx-2 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`} />
          
          {/* Font Selector (only show when text tool is selected) */}
          {currentTool === 'text' && (
            <>
              <select
                value={currentFont}
                onChange={(e) => setCurrentFont(e.target.value)}
                className={`px-2 py-1 rounded-lg text-xs font-medium border ${
                  isDarkMode
                    ? 'bg-gray-800 border-gray-600 text-gray-300'
                    : 'bg-white border-gray-300 text-gray-700'
                }`}
                style={{ fontFamily: currentFont }}
              >
                {fonts.map((font) => (
                  <option key={font} value={font} style={{ fontFamily: font }}>
                    {font}
                  </option>
                ))}
              </select>
              <div className={`w-px h-8 mx-2 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`} />
            </>
          )}

          {/* Flowchart Shape Selector (only show when flowchart tool is selected) */}
          {currentTool === 'flowchart' && (
            <>
              <div className="flex items-center gap-1">
                {flowchartShapes.map((shape) => {
                  const IconComponent = shape.icon;
                  return (
                    <button
                      key={shape.id}
                      onClick={() => setSelectedFlowchartShape(shape.id)}
                      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 ${
                        selectedFlowchartShape === shape.id
                          ? 'bg-blue-500 text-white shadow-md scale-105'
                          : isDarkMode
                          ? 'text-gray-300 hover:bg-gray-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      title={shape.description}
                    >
                      <IconComponent size={14} />
                    </button>
                  );
                })}
              </div>
              <div className={`w-px h-8 mx-2 ${isDarkMode ? 'bg-gray-600' : 'bg-gray-300'}`} />
            </>
          )}
          
          {/* Stroke Width */}
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="1"
              max="20"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
              className="w-16 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className={`text-xs font-medium min-w-[20px] text-center ${
              isDarkMode ? 'text-gray-300' : 'text-gray-700'
            }`}>
              {strokeWidth}
            </span>
          </div>
        </div>
      </div>

        {/* Navigation Hint */}
        <div className={`p-2 rounded-xl shadow-lg backdrop-blur-md border text-xs ${
          isDarkMode 
            ? 'bg-gray-900/80 border-gray-700 text-gray-300' 
            : 'bg-white/80 border-gray-200 text-gray-600'
        }`}>
          <div className="flex items-center gap-1">
            <Mouse size={12} />
            <span>Scroll to pan</span>
          </div>
          <div>⇧ + scroll to zoom</div>
        </div>

      {/* Floating Right Controls */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
      
        
        {/* Zoom Controls */}
        <div className={`flex flex-col p-1 rounded-xl shadow-lg backdrop-blur-md border ${
          isDarkMode 
            ? 'bg-gray-900/80 border-gray-700' 
            : 'bg-white/80 border-gray-200'
        } ${!isHost ? 'opacity-50' : ''}`}>
          <button
            onClick={zoomIn}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              isDarkMode
                ? 'text-gray-300 hover:bg-gray-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            title="Zoom In"
          >
            <Plus size={18} />
          </button>
          <div className={`text-xs text-center py-1 ${
            isDarkMode ? 'text-gray-400' : 'text-gray-600'
          }`}>
            {Math.round(viewport.zoom * 100)}%
          </div>
          <button
            onClick={zoomOut}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              isDarkMode
                ? 'text-gray-300 hover:bg-gray-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            title="Zoom Out"
          >
            <Minus size={18} />
          </button>
          <button
            onClick={resetView}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              isDarkMode
                ? 'text-gray-300 hover:bg-gray-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            title="Reset View"
          >
            <Home size={16} />
          </button>
        </div>

        {/* Other Controls - Only show for host */}
        {isHost && (
          <div className={`flex flex-col p-1 rounded-xl shadow-lg backdrop-blur-md border ${
            isDarkMode 
              ? 'bg-gray-900/80 border-gray-700' 
              : 'bg-white/80 border-gray-200'
          }`}>
          <button
            onClick={onToggleDarkMode}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              isDarkMode
                ? 'text-gray-300 hover:bg-gray-700'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
          >
            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button
            onClick={clearCanvas}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              isDarkMode
                ? 'text-red-400 hover:bg-red-900/30'
                : 'text-red-600 hover:bg-red-100'
            }`}
            title="Clear Canvas"
          >
            <Trash2 size={16} />
          </button>
          </div>
        )}
      </div>

      {/* Inline Text Editor */}
      {editingText && (
        <div
          className="absolute z-50 pointer-events-auto"
          style={{
            left: editingText.screenPosition.x,
            top: editingText.screenPosition.y - 80,
            transform: 'translateX(-50%)'
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-3 rounded-lg shadow-xl bg-white border-2 border-blue-500">
            <input
              ref={textInputRef}
              type="text"
              autoFocus
              defaultValue={editingText.element.text || ''}
              placeholder="Type your text..."
              key={editingText.element.id} // Force re-render with new default value
              className="px-3 py-2 border border-gray-300 rounded-lg text-gray-800 text-sm focus:outline-none focus:border-blue-500"
              style={{
                fontFamily: editingText.element.fontFamily || 'Arial',
                fontSize: '14px',
                minWidth: '200px'
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleTextSubmit((e.target as HTMLInputElement).value);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  handleTextCancel();
                }
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onFocus={(e) => {
                console.log('Text input focused');
                e.stopPropagation();
              }}
              onBlur={(e) => {
                console.log('Text input blurred');
                e.stopPropagation();
              }}
            />
            <div className="text-xs mt-1 text-gray-500">
              Press Enter to confirm, Esc to cancel
            </div>
          </div>
        </div>
      )}

      {/* Debug indicator */}
      {editingText && (
        <div className="absolute top-20 left-20 z-50 bg-red-500 text-white p-2 rounded">
          Text editor active
        </div>
      )}

      {/* Google Fonts CSS */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @import url('https://fonts.googleapis.com/css2?family=Annie+Use+Your+Telescope&family=Bricolage+Grotesque:opsz,wght@12..96,200..800&family=Caveat:wght@400..700&family=Crafty+Girls&family=Englebert&display=swap');
        `
      }} />
    </div>
  );
}