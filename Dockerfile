# ==========================================
# Stage 1: Build React Frontend UI with Bun
# ==========================================
FROM --platform=$BUILDPLATFORM oven/bun:alpine AS frontend-builder

WORKDIR /build/frontend

# Copy frontend package manifests and bun lockfile
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile

# Copy frontend source code & assets
COPY frontend/ ./

# Build production bundle (outputs to /build/dist)
RUN bun run build

# ==========================================
# Stage 2: Compile Unified Go Server Binary
# ==========================================
FROM golang:alpine AS backend-builder

WORKDIR /build

# Copy Go dependency manifests
COPY go.mod go.sum ./
RUN go mod download

# Copy backend source code & embedded static files
COPY internal/ ./internal/
COPY main.go ./

# Copy built frontend bundle from Stage 1 into /build/dist
COPY --from=frontend-builder /build/dist ./dist

# Compile standalone static binary with optimizations and UPX compression
RUN apk add --no-cache upx && \
    CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-w -s" -o /app/magicapi main.go && \
    upx --best --lzma /app/magicapi

# ==========================================
# Stage 3: Ultra-Minimal Production Runtime
# ==========================================
FROM alpine:3.21

LABEL org.opencontainers.image.title="MagicAPI" \
      org.opencontainers.image.description="High-performance Interactive OpenAPI Studio, Documentation Portal & MCP Protocol Engine" \
      org.opencontainers.image.authors="MagicAPI Open Source Team" \
      org.opencontainers.image.licenses="MIT"

WORKDIR /app

# Install root TLS certificates and create non-root user
RUN apk add --no-cache ca-certificates && \
    addgroup -S magicapi && adduser -S magicapi -G magicapi

# Copy binary and default spec directly with non-root ownership (prevents layer duplication)
COPY --from=backend-builder --chown=magicapi:magicapi /app/magicapi /app/magicapi
COPY --chown=magicapi:magicapi openapi.yaml /app/openapi.yaml

USER magicapi:magicapi

# Expose HTTP (TCP) and HTTP/3 QUIC (UDP) on default port 8085
EXPOSE 8085/tcp 8085/udp

ENV PORT=8085 \
    HOST=0.0.0.0 \
    MODE=network \
    ENABLE_HTTP3=true \
    OPENAPI_SPEC_PATH=/app/openapi.yaml

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O - http://localhost:${PORT}/health || exit 1

ENTRYPOINT ["/app/magicapi"]
CMD ["-spec", "/app/openapi.yaml"]
