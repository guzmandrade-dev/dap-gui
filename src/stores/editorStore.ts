import { create } from 'zustand';

interface EditorState {
  currentFile: string | undefined;
  currentLine: number | undefined;
  openFiles: string[];
  fileContents: Map<string, string>;
  
  // Actions
  openFile: (path: string) => Promise<void>;
  closeFile: (path: string) => void;
  setCurrentFile: (path: string | undefined) => void;
  getFileContent: (path: string) => string | undefined;
  isFileOpen: (path: string) => boolean;
}

export const useEditorStore = create<EditorState>()((set, get) => ({
  // Initial state
  currentFile: undefined,
  currentLine: undefined,
  openFiles: [],
  fileContents: new Map(),

  openFile: async (path: string) => {
    const { openFiles, fileContents } = get();
    
    // If already open, just set as current
    if (openFiles.includes(path)) {
      set({ currentFile: path });
      return;
    }

    // Try to load file content
    try {
      if (window.electronAPI) {
        const content = await window.electronAPI.readFile(path);
        fileContents.set(path, content);
        
        set({
          openFiles: [...openFiles, path],
          currentFile: path,
          fileContents: new Map(fileContents),
        });
      }
    } catch (err) {
      console.error('Failed to open file:', path, err);
    }
  },

  closeFile: (path: string) => {
    const { openFiles, fileContents, currentFile } = get();
    
    const newOpenFiles = openFiles.filter(f => f !== path);
    fileContents.delete(path);
    
    // If closing current file, switch to another open file or clear
    let newCurrentFile = currentFile;
    if (currentFile === path) {
      newCurrentFile = newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : undefined;
    }

    set({
      openFiles: newOpenFiles,
      currentFile: newCurrentFile,
      fileContents: new Map(fileContents),
    });
  },

  setCurrentFile: (path: string | undefined) => {
    set({ currentFile: path });
  },

  getFileContent: (path: string) => {
    return get().fileContents.get(path);
  },

  isFileOpen: (path: string) => {
    return get().openFiles.includes(path);
  },
}));