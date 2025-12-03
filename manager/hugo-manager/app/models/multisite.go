package models

import (
	"encoding/json"
	"time"
)

// ProjectGroup represents a group of projects
type ProjectGroup struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	ProjectIDs  []string  `json:"projectIds"`
	CreatedAt   time.Time `json:"-"`
	UpdatedAt   time.Time `json:"-"`
	
	// JSON serialized fields
	CreatedAtStr string `json:"createdAt"`
	UpdatedAtStr string `json:"updatedAt"`
}

// MarshalJSON custom marshaling for ProjectGroup
func (pg *ProjectGroup) MarshalJSON() ([]byte, error) {
	type Alias ProjectGroup
	return json.Marshal(&struct {
		*Alias
		CreatedAtStr string `json:"createdAt"`
		UpdatedAtStr string `json:"updatedAt"`
	}{
		Alias:        (*Alias)(pg),
		CreatedAtStr: pg.CreatedAt.Format(time.RFC3339),
		UpdatedAtStr: pg.UpdatedAt.Format(time.RFC3339),
	})
}

// UnmarshalJSON custom unmarshaling for ProjectGroup
func (pg *ProjectGroup) UnmarshalJSON(data []byte) error {
	type Alias ProjectGroup
	aux := &struct {
		*Alias
		CreatedAtStr string `json:"createdAt"`
		UpdatedAtStr string `json:"updatedAt"`
	}{
		Alias: (*Alias)(pg),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	
	if aux.CreatedAtStr != "" {
		if t, err := time.Parse(time.RFC3339, aux.CreatedAtStr); err == nil {
			pg.CreatedAt = t
		}
	}
	if aux.UpdatedAtStr != "" {
		if t, err := time.Parse(time.RFC3339, aux.UpdatedAtStr); err == nil {
			pg.UpdatedAt = t
		}
	}
	
	return nil
}

// ProjectTemplate represents a project template
type ProjectTemplate struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Config      map[string]interface{} `json:"config"`
	Files       []TemplateFile         `json:"files"`
	CreatedAt   time.Time              `json:"-"`
	
	// JSON serialized field
	CreatedAtStr string `json:"createdAt"`
}

// TemplateFile represents a file in a template
type TemplateFile struct {
	Path    string `json:"path"`
	Content string `json:"content"`
	IsDir   bool   `json:"isDir"`
}

// MarshalJSON custom marshaling for ProjectTemplate
func (pt *ProjectTemplate) MarshalJSON() ([]byte, error) {
	type Alias ProjectTemplate
	return json.Marshal(&struct {
		*Alias
		CreatedAtStr string `json:"createdAt"`
	}{
		Alias:        (*Alias)(pt),
		CreatedAtStr: pt.CreatedAt.Format(time.RFC3339),
	})
}

// UnmarshalJSON custom unmarshaling for ProjectTemplate
func (pt *ProjectTemplate) UnmarshalJSON(data []byte) error {
	type Alias ProjectTemplate
	aux := &struct {
		*Alias
		CreatedAtStr string `json:"createdAt"`
	}{
		Alias: (*Alias)(pt),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	
	if aux.CreatedAtStr != "" {
		if t, err := time.Parse(time.RFC3339, aux.CreatedAtStr); err == nil {
			pt.CreatedAt = t
		}
	}
	
	return nil
}

// BulkOperation represents a bulk operation on multiple projects
type BulkOperation struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"` // "build", "deploy", "update", "delete"
	ProjectIDs  []string  `json:"projectIds"`
	Status      string    `json:"status"` // "pending", "running", "completed", "failed"
	Results     map[string]interface{} `json:"results"`
	CreatedAt   time.Time `json:"-"`
	CompletedAt time.Time `json:"-"`
	
	// JSON serialized fields
	CreatedAtStr   string `json:"createdAt"`
	CompletedAtStr string `json:"completedAt"`
}

// MarshalJSON custom marshaling for BulkOperation
func (bo *BulkOperation) MarshalJSON() ([]byte, error) {
	type Alias BulkOperation
	return json.Marshal(&struct {
		*Alias
		CreatedAtStr   string `json:"createdAt"`
		CompletedAtStr string `json:"completedAt"`
	}{
		Alias:          (*Alias)(bo),
		CreatedAtStr:   bo.CreatedAt.Format(time.RFC3339),
		CompletedAtStr: bo.CompletedAt.Format(time.RFC3339),
	})
}

// UnmarshalJSON custom unmarshaling for BulkOperation
func (bo *BulkOperation) UnmarshalJSON(data []byte) error {
	type Alias BulkOperation
	aux := &struct {
		*Alias
		CreatedAtStr   string `json:"createdAt"`
		CompletedAtStr string `json:"completedAt"`
	}{
		Alias: (*Alias)(bo),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	
	if aux.CreatedAtStr != "" {
		if t, err := time.Parse(time.RFC3339, aux.CreatedAtStr); err == nil {
			bo.CreatedAt = t
		}
	}
	if aux.CompletedAtStr != "" {
		if t, err := time.Parse(time.RFC3339, aux.CompletedAtStr); err == nil {
			bo.CompletedAt = t
		}
	}
	
	return nil
}

// CloneOptions represents options for cloning a project
type CloneOptions struct {
	NewName     string `json:"newName"`
	NewPath     string `json:"newPath"`
	CopyContent bool   `json:"copyContent"`
	CopyConfig  bool   `json:"copyConfig"`
}

