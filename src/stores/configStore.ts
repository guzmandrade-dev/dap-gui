import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { LaunchConfiguration } from '../dap/types';

interface ConfigState {
  configs: LaunchConfiguration[];
  selectedConfig: LaunchConfiguration | null;
  workspaceRoot: string;
  
  // Actions
  loadConfigs: () => Promise<void>;
  selectConfig: (name: string) => void;
  addConfig: (config: LaunchConfiguration) => void;
  removeConfig: (name: string) => void;
  getSelectedConfig: () => LaunchConfiguration | null;
  setWorkspaceRoot: (root: string) => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      configs: [],
      selectedConfig: null,
      workspaceRoot: '',

      loadConfigs: async () => {
        try {
          const vscodeConfig = await window.electronAPI?.getLaunchConfig();
          if (vscodeConfig?.configurations) {
            const configs = vscodeConfig.configurations as LaunchConfiguration[];
            set({ configs });
            
            // Select first config if none selected
            if (!get().selectedConfig && configs.length > 0) {
              set({ selectedConfig: configs[0] });
            }
          }
        } catch (err) {
          console.error('Failed to load configs:', err);
        }
        
        // Get workspace root
        try {
          const root = await window.electronAPI?.getWorkspaceRoot();
          if (root) {
            set({ workspaceRoot: root });
          }
        } catch (err) {
          console.error('Failed to get workspace root:', err);
        }
      },

      selectConfig: (name: string) => {
        const config = get().configs.find(c => c.name === name);
        if (config) {
          set({ selectedConfig: config });
        }
      },

      addConfig: (config: LaunchConfiguration) => {
        const configs = get().configs.filter(c => c.name !== config.name);
        set({ configs: [...configs, config] });
      },

      removeConfig: (name: string) => {
        const configs = get().configs.filter(c => c.name !== name);
        set({ 
          configs,
          selectedConfig: get().selectedConfig?.name === name ? null : get().selectedConfig,
        });
      },

      getSelectedConfig: () => {
        return get().selectedConfig;
      },

      setWorkspaceRoot: (root: string) => {
        set({ workspaceRoot: root });
      },
    }),
    {
      name: 'dapdesk-config-storage',
      partialize: (state) => ({ 
        selectedConfig: state.selectedConfig,
        workspaceRoot: state.workspaceRoot,
      }),
    }
  )
);