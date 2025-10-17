'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProtectedRoute } from '@/hooks/use-auth';
import { Loading } from '@/components/ui/loading';
import { Button } from '@/components/ui/button';
import { useSessionStore } from '@/store/session-store';
import { createStreamProvider } from '@/lib/streaming/webrtc-provider';
// Removed direct DynamoDB imports - now using API routes
import { generateSessionLink, copyToClipboard } from '@/lib/utils/session-helpers';
import toast from 'react-hot-toast';
import { WebcamTile } from '@/components/tiles/webcam-tile';
import { CodeTile } from '@/components/tiles/code-tile';
import { PPTXTile } from '@/components/tiles/pptx-tile';
import { ScreenShareTile } from '@/components/tiles/screenshare-tile';
import { ClockTile } from '@/components/tiles/clock-tile';
import { LiveCursors } from '@/components/LiveCursors';
import { LiveChat } from '@/components/LiveChat';
import { CollaborativeCanvas } from '@/components/CollaborativeCanvas';
import { ElementViewer } from '@/components/ElementViewer';
import { ResizableCard } from '@/components/ResizableCard';
import { ComponentType } from '@/types';
import { 
  Video, 
  Monitor, 
  Square, 
  MessageSquare, 
  Plus, 
  Link, 
  LogOut,
  Layers,
  Play,
  Pause,
  User,
  Bot,
  Calculator,
  Palette,
  Settings,
  Globe,
  Clock,
  Calendar,
  BarChart3,
  Clipboard,
  Image,
  Camera,
  Mic,
  Code
} from 'lucide-react';

export default function HostSessionPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useProtectedRoute();
  const sessionId = params?.id as string;

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
  const [showElementViewer, setShowElementViewer] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [streamType, setStreamType] = useState<'camera' | 'screen' | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [canvasComponents, setCanvasComponents] = useState<any[]>([]);
  const canvasRef = useRef<HTMLDivElement>(null);
  const streamProvider = useRef<any>(null);

  useEffect(() => {
    if (user && sessionId) {
      initializeSession();
    } else if (!sessionId) {
      router.push('/dashboard');
    }

    return () => {
      cleanup();
    };
  }, [user, sessionId, router]);

  const initializeSession = async () => {
    try {
      // Initialize stream provider on client side
      if (!streamProvider.current) {
        streamProvider.current = createStreamProvider('webrtc');
      }

      // Get session from API
      const response = await fetch(`/api/sessions/${sessionId}`);
      const result = await response.json();
    console.log('Debugger_14_Oct ---> \n Author_Abdallah ---> \n initializeSession:', result);

      if (!response.ok || !result.success || !result.data) {
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
    console.log('Debugger_14_Oct ---> \n Author_Abdallah ---> \n setCurrentSession & setIsHost:', true);

      // Initialize stream provider
      await streamProvider.current.initializeHost(sessionId);

      setIsInitializing(false);
          console.log('Debugger_14_Oct ---> \n Author_Abdallah ---> \n setIsInitializing:', false);

    } catch (error) {
      console.error('Error initializing session:', error);
      toast.error('Failed to initialize session');
      router.push('/dashboard');
    }
  };

  const cleanup = async () => {
    if (isStreaming && streamProvider.current) {
      await stopBroadcast();
    }
  };

  const startCanvasBroadcast = async () => {
    try {
      if (!canvasRef.current) {
        toast.error('Canvas not ready');
        return;
      }

      // Get the canvas element from the CollaborativeCanvas component
      const canvasElement = canvasRef.current.querySelector('canvas:last-child') as HTMLCanvasElement;
      if (!canvasElement) {
        toast.error('Canvas element not found');
        return;
      }

      toast.loading('Starting canvas broadcast...', { id: 'permissions' });

      // Capture canvas stream
      const canvasStream = canvasElement.captureStream(30); // 30 FPS

      // Optionally add audio from microphone
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTracks = audioStream.getAudioTracks();
        audioTracks.forEach(track => canvasStream.addTrack(track));
      } catch (audioError) {
        console.log('No audio added to canvas stream:', audioError);
        toast('Canvas streaming without audio', { id: 'permissions' });
      }
      
      toast.success('Canvas broadcast started!', { id: 'permissions' });
      
      setCanvasStream(canvasStream);
      setStreamType('camera');
      await publishStream(canvasStream);
    } catch (error: any) {
      toast.dismiss('permissions');
      handleBroadcastError(error, 'camera');
    }
  };

  const startScreenBroadcast = async () => {
    try {
      if (!canvasRef.current) {
        toast.error('Canvas not ready');
        return;
      }

      toast.loading('Requesting screen sharing access...', { id: 'permissions' });

      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { width: 1920, height: 1080 }, 
        audio: true 
      });
      
      toast.success('Screen sharing access granted!', { id: 'permissions' });
      
      setCanvasStream(stream);
      setStreamType('screen');
      await publishStream(stream);
    } catch (error: any) {
      toast.dismiss('permissions');
      handleBroadcastError(error, 'screen');
    }
  };

  const publishStream = async (stream: MediaStream) => {
    if (streamProvider.current) {
      await streamProvider.current.publishMedia(stream);
    }

    await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });

    setStreaming(true);
    toast.success('Broadcasting started! Viewers can now see your stream.');
  };

  const handleBroadcastError = (error: any, type: 'camera' | 'screen') => {
    console.error(`Error starting ${type} broadcast:`, error);
    
    if (error.name === 'NotAllowedError') {
      toast.error(`${type === 'camera' ? 'Camera/microphone' : 'Screen sharing'} access denied. Click "Allow" when prompted.`);
    } else if (error.name === 'NotFoundError') {
      toast.error(`No ${type === 'camera' ? 'camera or microphone' : 'screen'} found.`);
    } else if (error.name === 'NotReadableError') {
      toast.error(`${type === 'camera' ? 'Camera/microphone' : 'Screen'} is being used by another application.`);
    } else {
      toast.error(`Failed to start ${type} broadcast: ${error.message || 'Unknown error'}`);
    }
  };

  const stopBroadcast = async () => {
    try {
      if (canvasStream) {
        canvasStream.getTracks().forEach((track) => track.stop());
        setCanvasStream(null);
      }

      if (streamProvider.current) {
        await streamProvider.current.endSession();
      }

      // Update session status via API
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ended' }),
      });

      setStreaming(false);
      setStreamType(null);
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
    
    // Broadcast updated components to viewers
    if (streamProvider.current) {
      streamProvider.current.publishState({
        components: [...components, newComponent],
        timestamp: Date.now()
      });
    }
  };

  const handleElementSelect = (elementType: string) => {
    const newCanvasComponent = {
      id: `canvas-${elementType}-${Date.now()}`,
      type: elementType,
      position: { x: 200 + canvasComponents.length * 30, y: 150 + canvasComponents.length * 30 },
      size: { width: 300, height: 200 },
      title: elementType.charAt(0).toUpperCase() + elementType.slice(1)
    };
    
    setCanvasComponents(prev => [...prev, newCanvasComponent]);
    setShowElementViewer(false);
    toast.success(`Added ${elementType} to canvas`);
  };

  const handleRemoveCanvasComponent = (id: string) => {
    setCanvasComponents(prev => prev.filter(comp => comp.id !== id));
  };

  const handlePositionChange = (id: string, position: { x: number; y: number }) => {
    setCanvasComponents(prev => 
      prev.map(comp => 
        comp.id === id ? { ...comp, position } : comp
      )
    );
  };

  const handleSizeChange = (id: string, size: { width: number; height: number }) => {
    setCanvasComponents(prev => 
      prev.map(comp => 
        comp.id === id ? { ...comp, size } : comp
      )
    );
  };

  const handleRemoveComponent = (componentId: string) => {
    removeComponent(componentId);
    
    // Broadcast updated components to viewers
    if (streamProvider.current) {
      const updatedComponents = components.filter(c => c.id !== componentId);
      streamProvider.current.publishState({
        components: updatedComponents,
        timestamp: Date.now()
      });
    }
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
    <div className="h-screen relative bg-gray-900">
      {/* Session Info - Top Left */}
      <div className="absolute top-4 left-4 z-30">
        <div className="bg-black/50 backdrop-blur-md rounded-xl p-3 text-white">
          <h1 className="text-lg font-semibold">
            {currentSession?.title}
          </h1>
          <p className="text-xs text-gray-300">ID: {sessionId?.substring(0, 8)}...</p>
          <div className="flex items-center gap-2 mt-2">
            {isStreaming ? (
              <div className="flex items-center gap-2 px-2 py-1 bg-red-500/20 text-red-300 rounded-lg text-xs font-medium">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                LIVE
              </div>
            ) : (
              <div className="px-2 py-1 bg-gray-500/20 text-gray-300 rounded-lg text-xs font-medium">
                Offline
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Canvas Area - Full Screen */}
      <div className="absolute inset-0">
        <div ref={canvasRef} className="w-full h-full">
          <CollaborativeCanvas
            sessionId={sessionId}
            userId={user?.id}
            isHost={true}
            isDarkMode={isDarkMode}
            onToggleDarkMode={() => setIsDarkMode(!isDarkMode)}
          />
        </div>

        {/* Canvas Components */}
        {canvasComponents.map((comp) => (
          <ResizableCard
            key={comp.id}
            id={comp.id}
            title={comp.title}
            initialPosition={comp.position}
            initialSize={comp.size}
            onClose={() => handleRemoveCanvasComponent(comp.id)}
            onPositionChange={(position) => handlePositionChange(comp.id, position)}
            onSizeChange={(size) => handleSizeChange(comp.id, size)}
            isDarkMode={isDarkMode}
          >
            {/* Media Components */}
            {comp.type === 'webcam' && (
              <div className="w-full h-full bg-gray-900 rounded-lg flex items-center justify-center">
                <div className="text-white text-center">
                  <Video size={48} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Webcam Feed</p>
                  <p className="text-xs opacity-70">Camera access required</p>
                </div>
              </div>
            )}
            
            {comp.type === 'image' && (
              <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
                <div className="text-gray-500 text-center">
                  <Image size={32} className="mx-auto mb-2" />
                  <p className="text-sm">Drop image here</p>
                  <p className="text-xs">Drag & drop or click to upload</p>
                </div>
              </div>
            )}

            {/* Development Components */}
            {comp.type === 'code' && (
              <div className="w-full h-full bg-gray-900 rounded-lg p-4 font-mono text-sm overflow-auto">
                <div className="text-gray-400 mb-2"># JavaScript Code Editor</div>
                <div className="text-blue-400">function</div>
                <div className="text-yellow-400 ml-2">calculateSum</div>
                <div className="text-white">(a, b) {`{`}</div>
                <div className="text-green-400 ml-4">return a + b;</div>
                <div className="text-white">{`}`}</div>
                <div className="mt-4 text-gray-500 text-xs">Live code execution ready</div>
              </div>
            )}

            {comp.type === 'terminal' && (
              <div className="w-full h-full bg-black rounded-lg p-4 font-mono text-green-400 text-sm">
                <div className="text-green-500">user@canvas:~$ ls -la</div>
                <div className="text-white text-xs mt-1">total 42</div>
                <div className="text-white text-xs">drwxr-xr-x 5 user user 4096 Oct 16 16:30 .</div>
                <div className="text-white text-xs">drwxr-xr-x 3 user user 4096 Oct 16 16:30 ..</div>
                <div className="text-green-500 mt-2">user@canvas:~$ _</div>
              </div>
            )}

            {/* Productivity Components */}
            {comp.type === 'profile' && (
              <div className="w-full h-full bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg p-4">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-500 rounded-full mx-auto mb-3 flex items-center justify-center">
                    <User size={32} className="text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900">John Doe</h3>
                  <p className="text-sm text-gray-600">Product Designer</p>
                  <p className="text-xs text-gray-500 mt-2">@johndoe</p>
                  <div className="mt-3 flex justify-center gap-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">Designer</span>
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Available</span>
                  </div>
                </div>
              </div>
            )}

            {comp.type === 'chatbot' && (
              <div className="w-full h-full bg-white rounded-lg p-4 flex flex-col">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                  <Bot size={20} className="text-blue-500" />
                  <span className="font-medium text-sm">AI Assistant</span>
                  <div className="w-2 h-2 bg-green-500 rounded-full ml-auto"></div>
                </div>
                <div className="flex-1 space-y-2 text-xs">
                  <div className="bg-gray-100 rounded-lg p-2">
                    <p>Hello! How can I help you today?</p>
                  </div>
                  <div className="bg-blue-500 text-white rounded-lg p-2 ml-4">
                    <p>Can you help me with my project?</p>
                  </div>
                  <div className="bg-gray-100 rounded-lg p-2">
                    <p>Of course! I'd be happy to assist you. What kind of project are you working on?</p>
                  </div>
                </div>
                <div className="mt-2 flex gap-1">
                  <input 
                    type="text" 
                    placeholder="Type a message..." 
                    className="flex-1 text-xs p-2 border rounded"
                    disabled 
                  />
                  <button className="px-3 py-1 bg-blue-500 text-white rounded text-xs">Send</button>
                </div>
              </div>
            )}

            {comp.type === 'notes' && (
              <div className="w-full h-full bg-yellow-100 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clipboard size={16} className="text-yellow-600" />
                  <span className="text-sm font-medium text-yellow-800">Quick Notes</span>
                </div>
                <div className="space-y-2 text-sm text-yellow-800">
                  <div className="p-2 bg-yellow-200 rounded">• Review design mockups</div>
                  <div className="p-2 bg-yellow-200 rounded">• Call client at 3pm</div>
                  <div className="p-2 bg-yellow-200 rounded">• Update project timeline</div>
                </div>
                <textarea 
                  placeholder="Add new note..." 
                  className="w-full mt-3 p-2 bg-yellow-50 border border-yellow-300 rounded text-xs"
                  rows={2}
                />
              </div>
            )}

            {comp.type === 'calculator' && (
              <div className="w-full h-full bg-gray-800 rounded-lg p-4">
                <div className="bg-black rounded p-3 mb-3 text-right text-white font-mono">
                  <div className="text-lg">1,234.56</div>
                </div>
                <div className="grid grid-cols-4 gap-1 text-xs">
                  {['C', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+'].map((btn) => (
                    <button key={btn} className="bg-gray-600 hover:bg-gray-500 text-white p-2 rounded">
                      {btn}
                    </button>
                  ))}
                  <button className="bg-gray-600 hover:bg-gray-500 text-white p-2 rounded col-span-2">0</button>
                  <button className="bg-gray-600 hover:bg-gray-500 text-white p-2 rounded">.</button>
                  <button className="bg-orange-500 hover:bg-orange-400 text-white p-2 rounded">=</button>
                </div>
              </div>
            )}

            {comp.type === 'calendar' && (
              <div className="w-full h-full bg-white rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium text-sm">October 2025</span>
                  <Calendar size={16} className="text-blue-500" />
                </div>
                <div className="grid grid-cols-7 gap-1 text-xs">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                    <div key={day} className="p-1 text-center text-gray-500 font-medium">{day}</div>
                  ))}
                  {Array.from({length: 31}, (_, i) => (
                    <div key={i} className={`p-1 text-center hover:bg-blue-100 rounded ${
                      i === 15 ? 'bg-blue-500 text-white' : ''
                    }`}>
                      {i + 1}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {comp.type === 'colorpicker' && (
              <div className="w-full h-full bg-white rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Palette size={16} className="text-purple-500" />
                  <span className="text-sm font-medium">Color Picker</span>
                </div>
                <div className="space-y-3">
                  <div className="w-full h-20 bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 rounded"></div>
                  <div className="grid grid-cols-8 gap-1">
                    {['#FF0000', '#FF8800', '#FFFF00', '#88FF00', '#00FF00', '#00FF88', '#00FFFF', '#0088FF'].map(color => (
                      <div key={color} className="w-6 h-6 rounded border" style={{backgroundColor: color}}></div>
                    ))}
                  </div>
                  <div className="text-xs text-gray-600">Selected: #3B82F6</div>
                </div>
              </div>
            )}

            {comp.type === 'chart' && (
              <div className="w-full h-full bg-white rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium">Analytics</span>
                  <BarChart3 size={16} className="text-green-500" />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span>Users</span>
                    <span className="font-medium">1,234</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded h-2">
                    <div className="bg-blue-500 h-2 rounded" style={{width: '75%'}}></div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Sessions</span>
                    <span className="font-medium">856</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded h-2">
                    <div className="bg-green-500 h-2 rounded" style={{width: '60%'}}></div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span>Conversion</span>
                    <span className="font-medium">23.4%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded h-2">
                    <div className="bg-purple-500 h-2 rounded" style={{width: '23%'}}></div>
                  </div>
                </div>
              </div>
            )}

            {/* Default fallback */}
            {!['webcam', 'code', 'image', 'terminal', 'profile', 'chatbot', 'notes', 'calculator', 'calendar', 'colorpicker', 'chart'].includes(comp.type) && (
              <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
                <div className="text-gray-500 text-center">
                  <Square size={32} className="mx-auto mb-2" />
                  <p className="text-sm capitalize">{comp.type}</p>
                  <p className="text-xs">Component placeholder</p>
                </div>
              </div>
            )}
          </ResizableCard>
        ))}

        {/* Render component tiles as overlays */}
        {components.map((comp) => {
            switch (comp.type) {
              case 'webcam':
                return (
                  <WebcamTile
                    key={comp.id}
                    id={comp.id}
                    onClose={() => handleRemoveComponent(comp.id)}
                  />
                );
              case 'code':
                return (
                  <CodeTile
                    key={comp.id}
                    id={comp.id}
                    onClose={() => handleRemoveComponent(comp.id)}
                  />
                );
              case 'pptx':
                return (
                  <PPTXTile
                    key={comp.id}
                    id={comp.id}
                    onClose={() => handleRemoveComponent(comp.id)}
                  />
                );
              case 'screenshare':
                return (
                  <ScreenShareTile
                    key={comp.id}
                    id={comp.id}
                    onClose={() => handleRemoveComponent(comp.id)}
                  />
                );
              case 'clock':
                return (
                  <ClockTile
                    key={comp.id}
                    id={comp.id}
                    onClose={() => handleRemoveComponent(comp.id)}
                  />
                );
              default:
                return null;
            }
          })}
        </div>

      {/* Bottom Dock - Google Meet Style */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30">
        <div className="bg-black/70 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-gray-700">
          <div className="flex items-center gap-4">
            {/* Broadcast Controls */}
            {!isStreaming ? (
              <>
                <button
                  onClick={startCanvasBroadcast}
                  className="w-12 h-12 bg-blue-600 hover:bg-blue-700 rounded-xl flex items-center justify-center text-white transition-all duration-200 hover:scale-105 shadow-lg"
                  title="Start Canvas Broadcast"
                >
                  <Video size={20} />
                </button>
                <button
                  onClick={startScreenBroadcast}
                  className="w-12 h-12 bg-gray-600 hover:bg-gray-700 rounded-xl flex items-center justify-center text-white transition-all duration-200 hover:scale-105 shadow-lg"
                  title="Start Screen Share"
                >
                  <Monitor size={20} />
                </button>
              </>
            ) : (
              <button
                onClick={stopBroadcast}
                className="w-12 h-12 bg-red-600 hover:bg-red-700 rounded-xl flex items-center justify-center text-white transition-all duration-200 hover:scale-105 shadow-lg"
                title="Stop Broadcast"
              >
                <Pause size={20} />
              </button>
            )}

            <div className="w-px h-8 bg-gray-600" />

            {/* Chat Toggle */}
            <button
              onClick={() => setShowChat(!showChat)}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-lg ${
                showChat
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-600 hover:bg-gray-700 text-white'
              }`}
              title="Toggle Chat"
            >
              <MessageSquare size={20} />
            </button>

            {/* Element Viewer Toggle */}
            <button
              onClick={() => setShowElementViewer(!showElementViewer)}
              className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-lg ${
                showElementViewer
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-gray-600 hover:bg-gray-700 text-white'
              }`}
              title="Add Elements"
            >
              <Layers size={20} />
            </button>

            {/* Add Component Menu */}
            <div className="relative">
              {showAddMenu && (
                <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-md rounded-xl p-2 w-48 border border-gray-700">
                  <button
                    onClick={() => handleAddComponent('webcam')}
                    className="w-full text-left px-4 py-2 hover:bg-gray-700 rounded-lg text-white text-sm"
                  >
                    📹 Webcam
                  </button>
                  <button
                    onClick={() => handleAddComponent('code')}
                    className="w-full text-left px-4 py-2 hover:bg-gray-700 rounded-lg text-white text-sm"
                  >
                    💻 Code Compiler
                  </button>
                  <button
                    onClick={() => handleAddComponent('pptx')}
                    className="w-full text-left px-4 py-2 hover:bg-gray-700 rounded-lg text-white text-sm"
                  >
                    📊 PPTX Viewer
                  </button>
                  <button
                    onClick={() => handleAddComponent('screenshare')}
                    className="w-full text-left px-4 py-2 hover:bg-gray-700 rounded-lg text-white text-sm"
                  >
                    🖥️ Screen Share
                  </button>
                  <button
                    onClick={() => handleAddComponent('clock')}
                    className="w-full text-left px-4 py-2 hover:bg-gray-700 rounded-lg text-white text-sm"
                  >
                    🕐 Clock & Timer
                  </button>
                </div>
              )}

              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="w-12 h-12 bg-green-600 hover:bg-green-700 rounded-xl flex items-center justify-center text-white transition-all duration-200 hover:scale-105 shadow-lg"
                title="Add Component"
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="w-px h-8 bg-gray-600" />

            {/* Copy Link */}
            <button
              onClick={handleCopyLink}
              className="w-12 h-12 bg-gray-600 hover:bg-gray-700 rounded-xl flex items-center justify-center text-white transition-all duration-200 hover:scale-105 shadow-lg"
              title="Copy Viewer Link"
            >
              <Link size={20} />
            </button>

            {/* End Session */}
            <button
              onClick={handleEndSession}
              className="w-12 h-12 bg-red-600 hover:bg-red-700 rounded-xl flex items-center justify-center text-white transition-all duration-200 hover:scale-105 shadow-lg"
              title="End Session"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Element Viewer */}
      <ElementViewer
        isOpen={showElementViewer}
        onClose={() => setShowElementViewer(false)}
        onElementSelect={handleElementSelect}
        isDarkMode={isDarkMode}
      />
      
      {/* Live Features */}
      <LiveCursors sessionId={sessionId} userId={user?.id} />
      <LiveChat 
        sessionId={sessionId} 
        userId={user?.id} 
        userName={user?.email} 
        isVisible={showChat}
        onToggle={() => setShowChat(!showChat)}
      />
    </div>
  );
}
