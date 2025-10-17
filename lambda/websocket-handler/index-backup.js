/**
 * AWS Lambda function for WebSocket connection handling
 * Handles connect, disconnect, and message routing for WebRTC signaling
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, QueryCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'WebSocketConnections';

/**
 * Main handler function
 */
exports.handler = async (event) => {
  // Extract routeKey and connectionId from requestContext for AWS_PROXY integration
  const routeKey = event.requestContext?.routeKey || event.routeKey;
  const connectionId = event.requestContext?.connectionId || event.connectionId;
  const { domainName, stage } = event.requestContext || {};

  console.log('Event:', JSON.stringify(event));
  console.log('RouteKey:', routeKey, 'ConnectionId:', connectionId);

  try {
    switch (routeKey) {
      case '$connect':
        return await handleConnect(connectionId, event);

      case '$disconnect':
        return await handleDisconnect(connectionId);

      case 'signal':
        return await handleSignal(event, domainName, stage, connectionId);

      case 'publishState':
        return await handlePublishState(event, domainName, stage, connectionId);

      case 'joinSession':
        return await handleJoinSession(event, connectionId);

      case '$default':
        // Handle default route - parse action from body
        const body = event.body ? JSON.parse(event.body) : {};
        const action = body.action;
        
        switch (action) {
          case 'joinSession':
            return await handleJoinSession(event, connectionId);
          case 'signal':
            return await handleSignal(event, domainName, stage, connectionId);
          case 'publishState':
            return await handlePublishState(event, domainName, stage, connectionId);
          default:
            console.log('Unknown action:', action);
            return { statusCode: 400, body: 'Unknown action' };
        }

      default:
        console.log('Unknown route:', routeKey);
        return { statusCode: 400, body: 'Unknown route' };
    }
  } catch (error) {
    console.error('Error:', error);
    return { statusCode: 500, body: 'Internal server error' };
  }
};

/**
 * Handle new WebSocket connection
 */
async function handleConnect(connectionId, event) {
  console.log('Connecting:', connectionId);
  
  // Extract sessionId from query parameters if available
  const queryParams = event.queryStringParameters || {};
  const sessionId = queryParams.sessionId;

  const item = {
    connectionId,
    connectedAt: Date.now(),
  };

  // Only add sessionId if it's provided
  if (sessionId) {
    item.sessionId = sessionId;
  }

  try {
    await docClient.send(new PutCommand({
      TableName: CONNECTIONS_TABLE,
      Item: item,
    }));

    console.log('Connection saved successfully:', connectionId);
    return { statusCode: 200, body: 'Connected' };
  } catch (error) {
    console.error('Error saving connection:', error);
    return { statusCode: 500, body: 'Failed to connect' };
  }
}

/**
 * Handle WebSocket disconnection
 */
async function handleDisconnect(connectionId) {
  console.log('Disconnecting:', connectionId);

  await docClient.send(new DeleteCommand({
    TableName: CONNECTIONS_TABLE,
    Key: { connectionId },
  }));

  return { statusCode: 200, body: 'Disconnected' };
}

/**
 * Handle WebRTC signaling messages
 */
async function handleSignal(event, domainName, stage, connectionId) {
  const body = event.body || '{}';
  const data = JSON.parse(body);
  const { sessionId, signalData } = data;

  console.log('Signal for session:', sessionId);

  // Get all connections for this session
  const connections = await getSessionConnections(sessionId);

  // Broadcast signal to all connections except sender
  const apiGw = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`,
  });

  const sendPromises = connections
    .filter(conn => conn.connectionId !== connectionId)
    .map(async (conn) => {
      try {
        await apiGw.send(new PostToConnectionCommand({
          ConnectionId: conn.connectionId,
          Data: JSON.stringify({
            type: 'signal',
            data: signalData,
          }),
        }));
      } catch (error) {
        console.error('Error sending to connection:', conn.connectionId, error);
        // If connection is stale, remove it
        if (error.statusCode === 410) {
          await docClient.send(new DeleteCommand({
            TableName: CONNECTIONS_TABLE,
            Key: { connectionId: conn.connectionId },
          }));
        }
      }
    });

  await Promise.all(sendPromises);

  return { statusCode: 200, body: 'Signal sent' };
}

/**
 * Handle state publish messages
 */
async function handlePublishState(event, domainName, stage, connectionId) {
  const body = event.body || '{}';
  const data = JSON.parse(body);
  const { sessionId, state } = data;

  console.log('Publishing state for session:', sessionId);

  // Get all connections for this session
  const connections = await getSessionConnections(sessionId);

  // Broadcast state to all connections except sender
  const apiGw = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`,
  });

  const sendPromises = connections
    .filter(conn => conn.connectionId !== connectionId)
    .map(async (conn) => {
      try {
        await apiGw.send(new PostToConnectionCommand({
          ConnectionId: conn.connectionId,
          Data: JSON.stringify({
            type: 'publishState',
            data: state,
          }),
        }));
      } catch (error) {
        console.error('Error sending to connection:', conn.connectionId, error);
        if (error.statusCode === 410) {
          await docClient.send(new DeleteCommand({
            TableName: CONNECTIONS_TABLE,
            Key: { connectionId: conn.connectionId },
          }));
        }
      }
    });

  await Promise.all(sendPromises);

  return { statusCode: 200, body: 'State published' };
}

/**
 * Handle joining a session
 */
async function handleJoinSession(event, connectionId) {
  const body = event.body || '{}';
  const data = JSON.parse(body);
  const { sessionId } = data;

  console.log('Joining session:', sessionId, 'connectionId:', connectionId);

  if (!sessionId) {
    return { statusCode: 400, body: 'Session ID required' };
  }

  try {
    // Update the connection with sessionId
    await docClient.send(new PutCommand({
      TableName: CONNECTIONS_TABLE,
      Item: {
        connectionId,
        sessionId,
        connectedAt: Date.now(),
      },
    }));

    console.log('Connection updated with sessionId:', sessionId);
    return { statusCode: 200, body: 'Joined session' };
  } catch (error) {
    console.error('Error joining session:', error);
    return { statusCode: 500, body: 'Failed to join session' };
  }
}

/**
 * Get all connections for a session
 */
async function getSessionConnections(sessionId) {
  const result = await docClient.send(new QueryCommand({
    TableName: CONNECTIONS_TABLE,
    IndexName: 'SessionIdIndex',
    KeyConditionExpression: 'sessionId = :sessionId',
    ExpressionAttributeValues: {
      ':sessionId': sessionId,
    },
  }));

  return result.Items || [];
}
