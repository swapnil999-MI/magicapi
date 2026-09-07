#!/usr/bin/env python3
"""
Modular OpenAPI Specification & Postman Collection Compiler
Combines modular YAML files in a paths directory into:
1. `openapi.yaml` (Complete single-file specification)
2. `openapi.json` (JSON specification)
3. `postman_collection.json` (v2.1 Postman / Bruno collection)
"""

import os
import glob
import json
import yaml

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
EXAMPLES_DIR = os.path.join(ROOT_DIR, "examples")
PATHS_DIR = os.path.join(EXAMPLES_DIR, "modular-paths")
OUT_YAML = os.path.join(EXAMPLES_DIR, "openapi.yaml")
OUT_JSON = os.path.join(EXAMPLES_DIR, "openapi.json")
OUT_POSTMAN = os.path.join(EXAMPLES_DIR, "postman_collection.json")

def load_yaml(filepath):
    if not os.path.exists(filepath):
        return {}
    with open(filepath, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}

def build_openapi():
    print("📦 Bundling OpenAPI documentation from modular YAML files...")
    
    doc = {
        "openapi": "3.0.3",
        "info": {
            "title": "OpenAPI Doc Studio Demo API",
            "version": "1.0.0",
            "description": "High-performance API documented with OpenAPI Doc Studio."
        },
        "servers": [
            {
                "url": "http://localhost:8000/api/v1",
                "description": "Local Development Server"
            },
            {
                "url": "https://api.example.com/v1",
                "description": "Production Server"
            }
        ],
        "components": {
            "securitySchemes": {
                "BearerAuth": {
                    "type": "http",
                    "scheme": "bearer",
                    "bearerFormat": "JWT"
                }
            }
        },
        "paths": {}
    }

    paths = {}
    yaml_files = sorted(glob.glob(os.path.join(PATHS_DIR, "*.yaml")))
    for yf in yaml_files:
        p_dict = load_yaml(yf)
        filename = os.path.basename(yf)
        count = len(p_dict)
        print(f"  ✓ Loaded {count:2d} routes from {filename}")
        paths.update(p_dict)
    
    doc["paths"] = paths

    # 1. Output openapi.yaml
    with open(OUT_YAML, "w", encoding="utf-8") as f:
        yaml.dump(doc, f, sort_keys=False, allow_unicode=True)
    print(f"✅ Generated {OUT_YAML} ({len(paths)} paths)")

    # 2. Output openapi.json
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=2, ensure_ascii=False)
    print(f"✅ Generated {OUT_JSON} ({len(paths)} paths)")

    # 3. Output Postman Collection
    build_postman_collection(doc)

def build_postman_collection(openapi_doc):
    print("🚀 Generating Postman Collection v2.1...")
    collection = {
        "info": {
            "name": openapi_doc.get("info", {}).get("title", "API Collection"),
            "_postman_id": "openapi-doc-studio-collection",
            "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
        },
        "item": []
    }
    
    tag_folders = {}
    for path, methods in openapi_doc.get("paths", {}).items():
        for method, op in methods.items():
            if method.lower() not in ["get", "post", "put", "delete", "patch"]:
                continue
            tag = (op.get("tags") and op["tags"][0]) or "General"
            if tag not in tag_folders:
                tag_folders[tag] = []
            
            tag_folders[tag].append({
                "name": op.get("summary", path),
                "request": {
                    "method": method.upper(),
                    "url": {
                        "raw": "{{baseUrl}}" + path,
                        "host": ["{{baseUrl}}"],
                        "path": [p for p in path.strip("/").split("/") if p]
                    },
                    "description": op.get("description", "")
                }
            })
    
    for tag, items in tag_folders.items():
        collection["item"].append({
            "name": tag,
            "item": items
        })

    with open(OUT_POSTMAN, "w", encoding="utf-8") as f:
        json.dump(collection, f, indent=2, ensure_ascii=False)
    print(f"✅ Generated {OUT_POSTMAN}")

if __name__ == "__main__":
    build_openapi()
