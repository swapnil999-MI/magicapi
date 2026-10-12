package spec

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"gopkg.in/yaml.v3"
)

var remoteSpecClient = &http.Client{Timeout: 30 * time.Second}

type Loader struct {
	specPath     string
	mu           sync.RWMutex
	spec         *OpenAPISpec
	rawData      []byte
	lastModified time.Time
	onReload     func(*OpenAPISpec)
}

func NewLoader(specPath string, onReload func(*OpenAPISpec)) (*Loader, error) {
	l := &Loader{
		specPath: specPath,
		onReload: onReload,
	}

	if err := l.Reload(); err != nil {
		return nil, err
	}

	go l.startWatcher()

	return l, nil
}

func (l *Loader) GetSpec() *OpenAPISpec {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.spec
}

func (l *Loader) GetRawData() []byte {
	l.mu.RLock()
	defer l.mu.RUnlock()
	return l.rawData
}

func (l *Loader) Reload() error {
	var data []byte
	var err error

	if strings.HasPrefix(l.specPath, "http://") || strings.HasPrefix(l.specPath, "https://") {
		resp, httpErr := remoteSpecClient.Get(l.specPath)
		if httpErr != nil {
			return fmt.Errorf("failed to fetch remote spec from %s: %w", l.specPath, httpErr)
		}
		defer resp.Body.Close()
		// Never replace the current spec with an error page
		if resp.StatusCode < 200 || resp.StatusCode > 299 {
			return fmt.Errorf("failed to fetch remote spec from %s: HTTP %s", l.specPath, resp.Status)
		}
		data, err = io.ReadAll(resp.Body)
		if err != nil {
			return fmt.Errorf("failed to read remote spec response: %w", err)
		}
	} else {
		// Local file search fallback
		resolvedPath := l.resolveLocalPath(l.specPath)
		info, statErr := os.Stat(resolvedPath)
		if statErr != nil {
			return fmt.Errorf("spec file not found at %s (resolved: %s): %w", l.specPath, resolvedPath, statErr)
		}
		l.lastModified = info.ModTime()
		data, err = os.ReadFile(resolvedPath)
		if err != nil {
			return fmt.Errorf("failed to read spec file %s: %w", resolvedPath, err)
		}
	}

	var parsed OpenAPISpec
	if err := yaml.Unmarshal(data, &parsed); err != nil {
		if jsonErr := json.Unmarshal(data, &parsed); jsonErr != nil {
			return fmt.Errorf("failed to parse spec as YAML (%v) or JSON (%v)", err, jsonErr)
		}
	}
	if parsed.OpenAPI == "" && len(parsed.Paths) == 0 {
		return fmt.Errorf("document at %s is not an OpenAPI specification (no 'openapi' version or paths)", l.specPath)
	}

	l.mu.Lock()
	l.spec = &parsed
	l.rawData = data
	l.mu.Unlock()

	if l.onReload != nil {
		l.onReload(&parsed)
	}

	log.Printf("Successfully loaded OpenAPI specification (%d paths, %d components)", len(parsed.Paths), len(parsed.Components.Schemas))
	return nil
}

func (l *Loader) resolveLocalPath(path string) string {
	if _, err := os.Stat(path); err == nil {
		return path
	}

	candidates := []string{
		path,
		filepath.Join("openapi.yaml"),
		filepath.Join("openapi.json"),
		filepath.Join("docs", "openapi.yaml"),
		filepath.Join("docs", "openapi.json"),
		filepath.Join("examples", "openapi.yaml"),
		filepath.Join("examples", "openapi.json"),
	}

	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	return path
}

func (l *Loader) startWatcher() {
	if strings.HasPrefix(l.specPath, "http://") || strings.HasPrefix(l.specPath, "https://") {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			_ = l.Reload()
		}
		return
	}

	resolved := l.resolveLocalPath(l.specPath)
	ticker := time.NewTicker(3 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		info, err := os.Stat(resolved)
		if err == nil && info.ModTime().After(l.lastModified) {
			log.Printf("Detected changes in %s, reloading OpenAPI spec...", resolved)
			_ = l.Reload()
		}
	}
}

func (l *Loader) ResolveSchema(s *Schema) *Schema {
	if s == nil {
		return nil
	}
	if s.Ref == "" {
		return s
	}

	ref := strings.TrimPrefix(s.Ref, "#/components/schemas/")
	l.mu.RLock()
	defer l.mu.RUnlock()

	if l.spec != nil && l.spec.Components.Schemas != nil {
		if target, ok := l.spec.Components.Schemas[ref]; ok {
			return target
		}
	}
	return s
}
