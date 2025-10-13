'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useProtectedRoute } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { Loading } from '@/components/ui/loading';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/layout/navbar';
import { createSession, getHostSessions } from '@/lib/aws/dynamodb';
import { generateSessionId, formatDate } from '@/lib/utils/session-helpers';
import { StreamSession } from '@/types';
import toast from 'react-hot-toast';
import { clearTokens } from '@/lib/utils/auth-helpers';
import { signOut } from '@/lib/aws/cognito';
import DotGrid from '@/components/DotGrid';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, accessToken } = useProtectedRoute();
  const { logout } = useAuthStore();
  const [sessions, setSessions] = useState<StreamSession[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  const loadSessions = async () => {
    if (!user) return;

    try {
      const result = await getHostSessions(user.id);
      if (result.success && result.data) {
        setSessions(result.data.map(s => ({
          ...s,
          viewerCount: 0,
        })));
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleCreateSession = async () => {
        console.log('Creating session with ID:', user);

    if (!user) return;

    setIsCreating(true);
    try {

      const sessionId = generateSessionId();
      console.log('Creating session with ID:', sessionId);
      const title = `Session ${new Date().toLocaleDateString()}`;

      const result = await createSession(sessionId, user.id, title);

      if (result.success) {
        toast.success('Session created successfully!');
        router.push(`/session/${sessionId}/host`);
      } else {
        toast.error(result.error || 'Failed to create session');
        setIsCreating(false);
      }
    } catch (error) {
      console.error('Error creating session:', error);
      toast.error('An unexpected error occurred');
      setIsCreating(false);
    }
  };

  const handleSignOut = async () => {
    try {
      if (accessToken) {
        await signOut(accessToken);
      }
      clearTokens();
      logout();
      toast.success('Signed out successfully');
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
      toast.error('Failed to sign out');
    }
  };

  if (authLoading || isLoadingSessions) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen">
      <Navbar />

<div className="bg-gradient-to-r from-neutral-900 to-neutral-800 fixed inset-0 -z-10">
  <DotGrid
    dotSize={2}
    gap={10}
    baseColor="#3a3a3aff"
    activeColor="#ffde5a"
    proximity={80}
    shockRadius={60}
    shockStrength={5}
    resistance={750}
    returnDuration={1.5}
  />
</div>


      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 bg-transparent">
        <div className='flex mb-8'>
          {/* Header */}
          <h1 className="text-xl font-bold text-white mr-8">Dashboard</h1>
          {/* Quick Actions */}
          <div className="rounded-lg shadow-md">
            <div className="flex flex-wrap gap-4">
              <Button
                size="sm"
                onClick={handleCreateSession}
                isLoading={isCreating}
                className='flex'
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create New Session
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSignOut}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
        {/* Sessions List */}
        <div className="backdrop-blur-sm rounded-lg shadow-md p-6 border-1 border-[#ffde5a]">
          <h2 className="text-md text-white mb-4 "> ACTIVE SESSIONS</h2>

          {sessions.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No sessions yet</h3>
              <p className="text-gray-600 mb-4">Create your first streaming session to get started</p>
              <Button onClick={handleCreateSession} isLoading={isCreating}>
                Create Session
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Session ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Title</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Created</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.sessionId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono text-sm">{session.sessionId.substring(0, 16)}...</td>
                      <td className="py-3 px-4">{session.title}</td>
                      <td className="py-3 px-4 text-gray-600">{formatDate(session.createdAt)}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            session.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {session.status}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => router.push(`/session/${session.sessionId}/host`)}
                        >
                          Open
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Recording Feature Placeholder */}
          <div className="mt-6 p-4 rounded-lg">
            <h3 className="font-semibold text-white opacity-40 mb-1">Coming Soon: Session Recording</h3>
            <p className="text-sm text-white opacity-40 " >
              Record your sessions and share them later. This feature is under development.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
