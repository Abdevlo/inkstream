'use client';

import { useEffect, useState } from 'react';
import { getHybridClient } from '@/lib/hybrid/hybrid-client';

export default function WebSocketTest() {
  const [connectionMode, setConnectionMode] = useState<'websocket' | 'polling' | 'none'>('none');
  const [messages, setMessages] = useState<string[]>([]);
  const [testSessionId] = useState(`test-session-${Date.now()}`);
  const [testUserId] = useState(`user-${Math.random().toString(36).substring(2, 8)}`);

  useEffect(() => {
    const client = getHybridClient();

    // Listen for connection mode changes
    client.on('connect', (data) => {
      console.log('🔗 Connected via:', data.mode);
      setConnectionMode(data.mode);
      addMessage(`Connected via ${data.mode}`);
    });

    // Listen for test messages
    client.on('chat-message', (data) => {
      console.log('💬 Received chat:', data);
      addMessage(`Chat from ${data.userId}: ${data.message}`);
    });

    client.on('user-joined', (data) => {
      console.log('👤 User joined:', data);
      addMessage(`${data.userId} joined as ${data.isHost ? 'host' : 'viewer'}`);
    });

    client.on('user-left', (data) => {
      console.log('👋 User left:', data);
      addMessage(`${data.userId} left`);
    });

    return () => {
      client.disconnect();
    };
  }, []);

  const addMessage = (msg: string) => {
    setMessages(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const joinSession = () => {
    const client = getHybridClient();
    client.joinSession(testSessionId, testUserId, true);
    addMessage(`Attempting to join session ${testSessionId} as ${testUserId}`);
  };

  const sendTestMessage = () => {
    const client = getHybridClient();
    const message = `Test message at ${new Date().toLocaleTimeString()}`;
    client.sendChatMessage(message, testUserId, 'Test User');
    addMessage(`Sent: ${message}`);
  };

  const leaveSession = () => {
    const client = getHybridClient();
    client.leaveSession();
    addMessage('Left session');
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">WebSocket Test Page</h1>
      
      <div className="mb-6">
        <div className="bg-gray-100 p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Connection Status</h2>
          <p>Mode: <span className={`font-mono px-2 py-1 rounded ${
            connectionMode === 'websocket' ? 'bg-green-200 text-green-800' :
            connectionMode === 'polling' ? 'bg-yellow-200 text-yellow-800' :
            'bg-red-200 text-red-800'
          }`}>{connectionMode}</span></p>
          <p>Session ID: <code className="bg-gray-200 px-1 rounded">{testSessionId}</code></p>
          <p>User ID: <code className="bg-gray-200 px-1 rounded">{testUserId}</code></p>
        </div>
      </div>

      <div className="mb-6 space-x-4">
        <button 
          onClick={joinSession}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          Join Session
        </button>
        <button 
          onClick={sendTestMessage}
          className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
        >
          Send Test Message
        </button>
        <button 
          onClick={leaveSession}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
        >
          Leave Session
        </button>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h2 className="font-semibold mb-2">Messages</h2>
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-gray-500">No messages yet...</p>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className="text-sm font-mono bg-white p-2 rounded border">
                {msg}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}