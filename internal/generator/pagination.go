package generator

import (
	"fmt"
	"strings"

	"openapi-doc-studio/internal/spec"
)

type PaginationGenerator struct {
	tsGen *TSGenerator
}

func NewPaginationGenerator(tsGen *TSGenerator) *PaginationGenerator {
	return &PaginationGenerator{tsGen: tsGen}
}

func (pg *PaginationGenerator) Generate(ep *spec.IndexedEndpoint) string {
	if ep == nil || ep.Operation == nil {
		return "// Endpoint not found"
	}

	baseName := sanitizeIdentifier(ep.OperationID)
	if baseName == "" {
		baseName = sanitizeIdentifier(ep.Method + "_" + strings.ReplaceAll(ep.Path, "/", "_"))
	}
	urlFormatted := formatPathForJS(ep.Path)

	// Check pagination style
	isCursor := false
	for _, p := range ep.Operation.Parameters {
		if strings.Contains(strings.ToLower(p.Name), "cursor") || strings.Contains(strings.ToLower(p.Name), "token") {
			isCursor = true
			break
		}
	}

	var sb strings.Builder
	sb.WriteString("import { useInfiniteQuery, useQuery } from '@tanstack/react-query';\n")
	sb.WriteString("import axios from 'axios';\nimport { useState } from 'react';\n\n")

	sb.WriteString(pg.tsGen.GenerateEndpointTypes(ep))
	sb.WriteString("\n")

	if isCursor {
		sb.WriteString(fmt.Sprintf("export const useInfinite%s = (baseParams: Omit<%sParams, 'cursor'>) => {\n", baseName, baseName))
		sb.WriteString("  return useInfiniteQuery({\n")
		sb.WriteString(fmt.Sprintf("    queryKey: ['%s', 'infinite', baseParams],\n", strings.ToLower(baseName)))
		sb.WriteString(fmt.Sprintf("    queryFn: async ({ pageParam = '' }) => {\n"))
		sb.WriteString(fmt.Sprintf("      const params = { ...baseParams, cursor: pageParam };\n"))
		sb.WriteString(fmt.Sprintf("      const res = await axios.get<%sResponse>(`%s`, { params });\n", baseName, urlFormatted))
		sb.WriteString("      return res.data;\n    },\n")
		sb.WriteString("    initialPageParam: '',\n")
		sb.WriteString("    getNextPageParam: (lastPage: any) => lastPage?.next_cursor ?? undefined,\n")
		sb.WriteString("  });\n};\n")
	} else {
		sb.WriteString(fmt.Sprintf("export const usePaginated%s = (initialPage: number = 1, initialPageSize: number = 20, filters: any = {}) => {\n", baseName))
		sb.WriteString("  const [page, setPage] = useState(initialPage);\n")
		sb.WriteString("  const [pageSize, setPageSize] = useState(initialPageSize);\n\n")
		sb.WriteString("  const query = useQuery({\n")
		sb.WriteString(fmt.Sprintf("    queryKey: ['%s', 'paginated', page, pageSize, filters],\n", strings.ToLower(baseName)))
		sb.WriteString(fmt.Sprintf("    queryFn: async () => {\n"))
		sb.WriteString(fmt.Sprintf("      const params = { ...filters, page, page_size: pageSize, limit: pageSize };\n"))
		sb.WriteString(fmt.Sprintf("      const res = await axios.get<%sResponse>(`%s`, { params });\n", baseName, urlFormatted))
		sb.WriteString("      return res.data;\n    },\n")
		sb.WriteString("    placeholderData: (prev) => prev,\n")
		sb.WriteString("  });\n\n")
		sb.WriteString("  return {\n")
		sb.WriteString("    ...query,\n")
		sb.WriteString("    page,\n")
		sb.WriteString("    setPage,\n")
		sb.WriteString("    pageSize,\n")
		sb.WriteString("    setPageSize,\n")
		sb.WriteString("  };\n};\n")
	}

	return sb.String()
}
