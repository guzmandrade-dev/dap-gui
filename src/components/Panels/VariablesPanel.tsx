import { useState } from 'react';
import { DebugProtocol } from '@vscode/debugprotocol';
import { useDebugStore } from '../../stores/debugStore';

export function VariablesPanel() {
  const { variables, currentFrameId, isSessionActive } = useDebugStore();
  
  const frameVariables = currentFrameId ? variables.get(currentFrameId) || [] : [];

  if (!isSessionActive) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        No active debug session
      </div>
    );
  }

  if (!currentFrameId) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        No frame selected
      </div>
    );
  }

  if (frameVariables.length === 0) {
    return (
      <div className="p-4 text-gray-500 text-sm">
        No variables available
      </div>
    );
  }

  return (
    <div className="p-2">
      <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 px-2">Variables</h3>
      <div className="font-mono text-sm">
        {frameVariables.map((variable) => (
          <VariableTree 
            key={variable.name} 
            variable={variable}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
}

interface VariableTreeProps {
  variable: DebugProtocol.Variable;
  depth: number;
}

function VariableTree({ variable, depth }: VariableTreeProps) {
  const [expanded, setExpanded] = useState(false);
  
  const hasChildren = variable.variablesReference > 0;
  
  return (
    <div style={{ marginLeft: depth * 12 }}>
      <div 
        className="flex items-center gap-1 cursor-pointer hover:bg-gray-800 p-1 rounded"
        onClick={() => hasChildren && setExpanded(!expanded)}
      >
        {hasChildren && (
          <span className="text-gray-500 text-xs w-4">
            {expanded ? '▼' : '▶'}
          </span>
        )}
        {!hasChildren && <span className="w-4" />}
        <span className="text-blue-400">{variable.name}</span>
        <span className="text-gray-500">=</span>
        <span className={getValueColor(variable.type)}>{variable.value}</span>
      </div>
      {expanded && hasChildren && (
        <div className="text-gray-400 italic pl-5">
          {/* Children would be fetched here */}
          [Expandable]
        </div>
      )}
    </div>
  );
}

function getValueColor(type?: string): string {
  const colors: Record<string, string> = {
    'string': 'text-green-400',
    'number': 'text-orange-400',
    'boolean': 'text-purple-400',
    'null': 'text-gray-500',
    'undefined': 'text-gray-500',
    'object': 'text-yellow-400',
    'array': 'text-yellow-400',
  };
  return colors[type || ''] || 'text-gray-300';
}