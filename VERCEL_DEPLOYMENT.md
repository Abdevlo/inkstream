# Vercel Deployment Guide

## Environment Variables Required

To deploy this application on Vercel, you need to set the following environment variables in your Vercel project settings:

### AWS Configuration
```
NEXT_PUBLIC_AWS_REGION=your-aws-region
NEXT_PUBLIC_COGNITO_USER_POOL_ID=your-cognito-user-pool-id
NEXT_PUBLIC_COGNITO_CLIENT_ID=your-cognito-client-id
COGNITO_CLIENT_SECRET=your-cognito-client-secret
```

### AWS Credentials (for server-side operations)
```
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
```

### DynamoDB Tables
```
DYNAMODB_SESSIONS_TABLE=StreamSessions
DYNAMODB_STATES_TABLE=SessionStates
```

### Application URLs
```
NEXT_PUBLIC_APP_URL=https://your-vercel-domain.vercel.app
NEXT_PUBLIC_API_GATEWAY_WS_URL=wss://your-api-gateway-id.execute-api.region.amazonaws.com/production
```

## How to Set Environment Variables in Vercel

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add each environment variable listed above
4. Make sure to set them for **Production**, **Preview**, and **Development** environments
5. Redeploy your application

## Important Security Notes

- ⚠️ **COGNITO_CLIENT_SECRET** should NOT have the `NEXT_PUBLIC_` prefix as it's a server-side secret
- All `NEXT_PUBLIC_` variables are exposed to the client-side
- Server-side only variables (like `COGNITO_CLIENT_SECRET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) are kept secure on the server

## Common Deployment Issues

### "key" argument must be of type string error
This occurs when `COGNITO_CLIENT_SECRET` is undefined. Make sure to:
1. Add `COGNITO_CLIENT_SECRET` to your Vercel environment variables
2. Set it to your actual Cognito app client secret (not the client ID)
3. Redeploy the application

### useSearchParams() Suspense boundary error
This has been fixed in the codebase by removing `useSearchParams()` and using client-side URL parsing instead.

## Testing the Deployment

After setting up all environment variables and deploying:

1. Test user signup: Should send verification email
2. Test user confirmation: Should accept 6-digit codes
3. Test user signin: Should authenticate successfully
4. Test session creation and streaming functionality

## Troubleshooting

If you encounter issues:

1. Check Vercel Function Logs for detailed error messages
2. Verify all environment variables are set correctly
3. Ensure AWS Cognito is configured properly
4. Check that DynamoDB tables exist and have correct permissions