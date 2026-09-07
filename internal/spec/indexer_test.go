package spec_test

import (
	"testing"

	"openapi-doc-studio/internal/spec"
)

func TestLoaderAndIndexer(t *testing.T) {
	specPath := "/Users/swapnil/Desktop/PayLogic/git push folder/Paylogic-Backend-V2.1/docs/openapi.yaml"
	loader, err := spec.NewLoader(specPath, nil)
	if err != nil {
		t.Fatalf("Failed to load real OpenAPI spec: %v", err)
	}

	openSpec := loader.GetSpec()
	if openSpec == nil {
		t.Fatalf("Loaded spec is nil")
	}

	if len(openSpec.Paths) == 0 {
		t.Fatalf("Spec should contain paths, got 0")
	}

	indexer := spec.NewIndexer(openSpec)

	// Test Search
	results := indexer.Search("gateway", "", "", 10)
	if len(results) == 0 {
		t.Errorf("Expected search results for 'gateway', got 0")
	}

	// Test FindEndpoint
	found := false
	for _, ep := range results {
		if epFound, ok := indexer.FindEndpoint(ep.Path, ep.Method); ok {
			if epFound.Path == ep.Path {
				found = true
				break
			}
		}
	}
	if !found {
		t.Errorf("Expected FindEndpoint to find indexed route")
	}

	// Test Categories
	categories := indexer.GetCategories()
	if len(categories) == 0 {
		t.Errorf("Expected categories to be loaded, got 0")
	}
}
