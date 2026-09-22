import React, { useState, useMemo } from 'react';
import { useStudioStore } from '../store/useStudioStore';
import { Folder, Clock, Bookmark, Search, ChevronDown, ChevronRight, Trash2, Plus, Sparkles, Check, Zap } from 'lucide-react';
import { ContextMenu } from './ContextMenu';

interface SidebarProps {
  style?: React.CSSProperties;
}

export const Sidebar: React.FC<SidebarProps> = ({ style }) => {
  const [activeSidebarTab, setActiveSidebarTab] = useState<'endpoints' | 'history' | 'collections'>('endpoints');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOption, setSortOption] = useState<'default' | 'latest' | 'updated' | 'alpha'>('default');
  const [collapsedTags, setCollapsedTags] = useState<Record<string, boolean>>({});
  const [isRecent7DaysCollapsed, setIsRecent7DaysCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('magicapi_recent_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; method: string; path: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const {
    spec,
    openEndpointInTab,
    activeTabId,
    tabs,
    history,
    savedCollections,
    clearHistory,
    saveCurrentToCollection,
  } = useStudioStore();

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const handleContextMenu = (e: React.MouseEvent, method: string, path: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      method,
      path,
    });
  };

  const parseApiDate = (isoStr?: string): number => {
    if (!isoStr) return 0;
    const d = Date.parse(isoStr);
    return isNaN(d) ? 0 : d;
  };

  const formatDateTime = (isoStr?: string): string => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `${datePart}, ${timePart}`;
    } catch {
      return '';
    }
  };

  // Group endpoints by tag & identify Last 7 Days endpoints
  const { groupedEndpoints, last7DaysEndpoints } = useMemo(() => {
    if (!spec?.paths) return { groupedEndpoints: {}, last7DaysEndpoints: [] };
    const groups: Record<string, Array<{
      method: string;
      path: string;
      summary: string;
      op: any;
      createdAt: number;
      updatedAt: number;
      createdRaw?: string;
      updatedRaw?: string;
    }>> = {};

    const allList: Array<{
      method: string;
      path: string;
      summary: string;
      op: any;
      createdAt: number;
      updatedAt: number;
      createdRaw?: string;
      updatedRaw?: string;
    }> = [];

    for (const [path, pathItem] of Object.entries(spec.paths)) {
      for (const method of ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'] as const) {
        const op = (pathItem as any)[method];
        if (!op) continue;

        const summary = op.summary || '';
        const tags = op.tags && op.tags.length > 0 ? op.tags : ['General'];
        const createdRaw = op['x-created-at'] || op['created_at'];
        const updatedRaw = op['x-updated-at'] || op['updated_at'];
        const createdAt = parseApiDate(createdRaw);
        const updatedAt = parseApiDate(updatedRaw);

        // Search filter
        if (
          searchQuery &&
          !path.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !summary.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !method.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !tags.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase()))
        ) {
          continue;
        }

        const item = {
          method: method.toUpperCase(),
          path,
          summary,
          op,
          createdAt,
          updatedAt,
          createdRaw,
          updatedRaw,
        };

        allList.push(item);

        tags.forEach((tag: string) => {
          if (!groups[tag]) groups[tag] = [];
          groups[tag].push(item);
        });
      }
    }

    // Sort endpoints within tags
    for (const tag in groups) {
      if (sortOption === 'alpha') {
        groups[tag].sort((a, b) => a.path.localeCompare(b.path));
      } else if (sortOption === 'latest') {
        groups[tag].sort((a, b) => b.createdAt - a.createdAt);
      } else if (sortOption === 'updated') {
        groups[tag].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
      }
    }

    // Filter Last 7 Days (within 7 days of now, or top recent items if spec has older timestamps)
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let recent7 = allList.filter((item) => {
      const recentTimestamp = Math.max(item.updatedAt, item.createdAt);
      return recentTimestamp >= sevenDaysAgo;
    });

    if (recent7.length === 0) {
      // Fallback to top recent items sorted by latest activity
      recent7 = [...allList]
        .filter((item) => item.createdAt > 0 || item.updatedAt > 0)
        .sort((a, b) => Math.max(b.updatedAt, b.createdAt) - Math.max(a.updatedAt, a.createdAt))
        .slice(0, 8);
    } else {
      recent7.sort((a, b) => Math.max(b.updatedAt, b.createdAt) - Math.max(a.updatedAt, a.createdAt));
    }

    return { groupedEndpoints: groups, last7DaysEndpoints: recent7 };
  }, [spec, searchQuery, sortOption]);

  const toggleRecent7Days = () => {
    setIsRecent7DaysCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('magicapi_recent_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const toggleTag = (tag: string) => {
    setCollapsedTags((prev) => ({ ...prev, [tag]: !prev[tag] }));
  };

  const toggleAllTags = () => {
    const isAnyExpanded =
      Object.keys(groupedEndpoints).some((tag) => !collapsedTags[tag]) ||
      (last7DaysEndpoints.length > 0 && !isRecent7DaysCollapsed);
    const shouldCollapse = isAnyExpanded;

    const nextState: Record<string, boolean> = {};
    Object.keys(groupedEndpoints).forEach((tag) => {
      nextState[tag] = shouldCollapse;
    });
    setCollapsedTags(nextState);
    setIsRecent7DaysCollapsed(shouldCollapse);
    try {
      localStorage.setItem('magicapi_recent_collapsed', String(shouldCollapse));
    } catch {}
  };

  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'POST':
        return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
      case 'PUT':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'DELETE':
        return 'bg-red-500/15 text-red-400 border-red-500/30';
      case 'PATCH':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'OPTIONS':
        return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
      case 'HEAD':
        return 'bg-teal-500/15 text-teal-400 border-teal-500/30';
      case 'TRACE':
        return 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
      default:
        return 'bg-blue-500/15 text-blue-400 border-blue-500/30';
    }
  };

  return (
    <aside
      style={style}
      className="w-80 min-w-[200px] max-w-[750px] bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col shrink-0 select-none overflow-hidden h-full relative"
    >
      {/* 1. Sidebar Segmented Nav */}
      <div className="flex bg-[var(--bg-input)] border-b border-[var(--border-color)] p-1 gap-1">
        <button
          onClick={() => setActiveSidebarTab('endpoints')}
          className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all ${
            activeSidebarTab === 'endpoints'
              ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Folder className="w-3.5 h-3.5 text-blue-400" />
          <span>APIs</span>
        </button>
        <button
          onClick={() => setActiveSidebarTab('history')}
          className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all ${
            activeSidebarTab === 'history'
              ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span>History</span>
          <span className="font-mono text-[10px] bg-white/10 px-1.5 py-0.2 rounded-full text-[var(--text-muted)]">
            {history.length}
          </span>
        </button>
        <button
          onClick={() => setActiveSidebarTab('collections')}
          className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all ${
            activeSidebarTab === 'collections'
              ? 'bg-[var(--bg-card)] text-[var(--text-main)] shadow-sm'
              : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
          }`}
        >
          <Bookmark className="w-3.5 h-3.5 text-emerald-400" />
          <span>Saved</span>
          <span className="font-mono text-[10px] bg-white/10 px-1.5 py-0.2 rounded-full text-[var(--text-muted)]">
            {Object.values(savedCollections).reduce((acc, curr) => acc + curr.length, 0)}
          </span>
        </button>
      </div>

      {/* 2. Endpoints List View */}
      {activeSidebarTab === 'endpoints' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Search & Sort Tool Strip */}
          <div className="p-2.5 border-b border-[var(--border-color)] space-y-2 bg-[var(--bg-sidebar)]">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-[var(--text-dim)]" />
              <input
                type="text"
                placeholder="Filter endpoints... (Right-click to save)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] focus:border-[var(--border-focus)] rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none"
              />
            </div>

            <div className="flex items-center justify-between gap-1 text-xs">
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as any)}
                className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded px-2 py-1 text-[11px] text-[var(--text-muted)] outline-none cursor-pointer flex-1"
              >
                <option value="default">⏱️ Default Order</option>
                <option value="latest">✨ Latest Created (Time)</option>
                <option value="updated">🔄 Recently Updated (Time)</option>
                <option value="alpha">🔤 Alphabetical (A-Z)</option>
              </select>

              <button
                onClick={toggleAllTags}
                className="px-2 py-1 bg-[var(--bg-card)] border border-[var(--border-color)] hover:bg-[var(--bg-card-hover)] rounded text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] font-semibold transition-colors"
                title="Expand / Collapse All Categories"
              >
                Fold
              </button>
            </div>
          </div>

          {/* Endpoints Accordion List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {/* SPECIAL TOP SECTION: Latest Created APIs */}
            {last7DaysEndpoints.length > 0 && !searchQuery && (
              <div className="border border-blue-500/30 rounded-lg overflow-hidden bg-[var(--bg-card)]/40">
                <div
                  onClick={toggleRecent7Days}
                  className="px-2.5 py-2 bg-blue-500/10 flex items-center justify-between cursor-pointer hover:bg-blue-500/15 transition-colors border-b border-blue-500/20"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {isRecent7DaysCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5 text-blue-400" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-blue-400" />
                    )}
                    <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="font-bold text-xs text-blue-300 truncate">
                      Latest Created APIs
                    </span>
                  </div>
                  <span className="font-mono text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.2 rounded-full border border-blue-500/30 shrink-0 font-bold">
                    {last7DaysEndpoints.length}
                  </span>
                </div>

                {!isRecent7DaysCollapsed && (
                  <div className="p-1 space-y-0.5">
                    {last7DaysEndpoints.map((ep) => {
                      const isSelected = activeTab?.method === ep.method && activeTab?.path === ep.path;
                      const hasUpdated = ep.updatedRaw && ep.updatedRaw !== ep.createdRaw;
                      const dateToDisplay = hasUpdated ? ep.updatedRaw : ep.createdRaw;

                      return (
                        <button
                          key={`recent-${ep.method}-${ep.path}`}
                          onClick={() => openEndpointInTab(ep.method, ep.path)}
                          onContextMenu={(e) => handleContextMenu(e, ep.method, ep.path)}
                          className={`w-full text-left px-2 py-1.5 rounded-md flex items-center justify-between gap-1.5 transition-all group ${
                            isSelected
                              ? 'bg-[var(--border-focus)]/15 border-l-2 border-l-[var(--border-focus)] text-[var(--text-main)] font-semibold'
                              : 'hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span
                              className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${getMethodBadgeClass(
                                ep.method
                              )}`}
                            >
                              {ep.method}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="font-mono text-xs truncate">
                                {ep.path}
                              </div>
                              {ep.summary && (
                                <div className="text-[11px] text-[var(--text-dim)] truncate">
                                  {ep.summary}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Timestamp with Date & Time on Right */}
                          {dateToDisplay && (
                            <span
                              className={`font-mono text-[9px] px-1.5 py-0.5 rounded shrink-0 border ${
                                hasUpdated
                                  ? 'text-purple-400 bg-purple-500/10 border-purple-500/20'
                                  : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                              }`}
                              title={hasUpdated ? `Updated: ${ep.updatedRaw}` : `Created: ${ep.createdRaw}`}
                            >
                              {formatDateTime(dateToDisplay)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {Object.keys(groupedEndpoints).length === 0 ? (
              <div className="p-4 text-center text-xs text-[var(--text-dim)]">
                No matching endpoints found
              </div>
            ) : (
              Object.entries(groupedEndpoints).map(([tag, endpoints]) => {
                const isCollapsed = collapsedTags[tag];
                return (
                  <div key={tag} className="border border-[var(--border-color)]/60 rounded-lg overflow-hidden bg-[var(--bg-card)]/40">
                    {/* Tag Header */}
                    <div
                      onClick={() => toggleTag(tag)}
                      className="px-2.5 py-2 bg-[var(--bg-input)] flex items-center justify-between cursor-pointer hover:bg-[var(--bg-card)] transition-colors border-b border-[var(--border-color)]/40"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        {isCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 text-[var(--text-dim)]" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-[var(--text-dim)]" />
                        )}
                        <span className="font-bold text-xs text-[var(--text-main)] truncate">
                          {tag}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] bg-white/10 px-1.5 py-0.2 rounded-full text-[var(--text-muted)] shrink-0">
                        {endpoints.length}
                      </span>
                    </div>

                    {/* Endpoint Items */}
                    {!isCollapsed && (
                      <div className="p-1 space-y-0.5">
                        {endpoints.map((ep) => {
                          const isSelected = activeTab?.method === ep.method && activeTab?.path === ep.path;
                          
                          // Determine date to display based on sort mode
                          const dateToShow =
                            sortOption === 'updated'
                              ? ep.updatedRaw || ep.createdRaw
                              : sortOption === 'latest'
                              ? ep.createdRaw
                              : ep.updatedRaw || ep.createdRaw;

                          return (
                            <button
                              key={`${ep.method}-${ep.path}`}
                              onClick={() => openEndpointInTab(ep.method, ep.path)}
                              onContextMenu={(e) => handleContextMenu(e, ep.method, ep.path)}
                              className={`w-full text-left px-2 py-1.5 rounded-md flex items-center justify-between gap-1.5 transition-all group ${
                                isSelected
                                  ? 'bg-[var(--border-focus)]/15 border-l-2 border-l-[var(--border-focus)] text-[var(--text-main)] font-semibold'
                                  : 'hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <span
                                  className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${getMethodBadgeClass(
                                    ep.method
                                  )}`}
                                >
                                  {ep.method}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <div className="font-mono text-xs truncate">
                                    {ep.path}
                                  </div>
                                  {ep.summary && (
                                    <div className="text-[11px] text-[var(--text-dim)] truncate">
                                      {ep.summary}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Timestamp with Date & Time on Right */}
                              {dateToShow && (
                                <span
                                  className={`font-mono text-[9px] px-1.5 py-0.5 rounded shrink-0 border ${
                                    sortOption === 'updated'
                                      ? 'text-purple-400 bg-purple-500/10 border-purple-500/20'
                                      : 'text-[var(--text-dim)] bg-white/5 border-[var(--border-color)] group-hover:text-blue-400 group-hover:bg-blue-500/10 group-hover:border-blue-500/20'
                                  }`}
                                  title={`Timestamp: ${dateToShow}`}
                                >
                                  {formatDateTime(dateToShow)}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 3. History List View */}
      {activeSidebarTab === 'history' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-input)] flex items-center justify-between">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Recent Requests
            </span>
            {history.length > 0 && (
              <button
                onClick={clearHistory}
                className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {history.length === 0 ? (
              <div className="p-4 text-center text-xs text-[var(--text-dim)]">
                No request history yet. Run an API request to see execution logs.
              </div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => openEndpointInTab(item.method, item.url)}
                  onContextMenu={(e) => handleContextMenu(e, item.method, item.url)}
                  className="p-2 bg-[var(--bg-card)] border border-[var(--border-color)] hover:border-[var(--border-focus)] rounded-lg cursor-pointer transition-colors space-y-1 group"
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${getMethodBadgeClass(item.method)}`}>
                      {item.method}
                    </span>
                    <span className={`font-mono text-[10px] font-bold ${item.status >= 200 && item.status < 300 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-[var(--text-main)] truncate">
                    {item.url}
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)] font-mono">
                    <span>⏱️ {item.duration}ms</span>
                    <span>{item.timestamp}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4. Saved Collections View */}
      {activeSidebarTab === 'collections' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          <div className="px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-input)] flex items-center justify-between">
            <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
              Saved Collections
            </span>
            <button
              onClick={() => {
                const name = prompt('Enter request name:');
                if (name) saveCurrentToCollection(name);
              }}
              className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
            >
              <Plus className="w-3 h-3" />
              <span>Save Current</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {Object.keys(savedCollections).length === 0 ? (
              <div className="p-4 text-center text-xs text-[var(--text-dim)]">
                No saved collections. Right-click any API to save it to your bookmarks!
              </div>
            ) : (
              Object.entries(savedCollections).map(([folder, items]) => (
                <div key={folder} className="border border-[var(--border-color)] rounded-lg overflow-hidden bg-[var(--bg-card)]/40">
                  <div className="px-2.5 py-2 bg-[var(--bg-input)] flex items-center justify-between border-b border-[var(--border-color)]/40">
                    <span className="font-bold text-xs text-[var(--text-main)]">{folder}</span>
                    <span className="font-mono text-[10px] bg-white/10 px-1.5 py-0.2 rounded-full text-[var(--text-muted)]">
                      {items.length}
                    </span>
                  </div>
                  <div className="p-1 space-y-0.5">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => openEndpointInTab(item.method, item.url)}
                        onContextMenu={(e) => handleContextMenu(e, item.method, item.url)}
                        className="px-2 py-1.5 rounded-md flex items-center gap-2 hover:bg-[var(--bg-card-hover)] cursor-pointer text-xs group"
                      >
                        <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${getMethodBadgeClass(item.method)}`}>
                          {item.method}
                        </span>
                        <div className="flex-1 min-w-0 font-mono truncate text-[var(--text-main)]">
                          {item.name || item.url}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 5. Context Menu Portal */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          method={contextMenu.method}
          path={contextMenu.path}
          onClose={() => setContextMenu(null)}
          onShowToast={showToast}
        />
      )}

      {/* 6. Toast Notification */}
      {toastMessage && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-50 px-3 py-1.5 bg-emerald-600 text-white font-semibold text-xs rounded-lg shadow-xl flex items-center gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <Check className="w-3.5 h-3.5" />
          <span>{toastMessage}</span>
        </div>
      )}
    </aside>
  );
};
