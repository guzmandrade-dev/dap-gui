# DAP Debugger GUI - Detailed Development Plan

## Executive Summary
Building **"simple-dap-gui"** (working title) - A standalone DAP client GUI app using Electron + TypeScript + React + Monaco Editor.

---

## Phase 0: Project Setup (Tonight - 2-3 hours)

### Tech Stack Decisions

| Component | Choice | Reason |
|-----------|--------|--------|
| **Framework** | Electron + Vite | Fast dev server, hot reload, modern build |
| **UI** | React + Tailwind CSS | Standard, fast to build, good debugger UIs |
| **Editor** | Monaco Editor | VS Code's editor, has DAP-like features built-in |
| **State** | Zustand | Simple, no boilerplate, good for debugger state |
| **Language** | TypeScript | DAP is typed, we want safety |

### Initial Setup Commands

```bash
# Create project
npm create electron@latest simple-dap-gui -- --template=react-ts
cd simple-dap-gui

# Add dependencies
npm install @monaco-editor/react monaco-editor zustand
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# For DAP client types
npm install @vscode/debugprotocol

# For testing adapters  
npm install vscode-php-debug --save-dev  # We'll use this for testing
```

### Folder Structure

```
simple-dap-gui/
├── electron/                 # Electron main process
│   ├── main.ts              # Entry point
│   ├── preload.ts           # Preload script, exposes safe APIs
│   └── adapters/            # Bundled debug adapters
│       ├── php/             # vscode-php-debug
│       ├── python/          # debugpy
│       └── cpp/             # cpptools (optional)
├── src/
│   ├── dap/                 # DAP protocol implementation
│   │   ├── client.ts        # Core DAP client (spawns adapters)
│   │   ├── session.ts       # Debug session management
│   │   └── types.ts         # Extended types
│   ├── components/          # React components
│   │   ├── Editor/          # Monaco wrapper
│   │   ├── Panels/          # Side panels (stack, variables, etc)
│   │   ├── Toolbar/         # Debug controls
│   │   └── Breakpoints/     # Breakpoint list
│   ├── stores/              # Zustand stores
│   │   ├── debugStore.ts    # Core debugger state
│   │   ├── editorStore.ts   # Editor state
│   │   └── configStore.ts   # Launch configs
│   ├── hooks/               # React hooks
│   │   ├── useDAP.ts        # DAP communication hook
│   │   └── useBreakpoints.ts
│   ├── utils/               # Helpers
│   │   ├── pathMapping.ts   # Server <-> local path conversion
│   │   └── fileLoader.ts    # Read file contents
│   └── App.tsx              # Main layout
├── adapters/                # Git submodule or copy of adapters
├── resources/               # Static assets
└── tests/                   # Test projects (PHP, Python, etc)
    └── php-test/
        └── index.php
```

---

## Phase 1: Core DAP Client (Day 1-2)

### 1.1 DAP Protocol Parser

**File: `src/dap/client.ts`**

```typescript
import { EventEmitter } from 'events';
import { DebugProtocol } from '@vscode/debugprotocol';

export class DAPClient extends EventEmitter {
  private adapter: ChildProcess | null = null;
  private seq = 0;
  private pendingRequests = new Map<number, (response: any) => void>();
  private buffer = '';
  private contentLength = -1;

  async spawn(adapterPath: string, args: string[] = []) {
    const { spawn } = await import('child_process');
    
    this.adapter = spawn('node', [adapterPath, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this.adapter.stdout?.on('data', this.onData.bind(this));
    this.adapter.stderr?.on('data', (data) => {
      console.error('Adapter stderr:', data.toString());
    });

    this.adapter.on('close', () => {
      this.emit('closed');
    });
  }

  private onData(chunk: Buffer) {
    this.buffer += chunk.toString();
    this.processBuffer();
  }

  // DAP uses Content-Length header followed by JSON body
  private processBuffer() {
    while (true) {
      if (this.contentLength < 0) {
        const headerEnd = this.buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;
        
        const header = this.buffer.substring(0, headerEnd);
        const match = header.match(/Content-Length: (\d+)/);
        if (!match) throw new Error('Invalid DAP header');
        
        this.contentLength = parseInt(match[1], 10);
        this.buffer = this.buffer.substring(headerEnd + 4);
      }

      if (this.buffer.length < this.contentLength) return;

      const messageStr = this.buffer.substring(0, this.contentLength);
      this.buffer = this.buffer.substring(this.contentLength);
      this.contentLength = -1;

      const message = JSON.parse(messageStr) as DebugProtocol.ProtocolMessage;
      this.handleMessage(message);
    }
  }

  sendRequest<T extends DebugProtocol.Request>(
    command: T['command'],
    args?: T['arguments']
  ): Promise<DebugProtocol.Response> {
    this.seq++;
    const request: DebugProtocol.Request = {
      seq: this.seq,
      type: 'request',
      command,
      arguments: args,
    };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(this.seq, resolve);
      
      const json = JSON.stringify(request);
      const header = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n`;
      this.adapter?.stdin?.write(header + json);
      
      setTimeout(() => {
        reject(new Error(`Request timeout: ${command}`));
      }, 5000);
    });
  }

  private handleMessage(message: DebugProtocol.ProtocolMessage) {
    if (message.type === 'response') {
      const handler = this.pendingRequests.get(message.request_seq);
      if (handler) {
        handler(message);
        this.pendingRequests.delete(message.request_seq);
      }
    } else if (message.type === 'event') {
      this.emit('event', message as DebugProtocol.Event);
      this.emit(message.event, (message as DebugProtocol.Event).body);
    }
  }

  dispose() {
    this.adapter?.kill();
  }
}
```

### 1.2 Session Manager

**File: `src/dap/session.ts`**

```typescript
export class DebugSession {
  client: DAPClient;
  private threads: Map<number, DebugProtocol.Thread> = new Map();
  private currentThreadId: number | undefined;

  constructor(private config: LaunchConfiguration) {
    this.client = new DAPClient();
    this.setupEventHandlers();
  }

  private setupEventHandlers() {
    this.client.on('stopped', this.onStopped.bind(this));
    this.client.on('output', this.onOutput.bind(this));
    this.client.on('breakpoint', this.onBreakpointEvent.bind(this));
  }

  async start(adapterPath: string) {
    await this.client.spawn(adapterPath);
    
    // Initialize sequence
    const initResponse = await this.client.sendRequest('initialize', {
      clientID: 'simple-dap-gui',
      clientName: 'simple-dap-gui',
      adapterID: this.config.type,
      pathFormat: 'path',
      linesStartAt1: true,
      columnsStartAt1: true,
      supportsVariableType: true,
      supportsRunInTerminalRequest: false,
    });

    if (this.config.request === 'launch') {
      await this.client.sendRequest('launch', this.config);
    } else {
      await this.client.sendRequest('attach', this.config);
    }
  }

  private async onStopped(event: DebugProtocol.StoppedEvent['body']) {
    this.currentThreadId = event.threadId;
    
    // Always fetch stack trace on stop
    if (event.threadId) {
      const stack = await this.client.sendRequest('stackTrace', {
        threadId: event.threadId,
        startFrame: 0,
        levels: 20,
      });
      
      // Emit for UI
      this.client.emit('stackTrace', stack.body);
      
      // Fetch variables for top frame
      if (stack.body.stackFrames.length > 0) {
        await this.fetchVariables(stack.body.stackFrames[0].id);
      }
    }
  }

  async setBreakpoints(filePath: string, lines: number[]) {
    // Convert local path to server path if needed
    const serverPath = this.localToServerPath(filePath);
    
    await this.client.sendRequest('setBreakpoints', {
      source: { path: serverPath },
      breakpoints: lines.map(line => ({ line })),
    });
  }

  async stepOver() {
    if (this.currentThreadId) {
      await this.client.sendRequest('next', {
        threadId: this.currentThreadId,
      });
    }
  }

  async continue() {
    if (this.currentThreadId) {
      await this.client.sendRequest('continue', {
        threadId: this.currentThreadId,
      });
    }
  }

  private localToServerPath(localPath: string): string {
    // Implement path mapping logic here
    // For now, return as-is
    return localPath;
  }
}
```

---

## Phase 2: UI Components (Day 2-3)

### 2.1 Main Layout

**File: `src/App.tsx`**

```tsx
import { useEffect } from 'react';
import { useDebugStore } from './stores/debugStore';
import { Toolbar } from './components/Toolbar/Toolbar';
import { Sidebar } from './components/Panels/Sidebar';
import { CodeViewer } from './components/Editor/CodeViewer';
import { StatusBar } from './components/StatusBar/StatusBar';

function App() {
  const { initialize, isSessionActive } = useDebugStore();

  useEffect(() => {
    initialize();
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-100">
      <Toolbar />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar className="w-72 border-r border-gray-700" />
        
        <main className="flex-1 flex flex-col">
          <CodeViewer className="flex-1" />
        </main>
      </div>
      
      <StatusBar isActive={isSessionActive} />
    </div>
  );
}
```

### 2.2 Monaco Editor with Breakpoints

**File: `src/components/Editor/CodeViewer.tsx`**

```tsx
import Editor, { OnMount, loader } from '@monaco-editor/react';
import { useEffect, useRef, useCallback } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { useDebugStore } from '../../stores/debugStore';

loader.config({ paths: { vs: './node_modules/monaco-editor/min/vs' } });

export function CodeViewer({ className }: { className?: string }) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  
  const { currentFile, currentLine, decorations, openFile } = useEditorStore();
  const { setBreakpoint, removeBreakpoint, isPaused } = useDebugStore();

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Click gutter to toggle breakpoint
    editor.onMouseDown((e: any) => {
      if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
          e.target.type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS) {
        const line = e.target.position.lineNumber;
        const hasBP = decorations.breakpoints.has(line);
        
        if (hasBP) {
          removeBreakpoint(currentFile, line);
        } else {
          setBreakpoint(currentFile, line);
        }
      }
    });
  };

  // Update decorations when state changes
  useEffect(() => {
    if (!editorRef.current) return;
    
    const model = editorRef.current.getModel();
    if (!model || model.uri.path !== currentFile) {
      // Load new file
      if (currentFile) {
        fetchFileContent(currentFile).then(content => {
          monacoRef.current.editor.createModel(
            content,
            getLanguageForFile(currentFile),
            monacoRef.current.Uri.file(currentFile)
          );
        });
      }
      return;
    }

    // Apply decorations (breakpoints + current line)
    const newDecorations: any[] = [];
    
    // Breakpoints
    decorations.breakpoints.forEach(line => {
      newDecorations.push({
        range: new monacoRef.current.Range(line, 1, line, 1),
        options: {
          glyphMarginClassName: 'breakpoint-glyph',
          overviewRuler: { color: '#ff0000', position: 1 },
          minimap: { color: '#ff0000', position: 1 },
        }
      });
    });
    
    // Current execution line
    if (isPaused && currentLine) {
      newDecorations.push({
        range: new monacoRef.current.Range(currentLine, 1, currentLine, 1),
        options: {
          isWholeLine: true,
          className: 'current-line-highlight',
          glyphMarginClassName: 'current-line-glyph',
        }
      });
      
      // Center on current line
      editorRef.current.revealLineInCenter(currentLine);
    }

    editorRef.current.deltaDecorations([], newDecorations);
  }, [currentFile, currentLine, decorations, isPaused]);

  return (
    <div className={className}>
      <Editor
        height="100%"
        theme="vs-dark"
        path={currentFile}
        defaultLanguage="php"
        options={{
          readOnly: true,
          glyphMargin: true,
          lineNumbers: 'on',
          folding: true,
          minimap: { enabled: true },
        }}
        onMount={handleEditorMount}
      />
    </div>
  );
}

async function fetchFileContent(path: string): Promise<string> {
  // Use Electron's IPC to read file
  const { ipcRenderer } = require('electron');
  return ipcRenderer.invoke('read-file', path);
}

function getLanguageForFile(path: string): string {
  const ext = path.split('.').pop();
  const map: Record<string, string> = {
    'php': 'php',
    'js': 'javascript',
    'ts': 'typescript',
    'py': 'python',
    'c': 'c',
    'cpp': 'cpp',
  };
  return map[ext || ''] || 'plaintext';
}
```

### 2.3 Debug Store (Zustand)

**File: `src/stores/debugStore.ts`**

```typescript
import { create } from 'zustand';
import { DebugSession } from '../dap/session';
import { persist } from 'zustand/middleware';

interface DebugState {
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
  
  // Actions
  initialize: () => void;
  startSession: (config: LaunchConfiguration) => Promise<void>;
  stopSession: () => void;
  setBreakpoint: (file: string, line: number) => void;
  removeBreakpoint: (file: string, line: number) => void;
  continue: () => Promise<void>;
  stepOver: () => Promise<void>;
  stepInto: () => Promise<void>;
  stepOut: () => Promise<void>;
  
  // Event handlers
  onStopped: (body: DebugProtocol.StoppedEvent['body']) => void;
  onStackTrace: (body: DebugProtocol.StackTraceResponse['body']) => void;
}

export const useDebugStore = create<DebugState>()(
  persist(
    (set, get) => ({
      // Initial state...
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

      initialize: () => {
        // Load recent configs, etc
      },

      startSession: async (config) => {
        const session = new DebugSession(config);
        
        // Find adapter path based on config.type
        const adapterPath = getAdapterPath(config.type);
        
        await session.start(adapterPath);
        
        set({ 
          session, 
          isSessionActive: true,
          isPaused: false 
        });

        // Subscribe to events
        session.client.on('stopped', get().onStopped);
        session.client.on('stackTrace', get().onStackTrace);
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
          set({
            currentFile: topFrame.source?.path,
            currentLine: topFrame.line,
            currentFrameId: topFrame.id,
          });
        }
      },

      stopSession: () => {
        const { session } = get();
        session?.client.sendRequest('disconnect');
        session?.client.dispose();
        set({ session: null, isSessionActive: false, isPaused: false });
      },

      continue: async () => {
        await get().session?.continue();
        set({ isPaused: false });
      },

      // ... stepOver, stepInto, stepOut similar
      
      setBreakpoint: async (file, line) => {
        // Track locally first
        const fileBPs = get().breakpoints.get(file) || new Set();
        fileBPs.add(line);
        get().breakpoints.set(file, fileBPs);
        
        // Send to adapter if session active
        if (get().isSessionActive) {
          await get().session?.setBreakpoints(file, Array.from(fileBPs));
        }
      },

      removeBreakpoint: async (file, line) => {
        const fileBPs = get().breakpoints.get(file) || new Set();
        fileBPs.delete(line);
        
        if (get().isSessionActive) {
          await get().session?.setBreakpoints(file, Array.from(fileBPs));
        }
      },
    }),
    {
      name: 'simple-dap-gui-storage',
      partialize: (state) => ({ recentConfigs: state.recentConfigs }),
    }
  )
);

function getAdapterPath(type: string): string {
  // Map type to bundled adapter
  const paths: Record<string, string> = {
    'php': './electron/adapters/php/out/phpDebug.js',
    'python': './electron/adapters/python/adapter.py',
    'cppdbg': './electron/adapters/cpp/adapter',
  };
  return paths[type] || throw new Error(`Unknown adapter type: ${type}`);
}
```

---

## Phase 3: Adapter Integration (Day 3-4)

### 3.1 Bundle vscode-php-debug

```bash
# In your project root
mkdir -p adapters/php
cd adapters/php
npm init -y

# Install the adapter
npm install vscode-php-debug

# Copy the built output to your electron folder
cp -r node_modules/vscode-php-debug/out ../../electron/adapters/php/
```

### 3.2 Electron Main Process IPC

**File: `electron/main.ts`**

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
};

app.whenReady().then(createWindow);

// IPC handlers
ipcMain.handle('read-file', async (event, filePath: string) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (err) {
    throw new Error(`Failed to read ${filePath}: ${err}`);
  }
});

ipcMain.handle('get-launch-config', async () => {
  // Read .vscode/launch.json from current workspace
  try {
    const configPath = path.join(process.cwd(), '.vscode', 'launch.json');
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
});
```

**File: `electron/preload.ts`**

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  readFile: (path: string) => ipcRenderer.invoke('read-file', path),
  getLaunchConfig: () => ipcRenderer.invoke('get-launch-config'),
});
```

### 3.3 Launch Configuration Manager

**File: `src/utils/config.ts`**

```typescript
export interface LaunchConfiguration extends DebugProtocol.LaunchRequestArguments {
  type: string;
  request: 'launch' | 'attach';
  name: string;
  // Language-specific options
  program?: string;
  port?: number;
  pathMappings?: Record<string, string>;
  stopOnEntry?: boolean;
}

export async function loadConfigs(): Promise<LaunchConfiguration[]> {
  // Try to load from .vscode/launch.json first
  const vscodeConfig = await window.electronAPI?.getLaunchConfig();
  if (vscodeConfig?.configurations) {
    return vscodeConfig.configurations;
  }
  
  // Fall back to app's own config store
  return [];
}

export function resolvePathMappings(
  serverPath: string,
  mappings: Record<string, string>,
  workspaceRoot: string
): string {
  for (const [serverPrefix, localPrefix] of Object.entries(mappings)) {
    const resolvedLocal = localPrefix.replace('${workspaceFolder}', workspaceRoot);
    if (serverPath.startsWith(serverPrefix)) {
      return serverPath.replace(serverPrefix, resolvedLocal);
    }
  }
  return serverPath;
}
```

---

## Phase 4: Side Panels (Day 4-5)

### 4.1 Call Stack Panel

```tsx
function CallStackPanel() {
  const { stackFrames, currentFrameId, selectFrame } = useDebugStore();
  
  return (
    <div className="p-2 overflow-auto">
      <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Call Stack</h3>
      <div className="space-y-1">
        {stackFrames.map((frame, idx) => (
          <div
            key={frame.id}
            onClick={() => selectFrame(frame.id)}
            className={`cursor-pointer p-2 rounded text-sm ${
              frame.id === currentFrameId 
                ? 'bg-blue-600 text-white' 
                : 'hover:bg-gray-700'
            }`}
          >
            <div className="font-medium">{frame.name}</div>
            <div className="text-xs opacity-75 truncate">
              {frame.source?.path?.split('/').pop()}:{frame.line}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 4.2 Variables Panel

```tsx
function VariablesPanel() {
  const { variables, scopes, currentFrameId } = useDebugStore();
  
  const frameVariables = variables.get(currentFrameId || 0) || [];
  
  return (
    <div className="p-2">
      <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Variables</h3>
      <div className="font-mono text-sm">
        {frameVariables.map(var => (
          <VariableTree 
            key={var.name} 
            variable={var}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
}

function VariableTree({ 
  variable, 
  depth 
}: { 
  variable: DebugProtocol.Variable; 
  depth: number 
}) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div style={{ marginLeft: depth * 12 }}>
      <div 
        className="flex items-center gap-1 cursor-pointer hover:bg-gray-800 p-1"
        onClick={() => variable.variablesReference && setExpanded(!expanded)}
      >
        {variable.variablesReference > 0 && (
          <span className="text-gray-500">{expanded ? '▼' : '▶'}</span>
        )}
        <span className="text-blue-400">{variable.name}</span>
        <span className="text-gray-500">=</span>
        <span className={getValueColor(variable.type)}>{variable.value}</span>
      </div>
      {expanded && (
        <ChildrenVariables 
          reference={variable.variablesReference} 
          depth={depth + 1} 
        />
      )}
    </div>
  );
}
```

### 4.3 Breakpoints Panel

```tsx
function BreakpointsPanel() {
  const { breakpoints, removeBreakpoint, toggleBreakpointEnabled } = useDebugStore();
  
  return (
    <div className="p-2">
      <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Breakpoints</h3>
      {Array.from(breakpoints.entries()).map(([file, lines]) => (
        lines.map(line => (
          <div key={`${file}:${line}`} className="flex items-center gap-2 p-1 hover:bg-gray-800">
            <input 
              type="checkbox" 
              checked={isEnabled(file, line)}
              onChange={() => toggleBreakpointEnabled(file, line)}
            />
            <span className="text-xs truncate flex-1">
              {file.split('/').pop()}:{line}
            </span>
            <button 
              onClick={() => removeBreakpoint(file, line)}
              className="text-red-400 hover:text-red-300"
            >
              ×
            </button>
          </div>
        ))
      ))}
    </div>
  );
}
```

---

## Phase 5: Toolbar & Controls (Day 5)

```tsx
function Toolbar() {
  const { isSessionActive, isPaused, startSession, stopSession, continue, stepOver } = useDebugStore();
  
  return (
    <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-4 gap-4">
      <div className="flex gap-2">
        {!isSessionActive ? (
          <button 
            onClick={() => startSession(selectedConfig)}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded"
          >
            ▶ Debug
          </button>
        ) : (
          <>
            <button 
              onClick={stopSession}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded"
            >
              ⏹ Stop
            </button>
            
            {isPaused ? (
              <>
                <button onClick={continue} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded">
                  ▶ Continue
                </button>
                <button onClick={stepOver} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded">
                  ⤷ Step Over
                </button>
                <button onClick={stepInto} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded">
                  ⤵ Step Into
                </button>
                <button onClick={stepOut} className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded">
                  ⤴ Step Out
                </button>
              </>
            ) : (
              <button onClick={pause} className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 rounded">
                ⏸ Pause
              </button>
            )}
          </>
        )}
      </div>
      
      <div className="flex-1">
        <ConfigSelector />
      </div>
      
      <div className="text-sm text-gray-400">
        {isSessionActive && (isPaused ? '⏸ Paused' : '▶ Running')}
      </div>
    </div>
  );
}
```

---

## Phase 6: Styling & Polish (Day 5-6)

### CSS for Monaco customizations

```css
/* Add to your index.css */
.breakpoint-glyph {
  background: #ff4444;
  border-radius: 50%;
  width: 10px !important;
  height: 10px !important;
  margin-left: 2px;
}

.current-line-highlight {
  background: rgba(255, 255, 0, 0.15);
  border-left: 3px solid #ffeb3b;
}

.breakpoint-glyph.current-line-glyph {
  background: #ffeb3b;
  border: 2px solid #ff4444;
}
```

---

## Testing Strategy

### PHP Test Project

Create `tests/php-test/index.php`:

```php
<?php
function factorial($n) {
    if ($n <= 1) return 1;
    return $n * factorial($n - 1); // Set breakpoint here
}

$name = $_GET['name'] ?? 'World';
$greeting = "Hello, $name!";

$result = factorial(5); // Set breakpoint here

echo $greeting;
echo "Factorial: $result";
```

### Launch Config

`.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Listen for XDebug",
      "type": "php",
      "request": "launch",
      "port": 9003,
      "pathMappings": {
        "/var/www/html": "${workspaceFolder}"
      }
    }
  ]
}
```

---

## Common Pitfalls & Solutions

| Problem | Solution |
|---------|----------|
| **Path mapping** | Store user's workspace root, always convert server↔local paths |
| **UTF-8 in DAP** | `Buffer.byteLength(json)` vs `json.length` (use byte length!) |
| **Adapter crashes** | Wrap spawn in try/catch, show proper error UI |
| **Large files** | Monaco handles this, but don't load entire file trees |
| **Multiple threads** | Always include `threadId` in requests, show thread picker |
| **Debugger stops unexpectedly** | Listen for `terminated` and `exited` events |
| **Variable expansion** | Use lazy loading via `variablesRequest` with `variablesReference` |

---

## Day-by-Day Checklist

### ✅ Day 1 (Today)
- [ ] Project setup with Vite + Electron + TS
- [ ] Install Monaco, Zustand, DAP types
- [ ] Create `DAPClient` class with protocol parser
- [ ] Test: Spawn adapter, send `initialize`, log response

### Day 2
- [ ] Create `DebugSession` class
- [ ] Implement path mapping utilities
- [ ] Build launch configuration loader
- [ ] Test: Start session with PHP adapter

### Day 3
- [ ] Monaco Editor integration
- [ ] Gutter click handlers for breakpoints
- [ ] Decoration management (breakpoints + current line)
- [ ] Create React components structure

### Day 4
- [ ] Store implementation with Zustand
- [ ] Stack trace panel
- [ ] Variables panel (basic)
- [ ] IPC handlers for file reading

### Day 5
- [ ] Toolbar with controls
- [ ] Breakpoints list panel
- [ ] Config selector
- [ ] Polish CSS/styling

### Day 6
- [ ] Bundle adapters (npm scripts)
- [ ] Build & package
- [ ] Test with real PHP project
- [ ] README + documentation

---

## Future Enhancement Ideas
- [ ] Watch expressions (evaluate on every step)
- [ ] Debug console (REPL)
- [ ] Conditional breakpoints
- [ ] Logpoints
- [ ] Multi-session support
- [ ] Remote development (SSH)
- [ ] Adapter marketplace (download adapters on demand)
