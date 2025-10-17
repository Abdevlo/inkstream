import { NextRequest, NextResponse } from 'next/server';
import { getHostSessions, createSession } from '@/lib/aws/dynamodb';

// GET /api/sessions?hostId=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hostId = searchParams.get('hostId');

    if (!hostId) {
      return NextResponse.json(
        { error: 'hostId is required' },
        { status: 400 }
      );
    }

    const result = await getHostSessions(hostId);

    if (result.success) {
      return NextResponse.json({ sessions: result.data || [] });
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Get sessions API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/sessions
export async function POST(request: NextRequest) {
  try {
    const { sessionId, hostId, title } = await request.json();

    if (!sessionId || !hostId || !title) {
      return NextResponse.json(
        { error: 'sessionId, hostId, and title are required' },
        { status: 400 }
      );
    }

    const result = await createSession(sessionId, hostId, title);

    if (result.success) {
      return NextResponse.json({ session: result.data });
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Create session API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
