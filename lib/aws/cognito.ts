import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  GetUserCommand,
  GlobalSignOutCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import crypto from 'crypto';

const client = new CognitoIdentityProviderClient({
  region: process.env.NEXT_PUBLIC_AWS_REGION!,
});

const CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!;
const CLIENT_SECRET = process.env.NEXT_PUBLIC_COGNITO_CLIENT_SECRET!;

/**
 * Calculate SECRET_HASH for Cognito authentication
 */
function calculateSecretHash(username: string): string {
  return crypto
    .createHmac('SHA256', CLIENT_SECRET)
    .update(username + CLIENT_ID)
    .digest('base64');
}

/**
 * Sign up a new user with email and password
 */
export async function signUp(email: string, password: string, username: string) {
  try {
    // Generate a unique username (not email format) since pool is configured for email alias
    const uniqueUsername = username.toLowerCase().replace(/[^a-z0-9]/g, '') + '_' + Date.now();

    const command = new SignUpCommand({
      ClientId: CLIENT_ID,
      SecretHash: calculateSecretHash(uniqueUsername),
      Username: uniqueUsername,
      Password: password,
      UserAttributes: [
        {
          Name: 'email',
          Value: email,
        },
        {
          Name: 'name',
          Value: username,
        },
      ],
    });

    const response = await client.send(command);
    return {
      success: true,
      data: {
        userSub: response.UserSub,
        username: uniqueUsername,
        codeDeliveryDetails: response.CodeDeliveryDetails,
      },
    };
  } catch (error: any) {
    console.error('Sign up error:', error);
    return {
      success: false,
      error: error.message || 'Failed to sign up',
    };
  }
}

/**
 * Confirm user sign up with verification code
 */
export async function confirmSignUp(email: string, code: string) {
  try {
    const command = new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      SecretHash: calculateSecretHash(email),
      Username: email,
      ConfirmationCode: code,
    });

    console.log('Confirming sign up for:', email, code);

    await client.send(command);
    return { success: true };
  } catch (error: any) {
    console.error('Confirm sign up error:', error);
    return {
      success: false,
      error: error.message || 'Failed to confirm sign up',
    };
  }
}

/**
 * Resend confirmation code
 */
export async function resendConfirmationCode(email: string) {
  try {
    const command = new ResendConfirmationCodeCommand({
      ClientId: CLIENT_ID,
      SecretHash: calculateSecretHash(email),
      Username: email,
    });

    const response = await client.send(command);
    console.log('Email confirmation:',response)
    return {
      success: true,
      data: {
        codeDeliveryDetails: response.CodeDeliveryDetails,
      },
    };
  } catch (error: any) {
    console.error('Resend confirmation code error:', error);
    return {
      success: false,
      error: error.message || 'Failed to resend confirmation code',
    };
  }
}

/**
 * Sign in user with email and password
 */
export async function signIn(email: string, password: string) {
  try {
    const command = new InitiateAuthCommand({
      AuthFlow: 'USER_PASSWORD_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
        SECRET_HASH: calculateSecretHash(email),
      },
    });

    const response = await client.send(command);

    if (!response.AuthenticationResult) {
      throw new Error('No authentication result returned');
    }

    return {
      success: true,
      data: {
        accessToken: response.AuthenticationResult.AccessToken,
        idToken: response.AuthenticationResult.IdToken,
        refreshToken: response.AuthenticationResult.RefreshToken,
        expiresIn: response.AuthenticationResult.ExpiresIn,
      },
    };
  } catch (error: any) {
    console.error('Sign in error:', error);
    return {
      success: false,
      error: error.message || 'Failed to sign in',
    };
  }
}

/**
 * Get current user information from access token
 */
export async function getCurrentUser(accessToken: string) {
  try {
    const command = new GetUserCommand({
      AccessToken: accessToken,
    });

    const response = await client.send(command);

    const email = response.UserAttributes?.find((attr) => attr.Name === 'email')?.Value;
    const username = response.UserAttributes?.find((attr) => attr.Name === 'preferred_username')?.Value;

    return {
      success: true,
      data: {
        id: response.Username!,
        email: email!,
        username: username || email!,
      },
    };
  } catch (error: any) {
    console.error('Get current user error:', error);
    return {
      success: false,
      error: error.message || 'Failed to get current user',
    };
  }
}

/**
 * Sign out user globally
 */
export async function signOut(accessToken: string) {
  try {
    const command = new GlobalSignOutCommand({
      AccessToken: accessToken,
    });

    await client.send(command);
    return { success: true };
  } catch (error: any) {
    console.error('Sign out error:', error);
    return {
      success: false,
      error: error.message || 'Failed to sign out',
    };
  }
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string, username: string) {
  try {
    const command = new InitiateAuthCommand({
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      ClientId: CLIENT_ID,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
        SECRET_HASH: calculateSecretHash(username),
      },
    });

    const response = await client.send(command);

    if (!response.AuthenticationResult) {
      throw new Error('No authentication result returned');
    }

    return {
      success: true,
      data: {
        accessToken: response.AuthenticationResult.AccessToken,
        idToken: response.AuthenticationResult.IdToken,
        expiresIn: response.AuthenticationResult.ExpiresIn,
      },
    };
  } catch (error: any) {
    console.error('Refresh token error:', error);
    return {
      success: false,
      error: error.message || 'Failed to refresh token',
    };
  }
}
