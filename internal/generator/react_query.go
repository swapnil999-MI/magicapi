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
	baseName := endpointBaseName(ep)
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
	switch {
	case hasBody && ep.Operation.RequestBody != nil && ep.Method == "DELETE":
		// axios.delete(url, config) has no data argument; the body goes in config.data
		sb.WriteString(", { data, params });\n")
	case hasBody && ep.Operation.RequestBody != nil:
		sb.WriteString(", data, { params });\n")
	default:
		sb.WriteString(", { params });\n")
	}
	sb.WriteString("  return response.data;\n};\n\n")

	// React Query Hook
	if !hasBody && ep.Method == "GET" {
		sb.WriteString(fmt.Sprintf("export const %s = (params: %sParams, enabled: boolean = true) => {\n", hookPrefix, baseName))
		sb.WriteString("  return useQuery({\n")
		sb.WriteString(fmt.Sprintf("    queryKey: ['%s', params],\n", strings.ToLower(baseName)))
		sb.WriteString(fmt.Sprintf("    queryFn: () => %sApi(params),\n", uncapitalize(baseName)))
		sb.WriteString("    enabled: enabled && !!params,\n")
		sb.WriteString("    staleTime: 1000 * 60 * 5, // 5 minutes\n")
		sb.WriteString("  });\n};\n")
	} else {
		sb.WriteString(fmt.Sprintf("export const %s = () => {\n", hookPrefix))
		sb.WriteString("  const queryClient = useQueryClient();\n\n")
		sb.WriteString("  return useMutation({\n")
		variablesType := fmt.Sprintf("{ params: %sParams }", baseName)
		if ep.Operation.RequestBody != nil {
			variablesType = fmt.Sprintf("{ params: %sParams; data: %sRequest }", baseName, baseName)
		}
		sb.WriteString(fmt.Sprintf("    mutationFn: (variables: %s) =>\n", variablesType))
		sb.WriteString(fmt.Sprintf("      %sApi(variables.params%s),\n", uncapitalize(baseName), dataParamIfBody(ep.Operation.RequestBody != nil)))
		sb.WriteString("    onSuccess: (data) => {\n")
		sb.WriteString("      // Invalidate relevant queries upon mutation\n")
		sb.WriteString(fmt.Sprintf("      queryClient.invalidateQueries({ queryKey: ['%s'] });\n", strings.ToLower(baseName)))
		sb.WriteString("    },\n")
		sb.WriteString("  });\n};\n")
	}

	return sb.String()
}

func (cg *ClientCodeGenerator) generateSWR(ep *spec.IndexedEndpoint) string {
	baseName := endpointBaseName(ep)
	urlFormatted := formatPathForJS(ep.Path)

	var sb strings.Builder
	sb.WriteString("import useSWR from 'swr';\nimport axios from 'axios';\n\n")
	sb.WriteString(cg.tsGen.GenerateEndpointTypes(ep))
	sb.WriteString("\n")

	sb.WriteString("const fetcher = (url: string) => axios.get(url).then(res => res.data);\n\n")
	sb.WriteString(fmt.Sprintf("export const use%s = (params: %sParams) => {\n", baseName, baseName))
	sb.WriteString(fmt.Sprintf("  const url = `%s`;\n", urlFormatted))
	sb.WriteString(fmt.Sprintf("  return useSWR<%sResponse>(url, fetcher);\n};\n", baseName))
	return sb.String()
}

func (cg *ClientCodeGenerator) generateAxios(ep *spec.IndexedEndpoint) string {
	baseName := endpointBaseName(ep)
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
	baseName := endpointBaseName(ep)
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
	baseName := endpointBaseName(ep)
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

func dataParamIfBody(hasBody bool) string {
	if hasBody {
		return ", variables.data"
	}
	return ""
}
