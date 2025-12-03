package services

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"

	"hugo-manager/app/models"
	"hugo-manager/app/utils"
)

// ProjectStorage handles persistence of projects
type ProjectStorage struct {
	configDir string
}

// NewProjectStorage creates a new ProjectStorage instance
func NewProjectStorage() (*ProjectStorage, error) {
	configDir, err := utils.GetConfigDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get config directory: %w", err)
	}

	storage := &ProjectStorage{
		configDir: configDir,
	}

	// Ensure storage directories exist
	if err := storage.ensureDirectories(); err != nil {
		return nil, err
	}

	return storage, nil
}

// SaveProject saves a project to storage
func (s *ProjectStorage) SaveProject(project *models.Project) error {
	projectFile := s.getProjectFilePath(project.ID)

	// Create a copy to avoid modifying the original
	projectCopy := *project
	if projectCopy.Status != nil {
		statusCopy := *projectCopy.Status
		// Don't persist runtime-only status fields
		statusCopy.IsBuilding = false
		statusCopy.IsServing = false
		statusCopy.ServerURL = ""
		statusCopy.ServerPort = 0
		projectCopy.Status = &statusCopy
	}

	data, err := json.MarshalIndent(&projectCopy, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal project: %w", err)
	}

	if err := os.WriteFile(projectFile, data, 0644); err != nil {
		return fmt.Errorf("failed to write project file: %w", err)
	}

	return nil
}

// LoadProject loads a project from storage
func (s *ProjectStorage) LoadProject(id string) (*models.Project, error) {
	projectFile := s.getProjectFilePath(id)

	if !utils.FileExists(projectFile) {
		return nil, models.NewAppError(
			models.ErrProjectNotFound,
			fmt.Sprintf("Project file not found: %s", id),
		)
	}

	data, err := os.ReadFile(projectFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read project file: %w", err)
	}

	var project models.Project
	if err := json.Unmarshal(data, &project); err != nil {
		return nil, fmt.Errorf("failed to unmarshal project: %w", err)
	}

	return &project, nil
}

// LoadAllProjects loads all projects from storage
func (s *ProjectStorage) LoadAllProjects() ([]*models.Project, error) {
	projectsDir := s.getProjectsDir()

	entries, err := os.ReadDir(projectsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return []*models.Project{}, nil
		}
		return nil, fmt.Errorf("failed to read projects directory: %w", err)
	}

	var projects []*models.Project
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}

		// Extract ID from filename (remove .json extension)
		id := entry.Name()[:len(entry.Name())-5]

		project, err := s.LoadProject(id)
		if err != nil {
			// Skip invalid projects
			continue
		}

		projects = append(projects, project)
	}

	return projects, nil
}

// RemoveProject removes a project from storage
func (s *ProjectStorage) RemoveProject(id string) error {
	projectFile := s.getProjectFilePath(id)

	if !utils.FileExists(projectFile) {
		return nil // Already removed
	}

	if err := os.Remove(projectFile); err != nil {
		return fmt.Errorf("failed to remove project file: %w", err)
	}

	return nil
}

// GetConfigFilePath returns the path to the main config file
func (s *ProjectStorage) GetConfigFilePath() string {
	return filepath.Join(s.configDir, "config.json")
}

// LoadConfig loads the application configuration
func (s *ProjectStorage) LoadConfig() (*AppConfig, error) {
	configFile := s.GetConfigFilePath()

	if !utils.FileExists(configFile) {
		// Return default config
		return &AppConfig{
			AutoWatch:   true,
			DefaultPort: 1313,
			Theme:       "dark",
		}, nil
	}

	data, err := os.ReadFile(configFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config AppConfig
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &config, nil
}

// SaveConfig saves the application configuration
func (s *ProjectStorage) SaveConfig(config *AppConfig) error {
	configFile := s.GetConfigFilePath()

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(configFile, data, 0644); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

// AppConfig represents the application configuration
type AppConfig struct {
	AutoWatch   bool   `json:"autoWatch"`
	DefaultPort int    `json:"defaultPort"`
	Theme       string `json:"theme"`
}

// Helper methods

func (s *ProjectStorage) ensureDirectories() error {
	projectsDir := s.getProjectsDir()
	if err := os.MkdirAll(projectsDir, 0755); err != nil {
		return fmt.Errorf("failed to create projects directory: %w", err)
	}
	return nil
}

func (s *ProjectStorage) getProjectsDir() string {
	return filepath.Join(s.configDir, "projects")
}

func (s *ProjectStorage) getProjectFilePath(id string) string {
	return filepath.Join(s.getProjectsDir(), id+".json")
}

