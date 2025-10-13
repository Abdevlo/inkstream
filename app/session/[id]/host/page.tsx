'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProtectedRoute } from '@/hooks/use-auth';
import { Loading } from '@/components/ui/loading';
import { Button } from '@/components/ui/button';
import { useSessionStore } from '@/store/session-store';
import { createStreamProvider } from '@/lib/streaming/webrtc-provider';
import { getSession, updateSessionStatus, saveSessionState } from '@/lib/aws/dynamodb';
import { generateSessionLink, copyToClipboard } from '@/lib/utils/session-helpers';
import toast from 'react-hot-toast';
import { WebcamTile } from '@/components/tiles/webcam-tile';
import { CodeTile } from '@/components/tiles/code-tile';
import { PPTXTile } from '@/components/tiles/pptx-tile';
import { ScreenShareTile } from '@/components/tiles/screenshare-tile';
import { ClockTile } from '@/components/tiles/clock-tile';
import { ComponentType } from '@/types';

export default function HostSessionPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useProtectedRoute();
  const sessionId = params.id as string;

  const {
    currentSession,
    isStreaming,
    components,
    setCurrentSession,
    setIsHost,
    setStreaming,
    addComponent,
    updateComponent,
    removeComponent,
  } = useSessionStore();

  const [isInitializing, setIsInitializing] = useState(true);
  const [canvasStream, setCanvasStream] = useState<MediaStream | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const streamProvider = useRef(createStreamProvider('webrtc'));

  useEffect(() => {
    if (user && sessionId) {
      initializeSession();
    }

    return () => {
      cleanup();
    };
  }, [user, sessionId]);

  const initializeSession = async () => {
    try {
      // Get session from DB
      const result = await getSession(sessionId);

      if (!result.success || !result.data) {
        toast.error('Session not found');
        router.push('/dashboard');
        return;
      }

      // Verify user is the host
      if (result.data.hostId !== user?.id) {
        toast.error('You are not the host of this session');
        router.push('/dashboard');
        return;
      }

      setCurrentSession(result.data as any);
      setIsHost(true);

      // Initialize stream provider
      await streamProvider.current.initializeHost(sessionId);

      setIsInitializing(false);
    } catch (error) {
      console.error('Error initializing session:', error);
      toast.error('Failed to initialize session');
      router.push('/dashboard');
    }
  };

  const cleanup = async () => {
    if (isStreaming) {
      await stopBroadcast();
    }
  };

  const startBroadcast = async () => {
    try {
      // Capture canvas as stream
      if (!canvasRef.current) {
        toast.error('Canvas not ready');
        return;
      }

      // For demo, we'll use a placeholder stream
      // In production, use canvas.captureStream() from Excalidraw canvas
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setCanvasStream(stream);

      await streamProvider.current.publishMedia(stream);

      // Update session status
      await updateSessionStatus(sessionId, 'active');

      setStreaming(true);
      toast.success('Broadcasting started!');
    } catch (error) {
      console.error('Error starting broadcast:', error);
      toast.error('Failed to start broadcast');
    }
  };

  const stopBroadcast = async () => {
    try {
      if (canvasStream) {
        canvasStream.getTracks().forEach((track) => track.stop());
        setCanvasStream(null);
      }

      await streamProvider.current.endSession();
      await updateSessionStatus(sessionId, 'ended');

      setStreaming(false);
      toast.success('Broadcasting stopped');
    } catch (error) {
      console.error('Error stopping broadcast:', error);
      toast.error('Failed to stop broadcast');
    }
  };

  const handleCopyLink = async () => {
    const link = generateSessionLink(sessionId, false);
    const success = await copyToClipboard(link);
    if (success) {
      toast.success('Session link copied!');
    }
  };

  const handleAddComponent = (type: ComponentType) => {
    const newComponent = {
      id: `${type}-${Date.now()}`,
      type,
      position: { x: 100 + components.length * 50, y: 100 + components.length * 50 },
      size: { width: 400, height: 300 },
      isVisible: true,
    };
    addComponent(newComponent);
    setShowAddMenu(false);
    toast.success(`Added ${type} component`);
  };

  const handleEndSession = async () => {
    if (confirm('Are you sure you want to end this session?')) {
      await stopBroadcast();
      router.push('/dashboard');
    }
  };

  if (authLoading || isInitializing) {
    return <Loading />;
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              Host Session: {currentSession?.title}
            </h1>
            <p className="text-sm text-gray-600">ID: {sessionId}</p>
          </div>

          <div className="flex items-center gap-3">
            {isStreaming ? (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium">
                <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                LIVE
              </div>
            ) : (
              <div className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                Offline
              </div>
            )}

            <Button variant="secondary" size="sm" onClick={handleCopyLink}>
              Copy Viewer Link
            </Button>

            {!isStreaming ? (
              <Button onClick={startBroadcast} size="sm">
                Start Broadcast
              </Button>
            ) : (
              <Button onClick={stopBroadcast} variant="danger" size="sm">
                Stop Broadcast
              </Button>
            )}

            <Button variant="ghost" size="sm" onClick={handleEndSession}>
              End Session
            </Button>
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative overflow-hidden">
        <div ref={canvasRef} className="w-full h-full bg-white">
          {/* Excalidraw would go here - for demo, showing placeholder */}
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
              <p>Excalidraw Canvas Area</p>
              <p className="text-sm mt-2">Draw, add shapes, and text here</p>
            </div>
          </div>

          {/* Render component tiles */}
          {components.map((comp) => {
            switch (comp.type) {
              case 'webcam':
                return (
                  <WebcamTile
                    key={comp.id}
                    id={comp.id}
                    onClose={() => removeComponent(comp.id)}
                  />
                );
              case 'code':
                return (
                  <CodeTile
                    key={comp.id}
                    id={comp.id}
                    onClose={() => removeComponent(comp.id)}
                  />
                );
              case 'pptx':
                return (
                  <PPTXTile
                    key={comp.id}
                    id={comp.id}
                    onClose={() => removeComponent(comp.id)}
                  />
                );
              case 'screenshare':
                return (
                  <ScreenShareTile
                    key={comp.id}
                    id={comp.id}
                    onClose={() => removeComponent(comp.id)}
                  />
                );
              case 'clock':
                return (
                  <ClockTile
                    key={comp.id}
                    id={comp.id}
                    onClose={() => removeComponent(comp.id)}
                  />
                );
              default:
                return null;
            }
          })}
        </div>

        {/* Add Component Button */}
        <div className="absolute bottom-6 right-6">
          <div className="relative">
            {showAddMenu && (
              <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-lg border border-gray-200 p-2 w-48">
                <button
                  onClick={() => handleAddComponent('webcam')}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded"
                >
                  Webcam
                </button>
                <button
                  onClick={() => handleAddComponent('code')}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded"
                >
                  Code Compiler
                </button>
                <button
                  onClick={() => handleAddComponent('pptx')}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded"
                >
                  PPTX Viewer
                </button>
                <button
                  onClick={() => handleAddComponent('screenshare')}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded"
                >
                  Screen Share
                </button>
                <button
                  onClick={() => handleAddComponent('clock')}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded"
                >
                  Clock & Timer
                </button>
              </div>
            )}

            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 flex items-center justify-center"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
