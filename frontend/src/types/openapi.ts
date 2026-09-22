export interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info?: Info;
  servers?: Server[];
  paths: Record<string, PathItem>;
  components?: Components;
  security?: Array<Record<string, string[]>>;
  tags?: Tag[];
  externalDocs?: ExternalDocumentation;
}

export interface Info {
  title?: string;
  version?: string;
  description?: string;
  termsOfService?: string;
  contact?: {
    name?: string;
    url?: string;
    email?: string;
  };
  license?: {
    name: string;
    url?: string;
  };
}

export interface Server {
  url: string;
  description?: string;
  variables?: Record<string, {
    enum?: string[];
    default: string;
    description?: string;
  }>;
}

export interface Tag {
  name: string;
  description?: string;
  externalDocs?: ExternalDocumentation;
}

export interface ExternalDocumentation {
  description?: string;
  url: string;
}

export interface PathItem {
  $ref?: string;
  summary?: string;
  description?: string;
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
  options?: Operation;
  head?: Operation;
  patch?: Operation;
  trace?: Operation;
  servers?: Server[];
  parameters?: Parameter[];
}

export interface Operation {
  summary?: string;
  description?: string;
  operationId?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses?: Record<string, ResponseItem>;
  callbacks?: Record<string, Record<string, PathItem>>;
  deprecated?: boolean;
  security?: Array<Record<string, string[]>>;
  servers?: Server[];
  externalDocs?: ExternalDocumentation;
}

export interface Parameter {
  $ref?: string;
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
  schema?: Schema;
  example?: any;
  examples?: Record<string, Example>;
  content?: Record<string, MediaType>;
}

export interface RequestBody {
  $ref?: string;
  description?: string;
  required?: boolean;
  content?: Record<string, MediaType>;
}

export interface MediaType {
  schema?: Schema;
  example?: any;
  examples?: Record<string, Example>;
  encoding?: Record<string, Encoding>;
}

export interface Encoding {
  contentType?: string;
  headers?: Record<string, Header>;
  style?: string;
  explode?: boolean;
  allowReserved?: boolean;
}

export interface ResponseItem {
  $ref?: string;
  description?: string;
  headers?: Record<string, Header>;
  content?: Record<string, MediaType>;
  links?: Record<string, Link>;
}

export interface Header {
  $ref?: string;
  description?: string;
  required?: boolean;
  deprecated?: boolean;
  allowEmptyValue?: boolean;
  style?: string;
  explode?: boolean;
  schema?: Schema;
  example?: any;
  examples?: Record<string, Example>;
  content?: Record<string, MediaType>;
}

export interface Example {
  $ref?: string;
  summary?: string;
  description?: string;
  value?: any;
  externalValue?: string;
}

export interface Link {
  $ref?: string;
  operationRef?: string;
  operationId?: string;
  parameters?: Record<string, any>;
  requestBody?: any;
  description?: string;
  server?: Server;
}

export interface Schema {
  $ref?: string;
  type?: string;
  format?: string;
  title?: string;
  description?: string;
  default?: any;
  multipleOf?: number;
  maximum?: number;
  exclusiveMaximum?: boolean;
  minimum?: number;
  exclusiveMinimum?: boolean;
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  maxItems?: number;
  minItems?: number;
  uniqueItems?: boolean;
  maxProperties?: number;
  minProperties?: number;
  required?: string[];
  enum?: any[];
  properties?: Record<string, Schema>;
  items?: Schema;
  additionalProperties?: boolean | Schema;
  oneOf?: Schema[];
  anyOf?: Schema[];
  allOf?: Schema[];
  not?: Schema;
  discriminator?: {
    propertyName: string;
    mapping?: Record<string, string>;
  };
  readOnly?: boolean;
  writeOnly?: boolean;
  xml?: {
    name?: string;
    namespace?: string;
    prefix?: string;
    attribute?: boolean;
    wrapped?: boolean;
  };
  externalDocs?: ExternalDocumentation;
  example?: any;
  deprecated?: boolean;
  nullable?: boolean;
}

export interface Components {
  schemas?: Record<string, Schema>;
  responses?: Record<string, ResponseItem>;
  parameters?: Record<string, Parameter>;
  examples?: Record<string, Example>;
  requestBodies?: Record<string, RequestBody>;
  headers?: Record<string, Header>;
  securitySchemes?: Record<string, SecurityScheme>;
  links?: Record<string, Link>;
  callbacks?: Record<string, Record<string, PathItem>>;
}

export interface SecurityScheme {
  $ref?: string;
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: {
    implicit?: OAuthFlow;
    password?: OAuthFlow;
    clientCredentials?: OAuthFlow;
    authorizationCode?: OAuthFlow;
  };
  openIdConnectUrl?: string;
}

export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes?: Record<string, string>;
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
