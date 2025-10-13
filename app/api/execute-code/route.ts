import { NextRequest, NextResponse } from 'next/server';
import { CodeLanguage } from '@/types';

/**
 * API Route for code execution
 * In production, this would invoke an AWS Lambda function for sandboxed execution
 * For now, returns a mock response
 */
export async function POST(request: NextRequest) {
  try {
    const { language, code } = await request.json();

    if (!language || !code) {
      return NextResponse.json(
        { success: false, error: 'Missing language or code' },
        { status: 400 }
      );
    }

    // Validate language
    const validLanguages: CodeLanguage[] = ['python', 'java', 'cpp', 'csharp'];
    if (!validLanguages.includes(language)) {
      return NextResponse.json(
        { success: false, error: 'Invalid language' },
        { status: 400 }
      );
    }

    // In production, invoke Lambda function for secure code execution
    // For now, return a mock response
    const mockOutput = getMockOutput(language, code);

    return NextResponse.json({
      success: true,
      data: mockOutput,
    });
  } catch (error: any) {
    console.error('Execute code API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Generate mock output for demo purposes
 * In production, replace this with actual Lambda invocation
 */
function getMockOutput(language: CodeLanguage, code: string) {
  // Simple pattern matching for common outputs
  if (code.includes('Hello') || code.includes('hello')) {
    return {
      stdout: 'Hello, World!\n',
      stderr: '',
      executionTime: 45,
    };
  }

  if (code.includes('factorial')) {
    return {
      stdout: 'Factorial of 5: 120\n',
      stderr: '',
      executionTime: 52,
    };
  }

  if (code.includes('error') || code.includes('Error')) {
    return {
      stdout: '',
      stderr: 'Error: Sample error message\n',
      executionTime: 23,
    };
  }

  // Default output
  const languageOutputs: Record<CodeLanguage, string> = {
    python: 'Code executed successfully\n',
    java: 'Code compiled and executed successfully\n',
    cpp: 'Code compiled and executed successfully\n',
    csharp: 'Code compiled and executed successfully\n',
  };

  return {
    stdout: languageOutputs[language],
    stderr: '',
    executionTime: Math.floor(Math.random() * 100) + 20,
  };
}

/**
 * PRODUCTION IMPLEMENTATION GUIDE:
 *
 * Replace getMockOutput with actual Lambda invocation:
 *
 * import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
 *
 * const lambda = new LambdaClient({
 *   region: process.env.NEXT_PUBLIC_AWS_REGION!,
 *   credentials: {
 *     accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
 *     secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
 *   },
 * });
 *
 * const command = new InvokeCommand({
 *   FunctionName: 'code-execution-lambda',
 *   Payload: JSON.stringify({ language, code }),
 * });
 *
 * const response = await lambda.send(command);
 * const result = JSON.parse(new TextDecoder().decode(response.Payload));
 * return result;
 */
