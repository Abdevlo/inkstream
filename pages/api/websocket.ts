import { NextApiRequest, NextApiResponse } from 'next';
import { Server as HTTPServer } from 'http';
import { parse } from 'url';

const ws = require('ws');

// Extend the response object to include WebSocket server
interface NextApiResponseWithWebSocket extends NextApiResponse {
  socket: NextApiResponse['socket'] & {
    server: HTTPServer & {
      wss?: any;
    };
  };
}

interface SessionRoom {
  sessionId: string;
  clients: Map<any, { userId?: string; isHost?: boolean }>;
}

const sessions = new Map<string, SessionRoom>();

export default function handler(req: NextApiRequest, res: NextApiResponseWithWebSocket) {
  if (!res.socket.server.wss) {
    console.log('Initializing WebSocket server...');
    
    const wss = new ws.Server({
      server: res.socket.server,
      path: '/api/websocket',
    });

    wss.on('connection', (ws: any, request: any) => {
      console.log('🔗 WebSocket client connected from:', request.headers['user-agent']?.substring(0, 50));
      
      let currentSessionId: string | null = null;
      let clientInfo = { userId: undefined as string | undefined, isHost: false };

      ws.on('message', (message: Buffer) => {
        try {
          const data = JSON.parse(message.toString());
          console.log('Received WebSocket message:', data.type);

          switch (data.type) {
            case 'join-session':
              currentSessionId = data.sessionId;
              clientInfo.userId = data.userId;
              clientInfo.isHost = data.isHost || false;
              
              const sessionId = data.sessionId as string;
              
              // Create session if it doesn't exist
              if (!sessions.has(sessionId)) {
                sessions.set(sessionId, {
                  sessionId: sessionId,
                  clients: new Map()
                });
              }
              
              const session = sessions.get(sessionId)!;
              session.clients.set(ws, clientInfo);
              
              console.log(`👤 Client ${clientInfo.userId} joined session ${sessionId} as ${clientInfo.isHost ? 'host' : 'viewer'}`);
              console.log(`📊 Session ${sessionId} now has ${session.clients.size} clients`);
              
              // Notify others in the session
              broadcastToSession(sessionId, {
                type: 'user-joined',
                userId: clientInfo.userId,
                isHost: clientInfo.isHost,
                timestamp: Date.now()
              }, ws);
              break;

            case 'leave-session':
              if (currentSessionId) {
                const session = sessions.get(currentSessionId);
                if (session) {
                  session.clients.delete(ws);
                  if (session.clients.size === 0) {
                    sessions.delete(currentSessionId);
                  }
                }
                
                broadcastToSession(currentSessionId, {
                  type: 'user-left',
                  userId: clientInfo.userId,
                  timestamp: Date.now()
                }, ws);
              }
              break;

            case 'drawing-event':
              if (currentSessionId) {
                const session = sessions.get(currentSessionId);
                console.log(`🎨 Broadcasting drawing event from ${clientInfo.userId} (${clientInfo.isHost ? 'host' : 'viewer'}) in session ${currentSessionId}`);
                console.log(`📡 Event type: ${data.event?.type}, Session has ${session?.clients.size} clients`);
                
                broadcastToSession(currentSessionId, {
                  type: 'drawing-event',
                  event: data.event,
                  userId: data.userId,
                  timestamp: Date.now()
                }, ws);
                
                console.log(`✅ Drawing event broadcasted to other clients`);
              }
              break;

            case 'cursor-move':
              if (currentSessionId) {
                broadcastToSession(currentSessionId, {
                  type: 'cursor-moved',
                  x: data.x,
                  y: data.y,
                  userId: data.userId,
                  timestamp: Date.now()
                }, ws);
              }
              break;

            case 'chat-message':
              if (currentSessionId) {
                broadcastToSession(currentSessionId, {
                  type: 'chat-message',
                  message: data.message,
                  userId: data.userId,
                  userName: data.userName,
                  timestamp: Date.now(),
                  id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                }, null); // Include sender in chat messages
              }
              break;

            case 'state-update':
              if (currentSessionId) {
                broadcastToSession(currentSessionId, {
                  type: 'session-state-updated',
                  state: data.state,
                  timestamp: Date.now()
                }, ws);
              }
              break;

            case 'webrtc-signal':
              if (currentSessionId) {
                const targetData = {
                  type: 'webrtc-signal',
                  signal: data.signal,
                  signalType: data.signalType,
                  from: clientInfo.userId,
                  timestamp: Date.now()
                };

                if (data.to) {
                  // Send to specific user
                  const session = sessions.get(currentSessionId);
                  if (session) {
                    session.clients.forEach((info, client) => {
                      if (info.userId === data.to && client.readyState === 1) { // 1 = OPEN
                        client.send(JSON.stringify(targetData));
                      }
                    });
                  }
                } else {
                  // Broadcast to all other clients
                  broadcastToSession(currentSessionId, targetData, ws);
                }
              }
              break;

            default:
              console.log('Unknown message type:', data.type);
          }
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        if (currentSessionId) {
          const session = sessions.get(currentSessionId);
          if (session) {
            session.clients.delete(ws);
            if (session.clients.size === 0) {
              sessions.delete(currentSessionId);
            }
            
            broadcastToSession(currentSessionId, {
              type: 'user-left',
              userId: clientInfo.userId,
              timestamp: Date.now()
            }, ws);
          }
        }
      });

      ws.on('error', (error: unknown) => {
        console.error('WebSocket error:', error);
      });

      // Send connection confirmation
      ws.send(JSON.stringify({
        type: 'connected',
        timestamp: Date.now()
      }));
    });

    function broadcastToSession(sessionId: string, message: any, excludeClient?: WebSocket | null) {
      const session = sessions.get(sessionId);
      if (!session) {
        console.log(`❌ Session ${sessionId} not found for broadcast`);
        return;
      }

      const messageStr = JSON.stringify(message);
      let sentCount = 0;
      
      session.clients.forEach((clientInfo, client) => {
        if (client !== excludeClient && client.readyState === 1) { // 1 = OPEN
          try {
            client.send(messageStr);
            sentCount++;
            console.log(`📤 Sent ${message.type} to ${clientInfo.userId} (${clientInfo.isHost ? 'host' : 'viewer'})`);
          } catch (error) {
            console.error('❌ Error sending message to client:', error);
            session.clients.delete(client);
          }
        }
      });
      
      console.log(`📊 Broadcast complete: sent to ${sentCount} clients`);
    }

    res.socket.server.wss = wss;
    console.log('WebSocket server initialized');
  }

  res.end();
}

export const config = {
  api: {
    bodyParser: false,
  },
};