package generator

import (
	"fmt"
	"regexp"
	"sort"
	"strconv"
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
	g.generateTypeRecursive(&sb, name, s, 0)
	return sb.String()
}

func (g *TSGenerator) GenerateEndpointTypes(ep *spec.IndexedEndpoint) string {
	if ep == nil || ep.Operation == nil {
		return "// Endpoint not found"
	}

	var sb strings.Builder
	baseName := endpointBaseName(ep)

	sb.WriteString(fmt.Sprintf("/**\n * Types for %s %s\n", ep.Method, ep.Path))
	if ep.Summary != "" {
		sb.WriteString(fmt.Sprintf(" * %s\n", ep.Summary))
	}
	sb.WriteString(" */\n\n")

	// 1. Path & Query Parameters Type (always emitted: client code references it)
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
			sb.WriteString(fmt.Sprintf("  %s%s: %s;\n", tsPropertyKey(p.Name), optional, paramType))
		}
		sb.WriteString("}\n\n")
	} else {
		sb.WriteString(fmt.Sprintf("export type %sParams = Record<string, never>;\n\n", baseName))
	}

	// 2. Request Body Type
	if ep.Operation.RequestBody != nil {
		requestType := "unknown"
		for _, media := range ep.Operation.RequestBody.Content {
			if media.Schema != nil {
				requestType = g.schemaToTSType(g.loader.ResolveSchema(media.Schema), 0)
				break
			}
		}
		sb.WriteString(fmt.Sprintf("export type %sRequest = %s;\n\n", baseName, requestType))
	}

	// 3. Response Types: the primary success response is named <Base>Response,
	// every other documented response gets a status-code suffix.
	codes := make([]string, 0, len(ep.Operation.Responses))
	for code := range ep.Operation.Responses {
		codes = append(codes, code)
	}
	sort.Strings(codes)
	primary := primarySuccessCode(codes)
	primaryEmitted := false

	for _, code := range codes {
		resp := ep.Operation.Responses[code]
		for _, media := range resp.Content {
			if media.Schema != nil {
				resolved := g.loader.ResolveSchema(media.Schema)
				typeName := baseName + "Response" + sanitizeIdentifier(code)
				if code == primary {
					typeName = baseName + "Response"
					primaryEmitted = true
				}
				sb.WriteString(fmt.Sprintf("export type %s = %s;\n\n", typeName, g.schemaToTSType(resolved, 0)))
				break
			}
		}
	}
	if !primaryEmitted {
		sb.WriteString(fmt.Sprintf("export type %sResponse = void;\n\n", baseName))
	}

	return sb.String()
}

// primarySuccessCode picks the response code used for <Base>Response:
// 200, then 201, then the lowest other 2xx code. codes must be sorted.
func primarySuccessCode(codes []string) string {
	for _, preferred := range []string{"200", "201"} {
		for _, c := range codes {
			if c == preferred {
				return c
			}
		}
	}
	for _, c := range codes {
		if strings.HasPrefix(c, "2") {
			return c
		}
	}
	return ""
}

func (g *TSGenerator) generateTypeRecursive(sb *strings.Builder, name string, s *spec.Schema, depth int) {
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
			sb.WriteString(fmt.Sprintf("  %s%s: %s;\n", tsPropertyKey(propName), optional, propType))
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
			props = append(props, fmt.Sprintf("%s%s: %s", tsPropertyKey(k), opt, g.schemaToTSType(p, depth+1)))
		}
		return "{\n  " + strings.Join(props, ";\n  ") + "\n}"
	default:
		return "any"
	}
}

// endpointBaseName returns the identifier prefix for an endpoint's generated
// types and functions, derived from operationId or, failing that, method + path.
func endpointBaseName(ep *spec.IndexedEndpoint) string {
	if strings.TrimSpace(ep.OperationID) != "" {
		return sanitizeIdentifier(ep.OperationID)
	}
	return sanitizeIdentifier(strings.ToLower(ep.Method) + "_" + strings.ReplaceAll(ep.Path, "/", "_"))
}

var tsIdentifierRe = regexp.MustCompile(`^[A-Za-z_$][A-Za-z0-9_$]*$`)

// tsPropertyKey quotes property names that are not valid TS identifiers (e.g. "X-Request-Id").
func tsPropertyKey(name string) string {
	if tsIdentifierRe.MatchString(name) {
		return name
	}
	return strconv.Quote(name)
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
