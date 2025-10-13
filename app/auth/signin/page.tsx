'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/store/auth-store';
import { storeTokens } from '@/lib/utils/auth-helpers';
import toast from 'react-hot-toast';
import { useDraggableDock } from '@/hooks/use-draggable-dock';

export default function SignInPage() {
  const router = useRouter();
  const { setUser, setTokens } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const dockRef = useRef<HTMLDivElement>(null);

  // Enable draggable dock
  useDraggableDock(dockRef);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to sign in');
        setIsLoading(false);
        return;
      }

      // Store tokens
      storeTokens(data.tokens.accessToken, data.tokens.refreshToken);
      setTokens(data.tokens.accessToken, data.tokens.refreshToken);

      // Set user info
      if (data.user) {
        setUser(data.user);
        toast.success('Signed in successfully!');
        router.push('/dashboard');
      } else {
        toast.error('Failed to get user information');
        setIsLoading(false);
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      toast.error('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4" style={{ backgroundImage: "url('/background.svg')", backgroundSize: 'cover' }}>
      <div className="max-w-md w-full">
        

        <div ref={dockRef} className="backdrop-blur-sm rounded-lg p-8 dock cursor-move select-none">
          <div className="mb-8 cursor-move">
            <h1 className="text-2xl text-white mb-2">Welcome Back</h1>
            <p className="text-gray-300">Sign in to your InkStream account</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6 text-white">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              error={errors.email}
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              error={errors.password}
            />

            <Button
              type="submit"
              className="w-full"
              isLoading={isLoading}
            >
              Sign In
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-300">
              Don't have an account?{' '}
              <Link href="/auth/signup" className="text-[#ffde5a] hover:text-[#ffde5a]/80 font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        <div className="mt-6 text-center">
          <Link href="/" className="text-gray-300 hover:text-white">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
