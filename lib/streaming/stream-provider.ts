import { IStreamProvider, SessionState } from '@/types';

/**
 * Abstract base class for stream providers
 * Allows switching between WebRTC and AWS IVS implementations
 */
export abstract class StreamProvider implements IStreamProvider {
  protected sessionId: string = '';
  protected mediaCallback: ((stream: MediaStream) => void) | null = null;
  protected stateCallback: ((state: SessionState) => void) | null = null;

  // Host methods
  abstract initializeHost(sessionId: string): Promise<void>;
  abstract publishMedia(stream: MediaStream): Promise<void>;
  abstract publishState(state: SessionState): Promise<void>;
  abstract endSession(): Promise<void>;

  // Viewer methods
  abstract joinSession(sessionId: string): Promise<void>;
  abstract subscribeToMedia(callback: (stream: MediaStream) => void): void;
  abstract subscribeToState(callback: (state: SessionState) => void): void;
  abstract leaveSession(): Promise<void>;
}
