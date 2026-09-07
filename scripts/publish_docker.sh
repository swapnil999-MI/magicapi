#!/usr/bin/env bash
set -e

# ==============================================================================
# MagicAPI Docker Build & Push Helper
# Usage:
#   ./scripts/publish_docker.sh <your-dockerhub-username> [version-tag]
#
# Examples:
#   ./scripts/publish_docker.sh yourname
#   ./scripts/publish_docker.sh yourname v1.0.0
# ==============================================================================

DOCKER_USER="${1:-}"
VERSION="${2:-v1.0.0}"

if [ -z "$DOCKER_USER" ]; then
  echo "❌ Error: Docker Hub username is required."
  echo ""
  echo "Usage:"
  echo "  $0 <your-dockerhub-username> [version-tag]"
  echo ""
  echo "Example:"
  echo "  $0 john_doe v1.0.0"
  exit 1
fi

IMAGE_NAME="${DOCKER_USER}/magicapi"

echo "========================================================"
echo "🚀 Building & Publishing MagicAPI Docker Image"
echo "📦 Image:    ${IMAGE_NAME}"
echo "🏷️  Tags:     ${VERSION}, latest"
echo "========================================================"

# Check if logged in to Docker Hub
echo "🔑 Checking Docker Hub authentication..."
docker login

# Build multi-platform or standard local image
echo "🔨 Building Docker image..."
docker build \
  -t "${IMAGE_NAME}:${VERSION}" \
  -t "${IMAGE_NAME}:latest" \
  .

echo "⬆️  Pushing images to Docker Hub..."
docker push "${IMAGE_NAME}:${VERSION}"
docker push "${IMAGE_NAME}:latest"

echo "========================================================"
echo "✅ Successfully published to Docker Hub!"
echo "🌐 Users can now run:"
echo "   docker run -d -p 8085:8085 -p 8085:8085/udp -v \$(pwd)/openapi.yaml:/app/openapi.yaml ${IMAGE_NAME}:latest"
echo "========================================================"
