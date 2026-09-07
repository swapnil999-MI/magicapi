package main

import (
	"log"

	"openapi-doc-studio/internal/config"
	"openapi-doc-studio/internal/mcp"
	"openapi-doc-studio/internal/spec"
	"openapi-doc-studio/internal/transport"
)

func main() {
	cfg := config.LoadConfig()

	var indexer *spec.Indexer

	loader, err := spec.NewLoader(cfg.SpecPath, func(s *spec.OpenAPISpec) {
		if indexer != nil {
			indexer.Reindex(s)
		}
	})
	if err != nil {
		log.Fatalf("❌ Failed to load OpenAPI specification from '%s': %v", cfg.SpecPath, err)
	}

	indexer = spec.NewIndexer(loader.GetSpec())
	mcpServer := mcp.NewServer(loader, indexer)

	if cfg.Mode == "stdio" {
		st := transport.NewStdioTransport(mcpServer)
		if err := st.Start(); err != nil {
			log.Fatalf("Stdio transport error: %v", err)
		}
	} else {
		srv := transport.NewUnifiedServer(cfg, mcpServer, loader, nil)
		if err := srv.Start(); err != nil {
			log.Fatalf("Network server error: %v", err)
		}
	}
}
