export interface PollingMessage {
  type: string;
  sessionId?: string;
  userId?: string;
  timestamp: number;
  [key: string]: any;
}

export interface DrawingMessage extends PollingMessage {
  event: any;
}

export interface CursorMessage extends PollingMessage {
  x: number;
  y: number;
}

export interface ChatMessage extends PollingMessage {
  id: string;
  message: string;
  userName?: string;
}

export class PollingClient {
  private currentSessionId: string | null = null;
  private messageHandlers: Map<string, Set<(data: any) => void>> = new Map();
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastMessageTimestamp = 0;
  private userId: string | null = null;
  private isHost = false;
  private isPolling = false;

  constructor() {
    // Only start polling on client side
    if (typeof window !== 'undefined') {
      console.log('🔄 HTTP Polling client initialized');
    }
  }

  private startPolling(): void {
    if (this.isPolling || !this.currentSessionId) return;
    
    this.isPolling = true;
    console.log('🔄 Starting HTTP polling for session:', this.currentSessionId);
    
    this.pollingInterval = setInterval(async () => {
      try {
        await this.pollForUpdates();
      } catch (error) {
        console.error('❌ Polling error:', error);
      }
    }, 1000); // Poll every second
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    console.log('⏹️ Stopped HTTP polling');
  }

  private async pollForUpdates(): Promise<void> {
    if (!this.currentSessionId) return;

    try {
      const response = await fetch(`/api/sessions/${this.currentSessionId}/state?since=${this.lastMessageTimestamp}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.warn('Session not found, stopping polling');
          this.stopPolling();
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.updates && Array.isArray(data.updates)) {
        data.updates.forEach((update: PollingMessage) => {
          if (update.timestamp > this.lastMessageTimestamp) {
            this.lastMessageTimestamp = update.timestamp;
            this.handleMessage(update);
          }
        });
      }
    } catch (error) {
      console.error('❌ Error polling for updates:', error);
    }
  }

  private handleMessage(message: PollingMessage): void {
    console.log('📨 Received polling message:', message.type);
    
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
        console.log('Unknown polling message type:', message.type);
    }
  }

  private async sendMessage(message: PollingMessage): Promise<void> {
    if (!this.currentSessionId) {
      console.error('❌ Cannot send message: no current session');
      return;
    }

    try {
      const response = await fetch(`/api/sessions/${this.currentSessionId}/state`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('❌ Error sending message:', error);
    }
  }

  // Session management
  joinSession(sessionId: string, userId?: string, isHost = false): void {
    console.log('🔗 Joining HTTP polling session:', sessionId, 'as', isHost ? 'host' : 'viewer');
    
    if (this.currentSessionId && this.currentSessionId !== sessionId) {
      this.leaveSession();
    }

    this.currentSessionId = sessionId;
    this.userId = userId || null;
    this.isHost = isHost;
    this.lastMessageTimestamp = Date.now();
    
    // Send join message
    this.sendMessage({
      type: 'join-session',
      sessionId,
      userId,
      isHost,
      timestamp: Date.now()
    });
    
    // Start polling for updates
    this.startPolling();
    
    // Emit connect event
    this.emit('connect', {});
  }

  leaveSession(): void {
    if (this.currentSessionId) {
      this.sendMessage({
        type: 'leave-session',
        sessionId: this.currentSessionId,
        userId: this.userId ?? undefined,
        timestamp: Date.now()
      });
      
      this.stopPolling();
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
    
    console.log('📤 Sending drawing event via HTTP:', event.type);
    
    this.sendMessage({
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
    
    this.sendMessage({
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
    
    this.sendMessage({
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
    
    this.sendMessage({
      type: 'state-update',
      sessionId: this.currentSessionId,
      state,
      timestamp: Date.now()
    });
  }

  // WebRTC signaling
  sendWebRTCSignal(signal: any, type: 'offer' | 'answer' | 'ice-candidate', to?: string): void {
    if (!this.currentSessionId) return;
    
    this.sendMessage({
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
          console.error('Error in polling event handler:', error);
        }
      });
    }
  }

  // Connection status
  isConnected(): boolean {
    return this.isPolling && this.currentSessionId !== null;
  }

  // Cleanup
  disconnect(): void {
    this.leaveSession();
    this.messageHandlers.clear();
  }
}

// Singleton instance
let pollingClientInstance: PollingClient | null = null;

export function getPollingClient(): PollingClient {
  // Only create instance on client side
  if (typeof window === 'undefined') {
    console.log('🔒 SSR: Returning dummy polling client');
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
  
  if (!pollingClientInstance) {
    pollingClientInstance = new PollingClient();
  }
  return pollingClientInstance;
}

export function closePollingClient(): void {
  if (pollingClientInstance) {
    pollingClientInstance.disconnect();
    pollingClientInstance = null;
  }
}