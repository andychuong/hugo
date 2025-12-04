package services

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net"
	"os/exec"
	"strconv"
	"sync"
	"syscall"
	"time"

	"hugo-manager/app/models"
)

// ServerService handles Hugo server operations
type ServerService struct {
	servers      map[string]*ServerProcess // projectID -> server process
	serverStatus map[string]*ServerStatus  // projectID -> server status
	mu           sync.RWMutex
	projectService *ProjectService
	hugoService    *HugoService
}

// ServerProcess represents a running Hugo server process
type ServerProcess struct {
	ProjectID  string
	Port       int
	URL        string
	PID        int
	StartTime  time.Time
	cmd        *exec.Cmd
	cancel     context.CancelFunc
	logs       []string
	logsMu     sync.RWMutex
	mu         sync.RWMutex
}

// ServerStatus tracks the current server status for a project
type ServerStatus struct {
	IsRunning  bool      `json:"isRunning"`
	URL        string    `json:"url"`
	Port       int       `json:"port"`
	PID        int       `json:"pid"`
	StartTime  time.Time `json:"startTime"`
	Logs       []string  `json:"logs"`
	Error      string    `json:"error"`
	mu         sync.RWMutex
}

// NewServerService creates a new ServerService instance
func NewServerService(projectService *ProjectService, hugoService *HugoService) *ServerService {
	return &ServerService{
		servers:       make(map[string]*ServerProcess),
		serverStatus:  make(map[string]*ServerStatus),
		projectService: projectService,
		hugoService:    hugoService,
	}
}

// StartServer starts a Hugo development server for a project
func (s *ServerService) StartServer(projectID string, options models.ServerOptions) (*models.ServerInfo, error) {
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
			"Hugo is not installed. Please install Hugo to start the server.",
		)
	}

	// Check if server is already running
	s.mu.RLock()
	if server, exists := s.servers[projectID]; exists && server != nil {
		// Check if process is still running
		if server.cmd != nil && server.cmd.Process != nil {
			// Try to check if process is alive by sending signal 0 (doesn't actually send, just checks)
			if err := server.cmd.Process.Signal(syscall.Signal(0)); err == nil {
				s.mu.RUnlock()
				return nil, models.NewAppError(
					models.ErrServerAlreadyRunning,
					fmt.Sprintf("Server is already running on port %d", server.Port),
				)
			}
		}
	}
	s.mu.RUnlock()

	// Determine port
	port := options.Port
	if port == 0 {
		port = 1313 // Default Hugo port
	}

	// Check for port conflicts
	available, err := s.checkPortAvailable(port)
	if err != nil {
		return nil, models.NewAppErrorWithDetails(
			models.ErrPortCheckFailed,
			"Failed to check port availability",
			err.Error(),
		)
	}
	if !available {
		// Try to find an available port
		port, err = s.findAvailablePort(port)
		if err != nil {
			return nil, models.NewAppErrorWithDetails(
				models.ErrPortUnavailable,
				"Could not find an available port",
				err.Error(),
			)
		}
	}

	// Build Hugo server command arguments
	args := []string{"server"}

	// Port
	args = append(args, "--port", strconv.Itoa(port))

	// Base URL
	if options.BaseURL != "" {
		args = append(args, "--baseURL", options.BaseURL)
	}

	// Build options
	if options.BuildDrafts {
		args = append(args, "--buildDrafts")
	}
	if options.BuildFuture {
		args = append(args, "--buildFuture")
	}
	if options.BuildExpired {
		args = append(args, "--buildExpired")
	}
	if options.DisableLiveReload {
		args = append(args, "--disableLiveReload")
	}

	// Create context for cancellation
	ctx, cancel := context.WithCancel(context.Background())

	// Create command
	cmd := exec.CommandContext(ctx, "hugo", args...)
	cmd.Dir = project.Path

	// Create server process
	server := &ServerProcess{
		ProjectID: projectID,
		Port:      port,
		URL:       fmt.Sprintf("http://localhost:%d", port),
		StartTime: time.Now(),
		cmd:       cmd,
		cancel:    cancel,
		logs:      make([]string, 0),
	}

	// Set up stdout and stderr pipes for logging
	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return nil, models.NewAppErrorWithDetails(
			models.ErrServerStartFailed,
			"Failed to create stdout pipe",
			err.Error(),
		)
	}
	stderrPipe, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		return nil, models.NewAppErrorWithDetails(
			models.ErrServerStartFailed,
			"Failed to create stderr pipe",
			err.Error(),
		)
	}

	// Start command
	err = cmd.Start()
	if err != nil {
		cancel()
		return nil, models.NewAppErrorWithDetails(
			models.ErrServerStartFailed,
			"Failed to start server",
			err.Error(),
		)
	}

	server.PID = cmd.Process.Pid

	// Store server
	s.mu.Lock()
	s.servers[projectID] = server
	s.serverStatus[projectID] = &ServerStatus{
		IsRunning: true,
		URL:       server.URL,
		Port:      port,
		PID:       server.PID,
		StartTime: server.StartTime,
		Logs:      make([]string, 0),
	}
	s.mu.Unlock()

	// Update project status
	s.projectService.mu.Lock()
	if project.Status == nil {
		project.Status = &models.Status{}
	}
	project.Status.IsServing = true
	project.Status.ServerURL = server.URL
	project.Status.ServerPort = port
	project.Status.HasErrors = false
	project.Status.ErrorMessage = ""
	s.projectService.mu.Unlock()

	// Start log streaming in goroutines
	go s.streamServerLogs(server, stdoutPipe, stderrPipe)

	// Wait for server to be ready (or fail)
	go s.waitForServerReady(server, project)

	// Return server info
	return &models.ServerInfo{
		ProjectID: projectID,
		IsRunning: true,
		URL:       server.URL,
		Port:      port,
		PID:       server.PID,
		StartTime: server.StartTime.Format(time.RFC3339),
	}, nil
}

// waitForServerReady waits for the server to be ready and updates status
func (s *ServerService) waitForServerReady(server *ServerProcess, project *models.Project) {
	// Wait a bit for server to start
	time.Sleep(500 * time.Millisecond)

	// Check if process is still running
	if server.cmd.Process == nil {
		s.handleServerError(server.ProjectID, "Server process exited unexpectedly")
		return
	}

	// Check if process is alive by sending signal 0 (doesn't actually send, just checks)
	if err := server.cmd.Process.Signal(syscall.Signal(0)); err != nil {
		s.handleServerError(server.ProjectID, fmt.Sprintf("Server process died: %v", err))
		return
	}

	// Wait for command to complete (in background)
	go func() {
		err := server.cmd.Wait()
		if err != nil {
			// Server stopped
			s.handleServerStopped(server.ProjectID, err.Error())
		} else {
			s.handleServerStopped(server.ProjectID, "")
		}
	}()
}

// streamServerLogs streams server output to logs
func (s *ServerService) streamServerLogs(server *ServerProcess, stdoutPipe, stderrPipe io.ReadCloser) {
	// Stream stdout
	go func() {
		defer stdoutPipe.Close()
		scanner := bufio.NewScanner(stdoutPipe)
		for scanner.Scan() {
			line := scanner.Text()
			s.addLogLine(server.ProjectID, line)
		}
	}()

	// Stream stderr
	go func() {
		defer stderrPipe.Close()
		scanner := bufio.NewScanner(stderrPipe)
		for scanner.Scan() {
			line := scanner.Text()
			s.addLogLine(server.ProjectID, line)
		}
	}()
}

// addLogLine adds a log line to both server process and status
func (s *ServerService) addLogLine(projectID string, line string) {
	s.mu.RLock()
	server, serverExists := s.servers[projectID]
	status, statusExists := s.serverStatus[projectID]
	s.mu.RUnlock()

	if serverExists && server != nil {
		server.logsMu.Lock()
		server.logs = append(server.logs, line)
		// Keep only last 1000 lines
		if len(server.logs) > 1000 {
			server.logs = server.logs[len(server.logs)-1000:]
		}
		server.logsMu.Unlock()
	}

	if statusExists && status != nil {
		status.mu.Lock()
		status.Logs = append(status.Logs, line)
		if len(status.Logs) > 1000 {
			status.Logs = status.Logs[len(status.Logs)-1000:]
		}
		status.mu.Unlock()
	}
}

// StopServer stops a running server
func (s *ServerService) StopServer(projectID string) error {
	s.mu.Lock()

	server, exists := s.servers[projectID]
	if !exists || server == nil {
		s.mu.Unlock()
		return models.NewAppError(
			models.ErrServerNotRunning,
			"Server is not running for this project",
		)
	}

	// Update status immediately so UI reflects the change
	if status, exists := s.serverStatus[projectID]; exists {
		status.mu.Lock()
		status.IsRunning = false
		status.mu.Unlock()
	}

	// Update project status immediately
	project, err := s.projectService.GetProject(projectID)
	if err == nil && project.Status != nil {
		project.Status.IsServing = false
		project.Status.ServerURL = ""
		project.Status.ServerPort = 0
	}

	// Get references to cmd and cancel before unlocking
	cmd := server.cmd
	cancel := server.cancel

	// Remove from maps immediately
	delete(s.servers, projectID)
	s.mu.Unlock()

	// Cancel context to stop command
	if cancel != nil {
		cancel()
	}

	// Kill process if still running (do this outside the lock)
	if cmd != nil && cmd.Process != nil {
		// Try graceful shutdown first
		cmd.Process.Signal(syscall.SIGTERM)
		
		// Wait for process to exit with timeout
		done := make(chan error, 1)
		go func() {
			done <- cmd.Wait()
		}()

		select {
		case <-done:
			// Process exited normally
		case <-time.After(2 * time.Second):
			// Timeout - force kill
			cmd.Process.Kill()
			// Wait a bit more for kill to take effect
			select {
			case <-done:
				// Process killed successfully
			case <-time.After(1 * time.Second):
				// Give up waiting - process might be stuck
			}
		}
	}

	return nil
}

// GetServerStatus returns the current server status for a project
func (s *ServerService) GetServerStatus(projectID string) (*models.ServerInfo, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	status, exists := s.serverStatus[projectID]
	if !exists {
		// Return stopped status
		return &models.ServerInfo{
			ProjectID: projectID,
			IsRunning: false,
		}, nil
	}

	status.mu.RLock()
	defer status.mu.RUnlock()

	// Check if process is still alive
	isRunning := status.IsRunning
	if isRunning {
		server, exists := s.servers[projectID]
		if exists && server != nil && server.cmd != nil && server.cmd.Process != nil {
			// Check if process is alive by sending signal 0 (doesn't actually send, just checks)
			if err := server.cmd.Process.Signal(syscall.Signal(0)); err != nil {
				isRunning = false
			}
		} else {
			isRunning = false
		}
	}

	return &models.ServerInfo{
		ProjectID: projectID,
		IsRunning: isRunning,
		URL:       status.URL,
		Port:      status.Port,
		PID:       status.PID,
		StartTime: status.StartTime.Format(time.RFC3339),
	}, nil
}

// GetServerLogs returns server logs for a project
func (s *ServerService) GetServerLogs(projectID string, limit int) ([]string, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	status, exists := s.serverStatus[projectID]
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

// checkPortAvailable checks if a port is available
func (s *ServerService) checkPortAvailable(port int) (bool, error) {
	addr, err := net.ResolveTCPAddr("tcp", fmt.Sprintf("localhost:%d", port))
	if err != nil {
		return false, err
	}

	l, err := net.ListenTCP("tcp", addr)
	if err != nil {
		return false, nil // Port is in use
	}
	defer l.Close()

	return true, nil
}

// findAvailablePort finds an available port starting from the given port
func (s *ServerService) findAvailablePort(startPort int) (int, error) {
	for port := startPort; port < startPort+100; port++ {
		available, err := s.checkPortAvailable(port)
		if err != nil {
			continue
		}
		if available {
			return port, nil
		}
	}
	return 0, fmt.Errorf("no available port found in range %d-%d", startPort, startPort+100)
}

// handleServerError handles server errors
func (s *ServerService) handleServerError(projectID string, errorMsg string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if status, exists := s.serverStatus[projectID]; exists {
		status.mu.Lock()
		status.IsRunning = false
		status.Error = errorMsg
		status.mu.Unlock()
	}

	// Remove from servers map
	delete(s.servers, projectID)

	// Update project status
	project, err := s.projectService.GetProject(projectID)
	if err == nil && project.Status != nil {
		project.Status.IsServing = false
		project.Status.HasErrors = true
		project.Status.ErrorMessage = errorMsg
	}
}

// handleServerStopped handles server stopped event
func (s *ServerService) handleServerStopped(projectID string, errorMsg string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if status, exists := s.serverStatus[projectID]; exists {
		status.mu.Lock()
		status.IsRunning = false
		if errorMsg != "" {
			status.Error = errorMsg
		}
		status.mu.Unlock()
	}

	// Remove from servers map
	delete(s.servers, projectID)

	// Update project status
	project, err := s.projectService.GetProject(projectID)
	if err == nil && project.Status != nil {
		project.Status.IsServing = false
		if errorMsg != "" {
			project.Status.HasErrors = true
			project.Status.ErrorMessage = errorMsg
		}
	}
}

