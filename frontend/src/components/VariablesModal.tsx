import React, { useState, useRef } from 'react';
import { useStudioStore } from '../store/useStudioStore';
import { X, Plus, Trash2, Globe, Check, Key } from 'lucide-react';

export const VariablesModal: React.FC = () => {
  const { isVariablesModalOpen, setVariablesModalOpen, variables, setVariable, deleteVariable } = useStudioStore();
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const keyInputRef = useRef<HTMLInputElement>(null);

  if (!isVariablesModalOpen) return null;

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  };

  const handleAdd = () => {
    let keyToAdd = newKey.trim();
    if (!keyToAdd) {
      // Auto-generate key name if empty so clicking + always works immediately
      let idx = 1;
      while (variables[`var_${idx}`]) {
        idx++;
      }
      keyToAdd = `var_${idx}`;
    }

    setVariable(keyToAdd, newVal.trim());
    showFeedback(`Added variable {{${keyToAdd}}}`);
    setNewKey('');
    setNewVal('');
    setTimeout(() => {
      keyInputRef.current?.focus();
    }, 50);
  };

  const handleQuickAdd = (presetKey: string, defaultValue: string = '') => {
    if (!variables[presetKey]) {
      setVariable(presetKey, defaultValue);
      showFeedback(`Added preset {{${presetKey}}}`);
    } else {
      showFeedback(`{{${presetKey}}} is already defined`);
    }
  };

  return (
    <div
      onClick={() => setVariablesModalOpen(false)}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border-color)] bg-[var(--bg-input)]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
              <Globe className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--text-main)]">
                Dynamic Environment Variables
              </h3>
              <p className="text-[11px] text-[var(--text-muted)]">
                Reference any variable using <code className="text-blue-400 font-mono">{'{{variableName}}'}</code>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setVariablesModalOpen(false)}
            className="text-[var(--text-dim)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card)] p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Preset Chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-[var(--text-muted)] flex items-center gap-1">
              <Key className="w-3 h-3 text-amber-400" /> Quick Presets:
            </span>
            {[
              { key: 'token', val: 'Bearer token...' },
              { key: 'baseUrl', val: 'https://api.magicapi.dev' },
              { key: 'userId', val: '1001' },
              { key: 'apiKey', val: 'secret_key' },
            ].map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => handleQuickAdd(p.key, p.val)}
                className="px-2 py-0.5 rounded-md bg-[var(--bg-card)] hover:bg-blue-500/15 hover:text-blue-400 border border-[var(--border-color)] text-[11px] font-mono text-[var(--text-muted)] transition-all cursor-pointer flex items-center gap-1"
              >
                <span>+</span>
                <span>{`{{${p.key}}}`}</span>
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="border border-[var(--border-color)] rounded-lg overflow-hidden bg-[var(--bg-card)]">
            <table className="w-full text-xs font-mono border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-color)] bg-[var(--bg-input)] text-[var(--text-muted)] uppercase text-[10px] text-left">
                  <th className="py-2 px-3 w-1/3">Variable Name</th>
                  <th className="py-2 px-3 w-1/2">Current Value</th>
                  <th className="py-2 px-2 text-center w-16">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]/50">
                {Object.entries(variables).map(([k, v]) => (
                  <tr key={k} className="hover:bg-white/5 transition-colors group">
                    <td className="p-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-blue-400 px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 truncate">
                          {`{{${k}}}`}
                        </span>
                      </div>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={v}
                        onChange={(e) => setVariable(k, e.target.value)}
                        placeholder="Empty"
                        className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] focus:border-[var(--border-focus)] rounded px-2.5 py-1 text-xs text-[var(--text-main)] outline-none transition-colors"
                      />
                    </td>
                    <td className="p-2 text-center">
                      <button
                        type="button"
                        onClick={() => deleteVariable(k)}
                        className="text-[var(--text-dim)] hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-md transition-colors cursor-pointer"
                        title={`Delete ${k}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}

                {/* Add New Variable Row */}
                <tr className="bg-blue-500/5">
                  <td className="p-2">
                    <input
                      ref={keyInputRef}
                      type="text"
                      placeholder="e.g. token or baseUrl"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAdd();
                      }}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] focus:border-[var(--border-focus)] rounded px-2.5 py-1 text-xs text-[var(--text-main)] font-bold outline-none transition-colors placeholder:font-normal placeholder:text-[var(--text-dim)]"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      placeholder="Variable value"
                      value={newVal}
                      onChange={(e) => setNewVal(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAdd();
                      }}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] focus:border-[var(--border-focus)] rounded px-2.5 py-1 text-xs text-[var(--text-main)] outline-none transition-colors placeholder:text-[var(--text-dim)]"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      onClick={handleAdd}
                      className="w-full py-1 px-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md text-xs font-bold flex items-center justify-center gap-1 shadow-xs transition-colors cursor-pointer"
                      title="Add Variable (+)"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Dynamic built-in helpers reference */}
          <div className="rounded-lg bg-[var(--bg-input)] p-3 border border-[var(--border-color)] space-y-1.5 text-[11px] text-[var(--text-muted)]">
            <span className="font-bold text-[var(--text-main)] block mb-1">
              ✨ Built-in Dynamic Generators (Ready to use in requests):
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-[10px]">
              <div className="bg-[var(--bg-card)] p-1.5 rounded border border-[var(--border-color)]">
                <code className="text-purple-400 font-bold">{'{{$uuid}}'}</code>
                <span className="block text-[var(--text-dim)]">Random UUIDv4</span>
              </div>
              <div className="bg-[var(--bg-card)] p-1.5 rounded border border-[var(--border-color)]">
                <code className="text-purple-400 font-bold">{'{{$timestamp}}'}</code>
                <span className="block text-[var(--text-dim)]">Epoch Millis</span>
              </div>
              <div className="bg-[var(--bg-card)] p-1.5 rounded border border-[var(--border-color)]">
                <code className="text-purple-400 font-bold">{'{{$randomEmail}}'}</code>
                <span className="block text-[var(--text-dim)]">Random email</span>
              </div>
              <div className="bg-[var(--bg-card)] p-1.5 rounded border border-[var(--border-color)]">
                <code className="text-purple-400 font-bold">{'{{$randomInt}}'}</code>
                <span className="block text-[var(--text-dim)]">Random integer</span>
              </div>
              <div className="bg-[var(--bg-card)] p-1.5 rounded border border-[var(--border-color)]">
                <code className="text-purple-400 font-bold">{'{{$isoTimestamp}}'}</code>
                <span className="block text-[var(--text-dim)]">ISO-8601 Date</span>
              </div>
              <div className="bg-[var(--bg-card)] p-1.5 rounded border border-[var(--border-color)]">
                <code className="text-purple-400 font-bold">{'{{$today}}'}</code>
                <span className="block text-[var(--text-dim)]">YYYY-MM-DD</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[var(--border-color)] bg-[var(--bg-input)] flex items-center justify-between">
          <div className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
            {feedback ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>{feedback}</span>
              </>
            ) : (
              <span className="text-[var(--text-dim)]">Changes auto-saved to workspace</span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setVariablesModalOpen(false)}
            className="px-4 py-1.5 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] text-[var(--text-main)] text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

