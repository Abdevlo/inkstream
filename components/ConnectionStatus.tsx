'use client';

import { useEffect, useState } from 'react';
import { getHybridClient } from '@/lib/hybrid/hybrid-client';
import { Wifi, WifiOff, Zap, Clock } from 'lucide-react';

export function ConnectionStatus() {
  const [connectionMode, setConnectionMode] = useState<'websocket' | 'polling' | 'none'>('none');
  const [isConnected, setIsConnected] = useState(false);
  const hybridClient = getHybridClient();

  useEffect(() => {
    const updateStatus = () => {
      setConnectionMode(hybridClient.getConnectionMode());
      setIsConnected(hybridClient.isConnected());
    };

    // Initial status
    updateStatus();

    // Listen for connection changes
    const handleConnect = (data: any) => {
      console.log('Connection established:', data.mode);
      updateStatus();
    };

    const handleDisconnect = () => {
      updateStatus();
    };

    hybridClient.on('connect', handleConnect);
    hybridClient.on('disconnect', handleDisconnect);

    // Poll for status changes every 2 seconds
    const statusInterval = setInterval(updateStatus, 2000);

    return () => {
      hybridClient.off('connect', handleConnect);
      hybridClient.off('disconnect', handleDisconnect);
      clearInterval(statusInterval);
    };
  }, [hybridClient]);

  const getIcon = () => {
    if (!isConnected) {
      return <WifiOff className="w-4 h-4 text-red-500" />;
    }
    
    switch (connectionMode) {
      case 'websocket':
        return <Zap className="w-4 h-4 text-green-500" />;
      case 'polling':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return <WifiOff className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    if (!isConnected) {
      return 'Disconnected';
    }
    
    switch (connectionMode) {
      case 'websocket':
        return 'WebSocket (Real-time)';
      case 'polling':
        return 'HTTP Polling (Fallback)';
      default:
        return 'No Connection';
    }
  };

  const getStatusColor = () => {
    if (!isConnected) {
      return 'text-red-500 bg-red-50 border-red-200';
    }
    
    switch (connectionMode) {
      case 'websocket':
        return 'text-green-700 bg-green-50 border-green-200';
      case 'polling':
        return 'text-yellow-700 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-500 bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor()}`}>
      {getIcon()}
      <span>{getStatusText()}</span>
    </div>
  );
}