import React, { useState } from 'react';
import { useStudioStore } from '../store/useStudioStore';
import { Plus, X, Check } from 'lucide-react';
import { ContextMenu } from './ContextMenu';

export const TabBar: React.FC = () => {
  const { tabs, activeTabId, setActiveTabId, closeTab, createBlankTab, tabModeEnabled } = useStudioStore();
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
    method: string;
    path: string;
  } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // If Focus mode is active, hide TabBar completely!
  if (!tabModeEnabled) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const handleContextMenu = (e: React.MouseEvent, tabId: string, method: string, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      tabId,
      method,
      path,
    });
  };

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'text-emerald-400';
      case 'POST':
        return 'text-orange-400';
      case 'PUT':
        return 'text-amber-400';
      case 'DELETE':
        return 'text-red-400';
      case 'PATCH':
        return 'text-purple-400';
      default:
        return 'text-blue-400';
    }
  };

  return (
    <div className="flex items-center bg-[var(--bg-sidebar)] border-b border-[var(--border-color)] px-3 pt-1 gap-1 select-none overflow-x-auto shrink-0 relative">
      <div className="flex items-center gap-1 flex-1 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              onContextMenu={(e) => handleContextMenu(e, tab.id, tab.method, tab.path)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs cursor-pointer border-t border-x transition-all max-w-[220px] shrink-0 group ${
                isActive
                  ? 'bg-[var(--bg-app)] border-[var(--border-color)] text-[var(--text-main)] font-semibold shadow-xs'
                  : 'bg-transparent border-transparent text-[var(--text-muted)] hover:bg-[var(--bg-card)] hover:text-[var(--text-main)]'
              }`}
            >
              <span className={`font-mono text-[10px] font-bold ${getMethodColor(tab.method)}`}>
                {tab.method}
              </span>
              <span className="truncate flex-1 font-sans">
                {tab.title || tab.path || 'New Request'}
              </span>
              {tab.isDirty && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="opacity-0 group-hover:opacity-100 hover:bg-white/10 p-0.5 rounded text-[var(--text-muted)] hover:text-red-400 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>

      <button
        onClick={createBlankTab}
        className="p-1 hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded-md transition-colors"
        title="Open New Tab (+)"
      >
        <Plus className="w-4 h-4" />
      </button>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tabId={contextMenu.tabId}
          method={contextMenu.method}
          path={contextMenu.path}
          onClose={() => setContextMenu(null)}
          onShowToast={showToast}
        />
      )}

      {/* Toast */}
      {toastMessage && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 px-3 py-1 bg-emerald-600 text-white font-semibold text-xs rounded-lg shadow-xl flex items-center gap-1.5">
          <Check className="w-3 h-3" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
};
