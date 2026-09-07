package mcp

import (
	"encoding/json"
	"fmt"
	"strings"

	"openapi-doc-studio/internal/spec"
)

type ResourceRegistry struct {
	loader  *spec.Loader
	indexer *spec.Indexer
}

func NewResourceRegistry(loader *spec.Loader, indexer *spec.Indexer) *ResourceRegistry {
	return &ResourceRegistry{
		loader:  loader,
		indexer: indexer,
	}
}

func (rr *ResourceRegistry) ListResources() []Resource {
	res := []Resource{
		{
			URI:         "openapi://spec/summary",
			Name:        "OpenAPI Specification Summary",
			Description: "Overview of MagicAPI version, servers, and modules",
			MimeType:    "application/json",
		},
		{
			URI:         "openapi://spec/all-endpoints",
			Name:        "All API Endpoints List",
			Description: "Flat list of all API paths and HTTP methods",
			MimeType:    "application/json",
		},
	}

	for name := range rr.indexer.GetAllSchemas() {
		res = append(res, Resource{
			URI:         fmt.Sprintf("openapi://schemas/%s", name),
			Name:        fmt.Sprintf("Schema: %s", name),
			Description: fmt.Sprintf("OpenAPI schema definition for %s", name),
			MimeType:    "application/json",
		})
	}

	return res
}

func (rr *ResourceRegistry) ReadResource(uri string) (*ResourceReadResult, error) {
	if uri == "openapi://spec/summary" {
		specData := rr.loader.GetSpec()
		summary := map[string]any{
			"title":       specData.Info.Title,
			"version":     specData.Info.Version,
			"description": specData.Info.Description,
			"servers":     specData.Servers,
			"tags":        specData.Tags,
		}
		data, _ := json.MarshalIndent(summary, "", "  ")
		return &ResourceReadResult{
			Contents: []ResourceContent{
				{URI: uri, MimeType: "application/json", Text: string(data)},
			},
		}, nil
	}

	if uri == "openapi://spec/all-endpoints" {
		all := rr.indexer.Search("", "", "", 500)
		data, _ := json.MarshalIndent(all, "", "  ")
		return &ResourceReadResult{
			Contents: []ResourceContent{
				{URI: uri, MimeType: "application/json", Text: string(data)},
			},
		}, nil
	}

	if strings.HasPrefix(uri, "openapi://schemas/") {
		name := strings.TrimPrefix(uri, "openapi://schemas/")
		schema, ok := rr.indexer.GetSchema(name)
		if !ok {
			return nil, fmt.Errorf("schema '%s' not found", name)
		}
		data, _ := json.MarshalIndent(schema, "", "  ")
		return &ResourceReadResult{
			Contents: []ResourceContent{
				{URI: uri, MimeType: "application/json", Text: string(data)},
			},
		}, nil
	}

	return nil, fmt.Errorf("unsupported resource URI: %s", uri)
}
