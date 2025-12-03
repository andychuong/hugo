package services

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"hugo-manager/app/models"
)

// VisualEditingService handles visual editing operations
type VisualEditingService struct {
	projectService *ProjectService
}

// NewVisualEditingService creates a new visual editing service
func NewVisualEditingService(projectService *ProjectService) *VisualEditingService {
	return &VisualEditingService{
		projectService: projectService,
	}
}

// GetPageStructure gets the structure of a page for visual editing
func (s *VisualEditingService) GetPageStructure(projectID string, pagePath string) (*models.PageStructure, error) {
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return nil, err
	}
	
	// Read the content file
	contentPath := filepath.Join(project.Path, "content", pagePath)
	if !strings.HasSuffix(contentPath, ".md") && !strings.HasSuffix(contentPath, ".html") {
		contentPath += ".md"
	}
	
	content, err := os.ReadFile(contentPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read content file: %w", err)
	}
	
	// Parse front matter and content
	// This is simplified - in production, use Hugo's parser
	frontMatter, body := parseFrontMatter(string(content))
	
	// Build page structure
	pageStructure := &models.PageStructure{
		Page: models.PageMetadata{
			Path:        pagePath,
			Permalink:   "/" + strings.TrimSuffix(pagePath, ".md"),
			Title:       getTitleFromFrontMatter(frontMatter),
			Description: getDescriptionFromFrontMatter(frontMatter),
			Content:     body,
			FrontMatter: frontMatter,
			Kind:        "page",
		},
		Regions: []models.EditableRegion{},
		Site: models.SiteMetadata{
			Title:   project.Config.Title,
			BaseURL: project.Config.BaseURL,
		},
	}
	
	// Extract editable regions
	regions := s.extractEditableRegions(pagePath, frontMatter, body)
	pageStructure.Regions = regions
	
	return pageStructure, nil
}

// GetEditableRegions gets all editable regions for a page
func (s *VisualEditingService) GetEditableRegions(projectID string, pagePath string) ([]models.EditableRegion, error) {
	structure, err := s.GetPageStructure(projectID, pagePath)
	if err != nil {
		return nil, err
	}
	
	return structure.Regions, nil
}

// UpdatePageField updates a page field via visual editing
func (s *VisualEditingService) UpdatePageField(projectID string, pagePath string, field string, value interface{}) error {
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return err
	}
	
	contentPath := filepath.Join(project.Path, "content", pagePath)
	if !strings.HasSuffix(contentPath, ".md") && !strings.HasSuffix(contentPath, ".html") {
		contentPath += ".md"
	}
	
	// Read current content
	content, err := os.ReadFile(contentPath)
	if err != nil {
		return fmt.Errorf("failed to read content file: %w", err)
	}
	
	// Parse and update
	frontMatter, body := parseFrontMatter(string(content))
	
	// Update field
	if field == "content" || field == "body" {
		body = fmt.Sprintf("%v", value)
	} else {
		if frontMatter == nil {
			frontMatter = make(map[string]interface{})
		}
		frontMatter[field] = value
	}
	
	// Write back
	newContent := formatContent(frontMatter, body)
	if err := os.WriteFile(contentPath, []byte(newContent), 0644); err != nil {
		return fmt.Errorf("failed to write content file: %w", err)
	}
	
	return nil
}

// SetVisualEditingEnabled enables or disables visual editing for a project
func (s *VisualEditingService) SetVisualEditingEnabled(projectID string, enabled bool) error {
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return err
	}
	
	if project.Config == nil {
		project.Config = &models.Config{}
	}
	
	if project.Config.VisualEditing == nil {
		project.Config.VisualEditing = &models.VisualEditingConfig{}
	}
	
	project.Config.VisualEditing.Enabled = enabled
	
	// Save config would be handled by config service
	return nil
}

// GetVisualEditingConfig gets visual editing configuration
func (s *VisualEditingService) GetVisualEditingConfig(projectID string) (*models.VisualEditingConfig, error) {
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return nil, err
	}
	
	if project.Config == nil || project.Config.VisualEditing == nil {
		return &models.VisualEditingConfig{
			Enabled:     false,
			APIEndpoint: "/api/visual-editing",
			InjectAttrs: true,
		}, nil
	}
	
	return project.Config.VisualEditing, nil
}

// UpdateVisualEditingConfig updates visual editing configuration
func (s *VisualEditingService) UpdateVisualEditingConfig(projectID string, config *models.VisualEditingConfig) error {
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return err
	}
	
	if project.Config == nil {
		project.Config = &models.Config{}
	}
	
	project.Config.VisualEditing = config
	
	// Save config would be handled by config service
	return nil
}

// GetSiteStructure gets the structure of the entire site
func (s *VisualEditingService) GetSiteStructure(projectID string) (*models.SiteStructure, error) {
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return nil, err
	}
	
	contentDir := filepath.Join(project.Path, "content")
	
	siteStructure := &models.SiteStructure{
		Site: models.SiteMetadata{
			Title:   project.Config.Title,
			BaseURL: project.Config.BaseURL,
		},
		Pages:    []models.PageStructure{},
		Sections:  []models.SectionMetadata{},
	}
	
	// Walk content directory
	err = filepath.Walk(contentDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		
		if info.IsDir() {
			return nil
		}
		
		if !strings.HasSuffix(path, ".md") && !strings.HasSuffix(path, ".html") {
			return nil
		}
		
		relPath, err := filepath.Rel(contentDir, path)
		if err != nil {
			return nil
		}
		
		pageStructure, err := s.GetPageStructure(projectID, relPath)
		if err != nil {
			return nil // Skip errors
		}
		
		siteStructure.Pages = append(siteStructure.Pages, *pageStructure)
		
		return nil
	})
	
	return siteStructure, err
}

// Helper functions

func parseFrontMatter(content string) (map[string]interface{}, string) {
	// Simplified front matter parser
	// In production, use Hugo's parser
	
	lines := strings.Split(content, "\n")
	if len(lines) < 3 {
		return nil, content
	}
	
	// Check for TOML front matter
	if lines[0] == "+++" {
		var frontMatter map[string]interface{}
		var bodyStart int
		for i := 1; i < len(lines); i++ {
			if lines[i] == "+++" {
				bodyStart = i + 1
				break
			}
		}
		body := strings.Join(lines[bodyStart:], "\n")
		return frontMatter, body
	}
	
	// Check for YAML front matter
	if lines[0] == "---" {
		var frontMatter map[string]interface{}
		var bodyStart int
		for i := 1; i < len(lines); i++ {
			if lines[i] == "---" {
				bodyStart = i + 1
				break
			}
		}
		body := strings.Join(lines[bodyStart:], "\n")
		return frontMatter, body
	}
	
	return nil, content
}

func formatContent(frontMatter map[string]interface{}, body string) string {
	// Simplified formatter
	// In production, use proper TOML/YAML formatting
	return body
}

func getTitleFromFrontMatter(fm map[string]interface{}) string {
	if title, ok := fm["title"].(string); ok {
		return title
	}
	return ""
}

func getDescriptionFromFrontMatter(fm map[string]interface{}) string {
	if desc, ok := fm["description"].(string); ok {
		return desc
	}
	return ""
}

func (s *VisualEditingService) extractEditableRegions(pagePath string, frontMatter map[string]interface{}, body string) []models.EditableRegion {
	var regions []models.EditableRegion
	
	// Extract front matter fields as editable regions
	for key, value := range frontMatter {
		regions = append(regions, models.EditableRegion{
			ID:       fmt.Sprintf("%s-frontmatter-%s", pagePath, key),
			Type:     "frontmatter",
			Selector: fmt.Sprintf("[data-field='%s']", key),
			Value:    value,
			Path:     pagePath,
			Field:    key,
			Label:    strings.Title(key),
		})
	}
	
	// Extract content as editable region
	regions = append(regions, models.EditableRegion{
		ID:       fmt.Sprintf("%s-content", pagePath),
		Type:     "markdown",
		Selector: "[data-field='content']",
		Value:    body,
		Path:     pagePath,
		Field:    "content",
		Label:    "Content",
	})
	
	return regions
}

