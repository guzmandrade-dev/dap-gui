import { useState } from 'react';
import { CallStackPanel } from './CallStackPanel';
import { VariablesPanel } from './VariablesPanel';
import { BreakpointsPanel } from './BreakpointsPanel';
import { AdapterManagerPanel } from './AdapterManagerPanel';

type Tab = 'stack' | 'variables' | 'breakpoints' | 'adapters';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<Tab>('stack');

  return (
    <div className={`flex flex-col bg-gray-800 ${className}`}>
      {/* Tab headers */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('stack')}
          className={`flex-1 px-3 py-2 text-xs font-medium uppercase tracking-wider ${
            activeTab === 'stack'
              ? 'bg-gray-700 text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-750'
          }`}
        >
          Call Stack
        </button>
        <button
          onClick={() => setActiveTab('variables')}
          className={`flex-1 px-3 py-2 text-xs font-medium uppercase tracking-wider ${
            activeTab === 'variables'
              ? 'bg-gray-700 text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-750'
          }`}
        >
          Variables
        </button>
        <button
          onClick={() => setActiveTab('breakpoints')}
          className={`flex-1 px-3 py-2 text-xs font-medium uppercase tracking-wider ${
            activeTab === 'breakpoints'
              ? 'bg-gray-700 text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-750'
          }`}
        >
          Breakpoints
        </button>
        <button
          onClick={() => setActiveTab('adapters')}
          className={`flex-1 px-3 py-2 text-xs font-medium uppercase tracking-wider ${
            activeTab === 'adapters'
              ? 'bg-gray-700 text-white border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-gray-200 hover:bg-gray-750'
          }`}
        >
          Adapters
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'stack' && <CallStackPanel />}
        {activeTab === 'variables' && <VariablesPanel />}
        {activeTab === 'breakpoints' && <BreakpointsPanel />}
        {activeTab === 'adapters' && <AdapterManagerPanel />}
      </div>
    </div>
  );
}