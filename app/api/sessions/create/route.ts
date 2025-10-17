import { NextRequest, NextResponse } from 'next/server';
import { createSession } from '@/lib/aws/dynamodb';

export async function POST(request: NextRequest) {
  try {
    const { sessionId, hostId, title } = await request.json();

    if (!sessionId || !hostId || !title) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await createSession(sessionId, hostId, title);
    console.log('Debugger_14_Oct ---> \n Author_Abdallah ---> \n Create session:', result);

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 500 });
    }
  } catch (error: any) {
    console.error('Create session API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
