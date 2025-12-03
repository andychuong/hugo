package services

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"hugo-manager/app/models"
	"hugo-manager/app/utils"

	"github.com/bep/debounce"
	"github.com/fsnotify/fsnotify"
)

// FileWatcherService handles file system watching for projects
type FileWatcherService struct {
	projectService *ProjectService
	buildService   *BuildService
	watchers       map[string]*projectWatcher
	mu             sync.RWMutex
}

// projectWatcher represents a watcher for a single project
type projectWatcher struct {
	projectID    string
	watcher      *fsnotify.Watcher
	onChange     func(string) // Callback for file changes
	autoRebuild  bool
	debouncedRebuild func(func()) // Debounce function
	mu           sync.RWMutex
}

// NewFileWatcherService creates a new FileWatcherService instance
func NewFileWatcherService(projectService *ProjectService, buildService *BuildService) *FileWatcherService {
	return &FileWatcherService{
		projectService: projectService,
		buildService:   buildService,
		watchers:       make(map[string]*projectWatcher),
	}
}

// WatchProject starts watching a project for file changes
func (s *FileWatcherService) WatchProject(projectID string, autoRebuild bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Check if already watching
	if _, exists := s.watchers[projectID]; exists {
		return models.NewAppError(
			"WATCHER_ALREADY_RUNNING",
			fmt.Sprintf("Project %s is already being watched", projectID),
		)
	}

	// Get project
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return err
	}

	// Create watcher
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return models.NewAppErrorWithDetails(
			"WATCHER_CREATE_FAILED",
			"Failed to create file watcher",
			err.Error(),
		)
	}

	// Create project watcher
	pw := &projectWatcher{
		projectID:   projectID,
		watcher:     watcher,
		autoRebuild: autoRebuild,
	}

	// Set up debounced rebuild (2 second delay)
	if autoRebuild {
		pw.debouncedRebuild = debounce.New(2 * time.Second)
	}

	// Add project directory to watcher
	if err := watcher.Add(project.Path); err != nil {
		watcher.Close()
		return models.NewAppErrorWithDetails(
			"WATCHER_ADD_FAILED",
			"Failed to add project directory to watcher",
			err.Error(),
		)
	}

	// Recursively add subdirectories
	if err := s.addDirectoryRecursive(watcher, project.Path); err != nil {
		watcher.Close()
		return models.NewAppErrorWithDetails(
			"WATCHER_ADD_FAILED",
			"Failed to add subdirectories to watcher",
			err.Error(),
		)
	}

	// Store watcher
	s.watchers[projectID] = pw

	// Start watching in goroutine
	go s.watchLoop(pw)

	return nil
}

// StopWatching stops watching a project
func (s *FileWatcherService) StopWatching(projectID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	pw, exists := s.watchers[projectID]
	if !exists {
		return models.NewAppError(
			"WATCHER_NOT_RUNNING",
			fmt.Sprintf("Project %s is not being watched", projectID),
		)
	}

	// Close watcher
	if err := pw.watcher.Close(); err != nil {
		return models.NewAppErrorWithDetails(
			"WATCHER_CLOSE_FAILED",
			"Failed to close watcher",
			err.Error(),
		)
	}

	// Remove from map
	delete(s.watchers, projectID)

	return nil
}

// GetWatchStatus returns whether a project is being watched
func (s *FileWatcherService) GetWatchStatus(projectID string) (bool, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	_, exists := s.watchers[projectID]
	return exists, nil
}

// SetAutoRebuild enables or disables auto-rebuild for a watched project
func (s *FileWatcherService) SetAutoRebuild(projectID string, enabled bool) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	pw, exists := s.watchers[projectID]
	if !exists {
		return models.NewAppError(
			"WATCHER_NOT_RUNNING",
			fmt.Sprintf("Project %s is not being watched", projectID),
		)
	}

	pw.mu.Lock()
	pw.autoRebuild = enabled
	if enabled && pw.debouncedRebuild == nil {
		// Set up debounced rebuild
		pw.debouncedRebuild = debounce.New(2 * time.Second)
	}
	pw.mu.Unlock()

	return nil
}

// SetOnChangeCallback sets a callback function for file changes
func (s *FileWatcherService) SetOnChangeCallback(projectID string, callback func(string)) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	pw, exists := s.watchers[projectID]
	if !exists {
		return models.NewAppError(
			"WATCHER_NOT_RUNNING",
			fmt.Sprintf("Project %s is not being watched", projectID),
		)
	}

	pw.mu.Lock()
	pw.onChange = callback
	pw.mu.Unlock()

	return nil
}

// Helper methods

func (s *FileWatcherService) watchLoop(pw *projectWatcher) {
	for {
		select {
		case event, ok := <-pw.watcher.Events:
			if !ok {
				return
			}

			// Handle event
			s.handleEvent(pw, event)

		case err, ok := <-pw.watcher.Errors:
			if !ok {
				return
			}

			// Log error but continue watching
			fmt.Printf("File watcher error for project %s: %v\n", pw.projectID, err)
		}
	}
}

func (s *FileWatcherService) handleEvent(pw *projectWatcher, event fsnotify.Event) {
	// Ignore certain events
	if event.Op&fsnotify.Chmod == fsnotify.Chmod {
		return // Ignore permission changes
	}

	// Call onChange callback if set
	pw.mu.RLock()
	onChange := pw.onChange
	autoRebuild := pw.autoRebuild
	debouncedRebuild := pw.debouncedRebuild
	pw.mu.RUnlock()

	if onChange != nil {
		onChange(event.Name)
	}

	// Handle directory creation - add new directories to watcher
	if event.Op&fsnotify.Create == fsnotify.Create {
		// Check if it's a directory
		if utils.IsDir(event.Name) {
			// Add new directory to watcher
			if err := pw.watcher.Add(event.Name); err != nil {
				fmt.Printf("Failed to add new directory to watcher: %v\n", err)
			}

			// Recursively add subdirectories
			if err := s.addDirectoryRecursive(pw.watcher, event.Name); err != nil {
				fmt.Printf("Failed to add subdirectories to watcher: %v\n", err)
			}
		}
	}

	// Trigger auto-rebuild if enabled
	if autoRebuild && debouncedRebuild != nil {
		// Only rebuild on write/remove/rename events
		if event.Op&(fsnotify.Write|fsnotify.Remove|fsnotify.Rename) != 0 {
			debouncedRebuild(func() {
				// Trigger rebuild
				if s.buildService != nil {
					_, err := s.buildService.StartBuild(pw.projectID, models.BuildOptions{
						Environment: "development",
						Draft:        true,
						Future:       false,
						Expired:      false,
						Minify:       false,
						Verbose:      false,
						ExtraArgs:    []string{},
					})
					if err != nil {
						// Log error but don't fail
						fmt.Printf("Auto-rebuild failed for project %s: %v\n", pw.projectID, err)
					}
				}
			})
		}
	}
}

func (s *FileWatcherService) addDirectoryRecursive(watcher *fsnotify.Watcher, root string) error {
	return filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Continue on error
		}

		// Skip hidden directories and common build/cache directories
		if info.IsDir() {
			base := filepath.Base(path)
			if strings.HasPrefix(base, ".") && base != "." && base != ".." {
				return filepath.SkipDir
			}

			// Skip common build/cache directories
			if base == "public" || base == "resources" || base == ".hugo_build.lock" {
				return filepath.SkipDir
			}

			// Add directory to watcher
			if err := watcher.Add(path); err != nil {
				// Log but continue
				fmt.Printf("Failed to add directory to watcher: %v\n", err)
			}
		}

		return nil
	})
}

// StopAll stops all watchers (cleanup)
func (s *FileWatcherService) StopAll() {
	s.mu.Lock()
	defer s.mu.Unlock()

	for projectID, pw := range s.watchers {
		pw.watcher.Close()
		delete(s.watchers, projectID)
	}
}

