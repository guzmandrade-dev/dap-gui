import { useState, useEffect } from 'react';
import { AdapterInfo } from '../../utils/adapterManager';

export function AdapterManagerPanel() {
  const [adapters, setAdapters] = useState<AdapterInfo[]>([]);
  const [isLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAdapters();
  }, []);

  const loadAdapters = async () => {
    try {
      const catalog = await window.electronAPI?.getAdapterCatalog();
      if (catalog) {
        setAdapters(catalog);
      }
    } catch (err) {
      setError('Failed to load adapter catalog');
    }
  };

  const handleInstall = async (adapterId: string) => {
    setInstalling(adapterId);
    setError(null);
    
    try {
      const installed = await window.electronAPI?.installAdapter(adapterId);
      if (installed) {
        setAdapters(prev => 
          prev.map(a => a.id === adapterId ? { ...a, installed: true, installPath: installed.installPath } : a)
        );
      }
    } catch (err) {
      setError(`Failed to install adapter: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setInstalling(null);
    }
  };

  const handleUninstall = async (adapterId: string) => {
    try {
      await window.electronAPI?.uninstallAdapter(adapterId);
      setAdapters(prev => 
        prev.map(a => a.id === adapterId ? { ...a, installed: false, installPath: undefined } : a)
      );
    } catch (err) {
      setError(`Failed to uninstall adapter: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 text-gray-400">
        <div className="animate-pulse">Loading adapters...</div>
      </div>
    );
  }

  return (
    <div className="p-2">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-gray-400 uppercase">Debug Adapters</h3>
        <button 
          onClick={loadAdapters}
          className="text-xs text-blue-400 hover:text-blue-300"
          title="Refresh"
        >
          ↻ Refresh
        </button>
      </div>

      {error && (
        <div className="mb-3 p-2 bg-red-900/50 border border-red-700 rounded text-xs text-red-200">
          {error}
          <button 
            onClick={() => setError(null)}
            className="ml-2 text-red-400 hover:text-red-300"
          >
            ×
          </button>
        </div>
      )}

      <div className="space-y-2">
        {adapters.map((adapter) => (
          <div 
            key={adapter.id}
            className={`p-2 rounded border ${
              adapter.installed 
                ? 'bg-green-900/20 border-green-800' 
                : 'bg-gray-800 border-gray-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="font-medium text-sm text-gray-200">
                  {adapter.name}
                </div>
                <div className="text-xs text-gray-500">
                  {adapter.publisher} • v{adapter.version}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  {adapter.description}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {adapter.supportedLanguages.map(lang => (
                    <span 
                      key={lang}
                      className="px-1.5 py-0.5 bg-gray-700 rounded text-xs text-gray-300"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="ml-2">
                {adapter.installed ? (
                  <button
                    onClick={() => handleUninstall(adapter.id)}
                    className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded"
                    disabled={installing === adapter.id}
                  >
                    {installing === adapter.id ? '...' : 'Uninstall'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleInstall(adapter.id)}
                    className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded"
                    disabled={installing === adapter.id}
                  >
                    {installing === adapter.id ? 'Installing...' : 'Install'}
                  </button>
                )}
              </div>
            </div>
            
            {adapter.installed && (
              <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
                <span>✓</span>
                <span>Installed</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {adapters.length === 0 && (
        <div className="text-center py-4 text-gray-500 text-sm">
          No adapters available
        </div>
      )}
    </div>
  );
}