package spec

import (
	"sort"
	"strings"
	"sync"
)

type Indexer struct {
	mu           sync.RWMutex
	endpoints    []IndexedEndpoint
	byPathMethod map[string]*IndexedEndpoint
	byTag        map[string][]IndexedEndpoint
	schemas      map[string]*Schema
	parameters   map[string]*Parameter
	responses    map[string]*Response
	secSchemes   map[string]*SecurityScheme
	tags         []Tag
}

func NewIndexer(spec *OpenAPISpec) *Indexer {
	idx := &Indexer{
		byPathMethod: make(map[string]*IndexedEndpoint),
		byTag:        make(map[string][]IndexedEndpoint),
		schemas:      make(map[string]*Schema),
		parameters:   make(map[string]*Parameter),
		responses:    make(map[string]*Response),
		secSchemes:   make(map[string]*SecurityScheme),
	}
	if spec != nil {
		idx.Reindex(spec)
	}
	return idx
}

func (idx *Indexer) Reindex(spec *OpenAPISpec) {
	idx.mu.Lock()
	defer idx.mu.Unlock()

	idx.endpoints = make([]IndexedEndpoint, 0)
	idx.byPathMethod = make(map[string]*IndexedEndpoint)
	idx.byTag = make(map[string][]IndexedEndpoint)
	idx.schemas = make(map[string]*Schema)
	idx.parameters = make(map[string]*Parameter)
	idx.responses = make(map[string]*Response)
	idx.secSchemes = make(map[string]*SecurityScheme)
	idx.tags = spec.Tags

	for name, schema := range spec.Components.Schemas {
		idx.schemas[name] = schema
	}
	for name, param := range spec.Components.Parameters {
		pCopy := param
		idx.parameters[name] = &pCopy
	}
	for name, resp := range spec.Components.Responses {
		rCopy := resp
		idx.responses[name] = &rCopy
	}
	for name, sec := range spec.Components.SecuritySchemes {
		sCopy := sec
		idx.secSchemes[name] = &sCopy
	}

	knownTags := make(map[string]bool)
	for _, t := range spec.Tags {
		knownTags[t.Name] = true
	}

	for path, item := range spec.Paths {
		for method, op := range item.Operations() {
			// Inherit path-level parameters into operation if not overridden
			if len(item.Parameters) > 0 {
				existingParams := make(map[string]bool)
				for _, p := range op.Parameters {
					existingParams[p.In+":"+p.Name] = true
				}
				var mergedParams []Parameter
				for _, p := range item.Parameters {
					if !existingParams[p.In+":"+p.Name] {
						mergedParams = append(mergedParams, p)
					}
				}
				mergedParams = append(mergedParams, op.Parameters...)
				op.Parameters = mergedParams
			}

			// Inherit path-level or root-level servers if not defined on operation
			if len(op.Servers) == 0 {
				if len(item.Servers) > 0 {
					op.Servers = item.Servers
				} else if len(spec.Servers) > 0 {
					op.Servers = spec.Servers
				}
			}

			// Inherit root-level security if not defined on operation
			if len(op.Security) == 0 && len(spec.Security) > 0 {
				op.Security = spec.Security
			}

			ep := IndexedEndpoint{
				Path:        path,
				Method:      strings.ToUpper(method),
				Summary:     op.Summary,
				Description: op.Description,
				OperationID: op.OperationID,
				Tags:        op.Tags,
				Operation:   op,
			}
			if ep.Summary == "" {
				ep.Summary = item.Summary
			}
			if ep.Description == "" {
				ep.Description = item.Description
			}

			key := strings.ToUpper(method) + ":" + strings.TrimRight(path, "/")
			idx.endpoints = append(idx.endpoints, ep)
			idx.byPathMethod[key] = &idx.endpoints[len(idx.endpoints)-1]

			for _, tag := range op.Tags {
				idx.byTag[tag] = append(idx.byTag[tag], ep)
				if !knownTags[tag] && tag != "" {
					idx.tags = append(idx.tags, Tag{Name: tag, Description: tag + " APIs"})
					knownTags[tag] = true
				}
			}
		}
	}
}

func (idx *Indexer) FindEndpoint(path, method string) (*IndexedEndpoint, bool) {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	cleanPath := strings.TrimRight(strings.TrimSpace(path), "/")
	cleanMethod := strings.ToUpper(strings.TrimSpace(method))

	key := cleanMethod + ":" + cleanPath
	if ep, ok := idx.byPathMethod[key]; ok {
		return ep, true
	}

	// Try case-insensitive or parameter format matching (/clients/{id} vs /clients/:id)
	normPath := normalizePath(cleanPath)
	for k, ep := range idx.byPathMethod {
		parts := strings.SplitN(k, ":", 2)
		if len(parts) == 2 && (cleanMethod == "" || parts[0] == cleanMethod) {
			if normalizePath(parts[1]) == normPath {
				return ep, true
			}
		}
	}

	return nil, false
}

func (idx *Indexer) Search(query string, tag string, method string, limit int) []IndexedEndpoint {
	idx.mu.RLock()
	defer idx.mu.RUnlock()

	if limit <= 0 {
		limit = 15
	}

	cleanQuery := strings.ToLower(strings.TrimSpace(query))
	cleanTag := strings.ToLower(strings.TrimSpace(tag))
	cleanMethod := strings.ToUpper(strings.TrimSpace(method))

	queryTokens := strings.Fields(cleanQuery)

	type scored struct {
		ep    IndexedEndpoint
		score int
	}

	var results []scored

	for _, ep := range idx.endpoints {
		if cleanMethod != "" && ep.Method != cleanMethod {
			continue
		}

		if cleanTag != "" {
			tagMatched := false
			for _, t := range ep.Tags {
				if strings.Contains(strings.ToLower(t), cleanTag) {
					tagMatched = true
					break
				}
			}
			if !tagMatched {
				continue
			}
		}

		if len(queryTokens) == 0 {
			results = append(results, scored{ep: ep, score: 1})
			continue
		}

		score := 0
		pathLower := strings.ToLower(ep.Path)
		summaryLower := strings.ToLower(ep.Summary)
		descLower := strings.ToLower(ep.Description)
		opIDLower := strings.ToLower(ep.OperationID)

		for _, token := range queryTokens {
			if strings.Contains(pathLower, token) {
				score += 50
				if strings.HasPrefix(pathLower, token) {
					score += 20
				}
			}
			if strings.Contains(opIDLower, token) {
				score += 40
			}
			if strings.Contains(summaryLower, token) {
				score += 30
			}
			if strings.Contains(descLower, token) {
				score += 10
			}
			for _, t := range ep.Tags {
				if strings.Contains(strings.ToLower(t), token) {
					score += 25
				}
			}
		}

		if score > 0 {
			results = append(results, scored{ep: ep, score: score})
		}
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].score > results[j].score
	})

	finalCount := limit
	if len(results) < finalCount {
		finalCount = len(results)
	}

	out := make([]IndexedEndpoint, finalCount)
	for i := 0; i < finalCount; i++ {
		out[i] = results[i].ep
		out[i].Score = results[i].score
	}

	return out
}

func (idx *Indexer) GetCategories() []Tag {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	return idx.tags
}

func (idx *Indexer) GetSchema(name string) (*Schema, bool) {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	s, ok := idx.schemas[name]
	return s, ok
}

func (idx *Indexer) GetAllSchemas() map[string]*Schema {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	out := make(map[string]*Schema)
	for k, v := range idx.schemas {
		out[k] = v
	}
	return out
}

func (idx *Indexer) GetParameter(name string) (*Parameter, bool) {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	p, ok := idx.parameters[name]
	return p, ok
}

func (idx *Indexer) GetResponse(name string) (*Response, bool) {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	r, ok := idx.responses[name]
	return r, ok
}

func (idx *Indexer) GetSecurityScheme(name string) (*SecurityScheme, bool) {
	idx.mu.RLock()
	defer idx.mu.RUnlock()
	s, ok := idx.secSchemes[name]
	return s, ok
}

func normalizePath(p string) string {
	parts := strings.Split(strings.Trim(p, "/"), "/")
	for i, part := range parts {
		if strings.HasPrefix(part, "{") && strings.HasSuffix(part, "}") {
			parts[i] = "*"
		} else if strings.HasPrefix(part, ":") {
			parts[i] = "*"
		}
	}
	return strings.Join(parts, "/")
}
