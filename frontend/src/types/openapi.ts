export interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info?: {
    title?: string;
    version?: string;
    description?: string;
  };
  servers?: Array<{
    url: string;
    description?: string;
  }>;
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
  tags?: Array<{
    name: string;
    description?: string;
  }>;
}

export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
  patch?: Operation;
  summary?: string;
  description?: string;
  parameters?: Parameter[];
}

export interface Operation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: {
    description?: string;
    required?: boolean;
    content?: Record<string, {
      schema?: any;
      example?: any;
      examples?: Record<string, any>;
    }>;
  };
  responses?: Record<string, {
    description?: string;
    content?: Record<string, {
      schema?: any;
      example?: any;
      examples?: Record<string, any>;
    }>;
  }>;
  security?: Array<Record<string, string[]>>;
}

export interface Parameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  schema?: any;
  example?: any;
}

export interface RequestAssertion {
  id: string;
  name: string;
  type: 'status_200' | 'responseTime_500' | 'is_json' | 'contains_key' | 'custom_status';
  targetValue?: string;
  enabled: boolean;
}

export interface StudioTab {
  id: string;
  method: string;
  path: string;
  title: string;
  url: string;
  queryParams: Array<{ key: string; value: string; enabled: boolean; description?: string }>;
  headerParams: Array<{ key: string; value: string; enabled: boolean }>;
  bodyType: 'none' | 'raw-json' | 'form-data' | 'x-www-form-urlencoded';
  bodyJson: string;
  formData: Array<{ key: string; value: string; type: 'text' | 'file'; file?: File | null }>;
  urlEncodedData: Array<{ key: string; value: string }>;
  assertions: RequestAssertion[];
  response: ResponseData | null;
  isDirty: boolean;
}

export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

export interface ResponseData {
  status: number;
  statusText: string;
  duration: number;
  sizeBytes: number;
  headers: Record<string, string>;
  data: any;
  rawText: string;
  testResults?: TestResult[];
}

export interface RequestHistoryItem {
  id: string;
  method: string;
  url: string;
  status: number;
  statusText: string;
  duration: number;
  timestamp: string;
}
