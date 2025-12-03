package models

import (
	"encoding/json"
	"time"
)

// Project represents a Hugo project
type Project struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Path        string    `json:"path"`
	HugoVersion string    `json:"hugoVersion"`
	Config      *Config   `json:"config"`
	Status      *Status   `json:"status"`
	LastBuild   time.Time `json:"-"`
	CreatedAt   time.Time `json:"-"`
	Themes      []Theme   `json:"themes"`
	
	// JSON serialized fields for Wails compatibility
	LastBuildStr string `json:"lastBuild"`
	CreatedAtStr string `json:"createdAt"`
}

// MarshalJSON custom marshaling to convert time.Time to strings
func (p *Project) MarshalJSON() ([]byte, error) {
	type Alias Project
	return json.Marshal(&struct {
		*Alias
		LastBuildStr string `json:"lastBuild"`
		CreatedAtStr string `json:"createdAt"`
	}{
		Alias:        (*Alias)(p),
		LastBuildStr: p.LastBuild.Format(time.RFC3339),
		CreatedAtStr: p.CreatedAt.Format(time.RFC3339),
	})
}

// UnmarshalJSON custom unmarshaling to convert strings to time.Time
func (p *Project) UnmarshalJSON(data []byte) error {
	type Alias Project
	aux := &struct {
		*Alias
		LastBuildStr string `json:"lastBuild"`
		CreatedAtStr string `json:"createdAt"`
	}{
		Alias: (*Alias)(p),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	
	if aux.LastBuildStr != "" {
		if t, err := time.Parse(time.RFC3339, aux.LastBuildStr); err == nil {
			p.LastBuild = t
		}
	}
	if aux.CreatedAtStr != "" {
		if t, err := time.Parse(time.RFC3339, aux.CreatedAtStr); err == nil {
			p.CreatedAt = t
		}
	}
	
	return nil
}

// Status represents the current status of a project
type Status struct {
	IsBuilding    bool   `json:"isBuilding"`
	IsServing     bool   `json:"isServing"`
	ServerURL     string `json:"serverUrl"`
	ServerPort    int    `json:"serverPort"`
	HasErrors     bool   `json:"hasErrors"`
	ErrorMessage  string `json:"errorMessage"`
	VisualEditing bool   `json:"visualEditing"`
}

