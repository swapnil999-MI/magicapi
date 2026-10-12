package mcp_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"openapi-doc-studio/internal/mcp"
	"openapi-doc-studio/internal/spec"
)

const regressionSpec = `
openapi: 3.0.3
info: {title: Regression, version: "1"}
tags: [{name: Auth}, {name: Client Auth}]
paths:
  /ping:
    get:
      tags: [Auth]
      responses: {"204": {description: No content}}
  /login:
    post:
      tags: [Client Auth]
      parameters:
        - {name: X-Request-Id, in: header, schema: {type: string}}
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                credentials:
                  oneOf:
                    - {title: A, type: object, properties: {gateway_type: {type: string, enum: [CASHFREE]}, app_id: {type: string}}}
                    - {title: B, type: object, properties: {gateway_type: {type: string, default: razorpay}, key_id: {type: string}}}
      responses:
        "200": {description: OK, content: {application/json: {schema: {type: object}}}}
        "201": {description: Created, content: {application/json: {schema: {type: object}}}}
  /items:
    delete:
      requestBody:
        content:
          application/json:
            schema: {type: object, properties: {path: {type: string, pattern: "^/files/[a-z]+$"}}}
      responses:
        "200":
          description: OK
          content:
            application/json:
              schema:
                type: object
                properties:
                  api_keys: {type: array, items: {type: string}}
                  gateway: {type: object, properties: {name: {type: string}}}
                  email: {type: string}
`

func newRegressionServer(t *testing.T) *mcp.Server {
	t.Helper()
	p := filepath.Join(t.TempDir(), "openapi.yaml")
	if err := os.WriteFile(p, []byte(regressionSpec), 0o644); err != nil {
		t.Fatal(err)
	}
	loader, err := spec.NewLoader(p, nil)
	if err != nil {
		t.Fatalf("Failed to load spec: %v", err)
	}
	return mcp.NewServer(loader, spec.NewIndexer(loader.GetSpec()))
}

func callTool(t *testing.T, server *mcp.Server, name string, args map[string]any) string {
	t.Helper()
	params, _ := json.Marshal(mcp.ToolCallParams{Name: name, Arguments: args})
	id := json.RawMessage(`1`)
	resp := server.HandleMessage(&mcp.JSONRPCMessage{JSONRPC: "2.0", ID: &id, Method: "tools/call", Params: params})
	if resp == nil || resp.Error != nil {
		t.Fatalf("tools/call %s failed: %v", name, resp)
	}
	return resp.Result.(*mcp.ToolCallResult).Content[0].Text
}

func TestEndpointTypesWithoutOperationID(t *testing.T) {
	server := newRegressionServer(t)

	out := callTool(t, server, "get_schema_types", map[string]any{"path": "/login", "method": "POST"})
	if strings.Contains(out, "Item") {
		t.Errorf("endpoint without operationId should be named from method+path, got:\n%s", out)
	}
	if !strings.Contains(out, `"X-Request-Id"?: string;`) {
		t.Errorf("hyphenated parameter name should be quoted, got:\n%s", out)
	}
	if n := strings.Count(out, "export type PostLoginResponse ="); n != 1 {
		t.Errorf("expected exactly one PostLoginResponse, got %d:\n%s", n, out)
	}
	if !strings.Contains(out, "export type PostLoginResponse201 =") {
		t.Errorf("expected secondary 201 response type, got:\n%s", out)
	}
}

func TestClientCodeDeclaresReferencedTypes(t *testing.T) {
	server := newRegressionServer(t)

	for _, fw := range []string{"react-query", "swr", "axios", "fetch", "server-action"} {
		out := callTool(t, server, "generate_client_code", map[string]any{"path": "/ping", "method": "GET", "framework": fw})
		for _, typ := range []string{"GetPingParams", "GetPingResponse"} {
			if !strings.Contains(out, "export type "+typ+" =") {
				t.Errorf("%s: %s is not declared:\n%s", fw, typ, out)
			}
		}
	}
}

func TestVariantSchemaMatchesRequestedValue(t *testing.T) {
	server := newRegressionServer(t)

	cases := map[string]string{"RAZORPAY": "key_id", "cashfree": "app_id"}
	for value, wantField := range cases {
		out := callTool(t, server, "get_variant_schema", map[string]any{
			"path": "/login", "method": "POST", "discriminator_field": "gateway_type", "variant_value": value,
		})
		if !strings.Contains(out, wantField) {
			t.Errorf("variant %s should contain %s, got:\n%s", value, wantField, out)
		}
	}
}

func TestCategoryCountsUseExactTags(t *testing.T) {
	server := newRegressionServer(t)

	out := callTool(t, server, "list_api_categories", nil)
	if !strings.Contains(out, "| **Auth** |  | 1 endpoints |") {
		t.Errorf("Auth should count only its own endpoint, got:\n%s", out)
	}
}

func TestDeleteWithBodySendsDataInConfig(t *testing.T) {
	server := newRegressionServer(t)

	out := callTool(t, server, "generate_client_code", map[string]any{"path": "/items", "method": "DELETE"})
	if !strings.Contains(out, "axios.delete<DeleteItemsResponse>(url, { data, params });") {
		t.Errorf("axios.delete must receive the body as config.data, got:\n%s", out)
	}
}

func TestZodRegexEscapesSlashes(t *testing.T) {
	server := newRegressionServer(t)

	out := callTool(t, server, "generate_form_integration", map[string]any{"path": "/items", "method": "DELETE"})
	if !strings.Contains(out, `.regex(/^\/files\/[a-z]+$/,`) {
		t.Errorf("slashes in pattern must be escaped in the regex literal, got:\n%s", out)
	}
}

func TestMockRespectsSchemaTypes(t *testing.T) {
	server := newRegressionServer(t)

	out := callTool(t, server, "get_mock_data", map[string]any{"path": "/items", "method": "DELETE"})
	body := strings.TrimSuffix(strings.TrimPrefix(out, "```json\n"), "\n```")
	var mock struct {
		APIKeys []string       `json:"api_keys"`
		Gateway map[string]any `json:"gateway"`
		Email   string         `json:"email"`
	}
	if err := json.Unmarshal([]byte(body), &mock); err != nil {
		t.Fatalf("mock does not match schema types: %v\n%s", err, out)
	}
	if mock.Email != "client_test@magicapi.dev" {
		t.Errorf("string field should still use the name hint, got %q", mock.Email)
	}
}

func TestToolCountMatchesRegistry(t *testing.T) {
	server := newRegressionServer(t)

	id := json.RawMessage(`1`)
	resp := server.HandleMessage(&mcp.JSONRPCMessage{JSONRPC: "2.0", ID: &id, Method: "tools/list"})
	tools := resp.Result.(map[string]any)["tools"].([]mcp.Tool)
	if server.ToolCount() != len(tools) {
		t.Errorf("ToolCount() = %d, tools/list has %d", server.ToolCount(), len(tools))
	}
}
