import { io, Socket } from 'socket.io-client';

export interface SocketMessage {
  sessionId: string;
  timestamp: number;
  socketId?: string;
}

export interface StateUpdateMessage extends SocketMessage {
  state: any;
}

export interface CursorMessage extends SocketMessage {
  x: number;
  y: number;
  userId?: string;
}

export interface DrawingMessage extends SocketMessage {
  event: any;
  userId?: string;
}

export interface ChatMessage extends SocketMessage {
  id: string;
  message: string;
  userId?: string;
  userName?: string;
}

export interface ReactionMessage extends SocketMessage {
  id: string;
  reaction: string;
  x?: number;
  y?: number;
  userId?: string;
}

export interface WebRTCSignalMessage {
  signal: any;
  from: string;
  to?: string;
  type: 'offer' | 'answer' | 'ice-candidate';
}

export class SocketClient {
  private socket: Socket | null = null;
  private currentSessionId: string | null = null;
  private messageHandlers: Map<string, Set<(data: any) => void>> = new Map();

  constructor() {
    // Disabled - using WebSocket client instead
    console.log('Socket.IO client disabled - using WebSocket client');
  }

  private connect(): void {
    console.log('Attempting to connect to socket server...');
    // Use window.location to get the current port for development
    const socketUrl = typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.host}` : undefined;
    
    this.socket = io(socketUrl, {
      path: '/api/socket',
      transports: ['polling', 'websocket'], // Try polling first for Next.js dev
      upgrade: true,
      timeout: 20000,
      forceNew: true,
    });
    
    console.log('Socket.IO connecting to:', socketUrl);

    this.socket.on('connect', () => {
      console.log('Socket.IO connected successfully:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Socket.IO disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      // Filter out expected websocket errors in development
      const errAny = error as any;
      if (errAny?.type === 'TransportError' && errAny.description &&
          errAny.description.toString().includes('websocket')) {
        console.log('Websocket transport failed, falling back to polling (this is normal in dev)');
      } else {
        console.error('Socket.IO connection error:', error);
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Socket.IO reconnected after', attemptNumber, 'attempts');
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('Socket.IO reconnection error:', error);
    });

    // Set up event listeners
    this.socket.on('session-state-updated', (state: any) => {
      this.emit('session-state-updated', state);
    });

    this.socket.on('user-joined', (data: any) => {
      this.emit('user-joined', data);
    });

    this.socket.on('user-left', (data: any) => {
      this.emit('user-left', data);
    });

    this.socket.on('webrtc-signal', (data: WebRTCSignalMessage) => {
      this.emit('webrtc-signal', data);
    });

    this.socket.on('cursor-moved', (data: CursorMessage) => {
      this.emit('cursor-moved', data);
    });

    this.socket.on('drawing-event', (data: DrawingMessage) => {
      this.emit('drawing-event', data);
    });

    this.socket.on('chat-message', (data: ChatMessage) => {
      this.emit('chat-message', data);
    });

    this.socket.on('reaction', (data: ReactionMessage) => {
      this.emit('reaction', data);
    });
  }

  // Session management
  joinSession(sessionId: string): void {
    if (this.currentSessionId && this.currentSessionId !== sessionId) {
      console.log('Leaving previous session:', this.currentSessionId);
      this.leaveSession();
    }
    
    this.currentSessionId = sessionId;
    console.log('Socket client joining session:', sessionId, 'Socket connected:', this.socket?.connected, 'Socket ID:', this.socket?.id);
    this.socket?.emit('join-session', sessionId);
  }

  leaveSession(): void {
    if (this.currentSessionId) {
      this.socket?.emit('leave-session', this.currentSessionId);
      this.currentSessionId = null;
      console.log('Left session');
    }
  }

  // State updates
  sendStateUpdate(state: any): void {
    if (!this.currentSessionId) return;
    
    this.socket?.emit('session-state-update', {
      sessionId: this.currentSessionId,
      state
    });
  }

  // WebRTC signaling
  sendWebRTCSignal(signal: any, type: 'offer' | 'answer' | 'ice-candidate', to?: string): void {
    if (!this.currentSessionId) return;
    
    this.socket?.emit('webrtc-signal', {
      sessionId: this.currentSessionId,
      signal,
      type,
      to
    });
  }

  // Cursor tracking
  sendCursorMove(x: number, y: number, userId?: string): void {
    if (!this.currentSessionId) return;
    
    this.socket?.emit('cursor-move', {
      sessionId: this.currentSessionId,
      x,
      y,
      userId
    });
  }

  // Drawing events
  sendDrawingEvent(event: any, userId?: string): void {
    if (!this.currentSessionId) {
      console.error('Cannot send drawing event: no current session');
      return;
    }
    
    if (!this.socket?.connected) {
      console.error('Cannot send drawing event: socket not connected');
      return;
    }
    
    console.log('Sending drawing event:', {
      sessionId: this.currentSessionId,
      event,
      userId,
      socketConnected: this.socket?.connected,
      socketId: this.socket?.id
    });
    
    this.socket.emit('drawing-event', {
      sessionId: this.currentSessionId,
      event,
      userId
    });
  }

  // Chat
  sendChatMessage(message: string, userId?: string, userName?: string): void {
    if (!this.currentSessionId) return;
    
    this.socket?.emit('chat-message', {
      sessionId: this.currentSessionId,
      message,
      userId,
      userName
    });
  }

  // Reactions
  sendReaction(reaction: string, x?: number, y?: number, userId?: string): void {
    if (!this.currentSessionId) return;
    
    this.socket?.emit('reaction', {
      sessionId: this.currentSessionId,
      reaction,
      x,
      y,
      userId
    });
  }

  // Event handling
  on(event: string, handler: (data: any) => void): void {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, new Set());
    }
    this.messageHandlers.get(event)!.add(handler);
  }

  off(event: string, handler: (data: any) => void): void {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data: any): void {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  // Connection status
  isConnected(): boolean {
    return false; // Always false since Socket.IO is disabled
  }

  // Cleanup
  disconnect(): void {
    this.leaveSession();
    this.socket?.disconnect();
    this.messageHandlers.clear();
  }
}

// Singleton instance (disabled)
let socketClientInstance: SocketClient | null = null;

export function getSocketClient(): SocketClient {
  if (!socketClientInstance) {
    console.log('Socket.IO client is disabled - using WebSocket client instead');
    socketClientInstance = new SocketClient();
  }
  return socketClientInstance;
}

export function closeSocketClient(): void {
  if (socketClientInstance) {
    socketClientInstance.disconnect();
    socketClientInstance = null;
  }
}