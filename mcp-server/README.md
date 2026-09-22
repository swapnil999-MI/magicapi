# 🚀 MagicAPI MCP Server (Go + Fiber + HTTP/3)

High-performance Model Context Protocol (MCP) server engineered specifically for frontend developers and AI coding assistants (Cursor, Claude Desktop, Antigravity, Windsurf, Copilot).

---

## 🌟 Key Features

1. **Unified Network Server (Single Port `8088`)**:
   - **TCP**: Go Fiber HTTP/2 Server-Sent Events (`/sse`) for local LAN / Wi-Fi / VPN.
   - **UDP**: **HTTP/3 (QUIC)** for ultra-low latency, 0-RTT handshakes, and zero head-of-line blocking across remote networks.
   - Automatic `Alt-Svc: h3=":8088"` protocol negotiation.
2. **Dynamic & Conditional JSON Engine**:
   - Handles polymorphic / discriminated schemas.
   - Generates dynamic form field dependency visibility maps and Zod discriminated union validation schemas.
3. **15 Specialized API Integration Tools**:
   - TypeScript interface and type generation with JSDoc comments.
   - TanStack React Query v5 (`useQuery`, `useMutation`), SWR, Axios, and Next.js Server Actions.
   - Centralized Query Key Factory generators.
   - Paginated and infinite scroll table fetchers.
   - Multipart `FormData` uploaders and Blob CSV file download handlers.
   - Realistic mock JSON response generators.
   - Full error matrix with UI toast notification helpers.
4. **Instant Live Hot-Reloading**:
   - Automatically detects updates to your `openapi.yaml` and re-indexes in milliseconds without restarting.

---

## ⚡ Quick Start

### 1. Build the Binary
```bash
go build -o bin/magicapi-mcp main.go
```

### 2. Start Unified Network Server (for team & remote access)
```bash
./bin/magicapi-mcp --port=8088 --spec="openapi.yaml"
```

### 3. Run in Stdio Mode (for local IDE CLI pipe)
```bash
./bin/magicapi-mcp --stdio
```

---

## 🔌 Connecting Frontend Developers

### In Cursor (`.cursor/mcp.json`):

**Option A: Connecting via your IP over Network (Zero Go install needed for frontend dev)**:
```json
{
  "mcpServers": {
    "magicapi": {
      "url": "http://<YOUR_IP>:8088/sse"
    }
  }
}
```

**Option B: Local Stdio Command**:
```json
{
  "mcpServers": {
    "magicapi": {
      "command": "/path/to/openapi-doc-studio/bin/magicapi-mcp",
      "args": ["--stdio"]
    }
  }
}
```

---

## 🧰 Available MCP Tools

| Tool | Description |
|---|---|
| `search_endpoints` | Search endpoints by keywords, tags, or methods across all 130+ routes |
| `get_endpoint_details` | Full request body, path/query params, headers, and response models |
| `get_schema_types` | Generates TypeScript interfaces, types, enums, and JSDoc comments |
| `get_variant_schema` | Inspects conditional JSON variants (e.g. `gateway_type=CASHFREE`) |
| `get_field_dependencies` | Dynamic form field visibility rules when dropdowns change |
| `generate_client_code` | Generates React Query v5, SWR, Axios, Fetch, or Server Actions |
| `generate_query_keys` | Generates centralized Query Key Factory for cache invalidation |
| `generate_form_integration` | Generates Zod validation schemas & React Hook Form bindings |
| `generate_pagination_hook` | Generates paginated and infinite scroll data fetching logic |
| `generate_media_integration` | FormData uploaders and Blob/CSV download streaming handlers |
| `get_error_matrix` | Error status codes and ready-to-use toast notification handlers |
| `get_auth_config` | Auth headers, permissions, and Axios/Fetch interceptor setup |
| `get_mock_data` | Generates realistic mock JSON payloads for instant UI building |
| `validate_payload` | Validates client JSON against OpenAPI schema before sending |
| `list_api_categories` | Lists all modules, tags, and endpoint counts |
