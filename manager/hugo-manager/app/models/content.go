package models

import "time"

// Content represents a Hugo content file
type Content struct {
	ID          string                 `json:"id"`
	Path        string                 `json:"path"`
	Title       string                 `json:"title"`
	Content     string                 `json:"content"`
	FrontMatter map[string]interface{} `json:"frontMatter"`
	Format      string                 `json:"format"` // "yaml", "toml", "json"
	IsDraft     bool                   `json:"isDraft"`
	IsFuture    bool                   `json:"isFuture"`
	IsExpired   bool                   `json:"isExpired"`
	ModTime     time.Time              `json:"modTime"`
	Size        int64                  `json:"size"`
}

// ContentList represents a list of content files
type ContentList struct {
	Items      []*Content `json:"items"`
	Total      int        `json:"total"`
	Path       string     `json:"path"`
	IsContentDir bool     `json:"isContentDir"`
}

// ContentOptions represents options for creating/editing content
type ContentOptions struct {
	Title       string                 `json:"title"`
	Path        string                 `json:"path,omitempty"`
	Content     string                 `json:"content"`
	FrontMatter map[string]interface{} `json:"frontMatter"`
	Format      string                 `json:"format"` // "yaml", "toml", "json"
	IsDraft     bool                   `json:"isDraft"`
	Archetype   string                 `json:"archetype,omitempty"` // Archetype name to use
}

// Archetype represents a Hugo archetype template
type Archetype struct {
	Name        string                 `json:"name"`
	Path        string                 `json:"path"`
	FrontMatter map[string]interface{} `json:"frontMatter"`
	Content     string                 `json:"content"`
}

