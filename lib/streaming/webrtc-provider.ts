import SimplePeer from 'simple-peer';
import { StreamProvider } from './stream-provider';
import { SessionState, SignalingData } from '@/types';
import { getHybridClient } from '@/lib/hybrid/hybrid-client';

/**
 * WebRTC Stream Provider Implementation
 * Uses simple-peer for WebRTC connections and hybrid (WebSocket/polling) for real-time signaling
 */
export class WebRTCProvider extends StreamProvider {
  private peer: SimplePeer.Instance | null = null;
  private localStream: MediaStream | null = null;
  private isHost: boolean = false;
  private hybridClient = getHybridClient();
  private isConnecting: boolean = false;
  private connectionAttempts: number = 0;
  private maxConnectionAttempts: number = 3;

  /**
   * Initialize as host
   */
  async initializeHost(sessionId: string): Promise<void> {
    this.sessionId = sessionId;
    this.isHost = true;

    console.log('Host initialized for session:', sessionId);
    
    // Join hybrid client room for this session
    this.hybridClient.joinSession(sessionId);
    
    // Listen for WebRTC signals and viewer connections
    this.hybridClient.on('webrtc-signal', this.handleWebRTCSignal.bind(this));
    this.hybridClient.on('user-joined', this.handleUserJoined.bind(this));
  }

  /**
   * Publish media stream (host)
   */
  async publishMedia(stream: MediaStream): Promise<void> {
    if (!this.isHost) {
      throw new Error('Only host can publish media');
    }

    this.localStream = stream;

    // If peer already exists, add stream
    if (this.peer) {
      this.peer.addStream(stream);
    }
  }

  /**
   * Publish session state (host)
   */
  async publishState(state: SessionState): Promise<void> {
    if (!this.isHost) {
      throw new Error('Only host can publish state');
    }

    // Send real-time state update via hybrid client
    this.hybridClient.sendStateUpdate(state);
    
    // Also persist to database for reliability
    try {
      await fetch(`/api/sessions/${this.sessionId}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state }),
      });
    } catch (error) {
      console.error('Error persisting state:', error);
    }
  }

  /**
   * End session (host)
   */
  async endSession(): Promise<void> {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Leave hybrid client room
    this.hybridClient.leaveSession();

    this.cleanup();
  }

  /**
   * Join session as viewer
   */
  async joinSession(sessionId: string): Promise<void> {
    this.sessionId = sessionId;
    this.isHost = false;

    console.log('Viewer joining session:', sessionId);

    // Join hybrid client room for this session
    this.hybridClient.joinSession(sessionId);
    
    // Listen for state updates and WebRTC signals
    this.hybridClient.on('session-state-updated', (state: SessionState) => {
      if (this.stateCallback) {
        this.stateCallback(state);
      }
    });
    
    this.hybridClient.on('webrtc-signal', this.handleWebRTCSignal.bind(this));
    
    // Initialize peer connection as viewer
    this.initializePeer(false);
  }

  /**
   * Subscribe to media stream (viewer)
   */
  subscribeToMedia(callback: (stream: MediaStream) => void): void {
    this.mediaCallback = callback;
  }

  /**
   * Subscribe to state updates (viewer)
   */
  subscribeToState(callback: (state: SessionState) => void): void {
    this.stateCallback = callback;
  }

  /**
   * Leave session (viewer)
   */
  async leaveSession(): Promise<void> {
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }

    // Leave hybrid client room
    this.hybridClient.leaveSession();

    this.cleanup();
  }

  /**
   * Handle WebRTC signaling
   */
  private handleWebRTCSignal(data: { signal: any; from: string; signalType: string }): void {
    console.log('Received WebRTC signal:', data.signalType, 'from:', data.from);
    
    // Ignore signals if we're in the middle of connecting
    if (this.isConnecting) {
      console.log('Ignoring signal while connecting...');
      return;
    }

    // Handle offer for viewers
    if (!this.isHost && data.signalType === 'offer') {
      if (!this.peer || this.peer.destroyed) {
        console.log('Creating peer connection for offer');
        this.initializePeer(false);
      }
    }

    // Handle answer for hosts
    if (this.isHost && data.signalType === 'answer') {
      if (!this.peer || this.peer.destroyed) {
        console.log('No peer connection available for answer');
        return;
      }
    }

    // Process signal with safety checks
    if (this.peer && !this.peer.destroyed) {
      try {
        console.log('Processing signal:', data.signalType);
        this.peer.signal(data.signal);
      } catch (error) {
        console.error('Error processing WebRTC signal:', error);
        this.handleConnectionError();
      }
    }
  }

  /**
   * Handle user joined (for host)
   */
  private handleUserJoined(data: { userId: string }): void {
    if (!this.isHost) return;

    console.log('User joined, checking peer connection for:', data.userId);
    
    // Only create peer if we don't have one or it's destroyed
    if (!this.peer || this.peer.destroyed) {
      console.log('Creating new peer connection for user:', data.userId);
      this.initializePeer(true);
    } else {
      console.log('Peer connection already exists, not creating new one');
    }
  }

  /**
   * Handle connection errors
   */
  private handleConnectionError(): void {
    this.connectionAttempts++;
    console.log(`Connection attempt ${this.connectionAttempts}/${this.maxConnectionAttempts} failed`);
    
    if (this.connectionAttempts < this.maxConnectionAttempts) {
      // Clean up current peer and retry
      if (this.peer) {
        this.peer.destroy();
        this.peer = null;
      }
      
      setTimeout(() => {
        if (this.isHost) {
          this.initializePeer(true);
        }
      }, 2000);
    } else {
      console.error('Max connection attempts reached, giving up');
      this.connectionAttempts = 0;
    }
  }

  /**
   * Initialize WebRTC peer connection
   */
  private initializePeer(isInitiator: boolean): void {
    // Prevent multiple peer creation
    if (this.isConnecting) {
      console.log('Already connecting, skipping peer creation');
      return;
    }

    // Clean up existing peer
    if (this.peer && !this.peer.destroyed) {
      console.log('Cleaning up existing peer');
      this.peer.destroy();
    }

    this.isConnecting = true;
    console.log(`Initializing ${isInitiator ? 'host' : 'viewer'} peer connection`);

    const config: SimplePeer.Options = {
      initiator: isInitiator,
      trickle: true,
      stream: this.localStream || undefined,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      },
    };

    this.peer = new SimplePeer(config);

    // Handle peer events
    this.peer.on('signal', (data) => {
      const signalType = data.type === 'offer' ? 'offer' : 
                        data.type === 'answer' ? 'answer' : 'ice-candidate';
      
      console.log('Sending WebRTC signal:', signalType);
      this.hybridClient.sendWebRTCSignal(data, signalType);
    });

    this.peer.on('connect', () => {
      console.log('✅ Peer connected successfully');
      this.isConnecting = false;
      this.connectionAttempts = 0;
    });

    this.peer.on('stream', (stream: MediaStream) => {
      console.log('📹 Received remote stream');
      this.isConnecting = false;
      if (this.mediaCallback) {
        this.mediaCallback(stream);
      }
    });

    this.peer.on('error', (err) => {
      console.error('❌ Peer error:', err);
      this.isConnecting = false;
      this.handleConnectionError();
    });

    this.peer.on('close', () => {
      console.log('🔴 Peer connection closed');
      this.isConnecting = false;
    });
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    // Remove hybrid client event listeners
    this.hybridClient.off('webrtc-signal', this.handleWebRTCSignal.bind(this));
    this.hybridClient.off('user-joined', this.handleUserJoined.bind(this));
    this.hybridClient.off('session-state-updated', () => {});
    
    // Reset connection state
    this.isConnecting = false;
    this.connectionAttempts = 0;
    
    this.mediaCallback = null;
    this.stateCallback = null;
  }
}

/**
 * Factory function to create stream provider
 * Can be extended to support different providers (WebRTC, IVS, etc.)
 */
export function createStreamProvider(type: 'webrtc' | 'ivs' = 'webrtc'): StreamProvider {
  switch (type) {
    case 'webrtc':
      return new WebRTCProvider();
    case 'ivs':
      // TODO: Implement IVS provider
      throw new Error('IVS provider not implemented yet');
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}
