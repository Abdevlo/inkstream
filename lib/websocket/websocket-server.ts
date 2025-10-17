import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { URL } from 'url';

interface WebSocketConnection {
  id: string;
  socket: WebSocket;
  sessionId?: string;
  userId?: string;
  isHost?: boolean;
  connectedAt: number;
}

interface WebSocketMessage {
  type: string;
  sessionId?: string;
  userId?: string;
  timestamp: number;
  [key: string]: any;
}

export class LocalWebSocketServer {
  private wss: WebSocketServer | null = null;
  private connections: Map<string, WebSocketConnection> = new Map();
  private sessionConnections: Map<string, Set<string>> = new Map();
  private port: number;

  constructor(port: number = 8081) {
    this.port = port;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({ 
          port: this.port,
          verifyClient: () => {
            // Allow all connections for now
            return true;
          }
        });

        this.wss.on('connection', (socket: WebSocket, request: IncomingMessage) => {
          this.handleConnection(socket, request);
        });

        this.wss.on('listening', () => {
          console.log(`🚀 WebSocket server running on port ${this.port}`);
          resolve();
        });

        this.wss.on('error', (error) => {
          console.error('❌ WebSocket server error:', error);
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  private handleConnection(socket: WebSocket, request: IncomingMessage): void {
    const connectionId = this.generateConnectionId();
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');

    console.log(`🔗 New WebSocket connection: ${connectionId}`, {
      sessionId,
      origin: request.headers.origin
    });

    const connection: WebSocketConnection = {
      id: connectionId,
      socket,
      sessionId: sessionId || undefined,
      connectedAt: Date.now()
    };

    this.connections.set(connectionId, connection);

    // Handle incoming messages
    socket.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage;
        this.handleMessage(connectionId, message);
      } catch (error) {
        console.error('❌ Error parsing WebSocket message:', error);
      }
    });

    // Handle disconnection
    socket.on('close', () => {
      this.handleDisconnection(connectionId);
    });

    socket.on('error', (error) => {
      console.error(`❌ WebSocket error for ${connectionId}:`, error);
      this.handleDisconnection(connectionId);
    });

    // Send connection confirmation
    this.sendToConnection(connectionId, {
      type: 'connected',
      connectionId,
      timestamp: Date.now()
    });
  }

  private handleMessage(connectionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      console.error(`❌ Connection ${connectionId} not found`);
      return;
    }

    console.log(`📨 Message from ${connectionId}:`, message.type);

    switch (message.type) {
      case 'join-session':
        this.handleJoinSession(connectionId, message);
        break;

      case 'leave-session':
        this.handleLeaveSession(connectionId, message);
        break;

      case 'drawing-event':
        this.handleDrawingEvent(connectionId, message);
        break;

      case 'cursor-move':
        this.handleCursorMove(connectionId, message);
        break;

      case 'chat-message':
        this.handleChatMessage(connectionId, message);
        break;

      case 'state-update':
        this.handleStateUpdate(connectionId, message);
        break;

      case 'webrtc-signal':
        this.handleWebRTCSignal(connectionId, message);
        break;

      default:
        console.log(`❓ Unknown message type: ${message.type}`);
    }
  }

  private handleJoinSession(connectionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { sessionId, userId, isHost } = message;
    
    console.log(`👤 ${userId} joining session ${sessionId} as ${isHost ? 'host' : 'viewer'}`);

    // Update connection info
    connection.sessionId = sessionId;
    connection.userId = userId;
    connection.isHost = isHost;

    // Add to session connections
    if (sessionId) {
      if (!this.sessionConnections.has(sessionId)) {
        this.sessionConnections.set(sessionId, new Set());
      }
      this.sessionConnections.get(sessionId)!.add(connectionId);

      // Broadcast join event to other participants
      this.broadcastToSession(sessionId, {
        type: 'user-joined',
        userId,
        isHost,
        timestamp: Date.now()
      }, connectionId);
    }

    // Confirm join
    this.sendToConnection(connectionId, {
      type: 'session-joined',
      sessionId,
      userId,
      isHost,
      timestamp: Date.now()
    });
  }

  private handleLeaveSession(connectionId: string, message: WebSocketMessage): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    const { sessionId, userId } = message;
    
    console.log(`👋 ${userId} leaving session ${sessionId}`);

    if (sessionId) {
      // Remove from session connections
      const sessionConns = this.sessionConnections.get(sessionId);
      if (sessionConns) {
        sessionConns.delete(connectionId);
        if (sessionConns.size === 0) {
          this.sessionConnections.delete(sessionId);
        }
      }

      // Broadcast leave event
      this.broadcastToSession(sessionId, {
        type: 'user-left',
        userId,
        timestamp: Date.now()
      }, connectionId);
    }

    // Update connection
    connection.sessionId = undefined;
    connection.userId = undefined;
    connection.isHost = undefined;
  }

  private handleDrawingEvent(connectionId: string, message: WebSocketMessage): void {
    const { sessionId } = message;
    if (!sessionId) return;

    console.log(`🎨 Drawing event in session ${sessionId}`);
    this.broadcastToSession(sessionId, message, connectionId);
  }

  private handleCursorMove(connectionId: string, message: WebSocketMessage): void {
    const { sessionId } = message;
    if (!sessionId) return;

    // Don't log cursor moves (too frequent)
    this.broadcastToSession(sessionId, {
      ...message,
      type: 'cursor-moved'
    }, connectionId);
  }

  private handleChatMessage(connectionId: string, message: WebSocketMessage): void {
    const { sessionId } = message;
    if (!sessionId) return;

    console.log(`💬 Chat message in session ${sessionId}`);
    
    const chatMessage = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      timestamp: Date.now()
    };

    // Broadcast to all participants (including sender)
    this.broadcastToSession(sessionId, chatMessage);
  }

  private handleStateUpdate(connectionId: string, message: WebSocketMessage): void {
    const { sessionId } = message;
    if (!sessionId) return;

    console.log(`📊 State update in session ${sessionId}`);
    this.broadcastToSession(sessionId, {
      type: 'session-state-updated',
      state: message.state,
      timestamp: Date.now()
    }, connectionId);
  }

  private handleWebRTCSignal(connectionId: string, message: WebSocketMessage): void {
    const { sessionId, to } = message;
    if (!sessionId) return;

    console.log(`📡 WebRTC signal in session ${sessionId}`);
    
    const connection = this.connections.get(connectionId);
    const signalMessage = {
      type: 'webrtc-signal',
      signal: message.signal,
      signalType: message.signalType,
      from: connection?.userId || connectionId,
      timestamp: Date.now()
    };

    if (to) {
      // Send to specific user
      this.sendToUser(sessionId, to, signalMessage);
    } else {
      // Broadcast to all other participants
      this.broadcastToSession(sessionId, signalMessage, connectionId);
    }
  }

  private handleDisconnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    console.log(`❌ Connection ${connectionId} disconnected`);

    // Remove from session if in one
    if (connection.sessionId && connection.userId) {
      const sessionConns = this.sessionConnections.get(connection.sessionId);
      if (sessionConns) {
        sessionConns.delete(connectionId);
        if (sessionConns.size === 0) {
          this.sessionConnections.delete(connection.sessionId);
        }
      }

      // Notify other participants
      this.broadcastToSession(connection.sessionId, {
        type: 'user-left',
        userId: connection.userId,
        timestamp: Date.now()
      }, connectionId);
    }

    // Remove connection
    this.connections.delete(connectionId);
  }

  private broadcastToSession(sessionId: string, message: any, excludeConnectionId?: string): void {
    const sessionConns = this.sessionConnections.get(sessionId);
    if (!sessionConns || sessionConns.size === 0) {
      console.log(`📊 No connections in session ${sessionId}`);
      return;
    }

    let sentCount = 0;
    for (const connId of sessionConns) {
      if (connId !== excludeConnectionId) {
        if (this.sendToConnection(connId, message)) {
          sentCount++;
        }
      }
    }

    console.log(`📊 Broadcast ${message.type} to ${sentCount}/${sessionConns.size} connections in session ${sessionId}`);
  }

  private sendToUser(sessionId: string, userId: string, message: any): void {
    const sessionConns = this.sessionConnections.get(sessionId);
    if (!sessionConns) return;

    for (const connId of sessionConns) {
      const connection = this.connections.get(connId);
      if (connection?.userId === userId) {
        this.sendToConnection(connId, message);
        console.log(`📤 Sent ${message.type} to user ${userId}`);
        return;
      }
    }

    console.log(`❓ User ${userId} not found in session ${sessionId}`);
  }

  private sendToConnection(connectionId: string, message: any): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection || connection.socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      connection.socket.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error(`❌ Error sending to ${connectionId}:`, error);
      return false;
    }
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  stop(): void {
    if (this.wss) {
      console.log('🔴 Stopping WebSocket server...');
      this.wss.close();
      this.connections.clear();
      this.sessionConnections.clear();
    }
  }

  getStats() {
    return {
      totalConnections: this.connections.size,
      activeSessions: this.sessionConnections.size,
      connectionsPerSession: Array.from(this.sessionConnections.entries()).map(([sessionId, conns]) => ({
        sessionId,
        connections: conns.size
      }))
    };
  }
}

// Singleton instance
let serverInstance: LocalWebSocketServer | null = null;

export function getWebSocketServer(): LocalWebSocketServer {
  if (!serverInstance) {
    serverInstance = new LocalWebSocketServer();
  }
  return serverInstance;
}

export function startWebSocketServer(): Promise<void> {
  const server = getWebSocketServer();
  return server.start();
}

export function stopWebSocketServer(): void {
  if (serverInstance) {
    serverInstance.stop();
    serverInstance = null;
  }
}