package spec_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"openapi-doc-studio/internal/spec"
)

func TestRemoteReloadKeepsSpecOnBadResponse(t *testing.T) {
	body := "openapi: 3.0.3\ninfo: {title: Remote, version: '1'}\npaths:\n  /a: {get: {responses: {'200': {description: ok}}}}\n"
	status := http.StatusOK
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(status)
		w.Write([]byte(body))
	}))
	defer srv.Close()

	loader, err := spec.NewLoader(srv.URL, nil)
	if err != nil {
		t.Fatalf("initial load failed: %v", err)
	}

	// Server error with a JSON body must not replace the loaded spec
	status, body = http.StatusInternalServerError, `{"error":"boom"}`
	if err := loader.Reload(); err == nil {
		t.Error("expected reload to fail on HTTP 500")
	}

	// A 200 that is not an OpenAPI document must not replace it either
	status = http.StatusOK
	if err := loader.Reload(); err == nil {
		t.Error("expected reload to fail on non-OpenAPI document")
	}

	if got := len(loader.GetSpec().Paths); got != 1 {
		t.Errorf("spec should still have 1 path, got %d", got)
	}
}
