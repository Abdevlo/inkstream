import SimplePeer from 'simple-peer';
import { StreamProvider } from './stream-provider';
import { SessionState, SignalingData } from '@/types';
import { getWebSocketClient } from '@/lib/aws/websocket';

/**
 * WebRTC Stream Provider Implementation
 * Uses simple-peer for WebRTC connections and WebSocket for signaling
 */
export class WebRTCProvider extends StreamProvider {
  private peer: SimplePeer.Instance | null = null;
  private wsClient = getWebSocketClient();
  private localStream: MediaStream | null = null;
  private isHost: boolean = false;

  /**
   * Initialize as host
   */
  async initializeHost(sessionId: string): Promise<void> {
    this.sessionId = sessionId;
    this.isHost = true;

    // Connect to WebSocket for signaling
    if (!this.wsClient.isConnected()) {
      await this.wsClient.connect();
    }

    // Join session room
    this.wsClient.send({
      type: 'connect',
      sessionId,
      data: { role: 'host' },
    });

    // Listen for viewer connections
    this.wsClient.on('signal', this.handleSignal.bind(this));
    this.wsClient.on('viewerJoined', this.handleViewerJoined.bind(this));
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

    this.wsClient.send({
      type: 'publishState',
      sessionId: this.sessionId,
      data: state,
    });
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

    this.wsClient.send({
      type: 'disconnect',
      sessionId: this.sessionId,
      data: { role: 'host' },
    });

    this.cleanup();
  }

  /**
   * Join session as viewer
   */
  async joinSession(sessionId: string): Promise<void> {
    this.sessionId = sessionId;
    this.isHost = false;

    // Connect to WebSocket for signaling
    if (!this.wsClient.isConnected()) {
      await this.wsClient.connect();
    }

    // Join session room
    this.wsClient.send({
      type: 'connect',
      sessionId,
      data: { role: 'viewer' },
    });

    // Initialize peer connection as viewer
    this.initializePeer(false);

    // Listen for signals and state updates
    this.wsClient.on('signal', this.handleSignal.bind(this));
    this.wsClient.on('publishState', (state: SessionState) => {
      if (this.stateCallback) {
        this.stateCallback(state);
      }
    });
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

    this.wsClient.send({
      type: 'disconnect',
      sessionId: this.sessionId,
      data: { role: 'viewer' },
    });

    this.cleanup();
  }

  /**
   * Initialize WebRTC peer connection
   */
  private initializePeer(isInitiator: boolean): void {
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
      // Send signal through WebSocket
      const signalData: SignalingData = {
        type: data.type === 'offer' ? 'offer' : data.type === 'answer' ? 'answer' : 'ice-candidate',
        from: this.isHost ? 'host' : 'viewer',
        to: this.isHost ? 'viewer' : 'host',
        sessionId: this.sessionId,
        data,
      };

      this.wsClient.send({
        type: 'signal',
        sessionId: this.sessionId,
        data: signalData,
      });
    });

    this.peer.on('stream', (stream: MediaStream) => {
      console.log('Received remote stream');
      if (this.mediaCallback) {
        this.mediaCallback(stream);
      }
    });

    this.peer.on('error', (err) => {
      console.error('Peer error:', err);
    });

    this.peer.on('close', () => {
      console.log('Peer connection closed');
    });
  }

  /**
   * Handle viewer joined event (host only)
   */
  private handleViewerJoined(data: any): void {
    if (!this.isHost) return;

    console.log('Viewer joined, creating peer connection');
    this.initializePeer(true);
  }

  /**
   * Handle signaling data
   */
  private handleSignal(signalData: SignalingData): void {
    if (!this.peer) {
      // If viewer and no peer exists, create one
      if (!this.isHost && signalData.type === 'offer') {
        this.initializePeer(false);
      } else {
        return;
      }
    }

    // Process signal
    setTimeout(() => {
      if (this.peer && !this.peer.destroyed) {
        this.peer.signal(signalData.data);
      }
    }, 100);
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.wsClient.off('signal', this.handleSignal.bind(this));
    this.wsClient.off('viewerJoined', this.handleViewerJoined.bind(this));
    this.wsClient.off('publishState', () => {});
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
