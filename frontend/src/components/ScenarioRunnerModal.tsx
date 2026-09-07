import React, { useState } from 'react';
import { useStudioStore } from '../store/useStudioStore';
import { X, Play, Plus, Trash2, CheckCircle2, XCircle, Clock, Workflow, ArrowDown, Sparkles, Layers } from 'lucide-react';

interface ScenarioStep {
  id: string;
  name: string;
  method: string;
  path: string;
  extractVariableKey?: string;
  extractJsonPath?: string;
  status?: 'idle' | 'running' | 'success' | 'error';
  duration?: number;
  statusCode?: number;
  errorMsg?: string;
}

export const ScenarioRunnerModal: React.FC = () => {
  const { isScenarioModalOpen, setScenarioModalOpen, spec, variables, setVariable, interpolate } = useStudioStore();

  const [steps, setSteps] = useState<ScenarioStep[]>([
    {
      id: 'step_1',
      name: 'Step 1: Authenticate / Login',
      method: 'POST',
      path: '/v1/auth/login',
      extractVariableKey: 'token',
      extractJsonPath: 'data.token',
      status: 'idle',
    },
    {
      id: 'step_2',
      name: 'Step 2: Create Client Record',
      method: 'POST',
      path: '/admin/clients/create',
      extractVariableKey: 'client_id',
      extractJsonPath: 'data.client_id',
      status: 'idle',
    },
    {
      id: 'step_3',
      name: 'Step 3: Fetch Client Details',
      method: 'GET',
      path: '/admin/clients/{{client_id}}',
      status: 'idle',
    },
  ]);

  const [isRunning, setIsRunning] = useState(false);
  const [totalWorkflowTime, setTotalWorkflowTime] = useState<number | null>(null);

  if (!isScenarioModalOpen) return null;

  const endpointsList: Array<{ method: string; path: string }> = [];
  if (spec?.paths) {
    for (const [p, item] of Object.entries(spec.paths)) {
      for (const m of ['get', 'post', 'put', 'delete', 'patch'] as const) {
        if ((item as any)[m]) {
          endpointsList.push({ method: m.toUpperCase(), path: p });
        }
      }
    }
  }

  const addStep = () => {
    const defaultEp = endpointsList[0] || { method: 'GET', path: '/health' };
    const newStep: ScenarioStep = {
      id: `step_${Date.now()}`,
      name: `Step ${steps.length + 1}: ${defaultEp.path}`,
      method: defaultEp.method,
      path: defaultEp.path,
      status: 'idle',
    };
    setSteps([...steps, newStep]);
  };

  const removeStep = (id: string) => {
    setSteps(steps.filter((s) => s.id !== id));
  };

  const updateStep = (id: string, patch: Partial<ScenarioStep>) => {
    setSteps(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const runWorkflow = async () => {
    setIsRunning(true);
    setTotalWorkflowTime(null);
    const startAll = performance.now();

    // Reset step statuses
    setSteps((prev) => prev.map((s) => ({ ...s, status: 'idle', duration: undefined, statusCode: undefined, errorMsg: undefined })));

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, status: 'running' } : s)));

      const stepStart = performance.now();
      try {
        const rawUrl = step.path.startsWith('http') ? step.path : `${window.location.origin}${step.path}`;
        const url = interpolate(rawUrl);

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        const currentToken = useStudioStore.getState().variables.token;
        if (currentToken) {
          headers['Authorization'] = `Bearer ${currentToken}`;
        }

        const res = await fetch(url, {
          method: step.method,
          headers,
        });

        const dur = Math.round(performance.now() - stepStart);
        const data = await res.json().catch(() => ({}));

        // Extract variable if configured
        if (step.extractVariableKey && step.extractJsonPath) {
          const pathParts = step.extractJsonPath.split('.');
          let val: any = data;
          for (const part of pathParts) {
            if (val && typeof val === 'object') {
              val = val[part];
            } else {
              val = undefined;
              break;
            }
          }
          if (val !== undefined) {
            setVariable(step.extractVariableKey, String(val));
          }
        }

        setSteps((prev) =>
          prev.map((s, idx) =>
            idx === i
              ? {
                  ...s,
                  status: res.ok ? 'success' : 'error',
                  statusCode: res.status,
                  duration: dur,
                  errorMsg: res.ok ? undefined : `HTTP ${res.status}`,
                }
              : s
          )
        );

        if (!res.ok) {
          // Stop on step failure
          break;
        }
      } catch (err: any) {
        const dur = Math.round(performance.now() - stepStart);
        setSteps((prev) =>
          prev.map((s, idx) =>
            idx === i
              ? {
                  ...s,
                  status: 'error',
                  duration: dur,
                  errorMsg: err?.message || 'Network request failed',
                }
              : s
          )
        );
        break;
      }
    }

    setTotalWorkflowTime(Math.round(performance.now() - startAll));
    setIsRunning(false);
  };

  return (
    <div
      onClick={() => !isRunning && setScenarioModalOpen(false)}
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl h-[85vh] bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-input)]">
          <div className="flex items-center gap-2">
            <Workflow className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-[var(--text-main)]">
              Multi-Step API Workflow Chainer & Scenario Runner
            </h3>
          </div>
          <button
            onClick={() => !isRunning && setScenarioModalOpen(false)}
            disabled={isRunning}
            className="text-[var(--text-dim)] hover:text-[var(--text-main)] p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-3 bg-[var(--bg-card)]/50 border-b border-[var(--border-color)] flex items-center justify-between gap-3">
          <div className="text-xs text-[var(--text-muted)]">
            Chain requests sequentially. Extracted variables pass downstream to subsequent steps via{' '}
            <code className="text-blue-400 font-mono">{'{{varName}}'}</code>.
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={addStep}
              disabled={isRunning}
              className="px-2.5 py-1.5 bg-[var(--bg-input)] hover:bg-[var(--bg-card)] border border-[var(--border-color)] text-[var(--text-main)] rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              <span>Add Step</span>
            </button>
            <button
              onClick={runWorkflow}
              disabled={isRunning}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-1.5 shadow-md transition-all ${
                isRunning
                  ? 'bg-blue-600/50 cursor-wait'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 cursor-pointer active:scale-98'
              }`}
            >
              {isRunning ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5" />
              )}
              <span>{isRunning ? 'Running Scenario...' : 'Run Scenario'}</span>
            </button>
          </div>
        </div>

        {/* Step List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[var(--bg-app)]">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div
                className={`p-3 rounded-xl border transition-all ${
                  step.status === 'running'
                    ? 'border-blue-500 bg-blue-500/5 shadow-md shadow-blue-500/10'
                    : step.status === 'success'
                    ? 'border-emerald-500/40 bg-emerald-500/5'
                    : step.status === 'error'
                    ? 'border-red-500/40 bg-red-500/5'
                    : 'border-[var(--border-color)] bg-[var(--bg-card)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center font-mono text-[10px] font-bold text-[var(--text-muted)]">
                      {index + 1}
                    </span>
                    <input
                      type="text"
                      value={step.name}
                      onChange={(e) => updateStep(step.id, { name: e.target.value })}
                      className="bg-transparent font-bold text-xs text-[var(--text-main)] outline-none flex-1"
                    />
                  </div>

                  {/* Status Indicator */}
                  <div className="flex items-center gap-2">
                    {step.status === 'running' && (
                      <span className="flex items-center gap-1 text-xs text-blue-400 font-semibold font-mono animate-pulse">
                        <span className="w-2.5 h-2.5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                        Executing...
                      </span>
                    )}
                    {step.status === 'success' && (
                      <span className="flex items-center gap-1 text-xs text-emerald-400 font-semibold font-mono">
                        <CheckCircle2 className="w-4 h-4" />
                        {step.statusCode} OK ({step.duration}ms)
                      </span>
                    )}
                    {step.status === 'error' && (
                      <span className="flex items-center gap-1 text-xs text-red-400 font-semibold font-mono">
                        <XCircle className="w-4 h-4" />
                        {step.errorMsg} ({step.duration}ms)
                      </span>
                    )}
                    <button
                      onClick={() => removeStep(step.id)}
                      disabled={isRunning}
                      className="text-[var(--text-dim)] hover:text-red-400 p-1 rounded"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Path & Method Input */}
                <div className="flex items-center gap-2">
                  <select
                    value={step.method}
                    onChange={(e) => updateStep(step.id, { method: e.target.value })}
                    className="px-2 py-1 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg font-mono font-bold text-xs text-blue-400 outline-none"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                  </select>

                  <input
                    type="text"
                    value={step.path}
                    onChange={(e) => updateStep(step.id, { path: e.target.value })}
                    placeholder="/v1/endpoint/{{variable}}"
                    className="flex-1 px-3 py-1 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg font-mono text-xs text-[var(--text-main)] outline-none"
                  />
                </div>

                {/* Variable Extraction Config */}
                <div className="mt-2 pt-2 border-t border-[var(--border-color)]/50 flex items-center gap-2 text-xs">
                  <span className="text-[11px] text-[var(--text-dim)]">Extract Variable:</span>
                  <input
                    type="text"
                    placeholder="JSON path (e.g. data.token)"
                    value={step.extractJsonPath || ''}
                    onChange={(e) => updateStep(step.id, { extractJsonPath: e.target.value })}
                    className="w-48 px-2 py-0.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-[11px] font-mono text-[var(--text-main)] outline-none"
                  />
                  <span className="text-[11px] text-[var(--text-dim)]">➔ Save as</span>
                  <input
                    type="text"
                    placeholder="variableName (e.g. token)"
                    value={step.extractVariableKey || ''}
                    onChange={(e) => updateStep(step.id, { extractVariableKey: e.target.value })}
                    className="w-40 px-2 py-0.5 bg-[var(--bg-input)] border border-[var(--border-color)] rounded text-[11px] font-mono text-purple-400 outline-none"
                  />
                </div>
              </div>

              {index < steps.length - 1 && (
                <div className="flex justify-center my-0.5">
                  <ArrowDown className="w-4 h-4 text-[var(--text-dim)]" />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Footer Summary */}
        {totalWorkflowTime !== null && (
          <div className="p-3 bg-[var(--bg-card)] border-t border-[var(--border-color)] flex items-center justify-between text-xs">
            <span className="font-bold text-[var(--text-main)]">
              Scenario Execution Finished
            </span>
            <span className="font-mono text-emerald-400 font-bold">
              Total Duration: {totalWorkflowTime}ms
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
