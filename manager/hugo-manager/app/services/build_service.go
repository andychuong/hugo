package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"hugo-manager/app/models"
	"hugo-manager/app/utils"

	"github.com/google/uuid"
)

// BuildService handles build operations
type BuildService struct {
	builds      map[string]*models.Build
	buildStatus map[string]*BuildStatus // projectID -> build status
	buildQueue  []*QueuedBuild
	mu          sync.RWMutex
	maxConcurrent int
	projectService *ProjectService
	hugoService    *HugoService
	configDir      string
}

// BuildStatus tracks the current build status for a project
type BuildStatus struct {
	BuildID    string
	Status     string // "running", "success", "failed", "cancelled"
	Progress   int    // 0-100
	Logs       []string
	StartTime  time.Time
	EndTime    time.Time
	Error      string
	cancel     context.CancelFunc
	mu         sync.RWMutex
}

// QueuedBuild represents a build waiting in the queue
type QueuedBuild struct {
	ID        string
	ProjectID string
	Options   models.BuildOptions
	CreatedAt time.Time
}

// NewBuildService creates a new BuildService instance
func NewBuildService(projectService *ProjectService, hugoService *HugoService) (*BuildService, error) {
	configDir, err := utils.GetConfigDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get config directory: %w", err)
	}

	service := &BuildService{
		builds:         make(map[string]*models.Build),
		buildStatus:    make(map[string]*BuildStatus),
		buildQueue:     make([]*QueuedBuild, 0),
		maxConcurrent:  3, // Allow up to 3 concurrent builds
		projectService: projectService,
		hugoService:    hugoService,
		configDir:      configDir,
	}

	// Load existing builds from storage
	if err := service.loadBuilds(); err != nil {
		// Log error but don't fail initialization
		fmt.Printf("Warning: Failed to load build history: %v\n", err)
	}

	return service, nil
}

// StartBuild starts a build for a project
func (s *BuildService) StartBuild(projectID string, options models.BuildOptions) (*models.Build, error) {
	// Get project
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return nil, models.NewAppErrorWithDetails(
			models.ErrProjectNotFound,
			"Project not found",
			err.Error(),
		)
	}

	// Check if Hugo is installed
	if !s.hugoService.IsInstalled() {
		return nil, models.NewAppError(
			models.ErrHugoNotInstalled,
			"Hugo is not installed. Please install Hugo to build projects.",
		)
	}

	// Check if project is already building
	s.mu.RLock()
	status, exists := s.buildStatus[projectID]
	s.mu.RUnlock()

	if exists && status.Status == "running" {
		return nil, models.NewAppError(
			models.ErrBuildInProgress,
			"Build is already in progress for this project",
		)
	}

	// Create build record
	build := &models.Build{
		ID:        uuid.New().String(),
		ProjectID: projectID,
		Status:    "running",
		StartTime: time.Now(),
	}

	s.mu.Lock()
	s.builds[build.ID] = build
	s.buildStatus[projectID] = &BuildStatus{
		BuildID:   build.ID,
		Status:    "running",
		Progress:  0,
		Logs:      make([]string, 0),
		StartTime: time.Now(),
	}
	s.mu.Unlock()

	// Update project status
	s.projectService.mu.Lock()
	if project.Status == nil {
		project.Status = &models.Status{}
	}
	project.Status.IsBuilding = true
	project.Status.HasErrors = false
	project.Status.ErrorMessage = ""
	s.projectService.mu.Unlock()

	// Start build in goroutine
	go s.executeBuild(build, project, options)

	return build, nil
}

// executeBuild executes the actual build
func (s *BuildService) executeBuild(build *models.Build, project *models.Project, options models.BuildOptions) {
	defer func() {
		// Update project status
		s.projectService.mu.Lock()
		if project.Status != nil {
			project.Status.IsBuilding = false
		}
		s.projectService.mu.Unlock()
	}()

	// Get build status
	s.mu.RLock()
	status := s.buildStatus[project.ID]
	s.mu.RUnlock()

	if status == nil {
		return
	}

	// Build Hugo command arguments
	args := []string{}

	// Environment
	if options.Environment != "" {
		args = append(args, "--environment", options.Environment)
	}

	// Draft content
	if options.Draft {
		args = append(args, "--buildDrafts")
	}

	// Future content
	if options.Future {
		args = append(args, "--buildFuture")
	}

	// Expired content
	if options.Expired {
		args = append(args, "--buildExpired")
	}

	// Minify
	if options.Minify {
		args = append(args, "--minify")
	}

	// Verbose
	if options.Verbose {
		args = append(args, "--verbose")
	}

	// Extra args
	args = append(args, options.ExtraArgs...)

	// Create a context for cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Store cancel function for cancellation BEFORE starting command
	s.mu.Lock()
	if status != nil {
		status.cancel = cancel
	}
	s.mu.Unlock()

	// Execute Hugo build command with context for cancellation
	cmd := exec.CommandContext(ctx, "hugo", append([]string{"build"}, args...)...)
	cmd.Dir = project.Path

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	// Start command
	err := cmd.Start()
	if err != nil {
		s.updateBuildStatus(project.ID, "failed", 0, fmt.Sprintf("Failed to start build: %v", err))
		return
	}

	// Stream output
	go s.streamOutput(ctx, cmd, status)

	// Wait for command to complete
	err = cmd.Wait()

	// Check if cancelled
	s.mu.RLock()
	currentStatus := s.buildStatus[project.ID]
	cancelled := currentStatus != nil && currentStatus.Status == "cancelled"
	s.mu.RUnlock()

	if cancelled {
		// Process was cancelled, update build record
		s.mu.Lock()
		build.EndTime = time.Now()
		build.Duration = time.Since(build.StartTime).Milliseconds()
		build.Status = "cancelled"
		build.Error = "Build cancelled by user"
		s.mu.Unlock()
		
		// Save cancelled build to storage
		if err := s.saveBuild(build); err != nil {
			fmt.Printf("Warning: Failed to save cancelled build to storage: %v\n", err)
		}
		
		return
	}

	// Update build record
	s.mu.Lock()
	build.EndTime = time.Now()
	build.Duration = time.Since(build.StartTime).Milliseconds()
	
	if err != nil {
		build.Status = "failed"
		build.Error = stderr.String()
		if build.Error == "" {
			build.Error = err.Error()
		}
		build.Output = stdout.String()
		s.updateBuildStatusUnsafe(project.ID, "failed", 100, build.Error)
		s.mu.Unlock()
		
		// Save failed build to storage
		if err := s.saveBuild(build); err != nil {
			fmt.Printf("Warning: Failed to save failed build to storage: %v\n", err)
		}
		
		// Update project last build time even for failed builds
		s.projectService.mu.Lock()
		project.LastBuild = time.Now()
		s.projectService.mu.Unlock()
		
		// Save project
		if err := s.projectService.SaveProject(project); err != nil {
			fmt.Printf("Warning: Failed to save project after failed build: %v\n", err)
		}
		
		return
	} else {
		build.Status = "success"
		build.Output = stdout.String()
		
		// Count generated files
		publishDir := "public"
		if project.Config != nil && project.Config.PublishDir != "" {
			publishDir = project.Config.PublishDir
		}
		publishPath := filepath.Join(project.Path, publishDir)
		if utils.IsDir(publishPath) {
			build.FilesGenerated = s.countFiles(publishPath)
		}
		
		s.updateBuildStatusUnsafe(project.ID, "success", 100, "")
	}
	s.mu.Unlock()

	// Save build to persistent storage
	if err := s.saveBuild(build); err != nil {
		// Log error but don't fail the build
		fmt.Printf("Warning: Failed to save build to storage: %v\n", err)
	}

	// Update project last build time
	s.projectService.mu.Lock()
	project.LastBuild = time.Now()
	s.projectService.mu.Unlock()
	
	// Save project
	if err := s.projectService.SaveProject(project); err != nil {
		// Log error but don't fail the build
		fmt.Printf("Warning: Failed to save project after build: %v\n", err)
	}
}

// streamOutput streams command output to build logs
func (s *BuildService) streamOutput(ctx context.Context, cmd *exec.Cmd, status *BuildStatus) {
	// Note: This is a simplified version. For real streaming, we'd need to use
	// cmd.StdoutPipe() and cmd.StderrPipe() and read from them in goroutines.
	// For now, we'll update logs after command completion.
}

// updateBuildStatus updates the build status (thread-safe)
func (s *BuildService) updateBuildStatus(projectID string, status string, progress int, errorMsg string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.updateBuildStatusUnsafe(projectID, status, progress, errorMsg)
}

// updateBuildStatusUnsafe updates the build status (must be called with lock held)
func (s *BuildService) updateBuildStatusUnsafe(projectID string, status string, progress int, errorMsg string) {
	if buildStatus, exists := s.buildStatus[projectID]; exists {
		buildStatus.mu.Lock()
		buildStatus.Status = status
		buildStatus.Progress = progress
		if errorMsg != "" {
			buildStatus.Error = errorMsg
		}
		if status == "success" || status == "failed" || status == "cancelled" {
			buildStatus.EndTime = time.Now()
		}
		buildStatus.mu.Unlock()
	}
}

// BuildStatusResponse is the exported build status (without internal fields)
type BuildStatusResponse struct {
	BuildID   string    `json:"buildId"`
	Status    string    `json:"status"`    // "running", "success", "failed", "cancelled"
	Progress  int       `json:"progress"`  // 0-100
	Logs      []string  `json:"logs"`
	StartTime time.Time `json:"startTime"`
	EndTime   time.Time `json:"endTime"`
	Error     string    `json:"error"`
}

// GetBuildStatus returns the current build status for a project
func (s *BuildService) GetBuildStatus(projectID string) (*BuildStatusResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	status, exists := s.buildStatus[projectID]
	if !exists {
		return nil, models.NewAppError(
			models.ErrBuildNotFound,
			"No build status found for this project",
		)
	}

	// Return a copy to avoid race conditions
	status.mu.RLock()
	defer status.mu.RUnlock()

	return &BuildStatusResponse{
		BuildID:   status.BuildID,
		Status:    status.Status,
		Progress:  status.Progress,
		Logs:      append([]string{}, status.Logs...),
		StartTime: status.StartTime,
		EndTime:   status.EndTime,
		Error:     status.Error,
	}, nil
}

// GetBuildLogs returns build logs for a project
func (s *BuildService) GetBuildLogs(projectID string, limit int) ([]string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	status, exists := s.buildStatus[projectID]
	if !exists {
		return []string{}, nil
	}

	status.mu.RLock()
	defer status.mu.RUnlock()

	logs := status.Logs
	if limit > 0 && limit < len(logs) {
		logs = logs[len(logs)-limit:]
	}

	return append([]string{}, logs...), nil
}

// CancelBuild cancels a running build
func (s *BuildService) CancelBuild(projectID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	status, exists := s.buildStatus[projectID]
	if !exists {
		return models.NewAppError(
			models.ErrBuildNotFound,
			"No build found for this project",
		)
	}

	if status.Status != "running" {
		return models.NewAppError(
			models.ErrBuildNotRunning,
			"Build is not currently running",
		)
	}

	// Cancel the build context (this will signal the command to stop)
	if status.cancel != nil {
		status.cancel()
	}

	// Update status to cancelled
	s.updateBuildStatusUnsafe(projectID, "cancelled", status.Progress, "Build cancelled by user")

	// Update project status
	project, err := s.projectService.GetProject(projectID)
	if err == nil && project.Status != nil {
		project.Status.IsBuilding = false
	}

	// Also update the build record if it exists
	s.mu.Lock()
	for _, build := range s.builds {
		if build.ProjectID == projectID && build.Status == "running" {
			build.Status = "cancelled"
			build.EndTime = time.Now()
			build.Duration = time.Since(build.StartTime).Milliseconds()
			build.Error = "Build cancelled by user"
		}
	}
	s.mu.Unlock()

	return nil
}

// GetBuildHistory returns build history for a project
func (s *BuildService) GetBuildHistory(projectID string, limit int) ([]*models.Build, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	history := make([]*models.Build, 0) // Always return a non-nil slice
	for _, build := range s.builds {
		if build.ProjectID == projectID {
			history = append(history, build)
		}
	}

	// Sort by start time (newest first)
	for i := 0; i < len(history)-1; i++ {
		for j := i + 1; j < len(history); j++ {
			if history[i].StartTime.Before(history[j].StartTime) {
				history[i], history[j] = history[j], history[i]
			}
		}
	}

	if limit > 0 && limit < len(history) {
		history = history[:limit]
	}

	return history, nil
}

// countFiles counts files in a directory recursively
func (s *BuildService) countFiles(dir string) int {
	count := 0
	filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if !info.IsDir() {
			count++
		}
		return nil
	})
	return count
}

// saveBuild saves a build to persistent storage
func (s *BuildService) saveBuild(build *models.Build) error {
	buildsDir := s.getBuildsDir()
	projectBuildsDir := filepath.Join(buildsDir, build.ProjectID)
	
	// Ensure directory exists
	if err := os.MkdirAll(projectBuildsDir, 0755); err != nil {
		return fmt.Errorf("failed to create builds directory: %w", err)
	}

	buildFile := filepath.Join(projectBuildsDir, build.ID+".json")
	
	data, err := json.MarshalIndent(build, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal build: %w", err)
	}

	if err := os.WriteFile(buildFile, data, 0644); err != nil {
		return fmt.Errorf("failed to write build file: %w", err)
	}

	return nil
}

// loadBuilds loads all builds from persistent storage
func (s *BuildService) loadBuilds() error {
	buildsDir := s.getBuildsDir()
	
	// Check if builds directory exists
	if !utils.IsDir(buildsDir) {
		return nil // No builds directory yet, that's okay
	}

	// Walk through all project directories
	err := filepath.Walk(buildsDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip errors
		}

		// Only process JSON files
		if info.IsDir() || filepath.Ext(path) != ".json" {
			return nil
		}

		// Read build file
		data, err := os.ReadFile(path)
		if err != nil {
			return nil // Skip files we can't read
		}

		var build models.Build
		if err := json.Unmarshal(data, &build); err != nil {
			return nil // Skip invalid files
		}

		// Add to in-memory map
		s.mu.Lock()
		s.builds[build.ID] = &build
		s.mu.Unlock()

		return nil
	})

	return err
}

// getBuildsDir returns the builds directory path
func (s *BuildService) getBuildsDir() string {
	return filepath.Join(s.configDir, "builds")
}


