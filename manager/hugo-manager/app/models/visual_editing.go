package models

// PageStructure represents the structure of a page for visual editing
type PageStructure struct {
	Page    PageMetadata    `json:"page"`
	Regions []EditableRegion `json:"regions"`
	Site    SiteMetadata    `json:"site"`
}

// PageMetadata represents metadata about a page
type PageMetadata struct {
	Path        string                 `json:"path"`
	Permalink   string                 `json:"permalink"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	Content     string                 `json:"content"`
	FrontMatter map[string]interface{} `json:"frontMatter"`
	Kind        string                 `json:"kind"` // "page", "section", "taxonomy", etc.
}

// EditableRegion represents an editable region on a page
type EditableRegion struct {
	ID       string      `json:"id"`
	Type     string      `json:"type"`     // "text", "markdown", "image", "frontmatter", etc.
	Selector string      `json:"selector"` // CSS selector
	Value    interface{} `json:"value"`
	Path     string      `json:"path"`     // Content file path
	Field    string      `json:"field"`    // Field name in front matter or content
	Label    string      `json:"label"`    // Human-readable label
}

// SiteMetadata represents site-wide metadata
type SiteMetadata struct {
	Title   string `json:"title"`
	BaseURL string `json:"baseURL"`
	Language string `json:"language,omitempty"`
}

// SiteStructure represents the structure of the entire site
type SiteStructure struct {
	Site    SiteMetadata     `json:"site"`
	Pages   []PageStructure  `json:"pages"`
	Sections []SectionMetadata `json:"sections"`
}

// SectionMetadata represents metadata about a section
type SectionMetadata struct {
	Path        string                 `json:"path"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	FrontMatter map[string]interface{} `json:"frontMatter"`
}

// VisualEditingUpdate represents an update to a page field
type VisualEditingUpdate struct {
	PagePath string      `json:"pagePath"`
	Field    string      `json:"field"`
	Value    interface{} `json:"value"`
	Type     string      `json:"type"` // "frontmatter", "content", "title", etc.
}

