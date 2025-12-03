package services

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/gohugoio/hugo/parser"
	"github.com/gohugoio/hugo/parser/metadecoders"
	"github.com/gohugoio/hugo/parser/pageparser"

	"hugo-manager/app/models"
	"hugo-manager/app/utils"
)

// ContentService handles content file operations
type ContentService struct {
	projectService *ProjectService
	mu            sync.RWMutex
}

// NewContentService creates a new ContentService instance
func NewContentService(projectService *ProjectService) *ContentService {
	return &ContentService{
		projectService: projectService,
	}
}

// GetContent reads and parses a content file
func (s *ContentService) GetContent(projectID string, contentPath string) (*models.Content, error) {
	// Get project
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return nil, err
	}

	// Validate and resolve path
	resolvedPath, err := s.resolveContentPath(project.Path, contentPath)
	if err != nil {
		return nil, err
	}

	// Check if file exists
	if !utils.FileExists(resolvedPath) {
		return nil, models.NewAppError(
			models.ErrContentNotFound,
			fmt.Sprintf("Content file not found: %s", contentPath),
		)
	}

	// Read file
	file, err := os.Open(resolvedPath)
	if err != nil {
		return nil, models.NewAppErrorWithDetails(
			models.ErrContentParseFailed,
			"Failed to open content file",
			err.Error(),
		)
	}
	defer file.Close()

	// Parse front matter and content
	parsed, err := pageparser.ParseFrontMatterAndContent(file)
	if err != nil {
		return nil, models.NewAppErrorWithDetails(
			models.ErrContentParseFailed,
			"Failed to parse content file",
			err.Error(),
		)
	}

	// Get file info
	info, err := file.Stat()
	if err != nil {
		return nil, models.NewAppErrorWithDetails(
			models.ErrContentParseFailed,
			"Failed to get file info",
			err.Error(),
		)
	}

	// Determine format
	format := "yaml"
	switch parsed.FrontMatterFormat {
	case metadecoders.TOML:
		format = "toml"
	case metadecoders.JSON:
		format = "json"
	case metadecoders.YAML:
		format = "yaml"
	}

	// Extract common fields
	title := ""
	if t, ok := parsed.FrontMatter["title"].(string); ok {
		title = t
	}

	isDraft := false
	if d, ok := parsed.FrontMatter["draft"].(bool); ok {
		isDraft = d
	}

	// Check if future/expired (would need date parsing, simplified here)
	isFuture := false
	isExpired := false

	content := &models.Content{
		ID:          utils.GenerateUUID(),
		Path:        contentPath,
		Title:       title,
		Content:     string(parsed.Content),
		FrontMatter: parsed.FrontMatter,
		Format:      format,
		IsDraft:     isDraft,
		IsFuture:    isFuture,
		IsExpired:   isExpired,
		ModTime:     info.ModTime(),
		Size:        info.Size(),
	}

	return content, nil
}

// ListContent lists content files in a directory
func (s *ContentService) ListContent(projectID string, path string) (*models.ContentList, error) {
	// Get project
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return nil, err
	}

	// Validate and resolve path
	resolvedPath, err := s.resolveContentPath(project.Path, path)
	if err != nil {
		return nil, err
	}

	// Check if path exists
	if !utils.FileExists(resolvedPath) {
		return nil, models.NewAppError(
			models.ErrContentNotFound,
			fmt.Sprintf("Path not found: %s", path),
		)
	}

	// Check if it's a directory
	if !utils.IsDir(resolvedPath) {
		return nil, models.NewAppError(
			models.ErrInvalidPath,
			"Path is not a directory",
		)
	}

	// Check if this is the content directory
	isContentDir := strings.HasSuffix(resolvedPath, "content") || 
		strings.Contains(resolvedPath, filepath.Join(project.Path, "content"))

	// Read directory
	entries, err := os.ReadDir(resolvedPath)
	if err != nil {
		return nil, models.NewAppErrorWithDetails(
			models.ErrFileAccessDenied,
			"Failed to read directory",
			err.Error(),
		)
	}

	// Filter for content files (markdown, etc.)
	items := make([]*models.Content, 0)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		// Check if it's a content file
		ext := utils.GetFileExtension(entry.Name())
		if ext != "md" && ext != "markdown" && ext != "mdown" {
			continue
		}

		entryPath := filepath.Join(resolvedPath, entry.Name())
		relPath, err := filepath.Rel(project.Path, entryPath)
		if err != nil {
			relPath = entry.Name()
		}

		// Try to parse the content file
		content, err := s.GetContent(projectID, relPath)
		if err != nil {
			// Skip files that can't be parsed
			continue
		}

		items = append(items, content)
	}

	return &models.ContentList{
		Items:        items,
		Total:        len(items),
		Path:         path,
		IsContentDir: isContentDir,
	}, nil
}

// CreateContent creates a new content file
func (s *ContentService) CreateContent(projectID string, options models.ContentOptions) (*models.Content, error) {
	// Get project
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return nil, err
	}

	// Determine content path
	contentPath := options.Path
	if contentPath == "" {
		// Generate path from title
		title := options.Title
		if title == "" {
			title = "untitled"
		}
		// Sanitize title for filename
		filename := strings.ToLower(strings.ReplaceAll(title, " ", "-"))
		filename = strings.Trim(filename, "-")
		contentPath = filepath.Join("content", filename+".md")
	}

	// Ensure path is in content directory
	if !strings.HasPrefix(contentPath, "content") {
		contentPath = filepath.Join("content", contentPath)
	}

	// Validate and resolve path
	resolvedPath, err := s.resolveContentPath(project.Path, contentPath)
	if err != nil {
		return nil, err
	}

	// Check if file already exists
	if utils.FileExists(resolvedPath) {
		return nil, models.NewAppError(
			models.ErrFileAccessDenied,
			fmt.Sprintf("Content file already exists: %s", contentPath),
		)
	}

	// Use archetype if specified
	frontMatter := options.FrontMatter
	if frontMatter == nil {
		frontMatter = make(map[string]interface{})
	}

	// Apply archetype if specified
	if options.Archetype != "" {
		archetype, err := s.GetArchetype(projectID, options.Archetype)
		if err == nil {
			// Merge archetype front matter
			for k, v := range archetype.FrontMatter {
				if _, exists := frontMatter[k]; !exists {
					frontMatter[k] = v
				}
			}
		}
	}

	// Set default fields
	if options.Title != "" {
		frontMatter["title"] = options.Title
	}
	if options.IsDraft {
		frontMatter["draft"] = true
	} else {
		// Remove draft if explicitly set to false
		if _, exists := frontMatter["draft"]; exists {
			delete(frontMatter, "draft")
		}
	}

	// Determine format
	format := options.Format
	if format == "" {
		format = "yaml" // Default to YAML
	}

	// Convert format string to metadecoders.Format
	var fmFormat metadecoders.Format
	switch format {
	case "toml":
		fmFormat = metadecoders.TOML
	case "json":
		fmFormat = metadecoders.JSON
	case "yaml", "yml":
		fmFormat = metadecoders.YAML
	default:
		fmFormat = metadecoders.YAML
	}

	// Build content file
	var buf bytes.Buffer
	err = parser.InterfaceToFrontMatter(frontMatter, fmFormat, &buf)
	if err != nil {
		return nil, models.NewAppErrorWithDetails(
			models.ErrInvalidFrontMatter,
			"Failed to serialize front matter",
			err.Error(),
		)
	}

	// Add content
	content := options.Content
	if content != "" {
		buf.WriteString("\n")
		buf.WriteString(content)
	}

	// Ensure parent directory exists
	parentDir := filepath.Dir(resolvedPath)
	if err := os.MkdirAll(parentDir, 0755); err != nil {
		return nil, models.NewAppErrorWithDetails(
			models.ErrFileAccessDenied,
			"Failed to create parent directory",
			err.Error(),
		)
	}

	// Write file
	if err := os.WriteFile(resolvedPath, buf.Bytes(), 0644); err != nil {
		return nil, models.NewAppErrorWithDetails(
			models.ErrFileAccessDenied,
			"Failed to create content file",
			err.Error(),
		)
	}

	// Return created content
	return s.GetContent(projectID, contentPath)
}

// UpdateContent updates an existing content file
func (s *ContentService) UpdateContent(projectID string, contentPath string, options models.ContentOptions) (*models.Content, error) {
	// Get existing content
	existing, err := s.GetContent(projectID, contentPath)
	if err != nil {
		return nil, err
	}

	// Get project
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return nil, err
	}

	// Validate and resolve path
	resolvedPath, err := s.resolveContentPath(project.Path, contentPath)
	if err != nil {
		return nil, err
	}

	// Merge front matter
	frontMatter := existing.FrontMatter
	if frontMatter == nil {
		frontMatter = make(map[string]interface{})
	}

	// Update with new values
	if options.FrontMatter != nil {
		for k, v := range options.FrontMatter {
			frontMatter[k] = v
		}
	}

	// Update title if provided
	if options.Title != "" {
		frontMatter["title"] = options.Title
	}

	// Update draft status
	if options.IsDraft {
		frontMatter["draft"] = true
	} else {
		// Only remove if explicitly set
		if _, exists := frontMatter["draft"]; exists && !options.IsDraft {
			delete(frontMatter, "draft")
		}
	}

	// Use existing format or specified format
	format := options.Format
	if format == "" {
		format = existing.Format
	}
	if format == "" {
		format = "yaml"
	}

	// Convert format string to metadecoders.Format
	var fmFormat metadecoders.Format
	switch format {
	case "toml":
		fmFormat = metadecoders.TOML
	case "json":
		fmFormat = metadecoders.JSON
	case "yaml", "yml":
		fmFormat = metadecoders.YAML
	default:
		fmFormat = metadecoders.YAML
	}

	// Use existing content or new content
	content := options.Content
	if content == "" {
		content = existing.Content
	}

	// Build content file
	var buf bytes.Buffer
	err = parser.InterfaceToFrontMatter(frontMatter, fmFormat, &buf)
	if err != nil {
		return nil, models.NewAppErrorWithDetails(
			models.ErrInvalidFrontMatter,
			"Failed to serialize front matter",
			err.Error(),
		)
	}

	// Add content
	if content != "" {
		buf.WriteString("\n")
		buf.WriteString(content)
	}

	// Write file atomically
	tempPath := resolvedPath + ".tmp"
	if err := os.WriteFile(tempPath, buf.Bytes(), 0644); err != nil {
		return nil, models.NewAppErrorWithDetails(
			models.ErrFileAccessDenied,
			"Failed to write content file",
			err.Error(),
		)
	}

	// Atomic rename
	if err := os.Rename(tempPath, resolvedPath); err != nil {
		os.Remove(tempPath) // Clean up temp file
		return nil, models.NewAppErrorWithDetails(
			models.ErrFileAccessDenied,
			"Failed to save content file",
			err.Error(),
		)
	}

	// Return updated content
	return s.GetContent(projectID, contentPath)
}

// DeleteContent deletes a content file
func (s *ContentService) DeleteContent(projectID string, contentPath string) error {
	// Get project
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return err
	}

	// Validate and resolve path
	resolvedPath, err := s.resolveContentPath(project.Path, contentPath)
	if err != nil {
		return err
	}

	// Check if file exists
	if !utils.FileExists(resolvedPath) {
		return models.NewAppError(
			models.ErrContentNotFound,
			fmt.Sprintf("Content file not found: %s", contentPath),
		)
	}

	// Delete file
	if err := os.Remove(resolvedPath); err != nil {
		return models.NewAppErrorWithDetails(
			models.ErrFileAccessDenied,
			"Failed to delete content file",
			err.Error(),
		)
	}

	return nil
}

// GetArchetype gets an archetype template
func (s *ContentService) GetArchetype(projectID string, archetypeName string) (*models.Archetype, error) {
	// Get project
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return nil, err
	}

	// Build archetype path
	archetypePath := filepath.Join(project.Path, "archetypes", archetypeName+".md")
	if !utils.FileExists(archetypePath) {
		// Try without extension
		archetypePath = filepath.Join(project.Path, "archetypes", archetypeName)
		if !utils.FileExists(archetypePath) {
			return nil, models.NewAppError(
				models.ErrArchetypeNotFound,
				fmt.Sprintf("Archetype not found: %s", archetypeName),
			)
		}
	}

	// Read archetype file
	file, err := os.Open(archetypePath)
	if err != nil {
		return nil, models.NewAppErrorWithDetails(
			models.ErrArchetypeNotFound,
			"Failed to open archetype file",
			err.Error(),
		)
	}
	defer file.Close()

	// Parse front matter and content
	parsed, err := pageparser.ParseFrontMatterAndContent(file)
	if err != nil {
		// If parsing fails, treat as content-only archetype
		file.Seek(0, io.SeekStart)
		content, err := io.ReadAll(file)
		if err != nil {
			return nil, models.NewAppErrorWithDetails(
				models.ErrArchetypeNotFound,
				"Failed to read archetype file",
				err.Error(),
			)
		}

		return &models.Archetype{
			Name:        archetypeName,
			Path:        archetypePath,
			FrontMatter: make(map[string]interface{}),
			Content:     string(content),
		}, nil
	}

	return &models.Archetype{
		Name:        archetypeName,
		Path:        archetypePath,
		FrontMatter: parsed.FrontMatter,
		Content:     string(parsed.Content),
	}, nil
}

// ListArchetypes lists available archetypes
func (s *ContentService) ListArchetypes(projectID string) ([]*models.Archetype, error) {
	// Get project
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return nil, err
	}

	// Build archetypes directory path
	archetypesDir := filepath.Join(project.Path, "archetypes")
	if !utils.FileExists(archetypesDir) {
		return []*models.Archetype{}, nil
	}

	// Read directory
	entries, err := os.ReadDir(archetypesDir)
	if err != nil {
		return nil, models.NewAppErrorWithDetails(
			models.ErrFileAccessDenied,
			"Failed to read archetypes directory",
			err.Error(),
		)
	}

	archetypes := make([]*models.Archetype, 0)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		// Get archetype name (without extension)
		name := entry.Name()
		ext := filepath.Ext(name)
		if ext != "" {
			name = strings.TrimSuffix(name, ext)
		}

		// Try to get archetype
		archetype, err := s.GetArchetype(projectID, name)
		if err != nil {
			continue // Skip files that can't be parsed
		}

		archetypes = append(archetypes, archetype)
	}

	return archetypes, nil
}

// Helper methods

func (s *ContentService) resolveContentPath(projectPath string, userPath string) (string, error) {
	// If path is absolute, validate it's within project
	if filepath.IsAbs(userPath) {
		absProjectPath, err := filepath.Abs(projectPath)
		if err != nil {
			return "", err
		}
		absUserPath, err := filepath.Abs(userPath)
		if err != nil {
			return "", err
		}
		if !strings.HasPrefix(absUserPath, absProjectPath) {
			return "", models.NewAppError(
				models.ErrInvalidPath,
				"Path is outside project directory",
			)
		}
		return absUserPath, nil
	}

	// Relative path - validate and resolve
	return utils.ValidatePath(projectPath, userPath)
}

