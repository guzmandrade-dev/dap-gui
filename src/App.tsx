import { useEffect } from 'react';
import { useDebugStore } from './stores/debugStore';
import { useConfigStore } from './stores/configStore';
import { Toolbar } from './components/Toolbar/Toolbar';
import { Sidebar } from './components/Panels/Sidebar';
import { CodeViewer } from './components/Editor/CodeViewer';
import { StatusBar } from './components/StatusBar/StatusBar';

function App() {
  const { initialize, isSessionActive } = useDebugStore();
  const { loadConfigs } = useConfigStore();

  useEffect(() => {
    initialize();
    loadConfigs();
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

export default App;