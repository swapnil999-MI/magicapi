import React, { useState } from 'react';
import { useStudioStore } from '../store/useStudioStore';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { JsonTreeView } from './JsonTreeView';
import { Pin, Copy, Download, Maximize2, Check, Search, FileCode, GitCompare, GitBranch, CheckCircle2, XCircle, FlaskConical } from 'lucide-react';

export const ResponseViewer: React.FC = () => {
  const [activeRespTab, setActiveRespTab] = useState<'body' | 'headers' | 'tests'>('body');
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [treeSearch, setTreeSearch] = useState('');

  const {
    activeTabId,
    tabs,
    responseViewMode,
    setResponseViewMode,
    pinnedBaseline,
    setPinnedBaseline,
    theme,
  } = useStudioStore();

  const tab = tabs.find((t) => t.id === activeTabId);
  const resp = tab?.response;

  const formattedBody = React.useMemo(() => {
    if (!resp) return '';
    if (typeof resp.data === 'object' && resp.data !== null) {
      return JSON.stringify(resp.data, null, 2);
    }
    if (resp.rawText) {
      try {
        const parsed = JSON.parse(resp.rawText);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return resp.rawText;
      }
    }
    return '';
  }, [resp]);

  const copyResponse = () => {
    if (!resp) return;
    navigator.clipboard.writeText(formattedBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveResponse = () => {
    if (!resp) return;
    const blob = new Blob([formattedBody], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `response_${tab?.method}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pinBaseline = () => {
    if (!resp) return;
    setPinnedBaseline(formattedBody);
  };

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
    if (status >= 400 && status < 500) return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
    return 'bg-red-500/15 text-red-400 border-red-500/30';
  };

  const getFormattedStatus = () => {
    if (!resp) return '';
    const text = (resp.statusText || '').trim();
    if (text.startsWith(String(resp.status))) {
      return text;
    }
    return `${resp.status} ${text}`.trim();
  };

  const testPassCount = resp?.testResults?.filter((t) => t.passed).length || 0;
  const totalTests = resp?.testResults?.length || 0;

  return (
    <div className={`flex flex-col flex-1 bg-[var(--bg-app)] overflow-hidden ${isFullscreen ? 'fixed inset-0 z-50 p-6 bg-black/80 backdrop-blur-md' : ''}`}>
      {/* 1. Response Header Bar */}
      <div className="h-10 px-3 bg-[var(--bg-input)] border-b border-[var(--border-color)] flex items-center justify-between shrink-0 select-none">
        {/* Left Telemetry & Response Tabs */}
        <div className="flex items-center gap-3">
          {resp ? (
            <div className="flex items-center gap-2">
              <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${getStatusColor(resp.status)}`}>
                {getFormattedStatus()}
              </span>
              <span className="font-mono text-[11px] text-[var(--text-dim)]">
                ⏱️ {resp.duration}ms
              </span>
              <span className="font-mono text-[11px] text-[var(--text-dim)]">
                📦 {(resp.sizeBytes / 1024).toFixed(1)} KB
              </span>
            </div>
          ) : (
            <span className="text-xs font-semibold text-[var(--text-dim)]">
              Response Console
            </span>
          )}

          {resp && (
            <div className="flex items-center gap-1 border-l border-[var(--border-color)] pl-3">
              <button
                onClick={() => setActiveRespTab('body')}
                className={`px-2 py-0.5 text-xs font-semibold rounded ${
                  activeRespTab === 'body'
                    ? 'text-[var(--border-focus)] font-bold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                Body
              </button>
              <button
                onClick={() => setActiveRespTab('headers')}
                className={`px-2 py-0.5 text-xs font-semibold rounded ${
                  activeRespTab === 'headers'
                    ? 'text-[var(--border-focus)] font-bold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                Headers ({Object.keys(resp.headers).length})
              </button>
              <button
                onClick={() => setActiveRespTab('tests')}
                className={`px-2 py-0.5 text-xs font-semibold rounded flex items-center gap-1.5 ${
                  activeRespTab === 'tests'
                    ? 'text-purple-400 font-bold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <FlaskConical className="w-3 h-3 text-purple-400" />
                <span>Test Results</span>
                {totalTests > 0 && (
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      testPassCount === totalTests
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-red-500/20 text-red-300'
                    }`}
                  >
                    {testPassCount}/{totalTests}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Right Output Tools Toolbar */}
        {resp && (
          <div className="flex items-center gap-2">
            {/* Tree View Search Filter */}
            {activeRespTab === 'body' && responseViewMode === 'tree' && (
              <div className="relative flex items-center">
                <Search className="w-3 h-3 absolute left-2 text-[var(--text-dim)]" />
                <input
                  type="text"
                  placeholder="Filter keys..."
                  value={treeSearch}
                  onChange={(e) => setTreeSearch(e.target.value)}
                  className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-md pl-6 pr-2 py-0.5 text-[11px] text-[var(--text-main)] outline-none w-28 focus:w-36 transition-all"
                />
              </div>
            )}

            {/* Format Switcher (Raw, Tree, Diff) */}
            {activeRespTab === 'body' && (
              <div className="flex bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-0.5 gap-0.5">
                <button
                  onClick={() => setResponseViewMode('raw')}
                  className={`px-2 py-0.5 text-xs font-semibold rounded transition-all ${
                    responseViewMode === 'raw'
                      ? 'bg-[var(--bg-app)] text-[var(--border-focus)] shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                  title="Monaco Raw JSON Viewer"
                >
                  Raw
                </button>
                <button
                  onClick={() => setResponseViewMode('tree')}
                  className={`px-2 py-0.5 text-xs font-semibold rounded transition-all ${
                    responseViewMode === 'tree'
                      ? 'bg-[var(--bg-app)] text-[var(--border-focus)] shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                  title="Interactive Collapsible JSON Tree"
                >
                  Tree
                </button>
                <button
                  onClick={() => setResponseViewMode('diff')}
                  className={`px-2 py-0.5 text-xs font-semibold rounded transition-all ${
                    responseViewMode === 'diff'
                      ? 'bg-[var(--bg-app)] text-[var(--border-focus)] shadow-xs'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                  title="Monaco Diff Comparison against Pinned Baseline"
                >
                  Diff
                </button>
              </div>
            )}

            <div className="flex items-center gap-1 border-l border-[var(--border-color)] pl-2">
              <button
                onClick={pinBaseline}
                className="p-1 hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded transition-colors"
                title="Pin this response as Baseline for Regression Diffing"
              >
                <Pin className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={copyResponse}
                className="p-1 hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded transition-colors"
                title="Copy Response JSON"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={saveResponse}
                className="p-1 hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded transition-colors"
                title="Download Response File"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsFullscreen(!isFullscreen)}
                className="p-1 hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded transition-colors"
                title="Toggle Fullscreen"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 2. Response Body Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {!resp ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--text-dim)] gap-2 select-none">
            <span className="text-sm font-semibold">Ready for Execution</span>
            <span className="text-xs">Press "Send" or type ⌘+Enter to dispatch the API request</span>
          </div>
        ) : activeRespTab === 'tests' ? (
          /* TEST RESULTS PANEL */
          <div className="p-4 h-full overflow-y-auto space-y-3 select-none">
            <div className="flex items-center justify-between p-3 rounded-lg border bg-[var(--bg-card)]">
              <div className="flex items-center gap-2">
                {testPassCount === totalTests && totalTests > 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                ) : (
                  <XCircle className="w-5 h-5 text-amber-400" />
                )}
                <div>
                  <h4 className="text-xs font-bold text-[var(--text-main)]">
                    {testPassCount === totalTests && totalTests > 0
                      ? `All ${totalTests} Assertions Passed`
                      : `${testPassCount} of ${totalTests} Assertions Passed`}
                  </h4>
                  <p className="text-[11px] text-[var(--text-dim)]">
                    Automated schema & response validation report
                  </p>
                </div>
              </div>
              <span className={`font-mono text-xs font-bold px-2 py-1 rounded border ${
                testPassCount === totalTests && totalTests > 0
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-red-500/15 text-red-400 border-red-500/30'
              }`}>
                {totalTests > 0 ? `${Math.round((testPassCount / totalTests) * 100)}% PASS` : 'NO TESTS'}
              </span>
            </div>

            <div className="space-y-1.5">
              {(resp.testResults || []).map((result, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border flex items-start gap-2.5 text-xs ${
                    result.passed
                      ? 'bg-emerald-500/5 border-emerald-500/20 text-[var(--text-main)]'
                      : 'bg-red-500/5 border-red-500/20 text-red-400'
                  }`}
                >
                  {result.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold">{result.name}</div>
                    <div className="font-mono text-[11px] text-[var(--text-dim)] mt-0.5">
                      {result.message}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeRespTab === 'headers' ? (
          /* HEADERS TABLE */
          <div className="p-4 h-full overflow-y-auto">
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] uppercase text-[10px] text-left">
                  <th className="w-1/3 py-2 px-3">Header Name</th>
                  <th className="py-2 px-3">Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(resp.headers).map(([key, val]) => (
                  <tr key={key} className="border-b border-[var(--border-color)]/50 hover:bg-[var(--bg-card)]">
                    <td className="py-2 px-3 text-blue-400 font-semibold">{key}</td>
                    <td className="py-2 px-3 text-[var(--text-main)] select-text break-all">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : responseViewMode === 'tree' ? (
          /* INTERACTIVE JSON TREE VIEW */
          <div className="p-4 h-full overflow-y-auto">
            <JsonTreeView data={resp.data} searchFilter={treeSearch} />
          </div>
        ) : responseViewMode === 'diff' ? (
          /* MONACO DIFF COMPARISON */
          <div className="h-full w-full">
            <DiffEditor
              height="100%"
              language="json"
              theme={theme === 'light' ? 'light' : 'vs-dark'}
              original={pinnedBaseline || '{\n  "hint": "Pin a baseline response first using the Pin icon on the top right"\n}'}
              modified={formattedBody}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 12,
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>
        ) : (
          /* MONACO RAW JSON EDITOR */
          <div className="h-full w-full">
            <Editor
              height="100%"
              language="json"
              theme={theme === 'light' ? 'light' : 'vs-dark'}
              value={formattedBody}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 12,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                wordWrap: 'on',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
