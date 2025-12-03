package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"hugo-manager/app/models"
	"hugo-manager/app/utils"

	"github.com/gohugoio/hugo/parser"
	"github.com/gohugoio/hugo/parser/metadecoders"
	"gopkg.in/yaml.v3"
)

// ConfigService handles Hugo configuration management
type ConfigService struct {
	projectService *ProjectService
}

// NewConfigService creates a new ConfigService instance
func NewConfigService(projectService *ProjectService) *ConfigService {
	return &ConfigService{
		projectService: projectService,
	}
}

// GetConfigFileInfo returns information about the config file(s) for a project
func (s *ConfigService) GetConfigFileInfo(projectID string) (*models.ConfigFileInfo, error) {
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return nil, err
	}

		// Check for config directory structure first
	configDir := filepath.Join(project.Path, "config")
	if utils.IsDir(configDir) {
		return &models.ConfigFileInfo{
			Path:  configDir,
			Format: "directory",
			IsDir:  true,
		}, nil
	}

	// Check for single config file
	configPath, err := utils.FindConfigFile(project.Path)
	if err != nil {
		return nil, fmt.Errorf("no config file found: %w", err)
	}

	ext := filepath.Ext(configPath)
	format := strings.TrimPrefix(ext, ".")

	return &models.ConfigFileInfo{
		Path:   configPath,
		Format: format,
		IsDir:  false,
	}, nil
}

// GetConfig reads and parses the config file for a project
func (s *ConfigService) GetConfig(projectID string, environment string) (map[string]interface{}, error) {
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return nil, err
	}

	// Check for config directory structure
	configDir := filepath.Join(project.Path, "config")
	if utils.IsDir(configDir) {
		return s.getConfigFromDir(configDir, environment)
	}

	// Use single config file
	configPath, err := utils.FindConfigFile(project.Path)
	if err != nil {
		return nil, err
	}

	return utils.ParseConfigFile(configPath)
}

// getConfigFromDir reads config from directory structure
func (s *ConfigService) getConfigFromDir(configDir string, environment string) (map[string]interface{}, error) {
	config := make(map[string]interface{})

	// Load _default first
	defaultDir := filepath.Join(configDir, "_default")
	if utils.IsDir(defaultDir) {
		defaultConfig, err := s.loadConfigDir(defaultDir)
		if err != nil {
			return nil, fmt.Errorf("failed to load default config: %w", err)
		}
		config = mergeConfigMaps(config, defaultConfig)
	}

	// Load environment-specific config if provided
	if environment != "" {
		envDir := filepath.Join(configDir, environment)
		if utils.IsDir(envDir) {
			envConfig, err := s.loadConfigDir(envDir)
			if err != nil {
				return nil, fmt.Errorf("failed to load environment config: %w", err)
			}
			config = mergeConfigMaps(config, envConfig)
		}
	}

	return config, nil
}

// loadConfigDir loads all config files from a directory
func (s *ConfigService) loadConfigDir(dir string) (map[string]interface{}, error) {
	config := make(map[string]interface{})

	err := filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		ext := filepath.Ext(path)
		if ext != ".toml" && ext != ".yaml" && ext != ".yml" && ext != ".json" {
			return nil
		}

		fileConfig, err := utils.ParseConfigFile(path)
		if err != nil {
			return fmt.Errorf("failed to parse %s: %w", path, err)
		}

		// Get the base name without extension
		baseName := strings.TrimSuffix(info.Name(), ext)
		
		// Handle special config file names
		if baseName == "config" || baseName == "hugo" {
			// Root config - merge directly
			config = mergeConfigMaps(config, fileConfig)
		} else {
			// Named config file (e.g., params.toml, menus.toml)
			// Check if it's a language-specific file (e.g., params.en.toml)
			parts := strings.Split(baseName, ".")
			if len(parts) > 1 {
				// Language-specific config
				key := parts[0] // e.g., "params"
				lang := parts[1] // e.g., "en"
				
				if config["languages"] == nil {
					config["languages"] = make(map[string]interface{})
				}
				langs := config["languages"].(map[string]interface{})
				if langs[lang] == nil {
					langs[lang] = make(map[string]interface{})
				}
				langConfig := langs[lang].(map[string]interface{})
				langConfig[key] = fileConfig
			} else {
				// Regular named config
				config[baseName] = fileConfig
			}
		}

		return nil
	})

	return config, err
}

// mergeConfigMaps merges two config maps, with b taking precedence
func mergeConfigMaps(a, b map[string]interface{}) map[string]interface{} {
	result := make(map[string]interface{})
	
	// Copy a
	for k, v := range a {
		result[k] = v
	}
	
	// Merge b
	for k, v := range b {
		if existing, ok := result[k]; ok {
			// Both exist - try to merge
			if existingMap, ok1 := existing.(map[string]interface{}); ok1 {
				if newMap, ok2 := v.(map[string]interface{}); ok2 {
					result[k] = mergeConfigMaps(existingMap, newMap)
					continue
				}
			}
		}
		// No merge possible or key doesn't exist - overwrite
		result[k] = v
	}
	
	return result
}

// UpdateConfig updates a config value in the config file
func (s *ConfigService) UpdateConfig(projectID string, keyPath []string, value interface{}) error {
	// Get current config
	config, err := s.GetConfig(projectID, "")
	if err != nil {
		return err
	}

	// Update the value in the config map
	if err := s.setNestedValue(config, keyPath, value); err != nil {
		return err
	}

	// Get config file info
	configInfo, err := s.GetConfigFileInfo(projectID)
	if err != nil {
		return err
	}

	// Save config
	if configInfo.IsDir {
		return fmt.Errorf("updating directory-based configs not yet supported")
	}

	return s.saveConfigFile(configInfo.Path, configInfo.Format, config)
}

// setNestedValue sets a nested value in a map using a key path
func (s *ConfigService) setNestedValue(config map[string]interface{}, keyPath []string, value interface{}) error {
	if len(keyPath) == 0 {
		return fmt.Errorf("key path cannot be empty")
	}

	current := config
	for i, key := range keyPath[:len(keyPath)-1] {
		if _, exists := current[key]; !exists {
			current[key] = make(map[string]interface{})
		}
		
		next, ok := current[key].(map[string]interface{})
		if !ok {
			return fmt.Errorf("cannot set nested value: %s is not a map", strings.Join(keyPath[:i+1], "."))
		}
		
		current = next
	}

	// Set the final value
	current[keyPath[len(keyPath)-1]] = value
	return nil
}

// saveConfigFile saves a config map to a file in the specified format
func (s *ConfigService) saveConfigFile(path string, format string, config map[string]interface{}) error {
	var data []byte
	var err error

	switch format {
	case "toml":
		var buf bytes.Buffer
		if err := parser.InterfaceToConfig(config, metadecoders.TOML, &buf); err != nil {
			return fmt.Errorf("failed to marshal TOML: %w", err)
		}
		data = buf.Bytes()
	case "yaml", "yml":
		data, err = yaml.Marshal(config)
		if err != nil {
			return fmt.Errorf("failed to marshal YAML: %w", err)
		}
	case "json":
		data, err = json.MarshalIndent(config, "", "  ")
		if err != nil {
			return fmt.Errorf("failed to marshal JSON: %w", err)
		}
	default:
		return fmt.Errorf("unsupported config format: %s", format)
	}

	// Write to file atomically
	tempPath := path + ".tmp"
	if err := os.WriteFile(tempPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	if err := os.Rename(tempPath, path); err != nil {
		os.Remove(tempPath)
		return fmt.Errorf("failed to rename config file: %w", err)
	}

	return nil
}

// ValidateConfig validates a config value
func (s *ConfigService) ValidateConfig(keyPath []string, value interface{}) error {
	if len(keyPath) == 0 {
		return fmt.Errorf("key path cannot be empty")
	}

	// Basic validation rules
	key := keyPath[len(keyPath)-1]

	// Validate baseURL
	if key == "baseURL" {
		if str, ok := value.(string); ok {
			if str != "" && !strings.HasPrefix(str, "http://") && !strings.HasPrefix(str, "https://") && !strings.HasPrefix(str, "/") {
				return fmt.Errorf("baseURL must start with http://, https://, or /")
			}
		} else {
			return fmt.Errorf("baseURL must be a string")
		}
	}

	// Validate title
	if key == "title" {
		if _, ok := value.(string); !ok {
			return fmt.Errorf("title must be a string")
		}
	}

	// Validate publishDir
	if key == "publishDir" {
		if _, ok := value.(string); !ok {
			return fmt.Errorf("publishDir must be a string")
		}
	}

	// Validate environment
	if key == "environment" {
		if str, ok := value.(string); ok {
			validEnvs := []string{"development", "production", "staging", "test"}
			valid := false
			for _, env := range validEnvs {
				if str == env {
					valid = true
					break
				}
			}
			if !valid {
				return fmt.Errorf("environment must be one of: %v", validEnvs)
			}
		} else {
			return fmt.Errorf("environment must be a string")
		}
	}

	// Validate themes
	if key == "theme" || key == "themes" {
		// Can be string or array of strings
		switch v := value.(type) {
		case string:
			// Valid
		case []interface{}:
			for _, item := range v {
				if _, ok := item.(string); !ok {
					return fmt.Errorf("themes array must contain only strings")
				}
			}
		default:
			return fmt.Errorf("theme/themes must be a string or array of strings")
		}
	}

	return nil
}

// GetAvailableEnvironments returns available environment configs for a project
func (s *ConfigService) GetAvailableEnvironments(projectID string) ([]string, error) {
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return nil, err
	}

	configDir := filepath.Join(project.Path, "config")
	if !utils.IsDir(configDir) {
		return []string{}, nil
	}

	var environments []string
	entries, err := os.ReadDir(configDir)
	if err != nil {
		return nil, err
	}

	for _, entry := range entries {
		if entry.IsDir() && entry.Name() != "_default" {
			environments = append(environments, entry.Name())
		}
	}

	return environments, nil
}

// ConvertConfigFormat converts a config file from one format to another
func (s *ConfigService) ConvertConfigFormat(projectID string, newFormat string) error {
	// Get current config
	config, err := s.GetConfig(projectID, "")
	if err != nil {
		return err
	}

	// Get current config file info
	configInfo, err := s.GetConfigFileInfo(projectID)
	if err != nil {
		return err
	}

	if configInfo.IsDir {
		return fmt.Errorf("cannot convert directory-based configs")
	}

	// Determine new file path
	oldPath := configInfo.Path
	dir := filepath.Dir(oldPath)
	baseName := "hugo"
	if strings.HasPrefix(filepath.Base(oldPath), "config") {
		baseName = "config"
	}

	var newPath string
	switch newFormat {
	case "toml":
		newPath = filepath.Join(dir, baseName+".toml")
	case "yaml", "yml":
		newPath = filepath.Join(dir, baseName+".yaml")
	case "json":
		newPath = filepath.Join(dir, baseName+".json")
	default:
		return fmt.Errorf("unsupported format: %s", newFormat)
	}

	// Save in new format
	if err := s.saveConfigFile(newPath, newFormat, config); err != nil {
		return err
	}

	// Remove old file if different
	if newPath != oldPath {
		if err := os.Remove(oldPath); err != nil {
			return fmt.Errorf("failed to remove old config file: %w", err)
		}
	}

	return nil
}

