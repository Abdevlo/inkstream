'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loading } from '@/components/ui/loading';
import { Button } from '@/components/ui/button';
import { useSessionStore } from '@/store/session-store';
import { createStreamProvider } from '@/lib/streaming/webrtc-provider';
import { getSession } from '@/lib/aws/dynamodb';
import { copyToClipboard } from '@/lib/utils/session-helpers';
import toast from 'react-hot-toast';
import { SessionState } from '@/types';

export default function ViewerSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;

  const { currentSession, setCurrentSession, setIsHost } = useSessionStore();

  const [isInitializing, setIsInitializing] = useState(true);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamProvider = useRef(createStreamProvider('webrtc'));

  useEffect(() => {
    if (sessionId) {
      initializeViewer();
    }

    return () => {
      cleanup();
    };
  }, [sessionId]);

  useEffect(() => {
    if (remoteStream && videoRef.current) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const initializeViewer = async () => {
    try {
      // Get session from DB
      const result = await getSession(sessionId);

      if (!result.success || !result.data) {
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
      await streamProvider.current.leaveSession();
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
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">
              {currentSession?.title}
            </h1>
            <p className="text-sm text-gray-400">
              Viewing session by Host
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-green-900/30 text-green-400 rounded-full text-sm font-medium">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              LIVE
            </div>

            <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
              Exit
            </Button>
          </div>
        </div>
      </div>

      {/* Video Player */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-6xl">
          {remoteStream ? (
            <div className="relative bg-black rounded-lg overflow-hidden shadow-2xl">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-auto"
              />

              {/* Stream Info Overlay */}
              <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-lg text-white">
                <p className="text-sm font-medium">
                  Session: {currentSession?.title}
                </p>
              </div>
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg p-12 text-center">
              <div className="mb-4">
                <svg className="w-16 h-16 text-gray-600 mx-auto animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2">
                Waiting for stream...
              </h3>
              <p className="text-gray-400">
                The host hasn't started broadcasting yet
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Session Info Panel */}
      <div className="bg-gray-800 border-t border-gray-700 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-400 mb-1">Session ID</p>
              <p className="text-white font-mono text-sm">{sessionId.substring(0, 20)}...</p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Status</p>
              <p className="text-white">
                {remoteStream ? 'Streaming' : 'Waiting'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-400 mb-1">Mode</p>
              <p className="text-white">Viewer (Read-only)</p>
            </div>
          </div>

          {/* Component State Display */}
          {sessionState && sessionState.components.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-gray-400 mb-3">Active Components</h3>
              <div className="flex flex-wrap gap-2">
                {sessionState.components.map((comp) => (
                  <div
                    key={comp.id}
                    className="px-3 py-1 bg-gray-700 text-gray-300 rounded-full text-sm"
                  >
                    {comp.type}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
