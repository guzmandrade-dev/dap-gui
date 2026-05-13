export interface AdapterInfo {
  id: string;
  name: string;
  description: string;
  publisher: string;
  version: string;
  downloadUrl: string;
  installed: boolean;
  installPath?: string;
  entryPoint?: string;
  supportedLanguages: string[];
}

export interface ElectronAPI {
  // File operations
  readFile: (path: string) => Promise<string>;
  fileExists: (path: string) => Promise<boolean>;
  getLaunchConfig: () => Promise<Record<string, unknown> | null>;
  getWorkspaceRoot: () => Promise<string>;
  pathResolve: (...paths: string[]) => Promise<string>;
  pathJoin: (...paths: string[]) => Promise<string>;
  
  // Adapter management
  getAdapterCatalog: () => Promise<AdapterInfo[]>;
  installAdapter: (adapterId: string) => Promise<AdapterInfo>;
  uninstallAdapter: (adapterId: string) => Promise<void>;
  getAdapterPath: (adapterId: string) => Promise<string | null>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};