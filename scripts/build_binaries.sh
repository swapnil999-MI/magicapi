#!/bin/bash
set -e

echo "🚀 Step 1: Building Frontend Assets with Bun..."
cd frontend
bun run build
cd ..

echo "📦 Step 2: Creating Output Directory..."
mkdir -p bin

echo "🔨 Step 3: Compiling Standalone Executables..."

# Windows .exe (64-bit)
echo "   --> Building Windows (bin/openapi-doc-studio.exe)..."
GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o bin/openapi-doc-studio.exe .

# macOS (Apple Silicon ARM64)
echo "   --> Building macOS ARM64 (bin/openapi-doc-studio-darwin-arm64)..."
GOOS=darwin GOARCH=arm64 go build -ldflags="-s -w" -o bin/openapi-doc-studio-darwin-arm64 .

# macOS (Intel x86_64)
echo "   --> Building macOS Intel (bin/openapi-doc-studio-darwin-amd64)..."
GOOS=darwin GOARCH=amd64 go build -ldflags="-s -w" -o bin/openapi-doc-studio-darwin-amd64 .

# Linux (64-bit)
echo "   --> Building Linux (bin/openapi-doc-studio-linux-amd64)..."
GOOS=linux GOARCH=amd64 go build -ldflags="-s -w" -o bin/openapi-doc-studio-linux-amd64 .

echo ""
echo "✅ Build Complete! Unified executables generated in ./bin/:"
ls -lh bin/
