package main

import (
	"embed"
	"io/fs"
	"log"

	"openapi-doc-studio/internal/config"
	"openapi-doc-studio/internal/mcp"
	"openapi-doc-studio/internal/spec"
	"openapi-doc-studio/internal/transport"
)

// Embed React production bundle into Go binary
//
//go:embed all:dist
var distFS embed.FS

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
		// Extract sub-filesystem for embedded React client panel
		distSub, err := fs.Sub(distFS, "dist")
		if err != nil {
			log.Printf("⚠️ Warning: Failed to extract dist filesystem: %v", err)
		}

		srv := transport.NewUnifiedServer(cfg, mcpServer, loader, distSub)
		if err := srv.Start(); err != nil {
			log.Fatalf("Unified server error: %v", err)
		}
	}
}
