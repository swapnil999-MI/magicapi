package generator

import (
	"fmt"
	"strings"

	"openapi-doc-studio/internal/spec"
)

type MediaGenerator struct{}

func NewMediaGenerator() *MediaGenerator {
	return &MediaGenerator{}
}

func (mg *MediaGenerator) Generate(ep *spec.IndexedEndpoint) string {
	if ep == nil || ep.Operation == nil {
		return "// Endpoint not found"
	}

	baseName := sanitizeIdentifier(ep.OperationID)
	if baseName == "" {
		baseName = sanitizeIdentifier(ep.Method + "_" + strings.ReplaceAll(ep.Path, "/", "_"))
	}
	urlFormatted := formatPathForJS(ep.Path)

	isUpload := false
	if ep.Operation.RequestBody != nil {
		for contentType := range ep.Operation.RequestBody.Content {
			if strings.Contains(contentType, "multipart/form-data") {
				isUpload = true
				break
			}
		}
	}

	isDownload := false
	for _, resp := range ep.Operation.Responses {
		for contentType := range resp.Content {
			if strings.Contains(contentType, "octet-stream") ||
				strings.Contains(contentType, "pdf") ||
				strings.Contains(contentType, "csv") ||
				strings.Contains(contentType, "excel") ||
				strings.Contains(contentType, "spreadsheet") {
				isDownload = true
				break
			}
		}
	}

	var sb strings.Builder
	sb.WriteString("import axios, { AxiosProgressEvent } from 'axios';\n\n")

	if isUpload {
		sb.WriteString(fmt.Sprintf("/**\n * File Upload Helper for %s\n */\n", ep.Path))
		sb.WriteString(fmt.Sprintf("export async function upload%s(\n", baseName))
		sb.WriteString("  payload: Record<string, any>,\n")
		sb.WriteString("  files: Record<string, File | Blob>,\n")
		sb.WriteString("  onProgress?: (progress: number) => void\n")
		sb.WriteString("): Promise<any> {\n")
		sb.WriteString("  const formData = new FormData();\n\n")
		sb.WriteString("  Object.entries(payload).forEach(([key, val]) => {\n")
		sb.WriteString("    if (val !== undefined && val !== null) {\n")
		sb.WriteString("      formData.append(key, typeof val === 'object' ? JSON.stringify(val) : String(val));\n")
		sb.WriteString("    }\n  });\n\n")
		sb.WriteString("  Object.entries(files).forEach(([field, file]) => {\n")
		sb.WriteString("    formData.append(field, file);\n  });\n\n")
		sb.WriteString(fmt.Sprintf("  const res = await axios.post(`%s`, formData, {\n", urlFormatted))
		sb.WriteString("    headers: { 'Content-Type': 'multipart/form-data' },\n")
		sb.WriteString("    onUploadProgress: (e: AxiosProgressEvent) => {\n")
		sb.WriteString("      if (e.total && onProgress) {\n")
		sb.WriteString("        onProgress(Math.round((e.loaded * 100) / e.total));\n")
		sb.WriteString("      }\n    },\n  });\n")
		sb.WriteString("  return res.data;\n}\n\n")
	}

	if isDownload {
		sb.WriteString(fmt.Sprintf("/**\n * Binary / File Download Helper for %s\n */\n", ep.Path))
		sb.WriteString(fmt.Sprintf("export async function download%s(params: Record<string, any>, defaultFilename = 'download.csv') {\n", baseName))
		sb.WriteString(fmt.Sprintf("  const res = await axios.get(`%s`, {\n", urlFormatted))
		sb.WriteString("    params,\n")
		sb.WriteString("    responseType: 'blob',\n")
		sb.WriteString("  });\n\n")
		sb.WriteString("  let filename = defaultFilename;\n")
		sb.WriteString("  const disposition = res.headers['content-disposition'];\n")
		sb.WriteString("  if (disposition && disposition.indexOf('filename=') !== -1) {\n")
		sb.WriteString("    const matches = disposition.match(/filename[^;=\\n]*=((['\"]).*?\\2|[^;\\n]*)/);\n")
		sb.WriteString("    if (matches && matches[1]) {\n")
		sb.WriteString("      filename = matches[1].replace(/['\"]/g, '');\n")
		sb.WriteString("    }\n  }\n\n")
		sb.WriteString("  const blobUrl = window.URL.createObjectURL(new Blob([res.data]));\n")
		sb.WriteString("  const link = document.createElement('a');\n")
		sb.WriteString("  link.href = blobUrl;\n")
		sb.WriteString("  link.setAttribute('download', filename);\n")
		sb.WriteString("  document.body.appendChild(link);\n")
		sb.WriteString("  link.click();\n")
		sb.WriteString("  link.parentNode?.removeChild(link);\n")
		sb.WriteString("  window.URL.revokeObjectURL(blobUrl);\n}\n")
	}

	if !isUpload && !isDownload {
		sb.WriteString(fmt.Sprintf("// Endpoint %s is not marked as multipart upload or binary download\n", ep.Path))
	}

	return sb.String()
}
