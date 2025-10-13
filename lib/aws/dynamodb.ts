import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
} from '@aws-sdk/lib-dynamodb';
import { SessionRecord, StateRecord, StreamSession } from '@/types';

const client = new DynamoDBClient({
  region: process.env.NEXT_PUBLIC_AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const docClient = DynamoDBDocumentClient.from(client);

const SESSIONS_TABLE = process.env.DYNAMODB_SESSIONS_TABLE || 'StreamSessions';
const STATES_TABLE = process.env.DYNAMODB_STATES_TABLE || 'SessionStates';

/**
 * Create a new streaming session
 */
export async function createSession(
  sessionId: string,
  hostId: string,
  title: string
): Promise<{ success: boolean; data?: SessionRecord; error?: string }> {
  try {
    const session: SessionRecord = {
      sessionId,
      hostId,
      createdAt: Date.now(),
      status: 'active',
      title,
    };

    const command = new PutCommand({
      TableName: SESSIONS_TABLE,
      Item: session,
    });

    console.log('Creating docClient:', docClient);

    

    await docClient.send(command);

    return { success: true, data: session };
  } catch (error: any) {
    console.error('Create session error:', error);
    return { success: false, error: error.message || 'Failed to create session' };
  }
}

/**
 * Get session by ID
 */
export async function getSession(
  sessionId: string
): Promise<{ success: boolean; data?: SessionRecord; error?: string }> {
  try {
    const command = new GetCommand({
      TableName: SESSIONS_TABLE,
      Key: { sessionId },
    });

    console.log('Creating docClient:', docClient);

    const response = await docClient.send(command);

    if (!response.Item) {
      return { success: false, error: 'Session not found' };
    }

    return { success: true, data: response.Item as SessionRecord };
  } catch (error: any) {
    console.error('Get session error:', error);
    return { success: false, error: error.message || 'Failed to get session' };
  }
}

/**
 * Get all sessions for a host
 */
export async function getHostSessions(
  hostId: string
): Promise<{ success: boolean; data?: SessionRecord[]; error?: string }> {
  try {
    const command = new QueryCommand({
      TableName: SESSIONS_TABLE,
      IndexName: 'HostIdIndex', // Assumes GSI on hostId
      KeyConditionExpression: 'hostId = :hostId',
      ExpressionAttributeValues: {
        ':hostId': hostId,
      },
      ScanIndexForward: false, // Sort by createdAt descending
    });

    console.log('Creating docClient:', docClient);

    const response = await docClient.send(command);

    return { success: true, data: (response.Items as SessionRecord[]) || [] };
  } catch (error: any) {
    console.error('Get host sessions error:', error);
    // If GSI doesn't exist, return empty array instead of error
    return { success: true, data: [] };
  }
}

/**
 * Update session status
 */
export async function updateSessionStatus(
  sessionId: string,
  status: 'active' | 'ended'
): Promise<{ success: boolean; error?: string }> {
  try {
    const command = new UpdateCommand({
      TableName: SESSIONS_TABLE,
      Key: { sessionId },
      UpdateExpression: 'SET #status = :status',
      ExpressionAttributeNames: {
        '#status': 'status',
      },
      ExpressionAttributeValues: {
        ':status': status,
      },
    });

    console.log('Creating docClient:', docClient);

    await docClient.send(command);

    return { success: true };
  } catch (error: any) {
    console.error('Update session status error:', error);
    return { success: false, error: error.message || 'Failed to update session status' };
  }
}

/**
 * Save session state
 */
export async function saveSessionState(
  sessionId: string,
  state: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const stateRecord: StateRecord = {
      sessionId,
      timestamp: Date.now(),
      state,
    };

    const command = new PutCommand({
      TableName: STATES_TABLE,
      Item: stateRecord,
    });

    console.log('Creating docClient:', docClient);

    await docClient.send(command);

    return { success: true };
  } catch (error: any) {
    console.error('Save session state error:', error);
    return { success: false, error: error.message || 'Failed to save session state' };
  }
}

/**
 * Get latest session state
 */
export async function getSessionState(
  sessionId: string
): Promise<{ success: boolean; data?: StateRecord; error?: string }> {
  try {
    const command = new QueryCommand({
      TableName: STATES_TABLE,
      KeyConditionExpression: 'sessionId = :sessionId',
      ExpressionAttributeValues: {
        ':sessionId': sessionId,
      },
      ScanIndexForward: false,
      Limit: 1,
    });

    const response = await docClient.send(command);

    if (!response.Items || response.Items.length === 0) {
      return { success: false, error: 'No state found' };
    }

    return { success: true, data: response.Items[0] as StateRecord };
  } catch (error: any) {
    console.error('Get session state error:', error);
    return { success: false, error: error.message || 'Failed to get session state' };
  }
}

/**
 * Delete session
 */
export async function deleteSession(
  sessionId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const command = new DeleteCommand({
      TableName: SESSIONS_TABLE,
      Key: { sessionId },
    });

    await docClient.send(command);

    return { success: true };
  } catch (error: any) {
    console.error('Delete session error:', error);
    return { success: false, error: error.message || 'Failed to delete session' };
  }
}
