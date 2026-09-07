import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useStudioStore } from '../store/useStudioStore';
import * as yaml from 'js-yaml';
import {
  Play,
  Download,
  Upload,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Workflow,
  Search,
  Save,
  ChevronDown,
  ChevronRight,
  Code,
  ArrowRight,
  GripHorizontal,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Crosshair,
} from 'lucide-react';
import type { WorkflowNode, WorkflowConnection, WorkflowSpec } from '../types/workflow';

const DEFAULT_WORKFLOW: WorkflowSpec = {
  name: 'Client Onboarding & Payment Pipeline',
  version: '1.0',
  description: 'Automated end-to-end client registration, auth verification, and report pipeline',
  nodes: [
    {
      id: 'node_trigger',
      type: 'trigger',
      title: 'Manual Workflow Trigger',
      x: 320,
      y: 440,
      config: {},
      status: 'idle',
    },
    {
      id: 'node_login',
      type: 'api',
      title: '1. Authenticate & Get Bearer Token',
      x: 720,
      y: 400,
      config: {
        method: 'POST',
        path: '/v1/auth/login',
        bodyJson: '{\n  "email": "admin@magicapi.dev",\n  "password": "secret_password"\n}',
        extractKey: 'token',
        extractPath: 'data.token',
      },
      status: 'idle',
    },
    {
      id: 'node_create_client',
      type: 'api',
      title: '2. Create Merchant Client',
      x: 1120,
      y: 400,
      config: {
        method: 'POST',
        path: '/admin/clients/create',
        bodyJson: '{\n  "name": "Acme Corp",\n  "service_type": "PAYIN",\n  "email": "{{$randomEmail}}"\n}',
        extractKey: 'client_id',
        extractPath: 'data.client_id',
      },
      status: 'idle',
    },
    {
      id: 'node_fetch_client',
      type: 'api',
      title: '3. Verify & Fetch Client Details',
      x: 1520,
      y: 400,
      config: {
        method: 'GET',
        path: '/admin/clients/{{client_id}}',
      },
      status: 'idle',
    },
  ],
  connections: [
    { id: 'c1', sourceNodeId: 'node_trigger', targetNodeId: 'node_login' },
    { id: 'c2', sourceNodeId: 'node_login', targetNodeId: 'node_create_client' },
    { id: 'c3', sourceNodeId: 'node_create_client', targetNodeId: 'node_fetch_client' },
  ],
};

export const VisualWorkflowStudio: React.FC = () => {
  const { spec, setVariable, interpolate, environment } = useStudioStore();

  const [workflow, setWorkflow] = useState<WorkflowSpec>(() => {
    try {
      const saved = localStorage.getItem('openapi_saved_workflow_spec');
      if (saved) {
        const parsed = JSON.parse(saved);
        // If old top-left coordinates are detected (x < 100), adjust to center
        if (parsed?.nodes?.[0]?.x < 100) {
          parsed.nodes = parsed.nodes.map((n: WorkflowNode) => ({
            ...n,
            x: n.x + 260,
            y: n.y + 260,
          }));
        }
        return parsed;
      }
    } catch {}
    return DEFAULT_WORKFLOW;
  });

  const [isRunning, setIsRunning] = useState(false);
  const [activeRunningNodeId, setActiveRunningNodeId] = useState<string | null>(null);
  const [totalExecutionTime, setTotalExecutionTime] = useState<number | null>(null);
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
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedPayloadNodeId, setExpandedPayloadNodeId] = useState<string | null>(null);
  const [isSavedToast, setIsSavedToast] = useState(false);

  // Zoom Level State (Default 1.0, range: 0.3x to 2.0x)
  const [zoom, setZoom] = useState<number>(1);

  // Canvas Panning State
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [scrollStart, setScrollStart] = useState<{ left: number; top: number }>({ left: 0, top: 0 });

  // Interactive Port Connecting State
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Sidebar resizer width
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('openapi_workflow_sidebar_width');
      return saved ? Math.max(220, Math.min(Number(saved), 550)) : 300;
    } catch {
      return 300;
    }
  });
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);

  // Dragging state for nodes
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-center workflow nodes in playground viewport
  const autoCenterWorkflow = useCallback(
    (targetNodes = workflow.nodes, currentZoom = zoom) => {
      if (!canvasContainerRef.current || targetNodes.length === 0) return;
      const container = canvasContainerRef.current;

      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;

      targetNodes.forEach((n) => {
        if (n.x < minX) minX = n.x;
        if (n.x + 300 > maxX) maxX = n.x + 300;
        if (n.y < minY) minY = n.y;
        if (n.y + 180 > maxY) maxY = n.y + 180;
      });

      const graphCenterX = (minX + maxX) / 2;
      const graphCenterY = (minY + maxY) / 2;

      const viewWidth = container.clientWidth;
      const viewHeight = container.clientHeight;

      const targetScrollLeft = Math.max(0, graphCenterX * currentZoom - viewWidth / 2);
      const targetScrollTop = Math.max(0, graphCenterY * currentZoom - viewHeight / 2);

      container.scrollTo({
        left: targetScrollLeft,
        top: targetScrollTop,
        behavior: 'smooth',
      });
    },
    [workflow.nodes, zoom]
  );

  // Center on initial mount
  useEffect(() => {
    const timer = setTimeout(() => {
      autoCenterWorkflow();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Wheel Zoom Listener attached directly with non-passive flag
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      setZoom((prevZoom) => {
        const next = Math.max(0.3, Math.min(2.0, Number((prevZoom * zoomFactor).toFixed(2))));
        return next;
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Sidebar drag resizer effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingSidebar) {
        const newWidth = Math.max(220, Math.min(e.clientX, 550));
        setSidebarWidth(newWidth);
        localStorage.setItem('openapi_workflow_sidebar_width', String(newWidth));
      }
    };
    const handleMouseUp = () => {
      if (isDraggingSidebar) {
        setIsDraggingSidebar(false);
        document.body.style.cursor = '';
      }
    };
    if (isDraggingSidebar) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSidebar]);

  // Global Node Dragging & Canvas Panning Effect
  useEffect(() => {
    if (!draggingNodeId && !isPanning) return;

    const handleWindowMouseMove = (e: MouseEvent) => {
      if (!canvasContainerRef.current) return;

      // Handle Canvas Panning (Click and hold anywhere on playground background)
      if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        canvasContainerRef.current.scrollLeft = scrollStart.left - dx;
        canvasContainerRef.current.scrollTop = scrollStart.top - dy;
        return;
      }

      // Handle Node Dragging
      if (draggingNodeId) {
        const rect = canvasContainerRef.current.getBoundingClientRect();
        const scrollLeft = canvasContainerRef.current.scrollLeft;
        const scrollTop = canvasContainerRef.current.scrollTop;

        const rawX = (e.clientX - rect.left + scrollLeft) / zoom;
        const rawY = (e.clientY - rect.top + scrollTop) / zoom;

        const newX = Math.max(20, Math.round(rawX - dragOffset.x));
        const newY = Math.max(20, Math.round(rawY - dragOffset.y));

        setWorkflow((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) => (n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n)),
        }));
      }
    };

    const handleWindowMouseUp = () => {
      setDraggingNodeId(null);
      setIsPanning(false);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [draggingNodeId, isPanning, dragOffset, zoom, panStart, scrollStart]);

  // Track cursor for connecting wire drawing scaled by zoom
  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (connectingSourceId && canvasContainerRef.current) {
      const rect = canvasContainerRef.current.getBoundingClientRect();
      const scrollLeft = canvasContainerRef.current.scrollLeft;
      const scrollTop = canvasContainerRef.current.scrollTop;
      setMousePos({
        x: (e.clientX - rect.left + scrollLeft) / zoom,
        y: (e.clientY - rect.top + scrollTop) / zoom,
      });
    }
  };

  // Canvas Mouse Down Handler for Canvas Background Panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (
      (e.target as HTMLElement).closest('.workflow-node-card') ||
      (e.target as HTMLElement).tagName === 'BUTTON' ||
      (e.target as HTMLElement).tagName === 'INPUT' ||
      (e.target as HTMLElement).tagName === 'TEXTAREA'
    ) {
      return;
    }
    if (!canvasContainerRef.current) return;

    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
    setScrollStart({
      left: canvasContainerRef.current.scrollLeft,
      top: canvasContainerRef.current.scrollTop,
    });
  };

  // Save to local storage on change
  const handleSaveWorkflow = () => {
    localStorage.setItem('openapi_saved_workflow_spec', JSON.stringify(workflow));
    setIsSavedToast(true);
    setTimeout(() => setIsSavedToast(false), 2000);
  };

  // Export as YAML file
  const handleExportYaml = () => {
    const yamlString = yaml.dump(workflow);
    const blob = new Blob([yamlString], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflow.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_workflow.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Import from YAML file
  const handleImportYaml = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = yaml.load(event.target?.result as string) as WorkflowSpec;
        if (parsed && Array.isArray(parsed.nodes)) {
          setWorkflow(parsed);
          localStorage.setItem('openapi_saved_workflow_spec', JSON.stringify(parsed));
          setTimeout(() => autoCenterWorkflow(parsed.nodes), 100);
          alert(`Successfully imported workflow: "${parsed.name || 'Custom Workflow'}"`);
        } else {
          alert('Invalid workflow YAML format.');
        }
      } catch (err) {
        alert('Failed to parse YAML file: ' + String(err));
      }
    };
    reader.readAsText(file);
  };

  // Node Drag Initiator scaled by zoom
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (
      (e.target as HTMLElement).tagName === 'INPUT' ||
      (e.target as HTMLElement).tagName === 'BUTTON' ||
      (e.target as HTMLElement).tagName === 'TEXTAREA'
    ) {
      return;
    }
    const node = workflow.nodes.find((n) => n.id === nodeId);
    if (!node || !canvasContainerRef.current) return;

    const rect = canvasContainerRef.current.getBoundingClientRect();
    const scrollLeft = canvasContainerRef.current.scrollLeft;
    const scrollTop = canvasContainerRef.current.scrollTop;

    const clickX = (e.clientX - rect.left + scrollLeft) / zoom;
    const clickY = (e.clientY - rect.top + scrollTop) / zoom;

    setDraggingNodeId(nodeId);
    setSelectedNodeId(nodeId);
    setDragOffset({
      x: clickX - node.x,
      y: clickY - node.y,
    });
  };

  // Port Linking Handlers
  const handleStartConnecting = (e: React.MouseEvent, sourceNodeId: string) => {
    e.stopPropagation();
    setConnectingSourceId(sourceNodeId);
  };

  const handleCompleteConnecting = (e: React.MouseEvent, targetNodeId: string) => {
    e.stopPropagation();
    if (!connectingSourceId || connectingSourceId === targetNodeId) {
      setConnectingSourceId(null);
      return;
    }

    const exists = workflow.connections.some(
      (c) => c.sourceNodeId === connectingSourceId && c.targetNodeId === targetNodeId
    );

    if (!exists) {
      const newConn: WorkflowConnection = {
        id: `c_${Date.now()}`,
        sourceNodeId: connectingSourceId,
        targetNodeId,
      };
      setWorkflow((prev) => ({
        ...prev,
        connections: [...prev.connections, newConn],
      }));
    }
    setConnectingSourceId(null);
  };

  const handleDeleteConnection = (connId: string) => {
    setWorkflow((prev) => ({
      ...prev,
      connections: prev.connections.filter((c) => c.id !== connId),
    }));
  };

  // Add new API Node from OpenAPI spec
  const handleAddApiNode = (method: string, path: string) => {
    const id = `node_${Date.now()}`;
    const op = spec?.paths?.[path]?.[method.toLowerCase() as any];
    const lastNode = workflow.nodes[workflow.nodes.length - 1];
    const nextX = lastNode ? lastNode.x + 380 : 320;
    const nextY = lastNode ? lastNode.y : 400;

    let initialBodyJson: string | undefined = undefined;
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      const schemaEx = op?.requestBody?.content?.['application/json']?.example;
      initialBodyJson = schemaEx ? JSON.stringify(schemaEx, null, 2) : '{\n  \n}';
    }

    const newNode: WorkflowNode = {
      id,
      type: 'api',
      title: op?.summary || `${method} ${path}`,
      x: nextX,
      y: nextY,
      config: {
        method,
        path,
        bodyJson: initialBodyJson,
      },
      status: 'idle',
    };

    const newConn: WorkflowConnection[] = lastNode
      ? [...workflow.connections, { id: `c_${Date.now()}`, sourceNodeId: lastNode.id, targetNodeId: id }]
      : workflow.connections;

    setWorkflow((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
      connections: newConn,
    }));
  };

  // Delete node & connected edges
  const handleDeleteNode = (nodeId: string) => {
    setWorkflow((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      connections: prev.connections.filter((c) => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId),
    }));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  // Update node config
  const updateNodeConfig = (nodeId: string, patch: Partial<WorkflowNode['config']>) => {
    setWorkflow((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === nodeId ? { ...n, config: { ...n.config, ...patch } } : n
      ),
    }));
  };

  // Execute the entire graph sequentially with proper environment resolution
  const handleExecuteWorkflow = async () => {
    setIsRunning(true);
    setTotalExecutionTime(null);
    const startTime = performance.now();

    setWorkflow((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) => ({ ...n, status: 'idle', executionResult: undefined })),
    }));

    const triggerNode = workflow.nodes.find((n) => n.type === 'trigger') || workflow.nodes[0];
    if (!triggerNode) {
      setIsRunning(false);
      return;
    }

    let currentNodeId: string | null = triggerNode.id;
    const visited = new Set<string>();
    const baseEnv = (environment || 'http://localhost:8000/v1').replace(/\/+$/, '');

    while (currentNodeId && !visited.has(currentNodeId)) {
      visited.add(currentNodeId);
      const node = workflow.nodes.find((n) => n.id === currentNodeId);
      if (!node) break;

      setActiveRunningNodeId(node.id);
      setWorkflow((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === node.id ? { ...n, status: 'running' } : n)),
      }));

      const nodeStart = performance.now();

      if (node.type === 'trigger') {
        await new Promise((r) => setTimeout(r, 200));
        setWorkflow((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === node.id ? { ...n, status: 'success', executionResult: { durationMs: 10 } } : n
          ),
        }));
      } else if (node.type === 'api') {
        try {
          const rawPath = node.config.path || '';
          let targetUrl = rawPath.startsWith('http')
            ? rawPath
            : `${baseEnv}${rawPath.startsWith('/') ? '' : '/'}${rawPath}`;
          targetUrl = interpolate(targetUrl);

          const headers: Record<string, string> = {
            'Content-Type': 'application/json',
          };
          const currentToken = useStudioStore.getState().variables.token;
          if (currentToken) {
            headers['Authorization'] = `Bearer ${currentToken}`;
          }

          let body: string | undefined = undefined;
          if (['POST', 'PUT', 'PATCH'].includes(node.config.method || '') && node.config.bodyJson) {
            body = interpolate(node.config.bodyJson);
          }

          const res = await fetch(targetUrl, {
            method: node.config.method || 'GET',
            headers,
            body,
          });

          const dur = Math.round(performance.now() - nodeStart);
          const data = await res.json().catch(() => ({}));

          let extractedVal: any = undefined;
          if (node.config.extractKey && node.config.extractPath) {
            const parts = node.config.extractPath.split('.');
            let val: any = data;
            for (const p of parts) {
              if (val && typeof val === 'object') {
                val = val[p];
              } else {
                val = undefined;
                break;
              }
            }
            if (val !== undefined) {
              extractedVal = val;
              setVariable(node.config.extractKey, String(val));
            }
          }

          setWorkflow((prev) => ({
            ...prev,
            nodes: prev.nodes.map((n) =>
              n.id === node.id
                ? {
                    ...n,
                    status: res.ok ? 'success' : 'error',
                    executionResult: {
                      statusCode: res.status,
                      durationMs: dur,
                      responseBody: data,
                      extractedValue: extractedVal,
                      error: res.ok ? undefined : `HTTP ${res.status}`,
                    },
                  }
                : n
            ),
          }));

          if (!res.ok) {
            break;
          }
        } catch (err: any) {
          const dur = Math.round(performance.now() - nodeStart);
          setWorkflow((prev) => ({
            ...prev,
            nodes: prev.nodes.map((n) =>
              n.id === node.id
                ? {
                    ...n,
                    status: 'error',
                    executionResult: {
                      durationMs: dur,
                      error: err?.message || 'Network request failed',
                    },
                  }
                : n
            ),
          }));
          break;
        }
      }

      const nextConn = workflow.connections.find((c) => c.sourceNodeId === currentNodeId);
      currentNodeId = nextConn ? nextConn.targetNodeId : null;
      await new Promise((r) => setTimeout(r, 150));
    }

    setActiveRunningNodeId(null);
    setTotalExecutionTime(Math.round(performance.now() - startTime));
    setIsRunning(false);
  };

  // Helper date parser
  const parseApiDate = (dateStr?: string): number => {
    if (!dateStr) return 0;
    const parsed = Date.parse(dateStr);
    return isNaN(parsed) ? 0 : parsed;
  };

  const format12HourTime = (dateStr?: string): string => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return '';
      const datePart = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const timePart = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return `${datePart}, ${timePart}`;
    } catch {
      return '';
    }
  };

  // Grouped endpoints for sidebar
  const { groups, last7DaysEndpoints } = (() => {
    const grps: Record<string, Array<any>> = {};
    const allList: Array<any> = [];

    if (spec?.paths) {
      for (const [path, pathItem] of Object.entries(spec.paths)) {
        for (const method of ['get', 'post', 'put', 'delete', 'patch'] as const) {
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
            if (!grps[tag]) grps[tag] = [];
            grps[tag].push(item);
          });
        }
      }
    }

    for (const tag in grps) {
      if (sortOption === 'alpha') {
        grps[tag].sort((a, b) => a.path.localeCompare(b.path));
      } else if (sortOption === 'latest') {
        grps[tag].sort((a, b) => b.createdAt - a.createdAt);
      } else if (sortOption === 'updated') {
        grps[tag].sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt));
      }
    }

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    let recent7 = allList.filter((item) => {
      const recentTimestamp = Math.max(item.updatedAt, item.createdAt);
      return recentTimestamp >= sevenDaysAgo;
    });

    if (recent7.length === 0) {
      recent7 = [...allList]
        .filter((item) => item.createdAt > 0 || item.updatedAt > 0)
        .sort((a, b) => Math.max(b.updatedAt, b.createdAt) - Math.max(a.updatedAt, a.createdAt))
        .slice(0, 8);
    } else {
      recent7.sort((a, b) => Math.max(b.updatedAt, b.createdAt) - Math.max(a.updatedAt, a.createdAt));
    }

    return { groups: grps, last7DaysEndpoints: recent7 };
  })();

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
      Object.keys(groups).some((t) => !collapsedTags[t]) ||
      (last7DaysEndpoints.length > 0 && !isRecent7DaysCollapsed);
    const shouldCollapse = isAnyExpanded;

    const nextState: Record<string, boolean> = {};
    Object.keys(groups).forEach((t) => {
      nextState[t] = shouldCollapse;
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
        return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
      case 'POST':
        return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
      case 'PUT':
        return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
      case 'DELETE':
        return 'text-red-400 border-red-500/30 bg-red-500/10';
      default:
        return 'text-purple-400 border-purple-500/30 bg-purple-500/10';
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-[var(--bg-app)] overflow-hidden select-none">
      {/* 1. TOP TOOLBAR */}
      <div className="h-12 px-4 bg-[var(--bg-sidebar)] border-b border-[var(--border-color)] flex items-center justify-between gap-4 shrink-0 z-30">
        {/* Left Workflow Name & Status */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white shadow-md shadow-purple-500/20">
            <Workflow className="w-4 h-4" />
          </div>
          <div>
            <input
              type="text"
              value={workflow.name}
              onChange={(e) => setWorkflow((prev) => ({ ...prev, name: e.target.value }))}
              className="font-bold text-xs bg-transparent text-[var(--text-main)] outline-none border-b border-transparent hover:border-[var(--border-color)] focus:border-[var(--border-focus)] px-1 py-0.5"
            />
            <div className="text-[10px] text-[var(--text-dim)] px-1 font-mono">
              {workflow.nodes.length} nodes · {workflow.connections.length} connections · Zoom: {Math.round(zoom * 100)}%
            </div>
          </div>
        </div>

        {/* Center Execution Metrics */}
        {totalExecutionTime !== null && (
          <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full text-xs font-mono text-emerald-400 animate-fade-in">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Workflow Completed in {totalExecutionTime}ms</span>
          </div>
        )}

        {/* Right Actions */}
        <div className="flex items-center gap-2">
          {/* Preset templates */}
          <button
            onClick={() => {
              setWorkflow(DEFAULT_WORKFLOW);
              setTimeout(() => autoCenterWorkflow(DEFAULT_WORKFLOW.nodes), 50);
            }}
            className="px-2.5 py-1.5 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Load Default Pipeline Template"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Template</span>
          </button>

          {/* Import YAML */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportYaml}
            accept=".yaml,.yml"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1.5 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Import Workflow YAML file"
          >
            <Upload className="w-3.5 h-3.5 text-blue-400" />
            <span>Import YAML</span>
          </button>

          {/* Export YAML */}
          <button
            onClick={handleExportYaml}
            className="px-2.5 py-1.5 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Export and Download Workflow YAML file"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Export YAML</span>
          </button>

          {/* Save to Local */}
          <button
            onClick={handleSaveWorkflow}
            className="px-3 py-1.5 bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-color)] rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-main)] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Save workflow to local storage"
          >
            <Save className="w-3.5 h-3.5 text-purple-400" />
            <span>{isSavedToast ? 'Saved!' : 'Save'}</span>
          </button>

          {/* Execute Workflow */}
          <button
            onClick={handleExecuteWorkflow}
            disabled={isRunning}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold text-white flex items-center gap-2 shadow-md transition-all ${
              isRunning
                ? 'bg-blue-600/50 cursor-wait'
                : 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:via-indigo-500 hover:to-purple-500 cursor-pointer active:scale-98'
            }`}
          >
            {isRunning ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            <span>{isRunning ? 'Running Pipeline...' : 'Execute Workflow'}</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE: Studio Sidebar + Zoomable & Pannable Canvas */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* LEFT FULL STUDIO SIDEBAR */}
        <div
          style={{ width: `${sidebarWidth}px` }}
          className="bg-[var(--bg-sidebar)] border-r border-[var(--border-color)] flex flex-col shrink-0 z-20 overflow-hidden"
        >
          {/* Search & Sort Tool Strip */}
          <div className="p-2.5 border-b border-[var(--border-color)] space-y-2 bg-[var(--bg-sidebar)]">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-[var(--text-dim)]" />
              <input
                type="text"
                placeholder="Filter endpoints to add..."
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
                className="px-2 py-1 bg-[var(--bg-card)] border border-[var(--border-color)] hover:bg-[var(--bg-card-hover)] rounded text-[11px] text-[var(--text-muted)] hover:text-[var(--text-main)] font-semibold transition-colors cursor-pointer"
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
                      const hasUpdated = ep.updatedRaw && ep.updatedRaw !== ep.createdRaw;
                      const dateToDisplay = hasUpdated ? ep.updatedRaw : ep.createdRaw;

                      return (
                        <button
                          key={`workflow-recent-${ep.method}-${ep.path}`}
                          onClick={() => handleAddApiNode(ep.method, ep.path)}
                          className="w-full text-left px-2 py-1.5 rounded-md flex items-center justify-between gap-1.5 hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all group cursor-pointer"
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

                          {dateToDisplay && (
                            <span
                              className="font-mono text-[10px] text-[var(--text-dim)] shrink-0 group-hover:hidden"
                              title={`${hasUpdated ? 'Updated' : 'Created'}: ${dateToDisplay}`}
                            >
                              {format12HourTime(dateToDisplay)}
                            </span>
                          )}

                          <Plus className="w-3.5 h-3.5 text-blue-400 hidden group-hover:block shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* TAG CATEGORY ACCORDIONS */}
            {Object.entries(groups).map(([tag, endpoints]) => {
              const isCollapsed = collapsedTags[tag] || false;

              return (
                <div key={tag} className="border border-[var(--border-color)]/60 rounded-lg overflow-hidden bg-[var(--bg-card)]/30">
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

                  {!isCollapsed && (
                    <div className="p-1 space-y-0.5">
                      {endpoints.map((ep) => {
                        const hasUpdated = ep.updatedRaw && ep.updatedRaw !== ep.createdRaw;
                        const dateToDisplay = hasUpdated ? ep.updatedRaw : ep.createdRaw;

                        return (
                          <button
                            key={`workflow-tag-${ep.method}-${ep.path}`}
                            onClick={() => handleAddApiNode(ep.method, ep.path)}
                            className="w-full text-left px-2 py-1.5 rounded-md flex items-center justify-between gap-1.5 hover:bg-[var(--bg-card-hover)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-all group cursor-pointer"
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

                            {dateToDisplay && (
                              <span
                                className="font-mono text-[10px] text-[var(--text-dim)] shrink-0 group-hover:hidden"
                                title={`${hasUpdated ? 'Updated' : 'Created'}: ${dateToDisplay}`}
                              >
                                {format12HourTime(dateToDisplay)}
                              </span>
                            )}

                            <Plus className="w-3.5 h-3.5 text-blue-400 hidden group-hover:block shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Vertical Resizer Handle between Sidebar & Canvas */}
        <div
          onMouseDown={(e) => {
            e.preventDefault();
            setIsDraggingSidebar(true);
            document.body.style.cursor = 'col-resize';
          }}
          className={`w-1 hover:w-1.5 cursor-col-resize transition-all duration-150 shrink-0 z-20 ${
            isDraggingSidebar
              ? 'bg-[var(--border-focus)] w-1.5 shadow-sm'
              : 'bg-[var(--border-color)] hover:bg-[var(--border-focus)]'
          }`}
          title="Drag to resize sidebar"
        />

        {/* SCROLLABLE INFINITE WORKSPACE CANVAS */}
        <div
          ref={canvasContainerRef}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          className={`flex-1 relative overflow-auto bg-[radial-gradient(#ffffff15_1px,transparent_1px)] [background-size:16px_16px] select-none ${
            isPanning ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          {/* Zoomable Canvas Wrapper */}
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: '0 0',
            }}
            className="min-w-[3200px] min-h-[2200px] relative transition-transform duration-75"
          >
            {/* SVG Connection Layer */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
              <defs>
                <linearGradient id="conn-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
                <linearGradient id="conn-success" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10b981" />
                  <stop offset="100%" stopColor="#059669" />
                </linearGradient>
              </defs>

              {/* Existing Connections */}
              {workflow.connections.map((conn) => {
                const srcNode = workflow.nodes.find((n) => n.id === conn.sourceNodeId);
                const tgtNode = workflow.nodes.find((n) => n.id === conn.targetNodeId);
                if (!srcNode || !tgtNode) return null;

                const startX = srcNode.x + 300;
                const startY = srcNode.y + 19;

                const endX = tgtNode.x;
                const endY = tgtNode.y + 19;

                const deltaX = Math.max(Math.abs(endX - startX) * 0.5, 40);
                const pathD = `M ${startX} ${startY} C ${startX + deltaX} ${startY}, ${endX - deltaX} ${endY}, ${endX} ${endY}`;

                const isConnectedRunning = activeRunningNodeId === srcNode.id || activeRunningNodeId === tgtNode.id;
                const isSuccess = srcNode.status === 'success' && tgtNode.status === 'success';

                return (
                  <g key={conn.id} className="cursor-pointer group pointer-events-auto">
                    <path
                      d={pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="16"
                      onClick={() => handleDeleteConnection(conn.id)}
                    />
                    <path
                      d={pathD}
                      fill="none"
                      stroke="rgba(0,0,0,0.5)"
                      strokeWidth="5"
                    />
                    <path
                      d={pathD}
                      fill="none"
                      stroke={isSuccess ? 'url(#conn-success)' : 'url(#conn-gradient)'}
                      strokeWidth="2.5"
                      strokeDasharray={isConnectedRunning ? '6,4' : undefined}
                      className={isConnectedRunning ? 'animate-pulse' : 'group-hover:stroke-red-400 transition-colors'}
                      onClick={() => handleDeleteConnection(conn.id)}
                    />
                  </g>
                );
              })}

              {/* Dynamic Interactive Wire when dragging between ports */}
              {connectingSourceId && (() => {
                const srcNode = workflow.nodes.find((n) => n.id === connectingSourceId);
                if (!srcNode) return null;
                const startX = srcNode.x + 300;
                const startY = srcNode.y + 19;
                const endX = mousePos.x;
                const endY = mousePos.y;
                const deltaX = Math.max(Math.abs(endX - startX) * 0.5, 40);
                const pathD = `M ${startX} ${startY} C ${startX + deltaX} ${startY}, ${endX - deltaX} ${endY}, ${endX} ${endY}`;

                return (
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#a855f7"
                    strokeWidth="3"
                    strokeDasharray="6,4"
                    className="animate-pulse"
                  />
                );
              })()}
            </svg>

            {/* DRAGGABLE NODE CARDS */}
            {workflow.nodes.map((node) => {
              const isSelected = selectedNodeId === node.id;
              const isRunningThis = activeRunningNodeId === node.id;
              const isPayloadExpanded = expandedPayloadNodeId === node.id;

              return (
                <div
                  key={node.id}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                  style={{
                    transform: `translate3d(${node.x}px, ${node.y}px, 0)`,
                    width: '300px',
                  }}
                  className={`workflow-node-card absolute rounded-xl border backdrop-blur-md shadow-xl transition-shadow duration-150 select-none z-20 cursor-move ${
                    isRunningThis
                      ? 'border-blue-400 bg-[var(--bg-card)] shadow-blue-500/20 shadow-2xl ring-2 ring-blue-500/50'
                      : node.status === 'success'
                      ? 'border-emerald-500/50 bg-[var(--bg-card)]'
                      : node.status === 'error'
                      ? 'border-red-500/50 bg-[var(--bg-card)]'
                      : isSelected
                      ? 'border-[var(--border-focus)] bg-[var(--bg-card)] ring-1 ring-[var(--border-focus)]'
                      : 'border-[var(--border-color)] bg-[var(--bg-sidebar)]/95 hover:border-[var(--border-focus)]/50'
                  }`}
                >
                  {/* Node Input Port (Left) */}
                  {node.type !== 'trigger' && (
                    <div
                      onClick={(e) => handleCompleteConnecting(e, node.id)}
                      className={`w-4 h-4 rounded-full border-2 border-[var(--bg-app)] absolute -left-2 top-[11px] shadow-xs cursor-pointer hover:scale-125 transition-transform z-30 ${
                        connectingSourceId ? 'bg-amber-400 animate-bounce' : 'bg-blue-500 hover:bg-blue-400'
                      }`}
                      title="Click to Connect Input Wire"
                    />
                  )}

                  {/* Node Output Port (Right) */}
                  <div
                    onClick={(e) => handleStartConnecting(e, node.id)}
                    className="w-4 h-4 rounded-full bg-purple-500 hover:bg-purple-400 border-2 border-[var(--bg-app)] absolute -right-2 top-[11px] shadow-xs cursor-pointer hover:scale-125 transition-transform z-30"
                    title="Click & Drag to Connect Output Wire"
                  />

                  {/* Node Header */}
                  <div className="p-2.5 border-b border-[var(--border-color)] flex items-center justify-between gap-2 bg-[var(--bg-input)]/80 rounded-t-xl h-[38px]">
                    <div className="flex items-center gap-1.5 truncate flex-1">
                      <GripHorizontal className="w-3 h-3 text-[var(--text-dim)] shrink-0" />
                      {node.type === 'trigger' ? (
                        <span className="font-bold text-xs text-amber-400 truncate">⚡ Trigger</span>
                      ) : (
                        <span
                          className={`font-mono text-[9px] font-bold px-1.5 py-0.2 rounded border uppercase shrink-0 ${
                            node.config.method === 'GET'
                              ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
                              : 'text-orange-400 border-orange-500/30 bg-orange-500/10'
                          }`}
                        >
                          {node.config.method}
                        </span>
                      )}
                      <span className="font-bold text-xs text-[var(--text-main)] truncate" title={node.title}>
                        {node.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {node.status === 'running' && (
                        <span className="w-3 h-3 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                      )}
                      {node.status === 'success' && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      )}
                      {node.status === 'error' && (
                        <XCircle className="w-3.5 h-3.5 text-red-400" />
                      )}
                      {node.type !== 'trigger' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteNode(node.id);
                          }}
                          className="text-[var(--text-dim)] hover:text-red-400 p-0.5 rounded transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Node Body Details */}
                  <div className="p-2.5 space-y-2 text-xs">
                    {node.type === 'trigger' ? (
                      <div className="text-[11px] text-[var(--text-dim)] py-1">
                        Initiates the pipeline workflow upon execution start.
                      </div>
                    ) : (
                      <>
                        {/* Endpoint Path Input */}
                        <div>
                          <input
                            type="text"
                            value={node.config.path || ''}
                            onChange={(e) => updateNodeConfig(node.id, { path: e.target.value })}
                            placeholder="/endpoint/{{var}}"
                            className="w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded px-2 py-1 font-mono text-[11px] text-[var(--text-main)] outline-none focus:border-[var(--border-focus)]"
                          />
                        </div>

                        {/* Request Body JSON Drawer Toggle (for POST, PUT, PATCH) */}
                        {['POST', 'PUT', 'PATCH'].includes(node.config.method || '') && (
                          <div className="pt-1 border-t border-[var(--border-color)]/50">
                            <button
                              onClick={() =>
                                setExpandedPayloadNodeId(isPayloadExpanded ? null : node.id)
                              }
                              className="w-full flex items-center justify-between text-[10px] text-blue-400 hover:text-blue-300 font-semibold py-0.5 cursor-pointer"
                            >
                              <span className="flex items-center gap-1">
                                <Code className="w-3 h-3" />
                                <span>Payload Body (JSON)</span>
                              </span>
                              {isPayloadExpanded ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                            </button>

                            {isPayloadExpanded && (
                              <textarea
                                value={node.config.bodyJson || ''}
                                onChange={(e) => updateNodeConfig(node.id, { bodyJson: e.target.value })}
                                rows={4}
                                className="w-full mt-1 bg-[var(--bg-input)] border border-[var(--border-color)] rounded p-1.5 font-mono text-[10px] text-emerald-400 outline-none resize-y"
                                placeholder='{\n  "key": "value"\n}'
                              />
                            )}
                          </div>
                        )}

                        {/* Variable Extraction Settings */}
                        <div className="pt-1 border-t border-[var(--border-color)]/50 space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-[var(--text-dim)]">
                            <span>Extract Response Field</span>
                            <span className="text-purple-400 font-mono">Save to Variable</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              placeholder="data.token"
                              value={node.config.extractPath || ''}
                              onChange={(e) => updateNodeConfig(node.id, { extractPath: e.target.value })}
                              className="w-1/2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-main)] outline-none"
                            />
                            <ArrowRight className="w-3 h-3 text-[var(--text-dim)] shrink-0" />
                            <input
                              type="text"
                              placeholder="token"
                              value={node.config.extractKey || ''}
                              onChange={(e) => updateNodeConfig(node.id, { extractKey: e.target.value })}
                              className="w-1/2 bg-[var(--bg-input)] border border-[var(--border-color)] rounded px-1.5 py-0.5 font-mono text-[10px] text-purple-400 outline-none"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {/* Node Live Output Pill */}
                    {node.executionResult && (
                      <div className="pt-1.5 border-t border-[var(--border-color)]/50 flex items-center justify-between text-[10px] font-mono">
                        <span className={node.status === 'success' ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                          {node.executionResult.statusCode ? `${node.executionResult.statusCode} OK` : node.executionResult.error}
                        </span>
                        <span className="text-[var(--text-dim)] flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {node.executionResult.durationMs}ms
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floating Zoom & Centering Controls Widget (Bottom Right) */}
          <div className="absolute bottom-4 right-4 z-40 bg-[var(--bg-sidebar)]/90 backdrop-blur-md border border-[var(--border-color)] rounded-xl p-1 shadow-2xl flex items-center gap-1 text-xs">
            <button
              onClick={() => autoCenterWorkflow()}
              className="px-2 h-7 flex items-center gap-1 rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-blue-400 font-semibold transition-colors cursor-pointer border-r border-[var(--border-color)] pr-2"
              title="Center Workflow in Playground"
            >
              <Crosshair className="w-3.5 h-3.5 text-blue-400" />
              <span>Center</span>
            </button>
            <button
              onClick={() => setZoom((z) => Math.max(0.3, Number((z - 0.1).toFixed(2))))}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] font-bold transition-colors cursor-pointer"
              title="Zoom Out (Mouse Wheel Down)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setTimeout(() => autoCenterWorkflow(workflow.nodes, 1), 50);
              }}
              className="px-2 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--bg-card)] font-mono text-[11px] text-[var(--text-main)] font-bold transition-colors cursor-pointer"
              title="Reset Zoom to 100% and Center"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(2.0, Number((z + 0.1).toFixed(2))))}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] font-bold transition-colors cursor-pointer"
              title="Zoom In (Mouse Wheel Up)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setTimeout(() => autoCenterWorkflow(workflow.nodes, 1), 50);
              }}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
              title="Fit to Screen & Center (100%)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
