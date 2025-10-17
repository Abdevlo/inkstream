'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import { useDraggableDock } from '@/hooks/use-draggable-dock';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { REGEXP_ONLY_DIGITS_AND_CHARS } from 'input-otp';

function ConfirmSignUpContent() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [username, setUsername] = useState('');
  const dockRef = useRef<HTMLDivElement>(null);

  // Get email and username from localStorage on mount (client-side only)
  useEffect(() => {
    const storedUsername = localStorage.getItem('pendingUsername');
    const storedEmail = localStorage.getItem('pendingEmail');
    
    if (storedUsername) {
      setUsername(storedUsername);
    }
    
    if (storedEmail) {
      setEmail(storedEmail);
    }
    
    // Also check URL params as fallback
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email');
    if (emailParam && !storedEmail) {
      setEmail(emailParam);
      localStorage.setItem('pendingEmail', emailParam);
    }
  }, []);

  useDraggableDock(dockRef);

  const handleResendCode = async () => {
    if (!username) {
      toast.error('Username not found. Please sign up again.');
      router.push('/auth/signup');
      return;
    }
    setIsResending(true);
    try {
      const response = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = await response.json();
      if (response.ok) toast.success('Verification code sent! Please check your email.');
      else toast.error(data?.error || 'Failed to resend code');
    } catch (err) {
      console.error('Resend code error:', err);
      toast.error('An unexpected error occurred');
    } finally {
      setIsResending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) {
      toast.error('Username not found. Please sign up again.');
      router.push('/auth/signup');
      return;
    }
    if (code.length !== 6) {
      toast.error('Please enter a valid 6-digit code');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, code }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Account confirmed! You can now sign in.');
        // Clear the stored data after successful confirmation
        localStorage.removeItem('pendingUsername');
        localStorage.removeItem('pendingEmail');
        router.push('/auth/signin');
      } else {
        toast.error(data?.error || 'Failed to confirm account');
        setIsLoading(false);
      }
    } catch (err) {
      console.error('Confirm error:', err);
      toast.error('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-black flex items-center justify-center px-4"
      style={{ backgroundImage: "url('/background.svg')", backgroundSize: 'cover' }}
    >
      <div className="max-w-md w-full">
        <div ref={dockRef} className="backdrop-blur-sm rounded-lg p-8 dock cursor-move select-none">
          <div className="mb-8 cursor-move">
            <h1 className="text-2xl text-white mb-2">Confirm Your Account</h1>
            <p className="text-gray-300">
              {email ? (
                <>We sent a verification code to <span className="text-[#ffde5a]">{email}</span></>
              ) : (
                'We sent a verification code to your email'
              )}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 text-white">
            <label className="block text-sm font-medium text-gray-200">Verification Code</label>

            <InputOTP
              value={code}
              onChange={(value: string) => {
                const digits = value.replace(/[^0-9]/g, '').slice(0, 6);
                setCode(digits);
              }}
              maxLength={6}
              pattern={REGEXP_ONLY_DIGITS_AND_CHARS}
              inputMode="numeric"
              aria-label="6 digit verification code"
              className="w-full"
            >
              <InputOTPGroup className="flex gap-1 w-full">
                <InputOTPSlot index={0} className="flex-1 text-center py-1 rounded-l-lg border border-neutral-600 bg-transparent text-white h-12" />
                <InputOTPSlot index={1} className="flex-1 text-center py-1 border border-neutral-600 bg-transparent text-white h-12" />
                <InputOTPSlot index={2} className="flex-1 text-center py-1 border border-neutral-600 bg-transparent text-white h-12" />
                <InputOTPSlot index={3} className="flex-1 text-center py-1 border border-neutral-600 bg-transparent text-white h-12" />
                <InputOTPSlot index={4} className="flex-1 text-center py-1 border border-neutral-600 bg-transparent text-white h-12" />
                <InputOTPSlot index={5} className="flex-1 text-center py-1 rounded-r-lg border border-neutral-600 bg-transparent text-white h-12" />
              </InputOTPGroup>
            </InputOTP>

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Confirm Account
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-300">
              Didn't receive the code?{' '}
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isResending}
                className="text-[#ffde5a] hover:text-[#ffde5a]/80 font-medium disabled:opacity-50"
              >
                {isResending ? 'Sending...' : 'Resend Code'}
              </button>
            </p>
          </div>
        </div>
        <div className="mt-6 text-center">
            <Link href="/auth/signin" className="text-gray-300 hover:text-white">
              ← Back to sign in
            </Link>
          </div>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4">
      <div className="text-white">Loading...</div>
    </div>
  );
}

export default function ConfirmSignUpPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ConfirmSignUpContent />
    </Suspense>
  );
}