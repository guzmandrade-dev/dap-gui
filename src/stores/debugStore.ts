import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DebugProtocol } from '@vscode/debugprotocol';
import { DebugSession } from '../dap/session';
import { LaunchConfiguration } from '../dap/types';

interface DebugState {
  // Session state
  session: DebugSession | null;
  isSessionActive: boolean;
  isPaused: boolean;

  // Data from DAP
  threads: DebugProtocol.Thread[];
  stackFrames: DebugProtocol.StackFrame[];
  scopes: DebugProtocol.Scope[];
  variables: Map<number, DebugProtocol.Variable[]>;

  // Current position
  currentThreadId: number | undefined;
  currentFrameId: number | undefined;
  currentFile: string | undefined;
  currentLine: number | undefined;

  // Breakpoints
  breakpoints: Map<string, Set<number>>;
  breakpointVerified: Map<string, Map<number, boolean>>;

  // Workspace
  workspaceRoot: string;
  recentConfigs: LaunchConfiguration[];

  // Actions
  initialize: () => Promise<void>;
  startSession: (config: LaunchConfiguration) => Promise<void>;
  stopSession: () => Promise<void>;
  continue: () => Promise<void>;
  stepOver: () => Promise<void>;
  stepInto: () => Promise<void>;
  stepOut: () => Promise<void>;
  pause: () => Promise<void>;
  selectFrame: (frameId: number) => void;

  // Event handlers
  onStopped: (body: DebugProtocol.StoppedEvent['body']) => void;
  onStackTrace: (body: DebugProtocol.StackTraceResponse['body']) => void;
  onScopes: (body: DebugProtocol.ScopesResponse['body']) => void;
  onVariables: (data: { frameId: number; scopeId: number; variables: DebugProtocol.Variable[] }) => void;

  // Breakpoint management
  setBreakpoint: (file: string, line: number) => Promise<void>;
  removeBreakpoint: (file: string, line: number) => Promise<void>;
  toggleBreakpointEnabled: (file: string, line: number) => void;
  isBreakpointEnabled: (file: string, line: number) => boolean;

  // Path mapping
  serverToLocalPath: (serverPath: string) => string;
}

export const useDebugStore = create<DebugState>()(
  persist(
    (set, get) => ({
      // Initial state
      session: null,
      isSessionActive: false,
      isPaused: false,
      threads: [],
      stackFrames: [],
      scopes: [],
      variables: new Map(),
      currentThreadId: undefined,
      currentFrameId: undefined,
      currentFile: undefined,
      currentLine: undefined,
      breakpoints: new Map(),
      breakpointVerified: new Map(),
      workspaceRoot: '',
      recentConfigs: [],

      initialize: async () => {
        // Get workspace root from Electron
        if (window.electronAPI) {
          const root = await window.electronAPI.getWorkspaceRoot();
          set({ workspaceRoot: root });
        }
      },

      startSession: async (config) => {
        const session = new DebugSession(config);

        // Get adapter path - for now hardcoded for PHP
        const adapterPath = './node_modules/vscode-php-debug/out/phpDebug.js';

        try {
          await session.start(adapterPath);

          set({
            session,
            isSessionActive: true,
            isPaused: false,
            threads: [],
            stackFrames: [],
            scopes: [],
            variables: new Map(),
            currentThreadId: undefined,
            currentFrameId: undefined,
            currentFile: undefined,
            currentLine: undefined,
          });

          // Subscribe to events
          session.client.on('stopped', (event) => get().onStopped(event));
          session.client.on('stackTrace', (body) => get().onStackTrace(body));
          session.client.on('scopes', (body) => get().onScopes(body));
          session.client.on('variables', (data) => get().onVariables(data));
          session.client.on('terminated', () => {
            get().stopSession();
          });
          session.client.on('exited', () => {
            get().stopSession();
          });

          // Send initial breakpoints
          const { breakpoints } = get();
          for (const [file, lines] of breakpoints.entries()) {
            if (lines.size > 0) {
              await session.setBreakpoints(file, Array.from(lines));
            }
          }

          // Add to recent configs
          const recent = get().recentConfigs.filter(c => c.name !== config.name);
          recent.unshift(config);
          set({ recentConfigs: recent.slice(0, 5) });

        } catch (error) {
          console.error('Failed to start session:', error);
          throw error;
        }
      },

      onStopped: (body) => {
        set({
          isPaused: true,
          currentThreadId: body.threadId,
        });

        if (body.allThreadsStopped) {
          // Handle multi-threaded
        }
      },

      onStackTrace: (body) => {
        set({ stackFrames: body.stackFrames });

        // Update current location from top frame
        if (body.stackFrames.length > 0) {
          const topFrame = body.stackFrames[0];
          const session = get().session;

          // Convert server path to local path
          let localPath = topFrame.source?.path;
          if (session && localPath) {
            localPath = session.serverToLocalPath(localPath);
          }

          set({
            currentFile: localPath,
            currentLine: topFrame.line,
            currentFrameId: topFrame.id,
          });
        }
      },

      onScopes: (body) => {
        set({ scopes: body.scopes });
      },

      onVariables: (data) => {
        const { variables } = get();
        const frameVars = variables.get(data.frameId) || [];
        frameVars.push(...data.variables);
        variables.set(data.frameId, frameVars);
        set({ variables: new Map(variables) });
      },

      stopSession: async () => {
        const { session } = get();
        if (session) {
          try {
            await session.disconnect();
          } catch (e) {
            console.error('Error disconnecting:', e);
          }
        }
        set({
          session: null,
          isSessionActive: false,
          isPaused: false,
          stackFrames: [],
          scopes: [],
          variables: new Map(),
          currentThreadId: undefined,
          currentFrameId: undefined,
          currentFile: undefined,
          currentLine: undefined,
        });
      },

      continue: async () => {
        await get().session?.continue();
        set({ isPaused: false });
      },

      stepOver: async () => {
        await get().session?.stepOver();
      },

      stepInto: async () => {
        await get().session?.stepInto();
      },

      stepOut: async () => {
        await get().session?.stepOut();
      },

      pause: async () => {
        await get().session?.pause();
      },

      selectFrame: (frameId: number) => {
        set({ currentFrameId: frameId });
        // Fetch variables for this frame
        const frame = get().stackFrames.find(f => f.id === frameId);
        if (frame && get().session) {
          // This would trigger a variables fetch
        }
      },

      setBreakpoint: async (file: string, line: number) => {
        // Track locally first
        const breakpoints = new Map(get().breakpoints);
        const fileBPs = breakpoints.get(file) || new Set();
        fileBPs.add(line);
        breakpoints.set(file, fileBPs);

        // Track verification status
        const verified = new Map(get().breakpointVerified);
        const fileVerified = verified.get(file) || new Map();
        fileVerified.set(line, false);
        verified.set(file, fileVerified);

        set({ breakpoints, breakpointVerified: verified });

        // Send to adapter if session active
        const session = get().session;
        if (get().isSessionActive && session) {
          await session.setBreakpoints(file, Array.from(fileBPs));
        }
      },

      removeBreakpoint: async (file: string, line: number) => {
        const breakpoints = new Map(get().breakpoints);
        const fileBPs = breakpoints.get(file);
        if (fileBPs) {
          fileBPs.delete(line);
          if (fileBPs.size === 0) {
            breakpoints.delete(file);
          }
        }

        const verified = new Map(get().breakpointVerified);
        const fileVerified = verified.get(file);
        if (fileVerified) {
          fileVerified.delete(line);
          if (fileVerified.size === 0) {
            verified.delete(file);
          }
        }

        set({ breakpoints, breakpointVerified: verified });

        const session = get().session;
        if (get().isSessionActive && session) {
          const lines = breakpoints.get(file) || new Set();
          await session.setBreakpoints(file, Array.from(lines));
        }
      },

      toggleBreakpointEnabled: (file: string, line: number) => {
        // For now, just toggle removal/re-adding
        const breakpoints = get().breakpoints;
        const fileBPs = breakpoints.get(file);
        if (fileBPs?.has(line)) {
          get().removeBreakpoint(file, line);
        } else {
          get().setBreakpoint(file, line);
        }
      },

      isBreakpointEnabled: (file: string, line: number) => {
        const fileBPs = get().breakpoints.get(file);
        return fileBPs?.has(line) || false;
      },

      serverToLocalPath: (serverPath: string): string => {
        const session = get().session;
        if (session) {
          return session.serverToLocalPath(serverPath);
        }
        return serverPath;
      },
    }),
    {
      name: 'dapdesk-storage',
      partialize: (state) => ({
        recentConfigs: state.recentConfigs,
        breakpoints: state.breakpoints,
      }),
    }
  )
);