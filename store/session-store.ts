import { create } from 'zustand';
import { ComponentTile, SessionState, StreamSession } from '@/types';

interface SessionStore {
  // Current session
  currentSession: StreamSession | null;
  isHost: boolean;

  // Components
  components: ComponentTile[];
  canvasData: any[];

  // Stream state
  isStreaming: boolean;
  viewerCount: number;

  // Actions
  setCurrentSession: (session: StreamSession | null) => void;
  setIsHost: (isHost: boolean) => void;
  setComponents: (components: ComponentTile[]) => void;
  addComponent: (component: ComponentTile) => void;
  updateComponent: (id: string, updates: Partial<ComponentTile>) => void;
  removeComponent: (id: string) => void;
  setCanvasData: (data: any[]) => void;
  setStreaming: (isStreaming: boolean) => void;
  setViewerCount: (count: number) => void;
  resetSession: () => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  currentSession: null,
  isHost: false,
  components: [],
  canvasData: [],
  isStreaming: false,
  viewerCount: 0,

  setCurrentSession: (session) => set({ currentSession: session }),

  setIsHost: (isHost) => set({ isHost }),

  setComponents: (components) => set({ components }),

  addComponent: (component) =>
    set((state) => ({
      components: [...state.components, component],
    })),

  updateComponent: (id, updates) =>
    set((state) => ({
      components: state.components.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),

  removeComponent: (id) =>
    set((state) => ({
      components: state.components.filter((c) => c.id !== id),
    })),

  setCanvasData: (data) => set({ canvasData: data }),

  setStreaming: (isStreaming) => set({ isStreaming }),

  setViewerCount: (count) => set({ viewerCount: count }),

  resetSession: () =>
    set({
      currentSession: null,
      isHost: false,
      components: [],
      canvasData: [],
      isStreaming: false,
      viewerCount: 0,
    }),
}));
