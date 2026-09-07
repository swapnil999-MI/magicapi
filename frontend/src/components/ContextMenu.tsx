import React, { useEffect, useRef } from 'react';
import { Bookmark, Copy, ExternalLink, Code, X, Layers } from 'lucide-react';
import { useStudioStore } from '../store/useStudioStore';

export interface ContextMenuProps {
  x: number;
  y: number;
  method?: string;
  path?: string;
  tabId?: string;
  onClose: () => void;
  onShowToast?: (msg: string) => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  method = 'GET',
  path = '',
  tabId,
  onClose,
  onShowToast,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const {
    saveEndpointToCollection,
    saveTabToCollection,
    openEndpointInTab,
    closeTab,
    tabs,
    environment,
  } = useStudioStore();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust coordinates so menu stays inside viewport
  const adjustedX = Math.min(x, window.innerWidth - 220);
  const adjustedY = Math.min(y, window.innerHeight - 240);

  const handleSave = () => {
    if (tabId) {
      saveTabToCollection(tabId, 'Saved');
    } else {
      saveEndpointToCollection(method, path, 'Saved');
    }
    if (onShowToast) onShowToast('🔖 Saved to Collections!');
    onClose();
  };

  const handleOpen = () => {
    openEndpointInTab(method, path, true);
    onClose();
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(path);
    if (onShowToast) onShowToast('📋 Path copied to clipboard');
    onClose();
  };

  const handleCopyFullUrl = () => {
    const env = environment.replace(/\/$/, '');
    const fullUrl = `${env}${path.startsWith('/') ? '' : '/'}${path}`;
    navigator.clipboard.writeText(fullUrl);
    if (onShowToast) onShowToast('📋 Full URL copied to clipboard');
    onClose();
  };

  const handleCopyCurl = () => {
    const env = environment.replace(/\/$/, '');
    const fullUrl = `${env}${path.startsWith('/') ? '' : '/'}${path}`;
    const curl = `curl -X ${method.toUpperCase()} "${fullUrl}" -H "Accept: application/json"`;
    navigator.clipboard.writeText(curl);
    if (onShowToast) onShowToast('💻 cURL command copied');
    onClose();
  };

  const handleCloseOtherTabs = () => {
    if (tabId) {
      tabs.forEach((t) => {
        if (t.id !== tabId) closeTab(t.id);
      });
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      style={{ top: `${adjustedY}px`, left: `${adjustedX}px` }}
      className="fixed z-50 w-52 bg-[var(--bg-sidebar)] border border-[var(--border-color)] rounded-xl shadow-2xl py-1 text-xs select-none backdrop-blur-md animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="px-3 py-1.5 border-b border-[var(--border-color)] text-[10px] font-bold text-[var(--text-dim)] uppercase truncate flex items-center justify-between">
        <span className="truncate">{path || 'Request Actions'}</span>
        <span className="font-mono text-blue-400 font-bold ml-1">{method}</span>
      </div>

      <div className="p-1 space-y-0.5">
        {/* 1. Save Option */}
        <button
          onClick={handleSave}
          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[var(--bg-card)] hover:text-amber-400 flex items-center gap-2 text-[var(--text-main)] transition-colors"
        >
          <Bookmark className="w-3.5 h-3.5 text-amber-400" />
          <span>Save to Collections</span>
        </button>

        {/* 2. Open */}
        <button
          onClick={handleOpen}
          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[var(--bg-card)] flex items-center gap-2 text-[var(--text-main)] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
          <span>Open in Studio</span>
        </button>

        <div className="my-1 border-t border-[var(--border-color)]" />

        {/* 3. Copy Path */}
        <button
          onClick={handleCopyPath}
          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[var(--bg-card)] flex items-center gap-2 text-[var(--text-main)] transition-colors"
        >
          <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span>Copy Path</span>
        </button>

        {/* 4. Copy Full URL */}
        <button
          onClick={handleCopyFullUrl}
          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[var(--bg-card)] flex items-center gap-2 text-[var(--text-main)] transition-colors"
        >
          <Copy className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          <span>Copy Full URL</span>
        </button>

        {/* 5. Copy cURL */}
        <button
          onClick={handleCopyCurl}
          className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-[var(--bg-card)] flex items-center gap-2 text-[var(--text-main)] transition-colors"
        >
          <Code className="w-3.5 h-3.5 text-emerald-400" />
          <span>Copy as cURL</span>
        </button>

        {/* Tab specific actions */}
        {tabId && (
          <>
            <div className="my-1 border-t border-[var(--border-color)]" />
            <button
              onClick={() => {
                closeTab(tabId);
                onClose();
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 flex items-center gap-2 text-[var(--text-muted)] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              <span>Close Tab</span>
            </button>
            {tabs.length > 1 && (
              <button
                onClick={handleCloseOtherTabs}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 flex items-center gap-2 text-[var(--text-muted)] transition-colors"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Close Other Tabs</span>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
