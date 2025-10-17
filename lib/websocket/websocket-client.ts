export interface WebSocketMessage {
  type: string;
  sessionId?: string;
  userId?: string;
  timestamp: number;
  [key: string]: any;
}

export interface DrawingMessage extends WebSocketMessage {
  event: any;
}

export interface CursorMessage extends WebSocketMessage {
  x: number;
  y: number;
}

export interface ChatMessage extends WebSocketMessage {
  id: string;
  message: string;
  userName?: string;
}

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private currentSessionId: string | null = null;
  private messageHandlers: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 1000;
  private userId: string | null = null;
  private isHost = false;

  constructor() {
    // Only connect on client side
    if (typeof window !== 'undefined') {
      this.connect();
    }
  }

  private connect(): void {
    // Guard against SSR
    if (typeof window === 'undefined') {
      console.log('🔒 Cannot connect WebSocket during SSR');
      return;
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/websocket`;
    
    console.log('🔌 Attempting to connect to WebSocket:', wsUrl);
    console.log('🌍 Current location:', window.location.href);
    
    try {
      console.log('🚀 Creating new WebSocket instance...');
      this.ws = new WebSocket(wsUrl);
      console.log('💫 WebSocket instance created:', this.ws);
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket connected successfully!');
        this.reconnectAttempts = 0;
        this.emit('connect', {});
        
        // Rejoin session if we were in one
        if (this.currentSessionId && this.userId) {
          console.log('🔄 Rejoining session after reconnection');
          this.joinSession(this.currentSessionId, this.userId ?? undefined, this.isHost);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 Received WebSocket message:', data.type, data);
          
          switch (data.type) {
            case 'connected':
              console.log('✅ WebSocket connection confirmed');
              break;
            case 'drawing-event':
              console.log('🎨 Received drawing event:', data.event?.type, 'from user:', data.userId);
              this.emit('drawing-event', data);
              break;
            case 'cursor-moved':
              this.emit('cursor-moved', data);
              break;
            case 'chat-message':
              this.emit('chat-message', data);
              break;
            case 'user-joined':
              this.emit('user-joined', data);
              break;
            case 'user-left':
              this.emit('user-left', data);
              break;
            case 'session-state-updated':
              this.emit('session-state-updated', data.state);
              break;
            case 'webrtc-signal':
              this.emit('webrtc-signal', data);
              break;
            default:
              console.log('Unknown WebSocket message type:', data.type);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        this.emit('disconnect', { code: event.code, reason: event.reason });
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error occurred:', error);
        console.error('❌ WebSocket state:', this.ws?.readyState);
        console.error('❌ WebSocket URL was:', wsUrl);
        this.emit('connect_error', error);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.attemptReconnect();
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        this.connect();
      }, this.reconnectInterval * this.reconnectAttempts);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  private send(message: WebSocketMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, message not sent:', message);
    }
  }

  // Session management
  joinSession(sessionId: string, userId?: string, isHost = false): void {
    console.log('🔗 Joining WebSocket session:', sessionId, 'as', isHost ? 'host' : 'viewer', 'userId:', userId);
    
    this.currentSessionId = sessionId;
    this.userId = userId || null;
    this.isHost = isHost;
    
    if (!this.isConnected()) {
      console.warn('⚠️ WebSocket not connected when trying to join session');
    }
    
    this.send({
      type: 'join-session',
      sessionId,
      userId,
      isHost,
      timestamp: Date.now()
    });
    
    console.log('📤 Join session message sent');
  }

  leaveSession(): void {
    if (this.currentSessionId) {
      this.send({
        type: 'leave-session',
        sessionId: this.currentSessionId,
        userId: this.userId ?? undefined,
        timestamp: Date.now()
      });
      
      this.currentSessionId = null;
      this.userId = null;
      this.isHost = false;
    }
  }

  // Drawing events
  sendDrawingEvent(event: any, userId?: string): void {
    if (!this.currentSessionId) {
      console.error('❌ Cannot send drawing event: no current session');
      return;
    }
    
    if (!this.isConnected()) {
      console.error('❌ Cannot send drawing event: WebSocket not connected');
      return;
    }
    
    console.log('📤 Sending drawing event:', event.type, 'from user:', userId, 'isHost:', this.isHost);
    
    this.send({
      type: 'drawing-event',
      sessionId: this.currentSessionId,
      event,
      userId,
      timestamp: Date.now()
    });
  }

  // Cursor tracking
  sendCursorMove(x: number, y: number, userId?: string): void {
    if (!this.currentSessionId) return;
    
    this.send({
      type: 'cursor-move',
      sessionId: this.currentSessionId,
      x,
      y,
      userId,
      timestamp: Date.now()
    });
  }

  // Chat
  sendChatMessage(message: string, userId?: string, userName?: string): void {
    if (!this.currentSessionId) return;
    
    this.send({
      type: 'chat-message',
      sessionId: this.currentSessionId,
      message,
      userId,
      userName,
      timestamp: Date.now()
    });
  }

  // State updates (for WebRTC compatibility)
  sendStateUpdate(state: any): void {
    if (!this.currentSessionId) return;
    
    this.send({
      type: 'state-update',
      sessionId: this.currentSessionId,
      state,
      timestamp: Date.now()
    });
  }

  // WebRTC signaling (for WebRTC compatibility)
  sendWebRTCSignal(signal: any, type: 'offer' | 'answer' | 'ice-candidate', to?: string): void {
    if (!this.currentSessionId) return;
    
    this.send({
      type: 'webrtc-signal',
      sessionId: this.currentSessionId,
      signal,
      signalType: type,
      to,
      timestamp: Date.now()
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
      handlers.forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error('Error in WebSocket event handler:', error);
        }
      });
    }
  }

  // Connection status
  isConnected(): boolean {
    if (typeof window === 'undefined') return false;
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // Cleanup
  disconnect(): void {
    this.leaveSession();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.messageHandlers.clear();
  }
}

// Singleton instance
let webSocketClientInstance: WebSocketClient | null = null;

export function getWebSocketClient(): WebSocketClient {
  // Only create instance on client side
  if (typeof window === 'undefined') {
    console.log('🔒 SSR: Returning dummy WebSocket client');
    // Return a dummy client for SSR
    return {
      joinSession: () => {},
      sendDrawingEvent: () => {},
      sendCursorMove: () => {},
      sendChatMessage: () => {},
      sendStateUpdate: () => {},
      sendWebRTCSignal: () => {},
      on: () => {},
      off: () => {},
      isConnected: () => false,
      disconnect: () => {}
    } as any;
  }
  
  console.log('🌐 Client side: Creating WebSocket client instance');
  if (!webSocketClientInstance) {
    webSocketClientInstance = new WebSocketClient();
    console.log('✅ WebSocket client instance created');
  }
  return webSocketClientInstance;
}

export function closeWebSocketClient(): void {
  if (webSocketClientInstance) {
    webSocketClientInstance.disconnect();
    webSocketClientInstance = null;
  }
}