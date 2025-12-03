package models

// Config represents Hugo site configuration
type Config struct {
	BaseURL      string                 `json:"baseURL"`
	Title        string                 `json:"title"`
	Environment  string                 `json:"environment"`
	PublishDir   string                 `json:"publishDir"`
	Themes       []string               `json:"themes"`
	Languages    []string               `json:"languages"`
	Params       map[string]interface{} `json:"params"`
	VisualEditing *VisualEditingConfig  `json:"visualEditing"`
}

// VisualEditingConfig represents visual editing configuration
type VisualEditingConfig struct {
	Enabled      bool              `json:"enabled"`
	APIEndpoint  string            `json:"apiEndpoint"`
	InjectAttrs  bool              `json:"injectAttrs"`
	FieldMapping map[string]string `json:"fieldMapping"`
	ExcludeKinds []string          `json:"excludeKinds"`
}

// ConfigFileInfo represents information about a config file
type ConfigFileInfo struct {
	Path        string `json:"path"`
	Format      string `json:"format"` // "toml", "yaml", "json", "directory"
	IsDir       bool   `json:"isDir"`
	Environment string `json:"environment,omitempty"` // For environment-specific configs
}

