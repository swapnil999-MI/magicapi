package generator

import (
	"fmt"
	"strings"

	"openapi-doc-studio/internal/spec"
)

type ClientCodeGenerator struct {
	tsGen *TSGenerator
}

func NewClientCodeGenerator(tsGen *TSGenerator) *ClientCodeGenerator {
	return &ClientCodeGenerator{tsGen: tsGen}
}

func (cg *ClientCodeGenerator) Generate(ep *spec.IndexedEndpoint, framework string) string {
	if ep == nil || ep.Operation == nil {
		return "// Endpoint not found"
	}

	fw := strings.ToLower(strings.TrimSpace(framework))
	switch fw {
	case "swr":
		return cg.generateSWR(ep)
	case "axios":
		return cg.generateAxios(ep)
	case "fetch":
		return cg.generateFetch(ep)
	case "server-action", "nextjs":
		return cg.generateServerAction(ep)
	default:
		return cg.generateReactQuery(ep)
	}
}

func (cg *ClientCodeGenerator) generateReactQuery(ep *spec.IndexedEndpoint) string {
	baseName := sanitizeIdentifier(ep.OperationID)
	if baseName == "" {
		baseName = sanitizeIdentifier(ep.Method + "_" + strings.ReplaceAll(ep.Path, "/", "_"))
	}
	hookPrefix := "use" + baseName
	hasBody := ep.Method == "POST" || ep.Method == "PUT" || ep.Method == "PATCH" || ep.Method == "DELETE"
	urlFormatted := formatPathForJS(ep.Path)

	var sb strings.Builder
	sb.WriteString("import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';\n")
	sb.WriteString("import axios from 'axios';\n\n")

	// Include TS types
	sb.WriteString(cg.tsGen.GenerateEndpointTypes(ep))
	sb.WriteString("\n")

	// API Client function
	sb.WriteString(fmt.Sprintf("export const %sApi = async (params: %sParams", uncapitalize(baseName), baseName))
	if hasBody && ep.Operation.RequestBody != nil {
		sb.WriteString(fmt.Sprintf(", data: %sRequest", baseName))
	}
	sb.WriteString(fmt.Sprintf("): Promise<%sResponse> => {\n", baseName))
	sb.WriteString(fmt.Sprintf("  const url = `%s`;\n", urlFormatted))
	sb.WriteString(fmt.Sprintf("  const response = await axios.%s<%sResponse>(url", strings.ToLower(ep.Method), baseName))
	if hasBody && ep.Operation.RequestBody != nil {
		sb.WriteString(", data")
	}
	sb.WriteString(", { params });\n")
	sb.WriteString("  return response.data;\n};\n\n")

	// React Query Hook
	if !hasBody && ep.Method == "GET" {
		sb.WriteString(fmt.Sprintf("export const %s = (params: %sParams, enabled: boolean = true) => {\n", hookPrefix, baseName))
		sb.WriteString(fmt.Sprintf("  return useQuery({\n"))
		sb.WriteString(fmt.Sprintf("    queryKey: ['%s', params],\n", strings.ToLower(baseName)))
		sb.WriteString(fmt.Sprintf("    queryFn: () => %sApi(params),\n", uncapitalize(baseName)))
		sb.WriteString("    enabled: enabled && !!params,\n")
		sb.WriteString("    staleTime: 1000 * 60 * 5, // 5 minutes\n")
		sb.WriteString("  });\n};\n")
	} else {
		sb.WriteString(fmt.Sprintf("export const %s = () => {\n", hookPrefix))
		sb.WriteString("  const queryClient = useQueryClient();\n\n")
		sb.WriteString(fmt.Sprintf("  return useMutation({\n"))
		sb.WriteString(fmt.Sprintf("    mutationFn: (variables: { params: %sParams; data%s: %sRequest }) =>\n", baseName, optionalColon(ep.Operation.RequestBody == nil), baseName))
		sb.WriteString(fmt.Sprintf("      %sApi(variables.params%s),\n", uncapitalize(baseName), dataParamIfBody(ep.Operation.RequestBody != nil)))
		sb.WriteString("    onSuccess: (data) => {\n")
		sb.WriteString(fmt.Sprintf("      // Invalidate relevant queries upon mutation\n"))
		sb.WriteString(fmt.Sprintf("      queryClient.invalidateQueries({ queryKey: ['%s'] });\n", strings.ToLower(baseName)))
		sb.WriteString("    },\n")
		sb.WriteString("  });\n};\n")
	}

	return sb.String()
}

func (cg *ClientCodeGenerator) generateSWR(ep *spec.IndexedEndpoint) string {
	baseName := sanitizeIdentifier(ep.OperationID)
	if baseName == "" {
		baseName = sanitizeIdentifier(ep.Method + "_" + strings.ReplaceAll(ep.Path, "/", "_"))
	}
	urlFormatted := formatPathForJS(ep.Path)

	var sb strings.Builder
	sb.WriteString("import useSWR from 'swr';\nimport axios from 'axios';\n\n")
	sb.WriteString(cg.tsGen.GenerateEndpointTypes(ep))
	sb.WriteString("\n")

	sb.WriteString(fmt.Sprintf("const fetcher = (url: string) => axios.get(url).then(res => res.data);\n\n"))
	sb.WriteString(fmt.Sprintf("export const use%s = (params: %sParams) => {\n", baseName, baseName))
	sb.WriteString(fmt.Sprintf("  const url = `%s`;\n", urlFormatted))
	sb.WriteString(fmt.Sprintf("  return useSWR<%sResponse>(url, fetcher);\n};\n", baseName))
	return sb.String()
}

func (cg *ClientCodeGenerator) generateAxios(ep *spec.IndexedEndpoint) string {
	baseName := sanitizeIdentifier(ep.OperationID)
	urlFormatted := formatPathForJS(ep.Path)
	var sb strings.Builder
	sb.WriteString("import axios, { AxiosRequestConfig } from 'axios';\n\n")
	sb.WriteString(cg.tsGen.GenerateEndpointTypes(ep))
	sb.WriteString("\n")

	sb.WriteString(fmt.Sprintf("export async function %sClient(params: %sParams, config?: AxiosRequestConfig): Promise<%sResponse> {\n", uncapitalize(baseName), baseName, baseName))
	sb.WriteString(fmt.Sprintf("  const url = `%s`;\n", urlFormatted))
	sb.WriteString(fmt.Sprintf("  const response = await axios.%s<%sResponse>(url, { ...config, params });\n", strings.ToLower(ep.Method), baseName))
	sb.WriteString("  return response.data;\n}\n")
	return sb.String()
}

func (cg *ClientCodeGenerator) generateFetch(ep *spec.IndexedEndpoint) string {
	baseName := sanitizeIdentifier(ep.OperationID)
	urlFormatted := formatPathForJS(ep.Path)
	var sb strings.Builder
	sb.WriteString(cg.tsGen.GenerateEndpointTypes(ep))
	sb.WriteString("\n")

	sb.WriteString(fmt.Sprintf("export async function fetch%s(params: %sParams, signal?: AbortSignal): Promise<%sResponse> {\n", baseName, baseName, baseName))
	sb.WriteString(fmt.Sprintf("  const url = `%s`;\n", urlFormatted))
	sb.WriteString("  const response = await fetch(url, {\n")
	sb.WriteString(fmt.Sprintf("    method: '%s',\n", ep.Method))
	sb.WriteString("    headers: { 'Content-Type': 'application/json' },\n")
	sb.WriteString("    signal,\n")
	sb.WriteString("  });\n")
	sb.WriteString("  if (!response.ok) throw new Error(`HTTP Error: ${response.statusText}`);\n")
	sb.WriteString("  return response.json();\n}\n")
	return sb.String()
}

func (cg *ClientCodeGenerator) generateServerAction(ep *spec.IndexedEndpoint) string {
	baseName := sanitizeIdentifier(ep.OperationID)
	urlFormatted := formatPathForJS(ep.Path)
	var sb strings.Builder
	sb.WriteString("'use server';\n\n")
	sb.WriteString(cg.tsGen.GenerateEndpointTypes(ep))
	sb.WriteString("\n")

	sb.WriteString(fmt.Sprintf("export async function %sAction(params: %sParams) {\n", uncapitalize(baseName), baseName))
	sb.WriteString(fmt.Sprintf("  const url = `${process.env.API_BASE_URL}%s`;\n", urlFormatted))
	sb.WriteString("  const res = await fetch(url, {\n")
	sb.WriteString(fmt.Sprintf("    method: '%s',\n", ep.Method))
	sb.WriteString("    headers: { 'Authorization': `Bearer ${process.env.API_SECRET_KEY}` },\n")
	sb.WriteString("  });\n")
	sb.WriteString("  if (!res.ok) return { success: false, error: res.statusText };\n")
	sb.WriteString("  const data = await res.json();\n")
	sb.WriteString("  return { success: true, data };\n}\n")
	return sb.String()
}

func formatPathForJS(path string) string {
	parts := strings.Split(path, "/")
	for i, part := range parts {
		if strings.HasPrefix(part, "{") && strings.HasSuffix(part, "}") {
			paramName := strings.Trim(part, "{}")
			parts[i] = fmt.Sprintf("${params.%s}", paramName)
		}
	}
	return strings.Join(parts, "/")
}

func uncapitalize(s string) string {
	if len(s) == 0 {
		return ""
	}
	return strings.ToLower(s[:1]) + s[1:]
}

func optionalColon(isOptional bool) string {
	if isOptional {
		return "?"
	}
	return ""
}

func dataParamIfBody(hasBody bool) string {
	if hasBody {
		return ", variables.data"
	}
	return ""
}
