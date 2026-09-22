package spec_test

import (
	"testing"

	"gopkg.in/yaml.v3"
	"openapi-doc-studio/internal/spec"
)

const fullOpenAPI3Yaml = `
openapi: 3.0.3
info:
  title: Full OpenAPI 3.0.3 Standard Test API
  description: Comprehensive testing specification verifying all standard keys
  termsOfService: https://example.com/terms
  version: 3.0.3
  contact:
    name: API Support
    url: https://example.com/support
    email: support@example.com
  license:
    name: Apache 2.0
    url: https://www.apache.org/licenses/LICENSE-2.0.html
servers:
  - url: https://{env}.example.com/v{version}
    description: Multi-tenant server
    variables:
      env:
        default: api
        description: Environment host
        enum:
          - api
          - api.staging
      version:
        default: "1"
        description: Major API version
security:
  - OAuth2Auth:
      - read:reports
      - write:reports
tags:
  - name: Reports
    description: Analytics & Financial Reporting
    externalDocs:
      description: Reporting API deep-dive
      url: https://docs.example.com/reports
externalDocs:
  description: Official OpenAPI 3.0 Spec Reference
  url: https://spec.openapis.org/oas/v3.0.3
components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      name: X-API-KEY
      in: header
      description: Secret API key
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    OAuth2Auth:
      type: oauth2
      description: Standard OAuth2 authentication
      flows:
        authorizationCode:
          authorizationUrl: https://auth.example.com/authorize
          tokenUrl: https://auth.example.com/token
          refreshUrl: https://auth.example.com/refresh
          scopes:
            read:reports: Read access to reports
            write:reports: Write access to reports
    OpenIDAuth:
      type: openIdConnect
      openIdConnectUrl: https://auth.example.com/.well-known/openid-configuration
  parameters:
    OrgIdHeader:
      name: X-Org-ID
      in: header
      required: true
      description: Organization identifier
      schema:
        type: string
        format: uuid
  responses:
    NotFoundResponse:
      description: Entity was not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ErrorModel'
  requestBodies:
    CreateReportBody:
      description: New report payload
      required: true
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ReportRequest'
  headers:
    RateLimitLimit:
      description: Max requests per window
      required: true
      schema:
        type: integer
  examples:
    ReportExample:
      summary: Sample quarterly revenue report
      value:
        id: "rep_123"
        status: "COMPLETED"
        total: 45000.50
  links:
    UserReportLink:
      operationId: getReportById
      parameters:
        reportId: '$response.body#/id'
  callbacks:
    ReportStatusWebhook:
      '{$request.body#/callbackUrl}':
        post:
          summary: Report completion notification
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
                  properties:
                    status:
                      type: string
          responses:
            '200':
              description: Webhook received successfully
  schemas:
    ErrorModel:
      type: object
      required:
        - code
        - message
      properties:
        code:
          type: integer
          example: 404
        message:
          type: string
          example: Not Found
    ReportRequest:
      type: object
      title: ReportRequest
      description: Full schema with all standard validation keywords
      required:
        - name
        - categories
      properties:
        name:
          type: string
          minLength: 3
          maxLength: 50
          pattern: '^[a-zA-Z0-9_-]+$'
        categories:
          type: array
          minItems: 1
          maxItems: 10
          uniqueItems: true
          items:
            type: string
        factor:
          type: number
          multipleOf: 0.5
          minimum: 1.0
          exclusiveMinimum: true
          maximum: 100.0
          exclusiveMaximum: false
        readOnlyId:
          type: string
          readOnly: true
        secretToken:
          type: string
          writeOnly: true
        xmlMetadata:
          type: object
          xml:
            name: metadata
            namespace: https://example.com/schema
            prefix: ex
            wrapped: true
        legacyFlag:
          type: boolean
          deprecated: true
        nullableField:
          type: string
          nullable: true
paths:
  /organizations/{org_id}/reports:
    summary: Organization Reports Collection
    description: Manage organization level reports
    parameters:
      - name: org_id
        in: path
        required: true
        description: Target organization UUID
        schema:
          type: string
          format: uuid
    get:
      summary: List reports
      description: Retrieve reports for the organization
      operationId: listOrgReports
      tags:
        - Reports
      parameters:
        - name: status
          in: query
          description: Filter by report status
          required: false
          allowEmptyValue: true
          style: form
          explode: true
          schema:
            type: string
            enum: [PENDING, COMPLETED, FAILED]
      responses:
        '200':
          description: List of reports retrieved
          headers:
            X-RateLimit-Limit:
              $ref: '#/components/headers/RateLimitLimit'
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/ReportRequest'
              examples:
                sample:
                  $ref: '#/components/examples/ReportExample'
    post:
      summary: Create report
      operationId: createOrgReport
      tags:
        - Reports
      requestBody:
        $ref: '#/components/requestBodies/CreateReportBody'
      responses:
        '201':
          description: Report created
          links:
            viewReport:
              $ref: '#/components/links/UserReportLink'
        '404':
          $ref: '#/components/responses/NotFoundResponse'
    trace:
      summary: Trace route
      operationId: traceReports
      responses:
        '200':
          description: Trace response
`

func TestFullOpenAPI30Compliance(t *testing.T) {
	var s spec.OpenAPISpec
	if err := yaml.Unmarshal([]byte(fullOpenAPI3Yaml), &s); err != nil {
		t.Fatalf("Failed to unmarshal complete OpenAPI 3.0 spec: %v", err)
	}

	// 1. Root & Info Object assertions
	if s.OpenAPI != "3.0.3" {
		t.Errorf("Expected OpenAPI 3.0.3, got %s", s.OpenAPI)
	}
	if s.Info.Title != "Full OpenAPI 3.0.3 Standard Test API" {
		t.Errorf("Unexpected title: %s", s.Info.Title)
	}
	if s.Info.TermsOfService != "https://example.com/terms" {
		t.Errorf("Unexpected termsOfService: %s", s.Info.TermsOfService)
	}
	if s.Info.Contact == nil || s.Info.Contact.Email != "support@example.com" {
		t.Errorf("Expected contact email support@example.com, got %+v", s.Info.Contact)
	}
	if s.Info.License == nil || s.Info.License.Name != "Apache 2.0" {
		t.Errorf("Expected license Apache 2.0, got %+v", s.Info.License)
	}

	// 2. Server & Variables assertions
	if len(s.Servers) != 1 {
		t.Fatalf("Expected 1 server, got %d", len(s.Servers))
	}
	server := s.Servers[0]
	if len(server.Variables) != 2 {
		t.Fatalf("Expected 2 server variables, got %d", len(server.Variables))
	}
	if envVar, ok := server.Variables["env"]; !ok || envVar.Default != "api" || len(envVar.Enum) != 2 {
		t.Errorf("Server variable env parsed incorrectly: %+v", envVar)
	}

	// 3. Global Security & ExternalDocs
	if len(s.Security) != 1 || len(s.Security[0]["OAuth2Auth"]) != 2 {
		t.Errorf("Expected 1 global security requirement with 2 scopes, got %+v", s.Security)
	}
	if s.ExternalDocs == nil || s.ExternalDocs.URL != "https://spec.openapis.org/oas/v3.0.3" {
		t.Errorf("ExternalDocs parsed incorrectly: %+v", s.ExternalDocs)
	}

	// 4. Tags with ExternalDocs
	if len(s.Tags) != 1 || s.Tags[0].ExternalDocs == nil || s.Tags[0].ExternalDocs.URL != "https://docs.example.com/reports" {
		t.Errorf("Tag externalDocs parsed incorrectly: %+v", s.Tags)
	}

	// 5. All 9 Components assertions
	c := s.Components
	if len(c.SecuritySchemes) != 4 {
		t.Errorf("Expected 4 security schemes, got %d", len(c.SecuritySchemes))
	}
	oauth := c.SecuritySchemes["OAuth2Auth"]
	if oauth.Flows == nil || oauth.Flows.AuthorizationCode == nil {
		t.Fatalf("OAuth2 authorizationCode flow missing")
	}
	if oauth.Flows.AuthorizationCode.AuthorizationURL != "https://auth.example.com/authorize" {
		t.Errorf("Unexpected auth URL: %s", oauth.Flows.AuthorizationCode.AuthorizationURL)
	}
	if len(oauth.Flows.AuthorizationCode.Scopes) != 2 {
		t.Errorf("Expected 2 OAuth2 scopes, got %d", len(oauth.Flows.AuthorizationCode.Scopes))
	}

	if _, ok := c.Parameters["OrgIdHeader"]; !ok {
		t.Errorf("Missing components.parameters.OrgIdHeader")
	}
	if _, ok := c.Responses["NotFoundResponse"]; !ok {
		t.Errorf("Missing components.responses.NotFoundResponse")
	}
	if _, ok := c.RequestBodies["CreateReportBody"]; !ok {
		t.Errorf("Missing components.requestBodies.CreateReportBody")
	}
	if _, ok := c.Headers["RateLimitLimit"]; !ok {
		t.Errorf("Missing components.headers.RateLimitLimit")
	}
	if _, ok := c.Examples["ReportExample"]; !ok {
		t.Errorf("Missing components.examples.ReportExample")
	}
	if _, ok := c.Links["UserReportLink"]; !ok {
		t.Errorf("Missing components.links.UserReportLink")
	}
	if _, ok := c.Callbacks["ReportStatusWebhook"]; !ok {
		t.Errorf("Missing components.callbacks.ReportStatusWebhook")
	}

	// 6. Schema validation fields
	repSchema := c.Schemas["ReportRequest"]
	if repSchema == nil {
		t.Fatalf("Missing ReportRequest schema")
	}
	nameProp := repSchema.Properties["name"]
	if nameProp.MinLength == nil || *nameProp.MinLength != 3 || nameProp.Pattern != "^[a-zA-Z0-9_-]+$" {
		t.Errorf("nameProp constraints parsed incorrectly: %+v", nameProp)
	}
	catProp := repSchema.Properties["categories"]
	if catProp.MinItems == nil || *catProp.MinItems != 1 || catProp.UniqueItems == nil || !*catProp.UniqueItems {
		t.Errorf("catProp array constraints parsed incorrectly: %+v", catProp)
	}
	factorProp := repSchema.Properties["factor"]
	if factorProp.MultipleOf == nil || *factorProp.MultipleOf != 0.5 || factorProp.ExclusiveMinimum == nil || !*factorProp.ExclusiveMinimum {
		t.Errorf("factorProp numeric constraints parsed incorrectly: %+v", factorProp)
	}
	if !repSchema.Properties["readOnlyId"].ReadOnly {
		t.Errorf("Expected readOnlyId to have readOnly=true")
	}
	if !repSchema.Properties["secretToken"].WriteOnly {
		t.Errorf("Expected secretToken to have writeOnly=true")
	}
	if repSchema.Properties["xmlMetadata"].XML == nil || !repSchema.Properties["xmlMetadata"].XML.Wrapped {
		t.Errorf("Expected xmlMetadata to have XML.Wrapped=true")
	}
	if !repSchema.Properties["legacyFlag"].Deprecated {
		t.Errorf("Expected legacyFlag to have deprecated=true")
	}

	// 7. Test Indexer and Path-Level Parameter Inheritance
	idx := spec.NewIndexer(&s)
	ep, ok := idx.FindEndpoint("/organizations/{org_id}/reports", "GET")
	if !ok {
		t.Fatalf("Failed to find indexed endpoint")
	}

	// Check that path-level param (org_id) was inherited into operation params
	foundOrgId := false
	foundStatus := false
	for _, p := range ep.Operation.Parameters {
		if p.Name == "org_id" && p.In == "path" && p.Required {
			foundOrgId = true
		}
		if p.Name == "status" && p.In == "query" && p.AllowEmptyValue && p.Explode != nil && *p.Explode {
			foundStatus = true
		}
	}
	if !foundOrgId {
		t.Errorf("Path-level parameter 'org_id' was not inherited into operation parameters")
	}
	if !foundStatus {
		t.Errorf("Operation parameter 'status' with allowEmptyValue and explode was not preserved")
	}

	// Check TRACE method indexing
	traceEp, okTrace := idx.FindEndpoint("/organizations/{org_id}/reports", "TRACE")
	if !okTrace || traceEp.OperationID != "traceReports" {
		t.Errorf("TRACE operation was not properly indexed")
	}

	// Check component getters
	paramComp, okParam := idx.GetParameter("OrgIdHeader")
	if !okParam || paramComp.Name != "X-Org-ID" {
		t.Errorf("GetParameter failed to return OrgIdHeader")
	}
	respComp, okResp := idx.GetResponse("NotFoundResponse")
	if !okResp || respComp.Description != "Entity was not found" {
		t.Errorf("GetResponse failed to return NotFoundResponse")
	}
	secComp, okSec := idx.GetSecurityScheme("ApiKeyAuth")
	if !okSec || secComp.Name != "X-API-KEY" {
		t.Errorf("GetSecurityScheme failed to return ApiKeyAuth")
	}
}
