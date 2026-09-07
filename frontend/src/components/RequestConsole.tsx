import React, { useState, useEffect } from 'react';
import { useStudioStore } from '../store/useStudioStore';
import Editor from '@monaco-editor/react';
import {
  Send,
  Plus,
  Trash2,
  Copy,
  Check,
  Code,
  Shield,
  Sparkles,
  RefreshCw,
  FlaskConical,
  Activity,
  FileCode,
  Workflow,
  Sliders,
} from 'lucide-react';
import type { RequestAssertion } from '../types/openapi';

interface RequestConsoleProps {
  style?: React.CSSProperties;
}

export const RequestConsole: React.FC<RequestConsoleProps> = ({ style }) => {
  const [activeSubTab, setActiveSubTab] = useState<'params' | 'headers' | 'auth' | 'body' | 'code' | 'tests'>('params');
  const [selectedLanguage, setSelectedLanguage] = useState<'curl' | 'js' | 'python' | 'go'>('curl');
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [jsonBodyMode, setJsonBodyMode] = useState<'code' | 'form'>('code');
  const [newPropKey, setNewPropKey] = useState('');
  const [newPropVal, setNewPropVal] = useState('');

  const {
    activeTabId,
    tabs,
    updateActiveTab,
    engineMode,
    setEngineMode,
    mockStatus,
    setMockStatus,
    sendActiveRequest,
    theme,
    spec,
    setTypeModalOpen,
    setLoadTesterOpen,
    setScenarioModalOpen,
  } = useStudioStore();

  const tab = tabs.find((t) => t.id === activeTabId);
  if (!tab) return null;

  const op = spec?.paths?.[tab.path]?.[tab.method.toLowerCase() as any];

  // ⌘+Enter shortcut to send
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSend();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tab]);

  const handleSend = async () => {
    setIsSending(true);
    try {
      await sendActiveRequest();
    } finally {
      setIsSending(false);
    }
  };

  const addQueryParam = () => {
    updateActiveTab((t) => ({
      queryParams: [...t.queryParams, { key: '', value: '', enabled: true, description: '' }],
    }));
  };

  const addHeaderParam = () => {
    updateActiveTab((t) => ({
      headerParams: [...t.headerParams, { key: '', value: '', enabled: true }],
    }));
  };

  const addFormDataRow = () => {
    updateActiveTab((t) => ({
      formData: [...t.formData, { key: '', value: '', type: 'text' }],
    }));
  };

  const addAssertion = (type: RequestAssertion['type'], name: string, targetValue?: string) => {
    const newAst: RequestAssertion = {
      id: `ast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      type,
      targetValue,
      enabled: true,
    };
    updateActiveTab((t) => ({
      assertions: [...(t.assertions || []), newAst],
    }));
  };

  const removeAssertion = (id: string) => {
    updateActiveTab((t) => ({
      assertions: (t.assertions || []).filter((a) => a.id !== id),
    }));
  };

  const toggleAssertion = (id: string, enabled: boolean) => {
    updateActiveTab((t) => ({
      assertions: (t.assertions || []).map((a) => (a.id === id ? { ...a, enabled } : a)),
    }));
  };

  const updateAssertionTarget = (id: string, targetValue: string) => {
    updateActiveTab((t) => ({
      assertions: (t.assertions || []).map((a) => (a.id === id ? { ...a, targetValue } : a)),
    }));
  };

  const formatJsonBody = () => {
    try {
      const parsed = JSON.parse(tab.bodyJson);
      updateActiveTab(() => ({ bodyJson: JSON.stringify(parsed, null, 2), isDirty: true }));
    } catch {
      alert('Invalid JSON: Unable to format');
    }
  };

  const resetToSchemaExample = () => {
    const jsonContent = op?.requestBody?.content?.['application/json'];
    if (jsonContent?.example) {
      updateActiveTab(() => ({ bodyJson: JSON.stringify(jsonContent.example, null, 2), isDirty: true }));
    }
  };

  const getParsedBodyJson = (): Record<string, any> => {
    try {
      const parsed = JSON.parse(tab.bodyJson || '{}');
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed;
      }
      return {};
    } catch {
      return {};
    }
  };

  const updateBodyJsonField = (key: string, value: any) => {
    const current = getParsedBodyJson();
    current[key] = value;
    updateActiveTab(() => ({ bodyJson: JSON.stringify(current, null, 2), isDirty: true }));
  };

  const deleteBodyJsonField = (key: string) => {
    const current = getParsedBodyJson();
    delete current[key];
    updateActiveTab(() => ({ bodyJson: JSON.stringify(current, null, 2), isDirty: true }));
  };

  const handleAddNewField = () => {
    if (!newPropKey.trim()) return;
    let parsedVal: any = newPropVal;
    if (newPropVal === 'true') parsedVal = true;
    else if (newPropVal === 'false') parsedVal = false;
    else if (!isNaN(Number(newPropVal)) && newPropVal.trim() !== '') parsedVal = Number(newPropVal);

    updateBodyJsonField(newPropKey.trim(), parsedVal);
    setNewPropKey('');
    setNewPropVal('');
  };

  const handleEditorBeforeMount = (monaco: any) => {
    const schema = op?.requestBody?.content?.['application/json']?.schema;
    if (schema) {
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        schemas: [
          {
            uri: 'http://magicapi/schema.json',
            fileMatch: ['*'],
            schema: {
              ...schema,
              components: spec?.components,
            },
          },
        ],
      });
    }
  };

  const generateSnippet = () => {
    const method = tab.method;
    const url = tab.url;

    if (selectedLanguage === 'curl') {
      let code = `curl -X ${method} "${url}" \\\n`;
      tab.headerParams.filter((h) => h.enabled && h.key).forEach((h) => {
        code += `  -H "${h.key}: ${h.value}" \\\n`;
      });
      if (['POST', 'PUT', 'PATCH'].includes(method) && tab.bodyType === 'raw-json' && tab.bodyJson) {
        code += `  -d '${tab.bodyJson.replace(/'/g, "\\'")}'\n`;
      }
      return code.trim();
    }

    if (selectedLanguage === 'js') {
      const headersObj: Record<string, string> = {};
      tab.headerParams.filter((h) => h.enabled && h.key).forEach((h) => {
        headersObj[h.key] = h.value;
      });
      return `const response = await fetch("${url}", {
  method: "${method}",
  headers: ${JSON.stringify(headersObj, null, 2)},
  ${['POST', 'PUT', 'PATCH'].includes(method) && tab.bodyType === 'raw-json' ? `body: JSON.stringify(${tab.bodyJson || '{}'})` : ''}
});
const data = await response.json();
console.log(data);`;
    }

    if (selectedLanguage === 'python') {
      return `import requests

url = "${url}"
headers = {
${tab.headerParams.filter((h) => h.enabled && h.key).map((h) => `    "${h.key}": "${h.value}"`).join(',\n')}
}
${['POST', 'PUT', 'PATCH'].includes(method) && tab.bodyType === 'raw-json' ? `json_payload = ${tab.bodyJson || '{}'}\nresponse = requests.${method.toLowerCase()}(url, headers=headers, json=json_payload)` : `response = requests.${method.toLowerCase()}(url, headers=headers)`}

print(response.status_code)
print(response.json())`;
    }

    if (selectedLanguage === 'go') {
      return `package main

import (
	"fmt"
	"io"
	"net/http"
	${['POST', 'PUT', 'PATCH'].includes(method) && tab.bodyType === 'raw-json' ? `"strings"` : ''}
)

func main() {
	client := &http.Client{}
	${['POST', 'PUT', 'PATCH'].includes(method) && tab.bodyType === 'raw-json' ? `payload := strings.NewReader(\`${tab.bodyJson}\`)\n\treq, err := http.NewRequest("${method}", "${url}", payload)` : `req, err := http.NewRequest("${method}", "${url}", nil)`}
	if err != nil {
		panic(err)
	}

${tab.headerParams.filter((h) => h.enabled && h.key).map((h) => `\treq.Header.Set("${h.key}", "${h.value}")`).join('\n')}

	res, err := client.Do(req)
	if err != nil {
		panic(err)
	}
	defer res.Body.Close()

	body, _ := io.ReadAll(res.Body)
	fmt.Println(string(body))
}`;
    }

    return '';
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generateSnippet());
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  return (
    <div style={style} className="flex flex-col bg-[var(--bg-app)] border-b border-[var(--border-color)] overflow-hidden shrink-0">
      {/* 1. Endpoint Info Bar */}
      {op && (
        <div className="px-3 pt-2.5 pb-1 flex items-center justify-between gap-3 overflow-x-auto">
          <div className="flex items-center gap-2 flex-wrap truncate">
            <span className="font-bold text-xs text-[var(--text-main)] truncate">
              {op.summary || tab.path}
            </span>
            {op.tags?.[0] && (
              <span className="text-[10px] font-semibold text-[var(--text-dim)] bg-[var(--bg-card)] px-1.5 py-0.5 rounded border border-[var(--border-color)] shrink-0">
                {op.tags[0]}
              </span>
            )}
            {(op['x-created-at'] || op['created_at']) && (
              <span
                className="text-[10px] font-mono text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded shrink-0"
                title={`Created At: ${op['x-created-at'] || op['created_at']}`}
              >
                📅 Created: {new Date(op['x-created-at'] || op['created_at']).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, {new Date(op['x-created-at'] || op['created_at']).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </span>
            )}
            {(op['x-updated-at'] || op['updated_at']) && (
              <span
                className="text-[10px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded shrink-0"
                title={`Updated At: ${op['x-updated-at'] || op['updated_at']}`}
              >
                🔄 Updated: {new Date(op['x-updated-at'] || op['updated_at']).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}, {new Date(op['x-updated-at'] || op['updated_at']).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              </span>
            )}
          </div>

          {/* Quick Studio Tools */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setTypeModalOpen(true)}
              className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-purple-400 rounded-md text-[11px] font-semibold transition-colors"
              title="Generate TypeScript, Zod, Go & Python types for this endpoint"
            >
              <FileCode className="w-3 h-3 text-purple-400" />
              <span>Types & SDK</span>
            </button>
            <button
              onClick={() => setLoadTesterOpen(true)}
              className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-[var(--text-muted)] hover:text-emerald-400 rounded-md text-[11px] font-semibold transition-colors"
              title="Run in-browser micro-benchmark / load test on this endpoint"
            >
              <Activity className="w-3 h-3 text-emerald-400" />
              <span>Load Test</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. Monolithic Request URL Bar */}
      <div className="p-3 pt-1.5">
        <div className="flex items-center bg-[var(--bg-input)] border border-[var(--border-color)] focus-within:border-[var(--border-focus)] rounded-lg overflow-hidden shadow-sm transition-all focus-within:shadow-[0_0_0_3px_var(--accent-glow)]">
          {/* Method Dropdown */}
          <select
            value={tab.method}
            onChange={(e) => updateActiveTab(() => ({ method: e.target.value }))}
            className={`px-3 py-2 bg-[var(--bg-card)] border-r border-[var(--border-color)] font-mono font-bold text-xs outline-none cursor-pointer ${
              tab.method === 'GET'
                ? 'text-emerald-400'
                : tab.method === 'POST'
                ? 'text-orange-400'
                : tab.method === 'PUT'
                ? 'text-amber-400'
                : tab.method === 'DELETE'
                ? 'text-red-400'
                : 'text-purple-400'
            }`}
          >
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PUT">PUT</option>
            <option value="DELETE">DELETE</option>
            <option value="PATCH">PATCH</option>
          </select>

          {/* URL Input */}
          <input
            type="text"
            value={tab.url}
            onChange={(e) => updateActiveTab(() => ({ url: e.target.value, isDirty: true }))}
            placeholder="http://localhost:8000/v1/..."
            className="flex-1 px-3 py-2 bg-transparent text-xs font-mono text-[var(--text-main)] outline-none"
          />

          {/* Live vs Mock Mode Switcher */}
          <div className="flex items-center border-l border-[var(--border-color)] bg-[var(--bg-card)]">
            <select
              value={engineMode}
              onChange={(e) => setEngineMode(e.target.value as any)}
              className="px-2 py-2 bg-transparent text-xs font-medium text-[var(--text-muted)] outline-none cursor-pointer"
              title="Execution Engine: Live Network vs Mock Synthesizer"
            >
              <option value="live">🌐 Live</option>
              <option value="mock">🎲 Mock</option>
            </select>

            {engineMode === 'mock' && (
              <select
                value={mockStatus}
                onChange={(e) => setMockStatus(e.target.value)}
                className="px-1.5 py-2 bg-transparent text-xs font-mono font-semibold text-purple-400 border-l border-[var(--border-color)] outline-none cursor-pointer"
              >
                <option value="200">200 OK</option>
                <option value="201">201 Created</option>
                <option value="400">400 Bad</option>
                <option value="401">401 Auth</option>
                <option value="500">500 Err</option>
              </select>
            )}
          </div>

          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={isSending}
            title="Send Request (⌘ + Enter)"
            className={`group relative px-5 py-2 font-bold text-xs text-white flex items-center gap-2 select-none cursor-pointer outline-none transition-all duration-150 active:scale-[0.98] ${
              engineMode === 'mock'
                ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600 hover:from-purple-500 hover:via-fuchsia-500 hover:to-indigo-500 shadow-md shadow-purple-900/30'
                : 'bg-gradient-to-r from-sky-500 via-sky-600 to-cyan-600 hover:from-sky-400 hover:via-sky-500 hover:to-cyan-500 shadow-md shadow-sky-900/30'
            } ${isSending ? 'opacity-80 cursor-wait' : ''}`}
          >
            {isSending ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin shrink-0" />
            ) : (
              <Send className="w-3.5 h-3.5 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            )}
            <span className="tracking-wide">{isSending ? 'Sending...' : engineMode === 'mock' ? 'Mock Send' : 'Send'}</span>
          </button>
        </div>
      </div>

      {/* 3. Request Configuration Tabs */}
      <div className="flex items-center justify-between px-3 border-b border-[var(--border-color)] bg-[var(--bg-input)] select-none">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveSubTab('params')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeSubTab === 'params'
                ? 'border-[var(--border-focus)] text-[var(--border-focus)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <span>Params</span>
            <span className="font-mono text-[10px] bg-white/10 px-1.5 py-0.2 rounded-full text-[var(--text-muted)]">
              {tab.queryParams.filter((q) => q.enabled && q.key).length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('headers')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeSubTab === 'headers'
                ? 'border-[var(--border-focus)] text-[var(--border-focus)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <span>Headers</span>
            <span className="font-mono text-[10px] bg-white/10 px-1.5 py-0.2 rounded-full text-[var(--text-muted)]">
              {tab.headerParams.filter((h) => h.enabled && h.key).length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('auth')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeSubTab === 'auth'
                ? 'border-[var(--border-focus)] text-[var(--border-focus)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Auth</span>
          </button>

          <button
            onClick={() => setActiveSubTab('body')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeSubTab === 'body'
                ? 'border-[var(--border-focus)] text-[var(--border-focus)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <span>Body</span>
            {tab.bodyType !== 'none' && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            )}
          </button>

          <button
            onClick={() => setActiveSubTab('tests')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeSubTab === 'tests'
                ? 'border-[var(--border-focus)] text-[var(--border-focus)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5 text-purple-400" />
            <span>Tests</span>
            <span className="font-mono text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded-full font-bold">
              {(tab.assertions || []).filter((a) => a.enabled).length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('code')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all flex items-center gap-1.5 ${
              activeSubTab === 'code'
                ? 'border-[var(--border-focus)] text-[var(--border-focus)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-main)]'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            <span>Code</span>
          </button>
        </div>

        {/* Body action helpers */}
        {activeSubTab === 'body' && tab.bodyType === 'raw-json' && (
          <div className="flex items-center gap-1.5">
            {/* Raw vs Visual Form Toggle */}
            <div className="flex bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setJsonBodyMode('code')}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded ${
                  jsonBodyMode === 'code'
                    ? 'bg-[var(--bg-app)] text-[var(--border-focus)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                Code (Raw)
              </button>
              <button
                onClick={() => setJsonBodyMode('form')}
                className={`px-2 py-0.5 text-[11px] font-semibold rounded flex items-center gap-1 ${
                  jsonBodyMode === 'form'
                    ? 'bg-[var(--bg-app)] text-[var(--border-focus)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <Sliders className="w-3 h-3" />
                <span>Visual Form</span>
              </button>
            </div>

            <button
              onClick={formatJsonBody}
              className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded transition-colors"
            >
              <Sparkles className="w-3 h-3" />
              <span>Format JSON</span>
            </button>
            {op?.requestBody?.content?.['application/json']?.example && (
              <button
                onClick={resetToSchemaExample}
                className="flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5 rounded transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Reset Example</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 4. Sub-Tab Content Panels */}
      <div className="flex-1 overflow-y-auto p-3 bg-[var(--bg-app)] min-h-[120px]">
        {/* PARAMS */}
        {activeSubTab === 'params' && (
          <div className="space-y-2">
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] uppercase text-[10px] tracking-wider text-left">
                  <th className="w-8 py-1.5 px-2"></th>
                  <th className="w-1/3 py-1.5 px-2">Key</th>
                  <th className="w-1/3 py-1.5 px-2">Value</th>
                  <th className="py-1.5 px-2">Description</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {tab.queryParams.map((param, index) => (
                  <tr key={index} className="border-b border-[var(--border-color)]/50 group">
                    <td className="p-1 text-center">
                      <input
                        type="checkbox"
                        checked={param.enabled}
                        onChange={(e) => {
                          const updated = [...tab.queryParams];
                          updated[index].enabled = e.target.checked;
                          updateActiveTab(() => ({ queryParams: updated }));
                        }}
                        className="accent-blue-500 rounded cursor-pointer"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        placeholder="Key"
                        value={param.key}
                        onChange={(e) => {
                          const updated = [...tab.queryParams];
                          updated[index].key = e.target.value;
                          updateActiveTab(() => ({ queryParams: updated }));
                        }}
                        className="w-full bg-transparent px-2 py-1 text-xs text-[var(--text-main)] outline-none focus:bg-[var(--bg-card)] rounded"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        placeholder="Value"
                        value={param.value}
                        onChange={(e) => {
                          const updated = [...tab.queryParams];
                          updated[index].value = e.target.value;
                          updateActiveTab(() => ({ queryParams: updated }));
                        }}
                        className="w-full bg-transparent px-2 py-1 text-xs text-[var(--text-main)] outline-none focus:bg-[var(--bg-card)] rounded"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        placeholder="Description"
                        value={param.description || ''}
                        onChange={(e) => {
                          const updated = [...tab.queryParams];
                          updated[index].description = e.target.value;
                          updateActiveTab(() => ({ queryParams: updated }));
                        }}
                        className="w-full bg-transparent px-2 py-1 text-xs text-[var(--text-dim)] outline-none focus:bg-[var(--bg-card)] rounded"
                      />
                    </td>
                    <td className="p-1 text-center">
                      <button
                        onClick={() => {
                          const updated = tab.queryParams.filter((_, i) => i !== index);
                          updateActiveTab(() => ({ queryParams: updated }));
                        }}
                        className="text-[var(--text-dim)] hover:text-red-400 p-1 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={addQueryParam}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Parameter</span>
            </button>
          </div>
        )}

        {/* HEADERS */}
        {activeSubTab === 'headers' && (
          <div className="space-y-2">
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] uppercase text-[10px] tracking-wider text-left">
                  <th className="w-8 py-1.5 px-2"></th>
                  <th className="w-1/2 py-1.5 px-2">Header Key</th>
                  <th className="w-1/2 py-1.5 px-2">Header Value</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {tab.headerParams.map((header, index) => (
                  <tr key={index} className="border-b border-[var(--border-color)]/50 group">
                    <td className="p-1 text-center">
                      <input
                        type="checkbox"
                        checked={header.enabled}
                        onChange={(e) => {
                          const updated = [...tab.headerParams];
                          updated[index].enabled = e.target.checked;
                          updateActiveTab(() => ({ headerParams: updated }));
                        }}
                        className="accent-blue-500 rounded cursor-pointer"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        placeholder="Key"
                        value={header.key}
                        onChange={(e) => {
                          const updated = [...tab.headerParams];
                          updated[index].key = e.target.value;
                          updateActiveTab(() => ({ headerParams: updated }));
                        }}
                        className="w-full bg-transparent px-2 py-1 text-xs text-[var(--text-main)] outline-none focus:bg-[var(--bg-card)] rounded"
                      />
                    </td>
                    <td className="p-1">
                      <input
                        type="text"
                        placeholder="Value"
                        value={header.value}
                        onChange={(e) => {
                          const updated = [...tab.headerParams];
                          updated[index].value = e.target.value;
                          updateActiveTab(() => ({ headerParams: updated }));
                        }}
                        className="w-full bg-transparent px-2 py-1 text-xs text-[var(--text-main)] outline-none focus:bg-[var(--bg-card)] rounded"
                      />
                    </td>
                    <td className="p-1 text-center">
                      <button
                        onClick={() => {
                          const updated = tab.headerParams.filter((_, i) => i !== index);
                          updateActiveTab(() => ({ headerParams: updated }));
                        }}
                        className="text-[var(--text-dim)] hover:text-red-400 p-1 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              onClick={addHeaderParam}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-2"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Header</span>
            </button>
          </div>
        )}

        {/* AUTH */}
        {activeSubTab === 'auth' && (() => {
          const hasAuthHeader = tab.headerParams.some(
            (h) => h.key.toLowerCase() === 'authorization' && h.enabled
          );
          const currentToken = useStudioStore.getState().variables.token || '';

          const toggleBearerAuth = (enable: boolean) => {
            if (enable) {
              const val = currentToken ? `Bearer ${currentToken}` : 'Bearer {{token}}';
              const existing = tab.headerParams.find((h) => h.key.toLowerCase() === 'authorization');
              if (existing) {
                updateActiveTab((t) => ({
                  headerParams: t.headerParams.map((h) =>
                    h.key.toLowerCase() === 'authorization' ? { ...h, value: val, enabled: true } : h
                  ),
                }));
              } else {
                updateActiveTab((t) => ({
                  headerParams: [...t.headerParams, { key: 'Authorization', value: val, enabled: true }],
                }));
              }
            } else {
              updateActiveTab((t) => ({
                headerParams: t.headerParams.filter((h) => h.key.toLowerCase() !== 'authorization'),
              }));
            }
          };

          return (
            <div className="space-y-5 max-w-lg">
              {/* Mode indicator */}
              <div className="p-3 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg flex items-start gap-3">
                <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-md mt-0.5">
                  <Shield className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <div className="text-xs font-semibold text-[var(--text-main)] flex items-center justify-between">
                    <span>Active Auth Mode</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                      hasAuthHeader 
                        ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}>
                      {hasAuthHeader ? 'Bearer Header' : 'Cookie Session (Default)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-dim)] mt-1 leading-relaxed">
                    {hasAuthHeader
                      ? 'Requests will send an Authorization header with your Bearer token.'
                      : 'Requests automatically transmit browser session cookies (credentials: include). No Authorization header is attached.'}
                  </p>
                </div>
              </div>

              {/* Bearer Token Config */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[var(--text-muted)]">
                    Authorization Token (Bearer)
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-[var(--text-main)] select-none">
                    <input
                      type="checkbox"
                      checked={hasAuthHeader}
                      onChange={(e) => toggleBearerAuth(e.target.checked)}
                      className="accent-blue-500 rounded"
                    />
                    <span>Attach Bearer Header</span>
                  </label>
                </div>
                <input
                  type="text"
                  placeholder="eyJhbGciOiJIUzI1NiIs... or {{token}}"
                  value={currentToken}
                  onChange={(e) => {
                    useStudioStore.getState().setVariable('token', e.target.value);
                    if (hasAuthHeader) {
                      const val = e.target.value ? `Bearer ${e.target.value}` : 'Bearer {{token}}';
                      updateActiveTab((t) => ({
                        headerParams: t.headerParams.map((h) =>
                          h.key.toLowerCase() === 'authorization' ? { ...h, value: val } : h
                        ),
                      }));
                    }
                  }}
                  className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg px-3 py-1.5 text-xs font-mono text-[var(--text-main)] outline-none focus:border-[var(--border-focus)]"
                />
                <p className="text-[11px] text-[var(--text-dim)]">
                  Stored in dynamic variable <code className="text-blue-400 font-mono">{'{{token}}'}</code>. Login responses returning JWT or token fields will auto-populate this variable.
                </p>
              </div>

              {/* Cookie Auth Note */}
              <div className="p-3 bg-[var(--bg-input)]/50 border border-[var(--border-color)] rounded-lg text-xs space-y-1">
                <div className="font-semibold text-[var(--text-main)] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span>Browser Cookie Support</span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">
                  MagicAPI sends all live requests with <code className="font-mono text-emerald-400">credentials: &apos;include&apos;</code>. If your API sets cookies on login, you can keep Bearer Header disabled and authenticate seamlessly using cookies.
                </p>
              </div>
            </div>
          );
        })()}

        {/* BODY */}
        {activeSubTab === 'body' && (
          <div className="flex flex-col h-full space-y-2">
            {/* Body Type Radio Bar */}
            <div className="flex items-center gap-4 text-xs font-medium text-[var(--text-muted)] pb-1 border-b border-[var(--border-color)]">
              {(['none', 'raw-json', 'form-data', 'x-www-form-urlencoded'] as const).map((type) => (
                <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="bodyType"
                    checked={tab.bodyType === type}
                    onChange={() => updateActiveTab(() => ({ bodyType: type }))}
                    className="accent-blue-500"
                  />
                  <span className={tab.bodyType === type ? 'text-[var(--text-main)] font-semibold' : ''}>
                    {type === 'raw-json' ? 'Raw JSON (Schema Intellisense)' : type}
                  </span>
                </label>
              ))}
            </div>

            {/* Raw JSON Monaco Editor vs Visual Form */}
            {tab.bodyType === 'raw-json' && (
              <div className="flex-1 min-h-[140px] border border-[var(--border-color)] rounded-lg overflow-hidden flex flex-col">
                {jsonBodyMode === 'code' ? (
                  <Editor
                    height="100%"
                    language="json"
                    theme={theme === 'light' ? 'light' : 'vs-dark'}
                    value={tab.bodyJson}
                    beforeMount={handleEditorBeforeMount}
                    onChange={(val) => updateActiveTab(() => ({ bodyJson: val || '', isDirty: true }))}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 12,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      quickSuggestions: true,
                    }}
                  />
                ) : (
                  /* VISUAL PAYLOAD FORM BUILDER */
                  <div className="p-3 overflow-y-auto space-y-3 bg-[var(--bg-card)]/30 h-full">
                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)] font-semibold pb-1 border-b border-[var(--border-color)]">
                      <span>Dynamic Form Fields (Auto-Syncs to Raw JSON)</span>
                      <span className="font-mono text-[10px] text-[var(--text-dim)]">
                        {Object.keys(getParsedBodyJson()).length} properties
                      </span>
                    </div>

                    <div className="space-y-2">
                      {Object.entries(getParsedBodyJson()).map(([key, val]) => {
                        const valType = typeof val;
                        return (
                          <div
                            key={key}
                            className="flex items-center gap-2 p-2 bg-[var(--bg-input)] rounded-lg border border-[var(--border-color)] text-xs"
                          >
                            <span className="w-1/3 font-mono font-bold text-blue-400 truncate" title={key}>
                              {key}
                            </span>

                            {valType === 'boolean' ? (
                              <button
                                onClick={() => updateBodyJsonField(key, !val)}
                                className={`px-3 py-1 rounded text-xs font-mono font-bold transition-all ${
                                  val ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                                }`}
                              >
                                {val ? 'true' : 'false'}
                              </button>
                            ) : valType === 'number' ? (
                              <input
                                type="number"
                                value={val}
                                onChange={(e) => updateBodyJsonField(key, Number(e.target.value))}
                                className="flex-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded px-2 py-1 font-mono text-xs text-[var(--text-main)] outline-none"
                              />
                            ) : (
                              <input
                                type="text"
                                value={typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                onChange={(e) => updateBodyJsonField(key, e.target.value)}
                                className="flex-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded px-2 py-1 font-mono text-xs text-[var(--text-main)] outline-none"
                              />
                            )}

                            <button
                              onClick={() => deleteBodyJsonField(key)}
                              className="text-[var(--text-dim)] hover:text-red-400 p-1 rounded"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Add Field Row */}
                    <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-color)]/50">
                      <input
                        type="text"
                        placeholder="Property key..."
                        value={newPropKey}
                        onChange={(e) => setNewPropKey(e.target.value)}
                        className="w-1/3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded px-2 py-1 text-xs font-mono text-[var(--text-main)] outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Value (string, number, true/false)..."
                        value={newPropVal}
                        onChange={(e) => setNewPropVal(e.target.value)}
                        className="flex-1 bg-[var(--bg-input)] border border-[var(--border-color)] rounded px-2 py-1 text-xs font-mono text-[var(--text-main)] outline-none"
                      />
                      <button
                        onClick={handleAddNewField}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-semibold flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Multipart Form-Data */}
            {tab.bodyType === 'form-data' && (
              <div className="space-y-2">
                <table className="w-full text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)] text-[10px] uppercase text-left">
                      <th className="w-1/3 py-1.5 px-2">Key</th>
                      <th className="w-24 py-1.5 px-2">Type</th>
                      <th className="w-1/2 py-1.5 px-2">Value / File</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {tab.formData.map((row, index) => (
                      <tr key={index} className="border-b border-[var(--border-color)]/50">
                        <td className="p-1">
                          <input
                            type="text"
                            placeholder="Key"
                            value={row.key}
                            onChange={(e) => {
                              const updated = [...tab.formData];
                              updated[index].key = e.target.value;
                              updateActiveTab(() => ({ formData: updated }));
                            }}
                            className="w-full bg-transparent px-2 py-1 text-xs text-[var(--text-main)] outline-none rounded"
                          />
                        </td>
                        <td className="p-1">
                          <select
                            value={row.type}
                            onChange={(e) => {
                              const updated = [...tab.formData];
                              updated[index].type = e.target.value as any;
                              updateActiveTab(() => ({ formData: updated }));
                            }}
                            className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded px-1.5 py-1 text-xs text-[var(--text-main)] outline-none"
                          >
                            <option value="text">Text</option>
                            <option value="file">File</option>
                          </select>
                        </td>
                        <td className="p-1">
                          {row.type === 'file' ? (
                            <input
                              type="file"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                const updated = [...tab.formData];
                                updated[index].file = file;
                                updateActiveTab(() => ({ formData: updated }));
                              }}
                              className="text-xs text-[var(--text-muted)] file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-blue-600 file:text-white"
                            />
                          ) : (
                            <input
                              type="text"
                              placeholder="Value"
                              value={row.value}
                              onChange={(e) => {
                                const updated = [...tab.formData];
                                updated[index].value = e.target.value;
                                updateActiveTab(() => ({ formData: updated }));
                              }}
                              className="w-full bg-transparent px-2 py-1 text-xs text-[var(--text-main)] outline-none rounded"
                            />
                          )}
                        </td>
                        <td className="p-1 text-center">
                          <button
                            onClick={() => {
                              const updated = tab.formData.filter((_, i) => i !== index);
                              updateActiveTab(() => ({ formData: updated }));
                            }}
                            className="text-[var(--text-dim)] hover:text-red-400 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button
                  onClick={addFormDataRow}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Form Row</span>
                </button>
              </div>
            )}

            {tab.bodyType === 'none' && (
              <div className="py-8 text-center text-xs text-[var(--text-dim)]">
                This request does not have a request body.
              </div>
            )}
          </div>
        )}

        {/* TESTS & ASSERTIONS */}
        {activeSubTab === 'tests' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--text-main)]">
                Automated Test Assertions
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => addAssertion('status_200', 'Status code is 200 OK')}
                  className="px-2 py-1 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                >
                  + Status 200
                </button>
                <button
                  onClick={() => addAssertion('responseTime_500', 'Response time < 500ms')}
                  className="px-2 py-1 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                >
                  + Perf &lt;500ms
                </button>
                <button
                  onClick={() => addAssertion('is_json', 'Response is valid JSON')}
                  className="px-2 py-1 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                >
                  + Valid JSON
                </button>
                <button
                  onClick={() => {
                    const key = prompt('Enter JSON property name to verify exists:');
                    if (key) addAssertion('contains_key', `Response contains "${key}"`, key);
                  }}
                  className="px-2 py-1 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
                >
                  + Field Exists
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              {(tab.assertions || []).length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--text-dim)]">
                  No test assertions added yet. Click buttons above to add tests.
                </div>
              ) : (
                tab.assertions.map((ast) => (
                  <div
                    key={ast.id}
                    className="flex items-center justify-between p-2 bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg text-xs"
                  >
                    <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={ast.enabled}
                        onChange={(e) => toggleAssertion(ast.id, e.target.checked)}
                        className="accent-purple-500 rounded cursor-pointer"
                      />
                      <span className={`font-mono truncate ${ast.enabled ? 'text-[var(--text-main)]' : 'text-[var(--text-dim)] line-through'}`}>
                        {ast.name}
                      </span>
                    </label>

                    {ast.type === 'contains_key' && (
                      <input
                        type="text"
                        placeholder="Field name"
                        value={ast.targetValue || ''}
                        onChange={(e) => updateAssertionTarget(ast.id, e.target.value)}
                        className="bg-[var(--bg-input)] border border-[var(--border-color)] rounded px-2 py-0.5 font-mono text-[11px] text-purple-400 outline-none w-32 mr-2"
                      />
                    )}

                    <button
                      onClick={() => removeAssertion(ast.id)}
                      className="text-[var(--text-dim)] hover:text-red-400 p-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* CODE SNIPPET */}
        {activeSubTab === 'code' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-0.5 gap-0.5">
                {(['curl', 'js', 'python', 'go'] as const).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setSelectedLanguage(lang)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all uppercase ${
                      selectedLanguage === lang
                        ? 'bg-[var(--bg-app)] text-[var(--border-focus)] border border-[var(--border-color)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
              <button
                onClick={copyCode}
                className="px-2.5 py-1 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-md text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1.5"
              >
                {copiedSnippet ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSnippet ? 'Copied' : 'Copy Code'}</span>
              </button>
            </div>
            <pre className="p-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg font-mono text-xs text-emerald-400 overflow-x-auto select-text">
              {generateSnippet()}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
};
