import { NextRequest, NextResponse } from 'next/server';
import { getSessionById, updateSessionState } from '@/lib/aws/dynamodb';

// In-memory message store for polling (in production, use Redis or similar)
const sessionMessages = new Map<string, Array<any>>();
const SESSION_MESSAGE_LIMIT = 100; // Keep last 100 messages per session

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const { searchParams } = new URL(request.url);
    const since = parseInt(searchParams.get('since') || '0');

    // Get session data
    const session = await getSessionById(sessionId);
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // If polling for updates (since parameter provided)
    if (since > 0) {
      const messages = sessionMessages.get(sessionId) || [];
      const updates = messages.filter(msg => msg.timestamp > since);
      
      return NextResponse.json({
        success: true,
        updates,
        lastTimestamp: messages.length > 0 ? messages[messages.length - 1].timestamp : since
      });
    }

    // Return current state
    const state = (session as any).state ?? null;
    return NextResponse.json({
      success: true,
      state,
    });
  } catch (error) {
    console.error('Error getting session state:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const messageData = await request.json();

    // Optional: Verify JWT token for host validation
    // const authHeader = request.headers.get('authorization');
    // if (authHeader) {
    //   const token = authHeader.replace('Bearer ', '');
    //   await verifyJWTToken(token);
    // }

    // If this is a state update, update DynamoDB
    if (messageData.type === 'state-update' && messageData.state) {
      await updateSessionState(sessionId, messageData.state);
    }

    // Add message to in-memory store for real-time features
    if (!sessionMessages.has(sessionId)) {
      sessionMessages.set(sessionId, []);
    }
    
    const messages = sessionMessages.get(sessionId)!;
    messages.push({
      ...messageData,
      timestamp: messageData.timestamp || Date.now()
    });
    
    // Keep only the last N messages
    if (messages.length > SESSION_MESSAGE_LIMIT) {
      messages.splice(0, messages.length - SESSION_MESSAGE_LIMIT);
    }

    console.log(`📨 Added message to session ${sessionId}:`, messageData.type);

    return NextResponse.json({
      success: true,
      message: 'Message processed successfully',
    });
  } catch (error) {
    console.error('Error processing message:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}