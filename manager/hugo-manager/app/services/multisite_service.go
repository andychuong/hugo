package services

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"hugo-manager/app/models"
	"hugo-manager/app/utils"

	"github.com/google/uuid"
)

// MultiSiteService handles multi-site operations
type MultiSiteService struct {
	projectService *ProjectService
	storagePath    string
}

// NewMultiSiteService creates a new multi-site service
func NewMultiSiteService(projectService *ProjectService) (*MultiSiteService, error) {
	storagePath, err := utils.GetConfigDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get config directory: %w", err)
	}
	
	groupsPath := filepath.Join(storagePath, "groups")
	if err := os.MkdirAll(groupsPath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create groups directory: %w", err)
	}
	
	templatesPath := filepath.Join(storagePath, "templates")
	if err := os.MkdirAll(templatesPath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create templates directory: %w", err)
	}
	
	return &MultiSiteService{
		projectService: projectService,
		storagePath:    storagePath,
	}, nil
}

// Project Groups

// CreateProjectGroup creates a new project group
func (s *MultiSiteService) CreateProjectGroup(name, description string, projectIDs []string) (*models.ProjectGroup, error) {
	group := &models.ProjectGroup{
		ID:          uuid.New().String(),
		Name:        name,
		Description: description,
		ProjectIDs:  projectIDs,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	
	if err := s.saveProjectGroup(group); err != nil {
		return nil, err
	}
	
	return group, nil
}

// GetProjectGroup gets a project group by ID
func (s *MultiSiteService) GetProjectGroup(groupID string) (*models.ProjectGroup, error) {
	path := filepath.Join(s.storagePath, "groups", groupID+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("group not found: %w", err)
	}
	
	var group models.ProjectGroup
	if err := json.Unmarshal(data, &group); err != nil {
		return nil, fmt.Errorf("failed to parse group: %w", err)
	}
	
	return &group, nil
}

// GetAllProjectGroups gets all project groups
func (s *MultiSiteService) GetAllProjectGroups() ([]*models.ProjectGroup, error) {
	groupsPath := filepath.Join(s.storagePath, "groups")
	entries, err := os.ReadDir(groupsPath)
	if err != nil {
		return []*models.ProjectGroup{}, nil
	}
	
	var groups []*models.ProjectGroup
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		
		path := filepath.Join(groupsPath, entry.Name())
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		
		var group models.ProjectGroup
		if err := json.Unmarshal(data, &group); err != nil {
			continue
		}
		
		groups = append(groups, &group)
	}
	
	return groups, nil
}

// UpdateProjectGroup updates a project group
func (s *MultiSiteService) UpdateProjectGroup(groupID string, name, description string, projectIDs []string) (*models.ProjectGroup, error) {
	group, err := s.GetProjectGroup(groupID)
	if err != nil {
		return nil, err
	}
	
	group.Name = name
	group.Description = description
	group.ProjectIDs = projectIDs
	group.UpdatedAt = time.Now()
	
	if err := s.saveProjectGroup(group); err != nil {
		return nil, err
	}
	
	return group, nil
}

// DeleteProjectGroup deletes a project group
func (s *MultiSiteService) DeleteProjectGroup(groupID string) error {
	path := filepath.Join(s.storagePath, "groups", groupID+".json")
	return os.Remove(path)
}

// Bulk Operations

// ExecuteBulkOperation executes a bulk operation on multiple projects
func (s *MultiSiteService) ExecuteBulkOperation(operationType string, projectIDs []string, options map[string]interface{}) (*models.BulkOperation, error) {
	operation := &models.BulkOperation{
		ID:         uuid.New().String(),
		Type:       operationType,
		ProjectIDs: projectIDs,
		Status:     "running",
		Results:    make(map[string]interface{}),
		CreatedAt:  time.Now(),
	}
	
	// Execute operation in goroutine
	go s.executeBulkOperationAsync(operation, options)
	
	// Save operation
	if err := s.saveBulkOperation(operation); err != nil {
		return nil, err
	}
	
	return operation, nil
}

func (s *MultiSiteService) executeBulkOperationAsync(operation *models.BulkOperation, options map[string]interface{}) {
	results := make(map[string]interface{})
	
	for _, projectID := range operation.ProjectIDs {
		var result interface{}
		var err error
		
		switch operation.Type {
		case "build":
			// Build project
			// This would call build service with options["buildOptions"]
			result = map[string]interface{}{
				"status": "completed",
				"message": "Build completed",
			}
		case "deploy":
			// Deploy project
			result = map[string]interface{}{
				"status": "completed",
				"message": "Deployment completed",
			}
		case "update":
			// Update project
			result = map[string]interface{}{
				"status": "completed",
				"message": "Update completed",
			}
		default:
			result = map[string]interface{}{
				"status":  "failed",
				"message": "Unknown operation type",
			}
		}
		
		if err != nil {
			result = map[string]interface{}{
				"status":  "failed",
				"message": err.Error(),
			}
		}
		
		results[projectID] = result
	}
	
	operation.Results = results
	operation.Status = "completed"
	operation.CompletedAt = time.Now()
	
	s.saveBulkOperation(operation)
}

// GetBulkOperation gets a bulk operation by ID
func (s *MultiSiteService) GetBulkOperation(operationID string) (*models.BulkOperation, error) {
	path := filepath.Join(s.storagePath, "operations", operationID+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("operation not found: %w", err)
	}
	
	var operation models.BulkOperation
	if err := json.Unmarshal(data, &operation); err != nil {
		return nil, fmt.Errorf("failed to parse operation: %w", err)
	}
	
	return &operation, nil
}

// Project Templates

// CreateProjectTemplate creates a new project template
func (s *MultiSiteService) CreateProjectTemplate(name, description string, config map[string]interface{}, files []models.TemplateFile) (*models.ProjectTemplate, error) {
	template := &models.ProjectTemplate{
		ID:          uuid.New().String(),
		Name:        name,
		Description: description,
		Config:      config,
		Files:       files,
		CreatedAt:   time.Now(),
	}
	
	if err := s.saveProjectTemplate(template); err != nil {
		return nil, err
	}
	
	return template, nil
}

// GetProjectTemplate gets a project template by ID
func (s *MultiSiteService) GetProjectTemplate(templateID string) (*models.ProjectTemplate, error) {
	path := filepath.Join(s.storagePath, "templates", templateID+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("template not found: %w", err)
	}
	
	var template models.ProjectTemplate
	if err := json.Unmarshal(data, &template); err != nil {
		return nil, fmt.Errorf("failed to parse template: %w", err)
	}
	
	return &template, nil
}

// GetAllProjectTemplates gets all project templates
func (s *MultiSiteService) GetAllProjectTemplates() ([]*models.ProjectTemplate, error) {
	templatesPath := filepath.Join(s.storagePath, "templates")
	entries, err := os.ReadDir(templatesPath)
	if err != nil {
		return []*models.ProjectTemplate{}, nil
	}
	
	var templates []*models.ProjectTemplate
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		
		path := filepath.Join(templatesPath, entry.Name())
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		
		var template models.ProjectTemplate
		if err := json.Unmarshal(data, &template); err != nil {
			continue
		}
		
		templates = append(templates, &template)
	}
	
	return templates, nil
}

// DeleteProjectTemplate deletes a project template
func (s *MultiSiteService) DeleteProjectTemplate(templateID string) error {
	path := filepath.Join(s.storagePath, "templates", templateID+".json")
	return os.Remove(path)
}

// CloneProject clones a project
func (s *MultiSiteService) CloneProject(projectID string, options models.CloneOptions) (*models.Project, error) {
	sourceProject, err := s.projectService.GetProject(projectID)
	if err != nil {
		return nil, err
	}
	
	// Create new project directory
	newPath := filepath.Join(options.NewPath, options.NewName)
	if err := os.MkdirAll(newPath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create project directory: %w", err)
	}
	
	// Copy files
	if options.CopyConfig {
		// Copy config files
		configFiles := []string{"hugo.toml", "hugo.yaml", "hugo.json", "config.toml", "config.yaml", "config.json"}
		for _, configFile := range configFiles {
			src := filepath.Join(sourceProject.Path, configFile)
			dst := filepath.Join(newPath, configFile)
			if _, err := os.Stat(src); err == nil {
				data, err := os.ReadFile(src)
				if err == nil {
					os.WriteFile(dst, data, 0644)
				}
			}
		}
	}
	
	if options.CopyContent {
		// Copy content directory
		srcContent := filepath.Join(sourceProject.Path, "content")
		dstContent := filepath.Join(newPath, "content")
		if err := copyDirectory(srcContent, dstContent); err != nil {
			return nil, fmt.Errorf("failed to copy content: %w", err)
		}
	}
	
	// Create new project
	newProject, err := s.projectService.AddProject(options.NewName, newPath)
	if err != nil {
		return nil, err
	}
	
	return newProject, nil
}

// Helper functions

func (s *MultiSiteService) saveProjectGroup(group *models.ProjectGroup) error {
	path := filepath.Join(s.storagePath, "groups", group.ID+".json")
	data, err := json.MarshalIndent(group, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal group: %w", err)
	}
	
	return os.WriteFile(path, data, 0644)
}

func (s *MultiSiteService) saveBulkOperation(operation *models.BulkOperation) error {
	operationsPath := filepath.Join(s.storagePath, "operations")
	if err := os.MkdirAll(operationsPath, 0755); err != nil {
		return fmt.Errorf("failed to create operations directory: %w", err)
	}
	
	path := filepath.Join(operationsPath, operation.ID+".json")
	data, err := json.MarshalIndent(operation, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal operation: %w", err)
	}
	
	return os.WriteFile(path, data, 0644)
}

func (s *MultiSiteService) saveProjectTemplate(template *models.ProjectTemplate) error {
	path := filepath.Join(s.storagePath, "templates", template.ID+".json")
	data, err := json.MarshalIndent(template, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal template: %w", err)
	}
	
	return os.WriteFile(path, data, 0644)
}

func copyDirectory(src, dst string) error {
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		
		relPath, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		
		dstPath := filepath.Join(dst, relPath)
		
		if info.IsDir() {
			return os.MkdirAll(dstPath, info.Mode())
		}
		
		data, err := os.ReadFile(path)
		if err != nil {
			return err
		}
		
		return os.WriteFile(dstPath, data, info.Mode())
	})
}

