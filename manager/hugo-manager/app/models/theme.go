package models

import (
	"encoding/json"
	"time"
)

// Theme represents a Hugo theme
type Theme struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Path        string    `json:"path"`        // e.g., "github.com/user/theme"
	GitHubPath  string    `json:"githubPath"`  // Full GitHub URL
	Description string    `json:"description"`
	Tags        []string  `json:"tags"`
	Screenshot  string    `json:"screenshot"`
	MinVersion  string    `json:"minVersion"`
	Author      string    `json:"author"`
	License     string    `json:"license"`
	Installed   bool      `json:"installed"`
	Version     string    `json:"version"`
	InstalledAt time.Time `json:"-"`
	LocalPath   string    `json:"localPath"`   // Path in themes/ directory
	
	// JSON serialized field for Wails compatibility
	InstalledAtStr string `json:"installedAt"`
}

// MarshalJSON custom marshaling to convert time.Time to string
func (t *Theme) MarshalJSON() ([]byte, error) {
	type Alias Theme
	return json.Marshal(&struct {
		*Alias
		InstalledAtStr string `json:"installedAt"`
	}{
		Alias:          (*Alias)(t),
		InstalledAtStr: t.InstalledAt.Format(time.RFC3339),
	})
}

// UnmarshalJSON custom unmarshaling to convert string to time.Time
func (t *Theme) UnmarshalJSON(data []byte) error {
	type Alias Theme
	aux := &struct {
		*Alias
		InstalledAtStr string `json:"installedAt"`
	}{
		Alias: (*Alias)(t),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	
	if aux.InstalledAtStr != "" {
		if parsed, err := time.Parse(time.RFC3339, aux.InstalledAtStr); err == nil {
			t.InstalledAt = parsed
		}
	}
	
	return nil
}

// ThemeMetadata represents theme metadata from theme.toml
type ThemeMetadata struct {
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Tags        []string `json:"tags"`
	MinVersion  string   `json:"minVersion"`
	Author      string   `json:"author"`
	License     string   `json:"license"`
	GitHubURL   string   `json:"githubUrl"`
}

