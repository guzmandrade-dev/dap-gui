import { useDebugStore } from '../../stores/debugStore';
import { getFileName } from '../../utils/pathMapping';

export function BreakpointsPanel() {
  const { breakpoints, removeBreakpoint, toggleBreakpointEnabled, isBreakpointEnabled } = useDebugStore();

  const breakpointEntries = Array.from(breakpoints.entries());

  if (breakpointEntries.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        No breakpoints set
      </div>
    );
  }

  return (
    <div className="p-2">
      <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 px-2">Breakpoints</h3>
      <div className="space-y-1">
        {breakpointEntries.map(([file, lines]) => (
          <div key={file} className="mb-2">
            <div className="text-xs text-gray-500 font-medium px-1 truncate" title={file}>
              {getFileName(file)}
            </div>
            {Array.from(lines).map(line => (
              <div 
                key={`${file}:${line}`} 
                className="flex items-center gap-2 p-1 hover:bg-gray-700 rounded"
              >
                <input 
                  type="checkbox" 
                  checked={isBreakpointEnabled(file, line)}
                  onChange={() => toggleBreakpointEnabled(file, line)}
                  className="w-3 h-3 accent-blue-500"
                />
                <span className="text-xs font-mono text-gray-300 flex-1">
                  Line {line}
                </span>
                <button 
                  onClick={() => removeBreakpoint(file, line)}
                  className="text-red-400 hover:text-red-300 text-xs px-1"
                  title="Remove breakpoint"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}