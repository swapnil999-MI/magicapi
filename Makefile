# ==========================================
# MagicAPI Studio & MCP Server Makefile
# ==========================================

BINARY_NAME=magicapi
DOCKER_USER ?= swapnilmi
IMAGE_NAME=$(DOCKER_USER)/magicapi
VERSION ?= v1.0.0

.PHONY: all build build-frontend build-backend run test docker-build docker-run docker-push clean

all: build

# 1. Build frontend React bundle
build-frontend:
	@echo "📦 Building frontend React bundle..."
	@cd frontend && bun run build || npm run build

# 2. Build Go binary with embedded frontend
build-backend:
	@echo "🔨 Compiling standalone Go binary..."
	@CGO_ENABLED=0 go build -trimpath -ldflags="-w -s" -o bin/$(BINARY_NAME) main.go
	@echo "✅ Built binary: bin/$(BINARY_NAME)"

# 3. Full build (Frontend + Backend)
build: build-frontend build-backend

# 4. Run locally with spec
run:
	@go run main.go -spec openapi.yaml

# 5. Run tests
test:
	@go test -v ./...

# 6. Docker build
docker-build:
	@echo "🐳 Building Docker image $(IMAGE_NAME):latest and $(IMAGE_NAME):$(VERSION)..."
	@docker build -t $(IMAGE_NAME):latest -t $(IMAGE_NAME):$(VERSION) .

# 7. Docker run
docker-run:
	@echo "🚀 Running MagicAPI in Docker container on port 8085..."
	@docker run -d --rm -p 8085:8085 -p 8085:8085/udp -v $(PWD)/openapi.yaml:/app/openapi.yaml:ro --name magicapi-studio $(IMAGE_NAME):latest

# 8. Push to Docker Hub
docker-push: docker-build
	@echo "⬆️  Pushing $(IMAGE_NAME) to Docker Hub..."
	@docker push $(IMAGE_NAME):$(VERSION)
	@docker push $(IMAGE_NAME):latest
	@echo "✅ Published $(IMAGE_NAME):latest to Docker Hub!"

# 9. Clean artifacts
clean:
	@rm -rf bin dist
	@echo "🧹 Cleaned bin/ and dist/"
