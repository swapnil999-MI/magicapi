package generator

import (
	"fmt"
	"strings"

	"openapi-doc-studio/internal/spec"
)

type ErrorAuthGenerator struct{}

func NewErrorAuthGenerator() *ErrorAuthGenerator {
	return &ErrorAuthGenerator{}
}

func (eag *ErrorAuthGenerator) GenerateErrorMatrix(ep *spec.IndexedEndpoint) string {
	if ep == nil || ep.Operation == nil {
		return "// Endpoint not found"
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("## Error Matrix for %s %s\n\n", ep.Method, ep.Path))
	sb.WriteString("| Status Code | Description | UI Handling Recommendation |\n")
	sb.WriteString("|---|---|---|\n")

	hasErrors := false
	for code, resp := range ep.Operation.Responses {
		if code == "200" || code == "201" || code == "204" {
			continue
		}
		hasErrors = true
		uiAdvice := getUIAdvice(code)
		sb.WriteString(fmt.Sprintf("| `%s` | %s | %s |\n", code, resp.Description, uiAdvice))
	}

	if !hasErrors {
		sb.WriteString("| `400` | Bad Request / Validation Failed | Display inline field errors on form |\n")
		sb.WriteString("| `401` | Unauthorized / Session Expired | Redirect to login & trigger token refresh |\n")
		sb.WriteString("| `403` | Forbidden / Insufficient Permissions | Show error alert 'Access Denied' |\n")
		sb.WriteString("| `404` | Not Found | Show 'Resource Not Found' empty state |\n")
		sb.WriteString("| `500` | Internal Server Error | Show toast 'Server error, please try again' |\n")
	}

	sb.WriteString("\n### Frontend Toast & Error Handler Snippet\n```typescript\n")
	sb.WriteString("import { toast } from 'sonner'; // or react-hot-toast\n\n")
	sb.WriteString("export function handleApiError(error: any) {\n")
	sb.WriteString("  const status = error?.response?.status;\n")
	sb.WriteString("  const message = error?.response?.data?.message || 'An unexpected error occurred';\n\n")
	sb.WriteString("  switch (status) {\n")
	sb.WriteString("    case 400:\n")
	sb.WriteString("      toast.error(`Validation Error: ${message}`);\n")
	sb.WriteString("      break;\n")
	sb.WriteString("    case 401:\n")
	sb.WriteString("      toast.error('Session expired. Redirecting to login...');\n")
	sb.WriteString("      window.location.href = '/login';\n")
	sb.WriteString("      break;\n")
	sb.WriteString("    case 403:\n")
	sb.WriteString("      toast.error('Access Denied: You do not have permission.');\n")
	sb.WriteString("      break;\n")
	sb.WriteString("    case 404:\n")
	sb.WriteString("      toast.error('Requested resource was not found.');\n")
	sb.WriteString("      break;\n")
	sb.WriteString("    case 500:\n")
	sb.WriteString("    default:\n")
	sb.WriteString("      toast.error(message);\n")
	sb.WriteString("      break;\n")
	sb.WriteString("  }\n}\n```\n")

	return sb.String()
}

func (eag *ErrorAuthGenerator) GenerateAuthConfig(ep *spec.IndexedEndpoint, specData *spec.OpenAPISpec) string {
	if ep == nil || ep.Operation == nil {
		return "// Endpoint not found"
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("## Authentication & Security Configuration for %s %s\n\n", ep.Method, ep.Path))

	authType := "None (Public API)"
	if len(ep.Operation.Security) > 0 {
		var secNames []string
		for _, sec := range ep.Operation.Security {
			for name := range sec {
				secNames = append(secNames, name)
			}
		}
		authType = strings.Join(secNames, ", ")
	}

	sb.WriteString(fmt.Sprintf("- **Auth Schemes Required:** `%s`\n", authType))
	sb.WriteString("- **Header Format:** `Authorization: Bearer <JWT_TOKEN>`\n\n")

	sb.WriteString("### Axios Auth Interceptor Setup\n```typescript\n")
	sb.WriteString("import axios from 'axios';\n\n")
	sb.WriteString("export const apiClient = axios.create({\n")
	sb.WriteString("  baseURL: process.env.NEXT_PUBLIC_API_URL || 'https://api.magicapi.dev/v1',\n")
	sb.WriteString("  timeout: 30000,\n});\n\n")
	sb.WriteString("apiClient.interceptors.request.use((config) => {\n")
	sb.WriteString("  const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');\n")
	sb.WriteString("  if (token) {\n")
	sb.WriteString("    config.headers.Authorization = `Bearer ${token}`;\n")
	sb.WriteString("  }\n")
	sb.WriteString("  return config;\n")
	sb.WriteString("}, (error) => Promise.reject(error));\n\n")
	sb.WriteString("apiClient.interceptors.response.use(\n")
	sb.WriteString("  (response) => response,\n")
	sb.WriteString("  async (error) => {\n")
	sb.WriteString("    if (error.response?.status === 401) {\n")
	sb.WriteString("      // Trigger Token Refresh or Logout\n")
	sb.WriteString("      localStorage.removeItem('auth_token');\n")
	sb.WriteString("      window.location.href = '/login';\n")
	sb.WriteString("    }\n")
	sb.WriteString("    return Promise.reject(error);\n")
	sb.WriteString("  }\n);\n```\n")

	return sb.String()
}

func getUIAdvice(code string) string {
	switch code {
	case "400":
		return "Highlight invalid form inputs and display field error messages"
	case "401":
		return "Trigger token refresh; if failed, redirect to `/login`"
	case "403":
		return "Show permission denied banner or modal"
	case "404":
		return "Render empty state / 404 alert"
	case "409":
		return "Show conflict warning toast (e.g. duplicate MID or record already exists)"
	case "422":
		return "Display payload schema validation failure breakdown"
	case "429":
		return "Rate limit exceeded: display retry countdown timer"
	case "500", "502", "503":
		return "Show retry button or fallback notification"
	default:
		return "Display error toast notification"
	}
}
