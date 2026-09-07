import { create } from 'zustand';
import * as yaml from 'js-yaml';
import type { OpenAPISpec, StudioTab, ResponseData, RequestHistoryItem, RequestAssertion, TestResult } from '../types/openapi';

interface StudioState {
  spec: OpenAPISpec | null;
  isLoadingSpec: boolean;
  specError: string | null;
  
  viewMode: 'docs' | 'studio' | 'workflow';
  tabModeEnabled: boolean;
  
  tabs: StudioTab[];
  activeTabId: string | null;
  
  theme: 'dark' | 'midnight' | 'cyberpunk' | 'light';
  environment: string;
  environments: Array<{ label: string; url: string }>;
  
  variables: Record<string, string>;
  isVariablesModalOpen: boolean;
  isCmdPaletteOpen: boolean;
  isTypeModalOpen: boolean;
  isLoadTesterOpen: boolean;
  isScenarioModalOpen: boolean;
  
  history: RequestHistoryItem[];
  savedCollections: Record<string, Array<{ id: string; name: string; method: string; url: string }>>;
  
  engineMode: 'live' | 'mock';
  mockStatus: string;
  
  pinnedBaseline: any | null;
  responseViewMode: 'raw' | 'tree' | 'diff';
  
  // Actions
  fetchSpec: () => Promise<void>;
  setViewMode: (mode: 'docs' | 'studio' | 'workflow') => void;
  setTabModeEnabled: (enabled: boolean) => void;
  setTheme: (theme: 'dark' | 'midnight' | 'cyberpunk' | 'light') => void;
  setEnvironment: (url: string) => void;
  
  openEndpointInTab: (method: string, path: string, shouldSwitchToStudio?: boolean) => void;
  createBlankTab: () => void;
  closeTab: (tabId: string) => void;
  setActiveTabId: (tabId: string) => void;
  updateActiveTab: (updater: (tab: StudioTab) => Partial<StudioTab> | StudioTab) => void;
  
  setVariablesModalOpen: (open: boolean) => void;
  setCmdPaletteOpen: (open: boolean) => void;
  setTypeModalOpen: (open: boolean) => void;
  setLoadTesterOpen: (open: boolean) => void;
  setScenarioModalOpen: (open: boolean) => void;
  setVariable: (key: string, value: string) => void;
  deleteVariable: (key: string) => void;
  
  setEngineMode: (mode: 'live' | 'mock') => void;
  setMockStatus: (status: string) => void;
  setResponseViewMode: (mode: 'raw' | 'tree' | 'diff') => void;
  setPinnedBaseline: (baseline: any) => void;
  
  interpolate: (text: string) => string;
  sendActiveRequest: () => Promise<void>;
  saveCurrentToCollection: (name: string) => void;
  saveEndpointToCollection: (method: string, path: string, folderName?: string) => void;
  saveTabToCollection: (tabId: string, folderName?: string) => void;
  clearHistory: () => void;
  importCurlCommand: (curlStr: string) => boolean;
  exportToPostman: () => string;
  exportToOpenAPI: (format: 'json' | 'yaml') => string;
}

const defaultAssertions: RequestAssertion[] = [
  { id: 'ast_status', name: 'Status code is 200 OK', type: 'status_200', enabled: true },
  { id: 'ast_perf', name: 'Response time < 500ms', type: 'responseTime_500', enabled: true },
  { id: 'ast_json', name: 'Response body is valid JSON', type: 'is_json', enabled: true },
];

export const useStudioStore = create<StudioState>((set, get) => ({
  spec: null,
  isLoadingSpec: true,
  specError: null,
  
  viewMode: (() => {
    try {
      if (typeof window !== 'undefined') {
        const p = window.location.pathname;
        if (p.startsWith('/workflow')) {
          return 'workflow' as const;
        }
        if (p.startsWith('/api') || p.startsWith('/studio')) {
          return 'studio' as const;
        }
        if (p.startsWith('/docs')) {
          return 'docs' as const;
        }
      }
    } catch {}
    return 'docs' as const;
  })(),
  
  tabModeEnabled: false,
  
  tabs: [],
  activeTabId: null,
  
  theme: (localStorage.getItem('openapi_theme') as any) || 'dark',
  environment: localStorage.getItem('openapi_selected_env') || 'http://localhost:8000/v1',
  environments: [
    { label: 'Local Development', url: 'http://localhost:8000/v1' },
    { label: 'Docker Container', url: 'http://localhost:8085/v1' },
    { label: 'Staging Server', url: 'https://staging-api.magicapi.dev/v1' },
    { label: 'Production Server', url: 'https://api.magicapi.dev/v1' },
  ],
  
  variables: (() => {
    try {
      return JSON.parse(localStorage.getItem('openapi_custom_vars') || '{}');
    } catch {
      return {};
    }
  })(),
  isVariablesModalOpen: false,
  isCmdPaletteOpen: false,
  isTypeModalOpen: false,
  isLoadTesterOpen: false,
  isScenarioModalOpen: false,
  
  history: (() => {
    try {
      return JSON.parse(localStorage.getItem('openapi_req_history_log') || '[]');
    } catch {
      return [];
    }
  })(),
  savedCollections: (() => {
    try {
      return JSON.parse(localStorage.getItem('openapi_saved_collections_map') || '{"Default":[]}');
    } catch {
      return { Default: [] };
    }
  })(),
  
  engineMode: 'live',
  mockStatus: '200',
  pinnedBaseline: null,
  responseViewMode: 'raw',
  
  fetchSpec: async () => {
    set({ isLoadingSpec: true, specError: null });
    const specUrls = ['/docs/openapi.yaml', '/openapi.yaml', '/openapi.json'];
    let fetchedSpec: any = null;
    let lastErr = '';

    for (const url of specUrls) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const text = await res.text();
        if (url.endsWith('.json') || text.trim().startsWith('{')) {
          fetchedSpec = JSON.parse(text);
        } else {
          fetchedSpec = yaml.load(text);
        }
        if (fetchedSpec && fetchedSpec.paths) break;
      } catch (err: any) {
        lastErr = err.message;
      }
    }

    if (!fetchedSpec || !fetchedSpec.paths) {
      set({ isLoadingSpec: false, specError: lastErr || 'Failed to parse OpenAPI Specification' });
      return;
    }

    // Extract dynamic environments from servers block
    const envs = (fetchedSpec.servers || []).map((s: any) => ({
      label: s.description || s.url,
      url: s.url,
    }));

    if (envs.length === 0) {
      envs.push({ label: 'Default Gateway', url: 'http://localhost:8000/v1' });
    }

    const currentEnv = localStorage.getItem('openapi_selected_env') || envs[0].url;

    set({
      spec: fetchedSpec,
      isLoadingSpec: false,
      environments: envs,
      environment: currentEnv,
    });

    // Auto-create initial default tab if tabs array is empty
    const state = get();
    if (state.tabs.length === 0 && fetchedSpec.paths) {
      const firstPath = Object.keys(fetchedSpec.paths)[0];
      if (firstPath) {
        const firstMethod = Object.keys(fetchedSpec.paths[firstPath])[0];
        if (firstMethod && ['get', 'post', 'put', 'delete', 'patch'].includes(firstMethod.toLowerCase())) {
          state.openEndpointInTab(firstMethod, firstPath, false);
        }
      }
    }
  },
  
  setViewMode: (mode) => {
    const nextPath = mode === 'docs' ? '/docs' : '/api';
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, '', nextPath);
    }
    set({ viewMode: mode });
  },
  
  setTabModeEnabled: (enabled) => set({ tabModeEnabled: enabled }),
  
  setTheme: (theme) => {
    localStorage.setItem('openapi_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    set({ theme });
  },
  
  setEnvironment: (url) => {
    localStorage.setItem('openapi_selected_env', url);
    set({ environment: url });
    
    // Update active tab URL with new environment base
    const state = get();
    if (state.activeTabId) {
      state.updateActiveTab((t) => {
        const pathPart = t.path ? (t.path.startsWith('/') ? t.path : `/${t.path}`) : '';
        return { url: `${url.replace(/\/$/, '')}${pathPart}` };
      });
    }
  },
  
  openEndpointInTab: (method, path, shouldSwitchToStudio = false) => {
    const state = get();
    const spec = state.spec;
    const op = spec?.paths?.[path]?.[method.toLowerCase() as any];
    const env = state.environment.replace(/\/$/, '');
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const fullUrl = `${env}${cleanPath}`;
    
    const queryParams = (op?.parameters || [])
      .filter((p: any) => p.in === 'query')
      .map((p: any) => ({
        key: p.name,
        value: p.example ? String(p.example) : (p.schema?.default !== undefined ? String(p.schema.default) : ''),
        enabled: !!p.required,
        description: p.description || '',
      }));
      
    const headerParams = [
      { key: 'Accept', value: 'application/json', enabled: true },
      { key: 'Content-Type', value: 'application/json', enabled: true },
    ];
    
    let bodyType: 'none' | 'raw-json' | 'form-data' | 'x-www-form-urlencoded' = 'none';
    let bodyJson = '{\n  \n}';
    let formData: Array<{ key: string; value: string; type: 'text' | 'file'; file?: File | null }> = [];
    let urlEncodedData: Array<{ key: string; value: string }> = [];
    
    const reqBodyContent = op?.requestBody?.content;
    if (reqBodyContent) {
      if (reqBodyContent['application/json']) {
        bodyType = 'raw-json';
        const schema = reqBodyContent['application/json'].schema;
        const example = reqBodyContent['application/json'].example;
        if (example) {
          bodyJson = JSON.stringify(example, null, 2);
        } else if (schema) {
          bodyJson = JSON.stringify(generateSchemaExample(schema, spec?.components?.schemas), null, 2);
        }
      } else if (reqBodyContent['multipart/form-data']) {
        bodyType = 'form-data';
        let schema = reqBodyContent['multipart/form-data'].schema;
        if (schema?.$ref && spec?.components?.schemas) {
          const refName = schema.$ref.split('/').pop();
          schema = spec.components.schemas[refName] || schema;
        }
        if (schema?.properties) {
          formData = Object.entries(schema.properties).map(([key, prop]: [string, any]) => {
            const isFile = prop.format === 'binary' || prop.type === 'file' || key.toLowerCase().includes('logo') || key.toLowerCase().includes('file') || key.toLowerCase().includes('doc');
            return {
              key,
              value: prop.example !== undefined ? String(prop.example) : (prop.default !== undefined ? String(prop.default) : ''),
              type: isFile ? 'file' : 'text',
            };
          });
        }
      } else if (reqBodyContent['application/x-www-form-urlencoded']) {
        bodyType = 'x-www-form-urlencoded';
        let schema = reqBodyContent['application/x-www-form-urlencoded'].schema;
        if (schema?.$ref && spec?.components?.schemas) {
          const refName = schema.$ref.split('/').pop();
          schema = spec.components.schemas[refName] || schema;
        }
        if (schema?.properties) {
          urlEncodedData = Object.entries(schema.properties).map(([key, prop]: [string, any]) => ({
            key,
            value: prop.example !== undefined ? String(prop.example) : (prop.default !== undefined ? String(prop.default) : ''),
          }));
        }
      }
    }
    
    const tabId = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newTab: StudioTab = {
      id: tabId,
      method: method.toUpperCase(),
      path,
      title: op?.summary || path,
      url: fullUrl,
      queryParams,
      headerParams,
      bodyType,
      bodyJson,
      formData,
      urlEncodedData,
      assertions: [...defaultAssertions],
      response: null,
      isDirty: false,
    };
    
    if (!state.tabModeEnabled) {
      // In Focus Mode, replace the single focused tab
      set({
        tabs: [newTab],
        activeTabId: tabId,
        ...(shouldSwitchToStudio ? { viewMode: 'studio' } : {}),
      });
      return;
    }

    // In Multi-Tab Mode, check if tab with exact method & path exists
    const existing = state.tabs.find((t) => t.method === method.toUpperCase() && t.path === path);
    if (existing) {
      set({
        activeTabId: existing.id,
        ...(shouldSwitchToStudio ? { viewMode: 'studio' } : {}),
      });
      return;
    }

    set({
      tabs: [...state.tabs, newTab],
      activeTabId: tabId,
      ...(shouldSwitchToStudio ? { viewMode: 'studio' } : {}),
    });
  },
  
  createBlankTab: () => {
    const state = get();
    const tabId = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newTab: StudioTab = {
      id: tabId,
      method: 'GET',
      path: '',
      title: 'New Request',
      url: `${state.environment.replace(/\/$/, '')}/`,
      queryParams: [],
      headerParams: [
        { key: 'Accept', value: 'application/json', enabled: true },
        { key: 'Content-Type', value: 'application/json', enabled: true },
      ],
      bodyType: 'none',
      bodyJson: '{\n  \n}',
      formData: [],
      urlEncodedData: [],
      assertions: [...defaultAssertions],
      response: null,
      isDirty: false,
    };
    set({ tabs: [...state.tabs, newTab], activeTabId: tabId });
  },
  
  closeTab: (tabId) => {
    const state = get();
    const filtered = state.tabs.filter((t) => t.id !== tabId);
    let nextActive = state.activeTabId;
    
    if (state.activeTabId === tabId) {
      nextActive = filtered.length > 0 ? filtered[filtered.length - 1].id : null;
    }
    
    if (filtered.length === 0) {
      set({ tabs: [], activeTabId: null });
      get().createBlankTab();
    } else {
      set({ tabs: filtered, activeTabId: nextActive });
    }
  },
  
  setActiveTabId: (tabId) => set({ activeTabId: tabId }),
  
  updateActiveTab: (updater) => {
    const state = get();
    if (!state.activeTabId) return;
    
    const updatedTabs = state.tabs.map((tab) => {
      if (tab.id === state.activeTabId) {
        const patch = updater(tab);
        return { ...tab, ...patch };
      }
      return tab;
    });
    
    set({ tabs: updatedTabs });
  },
  
  setVariablesModalOpen: (open) => set({ isVariablesModalOpen: open }),
  setCmdPaletteOpen: (open) => set({ isCmdPaletteOpen: open }),
  setTypeModalOpen: (open) => set({ isTypeModalOpen: open }),
  setLoadTesterOpen: (open) => set({ isLoadTesterOpen: open }),
  setScenarioModalOpen: (open) => set({ isScenarioModalOpen: open }),
  
  setVariable: (key, value) => {
    const updated = { ...get().variables, [key]: value };
    localStorage.setItem('openapi_custom_vars', JSON.stringify(updated));
    set({ variables: updated });
  },
  
  deleteVariable: (key) => {
    const updated = { ...get().variables };
    delete updated[key];
    localStorage.setItem('openapi_custom_vars', JSON.stringify(updated));
    set({ variables: updated });
  },
  
  setEngineMode: (mode) => set({ engineMode: mode }),
  setMockStatus: (status) => set({ mockStatus: status }),
  setResponseViewMode: (mode) => set({ responseViewMode: mode }),
  setPinnedBaseline: (baseline) => set({ pinnedBaseline: baseline }),
  
  interpolate: (text: string) => {
    if (typeof text !== 'string') return text;
    const vars = get().variables;
    return text.replace(/\{\{([a-zA-Z0-9_$.]+)\}\}/g, (match, key) => {
      if (key === '$uuid') return crypto.randomUUID ? crypto.randomUUID() : 'id_' + Math.random().toString(36).substring(2, 9);
      if (key === '$timestamp') return Date.now().toString();
      if (key === '$isoTimestamp') return new Date().toISOString();
      if (key === '$randomEmail') return `user_${Math.random().toString(36).substring(2, 7)}@example.com`;
      if (key === '$randomInt') return String(Math.floor(Math.random() * 10000));
      if (key === '$today') return new Date().toISOString().split('T')[0];
      return vars[key] !== undefined ? vars[key] : match;
    });
  },
  
  sendActiveRequest: async () => {
    const state = get();
    const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!activeTab) return;
    
    const interpolate = state.interpolate;
    let url = interpolate(activeTab.url);
    
    // Append query params
    const enabledQuery = activeTab.queryParams.filter((q) => q.enabled && q.key);
    if (enabledQuery.length > 0) {
      const qParams = new URLSearchParams();
      enabledQuery.forEach((q) => qParams.append(interpolate(q.key), interpolate(q.value)));
      const delimiter = url.includes('?') ? '&' : '?';
      url += `${delimiter}${qParams.toString()}`;
    }
    
    // Check Mock Mode
    if (state.engineMode === 'mock') {
      const startTime = performance.now();
      const mockStatus = parseInt(state.mockStatus, 10) || 200;
      
      // Synthesize response schema
      const op = state.spec?.paths?.[activeTab.path]?.[activeTab.method.toLowerCase() as any];
      const respObj = op?.responses?.[state.mockStatus] || op?.responses?.['200'] || (op?.responses ? Object.values(op.responses)[0] : null);
      const schema = respObj?.content?.['application/json']?.schema;
      const mockData = generateSchemaExample(schema, state.spec?.components?.schemas);
      
      const duration = Math.round(performance.now() - startTime + 12);
      const getMockStatusText = (code: number) => {
        if (code === 200) return 'OK (Mock)';
        if (code === 201) return 'Created (Mock)';
        if (code === 400) return 'Bad Request (Mock)';
        if (code === 401) return 'Unauthorized (Mock)';
        if (code === 500) return 'Server Error (Mock)';
        return 'Mock';
      };

      const testResults: TestResult[] = (activeTab.assertions || []).filter((a) => a.enabled).map((a) => {
        if (a.type === 'status_200') {
          const pass = mockStatus === 200;
          return { name: a.name, passed: pass, message: pass ? `Status is 200` : `Expected 200, got ${mockStatus}` };
        }
        if (a.type === 'responseTime_500') {
          const pass = duration < 500;
          return { name: a.name, passed: pass, message: pass ? `Duration ${duration}ms < 500ms` : `Duration ${duration}ms exceeded limit` };
        }
        if (a.type === 'is_json') {
          const pass = typeof mockData === 'object' && mockData !== null;
          return { name: a.name, passed: pass, message: pass ? `Valid JSON structure` : `Response is not valid JSON` };
        }
        return { name: a.name, passed: true, message: 'Passed' };
      });

      const respPayload: ResponseData = {
        status: mockStatus,
        statusText: getMockStatusText(mockStatus),
        duration,
        sizeBytes: new Blob([JSON.stringify(mockData)]).size,
        headers: { 'content-type': 'application/json', 'x-mock-engine': 'openapi-doc-studio' },
        data: mockData,
        rawText: JSON.stringify(mockData, null, 2),
        testResults,
      };
      
      state.updateActiveTab(() => ({ response: respPayload }));
      return;
    }
    
    // Live Request
    const headers: Record<string, string> = {};
    activeTab.headerParams.filter((h) => h.enabled && h.key).forEach((h) => {
      headers[interpolate(h.key)] = interpolate(h.value);
    });
    
    let body: any = undefined;
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(activeTab.method)) {
      if (activeTab.bodyType === 'raw-json' && activeTab.bodyJson) {
        body = interpolate(activeTab.bodyJson);
      } else if (activeTab.bodyType === 'form-data') {
        const formData = new FormData();
        activeTab.formData.forEach((f) => {
          if (f.key) {
            if (f.type === 'file' && f.file) {
              formData.append(f.key, f.file);
            } else {
              formData.append(f.key, interpolate(f.value));
            }
          }
        });
        body = formData;
        delete headers['Content-Type']; // Let browser set boundary
      } else if (activeTab.bodyType === 'x-www-form-urlencoded') {
        const params = new URLSearchParams();
        activeTab.urlEncodedData.forEach((d) => {
          if (d.key) params.append(interpolate(d.key), interpolate(d.value));
        });
        body = params.toString();
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
    }
    
    const startTime = performance.now();
    try {
      const res = await fetch(url, {
        method: activeTab.method,
        headers,
        body,
        credentials: 'include',
      });
      
      const duration = Math.round(performance.now() - startTime);
      const rawText = await res.text();
      let parsedData: any = rawText;
      let formattedText = rawText;
      try {
        parsedData = JSON.parse(rawText);
        formattedText = JSON.stringify(parsedData, null, 2);
      } catch {}
      
      const respHeaders: Record<string, string> = {};
      res.headers.forEach((v, k) => { respHeaders[k] = v; });

      // Run assertions
      const testResults: TestResult[] = (activeTab.assertions || []).filter((a) => a.enabled).map((a) => {
        if (a.type === 'status_200') {
          const pass = res.status === 200;
          return { name: a.name, passed: pass, message: pass ? `Status is 200` : `Expected 200, got ${res.status}` };
        }
        if (a.type === 'responseTime_500') {
          const pass = duration < 500;
          return { name: a.name, passed: pass, message: pass ? `Duration ${duration}ms < 500ms` : `Duration ${duration}ms exceeded limit` };
        }
        if (a.type === 'is_json') {
          const pass = typeof parsedData === 'object' && parsedData !== null;
          return { name: a.name, passed: pass, message: pass ? `Valid JSON structure` : `Response is not valid JSON` };
        }
        if (a.type === 'custom_status') {
          const target = parseInt(a.targetValue || '200', 10);
          const pass = res.status === target;
          return { name: a.name, passed: pass, message: pass ? `Status is ${target}` : `Expected ${target}, got ${res.status}` };
        }
        if (a.type === 'contains_key') {
          const key = a.targetValue || '';
          const pass = typeof parsedData === 'object' && parsedData !== null && key in parsedData;
          return { name: a.name, passed: pass, message: pass ? `Contains field "${key}"` : `Field "${key}" not found in response` };
        }
        return { name: a.name, passed: true, message: 'Passed' };
      });
      
      const respData: ResponseData = {
        status: res.status,
        statusText: res.statusText || (res.status >= 200 && res.status < 300 ? 'OK' : 'Error'),
        duration,
        sizeBytes: new Blob([rawText]).size,
        headers: respHeaders,
        data: parsedData,
        rawText: formattedText,
        testResults,
      };
      
      state.updateActiveTab(() => ({ response: respData }));
      
      // Auto Log to history
      const historyItem: RequestHistoryItem = {
        id: `hist_${Date.now()}`,
        method: activeTab.method,
        url,
        status: res.status,
        statusText: respData.statusText,
        duration,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      };
      
      const updatedHistory = [historyItem, ...state.history.slice(0, 49)];
      localStorage.setItem('openapi_req_history_log', JSON.stringify(updatedHistory));
      set({ history: updatedHistory });
      
      // Auto Token capture
      if (typeof parsedData === 'object' && parsedData !== null) {
        const tokenVal =
          parsedData.token ||
          parsedData.access_token ||
          parsedData.jwt ||
          parsedData.accessToken ||
          parsedData.data?.token ||
          parsedData.data?.access_token ||
          parsedData.data?.jwt ||
          parsedData.data?.accessToken;
        if (tokenVal && typeof tokenVal === 'string') {
          state.setVariable('token', tokenVal);
          state.setVariable('adminAccessToken', tokenVal);
          state.setVariable('clientAccessToken', tokenVal);

          // Strip any Authorization header from open tabs so authentication relies purely on cookies
          set({
            tabs: get().tabs.map((t) => ({
              ...t,
              headerParams: t.headerParams.filter((h) => h.key.toLowerCase() !== 'authorization'),
            })),
          });
        }
      }
    } catch (err: any) {
      const duration = Math.round(performance.now() - startTime);
      const testResults: TestResult[] = (activeTab.assertions || []).filter((a) => a.enabled).map((a) => ({
        name: a.name,
        passed: false,
        message: `Network Error: ${err.message || 'Failed to connect'}`,
      }));

      const errorResp: ResponseData = {
        status: 0,
        statusText: 'Network Error',
        duration,
        sizeBytes: 0,
        headers: {},
        data: { error: err.message || 'Failed to fetch', hint: 'Check CORS policy or server availability' },
        rawText: err.message || 'Failed to fetch',
        testResults,
      };
      state.updateActiveTab(() => ({ response: errorResp }));
    }
  },
  
  saveCurrentToCollection: (name) => {
    const state = get();
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!tab) return;
    
    const collections = { ...state.savedCollections };
    if (!collections['Default']) collections['Default'] = [];
    collections['Default'].push({
      id: `col_${Date.now()}`,
      name,
      method: tab.method,
      url: tab.url,
    });
    
    localStorage.setItem('openapi_saved_collections_map', JSON.stringify(collections));
    set({ savedCollections: collections });
  },

  saveEndpointToCollection: (method, path, folderName = 'Default') => {
    const state = get();
    const op = state.spec?.paths?.[path]?.[method.toLowerCase() as any];
    const env = state.environment.replace(/\/$/, '');
    const url = `${env}${path.startsWith('/') ? '' : '/'}${path}`;
    const name = op?.summary || path;

    const collections = { ...state.savedCollections };
    if (!collections[folderName]) collections[folderName] = [];
    collections[folderName].push({
      id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      method: method.toUpperCase(),
      url,
    });

    localStorage.setItem('openapi_saved_collections_map', JSON.stringify(collections));
    set({ savedCollections: collections });
  },

  saveTabToCollection: (tabId, folderName = 'Default') => {
    const state = get();
    const tab = state.tabs.find((t) => t.id === tabId);
    if (!tab) return;

    const collections = { ...state.savedCollections };
    if (!collections[folderName]) collections[folderName] = [];
    collections[folderName].push({
      id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: tab.title || tab.path || 'Saved Request',
      method: tab.method,
      url: tab.url,
    });

    localStorage.setItem('openapi_saved_collections_map', JSON.stringify(collections));
    set({ savedCollections: collections });
  },
  
  clearHistory: () => {
    localStorage.removeItem('openapi_req_history_log');
    set({ history: [] });
  },

  importCurlCommand: (curlStr: string) => {
    try {
      const methodMatch = curlStr.match(/-X\s+([A-Z]+)/i);
      const method = methodMatch ? methodMatch[1].toUpperCase() : (curlStr.includes('--data') || curlStr.includes('-d ') ? 'POST' : 'GET');
      
      const urlMatch = curlStr.match(/curl\s+(?:-[^\s]+\s+)*['"]?(https?:\/\/[^\s'"]+)/i) || curlStr.match(/['"](https?:\/\/[^'"]+)['"]/i);
      const url = urlMatch ? urlMatch[1] : '';
      if (!url) return false;

      const headerParams: Array<{ key: string; value: string; enabled: boolean }> = [];
      const headerRegex = /-H\s+['"]([^'"]+)['"]/gi;
      let hMatch;
      while ((hMatch = headerRegex.exec(curlStr)) !== null) {
        const parts = hMatch[1].split(':');
        if (parts.length >= 2) {
          headerParams.push({
            key: parts[0].trim(),
            value: parts.slice(1).join(':').trim(),
            enabled: true,
          });
        }
      }

      let bodyJson = '{\n  \n}';
      let bodyType: 'none' | 'raw-json' = 'none';
      const dataMatch = curlStr.match(/(?:-d|--data|--data-raw)\s+['"]([\s\S]*?)['"](?:\s+-[a-zA-Z]|\s*$)/);
      if (dataMatch) {
        bodyType = 'raw-json';
        bodyJson = dataMatch[1];
      }

      const state = get();
      const tabId = `tab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const importedTab: StudioTab = {
        id: tabId,
        method,
        path: url.replace(/^https?:\/\/[^/]+/, ''),
        title: `cURL ${method}`,
        url,
        queryParams: [],
        headerParams: headerParams.length > 0 ? headerParams : [
          { key: 'Accept', value: 'application/json', enabled: true },
          { key: 'Content-Type', value: 'application/json', enabled: true },
        ],
        bodyType,
        bodyJson,
        formData: [],
        urlEncodedData: [],
        assertions: [...defaultAssertions],
        response: null,
        isDirty: true,
      };

      if (!state.tabModeEnabled) {
        set({ tabs: [importedTab], activeTabId: tabId, viewMode: 'studio' });
      } else {
        set({ tabs: [...state.tabs, importedTab], activeTabId: tabId, viewMode: 'studio' });
      }
      return true;
    } catch {
      return false;
    }
  },

  exportToPostman: () => {
    const state = get();
    const spec = state.spec;
    const items: any[] = [];

    for (const [path, pathItem] of Object.entries(spec?.paths || {})) {
      for (const method of ['get', 'post', 'put', 'delete', 'patch'] as const) {
        const op = (pathItem as any)[method];
        if (!op) continue;

        items.push({
          name: op.summary || path,
          request: {
            method: method.toUpperCase(),
            header: [
              { key: 'Accept', value: 'application/json', type: 'text' },
              { key: 'Content-Type', value: 'application/json', type: 'text' },
            ],
            url: {
              raw: `{{baseUrl}}${path.startsWith('/') ? '' : '/'}${path}`,
              host: ['{{baseUrl}}'],
              path: path.split('/').filter(Boolean),
            },
            description: op.description || '',
          },
        });
      }
    }

    const postmanCollection = {
      info: {
        _postman_id: crypto.randomUUID ? crypto.randomUUID() : 'col_magicapi',
        name: spec?.info?.title || 'MagicAPI Export',
        schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
      },
      item: items,
      variable: [
        {
          key: 'baseUrl',
          value: state.environment,
          type: 'string',
        },
      ],
    };

    return JSON.stringify(postmanCollection, null, 2);
  },

  exportToOpenAPI: (format: 'json' | 'yaml') => {
    const state = get();
    if (!state.spec) return '';
    if (format === 'json') {
      return JSON.stringify(state.spec, null, 2);
    }
    return yaml.dump(state.spec);
  },
}));

function generateSchemaExample(
  schema: any,
  componentsSchemas?: Record<string, any>,
  depth = 0,
  seenRefs = new Set<string>()
): any {
  if (!schema || depth > 6) return { message: 'OK' };
  
  if (schema.$ref && componentsSchemas) {
    const refName = schema.$ref.split('/').pop();
    if (refName && seenRefs.has(refName)) {
      return { id: 'ref_' + refName };
    }
    if (refName && componentsSchemas[refName]) {
      const nextSeen = new Set(seenRefs);
      nextSeen.add(refName);
      return generateSchemaExample(componentsSchemas[refName], componentsSchemas, depth + 1, nextSeen);
    }
  }
  
  if (schema.example !== undefined) return schema.example;
  if (schema.enum && schema.enum.length > 0) return schema.enum[0];
  
  const type = schema.type || (schema.properties ? 'object' : 'string');
  if (type === 'object') {
    const obj: Record<string, any> = {};
    const props = schema.properties || {};
    for (const key in props) {
      obj[key] = generateSchemaExample(props[key], componentsSchemas, depth + 1, seenRefs);
    }
    return obj;
  }
  if (type === 'array') {
    return [generateSchemaExample(schema.items, componentsSchemas, depth + 1, seenRefs)];
  }
  if (type === 'string') {
    if (schema.format === 'email') return 'developer@magicapi.dev';
    if (schema.format === 'uuid') return 'c8a4b3e2-5a6b-4e12-9c3f-7e8a9b0c1d2e';
    if (schema.format === 'date-time') return new Date().toISOString();
    return 'sample_' + (schema.title || 'string');
  }
  if (type === 'integer' || type === 'number') return schema.minimum !== undefined ? schema.minimum : 100;
  if (type === 'boolean') return true;
  return null;
}
