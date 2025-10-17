import { NextApiRequest, NextApiResponse } from 'next';
import { Server as IOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import type { Socket } from 'net';

// Extend the response object to include socket server
interface NextApiResponseWithSocket extends NextApiResponse {
  socket: Socket & {
    server: HTTPServer & {
      io?: IOServer;
    };
  };
}

export default function handler(req: NextApiRequest, res: NextApiResponseWithSocket) {
  if (!res.socket.server.io) {
    console.log('Initializing Socket.IO server...');
    
    const io = new IOServer(res.socket.server, {
      path: '/api/socket',
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      transports: ['polling', 'websocket'],
      allowEIO3: true,
      pingTimeout: 60000,
      pingInterval: 25000
    });

    // Handle connections
    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);

      // Join session room
      socket.on('join-session', (sessionId: string) => {
        socket.join(sessionId);
        console.log(`Socket ${socket.id} joined session ${sessionId}`);
        
        // Notify others in the room
        socket.to(sessionId).emit('user-joined', { 
          socketId: socket.id,
          timestamp: Date.now()
        });
      });

      // Leave session room  
      socket.on('leave-session', (sessionId: string) => {
        socket.leave(sessionId);
        console.log(`Socket ${socket.id} left session ${sessionId}`);
        
        // Notify others in the room
        socket.to(sessionId).emit('user-left', { 
          socketId: socket.id,
          timestamp: Date.now()
        });
      });

      // Handle session state updates
      socket.on('session-state-update', (data: { sessionId: string; state: any }) => {
        console.log('State update for session:', data.sessionId);
        socket.to(data.sessionId).emit('session-state-updated', data.state);
      });

      // Handle WebRTC signaling
      socket.on('webrtc-signal', (data: { 
        sessionId: string; 
        signal: any; 
        to?: string;
        type: 'offer' | 'answer' | 'ice-candidate';
      }) => {
        console.log('WebRTC signal:', data.type, 'for session:', data.sessionId);
        
        if (data.to) {
          // Send to specific socket
          socket.to(data.to).emit('webrtc-signal', {
            signal: data.signal,
            from: socket.id,
            type: data.type
          });
        } else {
          // Broadcast to all in session
          socket.to(data.sessionId).emit('webrtc-signal', {
            signal: data.signal,
            from: socket.id,
            type: data.type
          });
        }
      });

      // Handle cursor movements
      socket.on('cursor-move', (data: { 
        sessionId: string; 
        x: number; 
        y: number; 
        userId?: string;
      }) => {
        socket.to(data.sessionId).emit('cursor-moved', {
          ...data,
          socketId: socket.id,
          timestamp: Date.now()
        });
      });

      // Handle drawing events
      socket.on('drawing-event', (data: { 
        sessionId: string; 
        event: any;
        userId?: string;
      }) => {
        console.log(`Drawing event from ${socket.id} in session ${data.sessionId}:`, data.event.type, 'userId:', data.userId);
        
        const eventData = {
          ...data,
          socketId: socket.id,
          timestamp: Date.now()
        };
        
        socket.to(data.sessionId).emit('drawing-event', eventData);
        console.log(`Broadcasted drawing event to session ${data.sessionId}`);
      });

      // Handle chat messages
      socket.on('chat-message', (data: { 
        sessionId: string; 
        message: string;
        userId?: string;
        userName?: string;
      }) => {
        const messageData = {
          ...data,
          socketId: socket.id,
          timestamp: Date.now(),
          id: `msg_${Date.now()}_${socket.id}`
        };
        
        // Send to everyone in session including sender
        io.to(data.sessionId).emit('chat-message', messageData);
      });

      // Handle reactions
      socket.on('reaction', (data: { 
        sessionId: string; 
        reaction: string;
        x?: number;
        y?: number;
        userId?: string;
      }) => {
        socket.to(data.sessionId).emit('reaction', {
          ...data,
          socketId: socket.id,
          timestamp: Date.now(),
          id: `reaction_${Date.now()}_${socket.id}`
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
      });
    });

    res.socket.server.io = io;
  }

  res.end();
}

export const config = {
  api: {
    bodyParser: false,
  },
};