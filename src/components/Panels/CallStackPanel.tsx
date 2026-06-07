import { useDebugStore } from '../../stores/debugStore';
import { getFileName } from '../../utils/pathMapping';

export function CallStackPanel() {
  const { stackFrames, currentFrameId, selectFrame, isSessionActive, isPaused } = useDebugStore();

  if (!isSessionActive) {
    return (
      <div className="p-4 text-muted text-sm">
        No active debug session
      </div>
    );
  }

  if (!isPaused) {
    return (
      <div className="p-4 text-muted text-sm">
        Program is running. Stack trace will appear when paused.
      </div>
    );
  }

  if (stackFrames.length === 0) {
    return (
      <div className="p-4 text-muted text-sm">
        No stack frames available
      </div>
    );
  }

  return (
    <div className="p-2">
      <h3 className="text-xs font-bold text-secondary uppercase mb-2 px-2">Call Stack</h3>
      <div className="space-y-1">
        {stackFrames.map((frame, index) => (
          <div
            key={frame.id}
            onClick={() => selectFrame(frame.id)}
            className={`cursor-pointer p-2 text-sm rounded transition-colors ${
              frame.id === currentFrameId
                ? 'bg-accent text-accent-text'
                : 'text-text hover:bg-elevated'
            }`}
            title={`${frame.name} — click to navigate`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs opacity-60 w-4 text-right shrink-0">{index}</span>
              <div className="min-w-0">
                <div className="font-medium truncate">{frame.name}</div>
                <div className={`text-xs opacity-75 truncate font-mono ${
                  frame.id === currentFrameId ? 'text-accent-text/80' : 'text-muted'
                }`}>
                  {frame.source?.path ? getFileName(frame.source.path) : 'Unknown'}:{frame.line}
                  {frame.column && frame.column > 0 ? `:${frame.column}` : ''}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
