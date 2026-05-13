import Editor, { OnMount } from '@monaco-editor/react';
import { useEffect, useRef } from 'react';
import { useEditorStore } from '../../stores/editorStore';
import { useDebugStore } from '../../stores/debugStore';
import { getLanguageForFile, fetchFileContent } from '../../utils/fileLoader';

interface CodeViewerProps {
  className?: string;
}

export function CodeViewer({ className }: CodeViewerProps) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  
  const { currentFile, fileContents } = useEditorStore();
  const { 
    currentLine, 
    isPaused, 
    breakpoints, 
    setBreakpoint, 
    removeBreakpoint 
  } = useDebugStore();

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Click gutter to toggle breakpoint
    editor.onMouseDown((e: any) => {
      const targetType = e.target.type;
      if (
        targetType === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN ||
        targetType === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS
      ) {
        const line = e.target.position?.lineNumber;
        if (!line || !currentFile) return;
        
        const fileBPs = breakpoints.get(currentFile) || new Set();
        const hasBP = fileBPs.has(line);
        
        if (hasBP) {
          removeBreakpoint(currentFile, line);
        } else {
          setBreakpoint(currentFile, line);
        }
      }
    });
  };

  // Load file when currentFile changes
  useEffect(() => {
    if (!currentFile) return;
    
    const loadFile = async () => {
      try {
        const content = await fetchFileContent(currentFile);
        useEditorStore.setState((state) => ({
          fileContents: new Map(state.fileContents).set(currentFile, content)
        }));
      } catch (err) {
        console.error('Failed to load file:', err);
      }
    };
    
    if (!fileContents.has(currentFile)) {
      loadFile();
    }
  }, [currentFile]);

  // Update decorations when state changes
  useEffect(() => {
    if (!editorRef.current || !monacoRef.current || !currentFile) return;
    
    const monaco = monacoRef.current;
    const editor = editorRef.current;
    const model = editor.getModel();
    
    if (!model) return;

    // Clear previous decorations
    if (decorationsRef.current.length > 0) {
      editor.deltaDecorations(decorationsRef.current, []);
    }

    const newDecorations: any[] = [];
    
    // Add breakpoint decorations
    const fileBPs = breakpoints.get(currentFile) || new Set();
    fileBPs.forEach(line => {
      newDecorations.push({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          glyphMarginClassName: 'breakpoint-glyph',
          overviewRuler: { color: '#ff4444', position: 1 },
          minimap: { color: '#ff4444', position: 1 },
        }
      });
    });
    
    // Add current line decoration if paused
    if (isPaused && currentLine) {
      newDecorations.push({
        range: new monaco.Range(currentLine, 1, currentLine, 1),
        options: {
          isWholeLine: true,
          className: 'current-line-highlight',
          glyphMarginClassName: 'breakpoint-glyph current-line-glyph',
        }
      });
      
      // Center on current line
      editor.revealLineInCenter(currentLine);
    }

    decorationsRef.current = editor.deltaDecorations([], newDecorations);
  }, [currentFile, currentLine, breakpoints, isPaused]);

  const content = currentFile ? fileContents.get(currentFile) || '' : '';
  const language = currentFile ? getLanguageForFile(currentFile) : 'plaintext';

  if (!currentFile) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-900 text-gray-500`}>
        <div className="text-center">
          <div className="text-4xl mb-2">📁</div>
          <div>No file open</div>
          <div className="text-sm mt-2">Start a debug session to view code</div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="h-full flex flex-col">
        {/* Editor */}
        <div className="flex-1">
          <Editor
            height="100%"
            theme="vs-dark"
            path={currentFile}
            value={content}
            language={language}
            options={{
              readOnly: true,
              glyphMargin: true,
              lineNumbers: 'on',
              folding: true,
              minimap: { enabled: true },
              automaticLayout: true,
            }}
            onMount={handleEditorMount}
          />
        </div>
      </div>
    </div>
  );
}