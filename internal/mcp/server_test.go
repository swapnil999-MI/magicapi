package mcp_test

import (
	"encoding/json"
	"testing"

	"openapi-doc-studio/internal/mcp"
	"openapi-doc-studio/internal/spec"
)

func TestMCPServerProtocol(t *testing.T) {
	specPath := "/Users/swapnil/Desktop/PayLogic/git push folder/Paylogic-Backend-V2.1/docs/openapi.yaml"
	loader, err := spec.NewLoader(specPath, nil)
	if err != nil {
		t.Fatalf("Failed to load spec: %v", err)
	}

	indexer := spec.NewIndexer(loader.GetSpec())
	server := mcp.NewServer(loader, indexer)

	// 1. Test Initialize
	id := json.RawMessage(`"1"`)
	initReq := &mcp.JSONRPCMessage{
		JSONRPC: "2.0",
		ID:      &id,
		Method:  "initialize",
	}

	initResp := server.HandleMessage(initReq)
	if initResp == nil || initResp.Error != nil {
		t.Fatalf("Expected valid initialize response, got: %v", initResp)
	}

	// 2. Test Tools List
	id2 := json.RawMessage(`"2"`)
	toolsReq := &mcp.JSONRPCMessage{
		JSONRPC: "2.0",
		ID:      &id2,
		Method:  "tools/list",
	}

	toolsResp := server.HandleMessage(toolsReq)
	if toolsResp == nil || toolsResp.Error != nil {
		t.Fatalf("Expected valid tools/list response, got: %v", toolsResp)
	}

	// 3. Test Tool Call (search_endpoints)
	id3 := json.RawMessage(`"3"`)
	callParams, _ := json.Marshal(map[string]any{
		"name": "search_endpoints",
		"arguments": map[string]any{
			"query": "client",
		},
	})
	callReq := &mcp.JSONRPCMessage{
		JSONRPC: "2.0",
		ID:      &id3,
		Method:  "tools/call",
		Params:  callParams,
	}

	callResp := server.HandleMessage(callReq)
	if callResp == nil || callResp.Error != nil {
		t.Fatalf("Expected valid tools/call response, got: %v", callResp)
	}
}
