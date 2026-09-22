import React, { useState, useMemo } from 'react';
import { useStudioStore } from '../store/useStudioStore';
import {
  Zap,
  Copy,
  Check,
  Search,
  ChevronDown,
  ChevronRight,
  Lock,
  Calendar,
  Clock,
  Sparkles,
  ArrowUpDown,
  Layers,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

export const DocsPortal: React.FC = () => {
  const { spec, openEndpointInTab } = useStudioStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<'default' | 'latest' | 'updated' | 'alpha'>('default');
  const [selectedLanguage, setSelectedLanguage] = useState<'curl' | 'js' | 'python' | 'go'>('curl');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [collapsedTags, setCollapsedTags] = useState<Record<string, boolean>>({});
  const [activeEndpointId, setActiveEndpointId] = useState<string>('');
  const [activeResponseStatuses, setActiveResponseStatuses] = useState<Record<string, string>>({});

  // Helper date functions
  const parseApiDate = (isoStr?: string) => {
    if (!isoStr) return 0;
    const t = Date.parse(isoStr);
    return isNaN(t) ? 0 : t;
  };

  const formatApiDateFull = (isoStr?: string) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      const timePart = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      return `${datePart}, ${timePart}`;
    } catch {
      return isoStr;
    }
  };

  const formatApiDateShort = (isoStr?: string) => {
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

  // Group paths and apply sorting
  const { groupedEndpoints, latestThisWeek } = useMemo(() => {
    if (!spec?.paths) return { groupedEndpoints: {}, latestThisWeek: [] };

    const allEndpoints: Array<{
      method: string;
      path: string;
      summary: string;
      op: any;
      tags: string[];
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

        if (
          searchQuery &&
          !path.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !summary.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !method.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !tags.some((t: string) => t.toLowerCase().includes(searchQuery.toLowerCase()))
        ) {
          continue;
        }

        const rawParams = [
          ...(pathItem.parameters || []),
          ...(op.parameters || []),
        ];
        const seen = new Set<string>();
        const mergedParams: any[] = [];
        for (const p of rawParams) {
          const k = `${p.in}:${p.name}`;
          if (!seen.has(k)) {
            seen.add(k);
            mergedParams.push(p);
          }
        }
        const effectiveOp = { ...op, parameters: mergedParams };

        allEndpoints.push({
          method: method.toUpperCase(),
          path,
          summary,
          op: effectiveOp,
          tags,
          createdAt,
          updatedAt,
          createdRaw,
          updatedRaw,
        });
      }
    }

    // Sort endpoints
    if (sortMode === 'latest') {
      allEndpoints.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sortMode === 'updated') {
      allEndpoints.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
    } else if (sortMode === 'alpha') {
      allEndpoints.sort((a, b) => a.path.localeCompare(b.path));
    }

    // Latest this week list
    let maxTime = 0;
    allEndpoints.forEach((e) => {
      if (e.createdAt > maxTime) maxTime = e.createdAt;
    });
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
    const thisWeek =
      maxTime > 0
        ? allEndpoints.filter((e) => e.createdAt && maxTime - e.createdAt <= oneWeekMs)
        : [];

    // Group into tags
    const groups: Record<string, typeof allEndpoints> = {};
    allEndpoints.forEach((ep) => {
      ep.tags.forEach((tag) => {
        if (!groups[tag]) groups[tag] = [];
        groups[tag].push(ep);
      });
    });

    return { groupedEndpoints: groups, latestThisWeek: thisWeek };
  }, [spec, searchQuery, sortMode]);

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
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

  const generateSnippet = (method: string, path: string, op: any) => {
    const url = `http://localhost:8000/v1${path}`;
    if (selectedLanguage === 'curl') {
      let code = `curl -X ${method.toUpperCase()} "${url}" \\\n  -H "Accept: application/json"`;
      if (op.security?.length) {
        code += ` \\\n  -H "Authorization: Bearer YOUR_TOKEN"`;
      }
      return code;
    }
    if (selectedLanguage === 'js') {
      return `const response = await fetch("${url}", {
  method: "${method.toUpperCase()}",
  headers: {
    "Accept": "application/json",
    ${op.security?.length ? '"Authorization": "Bearer YOUR_TOKEN"' : ''}
  }
});
const data = await response.json();
console.log(data);`;
    }
    if (selectedLanguage === 'python') {
      return `import requests

url = "${url}"
headers = {
    "Accept": "application/json",
    ${op.security?.length ? '"Authorization": "Bearer YOUR_TOKEN"' : ''}
}

response = requests.${method.toLowerCase()}(url, headers=headers)
print(response.status_code)
print(response.json())`;
    }
    if (selectedLanguage === 'go') {
      return `package main

import (
	"fmt"
	"io"
	"net/http"
)

func main() {
	req, _ := http.NewRequest("${method.toUpperCase()}", "${url}", nil)
	req.Header.Set("Accept", "application/json")
	${op.security?.length ? 'req.Header.Set("Authorization", "Bearer YOUR_TOKEN")' : ''}

	res, err := http.DefaultClient.Do(req)
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

  const generateSampleResponse = (schema: any, depth = 0, seenRefs = new Set<string>()): any => {
    if (!schema || depth > 6) return { message: 'Success' };
    
    if (schema.$ref && spec?.components?.schemas) {
      const refName = schema.$ref.split('/').pop();
      if (refName && seenRefs.has(refName)) {
        return { id: 'ref_' + refName };
      }
      if (refName && spec.components.schemas[refName]) {
        const nextSeen = new Set(seenRefs);
        nextSeen.add(refName);
        return generateSampleResponse(spec.components.schemas[refName], depth + 1, nextSeen);
      }
    }

    if (schema.example !== undefined) return schema.example;
    if (schema.enum && schema.enum.length > 0) return schema.enum[0];

    const type = schema.type || (schema.properties ? 'object' : 'string');
    if (type === 'object') {
      const obj: any = {};
      if (schema.properties) {
        for (const [k, v] of Object.entries(schema.properties)) {
          obj[k] = generateSampleResponse(v, depth + 1, seenRefs);
        }
      }
      return obj;
    }
    if (type === 'array') {
      return [generateSampleResponse(schema.items, depth + 1, seenRefs)];
    }
    if (type === 'string') {
      if (schema.format === 'email') return 'developer@magicapi.dev';
      if (schema.format === 'uuid') return 'c8a4b3e2-5a6b-4e12-9c3f-7e8a9b0c1d2e';
      if (schema.format === 'date-time') return new Date().toISOString();
      return schema.example || 'sample_' + (schema.title || 'string');
    }
    if (type === 'number' || type === 'integer') return schema.example !== undefined ? schema.example : 100;
    if (type === 'boolean') return true;
    return {};
  };

  const scrollToEndpoint = (id: string) => {
    setActiveEndpointId(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const [docsSidebarWidth, setDocsSidebarWidth] = useState<number>(() => {
    try {
      return parseInt(localStorage.getItem('openapi_docs_sidebar_width') || '288', 10);
    } catch {
      return 288;
    }
  });
  const [isDraggingDocsSidebar, setIsDraggingDocsSidebar] = useState(false);

  const handleDocsSidebarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingDocsSidebar(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.min(Math.max(moveEvent.clientX, 200), 700);
      setDocsSidebarWidth(newWidth);
      localStorage.setItem('openapi_docs_sidebar_width', String(newWidth));
    };

    const onMouseUp = () => {
      setIsDraggingDocsSidebar(false);
      document.body.style.cursor = 'default';
      document.body.style.userSelect = 'auto';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  return (
    <div className="flex flex-1 w-full h-full overflow-hidden bg-[var(--bg-root)]">
      {/* COLUMN 1: Left Docs Navigation Sidebar */}
      <aside
        style={{ width: `${docsSidebarWidth}px` }}
        className="bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col shrink-0 select-none overflow-hidden h-full"
      >
        {/* Search & Sort Header */}
        <div className="p-3 border-b border-[var(--border-color)] space-y-2">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-[var(--text-dim)]" />
            <input
              type="text"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] focus:border-[var(--border-focus)] rounded-lg pl-8 pr-2.5 py-1.5 text-xs text-[var(--text-main)] outline-none"
            />
          </div>

          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
              <ArrowUpDown className="w-3 h-3 text-[var(--text-dim)]" />
              <span>Sort:</span>
            </div>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as any)}
              className="bg-[var(--bg-card)] border border-[var(--border-color)] text-xs text-[var(--text-main)] rounded px-2 py-1 outline-none cursor-pointer"
            >
              <option value="default">⏱️ Default</option>
              <option value="latest">✨ Latest Created</option>
              <option value="updated">🔄 Recently Updated</option>
              <option value="alpha">🔤 Alphabetical</option>
            </select>
          </div>
        </div>

        {/* Tag Navigation List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Latest Created This Week Pill */}
          {sortMode === 'latest' && latestThisWeek.length > 0 && (
            <div className="p-2.5 bg-gradient-to-r from-blue-900/30 to-purple-900/30 border border-blue-500/30 rounded-xl space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-blue-400">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Latest Created (This Week)</span>
                </span>
                <span className="bg-blue-600 text-white font-mono text-[9px] px-1.5 py-0.2 rounded-full">
                  {latestThisWeek.length} NEW
                </span>
              </div>
            </div>
          )}

          {Object.entries(groupedEndpoints).map(([tag, endpoints]) => {
            const isCollapsed = collapsedTags[tag];
            return (
              <div key={tag} className="space-y-1">
                <button
                  onClick={() => setCollapsedTags((prev) => ({ ...prev, [tag]: !prev[tag] }))}
                  className="w-full flex items-center justify-between px-2 py-1 text-xs font-bold text-[var(--text-muted)] hover:text-[var(--text-main)] uppercase tracking-wider transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    {isCollapsed ? (
                      <ChevronRight className="w-3 h-3 text-[var(--text-dim)]" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-[var(--text-dim)]" />
                    )}
                    <span>{tag}</span>
                  </div>
                  <span className="font-mono text-[10px] bg-white/10 px-1.5 py-0.2 rounded-full font-normal">
                    {endpoints.length}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="space-y-0.5 pl-2 border-l border-[var(--border-color)]/60 ml-2">
                    {endpoints.map((ep) => {
                      const id = `doc-${ep.method}-${ep.path.replace(/\//g, '-')}`;
                      const isActive = activeEndpointId === id;
                      return (
                        <button
                          key={`${ep.method}-${ep.path}`}
                          onClick={() => scrollToEndpoint(id)}
                          className={`w-full text-left px-2 py-1.5 rounded-md flex items-center justify-between gap-1.5 transition-all ${
                            isActive
                              ? 'bg-[var(--border-focus)]/15 text-[var(--text-main)] font-semibold border-l-2 border-l-[var(--border-focus)]'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-card)]'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <span
                              className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${getMethodBadgeClass(
                                ep.method
                              )}`}
                            >
                              {ep.method}
                            </span>
                            <span className="font-mono text-xs truncate">
                              {ep.path}
                            </span>
                          </div>

                          {ep.createdRaw && (
                            <span className="font-mono text-[9px] text-[var(--text-dim)] shrink-0">
                              {formatApiDateShort(ep.createdRaw)}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Vertical Resizer Handle (Left/Right) */}
      <div
        onMouseDown={handleDocsSidebarMouseDown}
        className={`w-1 hover:w-1.5 cursor-col-resize transition-all duration-150 shrink-0 z-20 ${
          isDraggingDocsSidebar
            ? 'bg-[var(--border-focus)] w-1.5 shadow-sm'
            : 'bg-[var(--border-color)] hover:bg-[var(--border-focus)]'
        }`}
        title="Drag horizontally to resize sidebar"
      />

      {/* COLUMN 2 & 3: Center Reference Content + Right Sticky Code Runner */}
      <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-12">
        <div className="max-w-6xl mx-auto space-y-16">
          {/* Header Introduction Card */}
          <div className="border-b border-[var(--border-color)] pb-8 space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-extrabold text-[var(--text-main)] tracking-tight">
                {spec?.info?.title || 'API Reference & Documentation'}
              </h1>
              {spec?.info?.version && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                  v{spec.info.version}
                </span>
              )}
              {spec?.openapi && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-[var(--text-dim)] bg-[var(--bg-input)] border border-[var(--border-color)]">
                  OAS {spec.openapi}
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--text-muted)] leading-relaxed max-w-3xl">
              {spec?.info?.description ||
                'Welcome to the comprehensive API documentation. Explore endpoints, inspect schemas, and test live requests directly in the Studio.'}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-dim)] pt-2">
              {spec?.info?.contact && (
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[var(--text-muted)]">Contact:</span>
                  {spec.info.contact.email ? (
                    <a href={`mailto:${spec.info.contact.email}`} className="text-blue-400 hover:underline">
                      {spec.info.contact.name || spec.info.contact.email}
                    </a>
                  ) : spec.info.contact.url ? (
                    <a href={spec.info.contact.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                      {spec.info.contact.name || spec.info.contact.url}
                    </a>
                  ) : (
                    <span>{spec.info.contact.name}</span>
                  )}
                </div>
              )}
              {spec?.info?.license && (
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-[var(--text-muted)]">License:</span>
                  {spec.info.license.url ? (
                    <a href={spec.info.license.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                      {spec.info.license.name}
                    </a>
                  ) : (
                    <span>{spec.info.license.name}</span>
                  )}
                </div>
              )}
              {spec?.info?.termsOfService && (
                <a href={spec.info.termsOfService} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                  Terms of Service
                </a>
              )}
              {spec?.externalDocs && (
                <a href={spec.externalDocs.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
                  {spec.externalDocs.description || 'External Documentation'} ↗
                </a>
              )}
            </div>
          </div>

          {/* Endpoints Documentation Reference */}
          {Object.entries(spec?.paths || {}).map(([path, pathItem]) => (
            <div key={path} className="space-y-10">
              {(['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace'] as const).map((method) => {
                const op = (pathItem as any)[method];
                if (!op) return null;
                const rawParams = [
                  ...(pathItem.parameters || []),
                  ...(op.parameters || []),
                ];
                const seen = new Set<string>();
                const effectiveParams: any[] = [];
                for (const p of rawParams) {
                  const k = `${p.in}:${p.name}`;
                  if (!seen.has(k)) {
                    seen.add(k);
                    effectiveParams.push(p);
                  }
                }
                const effectiveOp = { ...op, parameters: effectiveParams };
                const id = `doc-${method.toUpperCase()}-${path.replace(/\//g, '-')}`;
                const snippet = generateSnippet(method, path, effectiveOp);

                const createdDate = op['x-created-at'] || op['created_at'];
                const updatedDate = op['x-updated-at'] || op['updated_at'];

                const selectedStatus =
                  activeResponseStatuses[id] ||
                  (op.responses ? Object.keys(op.responses)[0] : '200');
                const selectedRespObj = op.responses?.[selectedStatus];
                const sampleResponse = generateSampleResponse(
                  selectedRespObj?.content?.['application/json']?.schema
                );

                const reqBodyProps =
                  op.requestBody?.content?.['application/json']?.schema?.properties;
                const reqBodyRequired =
                  op.requestBody?.content?.['application/json']?.schema?.required || [];

                return (
                  <div
                    key={method}
                    id={id}
                    className="grid grid-cols-1 lg:grid-cols-12 gap-8 border-b border-[var(--border-color)] pb-12 scroll-mt-6"
                  >
                    {/* Left Details (7 columns) */}
                    <div className="lg:col-span-7 space-y-4">
                      {/* Title, Section Tag, Dates & Try in Studio Button */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`font-mono text-xs font-bold px-2 py-0.5 rounded border uppercase ${getMethodBadgeClass(
                              method
                            )}`}
                          >
                            {method.toUpperCase()}
                          </span>
                          <h2 className="text-lg font-bold text-[var(--text-main)]">
                            {op.summary || path}
                          </h2>
                          {op.tags?.[0] && (
                            <span className="text-[10px] font-semibold text-[var(--text-dim)] bg-[var(--bg-card)] px-2 py-0.5 rounded border border-[var(--border-color)]">
                              {op.tags[0]}
                            </span>
                          )}
                          {createdDate && (
                            <span
                              className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded font-mono text-[10px]"
                              title={`Created At: ${createdDate}`}
                            >
                              <Calendar className="w-2.5 h-2.5" />
                              <span>Created: {formatApiDateFull(createdDate)}</span>
                            </span>
                          )}
                          {updatedDate && (
                            <span
                              className="flex items-center gap-1 px-2 py-0.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded font-mono text-[10px]"
                              title={`Updated At: ${updatedDate}`}
                            >
                              <Clock className="w-2.5 h-2.5" />
                              <span>Updated: {formatApiDateFull(updatedDate)}</span>
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => openEndpointInTab(method.toUpperCase(), path, true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 rounded-lg text-xs font-semibold transition-all shadow-xs shrink-0"
                          title="Open in Interactive API Studio"
                        >
                          <Zap className="w-3.5 h-3.5 text-amber-400" />
                          <span>Try in Studio</span>
                        </button>
                      </div>

                      {/* Path Box with highlighted params */}
                      <div className="p-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg font-mono text-xs font-semibold text-[var(--text-main)] flex items-center justify-between">
                        <div>
                          {path.split('/').map((seg, idx) => (
                            <span key={idx}>
                              {idx > 0 && '/'}
                              {seg.startsWith('{') && seg.endsWith('}') ? (
                                <span className="text-amber-400 bg-amber-500/15 px-1 py-0.5 rounded border border-amber-500/30 font-bold">
                                  {seg}
                                </span>
                              ) : (
                                seg
                              )}
                            </span>
                          ))}
                        </div>
                        {op.security?.length ? (
                          <div className="flex items-center gap-1 text-[11px] text-[var(--text-dim)]">
                            <Lock className="w-3 h-3 text-amber-400" />
                            <span>Authenticated</span>
                          </div>
                        ) : null}
                      </div>

                      {/* Markdown / Plain Description */}
                      {op.description && (
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed bg-[var(--bg-card)]/40 p-3 rounded-lg border-l-2 border-[var(--border-focus)]">
                          {op.description}
                        </p>
                      )}

                      {/* Parameters Table */}
                      {op.parameters && op.parameters.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                            Parameters
                          </h3>
                          <div className="border border-[var(--border-color)] rounded-lg overflow-hidden">
                            <table className="w-full text-xs font-mono border-collapse">
                              <thead className="bg-[var(--bg-input)] border-b border-[var(--border-color)]">
                                <tr className="text-left text-[var(--text-dim)] uppercase text-[10px]">
                                  <th className="p-2">Name</th>
                                  <th className="p-2">In</th>
                                  <th className="p-2">Type</th>
                                  <th className="p-2">Description</th>
                                </tr>
                              </thead>
                              <tbody>
                                {op.parameters.map((p: any) => (
                                  <tr key={p.name} className="border-b border-[var(--border-color)]/40">
                                    <td className="p-2 font-bold text-blue-400">
                                      {p.name} {p.required && <span className="text-red-400">*</span>}
                                    </td>
                                    <td className="p-2 text-[var(--text-dim)]">{p.in}</td>
                                    <td className="p-2 text-emerald-400">{p.schema?.type || 'string'}</td>
                                    <td className="p-2 text-[var(--text-muted)] font-sans">{p.description || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Request Body Schema Table */}
                      {reqBodyProps && (
                        <div className="space-y-2 pt-2">
                          <h3 className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                            Request Body Schema
                          </h3>
                          <div className="border border-[var(--border-color)] rounded-lg overflow-hidden">
                            <table className="w-full text-xs font-mono border-collapse">
                              <thead className="bg-[var(--bg-input)] border-b border-[var(--border-color)]">
                                <tr className="text-left text-[var(--text-dim)] uppercase text-[10px]">
                                  <th className="p-2">Field</th>
                                  <th className="p-2">Type</th>
                                  <th className="p-2">Description & Allowed Values</th>
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(reqBodyProps).map(([key, prop]: [string, any]) => {
                                  const isReq = reqBodyRequired.includes(key);
                                  return (
                                    <tr key={key} className="border-b border-[var(--border-color)]/40">
                                      <td className="p-2">
                                        <div className="font-bold text-blue-400">{key}</div>
                                        <span
                                          className={`text-[9px] px-1 py-0.2 rounded font-sans uppercase font-bold ${
                                            isReq
                                              ? 'bg-red-500/15 text-red-400'
                                              : 'bg-white/5 text-[var(--text-dim)]'
                                          }`}
                                        >
                                          {isReq ? 'Required' : 'Optional'}
                                        </span>
                                      </td>
                                      <td className="p-2 text-emerald-400">
                                        {prop.type || 'object'}
                                        {prop.format && (
                                          <span className="text-purple-400 text-[10px] ml-1">
                                            ({prop.format})
                                          </span>
                                        )}
                                      </td>
                                      <td className="p-2 text-[var(--text-muted)] font-sans space-y-1">
                                        <div>{prop.description || '-'}</div>
                                        {prop.enum && (
                                          <div className="flex flex-wrap gap-1 mt-1">
                                            <span className="text-[10px] text-[var(--text-dim)]">
                                              Allowed:
                                            </span>
                                            {prop.enum.map((e: any) => (
                                              <span
                                                key={e}
                                                className="font-mono text-[10px] bg-[var(--bg-card)] border border-[var(--border-color)] px-1 py-0.2 rounded text-amber-400"
                                              >
                                                {String(e)}
                                              </span>
                                            ))}
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right Code Runner & Response Preview (5 columns) */}
                    <div className="lg:col-span-5 space-y-4">
                      <div className="sticky top-6 space-y-4">
                        {/* 1. Request Code Block */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg p-1">
                            <div className="flex gap-0.5">
                              {(['curl', 'js', 'python', 'go'] as const).map((lang) => (
                                <button
                                  key={lang}
                                  onClick={() => setSelectedLanguage(lang)}
                                  className={`px-2 py-1 text-xs font-semibold rounded uppercase transition-all ${
                                    selectedLanguage === lang
                                      ? 'bg-[var(--bg-card)] text-[var(--border-focus)] shadow-xs'
                                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                                  }`}
                                >
                                  {lang}
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={() => copyCode(snippet, id)}
                              className="p-1 hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] rounded transition-colors"
                              title="Copy Code"
                            >
                              {copiedId === id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          <pre className="p-4 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg font-mono text-xs text-emerald-400 overflow-x-auto select-text leading-relaxed shadow-sm">
                            {snippet}
                          </pre>
                        </div>

                        {/* 2. Response Inspector Tabs & Example Preview */}
                        {op.responses && (
                          <div className="space-y-2">
                            <div className="text-xs font-bold text-[var(--text-main)] uppercase tracking-wider">
                              Response Preview
                            </div>

                            {/* Status Tabs */}
                            <div className="flex flex-wrap gap-1">
                              {Object.keys(op.responses).map((status) => {
                                const isSelected = selectedStatus === status;
                                return (
                                  <button
                                    key={status}
                                    onClick={() =>
                                      setActiveResponseStatuses((prev) => ({
                                        ...prev,
                                        [id]: status,
                                      }))
                                    }
                                    className={`px-2.5 py-1 text-xs font-mono font-bold rounded-lg border transition-all ${
                                      isSelected
                                        ? status.startsWith('2')
                                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-xs'
                                          : status.startsWith('4')
                                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-xs'
                                          : 'bg-red-500/20 text-red-400 border-red-500/40 shadow-xs'
                                        : 'bg-[var(--bg-card)] text-[var(--text-muted)] border-[var(--border-color)] hover:text-[var(--text-main)]'
                                    }`}
                                  >
                                    {status}{' '}
                                    {status === '200' ? 'OK' : status === '201' ? 'Created' : ''}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Response JSON Example Preview */}
                            <div className="relative group">
                              <pre className="p-3 bg-[var(--bg-input)] border border-[var(--border-color)] rounded-lg font-mono text-[11px] text-[var(--text-main)] overflow-x-auto max-h-56 select-text leading-relaxed">
                                {JSON.stringify(sampleResponse, null, 2)}
                              </pre>
                              <button
                                onClick={() =>
                                  copyCode(
                                    JSON.stringify(sampleResponse, null, 2),
                                    `${id}-resp`
                                  )
                                }
                                className="opacity-0 group-hover:opacity-100 absolute top-2 right-2 p-1 bg-[var(--bg-card)] border border-[var(--border-color)] rounded text-[var(--text-muted)] hover:text-white transition-opacity"
                                title="Copy Response Example"
                              >
                                {copiedId === `${id}-resp` ? (
                                  <Check className="w-3 h-3 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
