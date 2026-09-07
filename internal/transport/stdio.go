package transport

import (
	"bufio"
	"encoding/json"
	"io"
	"log"
	"os"

	"openapi-doc-studio/internal/mcp"
)

type StdioTransport struct {
	server *mcp.Server
}

func NewStdioTransport(server *mcp.Server) *StdioTransport {
	return &StdioTransport{server: server}
}

func (st *StdioTransport) Start() error {
	reader := bufio.NewReader(os.Stdin)
	writer := os.Stdout

	log.SetOutput(os.Stderr)
	log.Printf("Starting MagicAPI MCP Server in Stdio mode...")

	for {
		line, err := reader.ReadBytes('\n')
		if err != nil {
			if err == io.EOF {
				return nil
			}
			return err
		}

		if len(line) == 0 || (len(line) == 1 && line[0] == '\n') {
			continue
		}

		var req mcp.JSONRPCMessage
		if err := json.Unmarshal(line, &req); err != nil {
			errResp := &mcp.JSONRPCMessage{
				JSONRPC: "2.0",
				Error:   &mcp.JSONRPCError{Code: mcp.ParseError, Message: "Invalid JSON"},
			}
			data, _ := json.Marshal(errResp)
			writer.Write(append(data, '\n'))
			continue
		}

		resp := st.server.HandleMessage(&req)
		if resp != nil {
			data, err := json.Marshal(resp)
			if err == nil {
				writer.Write(append(data, '\n'))
			}
		}
	}
}
