package mcp

import (
	"encoding/json"
	"fmt"
	"strings"

	"openapi-doc-studio/internal/generator"
	"openapi-doc-studio/internal/spec"
)

type ToolHandler func(args map[string]any) (*ToolCallResult, error)

type ToolRegistry struct {
	tools       []Tool
	handlers    map[string]ToolHandler
	loader      *spec.Loader
	indexer     *spec.Indexer
	analyzer    *spec.DynamicAnalyzer
	tsGen       *generator.TSGenerator
	zodGen      *generator.ZodGenerator
	clientGen   *generator.ClientCodeGenerator
	queryKeyGen *generator.QueryKeyGenerator
	pageGen     *generator.PaginationGenerator
	mediaGen    *generator.MediaGenerator
	mockGen     *generator.MockGenerator
	errAuthGen  *generator.ErrorAuthGenerator
}

func NewToolRegistry(loader *spec.Loader, indexer *spec.Indexer) *ToolRegistry {
	analyzer := spec.NewDynamicAnalyzer(loader)
	tsGen := generator.NewTSGenerator(loader)
	zodGen := generator.NewZodGenerator(loader)
	clientGen := generator.NewClientCodeGenerator(tsGen)
	queryKeyGen := generator.NewQueryKeyGenerator(indexer)
	pageGen := generator.NewPaginationGenerator(tsGen)
	mediaGen := generator.NewMediaGenerator()
	mockGen := generator.NewMockGenerator(loader)
	errAuthGen := generator.NewErrorAuthGenerator()

	tr := &ToolRegistry{
		tools:       make([]Tool, 0),
		handlers:    make(map[string]ToolHandler),
		loader:      loader,
		indexer:     indexer,
		analyzer:    analyzer,
		tsGen:       tsGen,
		zodGen:      zodGen,
		clientGen:   clientGen,
		queryKeyGen: queryKeyGen,
		pageGen:     pageGen,
		mediaGen:    mediaGen,
		mockGen:     mockGen,
		errAuthGen:  errAuthGen,
	}

	tr.registerTools()
	return tr
}

func (tr *ToolRegistry) ListTools() []Tool {
	return tr.tools
}

func (tr *ToolRegistry) ExecuteTool(name string, args map[string]any) (*ToolCallResult, error) {
	handler, ok := tr.handlers[name]
	if !ok {
		return &ToolCallResult{
			Content: []ContentItem{{Type: "text", Text: fmt.Sprintf("Tool '%s' not found", name)}},
			IsError: true,
		}, nil
	}
	return handler(args)
}

func (tr *ToolRegistry) register(tool Tool, handler ToolHandler) {
	tr.tools = append(tr.tools, tool)
	tr.handlers[tool.Name] = handler
}

func (tr *ToolRegistry) registerTools() {
	// 1. search_endpoints
	tr.register(Tool{
		Name:        "search_endpoints",
		Description: "Search API endpoints by keyword, feature, path, tag, or HTTP method across the entire OpenAPI specification.",
		InputSchema: ToolSchema{
			Type: "object",
			Properties: map[string]PropertyDef{
				"query":  {Type: "string", Description: "Search query (e.g., 'gateway assignment', 'payin report', 'client profile')"},
				"tag":    {Type: "string", Description: "Optional category/tag filter (e.g., 'Admin Reports', 'Client Auth')"},
				"method": {Type: "string", Description: "Optional HTTP method filter (GET, POST, PUT, DELETE, PATCH)"},
			},
		},
	}, tr.handleSearchEndpoints)

	// 2. get_endpoint_details
	tr.register(Tool{
		Name:        "get_endpoint_details",
		Description: "Get complete details, request body schema, path/query parameters, response models, and security requirements for an API endpoint.",
		InputSchema: ToolSchema{
			Type: "object",
			Properties: map[string]PropertyDef{
				"path":   {Type: "string", Description: "The API route path (e.g. '/admin/clients/{client_id}/gateway-assignment')"},
				"method": {Type: "string", Description: "HTTP method (GET, POST, PUT, DELETE, PATCH)"},
			},
			Required: []string{"path"},
		},
	}, tr.handleGetEndpointDetails)

	// 3. list_api_categories
	tr.register(Tool{
		Name:        "list_api_categories",
		Description: "Lists all available API categories, tags, and summary descriptions in the system.",
		InputSchema: ToolSchema{
			Type:       "object",
			Properties: map[string]PropertyDef{},
		},
	}, tr.handleListCategories)

	// 4. get_schema_types
	tr.register(Tool{
		Name:        "get_schema_types",
		Description: "Generates strict, production-ready TypeScript interfaces, types, enums, and JSDoc comments for an endpoint or schema model.",
		InputSchema: ToolSchema{
			Type: "object",
			Properties: map[string]PropertyDef{
				"path":        {Type: "string", Description: "API route path to generate all request/response types for"},
				"method":      {Type: "string", Description: "HTTP method (if path provided)"},
				"schema_name": {Type: "string", Description: "Or specific model name from components.schemas"},
			},
		},
	}, tr.handleGetSchemaTypes)

	// 5. get_variant_schema
	tr.register(Tool{
		Name:        "get_variant_schema",
		Description: "Inspects conditional, dynamic, or polymorphic JSON schemas (e.g., when gateway_type=CASHFREE vs RAZORPAY, or service_type=PAYIN).",
		InputSchema: ToolSchema{
			Type: "object",
			Properties: map[string]PropertyDef{
				"path":                {Type: "string", Description: "API route path"},
				"method":              {Type: "string", Description: "HTTP method (default: POST)"},
				"discriminator_field": {Type: "string", Description: "The field driving the conditional structure (e.g., 'gateway_type')"},
				"variant_value":       {Type: "string", Description: "The value selected (e.g., 'CASHFREE', 'RAZORPAY', 'PAYIN')"},
			},
			Required: []string{"path", "discriminator_field", "variant_value"},
		},
	}, tr.handleGetVariantSchema)

	// 6. get_field_dependencies
	tr.register(Tool{
		Name:        "get_field_dependencies",
		Description: "Returns dynamic form field dependencies and visibility maps (tells frontend AI which UI fields to show/hide when a user changes a dropdown).",
		InputSchema: ToolSchema{
			Type: "object",
			Properties: map[string]PropertyDef{
				"path":   {Type: "string", Description: "API route path (e.g., '/admin/clients/gateway-assignment')"},
				"method": {Type: "string", Description: "HTTP method (default: POST)"},
			},
			Required: []string{"path"},
		},
	}, tr.handleGetFieldDependencies)

	// 7. generate_client_code
	tr.register(Tool{
		Name:        "generate_client_code",
		Description: "Generates complete frontend integration hooks & clients (TanStack React Query v5, SWR, Axios, Fetch, or Next.js Server Actions).",
		InputSchema: ToolSchema{
			Type: "object",
			Properties: map[string]PropertyDef{
				"path":      {Type: "string", Description: "API route path"},
				"method":    {Type: "string", Description: "HTTP method (GET, POST, PUT, DELETE)"},
				"framework": {Type: "string", Description: "Target framework: 'react-query' (default), 'swr', 'axios', 'fetch', or 'server-action'", Enum: []string{"react-query", "swr", "axios", "fetch", "server-action"}},
			},
			Required: []string{"path"},
		},
	}, tr.handleGenerateClientCode)

	// 8. generate_query_keys
	tr.register(Tool{
		Name:        "generate_query_keys",
		Description: "Generates a centralized, type-safe Query Key Factory for TanStack React Query to prevent cache invalidation bugs.",
		InputSchema: ToolSchema{
			Type: "object",
			Properties: map[string]PropertyDef{
				"tag": {Type: "string", Description: "Optional tag name to generate query keys for a specific module"},
			},
		},
	}, tr.handleGenerateQueryKeys)

	// 9. generate_form_integration
	tr.register(Tool{
		Name:        "generate_form_integration",
		Description: "Generates Zod validation schemas and React Hook Form bindings from OpenAPI request schemas.",
		InputSchema: ToolSchema{
			Type: "object",
			Properties: map[string]PropertyDef{
				"path":   {Type: "string", Description: "API route path"},
				"method": {Type: "string", Description: "HTTP method (default: POST)"},
			},
			Required: []string{"path"},
		},
	}, tr.handleGenerateFormIntegration)

	// 10. generate_pagination_hook
	tr.register(Tool{
		Name:        "generate_pagination_hook",
		Description: "Generates paginated and infinite scroll data fetching logic (supports cursor-based and page/limit-based tables).",
		InputSchema: ToolSchema{
			Type: "object",
			Properties: map[string]PropertyDef{
				"path":   {Type: "string", Description: "API route path"},
				"method": {Type: "string", Description: "HTTP method (default: GET)"},
			},
			Required: []string{"path"},
		},
	}, tr.handleGeneratePaginationHook)

	// 11. generate_media_integration
	tr.register(Tool{
		Name:        "generate_media_integration",
		Description: "Generates Multipart FormData uploaders with upload progress or Blob CSV/PDF file download streaming handlers.",
		InputSchema: ToolSchema{
			Type: "object",
			Properties: map[string]PropertyDef{
				"path":   {Type: "string", Description: "API route path"},
				"method": {Type: "string", Description: "HTTP method"},
			},
			Required: []string{"path"},
		},
	}, tr.handleGenerateMediaIntegration)

	// 12. get_error_matrix
	tr.register(Tool{
		Name:        "get_error_matrix",
		Description: "Returns HTTP status codes, error schemas, and ready-to-use UI toast notification error binders.",
		InputSchema: ToolSchema{
			Type: "object",
			Properties: map[string]PropertyDef{
				"path":   {Type: "string", Description: "API route path"},
				"method": {Type: "string", Description: "HTTP method"},
			},
			Required: []string{"path"},
		},
	}, tr.handleGetErrorMatrix)

	// 13. get_auth_config
	tr.register(Tool{
		Name:        "get_auth_config",
		Description: "Returns authentication token headers, permission requirements, and Axios/Fetch interceptor setup.",
		InputSchema: ToolSchema{
			Type: "object",
			Properties: map[string]PropertyDef{
				"path":   {Type: "string", Description: "API route path"},
				"method": {Type: "string", Description: "HTTP method"},
			},
			Required: []string{"path"},
		},
	}, tr.handleGetAuthConfig)

	// 14. get_mock_data
	tr.register(Tool{
		Name:        "get_mock_data",
		Description: "Generates realistic, schema-compliant mock JSON responses for rapid frontend UI development.",
		InputSchema: ToolSchema{
			Type: "object",
			Properties: map[string]PropertyDef{
				"path":        {Type: "string", Description: "API route path"},
				"method":      {Type: "string", Description: "HTTP method (default: GET)"},
				"status_code": {Type: "string", Description: "Response status code to mock (e.g. '200', '201', '400')"},
			},
			Required: []string{"path"},
		},
	}, tr.handleGetMockData)

	// 15. validate_payload
	tr.register(Tool{
		Name:        "validate_payload",
		Description: "Validates a sample JSON request payload against the OpenAPI schema and reports missing or invalid fields.",
		InputSchema: ToolSchema{
			Type: "object",
			Properties: map[string]PropertyDef{
				"path":         {Type: "string", Description: "API route path"},
				"method":       {Type: "string", Description: "HTTP method (default: POST)"},
				"payload_json": {Type: "string", Description: "JSON string of the payload to test"},
			},
			Required: []string{"path", "payload_json"},
		},
	}, tr.handleValidatePayload)
}

// Handlers implementation

func (tr *ToolRegistry) handleSearchEndpoints(args map[string]any) (*ToolCallResult, error) {
	q, _ := args["query"].(string)
	t, _ := args["tag"].(string)
	m, _ := args["method"].(string)

	results := tr.indexer.Search(q, t, m, 20)
	if len(results) == 0 {
		return textResult(fmt.Sprintf("No endpoints found matching query='%s', tag='%s', method='%s'", q, t, m)), nil
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("### Found %d Matching Endpoints:\n\n", len(results)))
	sb.WriteString("| Method | Endpoint Path | Summary | Tags |\n|---|---|---|---|\n")

	for _, ep := range results {
		tagsStr := strings.Join(ep.Tags, ", ")
		summary := ep.Summary
		if summary == "" {
			summary = ep.Description
		}
		if len(summary) > 60 {
			summary = summary[:57] + "..."
		}
		sb.WriteString(fmt.Sprintf("| `%s` | `%s` | %s | %s |\n", ep.Method, ep.Path, summary, tagsStr))
	}

	sb.WriteString("\n*Use `get_endpoint_details(path, method)` or `generate_client_code(path, method)` for full integration code.*")
	return textResult(sb.String()), nil
}

func (tr *ToolRegistry) handleGetEndpointDetails(args map[string]any) (*ToolCallResult, error) {
	p, _ := args["path"].(string)
	m, _ := args["method"].(string)

	ep, ok := tr.indexer.FindEndpoint(p, m)
	if !ok {
		return errorResult(fmt.Sprintf("Endpoint '%s %s' not found in OpenAPI spec", m, p)), nil
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("# %s %s\n\n", ep.Method, ep.Path))
	if ep.Summary != "" {
		sb.WriteString(fmt.Sprintf("**Summary**: %s\n\n", ep.Summary))
	}
	if ep.Description != "" {
		sb.WriteString(fmt.Sprintf("**Description**: %s\n\n", ep.Description))
	}
	if len(ep.Tags) > 0 {
		sb.WriteString(fmt.Sprintf("**Category/Tags**: `%s`\n\n", strings.Join(ep.Tags, "`, `")))
	}

	// Parameters
	if len(ep.Operation.Parameters) > 0 {
		sb.WriteString("### Parameters\n| Name | In | Required | Type | Description |\n|---|---|---|---|---|\n")
		for _, param := range ep.Operation.Parameters {
			pType := "string"
			if param.Schema != nil {
				pType = param.Schema.Type
			}
			req := "Optional"
			if param.Required {
				req = "**Required**"
			}
			sb.WriteString(fmt.Sprintf("| `%s` | %s | %s | `%s` | %s |\n", param.Name, param.In, req, pType, param.Description))
		}
		sb.WriteString("\n")
	}

	// Request Body
	if ep.Operation.RequestBody != nil {
		sb.WriteString("### Request Body\n")
		for contentType, media := range ep.Operation.RequestBody.Content {
			sb.WriteString(fmt.Sprintf("- **Content-Type**: `%s` (Required: %v)\n\n", contentType, ep.Operation.RequestBody.Required))
			if media.Schema != nil {
				tsSnippet := tr.tsGen.GenerateSchemaTypes("RequestBody", media.Schema)
				sb.WriteString("```typescript\n" + tsSnippet + "\n```\n")
			}
		}
	}

	// Responses
	if len(ep.Operation.Responses) > 0 {
		sb.WriteString("### Responses\n")
		for code, resp := range ep.Operation.Responses {
			sb.WriteString(fmt.Sprintf("#### Status `%s` - %s\n", code, resp.Description))
			for contentType, media := range resp.Content {
				if media.Schema != nil {
					tsSnippet := tr.tsGen.GenerateSchemaTypes("Response_"+code, media.Schema)
					sb.WriteString(fmt.Sprintf("- Content-Type: `%s`\n```typescript\n%s\n```\n", contentType, tsSnippet))
				}
			}
		}
	}

	return textResult(sb.String()), nil
}

func (tr *ToolRegistry) handleListCategories(args map[string]any) (*ToolCallResult, error) {
	categories := tr.indexer.GetCategories()
	var sb strings.Builder
	sb.WriteString("### API Categories & Modules in MagicAPI Specification\n\n")
	sb.WriteString("| Category / Tag | Description | Endpoints Count |\n|---|---|---|\n")

	for _, c := range categories {
		eps := tr.indexer.Search("", c.Name, "", 200)
		sb.WriteString(fmt.Sprintf("| **%s** | %s | %d endpoints |\n", c.Name, c.Description, len(eps)))
	}

	return textResult(sb.String()), nil
}

func (tr *ToolRegistry) handleGetSchemaTypes(args map[string]any) (*ToolCallResult, error) {
	path, _ := args["path"].(string)
	method, _ := args["method"].(string)
	schemaName, _ := args["schema_name"].(string)

	if schemaName != "" {
		s, ok := tr.indexer.GetSchema(schemaName)
		if !ok {
			return errorResult(fmt.Sprintf("Schema '%s' not found in components.schemas", schemaName)), nil
		}
		tsCode := tr.tsGen.GenerateSchemaTypes(schemaName, s)
		return textResult("```typescript\n" + tsCode + "\n```"), nil
	}

	if path != "" {
		ep, ok := tr.indexer.FindEndpoint(path, method)
		if !ok {
			return errorResult(fmt.Sprintf("Endpoint '%s %s' not found", method, path)), nil
		}
		tsCode := tr.tsGen.GenerateEndpointTypes(ep)
		return textResult("```typescript\n" + tsCode + "\n```"), nil
	}

	return errorResult("Please provide either 'schema_name' or 'path' argument"), nil
}

func (tr *ToolRegistry) handleGetVariantSchema(args map[string]any) (*ToolCallResult, error) {
	path, _ := args["path"].(string)
	method, _ := args["method"].(string)
	field, _ := args["discriminator_field"].(string)
	val, _ := args["variant_value"].(string)

	ep, ok := tr.indexer.FindEndpoint(path, method)
	if !ok {
		return errorResult(fmt.Sprintf("Endpoint '%s %s' not found", method, path)), nil
	}

	schema, example, err := tr.analyzer.ExtractVariantSchema(ep, field, val)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed to resolve variant: %v", err)), nil
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("## Variant Schema for `%s = %s` on `%s %s`\n\n", field, val, ep.Method, ep.Path))
	sb.WriteString("```typescript\n")
	sb.WriteString(tr.tsGen.GenerateSchemaTypes(val+"Config", schema))
	sb.WriteString("\n```\n\n")

	if example != nil {
		exJSON, _ := json.MarshalIndent(example, "", "  ")
		sb.WriteString("### Example Payload:\n```json\n" + string(exJSON) + "\n```\n")
	}

	return textResult(sb.String()), nil
}

func (tr *ToolRegistry) handleGetFieldDependencies(args map[string]any) (*ToolCallResult, error) {
	path, _ := args["path"].(string)
	method, _ := args["method"].(string)

	ep, ok := tr.indexer.FindEndpoint(path, method)
	if !ok {
		return errorResult(fmt.Sprintf("Endpoint '%s %s' not found", method, path)), nil
	}

	deps := tr.analyzer.AnalyzeEndpointDependencies(ep)
	if len(deps) == 0 {
		return textResult(fmt.Sprintf("Endpoint `%s %s` has no dynamic or conditional fields.", ep.Method, ep.Path)), nil
	}

	depJSON, _ := json.MarshalIndent(deps, "", "  ")
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("## Dynamic Form Field Dependency Matrix for `%s %s`\n\n", ep.Method, ep.Path))
	sb.WriteString("```json\n" + string(depJSON) + "\n```\n\n")
	sb.WriteString("### UI Implementation Guide:\n")
	sb.WriteString("1. Bind the trigger field (e.g. `gateway_type`) to your dropdown/select component.\n")
	sb.WriteString("2. When value changes, render only the fields listed in `visible_fields`.\n")
	sb.WriteString("3. Ensure `required_fields` are marked mandatory before form submission.")

	return textResult(sb.String()), nil
}

func (tr *ToolRegistry) handleGenerateClientCode(args map[string]any) (*ToolCallResult, error) {
	path, _ := args["path"].(string)
	method, _ := args["method"].(string)
	fw, _ := args["framework"].(string)

	ep, ok := tr.indexer.FindEndpoint(path, method)
	if !ok {
		return errorResult(fmt.Sprintf("Endpoint '%s %s' not found", method, path)), nil
	}

	code := tr.clientGen.Generate(ep, fw)
	return textResult("```typescript\n" + code + "\n```"), nil
}

func (tr *ToolRegistry) handleGenerateQueryKeys(args map[string]any) (*ToolCallResult, error) {
	tag, _ := args["tag"].(string)
	keysCode := tr.queryKeyGen.GenerateQueryKeyFactory(tag)
	return textResult("```typescript\n" + keysCode + "\n```"), nil
}

func (tr *ToolRegistry) handleGenerateFormIntegration(args map[string]any) (*ToolCallResult, error) {
	path, _ := args["path"].(string)
	method, _ := args["method"].(string)

	ep, ok := tr.indexer.FindEndpoint(path, method)
	if !ok {
		return errorResult(fmt.Sprintf("Endpoint '%s %s' not found", method, path)), nil
	}

	zodCode := tr.zodGen.GenerateEndpointZod(ep)
	return textResult("```typescript\n" + zodCode + "\n```"), nil
}

func (tr *ToolRegistry) handleGeneratePaginationHook(args map[string]any) (*ToolCallResult, error) {
	path, _ := args["path"].(string)
	method, _ := args["method"].(string)

	ep, ok := tr.indexer.FindEndpoint(path, method)
	if !ok {
		return errorResult(fmt.Sprintf("Endpoint '%s %s' not found", method, path)), nil
	}

	code := tr.pageGen.Generate(ep)
	return textResult("```typescript\n" + code + "\n```"), nil
}

func (tr *ToolRegistry) handleGenerateMediaIntegration(args map[string]any) (*ToolCallResult, error) {
	path, _ := args["path"].(string)
	method, _ := args["method"].(string)

	ep, ok := tr.indexer.FindEndpoint(path, method)
	if !ok {
		return errorResult(fmt.Sprintf("Endpoint '%s %s' not found", method, path)), nil
	}

	code := tr.mediaGen.Generate(ep)
	return textResult("```typescript\n" + code + "\n```"), nil
}

func (tr *ToolRegistry) handleGetErrorMatrix(args map[string]any) (*ToolCallResult, error) {
	path, _ := args["path"].(string)
	method, _ := args["method"].(string)

	ep, ok := tr.indexer.FindEndpoint(path, method)
	if !ok {
		return errorResult(fmt.Sprintf("Endpoint '%s %s' not found", method, path)), nil
	}

	res := tr.errAuthGen.GenerateErrorMatrix(ep)
	return textResult(res), nil
}

func (tr *ToolRegistry) handleGetAuthConfig(args map[string]any) (*ToolCallResult, error) {
	path, _ := args["path"].(string)
	method, _ := args["method"].(string)

	ep, ok := tr.indexer.FindEndpoint(path, method)
	if !ok {
		return errorResult(fmt.Sprintf("Endpoint '%s %s' not found", method, path)), nil
	}

	res := tr.errAuthGen.GenerateAuthConfig(ep, tr.loader.GetSpec())
	return textResult(res), nil
}

func (tr *ToolRegistry) handleGetMockData(args map[string]any) (*ToolCallResult, error) {
	path, _ := args["path"].(string)
	method, _ := args["method"].(string)
	code, _ := args["status_code"].(string)

	ep, ok := tr.indexer.FindEndpoint(path, method)
	if !ok {
		return errorResult(fmt.Sprintf("Endpoint '%s %s' not found", method, path)), nil
	}

	mockObj := tr.mockGen.GenerateResponseMock(ep, code)
	mockJSON, _ := json.MarshalIndent(mockObj, "", "  ")
	return textResult("```json\n" + string(mockJSON) + "\n```"), nil
}

func (tr *ToolRegistry) handleValidatePayload(args map[string]any) (*ToolCallResult, error) {
	path, _ := args["path"].(string)
	method, _ := args["method"].(string)
	payloadStr, _ := args["payload_json"].(string)

	ep, ok := tr.indexer.FindEndpoint(path, method)
	if !ok {
		return errorResult(fmt.Sprintf("Endpoint '%s %s' not found", method, path)), nil
	}

	var payloadMap map[string]any
	if err := json.Unmarshal([]byte(payloadStr), &payloadMap); err != nil {
		return errorResult(fmt.Sprintf("Payload is not valid JSON: %v", err)), nil
	}

	if ep.Operation.RequestBody == nil {
		return textResult("Warning: This endpoint does not define a request body in OpenAPI spec."), nil
	}

	var missingRequired []string
	for _, media := range ep.Operation.RequestBody.Content {
		if media.Schema != nil {
			resolved := tr.loader.ResolveSchema(media.Schema)
			if resolved != nil {
				for _, reqField := range resolved.Required {
					if _, exists := payloadMap[reqField]; !exists {
						missingRequired = append(missingRequired, reqField)
					}
				}
			}
		}
	}

	if len(missingRequired) > 0 {
		return textResult(fmt.Sprintf("❌ Validation Failed: Missing required fields: `%s`", strings.Join(missingRequired, "`, `"))), nil
	}

	return textResult("✅ Validation Passed: All top-level required fields are present in payload!"), nil
}

func textResult(text string) *ToolCallResult {
	return &ToolCallResult{
		Content: []ContentItem{{Type: "text", Text: text}},
		IsError: false,
	}
}

func errorResult(msg string) *ToolCallResult {
	return &ToolCallResult{
		Content: []ContentItem{{Type: "text", Text: "Error: " + msg}},
		IsError: true,
	}
}
