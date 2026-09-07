package generator

import (
	"fmt"
	"strings"

	"openapi-doc-studio/internal/spec"
)

type QueryKeyGenerator struct {
	indexer *spec.Indexer
}

func NewQueryKeyGenerator(indexer *spec.Indexer) *QueryKeyGenerator {
	return &QueryKeyGenerator{indexer: indexer}
}

func (qkg *QueryKeyGenerator) GenerateQueryKeyFactory(tagFilter string) string {
	var sb strings.Builder
	sb.WriteString("/**\n * Auto-generated Query Key Factory for TanStack React Query\n */\n\n")

	categories := qkg.indexer.GetCategories()
	tagMap := make(map[string][]spec.IndexedEndpoint)

	for _, tag := range categories {
		endpoints := qkg.indexer.Search("", tag.Name, "", 100)
		if len(endpoints) > 0 {
			tagMap[tag.Name] = endpoints
		}
	}

	for tagName, endpoints := range tagMap {
		if tagFilter != "" && !strings.Contains(strings.ToLower(tagName), strings.ToLower(tagFilter)) {
			continue
		}

		keyName := sanitizeIdentifier(tagName) + "Keys"
		domainKey := strings.ToLower(sanitizeIdentifier(tagName))

		sb.WriteString(fmt.Sprintf("export const %s = {\n", keyName))
		sb.WriteString(fmt.Sprintf("  all: ['%s'] as const,\n", domainKey))
		sb.WriteString(fmt.Sprintf("  lists: () => [...%s.all, 'list'] as const,\n", keyName))
		sb.WriteString(fmt.Sprintf("  list: (filters: Record<string, any>) => [...%s.lists(), filters] as const,\n", keyName))
		sb.WriteString(fmt.Sprintf("  details: () => [...%s.all, 'detail'] as const,\n", keyName))
		sb.WriteString(fmt.Sprintf("  detail: (id: string | number) => [...%s.details(), id] as const,\n", keyName))

		// Specific endpoint keys
		for _, ep := range endpoints {
			if ep.OperationID != "" {
				methodKey := uncapitalize(sanitizeIdentifier(ep.OperationID))
				sb.WriteString(fmt.Sprintf("  %s: (params?: any) => [...%s.all, '%s', params] as const,\n", methodKey, keyName, methodKey))
			}
		}

		sb.WriteString("};\n\n")
	}

	return sb.String()
}
