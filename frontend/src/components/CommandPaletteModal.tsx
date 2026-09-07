import React, { useState, useEffect } from 'react';
import { useStudioStore } from '../store/useStudioStore';
import { Search, X, Zap, Moon, Sun, Monitor, Layers, Globe, Download, Upload, FileJson, FileCode } from 'lucide-react';

export const CommandPaletteModal: React.FC = () => {
  const [query, setQuery] = useState('');
  const {
    isCmdPaletteOpen,
    setCmdPaletteOpen,
    spec,
    openEndpointInTab,
    setTheme,
    setViewMode,
    setVariablesModalOpen,
    createBlankTab,
    exportToPostman,
    exportToOpenAPI,
    importCurlCommand,
    setTypeModalOpen,
    setLoadTesterOpen,
    setScenarioModalOpen,
  } = useStudioStore();

  const handleDownloadFile = (content: string, filename: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdPaletteOpen(!isCmdPaletteOpen);
      }
      if (e.key === 'Escape' && isCmdPaletteOpen) {
        setCmdPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCmdPaletteOpen, setCmdPaletteOpen]);

  if (!isCmdPaletteOpen) return null;

  const quickActions = [
    { title: 'New Request Tab', icon: <Layers className="w-4 h-4 text-blue-400" />, action: () => createBlankTab() },
    {
      title: 'Generate TypeScript, Zod, Go & Python Types / SDK',
      icon: <FileCode className="w-4 h-4 text-purple-400" />,
      action: () => setTypeModalOpen(true),
    },
    {
      title: 'In-Browser API Micro-Load Tester & Latency Benchmarker',
      icon: <Zap className="w-4 h-4 text-emerald-400" />,
      action: () => setLoadTesterOpen(true),
    },
    {
      title: 'Multi-Step API Workflow Chainer & Scenario Runner',
      icon: <Zap className="w-4 h-4 text-blue-400" />,
      action: () => setScenarioModalOpen(true),
    },
    {
      title: 'Import from cURL Command...',
      icon: <Upload className="w-4 h-4 text-amber-400" />,
      action: () => {
        const curl = prompt('Paste full cURL command:');
        if (curl) {
          const success = importCurlCommand(curl);
          if (!success) alert('Failed to parse cURL command');
        }
      },
    },
    {
      title: 'Export as Postman Collection (v2.1 JSON)',
      icon: <Download className="w-4 h-4 text-orange-400" />,
      action: () => {
        const json = exportToPostman();
        handleDownloadFile(json, 'magicapi_collection.json', 'application/json');
      },
    },
    {
      title: 'Export API Specification (YAML)',
      icon: <FileCode className="w-4 h-4 text-emerald-400" />,
      action: () => {
        const yamlStr = exportToOpenAPI('yaml');
        handleDownloadFile(yamlStr, 'api-spec.yaml', 'text/yaml');
      },
    },
    {
      title: 'Export API Specification (JSON)',
      icon: <FileJson className="w-4 h-4 text-blue-400" />,
      action: () => {
        const jsonStr = exportToOpenAPI('json');
        handleDownloadFile(jsonStr, 'api-spec.json', 'application/json');
      },
    },
    { title: 'Manage Dynamic Variables ({{var}})', icon: <Globe className="w-4 h-4 text-emerald-400" />, action: () => setVariablesModalOpen(true) },
    { title: 'Switch to Documentation (/docs)', icon: <Zap className="w-4 h-4 text-amber-400" />, action: () => setViewMode('docs') },
    { title: 'Switch Theme: Dark Slate', icon: <Moon className="w-4 h-4 text-purple-400" />, action: () => setTheme('dark') },
    { title: 'Switch Theme: Midnight OLED', icon: <Monitor className="w-4 h-4 text-indigo-400" />, action: () => setTheme('midnight') },
    { title: 'Switch Theme: Cyberpunk Neon', icon: <Sun className="w-4 h-4 text-pink-400" />, action: () => setTheme('cyberpunk') },
  ].filter((a) => !query || a.title.toLowerCase().includes(query.toLowerCase()));

  const matchingEndpoints: Array<{ method: string; path: string; summary: string }> = [];
  if (spec?.paths) {
    for (const [path, pathItem] of Object.entries(spec.paths)) {
      for (const method of ['get', 'post', 'put', 'delete', 'patch'] as const) {
        const op = (pathItem as any)[method];
        if (!op) continue;
        const summary = op.summary || '';
        if (
          !query ||
          path.toLowerCase().includes(query.toLowerCase()) ||
          summary.toLowerCase().includes(query.toLowerCase()) ||
          method.toLowerCase().includes(query.toLowerCase())
        ) {
          matchingEndpoints.push({ method: method.toUpperCase(), path, summary });
        }
      }
    }
  }

  return (
    <div
      onClick={() => setCmdPaletteOpen(false)}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-20 p-4 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-[var(--bg-sidebar)] border border-[var(--border-focus)] rounded-xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Search Header */}
        <div className="flex items-center px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-input)] gap-3">
          <Search className="w-4 h-4 text-[var(--text-dim)]" />
          <input
            autoFocus
            type="text"
            placeholder="Type a command or search endpoints... (ESC to exit)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-[var(--text-main)] outline-none"
          />
          <kbd className="font-mono text-[10px] bg-[var(--bg-card)] border border-[var(--border-color)] px-1.5 py-0.5 rounded text-[var(--text-muted)]">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2 space-y-3">
          {quickActions.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-[var(--text-dim)] uppercase px-2">
                Quick Actions
              </div>
              {quickActions.map((a, i) => (
                <button
                  key={i}
                  onClick={() => {
                    a.action();
                    setCmdPaletteOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--bg-card)] flex items-center justify-between text-xs text-[var(--text-main)] transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {a.icon}
                    <span>{a.title}</span>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--text-dim)]">Action</span>
                </button>
              ))}
            </div>
          )}

          {matchingEndpoints.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-[var(--text-dim)] uppercase px-2">
                Endpoints ({matchingEndpoints.length})
              </div>
              {matchingEndpoints.slice(0, 15).map((ep, i) => (
                <button
                  key={i}
                  onClick={() => {
                    openEndpointInTab(ep.method, ep.path, true);
                    setCmdPaletteOpen(false);
                  }}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--bg-card)] flex items-center justify-between text-xs text-[var(--text-main)] transition-colors gap-2"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-mono text-[10px] font-bold text-blue-400">
                      {ep.method}
                    </span>
                    <span className="font-mono truncate">{ep.path}</span>
                    <span className="text-[11px] text-[var(--text-dim)] truncate">
                      {ep.summary}
                    </span>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--text-dim)]">Open</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
