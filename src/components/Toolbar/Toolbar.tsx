import { useDebugStore } from '../../stores/debugStore';
import { useConfigStore } from '../../stores/configStore';

export function Toolbar() {
  const { isSessionActive, isPaused, startSession, stopSession, continue: continueExecution, stepOver, stepInto, stepOut, pause } = useDebugStore();
  const { selectedConfig, configs, selectConfig } = useConfigStore();

  const handleStart = () => {
    if (selectedConfig) {
      startSession(selectedConfig);
    }
  };

  return (
    <div className="h-12 bg-gray-800 border-b border-gray-700 flex items-center px-4 gap-4">
      <div className="flex gap-2">
        {!isSessionActive ? (
          <button 
            onClick={handleStart}
            disabled={!selectedConfig}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-sm font-medium"
          >
            <span>▶</span>
            <span>Debug</span>
          </button>
        ) : (
          <>
            <button 
              onClick={stopSession}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-600 hover:bg-red-500 rounded text-sm font-medium"
            >
              <span>⏹</span>
              <span>Stop</span>
            </button>
            
            {isPaused ? (
              <>
                <button 
                  onClick={continueExecution} 
                  className="flex items-center gap-2 px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded text-sm font-medium"
                >
                  <span>▶</span>
                  <span>Continue</span>
                </button>
                <button 
                  onClick={stepOver} 
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm font-medium"
                >
                  <span>⤷</span>
                  <span>Step Over</span>
                </button>
                <button 
                  onClick={stepInto} 
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm font-medium"
                >
                  <span>⤵</span>
                  <span>Step Into</span>
                </button>
                <button 
                  onClick={stepOut} 
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-600 hover:bg-gray-500 rounded text-sm font-medium"
                >
                  <span>⤴</span>
                  <span>Step Out</span>
                </button>
              </>
            ) : (
              <button 
                onClick={pause} 
                className="flex items-center gap-2 px-3 py-1.5 bg-yellow-600 hover:bg-yellow-500 rounded text-sm font-medium"
              >
                <span>⏸</span>
                <span>Pause</span>
              </button>
            )}
          </>
        )}
      </div>
      
      <div className="flex-1">
        <select
          value={selectedConfig?.name || ''}
          onChange={(e) => selectConfig(e.target.value)}
          className="w-full max-w-md px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="">Select configuration...</option>
          {configs.map((config) => (
            <option key={config.name} value={config.name}>
              {config.name}
            </option>
          ))}
        </select>
      </div>
      
      <div className="text-sm text-gray-400">
        {isSessionActive && (isPaused ? '⏸ Paused' : '▶ Running')}
      </div>
    </div>
  );
}