package generator

import (
	"fmt"
	"strings"

	"openapi-doc-studio/internal/spec"
)

type TSGenerator struct {
	loader *spec.Loader
}

func NewTSGenerator(loader *spec.Loader) *TSGenerator {
	return &TSGenerator{loader: loader}
}

func (g *TSGenerator) GenerateSchemaTypes(name string, s *spec.Schema) string {
	if s == nil {
		return "// Schema not found"
	}

	var sb strings.Builder
	visited := make(map[string]bool)
	g.generateTypeRecursive(&sb, name, s, visited, 0)
	return sb.String()
}

func (g *TSGenerator) GenerateEndpointTypes(ep *spec.IndexedEndpoint) string {
	if ep == nil || ep.Operation == nil {
		return "// Endpoint not found"
	}

	var sb strings.Builder
	baseName := sanitizeIdentifier(ep.OperationID)
	if baseName == "" {
		baseName = sanitizeIdentifier(ep.Method + "_" + strings.ReplaceAll(ep.Path, "/", "_"))
	}

	sb.WriteString(fmt.Sprintf("/**\n * Types for %s %s\n", ep.Method, ep.Path))
	if ep.Summary != "" {
		sb.WriteString(fmt.Sprintf(" * %s\n", ep.Summary))
	}
	sb.WriteString(" */\n\n")

	// 1. Path & Query Parameters Type
	if len(ep.Operation.Parameters) > 0 {
		sb.WriteString(fmt.Sprintf("export interface %sParams {\n", baseName))
		for _, p := range ep.Operation.Parameters {
			optional := "?"
			if p.Required {
				optional = ""
			}
			paramType := "string"
			if p.Schema != nil {
				paramType = g.schemaToTSType(p.Schema, 1)
			}
			if p.Description != "" {
				sb.WriteString(fmt.Sprintf("  /** %s (%s) */\n", p.Description, p.In))
			}
			sb.WriteString(fmt.Sprintf("  %s%s: %s;\n", p.Name, optional, paramType))
		}
		sb.WriteString("}\n\n")
	}

	// 2. Request Body Type
	if ep.Operation.RequestBody != nil {
		for _, media := range ep.Operation.RequestBody.Content {
			if media.Schema != nil {
				resolved := g.loader.ResolveSchema(media.Schema)
				typeName := baseName + "Request"
				sb.WriteString(fmt.Sprintf("export type %s = %s;\n\n", typeName, g.schemaToTSType(resolved, 0)))
				break
			}
		}
	}

	// 3. Response Types
	for code, resp := range ep.Operation.Responses {
		for _, media := range resp.Content {
			if media.Schema != nil {
				resolved := g.loader.ResolveSchema(media.Schema)
				typeName := fmt.Sprintf("%sResponse%s", baseName, code)
				if code == "200" || code == "201" {
					typeName = baseName + "Response"
				}
				sb.WriteString(fmt.Sprintf("export type %s = %s;\n\n", typeName, g.schemaToTSType(resolved, 0)))
				break
			}
		}
	}

	return sb.String()
}

func (g *TSGenerator) generateTypeRecursive(sb *strings.Builder, name string, s *spec.Schema, visited map[string]bool, depth int) {
	if s == nil {
		return
	}

	resolved := g.loader.ResolveSchema(s)
	if resolved == nil {
		return
	}

	if s.Description != "" {
		sb.WriteString(fmt.Sprintf("/**\n * %s\n */\n", s.Description))
	}

	if len(resolved.Enum) > 0 {
		sb.WriteString(fmt.Sprintf("export type %s = ", name))
		var enumVals []string
		for _, e := range resolved.Enum {
			enumVals = append(enumVals, fmt.Sprintf("%q", fmt.Sprintf("%v", e)))
		}
		sb.WriteString(strings.Join(enumVals, " | "))
		sb.WriteString(";\n\n")
		return
	}

	if len(resolved.OneOf) > 0 {
		sb.WriteString(fmt.Sprintf("export type %s = ", name))
		var oneOfTypes []string
		for _, variant := range resolved.OneOf {
			oneOfTypes = append(oneOfTypes, g.schemaToTSType(variant, depth))
		}
		sb.WriteString(strings.Join(oneOfTypes, " | "))
		sb.WriteString(";\n\n")
		return
	}

	if resolved.Type == "object" || len(resolved.Properties) > 0 {
		sb.WriteString(fmt.Sprintf("export interface %s {\n", name))
		reqSet := make(map[string]bool)
		for _, r := range resolved.Required {
			reqSet[r] = true
		}

		for propName, propSchema := range resolved.Properties {
			optional := "?"
			if reqSet[propName] {
				optional = ""
			}
			if propSchema.Description != "" {
				sb.WriteString(fmt.Sprintf("  /** %s */\n", propSchema.Description))
			}
			propType := g.schemaToTSType(propSchema, depth+1)
			sb.WriteString(fmt.Sprintf("  %s%s: %s;\n", propName, optional, propType))
		}
		sb.WriteString("}\n\n")
		return
	}

	sb.WriteString(fmt.Sprintf("export type %s = %s;\n\n", name, g.schemaToTSType(resolved, depth)))
}

func (g *TSGenerator) schemaToTSType(s *spec.Schema, depth int) string {
	if s == nil || depth > 8 {
		return "any"
	}

	if s.Ref != "" {
		parts := strings.Split(s.Ref, "/")
		return sanitizeIdentifier(parts[len(parts)-1])
	}

	if len(s.Enum) > 0 {
		var enums []string
		for _, e := range s.Enum {
			enums = append(enums, fmt.Sprintf("%q", fmt.Sprintf("%v", e)))
		}
		return strings.Join(enums, " | ")
	}

	if len(s.OneOf) > 0 {
		var variants []string
		for _, v := range s.OneOf {
			variants = append(variants, g.schemaToTSType(v, depth))
		}
		return "(" + strings.Join(variants, " | ") + ")"
	}

	if len(s.AnyOf) > 0 {
		var variants []string
		for _, v := range s.AnyOf {
			variants = append(variants, g.schemaToTSType(v, depth))
		}
		return "(" + strings.Join(variants, " | ") + ")"
	}

	switch s.Type {
	case "string":
		if s.Format == "date" || s.Format == "date-time" {
			return "string /* ISO Date string */"
		}
		return "string"
	case "integer", "number":
		return "number"
	case "boolean":
		return "boolean"
	case "array":
		if s.Items != nil {
			itemType := g.schemaToTSType(s.Items, depth)
			if strings.Contains(itemType, " | ") {
				return fmt.Sprintf("Array<%s>", itemType)
			}
			return itemType + "[]"
		}
		return "any[]"
	case "object":
		if len(s.Properties) == 0 {
			return "Record<string, any>"
		}
		var props []string
		reqSet := make(map[string]bool)
		for _, r := range s.Required {
			reqSet[r] = true
		}
		for k, p := range s.Properties {
			opt := "?"
			if reqSet[k] {
				opt = ""
			}
			props = append(props, fmt.Sprintf("%s%s: %s", k, opt, g.schemaToTSType(p, depth+1)))
		}
		return "{\n  " + strings.Join(props, ";\n  ") + "\n}"
	default:
		return "any"
	}
}

func sanitizeIdentifier(s string) string {
	replacer := strings.NewReplacer("-", "_", " ", "_", "{", "", "}", "", ".", "_", ":", "_", "/", "_")
	cleaned := replacer.Replace(s)
	words := strings.Split(cleaned, "_")
	var result []string
	for _, w := range words {
		if len(w) > 0 {
			result = append(result, strings.ToUpper(w[:1])+w[1:])
		}
	}
	out := strings.Join(result, "")
	if out == "" {
		return "Item"
	}
	return out
}
