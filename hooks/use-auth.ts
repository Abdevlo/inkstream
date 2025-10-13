import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { getCurrentUser } from '@/lib/aws/cognito';
import { getStoredTokens, clearTokens } from '@/lib/utils/auth-helpers';

/**
 * Custom hook for authentication
 */
export function useAuth(requireAuth: boolean = false) {
  const router = useRouter();
  const { user, accessToken, isAuthenticated, isLoading, setUser, setTokens, setLoading, logout } =
    useAuthStore();

  useEffect(() => {
    const initAuth = async () => {
      const tokens = getStoredTokens();

      if (tokens.accessToken && tokens.refreshToken) {
        try {
          // Verify token and get user info
          const result = await getCurrentUser(tokens.accessToken);

          if (result.success && result.data) {
            setUser(result.data);
            setTokens(tokens.accessToken, tokens.refreshToken);
          } else {
            // Token invalid, clear storage
            clearTokens();
            logout();
          }
        } catch (error) {
          console.error('Auth initialization error:', error);
          clearTokens();
          logout();
        }
      }

      setLoading(false);
    };

    initAuth();
  }, []);

  useEffect(() => {
    // Redirect if auth is required but user is not authenticated
    if (!isLoading && requireAuth && !isAuthenticated) {
      router.push('/auth/signin');
    }
  }, [isLoading, requireAuth, isAuthenticated, router]);

  return {
    user,
    accessToken,
    isAuthenticated,
    isLoading,
  };
}

/**
 * Hook to protect routes that require authentication
 */
export function useProtectedRoute() {
  return useAuth(true);
}
