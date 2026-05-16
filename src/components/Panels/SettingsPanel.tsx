import { useState, useEffect } from 'react';

interface Settings {
  editorCommand: string;
  editorArgs: string;
}

const DEFAULT_SETTINGS: Settings = {
  editorCommand: 'code',
  editorArgs: '{file}:{line}',
};

export function SettingsPanel() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    // Load settings from localStorage
    const saved = localStorage.getItem('dapdesk-settings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load settings:', e);
      }
    }
  }, []);

  const saveSettings = () => {
    localStorage.setItem('dapdesk-settings', JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const openInEditor = async (filePath: string, line?: number) => {
    const { exec } = await import('child_process');
    const args = settings.editorArgs
      .replace('{file}', filePath)
      .replace('{line}', line?.toString() || '1');
    
    exec(`${settings.editorCommand} ${args}`, (err) => {
      if (err) {
        console.error('Failed to open editor:', err);
        alert(`Failed to open editor: ${err.message}`);
      }
    });
  };

  return (
    <div className="p-4 space-y-6">
      <div>
        <h3 className="text-sm font-bold text-gray-300 mb-4">External Editor</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Editor Command</label>
            <select
              value={settings.editorCommand}
              onChange={(e) => setSettings({ ...settings, editorCommand: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
            >
              <option value="code">VS Code (code)</option>
              <option value="code-insiders">VS Code Insiders</option>
              <option value="cursor">Cursor</option>
              <option value="zed">Zed</option>
              <option value="subl">Sublime Text</option>
              <option value="atom">Atom</option>
              <option value="vim">Vim</option>
              <option value="nvim">Neovim</option>
              <option value="custom">Custom...</option>
            </select>
            
            {settings.editorCommand === 'custom' && (
              <input
                type="text"
                value={settings.editorCommand === 'custom' ? '' : settings.editorCommand}
                onChange={(e) => setSettings({ ...settings, editorCommand: e.target.value })}
                placeholder="Enter command..."
                className="w-full mt-2 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
              />
            )}
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Arguments Template</label>
            <input
              type="text"
              value={settings.editorArgs}
              onChange={(e) => setSettings({ ...settings, editorArgs: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-sm text-gray-200"
              placeholder="{file}:{line}"
            />
            <p className="text-xs text-gray-500 mt-1">
              Use {'{file}'} for file path and {'{line}'} for line number
            </p>
          </div>

          <button
            onClick={saveSettings}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm py-2 rounded transition-colors"
          >
            {saved ? '✓ Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="border-t border-gray-700 pt-4">
        <h3 className="text-sm font-bold text-gray-300 mb-4">Quick Actions</h3>
        
        <div className="space-y-2">
          <button
            onClick={async () => {
              const root = await window.electronAPI?.getWorkspaceRoot();
              if (root) {
                openInEditor(root);
              }
            }}
            className="w-full bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm py-2 px-3 rounded text-left transition-colors"
          >
            📁 Open Workspace in Editor
          </button>

          <button
            onClick={async () => {
              const root = await window.electronAPI?.getWorkspaceRoot();
              if (root) {
                const configPath = await window.electronAPI?.pathJoin(root, '.vscode', 'launch.json');
                const exists = await window.electronAPI?.fileExists(configPath);
                if (exists) {
                  openInEditor(configPath);
                } else {
                  alert('launch.json does not exist. Create it first!');
                }
              }
            }}
            className="w-full bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm py-2 px-3 rounded text-left transition-colors"
          >
            ⚙️ Edit launch.json
          </button>
        </div>
      </div>

      <div className="border-t border-gray-700 pt-4">
        <h3 className="text-sm font-bold text-gray-300 mb-2">About</h3>
        <p className="text-xs text-gray-500">
          DapDesk v0.1.0<br />
          A DAP Debugger GUI built with Electron
        </p>
      </div>
    </div>
  );
}
