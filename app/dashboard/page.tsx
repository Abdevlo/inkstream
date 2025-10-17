'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useProtectedRoute } from '@/hooks/use-auth';
import { useAuthStore } from '@/store/auth-store';
import { Loading } from '@/components/ui/loading';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/layout/navbar';
// Removed direct DynamoDB imports - now using API routes
import { generateSessionId, formatDate } from '@/lib/utils/session-helpers';
import { StreamSession } from '@/types';
import toast from 'react-hot-toast';
import { clearTokens } from '@/lib/utils/auth-helpers';
import { signOut } from '@/lib/aws/cognito';
import DotGrid from '@/components/DotGrid';
import { BentoGrid, BentoWidget as BentoWidgetType } from '@/components/BentoGrid';
import { BentoWidget } from '@/components/BentoWidget';
import SessionCard from '@/components/SessionCard';
import { 
  Plus, 
  LogOut, 
  User, 
  Bot, 
  BarChart3, 
  Calendar, 
  Clock, 
  Settings,
  Activity,
  Zap,
  StickyNote,
  X
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isLoading: authLoading, accessToken } = useProtectedRoute();
  const { logout } = useAuthStore();
  const [sessions, setSessions] = useState<StreamSession[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [widgets, setWidgets] = useState<BentoWidgetType[]>([]);

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  useEffect(() => {
    if (user && sessions.length >= 0) {
      createWidgets();
    }
  }, [user, sessions]);

  const loadSessions = async () => {
    if (!user) return;

    try {
      const response = await fetch(`/api/sessions?hostId=${user.id}`);
      const data = await response.json();

      if (response.ok) {
        setSessions((data.sessions || []).map((s: any) => ({
          ...s,
          viewerCount: 0,
        })));
      } else {
        console.error('Error loading sessions:', data.error);
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const handleCreateSession = async () => {
    if (!user) return;

    setIsCreating(true);
    try {
      const sessionId = generateSessionId();
      console.log('Creating session with ID:', sessionId);
      const title = `Session ${new Date().toLocaleDateString()}`;

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, hostId: user.id, title }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Session created successfully!');
        router.push(`/session/${sessionId}/host`);
      } else {
        toast.error(data.error || 'Failed to create session');
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

  const widgetDefinitions: { [key: string]: BentoWidgetType } = useMemo(() => ({
      'sessions': {
        id: 'sessions',
        gridSize: 'large',
        component: (
          <BentoWidget title="ACTIVE SESSIONS" icon={<Bot size={20} />}>
            {sessions.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <h3 className="text-md font-medium text-gray-100 mb-2">No sessions yet</h3>
                <p className="text-gray-400 text-sm mb-4">Create your first streaming session to get started</p>
                <Button onClick={handleCreateSession} isLoading={isCreating} size="sm">
                  Create Session
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-2 h-full overflow-y-auto">
                {sessions.map((session) => (
                  <div key={session.sessionId} className="overflow-visible">
                    <SessionCard
                      title={session.title}
                      sessionId={`ID: ${session.sessionId.substring(0, 16)}...`}
                      dateOfCreation={`Created: ${formatDate(session.createdAt)}`}
                      onClick={() => router.push(`/session/${session.sessionId}/host`)}
                      status={session.status}
                      particleCount={8}
                      glowColor="255, 200, 80"
                      enableTilt={true}
                      enableMagnetism={true}
                      clickEffect={true}
                    />
                  </div>
                ))}
              </div>
            )}
          </BentoWidget>
        )
      },
      'profile': {
        id: 'profile',
        gridSize: 'small',
        component: (
          <BentoWidget title="Profile" icon={<User size={20} />}>
            <div className="text-center">
              <div className="w-16 h-16 bg-[#ffde5a] rounded-full mx-auto mb-3 flex items-center justify-center">
                <User size={32} className="text-black" />
              </div>
              <h4 className="text-[#ffde5a] font-semibold text-sm">{user?.email?.split('@')[0] || 'User'}</h4>
              <p className="text-white text-xs mb-1">{user?.email}</p>
              <p className="text-white/70 text-xs mb-3">Host Account</p>
              
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-white">
                  <span>Sessions:</span>
                  <span className="text-[#ffde5a] font-medium">{sessions.length}</span>
                </div>
                <div className="flex justify-between text-white">
                  <span>Active:</span>
                  <span className="text-[#ffde5a] font-medium">
                    {sessions.filter(s => s.status === 'active').length}
                  </span>
                </div>
              </div>
            </div>
          </BentoWidget>
        )
      },
      'ai-chat': {
        id: 'ai-chat',
        gridSize: 'medium',
        component: (
          <BentoWidget title="AI Assistant" icon={<Bot size={20} />}>
            <div className="flex flex-col h-full">
              <div className="flex-1 space-y-2 text-xs overflow-y-auto mb-3">
                <div className="bg-[#ffde5a]/10 border border-[#ffde5a]/30 rounded-lg p-2 text-white">
                  <p>👋 Hello! I'm your streaming assistant. How can I help you today?</p>
                </div>
                <div className="bg-[#ffde5a]/20 border border-[#ffde5a]/40 text-white rounded-lg p-2 ml-4 text-right">
                  <p>How do I improve my stream quality?</p>
                </div>
                <div className="bg-[#ffde5a]/10 border border-[#ffde5a]/30 rounded-lg p-2 text-white">
                  <p>Great question! Use good lighting and test your setup before going live.</p>
                </div>
              </div>
              
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="Ask me anything..." 
                  className="flex-1 bg-black border border-[#ffde5a]/40 rounded p-2 text-white text-xs placeholder-white/60"
                />
                <button className="px-3 py-2 bg-[#ffde5a] hover:bg-[#ffde5a]/80 text-black rounded text-xs font-medium">
                  Send
                </button>
              </div>
            </div>
          </BentoWidget>
        )
      },
      'analytics': {
        id: 'analytics',
        gridSize: 'medium',
        component: (
          <BentoWidget title="Analytics Overview" icon={<BarChart3 size={20} />}>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#ffde5a]/10 border border-[#ffde5a]/30 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-[#ffde5a]">1,234</div>
                <div className="text-xs text-white">Total Views</div>
              </div>
              <div className="bg-[#ffde5a]/10 border border-[#ffde5a]/30 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-[#ffde5a]">56</div>
                <div className="text-xs text-white">Avg Viewers</div>
              </div>
              <div className="bg-[#ffde5a]/10 border border-[#ffde5a]/30 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-[#ffde5a]">2.4h</div>
                <div className="text-xs text-white">Stream Time</div>
              </div>
              <div className="bg-[#ffde5a]/10 border border-[#ffde5a]/30 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-[#ffde5a]">89%</div>
                <div className="text-xs text-white">Engagement</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-white">
                <span>Performance</span>
                <span className="text-[#ffde5a]">Excellent</span>
              </div>
              <div className="w-full bg-white/20 rounded h-1.5">
                <div className="bg-[#ffde5a] h-1.5 rounded" style={{width: '85%'}}></div>
              </div>
            </div>
          </BentoWidget>
        )
      },
      'quick-actions': {
        id: 'quick-actions',
        gridSize: 'small',
        component: (
          <BentoWidget title="Quick Actions" icon={<Zap size={20} />}>
            <div className="space-y-2">
              <button 
                onClick={handleCreateSession}
                disabled={isCreating}
                className="w-full bg-[#ffde5a]/20 hover:bg-[#ffde5a]/30 border border-[#ffde5a]/40 text-[#ffde5a] rounded-lg p-2 text-xs font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Plus size={14} />
                New Session
              </button>
              
              <button 
                onClick={() => toast('Settings panel coming soon!', { icon: '⚙️' })}
                className="w-full bg-[#ffde5a]/20 hover:bg-[#ffde5a]/30 border border-[#ffde5a]/40 text-[#ffde5a] rounded-lg p-2 text-xs font-medium transition-colors flex items-center gap-2"
              >
                <Settings size={14} />
                Settings
              </button>
              
              <button 
                onClick={() => toast.success('System Status: All systems operational ✅')}
                className="w-full bg-[#ffde5a]/20 hover:bg-[#ffde5a]/30 border border-[#ffde5a]/40 text-[#ffde5a] rounded-lg p-2 text-xs font-medium transition-colors flex items-center gap-2"
              >
                <Activity size={14} />
                System Status
              </button>
            </div>
          </BentoWidget>
        )
      },
      'time-calendar': {
        id: 'time-calendar',
        gridSize: 'small',
        component: (
          <BentoWidget title="Time & Schedule" icon={<Clock size={20} />}>
            <div className="text-center mb-3">
              <div className="text-2xl font-bold text-[#ffde5a]">
                {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </div>
              <div className="text-xs text-white">
                {new Date().toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </div>
            </div>

            <div className="bg-[#ffde5a]/10 border border-[#ffde5a]/30 rounded-lg p-2">
              <div className="flex items-center gap-2 mb-2">
                <Calendar size={12} className="text-[#ffde5a]" />
                <span className="text-[#ffde5a] text-xs font-medium">Upcoming</span>
              </div>
              <div className="space-y-1 text-xs text-white">
                <div className="flex justify-between">
                  <span>Team Meeting</span>
                  <span>2:00 PM</span>
                </div>
                <div className="flex justify-between">
                  <span>Live Stream</span>
                  <span>4:30 PM</span>
                </div>
              </div>
            </div>
          </BentoWidget>
        )
      },
      'notes': {
        id: 'notes',
        gridSize: 'small',
        component: (
          <BentoWidget title="Quick Notes" icon={<StickyNote size={20} />}>
            <div className="space-y-2 mb-3 max-h-20 overflow-y-auto">
              <div className="bg-[#ffde5a]/10 border border-[#ffde5a]/30 rounded-lg p-2 relative group">
                <div className="text-xs text-white pr-4">Check stream quality before going live</div>
                <button className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={10} className="text-[#ffde5a]" />
                </button>
              </div>
              <div className="bg-[#ffde5a]/10 border border-[#ffde5a]/30 rounded-lg p-2 relative group">
                <div className="text-xs text-white pr-4">Update widgets layout</div>
                <button className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <X size={10} className="text-[#ffde5a]" />
                </button>
              </div>
            </div>

            <div className="mt-auto">
              <textarea 
                placeholder="Add a new note..." 
                className="w-full h-12 bg-black border border-[#ffde5a]/40 rounded-lg p-2 text-white text-xs placeholder-white/60 resize-none focus:outline-none focus:border-[#ffde5a]"
              />
              <button className="w-full mt-2 bg-[#ffde5a]/20 hover:bg-[#ffde5a]/30 border border-[#ffde5a]/40 text-[#ffde5a] rounded-lg p-1 text-xs font-medium transition-colors">
                Add Note
              </button>
            </div>
          </BentoWidget>
        )
      }
    }), [user, sessions, isCreating, handleCreateSession]);

  const createWidgets = () => {
    // Default order
    const defaultOrder = ['sessions', 'profile', 'ai-chat', 'analytics', 'quick-actions', 'time-calendar', 'notes'];
    
    // Load saved order from localStorage
    let savedOrder: string[] = defaultOrder;
    try {
      const saved = localStorage.getItem('dashboard-widget-order');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Ensure all saved widget IDs exist in our definitions
          savedOrder = parsed.filter(id => widgetDefinitions[id]);
          // Add any missing widgets that might have been added since last save
          defaultOrder.forEach(id => {
            if (!savedOrder.includes(id)) {
              savedOrder.push(id);
            }
          });
        }
      }
    } catch (error) {
      console.warn('Failed to load widget order from localStorage:', error);
    }

    // Create widgets array in saved order
    const newWidgets: BentoWidgetType[] = savedOrder.map(id => widgetDefinitions[id]).filter(Boolean);
    
    setWidgets(newWidgets);
  };

  const handleWidgetMove = (fromIndex: number, toIndex: number) => {
    const newWidgets = [...widgets];
    const [movedWidget] = newWidgets.splice(fromIndex, 1);
    newWidgets.splice(toIndex, 0, movedWidget);
    setWidgets(newWidgets);
    
    // Optionally save to localStorage
    localStorage.setItem('dashboard-widget-order', JSON.stringify(newWidgets.map(w => w.id)));
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


      <main className="w-full bg-transparent min-h-screen overflow-y-auto">
        <div className='flex px-4 sm:px-6 lg:px-8 py-6 mb-2'>
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
                <Plus className="w-5 h-5 mr-2" />
                Create New Session
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSignOut}
                className='flex'
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
        {/* Bento Grid Dashboard */}
        <BentoGrid 
          widgets={widgets} 
          onWidgetMove={handleWidgetMove}
        />

      </main>
    </div>
  );
}
