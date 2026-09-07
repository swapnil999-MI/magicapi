export interface WorkflowNode {
  id: string;
  type: 'trigger' | 'api' | 'extract' | 'assertion';
  title: string;
  x: number;
  y: number;
  config: {
    method?: string;
    path?: string;
    headers?: Record<string, string>;
    bodyJson?: string;
    extractKey?: string;
    extractPath?: string;
    assertionField?: string;
    assertionValue?: string;
  };
  status?: 'idle' | 'running' | 'success' | 'error';
  executionResult?: {
    statusCode?: number;
    durationMs?: number;
    responseBody?: any;
    extractedValue?: any;
    error?: string;
  };
}

export interface WorkflowConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
}

export interface WorkflowSpec {
  name: string;
  version: string;
  description?: string;
  updatedAt?: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
}
