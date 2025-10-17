import { getPollingClient, PollingClient } from '@/lib/polling/polling-client';

export interface HybridMessage {
  type: string;
  sessionId?: string;
  userId?: string;
  timestamp: number;
  [key: string]: any;
}

export interface DrawingMessage extends HybridMessage {
  event: any;
}

export interface CursorMessage extends HybridMessage {
  x: number;
  y: number;
}

export interface ChatMessage extends HybridMessage {
  id: string;
  message: string;
  userName?: string;
}

/**
 * Hybrid client that tries Lambda WebSocket first, falls back to HTTP polling
 */
export class HybridClient {
  private ws: WebSocket | null = null;
  private pollingClient: PollingClient;
  private currentSessionId: string | null = null;
  private messageHandlers: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;
  private userId: string | null = null;
  private isHost = false;
  private connectionMode: 'websocket' | 'polling' | 'none' = 'none';
  private wsConnectionTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.pollingClient = getPollingClient();
    
    // Only attempt connection on client side
    if (typeof window !== 'undefined') {
      this.startLocalWebSocketServer().then(() => {
        this.attemptWebSocketConnection();
      });
    }
  }

  private async startLocalWebSocketServer(): Promise<void> {
    try {
      console.log('🚀 Starting local WebSocket server...');
      const response = await fetch('/api/websocket/start', { method: 'POST' });
      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Local WebSocket server started:', result.url);
      } else {
        console.warn('⚠️ Failed to start local WebSocket server:', result.error);
      }
    } catch (error) {
      console.warn('⚠️ Could not start local WebSocket server:', error);
    }
  }

  private attemptWebSocketConnection(): void {
    // Try local WebSocket server first, then fall back to AWS
    const localWsUrl = 'ws://localhost:8081';
    const awsWsUrl = process.env.NEXT_PUBLIC_API_GATEWAY_WS_URL;
    
    console.log('🔍 Trying local WebSocket server first:', localWsUrl);
    
    // Start with local WebSocket server
    this.tryWebSocketUrl(localWsUrl, () => {
      console.log('🔄 Local WebSocket failed, trying AWS...');
      if (awsWsUrl) {
        this.tryWebSocketUrl(awsWsUrl, () => {
          console.log('🔄 AWS WebSocket also failed, falling back to polling');
          this.fallbackToPolling();
        });
      } else {
        console.log('🔄 No AWS WebSocket URL configured, falling back to polling');
        this.fallbackToPolling();
      }
    });
  }

  private tryWebSocketUrl(wsUrl: string, onFail: () => void): void {
    console.log('🚀 Attempting WebSocket connection to:', wsUrl);
    
    // Set a timeout for WebSocket connection
    this.wsConnectionTimeout = setTimeout(() => {
      console.log('⏰ WebSocket connection timeout');
      onFail();
    }, 5000); // 5 second timeout

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        if (this.wsConnectionTimeout) {
          clearTimeout(this.wsConnectionTimeout);
          this.wsConnectionTimeout = null;
        }
        
        console.log('✅ WebSocket connected successfully to:', wsUrl);
        this.connectionMode = 'websocket';
        this.reconnectAttempts = 0;
        this.emit('connect', { mode: 'websocket' });
        
        // Rejoin session if we were in one
        if (this.currentSessionId && this.userId) {
          console.log('🔄 Rejoining session via WebSocket after connection');
          this.joinSession(this.currentSessionId, this.userId, this.isHost);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 Received WebSocket message:', data.type);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        if (this.wsConnectionTimeout) {
          clearTimeout(this.wsConnectionTimeout);
          this.wsConnectionTimeout = null;
        }
        
        console.log('❌ WebSocket disconnected:', event.code, event.reason);
        
        if (this.connectionMode === 'websocket') {
          console.log('🔄 WebSocket disconnected, trying fallback...');
          onFail();
        }
      };

      this.ws.onerror = (error) => {
        if (this.wsConnectionTimeout) {
          clearTimeout(this.wsConnectionTimeout);
          this.wsConnectionTimeout = null;
        }
        
        console.error('❌ WebSocket error:', error);
        console.error('❌ WebSocket readyState:', this.ws?.readyState);
        console.error('❌ WebSocket URL was:', wsUrl);
        
        if (this.connectionMode === 'none') {
          console.log('🔄 WebSocket failed to connect, trying fallback');
          onFail();
        }
      };

    } catch (error) {
      if (this.wsConnectionTimeout) {
        clearTimeout(this.wsConnectionTimeout);
        this.wsConnectionTimeout = null;
      }
      
      console.error('❌ Failed to create WebSocket connection:', error);
      onFail();
    }
  }

  private attemptWebSocketReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 WebSocket reconnect attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
      
      setTimeout(() => {
        this.attemptWebSocketConnection();
      }, 1000 * this.reconnectAttempts);
    } else {
      console.log('🔄 Max WebSocket reconnect attempts reached, falling back to polling');
      this.fallbackToPolling();
    }
  }

  private fallbackToPolling(): void {
    if (this.connectionMode === 'polling') {
      console.log('⚠️ Already using polling mode');
      return;
    }

    console.log('🔄 Switching to HTTP polling mode');
    this.connectionMode = 'polling';
    
    // Close WebSocket if it exists
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Set up polling client event handlers
    this.setupPollingHandlers();
    
    // Emit connect event for polling
    this.emit('connect', { mode: 'polling' });
    
    // Join session via polling if we have one
    if (this.currentSessionId && this.userId) {
      console.log('🔄 Rejoining session via polling after fallback');
      this.pollingClient.joinSession(this.currentSessionId, this.userId, this.isHost);
    }
  }

  private setupPollingHandlers(): void {
    // Forward polling events to our handlers
    this.pollingClient.on('drawing-event', (data) => this.emit('drawing-event', data));
    this.pollingClient.on('cursor-moved', (data) => this.emit('cursor-moved', data));
    this.pollingClient.on('chat-message', (data) => this.emit('chat-message', data));
    this.pollingClient.on('user-joined', (data) => this.emit('user-joined', data));
    this.pollingClient.on('user-left', (data) => this.emit('user-left', data));
    this.pollingClient.on('session-state-updated', (data) => this.emit('session-state-updated', data));
    this.pollingClient.on('webrtc-signal', (data) => this.emit('webrtc-signal', data));
  }

  private handleMessage(message: HybridMessage): void {
    switch (message.type) {
      case 'drawing-event':
        this.emit('drawing-event', message);
        break;
      case 'cursor-moved':
        this.emit('cursor-moved', message);
        break;
      case 'chat-message':
        this.emit('chat-message', message);
        break;
      case 'user-joined':
        this.emit('user-joined', message);
        break;
      case 'user-left':
        this.emit('user-left', message);
        break;
      case 'session-state-updated':
        this.emit('session-state-updated', message);
        break;
      case 'webrtc-signal':
        this.emit('webrtc-signal', message);
        break;
      default:
        console.log('Unknown message type:', message.type);
    }
  }

  private sendViaWebSocket(message: HybridMessage): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  private sendViaPolling(message: HybridMessage): void {
    switch (message.type) {
      case 'join-session':
        this.pollingClient.joinSession(message.sessionId!, message.userId, message.isHost);
        break;
      case 'leave-session':
        this.pollingClient.leaveSession();
        break;
      case 'drawing-event':
        this.pollingClient.sendDrawingEvent(message.event, message.userId);
        break;
      case 'cursor-move':
        this.pollingClient.sendCursorMove(message.x!, message.y!, message.userId);
        break;
      case 'chat-message':
        this.pollingClient.sendChatMessage(message.message!, message.userId, message.userName);
        break;
      case 'state-update':
        this.pollingClient.sendStateUpdate(message.state);
        break;
      case 'webrtc-signal':
        this.pollingClient.sendWebRTCSignal(message.signal, message.signalType!, message.to);
        break;
    }
  }

  private send(message: HybridMessage): void {
    console.log(`📤 Sending ${message.type} via ${this.connectionMode}`);
    
    if (this.connectionMode === 'websocket') {
      if (!this.sendViaWebSocket(message)) {
        console.warn('⚠️ WebSocket send failed, falling back to polling');
        this.fallbackToPolling();
        this.sendViaPolling(message);
      }
    } else if (this.connectionMode === 'polling') {
      this.sendViaPolling(message);
    } else {
      console.error('❌ No active connection mode');
    }
  }

  // Public API - Session management
  joinSession(sessionId: string, userId?: string, isHost = false): void {
    console.log(`🔗 Joining session ${sessionId} as ${isHost ? 'host' : 'viewer'} via ${this.connectionMode}`);
    
    this.currentSessionId = sessionId;
    this.userId = userId || null;
    this.isHost = isHost;
    
    this.send({
      type: 'join-session',
      sessionId,
      userId,
      isHost,
      timestamp: Date.now()
    });
  }

  leaveSession(): void {
    if (this.currentSessionId) {
      this.send({
        type: 'leave-session',
        sessionId: this.currentSessionId,
        userId: this.userId,
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

  // State updates
  sendStateUpdate(state: any): void {
    if (!this.currentSessionId) return;
    
    this.send({
      type: 'state-update',
      sessionId: this.currentSessionId,
      state,
      timestamp: Date.now()
    });
  }

  // WebRTC signaling
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
          console.error('Error in hybrid client event handler:', error);
        }
      });
    }
  }

  // Connection status
  isConnected(): boolean {
    if (this.connectionMode === 'websocket') {
      return this.ws?.readyState === WebSocket.OPEN;
    } else if (this.connectionMode === 'polling') {
      return this.pollingClient.isConnected();
    }
    return false;
  }

  getConnectionMode(): 'websocket' | 'polling' | 'none' {
    return this.connectionMode;
  }

  // Cleanup
  disconnect(): void {
    this.leaveSession();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.pollingClient.disconnect();
    this.messageHandlers.clear();
    this.connectionMode = 'none';
  }
}

// Singleton instance
let hybridClientInstance: HybridClient | null = null;

export function getHybridClient(): HybridClient {
  // Only create instance on client side
  if (typeof window === 'undefined') {
    console.log('🔒 SSR: Returning dummy hybrid client');
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
      getConnectionMode: () => 'none',
      disconnect: () => {}
    } as any;
  }
  
  if (!hybridClientInstance) {
    hybridClientInstance = new HybridClient();
  }
  return hybridClientInstance;
}

export function closeHybridClient(): void {
  if (hybridClientInstance) {
    hybridClientInstance.disconnect();
    hybridClientInstance = null;
  }
}