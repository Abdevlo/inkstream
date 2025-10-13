// User and Authentication Types
export interface User {
  id: string;
  email: string;
  username: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// Session Types
export interface StreamSession {
  sessionId: string;
  hostId: string;
  createdAt: number;
  status: 'active' | 'ended';
  title: string;
  viewerCount?: number;
}

export interface SessionState {
  sessionId: string;
  timestamp: number;
  components: ComponentTile[];
  canvasData: any[]; // Excalidraw elements
}

// Component Tile Types
export type ComponentType = 'webcam' | 'code' | 'pptx' | 'screenshare' | 'clock';

export interface ComponentTile {
  id: string;
  type: ComponentType;
  position: {
    x: number;
    y: number;
  };
  size: {
    width: number;
    height: number;
  };
  isVisible: boolean;
  data?: any; // Component-specific data
}

// Webcam Component
export interface WebcamData {
  isActive: boolean;
  stream?: MediaStream;
}

// Code Compiler Component
export type CodeLanguage = 'python' | 'java' | 'cpp' | 'csharp';

export interface CodeData {
  language: CodeLanguage;
  code: string;
  output: string;
  isRunning: boolean;
}

export interface CodeExecutionRequest {
  language: CodeLanguage;
  code: string;
}

export interface CodeExecutionResponse {
  stdout: string;
  stderr: string;
  error?: string;
  executionTime: number;
}

// PPTX Viewer Component
export interface PPTXData {
  fileName: string;
  currentSlide: number;
  totalSlides: number;
  slides: string[]; // Base64 encoded images
}

// Screen Share Component
export interface ScreenShareData {
  isActive: boolean;
  stream?: MediaStream;
}

// Clock Component
export interface ClockData {
  mode: 'clock' | 'stopwatch' | 'timer';
  stopwatch: {
    isRunning: boolean;
    elapsedTime: number;
  };
  timer: {
    duration: number;
    remainingTime: number;
    isRunning: boolean;
  };
}

// Stream Provider Interface
export interface IStreamProvider {
  // Host methods
  initializeHost(sessionId: string): Promise<void>;
  publishMedia(stream: MediaStream): Promise<void>;
  publishState(state: SessionState): Promise<void>;
  endSession(): Promise<void>;

  // Viewer methods
  joinSession(sessionId: string): Promise<void>;
  subscribeToMedia(callback: (stream: MediaStream) => void): void;
  subscribeToState(callback: (state: SessionState) => void): void;
  leaveSession(): Promise<void>;
}

// WebSocket Message Types
export interface WSMessage {
  type: 'connect' | 'disconnect' | 'publishState' | 'signal' | 'viewerJoined' | 'viewerLeft';
  sessionId: string;
  data?: any;
}

export interface SignalingData {
  type: 'offer' | 'answer' | 'ice-candidate';
  from: string;
  to: string;
  sessionId: string;
  data: any;
}

// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// DynamoDB Types
export interface SessionRecord {
  sessionId: string;
  hostId: string;
  createdAt: number;
  status: 'active' | 'ended';
  title: string;
}

export interface StateRecord {
  sessionId: string;
  timestamp: number;
  state: {
    components: ComponentTile[];
    canvasData: any[];
  };
}
