import { useDebugStore } from '../../stores/debugStore';
import { getFileName } from '../../utils/pathMapping';

export function CallStackPanel() {
  const { stackFrames, currentFrameId, selectFrame, isSessionActive } = useDebugStore();

  if (!isSessionActive) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        No active debug session
      </div>
    );
  }

  if (stackFrames.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        No stack frames available
      </div>
    );
  }

  return (
    <div className="p-2">
      <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 px-2">Call Stack</h3>
      <div className="space-y-1">
        {stackFrames.map((frame) => (
          <div
            key={frame.id}
            onClick={() => selectFrame(frame.id)}
            className={`cursor-pointer p-2 rounded text-sm ${
              frame.id === currentFrameId
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-700 text-gray-200'
            }`}
          >
            <div className="font-medium truncate">{frame.name}</div>
            <div className="text-xs opacity-75 truncate font-mono">
              {frame.source?.path ? getFileName(frame.source.path) : 'Unknown'}:{frame.line}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}