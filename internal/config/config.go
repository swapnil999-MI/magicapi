package config

import (
	"flag"
	"os"
	"strings"
)

type Config struct {
	SpecPath    string
	Host        string
	Port        string
	Mode        string // "network" or "stdio"
	EnableHTTP3 bool
	TLSCertPath string
	TLSKeyPath  string
	AutoTLS     bool
	CorsOrigins string
}

func LoadConfig() *Config {
	// Check environment variables for OpenAPI Spec YAML/JSON path
	// Checks: OPENAPI_SPEC_PATH, SPEC_PATH, OPENAPI_SPEC, OPENAPI_YAML, OPENAPI_PATH, SPEC
	specPathEnv := getFirstEnv("OPENAPI_SPEC_PATH", "SPEC_PATH", "OPENAPI_SPEC", "OPENAPI_YAML", "OPENAPI_PATH", "SPEC")
	if specPathEnv == "" {
		specPathEnv = findDefaultSpecPath()
	}

	cfg := &Config{
		SpecPath:    specPathEnv,
		Host:        getFirstEnvOrDefault("HOST", "0.0.0.0"),
		Port:        getFirstEnvOrDefault("PORT", "8085"),
		Mode:        getFirstEnvOrDefault("MODE", "network"),
		EnableHTTP3: getEnvBool("ENABLE_HTTP3", true),
		TLSCertPath: getFirstEnv("TLS_CERT", "TLS_CERT_PATH"),
		TLSKeyPath:  getFirstEnv("TLS_KEY", "TLS_KEY_PATH"),
		AutoTLS:     getEnvBool("AUTO_TLS", true),
		CorsOrigins: getFirstEnvOrDefault("CORS_ORIGINS", "*"),
	}

	stdioFlag := flag.Bool("stdio", false, "Run in stdio mode for local IDEs (Cursor, Claude Desktop, Antigravity)")
	portFlag := flag.String("port", cfg.Port, "Port for unified network server")
	hostFlag := flag.String("host", cfg.Host, "Host for unified network server")
	specFlag := flag.String("spec", cfg.SpecPath, "Path or URL to openapi.yaml or openapi.json")
	http3Flag := flag.Bool("http3", cfg.EnableHTTP3, "Enable HTTP/3 (QUIC) support on same port")
	certFlag := flag.String("cert", cfg.TLSCertPath, "TLS Certificate file path")
	keyFlag := flag.String("key", cfg.TLSKeyPath, "TLS Key file path")

	// Parse flags only if not already parsed
	if !flag.Parsed() {
		flag.Parse()
	}

	if *stdioFlag {
		cfg.Mode = "stdio"
	}
	cfg.Port = *portFlag
	cfg.Host = *hostFlag
	cfg.SpecPath = *specFlag
	cfg.EnableHTTP3 = *http3Flag
	cfg.TLSCertPath = *certFlag
	cfg.TLSKeyPath = *keyFlag

	return cfg
}

func findDefaultSpecPath() string {
	candidates := []string{
		"openapi.yaml",
		"openapi.json",
		"./openapi.yaml",
		"./openapi.json",
		"docs/openapi.yaml",
		"docs/openapi.json",
		"examples/openapi.yaml",
		"examples/openapi.json",
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	return "openapi.yaml"
}

func getFirstEnv(keys ...string) string {
	for _, key := range keys {
		if val := os.Getenv(key); strings.TrimSpace(val) != "" {
			return strings.TrimSpace(val)
		}
	}
	return ""
}

func getFirstEnvOrDefault(key string, fallback string) string {
	if val := os.Getenv(key); strings.TrimSpace(val) != "" {
		return strings.TrimSpace(val)
	}
	return fallback
}

func getEnvBool(key string, fallback bool) bool {
	if val := os.Getenv(key); strings.TrimSpace(val) != "" {
		v := strings.ToLower(strings.TrimSpace(val))
		return v == "true" || v == "1" || v == "yes"
	}
	return fallback
}
