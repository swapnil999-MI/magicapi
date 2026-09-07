package transport

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"sync"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/filesystem"
	"github.com/google/uuid"
	"github.com/quic-go/quic-go/http3"
	"gopkg.in/yaml.v3"

	"openapi-doc-studio/internal/config"
	"openapi-doc-studio/internal/mcp"
	"openapi-doc-studio/internal/spec"
)

type Session struct {
	ID       string
	MsgChan  chan *mcp.JSONRPCMessage
	DoneChan chan struct{}
}

type UnifiedServer struct {
	cfg      *config.Config
	server   *mcp.Server
	specData *spec.OpenAPISpec
	loader   *spec.Loader
	distFS   fs.FS
	sessions map[string]*Session
	mu       sync.RWMutex
}

func NewUnifiedServer(cfg *config.Config, server *mcp.Server, loader *spec.Loader, distFS fs.FS) *UnifiedServer {
	return &UnifiedServer{
		cfg:      cfg,
		server:   server,
		loader:   loader,
		distFS:   distFS,
		specData: loader.GetSpec(),
		sessions: make(map[string]*Session),
	}
}

func (us *UnifiedServer) Start() error {
	app := fiber.New(fiber.Config{
		AppName:               "MagicAPI Studio & MCP Server",
		DisableStartupMessage: true,
	})

	// CORS Middleware
	corsCfg := cors.Config{
		AllowOrigins: us.cfg.CorsOrigins,
		AllowHeaders: "Origin, Content-Type, Accept, Authorization, Cache-Control",
		AllowMethods: "GET, POST, OPTIONS, HEAD",
	}
	if us.cfg.CorsOrigins != "*" {
		corsCfg.AllowCredentials = true
	}
	app.Use(cors.New(corsCfg))

	app.Use(func(c *fiber.Ctx) error {
		// Announce HTTP/3 QUIC support on the same port
		c.Set("Alt-Svc", fmt.Sprintf(`h3=":%s"; ma=2592000`, us.cfg.Port))
		return c.Next()
	})

	// 1. Health & Server Info Routes
	app.Get("/health", us.handleHealth)
	app.Get("/info", us.handleInfo)

	// 2. MCP Protocol Routes (SSE & POST Message)
	app.Get("/sse", us.handleSSE)
	app.Post("/message", us.handleMessage)

	// 3. OpenAPI Spec Routes (YAML & JSON)
	app.Get("/docs/openapi.yaml", us.handleSpecYAML)
	app.Get("/openapi.yaml", us.handleSpecYAML)
	app.Get("/docs/openapi.json", us.handleSpecJSON)
	app.Get("/openapi.json", us.handleSpecJSON)

	// 4. Postman Collections Routes
	app.Get("/collections/:file", us.handleCollection)

	// 5. Embedded React Client Panel (SPA with HTML5 routing)
	if us.distFS != nil {
		app.Use("/", filesystem.New(filesystem.Config{
			Root:   http.FS(us.distFS),
			Index:  "index.html",
			Browse: false,
		}))

		// Fallback for React HTML5 client-side routing (/docs, /api, /workflow, etc.)
		app.Use(func(c *fiber.Ctx) error {
			indexData, err := fs.ReadFile(us.distFS, "index.html")
			if err != nil {
				return c.Status(fiber.StatusNotFound).SendString("index.html not found in build bundle")
			}
			c.Set("Content-Type", "text/html; charset=utf-8")
			c.Set("Cache-Control", "no-cache, no-store, must-revalidate")
			return c.Status(fiber.StatusOK).Send(indexData)
		})
	}

	addr := fmt.Sprintf("%s:%s", us.cfg.Host, us.cfg.Port)

	// Launch HTTP/3 QUIC in background if enabled
	if us.cfg.EnableHTTP3 {
		go us.startHTTP3Listener()
	}

	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
	fmt.Printf("🚀 OpenAPI Doc Studio & MCP Server (Unified Engine) is RUNNING\n")
	fmt.Printf("💻 Client Panel / Web UI: http://%s:%s\n", us.cfg.Host, us.cfg.Port)
	fmt.Printf("📖 Documentation Portal:  http://%s:%s/docs\n", us.cfg.Host, us.cfg.Port)
	fmt.Printf("⚡ Interactive API Studio: http://%s:%s/api\n", us.cfg.Host, us.cfg.Port)
	fmt.Printf("🤖 MCP Server (SSE):      http://%s:%s/sse\n", us.cfg.Host, us.cfg.Port)
	if us.cfg.EnableHTTP3 {
		fmt.Printf("⚡ UDP / HTTP/3 QUIC:     https://%s:%s/sse (Alt-Svc active)\n", us.cfg.Host, us.cfg.Port)
	}
	fmt.Printf("📄 OpenAPI Spec Source:   %s\n", us.cfg.SpecPath)
	fmt.Println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")

	return app.Listen(addr)
}

func (us *UnifiedServer) handleHealth(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"status":  "ok",
		"service": "magicapi-mcp-server",
		"version": "1.0.0",
		"http3":   us.cfg.EnableHTTP3,
		"spec":    us.loader.GetSpec().Info.Title,
	})
}

func (us *UnifiedServer) handleInfo(c *fiber.Ctx) error {
	specData := us.loader.GetSpec()
	return c.JSON(fiber.Map{
		"title":       specData.Info.Title,
		"version":     specData.Info.Version,
		"description": specData.Info.Description,
		"paths_count": len(specData.Paths),
		"servers":     specData.Servers,
		"tools_count": 13,
		"mcp_url":     fmt.Sprintf("http://%s:%s/sse", us.cfg.Host, us.cfg.Port),
	})
}

func (us *UnifiedServer) handleSSE(c *fiber.Ctx) error {
	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache, no-transform")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")

	sessionID := uuid.New().String()
	sess := &Session{
		ID:       sessionID,
		MsgChan:  make(chan *mcp.JSONRPCMessage, 50),
		DoneChan: make(chan struct{}),
	}

	us.mu.Lock()
	us.sessions[sessionID] = sess
	us.mu.Unlock()

	c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
		defer func() {
			us.mu.Lock()
			delete(us.sessions, sessionID)
			us.mu.Unlock()
			select {
			case <-sess.DoneChan:
			default:
				close(sess.DoneChan)
			}
		}()

		// Send initial endpoint event as required by MCP SSE specification
		endpointURL := fmt.Sprintf("/message?sessionId=%s", sessionID)
		fmt.Fprintf(w, "event: endpoint\ndata: %s\n\n", endpointURL)
		if err := w.Flush(); err != nil {
			return
		}

		for {
			select {
			case msg, ok := <-sess.MsgChan:
				if !ok {
					return
				}
				data, err := json.Marshal(msg)
				if err == nil {
					fmt.Fprintf(w, "event: message\ndata: %s\n\n", string(data))
					if err := w.Flush(); err != nil {
						return
					}
				}
			case <-sess.DoneChan:
				return
			}
		}
	})

	return nil
}

func (us *UnifiedServer) handleMessage(c *fiber.Ctx) error {
	sessionID := c.Query("sessionId")
	if sessionID == "" {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "sessionId query parameter required"})
	}

	us.mu.RLock()
	sess, exists := us.sessions[sessionID]
	us.mu.RUnlock()

	if !exists {
		return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Session not found or expired"})
	}

	var req mcp.JSONRPCMessage
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"error": "Invalid JSON-RPC message"})
	}

	go func() {
		resp := us.server.HandleMessage(&req)
		if resp != nil {
			select {
			case sess.MsgChan <- resp:
			case <-sess.DoneChan:
			}
		}
	}()

	return c.SendStatus(fiber.StatusAccepted)
}

func (us *UnifiedServer) handleSpecYAML(c *fiber.Ctx) error {
	c.Set("Access-Control-Allow-Origin", "*")
	c.Set("Content-Type", "application/x-yaml; charset=utf-8")
	c.Set("Cache-Control", "no-cache, no-store, must-revalidate")

	data := us.loader.GetRawData()
	if len(data) > 0 {
		return c.Send(data)
	}

	specData := us.loader.GetSpec()
	if specData != nil {
		out, err := yaml.Marshal(specData)
		if err == nil {
			return c.Send(out)
		}
	}
	return c.Status(fiber.StatusNotFound).SendString("OpenAPI YAML spec not found")
}

func (us *UnifiedServer) handleSpecJSON(c *fiber.Ctx) error {
	c.Set("Access-Control-Allow-Origin", "*")
	c.Set("Content-Type", "application/json; charset=utf-8")
	c.Set("Cache-Control", "no-cache, no-store, must-revalidate")

	specData := us.loader.GetSpec()
	if specData != nil {
		return c.JSON(specData)
	}
	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "OpenAPI JSON spec not found"})
}

func (us *UnifiedServer) handleCollection(c *fiber.Ctx) error {
	c.Set("Access-Control-Allow-Origin", "*")
	c.Set("Content-Type", "application/json; charset=utf-8")

	fileName := filepath.Base(c.Params("file"))
	candidates := []string{
		filepath.Join("collections", fileName),
		filepath.Join("/app/collections", fileName),
		filepath.Join("examples/collections", fileName),
	}
	for _, candidate := range candidates {
		if data, err := os.ReadFile(candidate); err == nil {
			return c.Send(data)
		}
	}
	return c.Status(fiber.StatusNotFound).JSON(fiber.Map{"error": "Collection not found"})
}

func (us *UnifiedServer) startHTTP3Listener() {
	tlsConfig, err := GenerateDevTLSConfig()
	if err != nil {
		log.Printf("[HTTP/3] Warning: Failed to generate dev TLS config: %v", err)
		return
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok","protocol":"HTTP/3 (QUIC)"}`))
	})
	mux.HandleFunc("/sse", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")

		sessionID := uuid.New().String()
		sess := &Session{
			ID:       sessionID,
			MsgChan:  make(chan *mcp.JSONRPCMessage, 50),
			DoneChan: make(chan struct{}),
		}

		us.mu.Lock()
		us.sessions[sessionID] = sess
		us.mu.Unlock()

		defer func() {
			us.mu.Lock()
			delete(us.sessions, sessionID)
			us.mu.Unlock()
			close(sess.DoneChan)
		}()

		fmt.Fprintf(w, "event: endpoint\ndata: /message?sessionId=%s\n\n", sessionID)
		if flusher, ok := w.(http.Flusher); ok {
			flusher.Flush()
		}

		for {
			select {
			case msg, ok := <-sess.MsgChan:
				if !ok {
					return
				}
				data, err := json.Marshal(msg)
				if err == nil {
					fmt.Fprintf(w, "event: message\ndata: %s\n\n", string(data))
					if flusher, ok := w.(http.Flusher); ok {
						flusher.Flush()
					}
				}
			case <-sess.DoneChan:
				return
			case <-r.Context().Done():
				return
			}
		}
	})
	mux.HandleFunc("/message", func(w http.ResponseWriter, r *http.Request) {
		sessionID := r.URL.Query().Get("sessionId")
		if sessionID == "" {
			http.Error(w, "sessionId required", http.StatusBadRequest)
			return
		}

		us.mu.RLock()
		sess, exists := us.sessions[sessionID]
		us.mu.RUnlock()

		if !exists {
			http.Error(w, "Session not found", http.StatusNotFound)
			return
		}

		var req mcp.JSONRPCMessage
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "Invalid JSON-RPC", http.StatusBadRequest)
			return
		}

		go func() {
			resp := us.server.HandleMessage(&req)
			if resp != nil {
				select {
				case sess.MsgChan <- resp:
				case <-sess.DoneChan:
				}
			}
		}()

		w.WriteHeader(http.StatusAccepted)
	})

	h3Server := &http3.Server{
		Addr:      fmt.Sprintf("%s:%s", us.cfg.Host, us.cfg.Port),
		Handler:   mux,
		TLSConfig: tlsConfig,
	}

	log.Printf("[HTTP/3 QUIC] UDP listener active on %s:%s", us.cfg.Host, us.cfg.Port)
	if err := h3Server.ListenAndServe(); err != nil {
		log.Printf("[HTTP/3] Notice: UDP listener stopped: %v", err)
	}
}
