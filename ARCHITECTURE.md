# StreamCanvas Architecture

This document provides a detailed overview of the StreamCanvas application architecture.

## System Overview

StreamCanvas is a full-stack streaming platform built with Next.js 14+ and AWS services. It enables hosts to broadcast interactive canvas sessions with multiple component tiles while viewers watch in real-time.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Client Browser                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Homepage   │  │     Auth     │  │  Dashboard   │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │              Host Session Interface                       │       │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐      │       │
│  │  │Webcam│  │ Code │  │ PPTX │  │Screen│  │Clock │      │       │
│  │  │      │  │      │  │      │  │Share │  │      │      │       │
│  │  └──────┘  └──────┘  └──────┘  └──────┘  └──────┘      │       │
│  │              Excalidraw Canvas                           │       │
│  └──────────────────────────────────────────────────────────┘       │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────┐       │
│  │              Viewer Interface                             │       │
│  │         Video Player + State Display                      │       │
│  └──────────────────────────────────────────────────────────┘       │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                            │       │
                    ┌───────┘       └───────┐
                    │                       │
            ┌───────▼──────┐        ┌───────▼──────────┐
            │   Next.js    │        │   WebRTC P2P     │
            │  API Routes  │        │   Connection     │
            └───────┬──────┘        └──────────────────┘
                    │
        ┌───────────┼───────────────────────┐
        │           │                       │
┌───────▼──────┐ ┌──▼────────┐  ┌─────────▼────────┐
│AWS Cognito   │ │ DynamoDB  │  │ API Gateway WS   │
│(Auth)        │ │(Sessions) │  │(Signaling)       │
└──────────────┘ └───────────┘  └─────────┬────────┘
                                           │
                                  ┌────────▼────────┐
                                  │  Lambda         │
                                  │  - WebSocket    │
                                  │  - Code Exec    │
                                  └─────────────────┘
```

## Technology Stack

### Frontend
- **Next.js 14+**: React framework with App Router
- **TypeScript**: Type-safe JavaScript
- **Tailwind CSS**: Utility-first CSS framework
- **Zustand**: Lightweight state management
- **React Hot Toast**: Toast notifications
- **Monaco Editor**: Code editor component
- **React Draggable**: Draggable UI components
- **Simple Peer**: WebRTC wrapper library

### Backend & Infrastructure
- **AWS Cognito**: User authentication and authorization
- **AWS DynamoDB**: NoSQL database for sessions and state
- **AWS API Gateway**: WebSocket API for real-time communication
- **AWS Lambda**: Serverless compute for code execution and WebSocket handling
- **WebRTC**: Peer-to-peer video streaming

## Component Architecture

### Frontend Components

```
components/
├── layout/
│   └── navbar.tsx              # Global navigation
├── tiles/
│   ├── tile-wrapper.tsx        # Reusable draggable/resizable container
│   ├── webcam-tile.tsx         # Webcam component
│   ├── code-tile.tsx           # Code editor and executor
│   ├── pptx-tile.tsx           # PowerPoint viewer
│   ├── screenshare-tile.tsx    # Screen sharing
│   └── clock-tile.tsx          # Clock/stopwatch/timer
└── ui/
    ├── button.tsx              # Button component
    ├── input.tsx               # Input component
    └── loading.tsx             # Loading spinner
```

### State Management

```typescript
// Auth Store (Zustand)
- user: User | null
- accessToken: string | null
- refreshToken: string | null
- isAuthenticated: boolean
- isLoading: boolean

// Session Store (Zustand)
- currentSession: StreamSession | null
- isHost: boolean
- components: ComponentTile[]
- canvasData: any[]
- isStreaming: boolean
- viewerCount: number
```

## Data Flow

### Authentication Flow

```
User → Sign In Form → Cognito API
                         ↓
              Access Token + Refresh Token
                         ↓
              Store in sessionStorage
                         ↓
              Update Auth Store
                         ↓
              Redirect to Dashboard
```

### Session Creation Flow

```
Host → Dashboard → Create Session
                      ↓
              Generate Session ID
                      ↓
              DynamoDB.put(session)
                      ↓
              Redirect to /session/[id]/host
                      ↓
              Initialize Stream Provider
```

### Streaming Flow (WebRTC)

```
Host:
1. Start Broadcast
2. Capture Canvas Stream (getUserMedia)
3. Initialize WebRTC Peer (initiator: true)
4. Send offer via WebSocket
5. Receive answer from viewer
6. ICE candidate exchange
7. P2P connection established
8. Stream media directly to viewer

Viewer:
1. Join Session
2. Initialize WebRTC Peer (initiator: false)
3. Receive offer from host via WebSocket
4. Send answer via WebSocket
5. ICE candidate exchange
6. P2P connection established
7. Receive media stream from host
```

### State Synchronization

```
Host:
1. Component state changes
2. Debounce updates (100ms)
3. WebSocket.send(state)
4. Lambda broadcasts to all viewers

Viewers:
1. Receive state via WebSocket
2. Update local state
3. Re-render components
```

## API Routes

### `/api/sessions/create` (POST)
Creates a new streaming session.

**Request:**
```json
{
  "sessionId": "abc123",
  "hostId": "user-id",
  "title": "My Session"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "abc123",
    "hostId": "user-id",
    "createdAt": 1234567890,
    "status": "active",
    "title": "My Session"
  }
}
```

### `/api/sessions/[id]` (GET)
Retrieves session details.

### `/api/sessions/[id]` (PATCH)
Updates session status.

### `/api/execute-code` (POST)
Executes code in a sandboxed environment.

**Request:**
```json
{
  "language": "python",
  "code": "print('Hello World')"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "stdout": "Hello World\n",
    "stderr": "",
    "executionTime": 45
  }
}
```

## Database Schema

### StreamSessions (DynamoDB)

```typescript
{
  sessionId: string (PK)      // Unique session identifier
  hostId: string              // User ID of the host
  createdAt: number           // Unix timestamp
  status: 'active' | 'ended'  // Session status
  title: string               // Session title
}

// GSI: HostIdIndex on hostId for querying user's sessions
```

### SessionStates (DynamoDB)

```typescript
{
  sessionId: string (PK)      // Session identifier
  timestamp: number (SK)      // Sort key for versioning
  state: {
    components: ComponentTile[]
    canvasData: any[]
  }
}
```

### WebSocketConnections (DynamoDB)

```typescript
{
  connectionId: string (PK)   // WebSocket connection ID
  sessionId: string           // Associated session
  connectedAt: number         // Connection timestamp
}

// GSI: SessionIdIndex on sessionId for broadcasting
```

## Lambda Functions

### WebSocket Handler

**Purpose:** Manages WebSocket connections and message routing.

**Routes:**
- `$connect`: Establishes connection, stores in DynamoDB
- `$disconnect`: Cleans up connection from DynamoDB
- `signal`: Routes WebRTC signaling messages
- `publishState`: Broadcasts state updates to viewers

**Code Flow:**
```javascript
exports.handler = async (event) => {
  const { routeKey, connectionId } = event;

  switch (routeKey) {
    case '$connect':
      return handleConnect(connectionId);
    case 'signal':
      return handleSignal(event);
    // ...
  }
}
```

### Code Executor

**Purpose:** Executes user code in isolated environment.

**Features:**
- Language support: Python, Java, C++, C#
- 5-second timeout
- 256MB memory limit
- No network access
- Output size limits

**Security:**
- Sandboxed execution
- Resource limits
- Timeout enforcement
- Output sanitization

## Security Architecture

### Authentication
- AWS Cognito handles user authentication
- JWT tokens for API authorization
- Refresh token rotation
- Session timeout after inactivity

### Authorization
- Session access controlled by host ID
- Viewers can join public sessions
- No viewer write access to session state

### Code Execution
- Lambda sandboxing
- 5-second timeout
- Memory limits
- No network access
- Input validation

### Data Security
- Tokens stored in sessionStorage (not localStorage)
- HTTPS only in production
- Environment variables for secrets
- No sensitive data in client code

## Performance Optimizations

### Frontend
- Code splitting with Next.js dynamic imports
- Component lazy loading
- State update debouncing
- Memoization of expensive calculations
- Image optimization

### Backend
- DynamoDB on-demand billing (no idle costs)
- Lambda function warming
- Connection pooling
- State update batching

### Streaming
- WebRTC P2P (no server bandwidth)
- Adaptive bitrate (browser automatic)
- ICE candidate optimization
- Connection fallback (TURN servers)

## Scalability Considerations

### Current Limitations (WebRTC P2P)
- 1:1 host-to-viewer ratio
- Host bandwidth limits viewers
- Host must stay connected
- No recording capability

### Future Enhancement (AWS IVS)
- 1:many scalability
- Server-side processing
- Cloud recording
- Better reliability
- Lower host requirements

### Stream Provider Abstraction

```typescript
interface IStreamProvider {
  initializeHost(sessionId: string): Promise<void>;
  publishMedia(stream: MediaStream): Promise<void>;
  endSession(): Promise<void>;
  joinSession(sessionId: string): Promise<void>;
  subscribeToMedia(callback): void;
}

// Easy swap:
const provider = createStreamProvider('webrtc'); // or 'ivs'
```

## Error Handling

### Frontend
- Error boundaries for React components
- Try-catch blocks for async operations
- User-friendly error messages via toast
- Fallback UI states

### Backend
- Lambda error logging to CloudWatch
- DynamoDB error retries
- WebSocket reconnection logic
- API response error codes

### Media Errors
- Camera/mic permission handling
- Stream failure fallbacks
- Connection loss detection
- Automatic reconnection

## Monitoring and Logging

### CloudWatch Metrics
- Lambda invocations and errors
- DynamoDB read/write metrics
- API Gateway connections
- WebSocket messages

### Application Logs
- Authentication events
- Session creation/ending
- Component state changes
- Error stack traces

### Performance Metrics
- Page load times
- API response times
- Stream quality metrics
- Connection latency

## Development Workflow

### Local Development
```bash
npm run dev  # Start dev server
# Edit code → Auto-reload → Test
```

### Testing
- Manual testing in browser
- Component testing (future)
- E2E testing (future)

### Deployment
```bash
npm run build   # Build production
vercel --prod   # Deploy to Vercel
# or
amplify push    # Deploy to Amplify
```

## Future Architecture Enhancements

### Phase 1: Enhanced Streaming
- [ ] AWS IVS integration
- [ ] Session recording
- [ ] Playback functionality

### Phase 2: Collaboration
- [ ] Real-time chat
- [ ] Multiple hosts
- [ ] Viewer reactions

### Phase 3: Advanced Features
- [ ] Excalidraw full integration
- [ ] Real PPTX rendering
- [ ] Analytics dashboard
- [ ] Mobile apps

### Phase 4: Enterprise
- [ ] SSO integration
- [ ] Custom branding
- [ ] Advanced permissions
- [ ] Usage analytics

## Contributing

When contributing, maintain:
- Type safety (TypeScript)
- Component modularity
- Error handling
- Code documentation
- Performance optimization

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [AWS Cognito Guide](https://docs.aws.amazon.com/cognito/)
- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [WebRTC Documentation](https://webrtc.org/getting-started/overview)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)

---

Last Updated: 2025
