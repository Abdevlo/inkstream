# Quick Start Guide

Get StreamCanvas running locally in under 10 minutes!

## Prerequisites

- Node.js 18+ installed
- AWS Account (for Cognito and DynamoDB)
- Basic familiarity with AWS Console

## Quick Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Minimal AWS Setup

For local development, you only need:

1. **Cognito User Pool**
   - Go to AWS Cognito Console
   - Click "Create user pool"
   - Choose "Email" as sign-in option
   - Set password requirements (defaults are fine)
   - Create app client (no secret needed)
   - **Important:** In app client settings, enable `USER_PASSWORD_AUTH`
   - Copy User Pool ID and App Client ID

2. **DynamoDB Tables**
   ```bash
   # Simplified tables for local dev
   aws dynamodb create-table \
     --table-name StreamSessions \
     --attribute-definitions AttributeName=sessionId,AttributeType=S \
     --key-schema AttributeName=sessionId,KeyType=HASH \
     --billing-mode PAY_PER_REQUEST

   aws dynamodb create-table \
     --table-name SessionStates \
     --attribute-definitions AttributeName=sessionId,AttributeType=S AttributeName=timestamp,AttributeType=N \
     --key-schema AttributeName=sessionId,KeyType=HASH AttributeName=timestamp,KeyType=RANGE \
     --billing-mode PAY_PER_REQUEST
   ```

### 3. Configure Environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your values:

```env
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=us-east-1_XXXXXXX
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxxxxxxxxx
NEXT_PUBLIC_API_GATEWAY_WS_URL=wss://placeholder.execute-api.us-east-1.amazonaws.com/prod
NEXT_PUBLIC_API_GATEWAY_HTTP_URL=https://placeholder.execute-api.us-east-1.amazonaws.com/prod
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
DYNAMODB_SESSIONS_TABLE=StreamSessions
DYNAMODB_STATES_TABLE=SessionStates
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Note:** WebSocket URLs are optional for basic testing. You can add them later.

### 4. Run the Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Testing the Features

### Without WebSocket (Local Testing)

Most features work without WebSocket setup:

✅ **Working:**
- Homepage
- Authentication (Sign up, Sign in)
- Dashboard
- Create sessions
- All component tiles:
  - Webcam (local only)
  - Code compiler (mock execution)
  - PPTX viewer (placeholder)
  - Screen share (local only)
  - Clock/Timer

❌ **Not Working (needs WebSocket):**
- Viewer connections
- Real-time state sync
- Multi-user streaming

### Test Flow

1. **Sign Up**
   - Go to homepage
   - Click "Start Streaming Now"
   - Click "Sign up"
   - Create account (check email for verification if enabled)

2. **Sign In**
   - Use your email and password
   - You'll be redirected to Dashboard

3. **Create Session**
   - Click "Create New Session"
   - You'll enter Host interface

4. **Add Components**
   - Click the "+" button
   - Add any component tile
   - Drag and resize components

5. **Test Components**
   - **Webcam:** Grant camera permission, test video
   - **Code:** Write code, click Run (shows mock output)
   - **PPTX:** Upload file (shows placeholder slides)
   - **Screen Share:** Grant permission, share screen
   - **Clock:** Test clock, stopwatch, timer modes

## Adding WebSocket Support (Optional)

For full streaming functionality:

### 1. Create WebSocket API

```bash
# Create basic WebSocket API
aws apigatewayv2 create-api \
  --name StreamCanvasWebSocket \
  --protocol-type WEBSOCKET \
  --route-selection-expression '$request.body.action'

# Note the ApiId and add to .env.local
```

### 2. Deploy Lambda Function

```bash
cd lambda/websocket-handler
npm install
zip -r function.zip .

# Create Lambda (replace ROLE_ARN with your IAM role)
aws lambda create-function \
  --function-name StreamCanvas-WebSocket \
  --runtime nodejs18.x \
  --role ROLE_ARN \
  --handler index.handler \
  --zip-file fileb://function.zip

cd ../..
```

### 3. Connect Lambda to API Gateway

- Go to API Gateway Console
- Find your WebSocket API
- Create integrations for `$connect`, `$disconnect`, `signal`, `publishState`
- Deploy to `prod` stage
- Copy WebSocket URL to `.env.local`

## Common Issues

### Authentication Errors

**Error:** "USER_PASSWORD_AUTH flow not enabled"

**Solution:**
1. Go to Cognito Console
2. Select your User Pool
3. Go to "App clients"
4. Edit app client
5. Enable "USER_PASSWORD_AUTH" in authentication flows

### DynamoDB Access Denied

**Error:** "User is not authorized to perform: dynamodb:PutItem"

**Solution:**
1. Ensure AWS credentials in `.env.local` are correct
2. Verify IAM user has DynamoDB permissions
3. Check table names match in `.env.local`

### Webcam/Screen Share Not Working

**Error:** "Permission denied"

**Solution:**
- Use HTTPS or localhost (required for media access)
- Grant browser permissions when prompted
- Check browser supports getUserMedia/getDisplayMedia

## Next Steps

Once local development is working:

1. ✅ Review the full [README.md](README.md) for detailed documentation
2. ✅ Check [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment
3. ✅ Add WebSocket support for full streaming
4. ✅ Integrate real code execution Lambda
5. ✅ Add Excalidraw canvas integration

## Getting Help

- Check [README.md](README.md) for full documentation
- Review [DEPLOYMENT.md](DEPLOYMENT.md) for AWS setup
- Open an issue on GitHub
- Check browser console for errors

## Development Tips

### Hot Reload

Next.js auto-reloads on file changes. If it doesn't:

```bash
# Restart dev server
# Ctrl+C to stop, then:
npm run dev
```

### Clear Cache

If you see strange errors:

```bash
rm -rf .next
npm run dev
```

### Check Logs

- **Browser Console:** Right-click → Inspect → Console
- **Terminal:** Watch the dev server output
- **Network Tab:** Check API calls in browser DevTools

### VS Code Extensions

Recommended:
- ESLint
- Prettier
- Tailwind CSS IntelliSense
- TypeScript and JavaScript Language Features

## Feature Status

| Feature | Local Dev | Full Deploy |
|---------|-----------|-------------|
| Authentication | ✅ | ✅ |
| Dashboard | ✅ | ✅ |
| Session Management | ✅ | ✅ |
| Webcam Tile | ✅ | ✅ |
| Code Tile | ⚠️ Mock | ✅ Real |
| PPTX Tile | ⚠️ Placeholder | ⚠️ Needs work |
| Screen Share | ✅ | ✅ |
| Clock/Timer | ✅ | ✅ |
| WebRTC Streaming | ❌ | ✅ |
| State Sync | ❌ | ✅ |
| Viewer Mode | ❌ | ✅ |

## What's Next?

After getting the basic setup working, enhance your application:

1. **Excalidraw Integration** - Add real drawing canvas
2. **Real Code Execution** - Connect to Lambda for actual code running
3. **PPTX Conversion** - Implement real PowerPoint slide rendering
4. **Recording** - Add session recording functionality
5. **Analytics** - Track viewer engagement
6. **Chat** - Add real-time chat for viewers

Happy coding! 🚀
