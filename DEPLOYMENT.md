# StreamCanvas Deployment Guide

This guide covers deploying StreamCanvas to production on AWS.

## Overview

StreamCanvas requires the following AWS services:
- **AWS Cognito** - User authentication
- **AWS DynamoDB** - Session and state storage
- **AWS Lambda** - WebSocket handling and code execution
- **AWS API Gateway** - WebSocket API for real-time communication
- **Vercel/AWS Amplify** - Frontend hosting (recommended)

## Prerequisites

- AWS CLI configured with appropriate credentials
- AWS Account with appropriate permissions
- Node.js 18+ installed
- Domain name (optional but recommended)

## Step-by-Step Deployment

### 1. Create IAM Roles

Create an IAM role for Lambda functions:

```bash
aws iam create-role \
  --role-name StreamCanvasLambdaRole \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Principal": {
          "Service": "lambda.amazonaws.com"
        },
        "Action": "sts:AssumeRole"
      }
    ]
  }'
```

Attach policies to the role:

```bash
# CloudWatch Logs
aws iam attach-role-policy \
  --role-name StreamCanvasLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# DynamoDB access
aws iam attach-role-policy \
  --role-name StreamCanvasLambdaRole \
  --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess

# API Gateway Management (for WebSocket)
aws iam put-role-policy \
  --role-name StreamCanvasLambdaRole \
  --policy-name ApiGatewayManagementPolicy \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "execute-api:ManageConnections"
        ],
        "Resource": "*"
      }
    ]
  }'
```

### 2. Set Up DynamoDB Tables

Run the table creation commands from the main README, or use this consolidated script:

```bash
# StreamSessions table
aws dynamodb create-table \
  --table-name StreamSessions \
  --attribute-definitions \
    AttributeName=sessionId,AttributeType=S \
    AttributeName=hostId,AttributeType=S \
  --key-schema \
    AttributeName=sessionId,KeyType=HASH \
  --global-secondary-indexes \
    "IndexName=HostIdIndex,KeySchema=[{AttributeName=hostId,KeyType=HASH}],Projection={ProjectionType=ALL},BillingMode=PAY_PER_REQUEST" \
  --billing-mode PAY_PER_REQUEST

# SessionStates table
aws dynamodb create-table \
  --table-name SessionStates \
  --attribute-definitions \
    AttributeName=sessionId,AttributeType=S \
    AttributeName=timestamp,AttributeType=N \
  --key-schema \
    AttributeName=sessionId,KeyType=HASH \
    AttributeName=timestamp,KeyType=RANGE \
  --billing-mode PAY_PER_REQUEST

# WebSocketConnections table
aws dynamodb create-table \
  --table-name WebSocketConnections \
  --attribute-definitions \
    AttributeName=connectionId,AttributeType=S \
  --key-schema \
    AttributeName=connectionId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

### 3. Create Cognito User Pool

```bash
# Create user pool
aws cognito-idp create-user-pool \
  --pool-name StreamCanvasUsers \
  --policies '{
    "PasswordPolicy": {
      "MinimumLength": 8,
      "RequireUppercase": true,
      "RequireLowercase": true,
      "RequireNumbers": true,
      "RequireSymbols": true
    }
  }' \
  --auto-verified-attributes email \
  --username-attributes email

# Note the UserPoolId from the output

# Create app client
aws cognito-idp create-user-pool-client \
  --user-pool-id <USER_POOL_ID> \
  --client-name StreamCanvasApp \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --prevent-user-existence-errors ENABLED

# Note the ClientId from the output
```

### 4. Deploy Lambda Functions

**WebSocket Handler:**

```bash
cd lambda/websocket-handler
npm install --production
zip -r function.zip .

# Get the role ARN
ROLE_ARN=$(aws iam get-role --role-name StreamCanvasLambdaRole --query 'Role.Arn' --output text)

# Create function
aws lambda create-function \
  --function-name StreamCanvas-WebSocketHandler \
  --runtime nodejs18.x \
  --role $ROLE_ARN \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --memory-size 256 \
  --environment Variables="{CONNECTIONS_TABLE=WebSocketConnections,AWS_REGION=us-east-1}"

cd ../..
```

**Code Executor:**

```bash
cd lambda/code-executor
zip -r function.zip .

aws lambda create-function \
  --function-name StreamCanvas-CodeExecutor \
  --runtime nodejs18.x \
  --role $ROLE_ARN \
  --handler index.handler \
  --zip-file fileb://function.zip \
  --timeout 10 \
  --memory-size 512

cd ../..
```

### 5. Create API Gateway WebSocket API

```bash
# Create API
aws apigatewayv2 create-api \
  --name StreamCanvasWebSocket \
  --protocol-type WEBSOCKET \
  --route-selection-expression '$request.body.action'

# Note the ApiId from the output
API_ID=<API_ID>

# Get Lambda function ARN
LAMBDA_ARN=$(aws lambda get-function --function-name StreamCanvas-WebSocketHandler --query 'Configuration.FunctionArn' --output text)

# Create integration
INTEGRATION_ID=$(aws apigatewayv2 create-integration \
  --api-id $API_ID \
  --integration-type AWS_PROXY \
  --integration-uri $LAMBDA_ARN \
  --query 'IntegrationId' \
  --output text)

# Create routes
for route in '$connect' '$disconnect' 'signal' 'publishState'; do
  aws apigatewayv2 create-route \
    --api-id $API_ID \
    --route-key "$route" \
    --target "integrations/$INTEGRATION_ID"
done

# Grant API Gateway permission to invoke Lambda
aws lambda add-permission \
  --function-name StreamCanvas-WebSocketHandler \
  --statement-id ApiGatewayInvoke \
  --action lambda:InvokeFunction \
  --principal apigateway.amazonaws.com \
  --source-arn "arn:aws:execute-api:us-east-1:*:$API_ID/*"

# Deploy API
aws apigatewayv2 create-deployment \
  --api-id $API_ID \
  --stage-name prod

# Get WebSocket URL
echo "WebSocket URL: wss://$API_ID.execute-api.us-east-1.amazonaws.com/prod"
```

### 6. Configure Environment Variables

Update your `.env.local` (for development) and production environment variables:

```env
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<USER_POOL_ID>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<CLIENT_ID>
NEXT_PUBLIC_API_GATEWAY_WS_URL=wss://<API_ID>.execute-api.us-east-1.amazonaws.com/prod
NEXT_PUBLIC_API_GATEWAY_HTTP_URL=https://<API_ID>.execute-api.us-east-1.amazonaws.com/prod
AWS_ACCESS_KEY_ID=<YOUR_ACCESS_KEY>
AWS_SECRET_ACCESS_KEY=<YOUR_SECRET_KEY>
DYNAMODB_SESSIONS_TABLE=StreamSessions
DYNAMODB_STATES_TABLE=SessionStates
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 7. Deploy Frontend

#### Option A: Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Add environment variables in Vercel dashboard
```

#### Option B: AWS Amplify

1. Push code to GitHub/GitLab/Bitbucket
2. Go to AWS Amplify Console
3. Connect your repository
4. Add environment variables
5. Deploy

#### Option C: Self-hosted

```bash
# Build the application
npm run build

# Start production server
npm start
```

### 8. SSL/TLS Setup

For production, always use HTTPS:

**With Vercel:** Automatic SSL

**With Amplify:** Automatic SSL

**Self-hosted:** Use Let's Encrypt with nginx/Apache

### 9. Post-Deployment Configuration

1. **Update CORS in API Gateway** (if needed)
2. **Configure CloudWatch alarms** for Lambda functions
3. **Set up DynamoDB auto-scaling** (if using provisioned capacity)
4. **Enable CloudWatch logs** for debugging
5. **Configure backup for DynamoDB** tables

## Monitoring and Logging

### CloudWatch Dashboards

Create a dashboard to monitor:
- Lambda invocations and errors
- DynamoDB read/write capacity
- API Gateway connections and messages
- Cognito sign-ups and authentications

### Alarms

Set up alarms for:
- Lambda errors > 5 in 5 minutes
- DynamoDB throttling
- API Gateway 5xx errors

```bash
# Example: Lambda error alarm
aws cloudwatch put-metric-alarm \
  --alarm-name StreamCanvas-Lambda-Errors \
  --alarm-description "Alert on Lambda errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1
```

## Scaling Considerations

### DynamoDB

- Use on-demand billing for unpredictable traffic
- Enable auto-scaling for provisioned capacity
- Use DynamoDB Accelerator (DAX) for read-heavy workloads

### Lambda

- Monitor concurrent executions
- Increase reserved concurrency for critical functions
- Use Lambda layers for shared dependencies

### API Gateway

- Monitor connection count and message rate
- Use throttling to prevent abuse
- Consider AWS Global Accelerator for global users

## Security Best Practices

1. **Never commit credentials** to version control
2. **Use AWS Secrets Manager** for sensitive data
3. **Enable MFA** on Cognito for production
4. **Implement rate limiting** on API Gateway
5. **Use VPC** for Lambda functions accessing private resources
6. **Enable CloudTrail** for audit logging
7. **Regular security audits** with AWS Security Hub

## Cost Optimization

### Free Tier Usage

- Cognito: 50,000 MAUs free
- DynamoDB: 25 GB storage, 25 WCU/RCU free
- Lambda: 1M requests, 400,000 GB-seconds free
- API Gateway: 1M messages free (first 12 months)

### Cost Reduction Tips

1. Use on-demand billing for DynamoDB
2. Optimize Lambda memory allocation
3. Implement connection pooling
4. Use CloudFront CDN for static assets
5. Set up budget alerts

## Troubleshooting

### Lambda Timeouts

- Increase timeout setting
- Optimize code performance
- Check DynamoDB capacity

### WebSocket Connection Issues

- Verify API Gateway deployment
- Check Lambda permissions
- Review CloudWatch logs

### Authentication Failures

- Verify Cognito configuration
- Check USER_PASSWORD_AUTH is enabled
- Review password policy settings

## Rollback Procedure

If deployment fails:

1. **Frontend:** Revert Vercel/Amplify deployment
2. **Lambda:** Update function code to previous version
3. **API Gateway:** Create new deployment with previous stage
4. **DynamoDB:** Restore from backup (if enabled)

## Maintenance

### Regular Tasks

- Review CloudWatch logs weekly
- Update dependencies monthly
- Rotate credentials quarterly
- Review and optimize costs monthly
- Test backup and restore procedures

### Updates

```bash
# Update Lambda function code
cd lambda/websocket-handler
npm update
zip -r function.zip .
aws lambda update-function-code \
  --function-name StreamCanvas-WebSocketHandler \
  --zip-file fileb://function.zip

# Update frontend
vercel --prod  # or your deployment method
```

## Support

For deployment issues:
- Check AWS service health dashboard
- Review CloudWatch logs
- Consult AWS documentation
- Open a GitHub issue

---

**Deployment Checklist:**

- [ ] IAM roles created
- [ ] DynamoDB tables created
- [ ] Cognito User Pool configured
- [ ] Lambda functions deployed
- [ ] API Gateway configured
- [ ] Environment variables set
- [ ] Frontend deployed
- [ ] SSL/TLS enabled
- [ ] Monitoring configured
- [ ] Alarms set up
- [ ] Backup enabled
- [ ] Security review completed
- [ ] Load testing performed
- [ ] Documentation updated
