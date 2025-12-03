package utils

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"github.com/gohugoio/hugo/parser/metadecoders"
	"gopkg.in/yaml.v3"
)

// ParseConfigFile parses a Hugo config file (TOML, YAML, or JSON)
func ParseConfigFile(path string) (map[string]interface{}, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	ext := filepath.Ext(path)
	config := make(map[string]interface{})

	switch ext {
	case ".toml":
		// Use Hugo's metadecoders for TOML parsing
		parsed, err := metadecoders.Default.UnmarshalToMap(data, metadecoders.TOML)
		if err != nil {
			return nil, fmt.Errorf("failed to parse TOML: %w", err)
		}
		config = parsed
	case ".yaml", ".yml":
		if err := yaml.Unmarshal(data, &config); err != nil {
			return nil, fmt.Errorf("failed to parse YAML: %w", err)
		}
	case ".json":
		if err := json.Unmarshal(data, &config); err != nil {
			return nil, fmt.Errorf("failed to parse JSON: %w", err)
		}
	default:
		return nil, fmt.Errorf("unsupported config file format: %s", ext)
	}

	return config, nil
}

// FindConfigFile finds the Hugo config file in a directory
func FindConfigFile(dir string) (string, error) {
	configFiles := []string{
		"hugo.toml",
		"hugo.yaml",
		"hugo.json",
		"config.toml",
		"config.yaml",
		"config.json",
	}

	for _, filename := range configFiles {
		path := filepath.Join(dir, filename)
		if FileExists(path) {
			return path, nil
		}
	}

	return "", fmt.Errorf("no config file found in %s", dir)
}

