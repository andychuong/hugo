package services

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"hugo-manager/app/models"
	"hugo-manager/app/utils"

	"github.com/google/uuid"
)

// ProjectService handles project management operations
type ProjectService struct {
	projects    map[string]*models.Project
	mu          sync.RWMutex
	storage     *ProjectStorage
	hugoService *HugoService
}

// NewProjectService creates a new ProjectService instance
func NewProjectService() (*ProjectService, error) {
	storage, err := NewProjectStorage()
	if err != nil {
		return nil, fmt.Errorf("failed to initialize project storage: %w", err)
	}

	service := &ProjectService{
		projects:    make(map[string]*models.Project),
		storage:     storage,
		hugoService: NewHugoService(),
	}

	// Load existing projects from storage
	if err := service.loadProjects(); err != nil {
		return nil, fmt.Errorf("failed to load projects: %w", err)
	}

	return service, nil
}

// DiscoverProjects scans a directory for Hugo projects
func (s *ProjectService) DiscoverProjects(rootPath string) ([]*models.Project, error) {
	var projects []*models.Project

	absPath, err := filepath.Abs(rootPath)
	if err != nil {
		return nil, fmt.Errorf("invalid path: %w", err)
	}

	// Check if root path exists
	if !utils.IsDir(absPath) {
		return nil, fmt.Errorf("path is not a directory: %s", absPath)
	}

	err = filepath.Walk(absPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Continue on error
		}

		// Only check directories
		if !info.IsDir() {
			return nil
		}

		// Check if this directory is a Hugo project
		if utils.IsHugoProject(path) {
			// Check if project already exists
			existing := s.findProjectByPath(path)
			if existing != nil {
				return filepath.SkipDir // Skip this directory and its children
			}

			// Create new project
			project, err := s.createProjectFromPath(path)
			if err != nil {
				// Log error but continue
				return filepath.SkipDir
			}

			projects = append(projects, project)
			return filepath.SkipDir // Don't recurse into project directories
		}

		return nil
	})

	return projects, err
}

// CreateNewProject creates a new Hugo project from scratch
func (s *ProjectService) CreateNewProject(name, parentPath string) (*models.Project, error) {
	// Check if Hugo is installed
	if !s.hugoService.IsInstalled() {
		return nil, models.NewAppError(
			models.ErrHugoNotInstalled,
			"Hugo is not installed. Please install Hugo to create a new project.",
		)
	}

	// Create the new Hugo site
	err := s.hugoService.CreateNewSite(parentPath, name)
	if err != nil {
		return nil, models.NewAppErrorWithDetails(
			models.ErrProjectCreationFailed,
			"Failed to create Hugo site",
			err.Error(),
		)
	}

	// Full path to the new project
	fullPath := filepath.Join(parentPath, name)
	absPath, err := filepath.Abs(fullPath)
	if err != nil {
		return nil, models.NewAppErrorWithDetails(
			models.ErrInvalidPath,
			"Invalid project path",
			err.Error(),
		)
	}

	// Create project from the newly created path
	project, err := s.createProjectFromPath(absPath)
	if err != nil {
		return nil, err
	}

	// Override name if provided
	if name != "" {
		project.Name = name
	}

	// Save project
	if err := s.saveProject(project); err != nil {
		return nil, err
	}

	s.mu.Lock()
	s.projects[project.ID] = project
	s.mu.Unlock()

	return project, nil
}

// AddProject adds a new project manually
func (s *ProjectService) AddProject(name, path string) (*models.Project, error) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return nil, models.NewAppErrorWithDetails(
			models.ErrInvalidPath,
			"Invalid project path",
			err.Error(),
		)
	}

	// Validate that it's a Hugo project
	if !utils.IsHugoProject(absPath) {
		return nil, models.NewAppError(
			models.ErrProjectInvalid,
			"Directory is not a valid Hugo project",
		)
	}

	// Check if project already exists
	if existing := s.findProjectByPath(absPath); existing != nil {
		return existing, nil
	}

	// Create project
	project, err := s.createProjectFromPath(absPath)
	if err != nil {
		return nil, err
	}

	// Override name if provided
	if name != "" {
		project.Name = name
	}

	// Save project
	if err := s.saveProject(project); err != nil {
		return nil, err
	}

	s.mu.Lock()
	s.projects[project.ID] = project
	s.mu.Unlock()

	return project, nil
}

// RemoveProject removes a project
func (s *ProjectService) RemoveProject(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	_, exists := s.projects[id]
	if !exists {
		return models.NewAppError(
			models.ErrProjectNotFound,
			fmt.Sprintf("Project with ID %s not found", id),
		)
	}

	// Remove from storage
	if err := s.storage.RemoveProject(id); err != nil {
		return err
	}

	// Remove from memory
	delete(s.projects, id)

	return nil
}

// GetProject retrieves a project by ID
func (s *ProjectService) GetProject(id string) (*models.Project, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	project, exists := s.projects[id]
	if !exists {
		return nil, models.NewAppError(
			models.ErrProjectNotFound,
			fmt.Sprintf("Project with ID %s not found", id),
		)
	}

	return project, nil
}

// GetAllProjects returns all projects
func (s *ProjectService) GetAllProjects() ([]*models.Project, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	projects := make([]*models.Project, 0, len(s.projects))
	for _, project := range s.projects {
		projects = append(projects, project)
	}

	return projects, nil
}

// ValidateProject validates that a path is a valid Hugo project
func (s *ProjectService) ValidateProject(path string) (bool, error) {
	absPath, err := filepath.Abs(path)
	if err != nil {
		return false, err
	}

	if !utils.IsDir(absPath) {
		return false, nil
	}

	return utils.IsHugoProject(absPath), nil
}

// UpdateProjectMetadata updates project metadata
func (s *ProjectService) UpdateProjectMetadata(id string, metadata map[string]interface{}) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	project, exists := s.projects[id]
	if !exists {
		return models.NewAppError(
			models.ErrProjectNotFound,
			fmt.Sprintf("Project with ID %s not found", id),
		)
	}

	// Update fields from metadata
	if name, ok := metadata["name"].(string); ok {
		project.Name = name
	}

	// Save updated project
	if err := s.saveProject(project); err != nil {
		return err
	}

	return nil
}

// RefreshProject reloads project metadata from disk
func (s *ProjectService) RefreshProject(id string) (*models.Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	project, exists := s.projects[id]
	if !exists {
		return nil, models.NewAppError(
			models.ErrProjectNotFound,
			fmt.Sprintf("Project with ID %s not found", id),
		)
	}

	// Reload project from path
	refreshed, err := s.createProjectFromPath(project.Path)
	if err != nil {
		return nil, err
	}

	// Preserve ID and timestamps
	refreshed.ID = project.ID
	refreshed.CreatedAt = project.CreatedAt
	refreshed.CreatedAtStr = project.CreatedAt.Format(time.RFC3339)
	if !project.LastBuild.IsZero() {
		refreshed.LastBuild = project.LastBuild
		refreshed.LastBuildStr = project.LastBuild.Format(time.RFC3339)
	} else {
		refreshed.LastBuildStr = ""
	}

	// Update in memory
	s.projects[id] = refreshed

	// Save to storage
	if err := s.saveProject(refreshed); err != nil {
		return nil, err
	}

	return refreshed, nil
}

// Helper methods

func (s *ProjectService) createProjectFromPath(path string) (*models.Project, error) {
	// Get Hugo service for version detection
	hugoService := NewHugoService()

	// Detect Hugo version
	hugoVersion, err := hugoService.GetVersion()
	if err != nil {
		hugoVersion = "unknown"
	}

	// Parse config
	config, err := s.parseProjectConfig(path)
	if err != nil {
		// Use default config if parsing fails
		config = &models.Config{
			BaseURL:     "",
			Title:       filepath.Base(path),
			Environment: "development",
			PublishDir:  "public",
			Themes:      []string{},
			Languages:   []string{},
			Params:      make(map[string]interface{}),
		}
	}

	now := time.Now()
	project := &models.Project{
		ID:          uuid.New().String(),
		Name:        filepath.Base(path),
		Path:        path,
		HugoVersion: hugoVersion,
		Config:      config,
		Status: &models.Status{
			IsBuilding:    false,
			IsServing:     false,
			ServerURL:     "",
			ServerPort:    0,
			HasErrors:     false,
			ErrorMessage:  "",
			VisualEditing: false,
		},
		LastBuild:   time.Time{},
		CreatedAt:   now,
		Themes:      []models.Theme{},
		CreatedAtStr: now.Format(time.RFC3339),
		LastBuildStr: "", // Empty string for zero time
	}

	return project, nil
}

func (s *ProjectService) parseProjectConfig(projectPath string) (*models.Config, error) {
	// Find config file
	configPath, err := utils.FindConfigFile(projectPath)
	if err != nil {
		return nil, err
	}

	// Parse config file
	configMap, err := utils.ParseConfigFile(configPath)
	if err != nil {
		return nil, err
	}

	// Convert to Config model
	config := &models.Config{
		Params: make(map[string]interface{}),
	}

	// Extract common fields
	if baseURL, ok := configMap["baseURL"].(string); ok {
		config.BaseURL = baseURL
	}
	if title, ok := configMap["title"].(string); ok {
		config.Title = title
	}
	if env, ok := configMap["environment"].(string); ok {
		config.Environment = env
	}
	if publishDir, ok := configMap["publishDir"].(string); ok {
		config.PublishDir = publishDir
	}

	// Extract themes
	if themes, ok := configMap["theme"].(string); ok {
		config.Themes = []string{themes}
	} else if themes, ok := configMap["themes"].([]interface{}); ok {
		config.Themes = make([]string, 0, len(themes))
		for _, theme := range themes {
			if themeStr, ok := theme.(string); ok {
				config.Themes = append(config.Themes, themeStr)
			}
		}
	}

	// Extract languages
	if languages, ok := configMap["languages"].([]interface{}); ok {
		config.Languages = make([]string, 0, len(languages))
		for _, lang := range languages {
			if langStr, ok := lang.(string); ok {
				config.Languages = append(config.Languages, langStr)
			}
		}
	}

	// Extract params
	if params, ok := configMap["params"].(map[string]interface{}); ok {
		config.Params = params
	}

	return config, nil
}

func (s *ProjectService) findProjectByPath(path string) *models.Project {
	s.mu.RLock()
	defer s.mu.RUnlock()

	absPath, err := filepath.Abs(path)
	if err != nil {
		return nil
	}

	for _, project := range s.projects {
		projectAbsPath, err := filepath.Abs(project.Path)
		if err != nil {
			continue
		}
		if projectAbsPath == absPath {
			return project
		}
	}

	return nil
}

func (s *ProjectService) loadProjects() error {
	projects, err := s.storage.LoadAllProjects()
	if err != nil {
		return err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for _, project := range projects {
		// Verify project still exists on disk
		if utils.IsHugoProject(project.Path) {
			// Clear runtime status fields that shouldn't persist across app restarts
			// These represent in-memory state, not persistent state
			if project.Status != nil {
				project.Status.IsBuilding = false
				project.Status.IsServing = false
				project.Status.ServerURL = ""
				project.Status.ServerPort = 0
				// Keep HasErrors and ErrorMessage as they might be useful to persist
			}
			s.projects[project.ID] = project
		}
	}

	return nil
}

func (s *ProjectService) saveProject(project *models.Project) error {
	return s.storage.SaveProject(project)
}

// SaveProject saves a project to storage (public method)
func (s *ProjectService) SaveProject(project *models.Project) error {
	return s.storage.SaveProject(project)
}

