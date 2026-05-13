import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ADAPTER_CATALOG, AdapterInfo } from '../src/utils/adapterManager';

// Store reference to main window
let mainWindow: BrowserWindow | null = null;

// Adapters storage directory
const getAdaptersDir = () => path.join(app.getPath('userData'), 'adapters');

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    titleBarStyle: 'default',
    show: false,
  });

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// App event handlers
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Helper to download file with progress
async function downloadFile(
  url: string, 
  dest: string, 
  onProgress?: (downloaded: number, total: number) => void
): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }

  const total = parseInt(response.headers.get('content-length') || '0');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const chunks: Buffer[] = [];
  let downloaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    chunks.push(Buffer.from(value));
    downloaded += value.length;
    onProgress?.(downloaded, total);
  }

  const buffer = Buffer.concat(chunks);
  await fs.writeFile(dest, buffer);
}

// Helper to extract .vsix file
async function extractVsix(vsixPath: string, destPath: string): Promise<void> {
  await fs.mkdir(destPath, { recursive: true });
  
  // Use system unzip command
  const { exec } = await import('child_process');
  return new Promise((resolve, reject) => {
    exec(`unzip -o "${vsixPath}" -d "${destPath}"`, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

// IPC handlers
ipcMain.handle('read-file', async (_event, filePath: string) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return content;
  } catch (err) {
    throw new Error(`Failed to read ${filePath}: ${err}`);
  }
});

ipcMain.handle('file-exists', async (_event, filePath: string) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('get-launch-config', async () => {
  try {
    const configPath = path.join(process.cwd(), '.vscode', 'launch.json');
    const content = await fs.readFile(configPath, 'utf-8');
    
    // Remove comments from JSON (VS Code allows comments in launch.json)
    const cleanedContent = content
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    
    return JSON.parse(cleanedContent);
  } catch {
    return null;
  }
});

ipcMain.handle('get-workspace-root', () => {
  return process.cwd();
});

ipcMain.handle('path-resolve', (_event, ...paths: string[]) => {
  return path.resolve(...paths);
});

ipcMain.handle('path-join', (_event, ...paths: string[]) => {
  return path.join(...paths);
});

// Adapter Management IPC Handlers

ipcMain.handle('get-adapter-catalog', async (): Promise<AdapterInfo[]> => {
  const adaptersDir = getAdaptersDir();
  const adapters: AdapterInfo[] = [];
  
  for (const adapter of ADAPTER_CATALOG) {
    const installPath = path.join(adaptersDir, adapter.id);
    const entryPointPath = path.join(installPath, adapter.entryPoint || '');
    
    try {
      await fs.access(entryPointPath);
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
});

ipcMain.handle('install-adapter', async (_event, adapterId: string): Promise<AdapterInfo> => {
  const adapter = ADAPTER_CATALOG.find(a => a.id === adapterId);
  if (!adapter) {
    throw new Error(`Unknown adapter: ${adapterId}`);
  }

  const adaptersDir = getAdaptersDir();
  const installPath = path.join(adaptersDir, adapterId);
  const vsixPath = path.join(adaptersDir, `${adapterId}.vsix`);

  try {
    // Ensure adapters directory exists
    await fs.mkdir(adaptersDir, { recursive: true });

    // Download the .vsix file
    await downloadFile(adapter.downloadUrl, vsixPath);

    // Extract the .vsix (it's just a zip)
    await extractVsix(vsixPath, installPath);

    // Clean up .vsix file
    await fs.unlink(vsixPath);

    return {
      ...adapter,
      installed: true,
      installPath,
    };
  } catch (error) {
    // Clean up on failure
    try {
      await fs.rm(installPath, { recursive: true, force: true });
      await fs.unlink(vsixPath).catch(() => {});
    } catch {}
    throw error;
  }
});

ipcMain.handle('uninstall-adapter', async (_event, adapterId: string): Promise<void> => {
  const adaptersDir = getAdaptersDir();
  const installPath = path.join(adaptersDir, adapterId);
  await fs.rm(installPath, { recursive: true, force: true });
});

ipcMain.handle('get-adapter-path', async (_event, adapterId: string): Promise<string | null> => {
  const adapter = ADAPTER_CATALOG.find(a => a.id === adapterId);
  if (!adapter?.entryPoint) return null;
  
  const adaptersDir = getAdaptersDir();
  const adapterPath = path.join(adaptersDir, adapterId, adapter.entryPoint);
  
  try {
    await fs.access(adapterPath);
    return adapterPath;
  } catch {
    return null;
  }
});