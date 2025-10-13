# StreamCanvas - Live Canvas Streaming Platform

A broadcast streaming platform where hosts can stream an interactive canvas with moveable/resizable component tiles. Viewers can join via session ID to watch in real-time.

## Features
- **Live Streaming**: Stream your canvas with WebRTC peer-to-peer connections
- **Interactive Components**: 5 draggable and resizable component tiles:
  - Webcam - Live video feed from your camera
  - Code Compiler - Execute Python, Java, C++, C# with live output
  - PPTX Viewer - Display PowerPoint presentations
  - Screen Share - Share your screen
  - Clock & Timer - Digital clock, stopwatch, and countdown timer
- **Authentication**: Secure AWS Cognito authentication
- **Session Management**: Create and manage multiple streaming sessions
- **Real-time State Sync**: Component states synchronized via WebSocket
- **Viewer Mode**: Read-only viewing experience for participants

## Tech Stack
- **Frontend**: Next.js 14+ (App Router), TypeScript, Tailwind CSS
- **Authentication**: AWS Cognito
- **Database**: AWS DynamoDB
- **Real-time Communication**: AWS API Gateway WebSocket, WebRTC
- **Code Execution**: AWS Lambda (sandboxed)
- **State Management**: Zustand
- **UI Components**: Monaco Editor, React Draggable, React Hot Toast

## Prerequisites
- Node.js 18+ and npm
- AWS Account with:
  - Cognito User Pool
  - DynamoDB Tables
  - API Gateway WebSocket API
  - Lambda Functions (optional for code execution)

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Canvas
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Setup

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your AWS credentials:

```env
# AWS Configuration
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxx

# API Gateway
NEXT_PUBLIC_API_GATEWAY_WS_URL=wss://xxxxx.execute-api.us-east-1.amazonaws.com/prod
NEXT_PUBLIC_API_GATEWAY_HTTP_URL=https://xxxxx.execute-api.us-east-1.amazonaws.com/prod

# AWS Credentials (for server-side)
AWS_ACCESS_KEY_ID=xxxx
AWS_SECRET_ACCESS_KEY=xxxx

# DynamoDB Tables
DYNAMODB_SESSIONS_TABLE=StreamSessions
DYNAMODB_STATES_TABLE=SessionStates

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. AWS Infrastructure Setup

#### A. Create Cognito User Pool

1. Go to AWS Cognito Console
2. Create a User Pool with the following settings:
   - Sign-in options: Email
   - Password policy: Min 8 characters, require uppercase, lowercase, numbers, special characters
   - MFA: Optional (recommended for production)
   - App client: Create app client without secret
   - Enable USER_PASSWORD_AUTH flow in app client settings
3. Copy the User Pool ID and App Client ID to your `.env.local`

#### B. Create DynamoDB Tables

**StreamSessions Table:**

```bash
aws dynamodb create-table \
  --table-name StreamSessions \
  --attribute-definitions \
    AttributeName=sessionId,AttributeType=S \
    AttributeName=hostId,AttributeType=S \
  --key-schema \
    AttributeName=sessionId,KeyType=HASH \
  --global-secondary-indexes \
    "IndexName=HostIdIndex,KeySchema=[{AttributeName=hostId,KeyType=HASH}],Projection={ProjectionType=ALL},ProvisionedThroughput={ReadCapacityUnits=5,WriteCapacityUnits=5}" \
  --provisioned-throughput \
    ReadCapacityUnits=5,WriteCapacityUnits=5
```

**SessionStates Table:**

```bash
aws dynamodb create-table \
  --table-name SessionStates \
  --attribute-definitions \
    AttributeName=sessionId,AttributeType=S \
    AttributeName=timestamp,AttributeType=N \
  --key-schema \
    AttributeName=sessionId,KeyType=HASH \
    AttributeName=timestamp,KeyType=RANGE \
  --provisioned-throughput \
    ReadCapacityUnits=5,WriteCapacityUnits=5
```

**WebSocketConnections Table (for Lambda):**

```bash
aws dynamodb create-table \
  --table-name WebSocketConnections \
  --attribute-definitions \
    AttributeName=connectionId,AttributeType=S \
  --key-schema \
    AttributeName=connectionId,KeyType=HASH \
  --provisioned-throughput \
    ReadCapacityUnits=5,WriteCapacityUnits=5
```

#### C. Create API Gateway WebSocket API

1. Go to API Gateway Console
2. Create a WebSocket API
3. Add routes:
   - `$connect`
   - `$disconnect`
   - `signal`
   - `publishState`
4. Create a deployment stage (e.g., `prod`)
5. Copy the WebSocket URL to your `.env.local`

#### D. Deploy Lambda Functions

**WebSocket Handler:**

```bash
cd lambda/websocket-handler
npm install
zip -r function.zip .
aws lambda create-function \
  --function-name websocket-handler \
  --runtime nodejs18.x \
  --role arn:aws:iam::ACCOUNT_ID:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --memory-size 256 \
  --environment Variables={CONNECTIONS_TABLE=WebSocketConnections}
cd ../..
```

**Code Executor:**

```bash
cd lambda/code-executor
zip -r function.zip .
aws lambda create-function \
  --function-name code-executor \
  --runtime nodejs18.x \
  --role arn:aws:iam::ACCOUNT_ID:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 10 \
  --memory-size 256
cd ../..
```

**Note**: You need to create an IAM role with permissions for Lambda to access DynamoDB and execute API Gateway management commands.

#### E. Connect Lambda to API Gateway

1. Go to your WebSocket API in API Gateway
2. For each route (`$connect`, `$disconnect`, `signal`, `publishState`):
   - Set integration type to Lambda
   - Select the `websocket-handler` function
3. Deploy the API

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
Canvas/
├── app/                          # Next.js app directory
│   ├── api/                      # API routes
│   │   ├── execute-code/         # Code execution endpoint
│   │   └── sessions/             # Session management endpoints
│   ├── auth/                     # Authentication pages
│   │   ├── signin/
│   │   └── signup/
│   ├── dashboard/                # User dashboard
│   ├── session/[id]/             # Session pages
│   │   ├── host/                 # Host interface
│   │   └── view/                 # Viewer interface
│   ├── layout.tsx                # Root layout
│   ├── page.tsx                  # Homepage
│   └── globals.css               # Global styles
├── components/                   # React components
│   ├── layout/                   # Layout components
│   ├── tiles/                    # Component tiles
│   │   ├── webcam-tile.tsx
│   │   ├── code-tile.tsx
│   │   ├── pptx-tile.tsx
│   │   ├── screenshare-tile.tsx
│   │   ├── clock-tile.tsx
│   │   └── tile-wrapper.tsx
│   └── ui/                       # UI components
├── hooks/                        # Custom React hooks
├── lambda/                       # AWS Lambda functions
│   ├── websocket-handler/        # WebSocket connection handler
│   └── code-executor/            # Code execution sandbox
├── lib/                          # Utility libraries
│   ├── aws/                      # AWS SDK utilities
│   │   ├── cognito.ts
│   │   ├── dynamodb.ts
│   │   └── websocket.ts
│   ├── streaming/                # Streaming providers
│   │   ├── stream-provider.ts
│   │   └── webrtc-provider.ts
│   └── utils/                    # Helper functions
├── store/                        # Zustand state stores
├── types/                        # TypeScript type definitions
├── .env.local                    # Environment variables
├── .env.example                  # Environment variables template
└── package.json                  # Dependencies
```

## Usage

### Creating a Session
1. Sign up or sign in with your email
2. Go to Dashboard
3. Click "Create New Session"
4. You'll be redirected to the host interface

### Host Interface
1. **Add Components**: Click the "+" button to add component tiles
2. **Arrange Components**: Drag tiles to position them, resize as needed
3. **Configure Components**:
   - **Webcam**: Click "Start Webcam" to enable camera
   - **Code Compiler**: Select language, write code, click "Run"
   - **PPTX Viewer**: Upload a .pptx file, navigate slides
   - **Screen Share**: Click "Start Screen Share" to share your screen
   - **Clock**: Switch between clock, stopwatch, and timer modes
4. **Start Broadcasting**: Click "Start Broadcast" to go live
5. **Share Link**: Copy the viewer link and share with participants

### Viewer Experience
1. Open the shared session link
2. Wait for the host to start broadcasting
3. Watch the live stream in read-only mode
4. See component states synchronized in real-time

## Key Features Explained

### Stream Provider Abstraction
The application uses a provider abstraction pattern that allows easy switching between WebRTC and AWS IVS:

```typescript
// Current: WebRTC implementation
const provider = createStreamProvider('webrtc');

// Future: AWS IVS implementation
const provider = createStreamProvider('ivs');
```

This design makes it easy to upgrade to AWS IVS for production-scale streaming without changing application code.

### Component Tiles
All component tiles are:
- **Draggable**: Click and drag the header to reposition
- **Resizable**: Drag the bottom-right corner to resize
- **Self-contained**: Each component manages its own state
- **Real-time synced**: Component states are synchronized via WebSocket

### Security
- **Authentication**: AWS Cognito with email/password
- **Code Execution**: Sandboxed Lambda with 5-second timeout
- **Session Isolation**: Each session has unique ID and access control
- **Input Validation**: All user inputs are validated

### Performance Optimizations
- **Lazy Loading**: Components loaded only when needed
- **Stream Optimization**: WebRTC peer-to-peer for minimal latency
- **State Batching**: Component state updates are batched
- **Memory Management**: Media streams properly cleaned up on unmount

## Limitations & Future Enhancements

### Current Limitations
- WebRTC is peer-to-peer (not scalable for many viewers)
- Code execution uses mock output (Lambda integration needed)
- PPTX viewer shows placeholder slides (needs real conversion)
- No session recording (planned feature)
- Canvas integration is placeholder (Excalidraw integration needed)

### Planned Features
1. **AWS IVS Integration**: Scalable streaming for many viewers
2. **Session Recording**: Record sessions for later playback
3. **Excalidraw Integration**: Full canvas drawing capabilities
4. **Real Code Execution**: AWS Lambda integration for actual code execution
5. **Real PPTX Conversion**: Convert PowerPoint slides to images
6. **Chat System**: Real-time chat for viewers
7. **Analytics**: Viewer metrics and engagement tracking
8. **Mobile App**: Native mobile applications

## Troubleshooting

### Authentication Issues
- Verify Cognito User Pool ID and Client ID are correct
- Check that USER_PASSWORD_AUTH is enabled in Cognito App Client settings
- Ensure password meets complexity requirements

### WebSocket Connection Fails
- Verify API Gateway WebSocket URL is correct
- Check Lambda function has correct permissions
- Ensure DynamoDB tables exist and are accessible

### Components Not Working
- **Webcam/Screen Share**: Check browser permissions for camera/screen access
- **Code Execution**: Verify API route is working (check browser console)
- **PPTX**: File upload working (currently shows placeholders)

### Build Errors

```bash
# Clear Next.js cache
rm -rf .next

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run build
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Create an issue in the GitHub repository
- Check existing issues for solutions
- Review the troubleshooting section above

## Acknowledgments

- Next.js team for the amazing framework
- AWS for cloud services
- Excalidraw for canvas inspiration
- All open-source contributors

---

Built with ❤️ using Next.js 14+, TypeScript, and AWS
