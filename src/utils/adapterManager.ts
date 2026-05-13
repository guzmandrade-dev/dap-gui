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

// Catalog of popular debug adapters from Open VSX
export const ADAPTER_CATALOG: AdapterInfo[] = [
  {
    id: 'felixfbecker.php-debug',
    name: 'PHP Debug',
    description: 'Debug support for PHP with XDebug',
    publisher: 'felixfbecker',
    version: '1.34.0',
    downloadUrl: 'https://open-vsx.org/api/felixfbecker/php-debug/latest/file/felixfbecker.php-debug-1.34.0.vsix',
    installed: false,
    entryPoint: 'extension/out/phpDebug.js',
    supportedLanguages: ['php'],
  },
  {
    id: 'ms-python.debugpy',
    name: 'Python Debugger',
    description: 'Python debugging with debugpy',
    publisher: 'ms-python',
    version: '2024.0.0',
    downloadUrl: 'https://open-vsx.org/api/ms-python/debugpy/latest/file/ms-python.debugpy-2024.0.0.vsix',
    installed: false,
    entryPoint: 'extension/bundled/libs/debugpy/adapter',
    supportedLanguages: ['python'],
  },
  {
    id: 'vadimcn.vscode-lldb',
    name: 'CodeLLDB',
    description: 'Native debugger for LLDB',
    publisher: 'vadimcn',
    version: '1.10.0',
    downloadUrl: 'https://open-vsx.org/api/vadimcn/vscode-lldb/latest/file/vadimcn.vscode-lldb-1.10.0.vsix',
    installed: false,
    entryPoint: 'extension/adapter/codelldb',
    supportedLanguages: ['c', 'cpp', 'rust'],
  },
  {
    id: 'ms-vscode.node-debug2',
    name: 'Node Debug',
    description: 'Node.js debugging',
    publisher: 'ms-vscode',
    version: '1.44.0',
    downloadUrl: 'https://open-vsx.org/api/ms-vscode/node-debug2/latest/file/ms-vscode.node-debug2-1.44.0.vsix',
    installed: false,
    entryPoint: 'extension/out/src/nodeDebug.js',
    supportedLanguages: ['javascript', 'typescript'],
  },
];

export class AdapterManager {
  private adaptersDir: string;

  constructor() {
    this.adaptersDir = './adapters';
  }

  async getInstalledAdapters(): Promise<AdapterInfo[]> {
    const adapters: AdapterInfo[] = [];
    
    for (const adapter of ADAPTER_CATALOG) {
      const installPath = `${this.adaptersDir}/${adapter.id}`;
      const entryPointPath = `${installPath}/${adapter.entryPoint}`;
      
      try {
        const { access } = await import('fs/promises');
        await access(entryPointPath);
        adapters.push({
          ...adapter,
          installed: true,
          installPath,
        });
      } catch {
        adapters.push(adapter);
      }
    }
    
    return adapters;
  }

  getAdapterPath(adapterId: string): string | null {
    const adapter = ADAPTER_CATALOG.find(a => a.id === adapterId);
    if (!adapter?.entryPoint) return null;
    return `${this.adaptersDir}/${adapterId}/${adapter.entryPoint}`;
  }

  getAdapterForLanguage(language: string): AdapterInfo | undefined {
    return ADAPTER_CATALOG.find(a => 
      a.installed && a.supportedLanguages.includes(language)
    );
  }
}

export const adapterManager = new AdapterManager();