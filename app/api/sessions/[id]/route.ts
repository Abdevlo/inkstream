import { NextRequest, NextResponse } from 'next/server';
import { getSession, updateSessionStatus } from '@/lib/aws/dynamodb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    console.log('Debugger_14_Oct ---> \n Author_Abdallah ---> \n Get session API called', { method: 'GET', sessionId });

    const result = await getSession(sessionId);
    console.log('Debugger_14_Oct ---> \n Author_Abdallah ---> \n Get session result:', { method: 'GET', result });

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 404 });
    }
  } catch (error: any) {
    console.error(
      'Debugger_14_Oct ---> \n Author_Abdallah ---> \n Get session API error:',
      { method: 'GET', error: error?.message ?? error }
    );

    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const { status } = await request.json();

    console.log('Debugger_14_Oct ---> \n Author_Abdallah ---> \n Update session API called', { method: 'PATCH', sessionId, status });

    if (!status || !['active', 'ended'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Invalid status' },
        { status: 400 }
      );
    }

    const result = await updateSessionStatus(sessionId, status);
    console.log('Debugger_14_Oct ---> \n Author_Abdallah ---> \n Update session result:', { method: 'PATCH', result });

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json(result, { status: 500 });
    }
  } catch (error: any) {
    console.error(
      'Debugger_14_Oct ---> \n Author_Abdallah ---> \n Update session API error:',
      { method: 'PATCH', error: error?.message ?? error }
    );
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
