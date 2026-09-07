package generator_test

import (
	"strings"
	"testing"

	"openapi-doc-studio/internal/generator"
	"openapi-doc-studio/internal/spec"
)

func TestGeneratorsWithRealSpec(t *testing.T) {
	specPath := "/Users/swapnil/Desktop/PayLogic/git push folder/Paylogic-Backend-V2.1/docs/openapi.yaml"
	loader, err := spec.NewLoader(specPath, nil)
	if err != nil {
		t.Fatalf("Failed to load real OpenAPI spec: %v", err)
	}

	indexer := spec.NewIndexer(loader.GetSpec())
	tsGen := generator.NewTSGenerator(loader)
	zodGen := generator.NewZodGenerator(loader)
	clientGen := generator.NewClientCodeGenerator(tsGen)
	queryKeyGen := generator.NewQueryKeyGenerator(indexer)

	// Test TS Type Generation
	results := indexer.Search("gateway", "", "", 5)
	if len(results) == 0 {
		t.Fatalf("No endpoints found for testing")
	}

	testEp := &results[0]
	tsTypes := tsGen.GenerateEndpointTypes(testEp)
	if !strings.Contains(tsTypes, "export") {
		t.Errorf("Expected generated TS types to contain 'export', got: %s", tsTypes)
	}

	// Test React Query Hook Generation
	rqCode := clientGen.Generate(testEp, "react-query")
	if !strings.Contains(rqCode, "@tanstack/react-query") {
		t.Errorf("Expected React Query hook to import @tanstack/react-query, got: %s", rqCode)
	}

	// Test Zod Schema Generation
	zodCode := zodGen.GenerateEndpointZod(testEp)
	if zodCode == "" {
		t.Errorf("Expected zod code to not be empty")
	}

	// Test Query Key Factory
	qkCode := queryKeyGen.GenerateQueryKeyFactory("")
	if !strings.Contains(qkCode, "export const") {
		t.Errorf("Expected query key factory code to contain exports, got: %s", qkCode)
	}
}
