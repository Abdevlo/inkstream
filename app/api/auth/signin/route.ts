import { NextRequest, NextResponse } from 'next/server';
import { signIn, getCurrentUser } from '@/lib/aws/cognito';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await signIn(email, password);

    if (result.success && result.data) {
      // Get user info
      const userResult = await getCurrentUser(result.data.accessToken!);

      return NextResponse.json({
        tokens: result.data,
        user: userResult.success ? userResult.data : null,
      });
    } else {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('Signin API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
