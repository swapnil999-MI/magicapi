package generator

import (
	"fmt"
	"strings"
	"time"

	"openapi-doc-studio/internal/spec"
)

type MockGenerator struct {
	loader *spec.Loader
}

func NewMockGenerator(loader *spec.Loader) *MockGenerator {
	return &MockGenerator{loader: loader}
}

func (mg *MockGenerator) GenerateResponseMock(ep *spec.IndexedEndpoint, statusCode string) any {
	if ep == nil || ep.Operation == nil {
		return map[string]any{"error": "Endpoint not found"}
	}

	targetCode := statusCode
	if targetCode == "" {
		if _, ok := ep.Operation.Responses["200"]; ok {
			targetCode = "200"
		} else if _, ok := ep.Operation.Responses["201"]; ok {
			targetCode = "201"
		} else {
			for c := range ep.Operation.Responses {
				targetCode = c
				break
			}
		}
	}

	resp, ok := ep.Operation.Responses[targetCode]
	if !ok {
		return map[string]any{"message": fmt.Sprintf("Response code %s not documented", targetCode)}
	}

	for _, media := range resp.Content {
		if media.Example != nil {
			return media.Example
		}
		if media.Schema != nil {
			return mg.generateValueFromSchema(media.Schema, 0)
		}
	}

	return map[string]any{"status": "success", "code": targetCode}
}

func (mg *MockGenerator) generateValueFromSchema(s *spec.Schema, depth int) any {
	if s == nil || depth > 5 {
		return nil
	}

	resolved := mg.loader.ResolveSchema(s)
	if resolved == nil {
		return nil
	}

	if resolved.Example != nil {
		return resolved.Example
	}

	if len(resolved.Enum) > 0 {
		return resolved.Enum[0]
	}

	if len(resolved.OneOf) > 0 {
		return mg.generateValueFromSchema(resolved.OneOf[0], depth+1)
	}

	if len(resolved.AnyOf) > 0 {
		return mg.generateValueFromSchema(resolved.AnyOf[0], depth+1)
	}

	switch resolved.Type {
	case "string":
		if resolved.Format == "date-time" {
			return time.Now().UTC().Format(time.RFC3339)
		}
		if resolved.Format == "email" {
			return "developer@magicapi.dev"
		}
		if resolved.Format == "uuid" {
			return "550e8400-e29b-41d4-a716-446655440000"
		}
		return "sample_string"

	case "integer":
		if resolved.Default != nil {
			return resolved.Default
		}
		return 1001

	case "number":
		if resolved.Default != nil {
			return resolved.Default
		}
		return 99.50

	case "boolean":
		if resolved.Default != nil {
			return resolved.Default
		}
		return true

	case "array":
		if resolved.Items != nil {
			return []any{mg.generateValueFromSchema(resolved.Items, depth+1)}
		}
		return []any{}

	case "object":
		result := make(map[string]any)
		for k, prop := range resolved.Properties {
			result[k] = mg.generateFieldMock(k, prop, depth+1)
		}
		return result

	default:
		if len(resolved.Properties) > 0 {
			result := make(map[string]any)
			for k, prop := range resolved.Properties {
				result[k] = mg.generateFieldMock(k, prop, depth+1)
			}
			return result
		}
		return "mock_data"
	}
}

func (mg *MockGenerator) generateFieldMock(fieldName string, s *spec.Schema, depth int) any {
	if s.Example != nil {
		return s.Example
	}
	if s.Default != nil {
		return s.Default
	}
	if len(s.Enum) > 0 {
		return s.Enum[0]
	}

	lower := strings.ToLower(fieldName)
	switch {
	case strings.Contains(lower, "email"):
		return "client_test@magicapi.dev"
	case strings.Contains(lower, "phone") || strings.Contains(lower, "mobile"):
		return "+919876543210"
	case strings.Contains(lower, "mid"):
		return 100021
	case strings.Contains(lower, "client_id") || strings.Contains(lower, "clientid"):
		return 501
	case strings.Contains(lower, "amount"):
		return 50000.00
	case strings.Contains(lower, "currency"):
		return "INR"
	case strings.Contains(lower, "status"):
		return "ACTIVE"
	case strings.Contains(lower, "gateway"):
		return "CASHFREE"
	case strings.Contains(lower, "service"):
		return "PAYIN"
	case strings.Contains(lower, "created_at") || strings.Contains(lower, "updated_at"):
		return time.Now().UTC().Format(time.RFC3339)
	case strings.Contains(lower, "token") || strings.Contains(lower, "secret") || strings.Contains(lower, "key"):
		return "magic_sec_test_99281726354"
	case strings.Contains(lower, "url"):
		return "https://api.magicapi.dev/webhook/callback"
	default:
		return mg.generateValueFromSchema(s, depth)
	}
}
