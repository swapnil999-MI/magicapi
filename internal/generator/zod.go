package generator

import (
	"fmt"
	"strings"

	"openapi-doc-studio/internal/spec"
)

type ZodGenerator struct {
	loader *spec.Loader
}

func NewZodGenerator(loader *spec.Loader) *ZodGenerator {
	return &ZodGenerator{loader: loader}
}

func (zg *ZodGenerator) GenerateEndpointZod(ep *spec.IndexedEndpoint) string {
	if ep == nil || ep.Operation == nil || ep.Operation.RequestBody == nil {
		return "// No request body to validate"
	}

	var sb strings.Builder
	sb.WriteString("import { z } from 'zod';\n\n")

	baseName := sanitizeIdentifier(ep.OperationID)
	if baseName == "" {
		baseName = sanitizeIdentifier(ep.Method + "_" + strings.ReplaceAll(ep.Path, "/", "_"))
	}

	for _, media := range ep.Operation.RequestBody.Content {
		if media.Schema != nil {
			resolved := zg.loader.ResolveSchema(media.Schema)
			schemaName := baseName + "Schema"

			if resolved.Discriminator != nil {
				sb.WriteString(zg.generateDiscriminatedUnionZod(schemaName, resolved, resolved.Discriminator))
			} else {
				sb.WriteString(fmt.Sprintf("export const %s = %s;\n\n", schemaName, zg.schemaToZod(resolved, 0)))
			}
			sb.WriteString(fmt.Sprintf("export type %s = z.infer<typeof %s>;\n", baseName+"FormValues", schemaName))
			break
		}
	}

	return sb.String()
}

func (zg *ZodGenerator) generateDiscriminatedUnionZod(name string, s *spec.Schema, disc *spec.Discriminator) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("export const %s = z.discriminatedUnion(%q, [\n", name, disc.PropertyName))

	candidates := append(s.OneOf, s.AnyOf...)
	for _, variant := range candidates {
		resolved := zg.loader.ResolveSchema(variant)
		if resolved != nil {
			sb.WriteString("  " + zg.schemaToZod(resolved, 1) + ",\n")
		}
	}

	sb.WriteString("]);\n\n")
	return sb.String()
}

func (zg *ZodGenerator) schemaToZod(s *spec.Schema, depth int) string {
	if s == nil || depth > 8 {
		return "z.any()"
	}

	resolved := zg.loader.ResolveSchema(s)
	if resolved == nil {
		return "z.any()"
	}

	if len(resolved.Enum) > 0 {
		var enumList []string
		for _, e := range resolved.Enum {
			enumList = append(enumList, fmt.Sprintf("%q", fmt.Sprintf("%v", e)))
		}
		return fmt.Sprintf("z.enum([%s])", strings.Join(enumList, ", "))
	}

	switch resolved.Type {
	case "string":
		var rules []string
		rules = append(rules, "z.string()")
		if resolved.MinLength != nil && *resolved.MinLength > 0 {
			rules = append(rules, fmt.Sprintf(".min(%d, { message: 'Must be at least %d characters' })", *resolved.MinLength, *resolved.MinLength))
		}
		if resolved.MaxLength != nil {
			rules = append(rules, fmt.Sprintf(".max(%d, { message: 'Must be at most %d characters' })", *resolved.MaxLength, *resolved.MaxLength))
		}
		if resolved.Format == "email" {
			rules = append(rules, ".email({ message: 'Invalid email address' })")
		} else if resolved.Format == "uuid" {
			rules = append(rules, ".uuid({ message: 'Invalid UUID' })")
		}
		if resolved.Pattern != "" {
			rules = append(rules, fmt.Sprintf(".regex(/%s/, { message: 'Invalid format' })", resolved.Pattern))
		}
		return strings.Join(rules, "")

	case "integer", "number":
		var rules []string
		if resolved.Type == "integer" {
			rules = append(rules, "z.number().int()")
		} else {
			rules = append(rules, "z.number()")
		}
		if resolved.Minimum != nil {
			rules = append(rules, fmt.Sprintf(".min(%v)", *resolved.Minimum))
		}
		if resolved.Maximum != nil {
			rules = append(rules, fmt.Sprintf(".max(%v)", *resolved.Maximum))
		}
		return strings.Join(rules, "")

	case "boolean":
		return "z.boolean()"

	case "array":
		if resolved.Items != nil {
			itemZod := zg.schemaToZod(resolved.Items, depth)
			return fmt.Sprintf("z.array(%s)", itemZod)
		}
		return "z.array(z.any())"

	case "object":
		if len(resolved.Properties) == 0 {
			return "z.record(z.string(), z.any())"
		}
		indent := strings.Repeat("  ", depth+1)
		closeIndent := strings.Repeat("  ", depth)
		var fields []string

		reqMap := make(map[string]bool)
		for _, r := range resolved.Required {
			reqMap[r] = true
		}

		for propName, propSchema := range resolved.Properties {
			propZod := zg.schemaToZod(propSchema, depth+1)
			if !reqMap[propName] {
				propZod += ".optional()"
			}
			fields = append(fields, fmt.Sprintf("%s%s: %s,", indent, propName, propZod))
		}
		return fmt.Sprintf("z.object({\n%s\n%s})", strings.Join(fields, "\n"), closeIndent)

	default:
		return "z.any()"
	}
}
