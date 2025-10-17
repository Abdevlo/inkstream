import { NextRequest, NextResponse } from 'next/server';
import { getWebSocketServer } from '@/lib/websocket/websocket-server';

let serverStarted = false;

export async function POST(request: NextRequest) {
  try {
    if (serverStarted) {
      return NextResponse.json({ 
        success: true, 
        message: 'WebSocket server already running',
        url: 'ws://localhost:8081'
      });
    }

    const server = getWebSocketServer();
    await server.start();
    serverStarted = true;

    return NextResponse.json({ 
      success: true, 
      message: 'WebSocket server started',
      url: 'ws://localhost:8081'
    });
  } catch (error) {
    console.error('Failed to start WebSocket server:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to start WebSocket server'
    }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const server = getWebSocketServer();
  const stats = server.getStats();

  return NextResponse.json({
    running: serverStarted,
    stats,
    url: serverStarted ? 'ws://localhost:8081' : null
  });
}