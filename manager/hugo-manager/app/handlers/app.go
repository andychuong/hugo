package handlers

import (
	"context"
	"fmt"
	"os/exec"
	goruntime "runtime"

	"hugo-manager/app/models"
	"hugo-manager/app/services"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx                  context.Context
	projectService       *services.ProjectService
	hugoService          *services.HugoService
	buildService         *services.BuildService
	serverService        *services.ServerService
	fileService          *services.FileService
	fileWatcherService   *services.FileWatcherService
	contentService       *services.ContentService
	configService        *services.ConfigService
	deploymentService    *services.DeploymentService
	themeService         *services.ThemeService
	visualEditingService *services.VisualEditingService
	multiSiteService     *services.MultiSiteService
}

// NewApp creates a new App application struct
func NewApp() *App {
	projectService, err := services.NewProjectService()
	if err != nil {
		// Log error but continue - service will be nil and methods will return errors
		fmt.Printf("Warning: Failed to initialize project service: %v\n", err)
	}

	hugoService := services.NewHugoService()
	buildService, err := services.NewBuildService(projectService, hugoService)
	if err != nil {
		// Log error but continue - service will be nil and methods will return errors
		fmt.Printf("Warning: Failed to initialize build service: %v\n", err)
	}
	serverService := services.NewServerService(projectService, hugoService)
	fileService := services.NewFileService(projectService)
	fileWatcherService := services.NewFileWatcherService(projectService, buildService)
	contentService := services.NewContentService(projectService)
	configService := services.NewConfigService(projectService)
	
	deploymentService, err := services.NewDeploymentService(projectService, buildService)
	if err != nil {
		fmt.Printf("Warning: Failed to initialize deployment service: %v\n", err)
	}
	
	themeService, err := services.NewThemeService(projectService, hugoService)
	if err != nil {
		fmt.Printf("Warning: Failed to initialize theme service: %v\n", err)
	}
	
	visualEditingService := services.NewVisualEditingService(projectService)
	
	multiSiteService, err := services.NewMultiSiteService(projectService)
	if err != nil {
		fmt.Printf("Warning: Failed to initialize multi-site service: %v\n", err)
	}

	return &App{
		projectService:       projectService,
		hugoService:          hugoService,
		buildService:         buildService,
		serverService:         serverService,
		fileService:           fileService,
		fileWatcherService:    fileWatcherService,
		contentService:        contentService,
		configService:         configService,
		deploymentService:     deploymentService,
		themeService:          themeService,
		visualEditingService:  visualEditingService,
		multiSiteService:      multiSiteService,
	}
}

// Startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
}

// Project Management Methods

// GetProjects returns all projects
func (a *App) GetProjects() ([]*models.Project, error) {
	if a.projectService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Project service not initialized")
	}
	return a.projectService.GetAllProjects()
}

// GetProject returns a single project by ID
func (a *App) GetProject(id string) (*models.Project, error) {
	if a.projectService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Project service not initialized")
	}
	return a.projectService.GetProject(id)
}

// AddProject adds a new project
func (a *App) AddProject(name, path string) (*models.Project, error) {
	if a.projectService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Project service not initialized")
	}
	return a.projectService.AddProject(name, path)
}

// CreateNewProject creates a new Hugo project from scratch
func (a *App) CreateNewProject(name, parentPath string) (*models.Project, error) {
	if a.projectService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Project service not initialized")
	}
	return a.projectService.CreateNewProject(name, parentPath)
}

// RemoveProject removes a project
func (a *App) RemoveProject(id string) error {
	if a.projectService == nil {
		return models.NewAppError("SERVICE_ERROR", "Project service not initialized")
	}
	return a.projectService.RemoveProject(id)
}

// ScanDirectory scans a directory for Hugo projects
func (a *App) ScanDirectory(path string) ([]*models.Project, error) {
	if a.projectService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Project service not initialized")
	}
	projects, err := a.projectService.DiscoverProjects(path)
	if err != nil {
		return nil, err
	}

	// Save discovered projects
	for _, project := range projects {
		_, err := a.projectService.AddProject(project.Name, project.Path)
		if err != nil {
			// Log but continue
			fmt.Printf("Warning: Failed to save discovered project %s: %v\n", project.Path, err)
		}
	}

	return a.projectService.GetAllProjects()
}

// ValidateProject validates that a path is a Hugo project
func (a *App) ValidateProject(path string) (bool, error) {
	if a.projectService == nil {
		return false, models.NewAppError("SERVICE_ERROR", "Project service not initialized")
	}
	return a.projectService.ValidateProject(path)
}

// SelectDirectory opens a native directory selection dialog
func (a *App) SelectDirectory(title string) (string, error) {
	if a.ctx == nil {
		return "", fmt.Errorf("context not initialized")
	}
	
	selection, err := runtime.OpenDirectoryDialog(a.ctx, runtime.OpenDialogOptions{
		Title: title,
	})
	if err != nil {
		return "", err
	}
	
	return selection, nil
}

// RefreshProject reloads project metadata
func (a *App) RefreshProject(id string) (*models.Project, error) {
	if a.projectService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Project service not initialized")
	}
	return a.projectService.RefreshProject(id)
}

// Hugo Methods

// GetHugoVersion returns the Hugo version
func (a *App) GetHugoVersion() (string, error) {
	return a.hugoService.GetVersion()
}

// IsHugoInstalled checks if Hugo is installed
func (a *App) IsHugoInstalled() bool {
	return a.hugoService.IsInstalled()
}

// Build Methods

// BuildProject starts a build for a project
func (a *App) BuildProject(projectID string, options models.BuildOptions) (*models.Build, error) {
	if a.buildService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Build service not initialized")
	}
	return a.buildService.StartBuild(projectID, options)
}

// GetBuildStatus returns the current build status for a project
func (a *App) GetBuildStatus(projectID string) (*services.BuildStatusResponse, error) {
	if a.buildService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Build service not initialized")
	}
	return a.buildService.GetBuildStatus(projectID)
}

// GetBuildLogs returns build logs for a project
func (a *App) GetBuildLogs(projectID string, limit int) ([]string, error) {
	if a.buildService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Build service not initialized")
	}
	return a.buildService.GetBuildLogs(projectID, limit)
}

// CancelBuild cancels a running build
func (a *App) CancelBuild(projectID string) error {
	if a.buildService == nil {
		return models.NewAppError("SERVICE_ERROR", "Build service not initialized")
	}
	return a.buildService.CancelBuild(projectID)
}

// GetBuildHistory returns build history for a project
func (a *App) GetBuildHistory(projectID string, limit int) ([]*models.Build, error) {
	if a.buildService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Build service not initialized")
	}
	return a.buildService.GetBuildHistory(projectID, limit)
}

// Server Methods

// StartServer starts a development server for a project
func (a *App) StartServer(projectID string, options models.ServerOptions) (*models.ServerInfo, error) {
	if a.serverService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Server service not initialized")
	}
	return a.serverService.StartServer(projectID, options)
}

// StopServer stops a running server for a project
func (a *App) StopServer(projectID string) error {
	if a.serverService == nil {
		return models.NewAppError("SERVICE_ERROR", "Server service not initialized")
	}
	return a.serverService.StopServer(projectID)
}

// GetServerStatus returns the current server status for a project
func (a *App) GetServerStatus(projectID string) (*models.ServerInfo, error) {
	if a.serverService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Server service not initialized")
	}
	return a.serverService.GetServerStatus(projectID)
}

// GetServerLogs returns server logs for a project
func (a *App) GetServerLogs(projectID string, limit int) ([]string, error) {
	if a.serverService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Server service not initialized")
	}
	return a.serverService.GetServerLogs(projectID, limit)
}

// File Management Methods

// GetProjectStructure returns the file structure for a project path
func (a *App) GetProjectStructure(projectID string, path string) ([]*models.FileInfo, error) {
	if a.fileService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "File service not initialized")
	}
	return a.fileService.GetProjectStructure(projectID, path)
}

// ReadFile reads the contents of a file
func (a *App) ReadFile(projectID string, filePath string) (string, error) {
	if a.fileService == nil {
		return "", models.NewAppError("SERVICE_ERROR", "File service not initialized")
	}
	return a.fileService.ReadFile(projectID, filePath)
}

// WriteFile writes content to a file
func (a *App) WriteFile(projectID string, filePath string, content string) error {
	if a.fileService == nil {
		return models.NewAppError("SERVICE_ERROR", "File service not initialized")
	}
	return a.fileService.WriteFile(projectID, filePath, content)
}

// CreateFile creates a new file
func (a *App) CreateFile(projectID string, filePath string, content string) error {
	if a.fileService == nil {
		return models.NewAppError("SERVICE_ERROR", "File service not initialized")
	}
	return a.fileService.CreateFile(projectID, filePath, content)
}

// DeleteFile deletes a file or directory
func (a *App) DeleteFile(projectID string, filePath string) error {
	if a.fileService == nil {
		return models.NewAppError("SERVICE_ERROR", "File service not initialized")
	}
	return a.fileService.DeleteFile(projectID, filePath)
}

// RenameFile renames a file or directory
func (a *App) RenameFile(projectID string, oldPath string, newName string) error {
	if a.fileService == nil {
		return models.NewAppError("SERVICE_ERROR", "File service not initialized")
	}
	return a.fileService.RenameFile(projectID, oldPath, newName)
}

// CreateDirectory creates a new directory
func (a *App) CreateDirectory(projectID string, dirPath string) error {
	if a.fileService == nil {
		return models.NewAppError("SERVICE_ERROR", "File service not initialized")
	}
	return a.fileService.CreateDirectory(projectID, dirPath)
}

// CopyFile copies a file or directory
func (a *App) CopyFile(projectID string, srcPath string, dstPath string) error {
	if a.fileService == nil {
		return models.NewAppError("SERVICE_ERROR", "File service not initialized")
	}
	return a.fileService.CopyFile(projectID, srcPath, dstPath)
}

// File Watcher Methods

// WatchProject starts watching a project for file changes
func (a *App) WatchProject(projectID string, autoRebuild bool) error {
	if a.fileWatcherService == nil {
		return models.NewAppError("SERVICE_ERROR", "File watcher service not initialized")
	}
	return a.fileWatcherService.WatchProject(projectID, autoRebuild)
}

// StopWatching stops watching a project
func (a *App) StopWatching(projectID string) error {
	if a.fileWatcherService == nil {
		return models.NewAppError("SERVICE_ERROR", "File watcher service not initialized")
	}
	return a.fileWatcherService.StopWatching(projectID)
}

// GetWatchStatus returns whether a project is being watched
func (a *App) GetWatchStatus(projectID string) (bool, error) {
	if a.fileWatcherService == nil {
		return false, models.NewAppError("SERVICE_ERROR", "File watcher service not initialized")
	}
	return a.fileWatcherService.GetWatchStatus(projectID)
}

// SetAutoRebuild enables or disables auto-rebuild for a watched project
func (a *App) SetAutoRebuild(projectID string, enabled bool) error {
	if a.fileWatcherService == nil {
		return models.NewAppError("SERVICE_ERROR", "File watcher service not initialized")
	}
	return a.fileWatcherService.SetAutoRebuild(projectID, enabled)
}

// Content Management Methods

// GetContent reads and parses a content file
func (a *App) GetContent(projectID string, contentPath string) (*models.Content, error) {
	if a.contentService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Content service not initialized")
	}
	return a.contentService.GetContent(projectID, contentPath)
}

// ListContent lists content files in a directory
func (a *App) ListContent(projectID string, path string) (*models.ContentList, error) {
	if a.contentService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Content service not initialized")
	}
	return a.contentService.ListContent(projectID, path)
}

// CreateContent creates a new content file
func (a *App) CreateContent(projectID string, options models.ContentOptions) (*models.Content, error) {
	if a.contentService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Content service not initialized")
	}
	return a.contentService.CreateContent(projectID, options)
}

// UpdateContent updates an existing content file
func (a *App) UpdateContent(projectID string, contentPath string, options models.ContentOptions) (*models.Content, error) {
	if a.contentService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Content service not initialized")
	}
	return a.contentService.UpdateContent(projectID, contentPath, options)
}

// DeleteContent deletes a content file
func (a *App) DeleteContent(projectID string, contentPath string) error {
	if a.contentService == nil {
		return models.NewAppError("SERVICE_ERROR", "Content service not initialized")
	}
	return a.contentService.DeleteContent(projectID, contentPath)
}

// GetArchetype gets an archetype template
func (a *App) GetArchetype(projectID string, archetypeName string) (*models.Archetype, error) {
	if a.contentService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Content service not initialized")
	}
	return a.contentService.GetArchetype(projectID, archetypeName)
}

// ListArchetypes lists available archetypes
func (a *App) ListArchetypes(projectID string) ([]*models.Archetype, error) {
	if a.contentService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Content service not initialized")
	}
	return a.contentService.ListArchetypes(projectID)
}

// Config Management Methods

// GetConfigFileInfo returns information about the config file(s) for a project
func (a *App) GetConfigFileInfo(projectID string) (*models.ConfigFileInfo, error) {
	if a.configService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Config service not initialized")
	}
	return a.configService.GetConfigFileInfo(projectID)
}

// GetConfig reads and parses the config file for a project
func (a *App) GetConfig(projectID string, environment string) (map[string]interface{}, error) {
	if a.configService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Config service not initialized")
	}
	return a.configService.GetConfig(projectID, environment)
}

// UpdateConfig updates a config value in the config file
func (a *App) UpdateConfig(projectID string, keyPath []string, value interface{}) error {
	if a.configService == nil {
		return models.NewAppError("SERVICE_ERROR", "Config service not initialized")
	}
	return a.configService.UpdateConfig(projectID, keyPath, value)
}

// ValidateConfig validates a config value
func (a *App) ValidateConfig(keyPath []string, value interface{}) error {
	if a.configService == nil {
		return models.NewAppError("SERVICE_ERROR", "Config service not initialized")
	}
	return a.configService.ValidateConfig(keyPath, value)
}

// GetAvailableEnvironments returns available environment configs for a project
func (a *App) GetAvailableEnvironments(projectID string) ([]string, error) {
	if a.configService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Config service not initialized")
	}
	return a.configService.GetAvailableEnvironments(projectID)
}

// ConvertConfigFormat converts a config file from one format to another
func (a *App) ConvertConfigFormat(projectID string, newFormat string) error {
	if a.configService == nil {
		return models.NewAppError("SERVICE_ERROR", "Config service not initialized")
	}
	return a.configService.ConvertConfigFormat(projectID, newFormat)
}

// OpenInFileExplorer opens the given path in the system's file explorer
func (a *App) OpenInFileExplorer(path string) error {
	var cmd *exec.Cmd

	switch goruntime.GOOS {
	case "darwin": // macOS
		cmd = exec.Command("open", path)
	case "windows":
		cmd = exec.Command("explorer", path)
	case "linux":
		// Try xdg-open first, fallback to nautilus
		cmd = exec.Command("xdg-open", path)
	default:
		return fmt.Errorf("unsupported operating system: %s", goruntime.GOOS)
	}

	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("failed to open file explorer: %w", err)
	}

	return nil
}

// Deployment Methods

// CreateDeployment creates a new deployment configuration
func (a *App) CreateDeployment(projectID string, deploymentType string, config map[string]interface{}) (*models.Deployment, error) {
	if a.deploymentService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Deployment service not initialized")
	}
	return a.deploymentService.CreateDeployment(projectID, deploymentType, config)
}

// GetDeployment gets a deployment by ID
func (a *App) GetDeployment(deploymentID string) (*models.Deployment, error) {
	if a.deploymentService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Deployment service not initialized")
	}
	return a.deploymentService.GetDeployment(deploymentID)
}

// GetDeploymentsForProject gets all deployments for a project
func (a *App) GetDeploymentsForProject(projectID string) ([]*models.Deployment, error) {
	if a.deploymentService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Deployment service not initialized")
	}
	return a.deploymentService.GetDeploymentsForProject(projectID)
}

// UpdateDeployment updates a deployment configuration
func (a *App) UpdateDeployment(deploymentID string, config map[string]interface{}) (*models.Deployment, error) {
	if a.deploymentService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Deployment service not initialized")
	}
	return a.deploymentService.UpdateDeployment(deploymentID, config)
}

// DeleteDeployment deletes a deployment configuration
func (a *App) DeleteDeployment(deploymentID string) error {
	if a.deploymentService == nil {
		return models.NewAppError("SERVICE_ERROR", "Deployment service not initialized")
	}
	return a.deploymentService.DeleteDeployment(deploymentID)
}

// Deploy executes a deployment
func (a *App) Deploy(deploymentID string, options models.DeploymentOptions) (*models.DeploymentHistory, error) {
	if a.deploymentService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Deployment service not initialized")
	}
	return a.deploymentService.Deploy(deploymentID, options)
}

// GetDeploymentHistory gets deployment history for a deployment
func (a *App) GetDeploymentHistory(deploymentID string, limit int) ([]*models.DeploymentHistory, error) {
	if a.deploymentService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Deployment service not initialized")
	}
	return a.deploymentService.GetDeploymentHistory(deploymentID, limit)
}

// Theme Methods

// SearchThemes searches for themes
func (a *App) SearchThemes(query string, filters map[string]interface{}) ([]*models.Theme, error) {
	if a.themeService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Theme service not initialized")
	}
	return a.themeService.SearchThemes(query, filters)
}

// GetThemeIndex gets the theme index
func (a *App) GetThemeIndex() ([]*models.Theme, error) {
	if a.themeService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Theme service not initialized")
	}
	return a.themeService.GetThemeIndex()
}

// UpdateThemeIndex updates the theme index cache
func (a *App) UpdateThemeIndex() error {
	if a.themeService == nil {
		return models.NewAppError("SERVICE_ERROR", "Theme service not initialized")
	}
	return a.themeService.UpdateThemeIndex()
}

// GetThemeMetadata gets theme metadata from theme.toml
func (a *App) GetThemeMetadata(themePath string) (*models.ThemeMetadata, error) {
	if a.themeService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Theme service not initialized")
	}
	return a.themeService.GetThemeMetadata(themePath)
}

// InstallTheme installs a theme via Hugo Modules
func (a *App) InstallTheme(projectID string, themePath string) error {
	if a.themeService == nil {
		return models.NewAppError("SERVICE_ERROR", "Theme service not initialized")
	}
	return a.themeService.InstallTheme(projectID, themePath)
}

// InstallThemeSubmodule installs a theme via Git submodule
func (a *App) InstallThemeSubmodule(projectID string, themeURL string, themeName string) error {
	if a.themeService == nil {
		return models.NewAppError("SERVICE_ERROR", "Theme service not initialized")
	}
	return a.themeService.InstallThemeSubmodule(projectID, themeURL, themeName)
}

// RemoveTheme removes a theme from a project
func (a *App) RemoveTheme(projectID string, themePath string) error {
	if a.themeService == nil {
		return models.NewAppError("SERVICE_ERROR", "Theme service not initialized")
	}
	return a.themeService.RemoveTheme(projectID, themePath)
}

// GetInstalledThemes gets all installed themes for a project
func (a *App) GetInstalledThemes(projectID string) ([]*models.Theme, error) {
	if a.themeService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Theme service not initialized")
	}
	return a.themeService.GetInstalledThemes(projectID)
}

// UpdateTheme updates a theme to the latest version
func (a *App) UpdateTheme(projectID string, themePath string) error {
	if a.themeService == nil {
		return models.NewAppError("SERVICE_ERROR", "Theme service not initialized")
	}
	return a.themeService.UpdateTheme(projectID, themePath)
}

// GetThemeFromMarketplace gets theme information from marketplace
func (a *App) GetThemeFromMarketplace(themeName string) (*models.Theme, error) {
	if a.themeService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Theme service not initialized")
	}
	return a.themeService.GetThemeFromMarketplace(themeName)
}

// SearchGitHubThemes searches GitHub directly for Hugo themes
func (a *App) SearchGitHubThemes(query string, limit int) ([]*models.Theme, error) {
	if a.themeService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Theme service not initialized")
	}
	if limit <= 0 {
		limit = 30
	}
	return a.themeService.SearchGitHubThemes(query, limit)
}

// SetGitHubToken sets GitHub token for authenticated API requests
func (a *App) SetGitHubToken(token string) error {
	if a.themeService == nil {
		return models.NewAppError("SERVICE_ERROR", "Theme service not initialized")
	}
	a.themeService.SetGitHubToken(token)
	return nil
}

// Visual Editing Methods

// GetPageStructure gets the structure of a page for visual editing
func (a *App) GetPageStructure(projectID string, pagePath string) (*models.PageStructure, error) {
	if a.visualEditingService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Visual editing service not initialized")
	}
	return a.visualEditingService.GetPageStructure(projectID, pagePath)
}

// GetEditableRegions gets all editable regions for a page
func (a *App) GetEditableRegions(projectID string, pagePath string) ([]models.EditableRegion, error) {
	if a.visualEditingService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Visual editing service not initialized")
	}
	return a.visualEditingService.GetEditableRegions(projectID, pagePath)
}

// UpdatePageField updates a page field via visual editing
func (a *App) UpdatePageField(projectID string, pagePath string, field string, value interface{}) error {
	if a.visualEditingService == nil {
		return models.NewAppError("SERVICE_ERROR", "Visual editing service not initialized")
	}
	return a.visualEditingService.UpdatePageField(projectID, pagePath, field, value)
}

// SetVisualEditingEnabled enables or disables visual editing for a project
func (a *App) SetVisualEditingEnabled(projectID string, enabled bool) error {
	if a.visualEditingService == nil {
		return models.NewAppError("SERVICE_ERROR", "Visual editing service not initialized")
	}
	return a.visualEditingService.SetVisualEditingEnabled(projectID, enabled)
}

// GetVisualEditingConfig gets visual editing configuration
func (a *App) GetVisualEditingConfig(projectID string) (*models.VisualEditingConfig, error) {
	if a.visualEditingService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Visual editing service not initialized")
	}
	return a.visualEditingService.GetVisualEditingConfig(projectID)
}

// UpdateVisualEditingConfig updates visual editing configuration
func (a *App) UpdateVisualEditingConfig(projectID string, config *models.VisualEditingConfig) error {
	if a.visualEditingService == nil {
		return models.NewAppError("SERVICE_ERROR", "Visual editing service not initialized")
	}
	return a.visualEditingService.UpdateVisualEditingConfig(projectID, config)
}

// GetSiteStructure gets the structure of the entire site
func (a *App) GetSiteStructure(projectID string) (*models.SiteStructure, error) {
	if a.visualEditingService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Visual editing service not initialized")
	}
	return a.visualEditingService.GetSiteStructure(projectID)
}

// Multi-Site Methods

// CreateProjectGroup creates a new project group
func (a *App) CreateProjectGroup(name string, description string, projectIDs []string) (*models.ProjectGroup, error) {
	if a.multiSiteService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Multi-site service not initialized")
	}
	return a.multiSiteService.CreateProjectGroup(name, description, projectIDs)
}

// GetProjectGroup gets a project group by ID
func (a *App) GetProjectGroup(groupID string) (*models.ProjectGroup, error) {
	if a.multiSiteService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Multi-site service not initialized")
	}
	return a.multiSiteService.GetProjectGroup(groupID)
}

// GetAllProjectGroups gets all project groups
func (a *App) GetAllProjectGroups() ([]*models.ProjectGroup, error) {
	if a.multiSiteService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Multi-site service not initialized")
	}
	return a.multiSiteService.GetAllProjectGroups()
}

// UpdateProjectGroup updates a project group
func (a *App) UpdateProjectGroup(groupID string, name string, description string, projectIDs []string) (*models.ProjectGroup, error) {
	if a.multiSiteService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Multi-site service not initialized")
	}
	return a.multiSiteService.UpdateProjectGroup(groupID, name, description, projectIDs)
}

// DeleteProjectGroup deletes a project group
func (a *App) DeleteProjectGroup(groupID string) error {
	if a.multiSiteService == nil {
		return models.NewAppError("SERVICE_ERROR", "Multi-site service not initialized")
	}
	return a.multiSiteService.DeleteProjectGroup(groupID)
}

// ExecuteBulkOperation executes a bulk operation on multiple projects
func (a *App) ExecuteBulkOperation(operationType string, projectIDs []string, options map[string]interface{}) (*models.BulkOperation, error) {
	if a.multiSiteService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Multi-site service not initialized")
	}
	return a.multiSiteService.ExecuteBulkOperation(operationType, projectIDs, options)
}

// GetBulkOperation gets a bulk operation by ID
func (a *App) GetBulkOperation(operationID string) (*models.BulkOperation, error) {
	if a.multiSiteService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Multi-site service not initialized")
	}
	return a.multiSiteService.GetBulkOperation(operationID)
}

// CreateProjectTemplate creates a new project template
func (a *App) CreateProjectTemplate(name string, description string, config map[string]interface{}, files []models.TemplateFile) (*models.ProjectTemplate, error) {
	if a.multiSiteService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Multi-site service not initialized")
	}
	return a.multiSiteService.CreateProjectTemplate(name, description, config, files)
}

// GetProjectTemplate gets a project template by ID
func (a *App) GetProjectTemplate(templateID string) (*models.ProjectTemplate, error) {
	if a.multiSiteService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Multi-site service not initialized")
	}
	return a.multiSiteService.GetProjectTemplate(templateID)
}

// GetAllProjectTemplates gets all project templates
func (a *App) GetAllProjectTemplates() ([]*models.ProjectTemplate, error) {
	if a.multiSiteService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Multi-site service not initialized")
	}
	return a.multiSiteService.GetAllProjectTemplates()
}

// DeleteProjectTemplate deletes a project template
func (a *App) DeleteProjectTemplate(templateID string) error {
	if a.multiSiteService == nil {
		return models.NewAppError("SERVICE_ERROR", "Multi-site service not initialized")
	}
	return a.multiSiteService.DeleteProjectTemplate(templateID)
}

// CloneProject clones a project
func (a *App) CloneProject(projectID string, options models.CloneOptions) (*models.Project, error) {
	if a.multiSiteService == nil {
		return nil, models.NewAppError("SERVICE_ERROR", "Multi-site service not initialized")
	}
	return a.multiSiteService.CloneProject(projectID, options)
}
