import { DebugProtocol } from '@vscode/debugprotocol';

export interface LaunchConfiguration extends DebugProtocol.LaunchRequestArguments {
  type: string;
  request: 'launch' | 'attach';
  name: string;
  // Language-specific options
  program?: string;
  port?: number;
  pathMappings?: Record<string, string>;
  stopOnEntry?: boolean;
  // PHP-specific
  runtimeArgs?: string[];
  env?: Record<string, string | null>;
  // Python-specific
  console?: string;
  justMyCode?: boolean;
  // C/C++ specific
  miDebuggerPath?: string;
  setupCommands?: Array<{ description: string; enable: string; ignoreFailures: boolean; text: string }>;
}

// Extended DAP types
export interface Thread {
  id: number;
  name: string;
}

export interface StackFrame {
  id: number;
  name: string;
  source?: Source;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  moduleId?: string | number;
  presentationHint?: 'normal' | 'label' | 'subtle';
}

export interface Source {
  name?: string;
  path?: string;
  sourceReference?: number;
  presentationHint?: 'normal' | 'emphasize' | 'deemphasize';
  origin?: string;
  sources?: Source[];
  adapterData?: any;
  checksums?: DebugProtocol.Checksum[];
}

export interface Scope {
  name: string;
  variablesReference: number;
  namedVariables?: number;
  indexedVariables?: number;
  expensive: boolean;
  source?: Source;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
}

export interface Variable {
  name: string;
  value: string;
  type?: string;
  presentationHint?: DebugProtocol.VariablePresentationHint;
  evaluateName?: string;
  variablesReference: number;
  namedVariables?: number;
  indexedVariables?: number;
  memoryReference?: string;
}

// Breakpoint tracking
export interface Breakpoint {
  id?: number;
  verified: boolean;
  message?: string;
  source?: Source;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  instructionReference?: string;
  offset?: number;
}

// Path mapping entry
export interface PathMapping {
  serverPath: string;
  localPath: string;
}

// Event types
export type DAPEventType = 
  | 'stopped'
  | 'continued'
  | 'exited'
  | 'terminated'
  | 'thread'
  | 'output'
  | 'breakpoint'
  | 'module'
  | 'loadedSource'
  | 'process'
  | 'capabilities';

// Store state types
export interface DebugSessionState {
  isActive: boolean;
  isPaused: boolean;
  currentThreadId?: number;
  currentFrameId?: number;
  currentFile?: string;
  currentLine?: number;
  threads: Thread[];
  stackFrames: StackFrame[];
  scopes: Scope[];
  variables: Map<number, Variable[]>;
}