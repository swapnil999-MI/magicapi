package spec

import (
	"fmt"
	"strings"
)

type FieldDependency struct {
	TriggerField string                    `json:"trigger_field"`
	Description  string                    `json:"description,omitempty"`
	Variants     map[string]VariantDetails `json:"variants"`
}

type VariantDetails struct {
	VisibleFields  []string          `json:"visible_fields"`
	RequiredFields []string          `json:"required_fields"`
	FieldLabels    map[string]string `json:"field_labels,omitempty"`
	FieldTypes     map[string]string `json:"field_types,omitempty"`
	DefaultValues  map[string]any    `json:"default_values,omitempty"`
	Descriptions   map[string]string `json:"descriptions,omitempty"`
	ExamplePayload map[string]any    `json:"example_payload,omitempty"`
}

type DynamicAnalyzer struct {
	loader *Loader
}

func NewDynamicAnalyzer(loader *Loader) *DynamicAnalyzer {
	return &DynamicAnalyzer{loader: loader}
}

// AnalyzeEndpointDependencies inspects request body schemas for oneOf, anyOf, discriminator, or known polymorphic objects
func (da *DynamicAnalyzer) AnalyzeEndpointDependencies(ep *IndexedEndpoint) []FieldDependency {
	var deps []FieldDependency
	if ep == nil || ep.Operation == nil || ep.Operation.RequestBody == nil {
		return deps
	}

	for _, media := range ep.Operation.RequestBody.Content {
		if media.Schema == nil {
			continue
		}
		rootSchema := da.loader.ResolveSchema(media.Schema)
		if rootSchema == nil {
			continue
		}

		// 1. Explicit discriminator
		if rootSchema.Discriminator != nil {
			dep := da.extractDiscriminatorDependency(rootSchema, rootSchema.Discriminator)
			deps = append(deps, dep)
		}

		// 2. Scan properties for polymorphic fields (credentials, config, options, metadata, rules, payment_details)
		for propName, propSchema := range rootSchema.Properties {
			resolvedProp := da.loader.ResolveSchema(propSchema)
			if resolvedProp == nil {
				continue
			}

			if resolvedProp.Discriminator != nil {
				dep := da.extractDiscriminatorDependency(resolvedProp, resolvedProp.Discriminator)
				dep.TriggerField = propName + "." + dep.TriggerField
				deps = append(deps, dep)
			} else if len(resolvedProp.OneOf) > 0 || len(resolvedProp.AnyOf) > 0 {
				dep := da.extractUnionDependency(propName, resolvedProp)
				deps = append(deps, dep)
			} else if isKnownPolymorphicName(propName) {
				dep := da.inferPolymorphicFieldDependency(propName, rootSchema, resolvedProp)
				if len(dep.Variants) > 0 {
					deps = append(deps, dep)
				}
			}
		}
	}

	return deps
}

func (da *DynamicAnalyzer) ExtractVariantSchema(ep *IndexedEndpoint, discriminatorField, variantValue string) (*Schema, map[string]any, error) {
	if ep == nil || ep.Operation == nil || ep.Operation.RequestBody == nil {
		return nil, nil, fmt.Errorf("endpoint has no request body")
	}

	cleanField := strings.TrimSpace(discriminatorField)
	cleanValue := strings.TrimSpace(strings.ToUpper(variantValue))

	for _, media := range ep.Operation.RequestBody.Content {
		if media.Schema == nil {
			continue
		}
		root := da.loader.ResolveSchema(media.Schema)
		if root == nil {
			continue
		}

		// Check oneOf / anyOf
		candidates := append(root.OneOf, root.AnyOf...)
		for _, variant := range candidates {
			resolvedVariant := da.loader.ResolveSchema(variant)
			if resolvedVariant == nil {
				continue
			}

			// Check if this variant has discriminator property matching value
			for pName, pSchema := range resolvedVariant.Properties {
				if strings.EqualFold(pName, cleanField) {
					if len(pSchema.Enum) > 0 {
						for _, e := range pSchema.Enum {
							if strings.EqualFold(fmt.Sprintf("%v", e), cleanValue) {
								return resolvedVariant, generateExampleMap(resolvedVariant), nil
							}
						}
					}
					if fmt.Sprintf("%v", pSchema.Default) == cleanValue || fmt.Sprintf("%v", pSchema.Example) == cleanValue {
						return resolvedVariant, generateExampleMap(resolvedVariant), nil
					}
				}
			}
		}

		// Check child property oneOf
		for propName, propSchema := range root.Properties {
			resolvedProp := da.loader.ResolveSchema(propSchema)
			if resolvedProp == nil {
				continue
			}
			candidates := append(resolvedProp.OneOf, resolvedProp.AnyOf...)
			for _, variant := range candidates {
				resolvedVariant := da.loader.ResolveSchema(variant)
				if resolvedVariant != nil {
					for pName := range resolvedVariant.Properties {
						if strings.EqualFold(pName, cleanField) || strings.EqualFold(propName+"."+pName, cleanField) {
							return resolvedVariant, generateExampleMap(resolvedVariant), nil
						}
					}
				}
			}
		}
	}

	return nil, nil, fmt.Errorf("variant %s for discriminator %s not found in endpoint schema", variantValue, discriminatorField)
}

func (da *DynamicAnalyzer) extractDiscriminatorDependency(s *Schema, disc *Discriminator) FieldDependency {
	dep := FieldDependency{
		TriggerField: disc.PropertyName,
		Description:  fmt.Sprintf("Dynamic UI schema switching on '%s'", disc.PropertyName),
		Variants:     make(map[string]VariantDetails),
	}

	for key, ref := range disc.Mapping {
		targetSchema := da.loader.ResolveSchema(&Schema{Ref: ref})
		if targetSchema != nil {
			dep.Variants[key] = extractVariantDetailsFromSchema(targetSchema)
		}
	}

	if len(dep.Variants) == 0 {
		candidates := append(s.OneOf, s.AnyOf...)
		for _, variant := range candidates {
			resolved := da.loader.ResolveSchema(variant)
			if resolved != nil {
				val := getDiscriminatorValue(resolved, disc.PropertyName)
				if val != "" {
					dep.Variants[val] = extractVariantDetailsFromSchema(resolved)
				}
			}
		}
	}

	return dep
}

func (da *DynamicAnalyzer) extractUnionDependency(fieldName string, s *Schema) FieldDependency {
	dep := FieldDependency{
		TriggerField: fieldName,
		Description:  fmt.Sprintf("Polymorphic union configuration for '%s'", fieldName),
		Variants:     make(map[string]VariantDetails),
	}

	candidates := append(s.OneOf, s.AnyOf...)
	for i, variant := range candidates {
		resolved := da.loader.ResolveSchema(variant)
		if resolved != nil {
			key := resolved.Title
			if key == "" {
				key = fmt.Sprintf("Variant_%d", i+1)
			}
			dep.Variants[key] = extractVariantDetailsFromSchema(resolved)
		}
	}

	return dep
}

func (da *DynamicAnalyzer) inferPolymorphicFieldDependency(propName string, root, propSchema *Schema) FieldDependency {
	dep := FieldDependency{
		TriggerField: propName,
		Description:  fmt.Sprintf("Configurable JSON property '%s'", propName),
		Variants:     make(map[string]VariantDetails),
	}

	// Look for companion enum field in root (e.g. gateway_type, service_type, auth_type)
	for rootProp, rootSchema := range root.Properties {
		if strings.Contains(strings.ToLower(rootProp), "type") || strings.Contains(strings.ToLower(rootProp), "gateway") || strings.Contains(strings.ToLower(rootProp), "service") {
			resolvedRootProp := da.loader.ResolveSchema(rootSchema)
			if resolvedRootProp != nil && len(resolvedRootProp.Enum) > 0 {
				dep.TriggerField = rootProp
				for _, e := range resolvedRootProp.Enum {
					eStr := fmt.Sprintf("%v", e)
					dep.Variants[eStr] = extractVariantDetailsFromSchema(propSchema)
				}
				break
			}
		}
	}

	return dep
}

func extractVariantDetailsFromSchema(s *Schema) VariantDetails {
	v := VariantDetails{
		VisibleFields:  make([]string, 0),
		RequiredFields: s.Required,
		FieldLabels:    make(map[string]string),
		FieldTypes:     make(map[string]string),
		DefaultValues:  make(map[string]any),
		Descriptions:   make(map[string]string),
		ExamplePayload: generateExampleMap(s),
	}

	for k, prop := range s.Properties {
		v.VisibleFields = append(v.VisibleFields, k)
		v.FieldTypes[k] = prop.Type
		if prop.Title != "" {
			v.FieldLabels[k] = prop.Title
		} else {
			v.FieldLabels[k] = formatLabel(k)
		}
		if prop.Description != "" {
			v.Descriptions[k] = prop.Description
		}
		if prop.Default != nil {
			v.DefaultValues[k] = prop.Default
		}
	}

	return v
}

func generateExampleMap(s *Schema) map[string]any {
	if s == nil {
		return nil
	}
	out := make(map[string]any)
	for k, prop := range s.Properties {
		if prop.Example != nil {
			out[k] = prop.Example
		} else if prop.Default != nil {
			out[k] = prop.Default
		} else {
			switch prop.Type {
			case "string":
				out[k] = "sample_" + k
			case "integer", "number":
				out[k] = 100
			case "boolean":
				out[k] = true
			case "array":
				out[k] = []string{}
			case "object":
				out[k] = map[string]any{}
			default:
				out[k] = nil
			}
		}
	}
	return out
}

func getDiscriminatorValue(s *Schema, prop string) string {
	if p, ok := s.Properties[prop]; ok {
		if p.Default != nil {
			return fmt.Sprintf("%v", p.Default)
		}
		if len(p.Enum) > 0 {
			return fmt.Sprintf("%v", p.Enum[0])
		}
	}
	return s.Title
}

func isKnownPolymorphicName(name string) bool {
	lower := strings.ToLower(name)
	return lower == "credentials" || lower == "config" || lower == "options" ||
		lower == "metadata" || lower == "rules" || lower == "payment_details" ||
		lower == "extra_data" || lower == "custom_fields" || lower == "settings"
}

func formatLabel(key string) string {
	words := strings.Split(strings.ReplaceAll(key, "_", " "), " ")
	for i, w := range words {
		if len(w) > 0 {
			words[i] = strings.ToUpper(w[:1]) + w[1:]
		}
	}
	return strings.Join(words, " ")
}
