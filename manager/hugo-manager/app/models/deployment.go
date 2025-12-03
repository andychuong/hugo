package models

import (
	"encoding/json"
	"time"
)

// Deployment represents a deployment configuration
type Deployment struct {
	ID          string    `json:"id"`
	ProjectID  string    `json:"projectId"`
	Type       string    `json:"type"` // "netlify", "vercel", "github-pages", "ftp", "s3", "generic"
	Config     map[string]interface{} `json:"config"`
	Status     string    `json:"status"` // "pending", "building", "deploying", "success", "failed"
	CreatedAt  time.Time `json:"-"`
	UpdatedAt  time.Time `json:"-"`
	
	// JSON serialized fields
	CreatedAtStr string `json:"createdAt"`
	UpdatedAtStr string `json:"updatedAt"`
}

// DeploymentHistory represents a deployment history entry
type DeploymentHistory struct {
	ID           string    `json:"id"`
	DeploymentID string    `json:"deploymentId"`
	ProjectID    string    `json:"projectId"`
	Status       string    `json:"status"`
	URL          string    `json:"url,omitempty"`
	BuildTime    int64     `json:"buildTime"` // milliseconds
	DeployTime   int64     `json:"deployTime"` // milliseconds
	Logs         []string  `json:"logs"`
	Error        string    `json:"error,omitempty"`
	CreatedAt    time.Time `json:"-"`
	
	// JSON serialized field
	CreatedAtStr string `json:"createdAt"`
}

// MarshalJSON custom marshaling for Deployment
func (d *Deployment) MarshalJSON() ([]byte, error) {
	type Alias Deployment
	return json.Marshal(&struct {
		*Alias
		CreatedAtStr string `json:"createdAt"`
		UpdatedAtStr string `json:"updatedAt"`
	}{
		Alias:        (*Alias)(d),
		CreatedAtStr: d.CreatedAt.Format(time.RFC3339),
		UpdatedAtStr: d.UpdatedAt.Format(time.RFC3339),
	})
}

// UnmarshalJSON custom unmarshaling for Deployment
func (d *Deployment) UnmarshalJSON(data []byte) error {
	type Alias Deployment
	aux := &struct {
		*Alias
		CreatedAtStr string `json:"createdAt"`
		UpdatedAtStr string `json:"updatedAt"`
	}{
		Alias: (*Alias)(d),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	
	if aux.CreatedAtStr != "" {
		if t, err := time.Parse(time.RFC3339, aux.CreatedAtStr); err == nil {
			d.CreatedAt = t
		}
	}
	if aux.UpdatedAtStr != "" {
		if t, err := time.Parse(time.RFC3339, aux.UpdatedAtStr); err == nil {
			d.UpdatedAt = t
		}
	}
	
	return nil
}

// MarshalJSON custom marshaling for DeploymentHistory
func (dh *DeploymentHistory) MarshalJSON() ([]byte, error) {
	type Alias DeploymentHistory
	return json.Marshal(&struct {
		*Alias
		CreatedAtStr string `json:"createdAt"`
	}{
		Alias:        (*Alias)(dh),
		CreatedAtStr: dh.CreatedAt.Format(time.RFC3339),
	})
}

// UnmarshalJSON custom unmarshaling for DeploymentHistory
func (dh *DeploymentHistory) UnmarshalJSON(data []byte) error {
	type Alias DeploymentHistory
	aux := &struct {
		*Alias
		CreatedAtStr string `json:"createdAt"`
	}{
		Alias: (*Alias)(dh),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	
	if aux.CreatedAtStr != "" {
		if t, err := time.Parse(time.RFC3339, aux.CreatedAtStr); err == nil {
			dh.CreatedAt = t
		}
	}
	
	return nil
}

// DeploymentOptions represents options for a deployment
type DeploymentOptions struct {
	BuildOptions BuildOptions `json:"buildOptions"`
	Environment  string       `json:"environment"` // "production", "preview", etc.
	Branch       string       `json:"branch,omitempty"` // For GitHub Pages
	Commit       string       `json:"commit,omitempty"`
}

