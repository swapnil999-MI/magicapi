import React, { useEffect, useState, useCallback } from 'react';
import { useStudioStore } from './store/useStudioStore';
import { TopNavbar } from './components/TopNavbar';
import { TabBar } from './components/TabBar';
import { Sidebar } from './components/Sidebar';
import { RequestConsole } from './components/RequestConsole';
import { ResponseViewer } from './components/ResponseViewer';
import { DocsPortal } from './components/DocsPortal';
import { VisualWorkflowStudio } from './components/VisualWorkflowStudio';
import { CommandPaletteModal } from './components/CommandPaletteModal';
import { VariablesModal } from './components/VariablesModal';
import { TypeGeneratorModal } from './components/TypeGeneratorModal';
import { LoadTesterModal } from './components/LoadTesterModal';
import { ScenarioRunnerModal } from './components/ScenarioRunnerModal';
import { Rocket, RefreshCw } from 'lucide-react';

export function App() {
  const { viewMode, setViewMode, fetchSpec, theme, isLoadingSpec, specError } = useStudioStore();

  // Left/Right Sidebar width state with persistence
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('openapi_sidebar_width');
      return saved ? Math.max(200, Math.min(Number(saved), 750)) : 300;
    } catch {
      return 300;
    }
  });

  // Up/Down RequestConsole vs ResponseViewer height split with persistence
  const [requestHeight, setRequestHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('openapi_request_console_height');
      return saved ? Math.max(160, Math.min(Number(saved), 800)) : 360;
    } catch {
      return 360;
    }
  });

  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [isDraggingRequest, setIsDraggingRequest] = useState(false);

  useEffect(() => {
    fetchSpec();
    document.documentElement.setAttribute('data-theme', theme);
  }, [fetchSpec, theme]);

  // Sync initial route & browser back/forward history
  useEffect(() => {
    const syncRoute = () => {
      const p = window.location.pathname;
      if (p.startsWith('/workflow')) {
        setViewMode('workflow');
      } else if (p.startsWith('/api') || p.startsWith('/studio')) {
        setViewMode('studio');
      } else if (p.startsWith('/docs')) {
        setViewMode('docs');
      }
    };

    syncRoute();
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, [setViewMode]);

  // Mouse handlers for Left/Right Sidebar resizer
  const handleSidebarMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSidebar(true);
    document.body.style.cursor = 'col-resize';
  }, []);

  // Mouse handlers for Up/Down Request Console resizer
  const handleRequestMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingRequest(true);
    document.body.style.cursor = 'row-resize';
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSidebar) {
        const newWidth = Math.max(200, Math.min(e.clientX, 750));
        setSidebarWidth(newWidth);
        localStorage.setItem('openapi_sidebar_width', String(newWidth));
      } else if (isDraggingRequest) {
        const studioTop = 48 + 36; // TopNavbar + TabBar
        const newHeight = Math.max(160, Math.min(e.clientY - studioTop, window.innerHeight - 200));
        setRequestHeight(newHeight);
        localStorage.setItem('openapi_request_console_height', String(newHeight));
      }
    };

    const handleMouseUp = () => {
      if (isDraggingSidebar) {
        setIsDraggingSidebar(false);
        document.body.style.cursor = '';
      }
      if (isDraggingRequest) {
        setIsDraggingRequest(false);
        document.body.style.cursor = '';
      }
    };

    if (isDraggingSidebar || isDraggingRequest) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSidebar, isDraggingRequest]);

  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--bg-app)] text-[var(--text-main)] overflow-hidden font-sans select-none antialiased">
      {/* 1. Monolithic Top Header */}
      <TopNavbar />

      {/* 2. Main Studio Application Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {isLoadingSpec ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 text-[var(--text-muted)]">
            <div className="w-12 h-12 rounded-xl bg-white p-1.5 shadow-lg shadow-purple-500/20 ring-2 ring-purple-400/30 animate-pulse">
              <img src="/magicapi-logo.png" alt="MagicAPI" className="w-full h-full object-contain" />
            </div>
            <span className="text-xs font-mono font-semibold text-purple-300">Loading MagicAPI Studio...</span>
          </div>
        ) : specError ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-2 text-center p-6">
            <span className="text-sm font-bold text-red-400">Failed to load specification</span>
            <span className="text-xs text-[var(--text-dim)] max-w-md">{specError}</span>
            <button
              onClick={() => fetchSpec()}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold mt-2 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        ) : viewMode === 'docs' ? (
          <DocsPortal />
        ) : viewMode === 'workflow' ? (
          <VisualWorkflowStudio />
        ) : (
          <>
            {/* Left Draggable Sidebar */}
            <Sidebar style={{ width: `${sidebarWidth}px` }} />

            {/* Vertical Resizer Handle (Left/Right) */}
            <div
              onMouseDown={handleSidebarMouseDown}
              className={`w-1 hover:w-1.5 cursor-col-resize transition-all duration-150 shrink-0 z-20 ${
                isDraggingSidebar
                  ? 'bg-[var(--border-focus)] w-1.5 shadow-sm'
                  : 'bg-[var(--border-color)] hover:bg-[var(--border-focus)]'
              }`}
              title="Drag horizontally to resize sidebar"
            />

            {/* Right Main Studio Area */}
            <main className="flex-1 flex flex-col overflow-hidden bg-[var(--bg-app)]">
              <TabBar />
              <RequestConsole style={{ height: `${requestHeight}px` }} />

              {/* Horizontal Resizer Splitter (Up/Down) */}
              <div
                onMouseDown={handleRequestMouseDown}
                className={`h-2 cursor-row-resize flex items-center justify-center transition-all duration-150 shrink-0 select-none group z-20 ${
                  isDraggingRequest
                    ? 'bg-[var(--border-focus)]/30'
                    : 'bg-[var(--bg-input)] hover:bg-[var(--border-focus)]/20 border-y border-[var(--border-color)]'
                }`}
                title="Drag vertically to resize Request Console & Response Viewer"
              >
                <div className="w-8 h-1 rounded-full bg-white/20 group-hover:bg-[var(--border-focus)] transition-colors" />
              </div>

              <ResponseViewer />
            </main>
          </>
        )}
      </div>

      {/* 3. Global Overlays & Modals */}
      <CommandPaletteModal />
      <VariablesModal />
      <TypeGeneratorModal />
      <LoadTesterModal />
      <ScenarioRunnerModal />
    </div>
  );
}

export default App;
