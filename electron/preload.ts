import { contextBridge, ipcRenderer } from 'electron';

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

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  readFile: (path: string) => ipcRenderer.invoke('read-file', path),
  fileExists: (path: string) => ipcRenderer.invoke('file-exists', path),
  getLaunchConfig: () => ipcRenderer.invoke('get-launch-config'),
  getWorkspaceRoot: () => ipcRenderer.invoke('get-workspace-root'),
  pathResolve: (...paths: string[]) => ipcRenderer.invoke('path-resolve', ...paths),
  pathJoin: (...paths: string[]) => ipcRenderer.invoke('path-join', ...paths),
  
  // Adapter management
  getAdapterCatalog: () => ipcRenderer.invoke('get-adapter-catalog'),
  installAdapter: (adapterId: string) => ipcRenderer.invoke('install-adapter', adapterId),
  uninstallAdapter: (adapterId: string) => ipcRenderer.invoke('uninstall-adapter', adapterId),
  getAdapterPath: (adapterId: string) => ipcRenderer.invoke('get-adapter-path', adapterId),
});