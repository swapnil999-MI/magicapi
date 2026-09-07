import React, { useState } from 'react';
import { useStudioStore } from '../store/useStudioStore';
import Editor from '@monaco-editor/react';
import { X, Copy, Check, Code, FileCode, Layers, Shield } from 'lucide-react';
import { schemaToTypeScript, schemaToZod, schemaToGo, schemaToPydantic } from '../utils/typeGenerator';

export const TypeGeneratorModal: React.FC = () => {
  const { isTypeModalOpen, setTypeModalOpen, tabs, activeTabId, spec, theme } = useStudioStore();
  const [targetLang, setTargetLang] = useState<'ts' | 'zod' | 'go' | 'python'>('ts');
  const [sourceTarget, setSourceTarget] = useState<'request' | 'response'>('request');
  const [copied, setCopied] = useState(false);

  if (!isTypeModalOpen) return null;

  const tab = tabs.find((t) => t.id === activeTabId);
  const op = tab ? spec?.paths?.[tab.path]?.[tab.method.toLowerCase() as any] : null;

  // Extract schemas
  const requestSchema = op?.requestBody?.content?.['application/json']?.schema;
  const response200Schema = op?.responses?.['200']?.content?.['application/json']?.schema ||
                            op?.responses?.['201']?.content?.['application/json']?.schema;

  const activeSchema = sourceTarget === 'request' ? requestSchema : response200Schema;
  const typeName = (op?.operationId || tab?.path.replace(/[^a-zA-Z0-9]/g, '') || 'Api') +
    (sourceTarget === 'request' ? 'Request' : 'Response');

  let generatedCode = '';
  let monacoLanguage = 'typescript';

  if (targetLang === 'ts') {
    generatedCode = schemaToTypeScript(activeSchema, typeName, spec?.components?.schemas);
    monacoLanguage = 'typescript';
  } else if (targetLang === 'zod') {
    generatedCode = schemaToZod(activeSchema, `${typeName}Schema`);
    monacoLanguage = 'typescript';
  } else if (targetLang === 'go') {
    generatedCode = schemaToGo(activeSchema, typeName);
    monacoLanguage = 'go';
  } else if (targetLang === 'python') {
    generatedCode = schemaToPydantic(activeSchema, typeName);
    monacoLanguage = 'python';
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={() => setTypeModalOpen(false)}
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4 select-none"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl h-[80vh] bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-xl shadow-2xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-color)] bg-[var(--bg-input)]">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-[var(--text-main)]">
              Instant Type & SDK Model Generator
            </h3>
            {tab && (
              <span className="text-[11px] font-mono text-[var(--text-dim)] bg-[var(--bg-card)] px-2 py-0.5 rounded border border-[var(--border-color)]">
                {tab.method} {tab.path}
              </span>
            )}
          </div>
          <button
            onClick={() => setTypeModalOpen(false)}
            className="text-[var(--text-dim)] hover:text-[var(--text-main)] p-1 rounded transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar Controls */}
        <div className="p-3 border-b border-[var(--border-color)] flex items-center justify-between bg-[var(--bg-card)]/50 gap-3 flex-wrap">
          {/* Target Model Selector */}
          <div className="flex items-center gap-1 bg-[var(--bg-input)] p-0.5 rounded-lg border border-[var(--border-color)]">
            <button
              onClick={() => setSourceTarget('request')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                sourceTarget === 'request'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Request Schema
            </button>
            <button
              onClick={() => setSourceTarget('response')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                sourceTarget === 'response'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
              }`}
            >
              Response 200/201 Schema
            </button>
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-1 bg-[var(--bg-input)] p-0.5 rounded-lg border border-[var(--border-color)]">
            {[
              { id: 'ts', label: 'TypeScript' },
              { id: 'zod', label: 'Zod Schema' },
              { id: 'go', label: 'Go Struct' },
              { id: 'python', label: 'Python Pydantic' },
            ].map((lang) => (
              <button
                key={lang.id}
                onClick={() => setTargetLang(lang.id as any)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                  targetLang === lang.id
                    ? 'bg-[var(--bg-app)] text-[var(--border-focus)] border border-[var(--border-color)] shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="px-3 py-1 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied Code' : 'Copy Types'}</span>
          </button>
        </div>

        {/* Monaco Editor Output */}
        <div className="flex-1 overflow-hidden relative">
          <Editor
            height="100%"
            language={monacoLanguage}
            theme={theme === 'light' ? 'light' : 'vs-dark'}
            value={generatedCode}
            options={{
              readOnly: true,
              minimap: { enabled: false },
              fontSize: 12,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
      </div>
    </div>
  );
};
