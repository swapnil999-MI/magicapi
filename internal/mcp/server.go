package mcp

import (
	"encoding/json"
	"fmt"
	"log"

	"openapi-doc-studio/internal/spec"
)

type Server struct {
	loader    *spec.Loader
	indexer   *spec.Indexer
	tools     *ToolRegistry
	resources *ResourceRegistry
	prompts   *PromptRegistry
}

func NewServer(loader *spec.Loader, indexer *spec.Indexer) *Server {
	return &Server{
		loader:    loader,
		indexer:   indexer,
		tools:     NewToolRegistry(loader, indexer),
		resources: NewResourceRegistry(loader, indexer),
		prompts:   NewPromptRegistry(),
	}
}

func (s *Server) HandleMessage(req *JSONRPCMessage) *JSONRPCMessage {
	if req == nil {
		return nil
	}

	// Notifications (no ID)
	if req.ID == nil {
		s.handleNotification(req)
		return nil
	}

	res := &JSONRPCMessage{
		JSONRPC: "2.0",
		ID:      req.ID,
	}

	switch req.Method {
	case "initialize":
		res.Result = InitializeResult{
			ProtocolVersion: "2024-11-05",
			Capabilities: ServerCapabilities{
				Tools:     &ToolCapability{ListChanged: true},
				Resources: &ResourceCapability{Subscribe: false, ListChanged: true},
				Prompts:   &PromptCapability{ListChanged: true},
			},
			ServerInfo: ServerInfo{
				Name:    "magicapi-mcp-server",
				Version: "1.0.0",
			},
		}

	case "ping":
		res.Result = map[string]any{"status": "pong"}

	case "tools/list":
		res.Result = map[string]any{
			"tools": s.tools.ListTools(),
		}

	case "tools/call":
		var params ToolCallParams
		if err := json.Unmarshal(req.Params, &params); err != nil {
			res.Error = &JSONRPCError{Code: InvalidParams, Message: fmt.Sprintf("Invalid tools/call params: %v", err)}
			return res
		}
		toolRes, err := s.tools.ExecuteTool(params.Name, params.Arguments)
		if err != nil {
			res.Error = &JSONRPCError{Code: InternalError, Message: err.Error()}
			return res
		}
		res.Result = toolRes

	case "resources/list":
		res.Result = map[string]any{
			"resources": s.resources.ListResources(),
		}

	case "resources/read":
		var params ResourceReadParams
		if err := json.Unmarshal(req.Params, &params); err != nil {
			res.Error = &JSONRPCError{Code: InvalidParams, Message: fmt.Sprintf("Invalid resources/read params: %v", err)}
			return res
		}
		readRes, err := s.resources.ReadResource(params.URI)
		if err != nil {
			res.Error = &JSONRPCError{Code: InvalidParams, Message: err.Error()}
			return res
		}
		res.Result = readRes

	case "prompts/list":
		res.Result = map[string]any{
			"prompts": s.prompts.ListPrompts(),
		}

	case "prompts/get":
		var params struct {
			Name      string            `json:"name"`
			Arguments map[string]string `json:"arguments"`
		}
		if err := json.Unmarshal(req.Params, &params); err != nil {
			res.Error = &JSONRPCError{Code: InvalidParams, Message: fmt.Sprintf("Invalid prompts/get params: %v", err)}
			return res
		}
		promptText, err := s.prompts.GetPrompt(params.Name, params.Arguments)
		if err != nil {
			res.Error = &JSONRPCError{Code: InvalidParams, Message: err.Error()}
			return res
		}
		res.Result = map[string]any{
			"description": params.Name,
			"messages": []map[string]any{
				{
					"role": "user",
					"content": map[string]any{
						"type": "text",
						"text": promptText,
					},
				},
			},
		}

	default:
		res.Error = &JSONRPCError{
			Code:    MethodNotFound,
			Message: fmt.Sprintf("Method '%s' not found", req.Method),
		}
	}

	return res
}

func (s *Server) handleNotification(req *JSONRPCMessage) {
	switch req.Method {
	case "notifications/initialized":
		log.Printf("MCP client successfully initialized handshake")
	default:
		log.Printf("Received unhandled notification: %s", req.Method)
	}
}
