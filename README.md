<p align="center">
  <img src="https://iili.io/nHoHNQS.png" alt="MagicAPI Logo" width="380" />
</p>

<h1 align="center">✨ MagicAPI Studio & MCP Protocol Engine</h1>

> A high-performance, single-binary **Interactive API Studio**, **Documentation Portal**, and **Model Context Protocol (MCP) Server** with HTTP/3 (QUIC) support for OpenAPI 3.0+ specifications.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](#-license)
[![Docker Image](https://img.shields.io/badge/Docker-swapnilmi%2Fmagicapi-2496ED.svg?logo=docker&logoColor=white)](https://hub.docker.com/r/swapnilmi/magicapi)
[![OpenAPI 3.0](https://img.shields.io/badge/OpenAPI-3.0.3-green.svg)](https://swagger.io/specification/)
[![Go](https://img.shields.io/badge/Go-1.27+-00ADD8.svg?logo=go&logoColor=white)](https://golang.org)
[![HTTP/3](https://img.shields.io/badge/HTTP%2F3-QUIC-8A2BE2.svg)](https://quic-go.net)

---

## 🌟 Key Capabilities

- ⚡ **All-In-One Unified Engine (Single Port `8085`)**:
  - **Interactive API Studio (`/api`)**: Multi-tab workspace, Monaco JSON editor, auto-token chaining, response diff analyzer, and dynamic variable interpolation (`{{var}}`).
  - **3-Column Documentation Reference (`/docs`)**: Modern Stripe/Scalar-inspired API documentation with schema models, enum badges, and 5-language code snippets.
  - **Visual Workflow Studio (`/workflow`)**: Interactive sequential step chaining and API scenario runner.
  - **AI Model Context Protocol (`/sse`)**: Connect Cursor, Claude Desktop, Antigravity, and Windsurf directly to your OpenAPI spec with 15 specialized code-generation tools.
  - **HTTP/3 (QUIC) Support**: 0-RTT handshakes, multiplexing without head-of-line blocking over UDP port `8085`.
- 📦 **Single Standalone Static Binary (~11 MB)**: Zero external runtime dependencies. The entire React frontend and Monaco editor are compiled directly inside the Go executable via `//go:embed`.
- 🐳 **Ultra-Lightweight Docker Container (~16 MB)**: Multi-stage Alpine container ready for 1-command deployment.

---

## ⚡ 1-Command Docker Hub Quickstart

Run directly without installing Go or Node.js:

```bash
docker run -d \
  --name magicapi \
  -p 8085:8085 \
  -p 8085:8085/udp \
  -v $(pwd)/openapi.yaml:/app/openapi.yaml:ro \
  swapnilmi/magicapi:latest
```

Open in your browser:
- 💻 **API Studio**: [http://localhost:8085/api](http://localhost:8085/api)
- 📖 **Docs Portal**: [http://localhost:8085/docs](http://localhost:8085/docs)
- ⚡ **Workflow Studio**: [http://localhost:8085/workflow](http://localhost:8085/workflow)
- 🤖 **MCP Endpoint**: `http://localhost:8085/sse`

---

## 🐳 Docker Compose

Create a `docker-compose.yml`:

```yaml
services:
  magicapi:
    image: swapnilmi/magicapi:latest
    container_name: magicapi-studio
    ports:
      - "8085:8085/tcp"
      - "8085:8085/udp"
    environment:
      - PORT=8085
      - OPENAPI_SPEC_PATH=/app/openapi.yaml
    volumes:
      - ./openapi.yaml:/app/openapi.yaml:ro
    restart: unless-stopped
```

Start the service:
```bash
docker compose up -d
```

---

## 🛠️ Building From Source

### Prerequisites
- [Go 1.27+](https://golang.org/dl/)
- [Bun](https://bun.sh) (recommended) or [Node.js 20+](https://nodejs.org)
- [Docker](https://www.docker.com) *(optional, for container builds)*

### 1. Build the Standalone Binary

```bash
# Clone the repository
git clone https://github.com/your-org/magicapi.git
cd magicapi

# Build both React bundle and Go binary
make build

# Run with your OpenAPI spec
./bin/magicapi -spec path/to/openapi.yaml
```

### 2. Build & Push Docker Image to Docker Hub

```bash
# Build and push to your Docker Hub repository
./scripts/publish_docker.sh <your-dockerhub-username> v1.0.0
```

---

## 🤖 Connecting to AI IDEs (MCP Protocol)

### Cursor (`.cursor/mcp.json`)
```json
{
  "mcpServers": {
    "magicapi": {
      "url": "http://localhost:8085/sse"
    }
  }
}
```

### Claude Desktop (`claude_desktop_config.json`)
```json
{
  "mcpServers": {
    "magicapi": {
      "command": "/path/to/magicapi",
      "args": ["-stdio", "-spec", "/path/to/openapi.yaml"]
    }
  }
}
```

---

## 🧰 Available MCP Tools

| Tool | Description |
|---|---|
| `search_endpoints` | Search endpoints by keywords, tags, or HTTP methods |
| `get_endpoint_details` | Full request body schema, path/query params, headers, and responses |
| `get_schema_types` | Generates TypeScript interfaces, types, enums, and JSDoc comments |
| `generate_client_code` | Generates TanStack React Query v5 hooks, Axios, SWR, or Fetch clients |
| `generate_query_keys` | Generates centralized Query Key Factory for cache invalidation |
| `generate_form_integration` | Generates Zod validation schemas & React Hook Form bindings |
| `generate_pagination_hook` | Generates paginated and infinite scroll data fetching logic |
| `generate_media_integration` | Multipart `FormData` uploaders and Blob/CSV download handlers |
| `get_mock_data` | Generates realistic mock JSON payloads for instant frontend prototyping |
| `get_error_matrix` | Error status codes and ready-to-use toast notification handlers |

---

## 📄 License

```text
MIT License

Copyright (c) 2026 MagicAPI Authors & Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
