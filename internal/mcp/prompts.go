package mcp

import "fmt"

type PromptRegistry struct{}

func NewPromptRegistry() *PromptRegistry {
	return &PromptRegistry{}
}

func (pr *PromptRegistry) ListPrompts() []Prompt {
	return []Prompt{
		{
			Name:        "integrate_endpoint",
			Description: "Guides the AI step-by-step to integrate an API endpoint (generates types, client hook, form validation, and UI component)",
			Arguments: []PromptArgument{
				{Name: "path", Description: "API endpoint path", Required: true},
				{Name: "method", Description: "HTTP method (GET, POST, PUT)", Required: false},
				{Name: "framework", Description: "Target UI framework (e.g. React, Next.js)", Required: false},
			},
		},
		{
			Name:        "build_dynamic_form",
			Description: "Guides the AI on building forms with dynamic/conditional JSON columns (e.g. gateway configurations)",
			Arguments: []PromptArgument{
				{Name: "path", Description: "API endpoint path", Required: true},
				{Name: "discriminator", Description: "Field driving the condition (e.g. gateway_type)", Required: true},
			},
		},
	}
}

func (pr *PromptRegistry) GetPrompt(name string, args map[string]string) (string, error) {
	switch name {
	case "integrate_endpoint":
		path := args["path"]
		method := args["method"]
		if method == "" {
			method = "POST"
		}
		return fmt.Sprintf(`You are integrating the endpoint %s %s into the frontend codebase.
Follow these steps:
1. Call tool 'get_endpoint_details' for '%s' to inspect parameters and schemas.
2. Call tool 'get_schema_types' to generate TypeScript interfaces.
3. Call tool 'generate_form_integration' if this endpoint accepts a request body.
4. Call tool 'generate_client_code' using React Query.
5. Create a complete, production-ready React component with loading states, error toast notifications, and type-safe form submission.`, method, path, path), nil

	case "build_dynamic_form":
		path := args["path"]
		disc := args["discriminator"]
		return fmt.Sprintf(`You are building a dynamic form for endpoint %s with conditional field '%s'.
1. Call 'get_field_dependencies' for '%s'.
2. Use the visibility map to dynamically render input fields when '%s' changes.
3. Create a Zod discriminated union using 'generate_form_integration'.
4. Ensure all variant-specific credentials/settings are properly typed and validated.`, path, disc, path, disc), nil

	default:
		return "", fmt.Errorf("prompt '%s' not found", name)
	}
}
