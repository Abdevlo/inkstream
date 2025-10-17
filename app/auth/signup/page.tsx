'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { validateEmail, validatePassword } from '@/lib/utils/auth-helpers';
import toast from 'react-hot-toast';
import { useDraggableDock } from '@/hooks/use-draggable-dock';

export default function SignUpPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const dockRef = useRef<HTMLDivElement>(null);
  const dockRef2 = useRef<HTMLDivElement>(null);

  // Enable draggable dock
  useDraggableDock(dockRef);

    useDraggableDock(dockRef2);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      newErrors.password = passwordValidation.errors[0];
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          username: formData.username,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Account created! Please check your email for verification code.');
        // Store username and email in localStorage for confirmation
        if (data.username) {
          localStorage.setItem('pendingUsername', data.username);
        }
        localStorage.setItem('pendingEmail', formData.email);
        // Redirect to confirmation page
        setTimeout(() => {
          router.push('/auth/confirm');
        }, 1000);
      } else {
        toast.error(data.error || 'Failed to create account');
        setIsLoading(false);
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      toast.error('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-4" style={{ backgroundImage: "url('/background.svg')", backgroundSize: 'cover' }}>
      <div className="max-w-md w-full">
        <div ref={dockRef} className="backdrop-blur-sm rounded-lg p-8 dock cursor-move select-none">
          <div className="mb-8 cursor-move">
            <h1 className="text-2xl text-white mb-2">Create Account</h1>
            <p className="text-gray-300">Get started with InkStream</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-6 text-white">
            <Input
              label="Email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="you@example.com"
              required
              error={errors.email}
            />

            <Input
              label="Username"
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder="johndoe"
              required
              error={errors.username}
            />

            <Input
              label="Password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              error={errors.password}
            />

            <Input
              label="Confirm Password"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              required
              error={errors.confirmPassword}
            />
            <Button type="submit" className="w-full" isLoading={isLoading}>
              Create Account
            </Button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-300">
              Already have an account?{' '}
              <Link href="/auth/signin" className="text-[#ffde5a] hover:text-[#ffde5a]/80 font-medium">
                Sign in
              </Link>
            </p>
          </div>

          
        </div>

        <div ref={dockRef2} className="text-xs text-gray-300 dock cursor-move select-none">
              <p>Password must contain:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>At least 8 characters</li>
                <li>Uppercase and lowercase letters</li>
                <li>At least one number</li>
                <li>At least one special character</li>
              </ul>
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
