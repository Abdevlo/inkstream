/**
 * Enhanced AWS Lambda function for WebSocket connection handling
 * Supports all hybrid client message types: drawing, cursor, chat, state, WebRTC signaling
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, QueryCommand, ScanCommand } = require('@aws-sdk/lib-dynamodb');
const { ApiGatewayManagementApiClient, PostToConnectionCommand } = require('@aws-sdk/client-apigatewaymanagementapi');

const ddbClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const docClient = DynamoDBDocumentClient.from(ddbClient);

const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'WebSocketConnections';
const MESSAGES_TABLE = process.env.MESSAGES_TABLE || 'SessionMessages';

/**
 * Main handler function
 */
exports.handler = async (event) => {
  const routeKey = event.requestContext?.routeKey || event.routeKey;
  const connectionId = event.requestContext?.connectionId || event.connectionId;
  const { domainName, stage } = event.requestContext || {};

  console.log('WebSocket Event:', {
    routeKey,
    connectionId,
    body: event.body
  });

  try {
    switch (routeKey) {
      case '$connect':
        return await handleConnect(connectionId, event);

      case '$disconnect':
        return await handleDisconnect(connectionId);

      case '$default':
        return await handleMessage(event, domainName, stage, connectionId);

      default:
        console.log('Unknown route:', routeKey);
        return { statusCode: 400 };
    }
  } catch (error) {
    console.error('Handler Error:', error);
    return { statusCode: 500 };
  }
};

/**
 * Handle new WebSocket connection
 */
async function handleConnect(connectionId, event) {
  console.log('🔗 New connection:', connectionId);
  
  const queryParams = event.queryStringParameters || {};
  const sessionId = queryParams.sessionId;

  const item = {
    connectionId,
    connectedAt: Date.now(),
    status: 'connected'
  };

  if (sessionId) {
    item.sessionId = sessionId;
  }

  try {
    await docClient.send(new PutCommand({
      TableName: CONNECTIONS_TABLE,
      Item: item,
    }));

    console.log('✅ Connection saved:', connectionId);
    return { statusCode: 200 };
  } catch (error) {
    console.error('❌ Error saving connection:', error);
    return { statusCode: 500 };
  }
}

/**
 * Handle WebSocket disconnection
 */
async function handleDisconnect(connectionId) {
  console.log('❌ Disconnecting:', connectionId);

  try {
    // Get connection info before deleting
    const connection = await getConnection(connectionId);
    
    await docClient.send(new DeleteCommand({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId },
    }));

    // Notify session participants about disconnection
    if (connection && connection.sessionId && connection.userId) {
      await broadcastToSession(connection.sessionId, {
        type: 'user-left',
        userId: connection.userId,
        timestamp: Date.now()
      }, connectionId, null, null);
    }

    console.log('✅ Connection removed:', connectionId);
    return { statusCode: 200 };
  } catch (error) {
    console.error('❌ Error during disconnect:', error);
    return { statusCode: 200 }; // Still return success
  }
}

/**
 * Handle all WebSocket messages
 */
async function handleMessage(event, domainName, stage, connectionId) {
  const body = event.body || '{}';
  let data;
  
  try {
    data = JSON.parse(body);
  } catch (error) {
    console.error('❌ Invalid JSON:', body);
    return { statusCode: 400 };
  }

  const { type } = data;
  console.log(`📨 Message type: ${type} from ${connectionId}`);

  try {
    switch (type) {
      case 'join-session':
        return await handleJoinSession(data, connectionId);

      case 'leave-session':
        return await handleLeaveSession(data, connectionId, domainName, stage);

      case 'drawing-event':
        return await handleDrawingEvent(data, connectionId, domainName, stage);

      case 'cursor-move':
        return await handleCursorMove(data, connectionId, domainName, stage);

      case 'chat-message':
        return await handleChatMessage(data, connectionId, domainName, stage);

      case 'state-update':
        return await handleStateUpdate(data, connectionId, domainName, stage);

      case 'webrtc-signal':
        return await handleWebRTCSignal(data, connectionId, domainName, stage);

      default:
        console.log('❓ Unknown message type:', type);
        return { statusCode: 400 };
    }
  } catch (error) {
    console.error(`❌ Error handling ${type}:`, error);
    return { statusCode: 500 };
  }
}

/**
 * Handle joining a session
 */
async function handleJoinSession(data, connectionId) {
  const { sessionId, userId, isHost } = data;
  
  console.log(`👤 ${userId} joining session ${sessionId} as ${isHost ? 'host' : 'viewer'}`);

  if (!sessionId) {
    return { statusCode: 400 };
  }

  try {
    // Update connection with session info
    await docClient.send(new PutCommand({
      TableName: CONNECTIONS_TABLE,
      Item: {
        connectionId,
        sessionId,
        userId: userId || null,
        isHost: isHost || false,
        connectedAt: Date.now(),
        status: 'connected'
      },
    }));

    // Store join message
    await storeMessage(sessionId, {
      type: 'user-joined',
      userId,
      isHost,
      timestamp: Date.now()
    });

    console.log(`✅ ${userId} joined session ${sessionId}`);
    return { statusCode: 200 };
  } catch (error) {
    console.error('❌ Error joining session:', error);
    return { statusCode: 500 };
  }
}

/**
 * Handle leaving a session
 */
async function handleLeaveSession(data, connectionId, domainName, stage) {
  const { sessionId, userId } = data;
  
  console.log(`👋 ${userId} leaving session ${sessionId}`);

  try {
    // Update connection to remove session info
    await docClient.send(new PutCommand({
      TableName: CONNECTIONS_TABLE,
      Item: {
        connectionId,
        connectedAt: Date.now(),
        status: 'connected'
      },
    }));

    // Broadcast leave event
    await broadcastToSession(sessionId, {
      type: 'user-left',
      userId,
      timestamp: Date.now()
    }, connectionId, domainName, stage);

    console.log(`✅ ${userId} left session ${sessionId}`);
    return { statusCode: 200 };
  } catch (error) {
    console.error('❌ Error leaving session:', error);
    return { statusCode: 500 };
  }
}

/**
 * Handle drawing events
 */
async function handleDrawingEvent(data, connectionId, domainName, stage) {
  const { sessionId, event, userId } = data;
  
  console.log(`🎨 Drawing event ${event?.type} from ${userId} in session ${sessionId}`);

  // Store drawing event
  await storeMessage(sessionId, data);

  // Broadcast to session participants
  await broadcastToSession(sessionId, data, connectionId, domainName, stage);

  return { statusCode: 200 };
}

/**
 * Handle cursor movements
 */
async function handleCursorMove(data, connectionId, domainName, stage) {
  const { sessionId, x, y, userId } = data;
  
  // Don't store cursor moves (too frequent), just broadcast
  await broadcastToSession(sessionId, {
    type: 'cursor-moved',
    x,
    y,
    userId,
    timestamp: Date.now()
  }, connectionId, domainName, stage);

  return { statusCode: 200 };
}

/**
 * Handle chat messages
 */
async function handleChatMessage(data, connectionId, domainName, stage) {
  const { sessionId, message, userId, userName } = data;
  
  console.log(`💬 Chat from ${userName} (${userId}) in session ${sessionId}`);

  const chatData = {
    type: 'chat-message',
    id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    message,
    userId,
    userName,
    timestamp: Date.now()
  };

  // Store chat message
  await storeMessage(sessionId, chatData);

  // Broadcast to all participants (including sender for consistency)
  await broadcastToSession(sessionId, chatData, null, domainName, stage);

  return { statusCode: 200 };
}

/**
 * Handle state updates
 */
async function handleStateUpdate(data, connectionId, domainName, stage) {
  const { sessionId, state } = data;
  
  console.log(`📊 State update for session ${sessionId}`);

  // Store state update
  await storeMessage(sessionId, {
    type: 'session-state-updated',
    state,
    timestamp: Date.now()
  });

  // Broadcast to session participants
  await broadcastToSession(sessionId, {
    type: 'session-state-updated',
    state,
    timestamp: Date.now()
  }, connectionId, domainName, stage);

  return { statusCode: 200 };
}

/**
 * Handle WebRTC signaling
 */
async function handleWebRTCSignal(data, connectionId, domainName, stage) {
  const { sessionId, signal, signalType, to } = data;
  
  console.log(`📡 WebRTC signal ${signalType} in session ${sessionId}`);

  const signalData = {
    type: 'webrtc-signal',
    signal,
    signalType,
    from: await getUserIdByConnection(connectionId),
    timestamp: Date.now()
  };

  if (to) {
    // Send to specific user
    await sendToUser(sessionId, to, signalData, domainName, stage);
  } else {
    // Broadcast to all other participants
    await broadcastToSession(sessionId, signalData, connectionId, domainName, stage);
  }

  return { statusCode: 200 };
}

/**
 * Broadcast message to all connections in a session
 */
async function broadcastToSession(sessionId, message, excludeConnectionId, domainName, stage) {
  if (!domainName || !stage) {
    console.warn('⚠️ Missing domainName or stage for broadcast');
    return;
  }

  const connections = await getSessionConnections(sessionId);
  
  if (connections.length === 0) {
    console.log(`📊 No connections found for session ${sessionId}`);
    return;
  }

  const apiGw = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`,
  });

  const messageStr = JSON.stringify(message);
  let sentCount = 0;

  const sendPromises = connections
    .filter(conn => conn.connectionId !== excludeConnectionId)
    .map(async (conn) => {
      try {
        await apiGw.send(new PostToConnectionCommand({
          ConnectionId: conn.connectionId,
          Data: messageStr,
        }));
        sentCount++;
        console.log(`📤 Sent ${message.type} to ${conn.userId || conn.connectionId}`);
      } catch (error) {
        console.error(`❌ Error sending to ${conn.connectionId}:`, error);
        // Remove stale connections
        if (error.statusCode === 410) {
          await docClient.send(new DeleteCommand({
            TableName: CONNECTIONS_TABLE,
            Key: { connectionId: conn.connectionId },
          }));
        }
      }
    });

  await Promise.all(sendPromises);
  console.log(`📊 Broadcast complete: sent to ${sentCount}/${connections.length} connections`);
}

/**
 * Send message to specific user
 */
async function sendToUser(sessionId, userId, message, domainName, stage) {
  const connections = await getSessionConnections(sessionId);
  const userConnection = connections.find(conn => conn.userId === userId);

  if (!userConnection) {
    console.log(`❓ User ${userId} not found in session ${sessionId}`);
    return;
  }

  const apiGw = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`,
  });

  try {
    await apiGw.send(new PostToConnectionCommand({
      ConnectionId: userConnection.connectionId,
      Data: JSON.stringify(message),
    }));
    console.log(`📤 Sent ${message.type} to user ${userId}`);
  } catch (error) {
    console.error(`❌ Error sending to user ${userId}:`, error);
    if (error.statusCode === 410) {
      await docClient.send(new DeleteCommand({
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId: userConnection.connectionId },
      }));
    }
  }
}

/**
 * Store message in DynamoDB for message history
 */
async function storeMessage(sessionId, message) {
  try {
    await docClient.send(new PutCommand({
      TableName: MESSAGES_TABLE,
      Item: {
        sessionId,
        messageId: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        message,
        timestamp: message.timestamp || Date.now(),
        ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours TTL
      },
    }));
  } catch (error) {
    console.error('❌ Error storing message:', error);
    // Don't fail the request if message storage fails
  }
}

/**
 * Get all connections for a session
 */
async function getSessionConnections(sessionId) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: CONNECTIONS_TABLE,
      IndexName: 'SessionIdIndex',
      KeyConditionExpression: 'sessionId = :sessionId',
      ExpressionAttributeValues: {
        ':sessionId': sessionId,
      },
    }));

    return result.Items || [];
  } catch (error) {
    console.error('❌ Error getting session connections:', error);
    return [];
  }
}

/**
 * Get connection by connectionId
 */
async function getConnection(connectionId) {
  try {
    const result = await docClient.send(new QueryCommand({
      TableName: CONNECTIONS_TABLE,
      KeyConditionExpression: 'connectionId = :connectionId',
      ExpressionAttributeValues: {
        ':connectionId': connectionId,
      },
    }));

    return result.Items?.[0] || null;
  } catch (error) {
    console.error('❌ Error getting connection:', error);
    return null;
  }
}

/**
 * Get userId by connectionId
 */
async function getUserIdByConnection(connectionId) {
  const connection = await getConnection(connectionId);
  return connection?.userId || connectionId;
}