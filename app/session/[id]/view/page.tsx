'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loading } from '@/components/ui/loading';
import { Button } from '@/components/ui/button';
import { useSessionStore } from '@/store/session-store';
import { createStreamProvider } from '@/lib/streaming/webrtc-provider';
// Removed direct DynamoDB import - now using API routes
import { copyToClipboard } from '@/lib/utils/session-helpers';
import toast from 'react-hot-toast';
import { LiveCursors } from '@/components/LiveCursors';
import { LiveChat } from '@/components/LiveChat';
import { CollaborativeCanvas } from '@/components/CollaborativeCanvas';
import { SessionState } from '@/types';
import { X, MessageSquare } from 'lucide-react';

export default function ViewerSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.id as string;

  const { currentSession, setCurrentSession, setIsHost } = useSessionStore();

  const [isInitializing, setIsInitializing] = useState(true);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [viewerId] = useState(() => `viewer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamProvider = useRef<any>(null);

  useEffect(() => {
    if (sessionId) {
      initializeViewer();
    } else {
      router.push('/dashboard');
    }

    return () => {
      cleanup();
    };
  }, [sessionId, router]);

  useEffect(() => {
    if (remoteStream && videoRef.current) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const initializeViewer = async () => {
    try {
      // Initialize stream provider on client side
      if (!streamProvider.current) {
        streamProvider.current = createStreamProvider('webrtc');
      }

      // Get session from API
      const response = await fetch(`/api/sessions/${sessionId}`);
      const result = await response.json();

      if (!response.ok || !result.success || !result.data) {
        toast.error('Session not found');
        router.push('/');
        return;
      }

      if (result.data.status !== 'active') {
        toast.error('This session has ended');
        router.push('/');
        return;
      }

      setCurrentSession(result.data as any);
      setIsHost(false);

      // Initialize stream provider as viewer
      await streamProvider.current.joinSession(sessionId);

      // Subscribe to media stream
      streamProvider.current.subscribeToMedia((stream: MediaStream) => {
        console.log('Received remote stream');
        setRemoteStream(stream);
      });

      // Subscribe to state updates
      streamProvider.current.subscribeToState((state: SessionState) => {
        console.log('Received state update');
        setSessionState(state);
      });

      setIsInitializing(false);
      toast.success('Connected to session');
    } catch (error) {
      console.error('Error initializing viewer:', error);
      toast.error('Failed to join session');
      router.push('/');
    }
  };

  const cleanup = async () => {
    try {
      if (streamProvider.current) {
        await streamProvider.current.leaveSession();
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
    }
  };

  const handleCopyCode = async (code: string) => {
    const success = await copyToClipboard(code);
    if (success) {
      toast.success('Code copied!');
    }
  };

  if (isInitializing) {
    return <Loading />;
  }

  return (
    <div className="h-screen relative bg-gray-900">
      {/* Session Info - Top Left */}
      <div className="absolute top-4 left-4 z-30">
        <div className="bg-black/50 backdrop-blur-md rounded-xl p-3 text-white">
          <h1 className="text-lg font-semibold">
            {currentSession?.title}
          </h1>
          <p className="text-xs text-gray-300">Viewing session</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-2 px-2 py-1 bg-green-500/20 text-green-300 rounded-lg text-xs font-medium">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              LIVE
            </div>
          </div>
        </div>
      </div>

      {/* Exit Button - Top Right */}
      <div className="absolute top-4 right-4 z-30">
        <button
          onClick={() => router.push('/')}
          className="w-12 h-12 bg-red-600 hover:bg-red-700 rounded-xl flex items-center justify-center text-white transition-all duration-200 hover:scale-105 shadow-lg"
          title="Exit Session"
        >
          <X size={20} />
        </button>
      </div>

      {/* Main Canvas Area - Full Screen */}
      <div className="absolute inset-0">
        <CollaborativeCanvas
          sessionId={sessionId}
          userId={viewerId}
          isHost={false}
          isDarkMode={isDarkMode}
          onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
        />
        
        {/* Video Stream Overlay (if available) */}
        {remoteStream && (
          <div className="absolute top-20 right-4 w-64 h-48 bg-black rounded-xl overflow-hidden shadow-2xl border border-gray-700 z-20">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-lg text-white text-xs">
              Host Stream
            </div>
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30">
        <div className="bg-black/70 backdrop-blur-md rounded-2xl px-6 py-3 shadow-2xl border border-gray-700">
          <div className="flex items-center gap-6 text-white">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Session ID:</span>
              <span className="font-mono text-xs">{sessionId.substring(0, 8)}...</span>
            </div>
            <div className="w-px h-4 bg-gray-600" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Status:</span>
              <span className="text-xs">{remoteStream ? 'Streaming' : 'Waiting'}</span>
            </div>
            <div className="w-px h-4 bg-gray-600" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Mode:</span>
              <span className="text-xs">Viewer</span>
            </div>
            
            {/* Chat Toggle for Viewers */}
            <div className="w-px h-4 bg-gray-600" />
            <button
              onClick={() => setShowChat(!showChat)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-lg ${
                showChat
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-600 hover:bg-gray-700 text-white'
              }`}
              title="Toggle Chat"
            >
              <MessageSquare size={16} />
            </button>
          </div>

          {/* Component State Display */}
          {sessionState && sessionState.components.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-600">
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-gray-400 mr-2">Active:</span>
                {sessionState.components.map((comp) => (
                  <div
                    key={comp.id}
                    className="px-2 py-1 bg-gray-700/50 text-gray-300 rounded-lg text-xs"
                  >
                    {comp.type}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Live Features */}
      <LiveCursors sessionId={sessionId} userId={viewerId} />
      <LiveChat 
        sessionId={sessionId} 
        userId={viewerId} 
        userName="Viewer" 
        isVisible={showChat}
        onToggle={() => setShowChat(!showChat)}
      />
    </div>
  );
}
