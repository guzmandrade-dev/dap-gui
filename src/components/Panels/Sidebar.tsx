import { useState } from 'react';
import { CallStackPanel } from './CallStackPanel';
import { VariablesPanel } from './VariablesPanel';
import { BreakpointsPanel } from './BreakpointsPanel';
import { AdapterManagerPanel } from './AdapterManagerPanel';
import { SettingsPanel } from './SettingsPanel';

type Tab = 'stack' | 'variables' | 'breakpoints' | 'adapters' | 'settings';

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<Tab>('stack');

  const tabs = [
    { id: 'stack' as Tab, label: 'Stack', icon: '📞', title: 'Call Stack' },
    { id: 'variables' as Tab, label: 'Vars', icon: '📊', title: 'Variables' },
    { id: 'breakpoints' as Tab, label: 'BP', icon: '🔴', title: 'Breakpoints' },
    { id: 'adapters' as Tab, label: 'Adapters', icon: '🔌', title: 'Debug Adapters' },
    { id: 'settings' as Tab, label: '', icon: '⚙️', title: 'Settings' },
  ];

  return (
    <div className={`flex flex-col bg-gray-800 h-full ${className}`}>
      {/* Tab headers - scrollable */}
      <div className="flex border-b border-gray-700 overflow-x-auto scrollbar-hide">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            title={tab.title}
            className={`flex-shrink-0 px-3 py-2 text-xs font-medium uppercase tracking-wider whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-gray-700 text-white border-b-2 border-blue-500'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-750'
            }`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'stack' && <CallStackPanel />}
        {activeTab === 'variables' && <VariablesPanel />}
        {activeTab === 'breakpoints' && <BreakpointsPanel />}
        {activeTab === 'adapters' && <AdapterManagerPanel />}
        {activeTab === 'settings' && <SettingsPanel />}
      </div>
    </div>
  );
}
