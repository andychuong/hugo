package services

import (
	"encoding/base64"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"hugo-manager/app/models"
	"hugo-manager/app/utils"
)

// FileService handles file operations for projects
type FileService struct {
	projectService *ProjectService
	mu            sync.RWMutex
}

// NewFileService creates a new FileService instance
func NewFileService(projectService *ProjectService) *FileService {
	return &FileService{
		projectService: projectService,
	}
}

// GetProjectStructure returns the file structure for a project path
func (s *FileService) GetProjectStructure(projectID string, path string) ([]*models.FileInfo, error) {
	// Get project
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return nil, err
	}

	// Validate and resolve path
	resolvedPath, err := s.resolvePath(project.Path, path)
	if err != nil {
		return nil, err
	}

	// Check if path exists
	if !utils.FileExists(resolvedPath) {
		return nil, models.NewAppError(
			models.ErrFileNotFound,
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

	// Read directory
	entries, err := os.ReadDir(resolvedPath)
	if err != nil {
		return nil, models.NewAppErrorWithDetails(
			models.ErrFileAccessDenied,
			"Failed to read directory",
			err.Error(),
		)
	}

	// Convert to FileInfo
	files := make([]*models.FileInfo, 0, len(entries))
	for _, entry := range entries {
		entryPath := filepath.Join(resolvedPath, entry.Name())
		info, err := entry.Info()
		if err != nil {
			continue // Skip entries we can't read
		}

		// Calculate relative path from project root
		relPath, err := filepath.Rel(project.Path, entryPath)
		if err != nil {
			relPath = entry.Name()
		}

		fileInfo := &models.FileInfo{
			Name:      entry.Name(),
			Path:      relPath,
			IsDir:     entry.IsDir(),
			Size:      info.Size(),
			ModTime:   info.ModTime(),
			Extension: utils.GetFileExtension(entry.Name()),
		}

		files = append(files, fileInfo)
	}

	return files, nil
}

// ReadFile reads the contents of a file
func (s *FileService) ReadFile(projectID string, filePath string) (string, error) {
	// Get project
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return "", err
	}

	// Validate and resolve path
	resolvedPath, err := s.resolvePath(project.Path, filePath)
	if err != nil {
		return "", err
	}

	// Check if file exists
	if !utils.FileExists(resolvedPath) {
		return "", models.NewAppError(
			models.ErrFileNotFound,
			fmt.Sprintf("File not found: %s", filePath),
		)
	}

	// Check if it's a file (not directory)
	if utils.IsDir(resolvedPath) {
		return "", models.NewAppError(
			models.ErrInvalidPath,
			"Path is a directory, not a file",
		)
	}

	// Read file
	content, err := os.ReadFile(resolvedPath)
	if err != nil {
		return "", models.NewAppErrorWithDetails(
			models.ErrFileAccessDenied,
			"Failed to read file",
			err.Error(),
		)
	}

	return string(content), nil
}

// ReadFileAsBase64 reads a file and returns it as a base64-encoded string
func (s *FileService) ReadFileAsBase64(projectID string, filePath string) (string, error) {
	// Get project
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return "", err
	}

	// Validate and resolve path
	resolvedPath, err := s.resolvePath(project.Path, filePath)
	if err != nil {
		return "", err
	}

	// Check if file exists
	if !utils.FileExists(resolvedPath) {
		return "", models.NewAppError(
			models.ErrFileNotFound,
			fmt.Sprintf("File not found: %s", filePath),
		)
	}

	// Check if it's a file (not directory)
	if utils.IsDir(resolvedPath) {
		return "", models.NewAppError(
			models.ErrInvalidPath,
			"Path is a directory, not a file",
		)
	}

	// Read file
	content, err := os.ReadFile(resolvedPath)
	if err != nil {
		return "", models.NewAppErrorWithDetails(
			models.ErrFileAccessDenied,
			"Failed to read file",
			err.Error(),
		)
	}

	// Encode to base64
	base64Str := base64.StdEncoding.EncodeToString(content)
	
	// Determine MIME type from extension
	ext := strings.ToLower(filepath.Ext(resolvedPath))
	mimeType := "image/png" // default
	switch ext {
	case ".jpg", ".jpeg":
		mimeType = "image/jpeg"
	case ".png":
		mimeType = "image/png"
	case ".gif":
		mimeType = "image/gif"
	case ".svg":
		mimeType = "image/svg+xml"
	case ".webp":
		mimeType = "image/webp"
	case ".bmp":
		mimeType = "image/bmp"
	case ".ico":
		mimeType = "image/x-icon"
	}

	return fmt.Sprintf("data:%s;base64,%s", mimeType, base64Str), nil
}

// WriteFile writes content to a file
func (s *FileService) WriteFile(projectID string, filePath string, content string) error {
	// Get project
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return err
	}

	// Validate and resolve path
	resolvedPath, err := s.resolvePath(project.Path, filePath)
	if err != nil {
		return err
	}

	// Check if file exists
	if !utils.FileExists(resolvedPath) {
		return models.NewAppError(
			models.ErrFileNotFound,
			fmt.Sprintf("File not found: %s", filePath),
		)
	}

	// Check if it's a file (not directory)
	if utils.IsDir(resolvedPath) {
		return models.NewAppError(
			models.ErrInvalidPath,
			"Path is a directory, not a file",
		)
	}

	// Write file atomically
	tempPath := resolvedPath + ".tmp"
	if err := os.WriteFile(tempPath, []byte(content), 0644); err != nil {
		return models.NewAppErrorWithDetails(
			models.ErrFileAccessDenied,
			"Failed to write file",
			err.Error(),
		)
	}

	// Atomic rename
	if err := os.Rename(tempPath, resolvedPath); err != nil {
		os.Remove(tempPath) // Clean up temp file
		return models.NewAppErrorWithDetails(
			models.ErrFileAccessDenied,
			"Failed to save file",
			err.Error(),
		)
	}

	return nil
}

// CreateFile creates a new file
func (s *FileService) CreateFile(projectID string, filePath string, content string) error {
	// Get project
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return err
	}

	// Validate and resolve path
	resolvedPath, err := s.resolvePath(project.Path, filePath)
	if err != nil {
		return err
	}

	// Check if file already exists
	if utils.FileExists(resolvedPath) {
		return models.NewAppError(
			models.ErrFileAccessDenied,
			fmt.Sprintf("File already exists: %s", filePath),
		)
	}

	// Ensure parent directory exists
	parentDir := filepath.Dir(resolvedPath)
	if err := os.MkdirAll(parentDir, 0755); err != nil {
		return models.NewAppErrorWithDetails(
			models.ErrFileAccessDenied,
			"Failed to create parent directory",
			err.Error(),
		)
	}

	// Create file
	if err := os.WriteFile(resolvedPath, []byte(content), 0644); err != nil {
		return models.NewAppErrorWithDetails(
			models.ErrFileAccessDenied,
			"Failed to create file",
			err.Error(),
		)
	}

	return nil
}

// DeleteFile deletes a file or directory
func (s *FileService) DeleteFile(projectID string, filePath string) error {
	// Get project
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return err
	}

	// Validate and resolve path
	resolvedPath, err := s.resolvePath(project.Path, filePath)
	if err != nil {
		return err
	}

	// Prevent deleting the project root
	if resolvedPath == project.Path {
		return models.NewAppError(
			models.ErrFileAccessDenied,
			"Cannot delete project root directory",
		)
	}

	// Check if path exists
	if !utils.FileExists(resolvedPath) {
		return models.NewAppError(
			models.ErrFileNotFound,
			fmt.Sprintf("Path not found: %s", filePath),
		)
	}

	// Delete file or directory
	if utils.IsDir(resolvedPath) {
		if err := os.RemoveAll(resolvedPath); err != nil {
			return models.NewAppErrorWithDetails(
				models.ErrFileAccessDenied,
				"Failed to delete directory",
				err.Error(),
			)
		}
	} else {
		if err := os.Remove(resolvedPath); err != nil {
			return models.NewAppErrorWithDetails(
				models.ErrFileAccessDenied,
				"Failed to delete file",
				err.Error(),
			)
		}
	}

	return nil
}

// RenameFile renames a file or directory
func (s *FileService) RenameFile(projectID string, oldPath string, newName string) error {
	// Get project
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return err
	}

	// Validate and resolve old path
	oldResolvedPath, err := s.resolvePath(project.Path, oldPath)
	if err != nil {
		return err
	}

	// Check if old path exists
	if !utils.FileExists(oldResolvedPath) {
		return models.NewAppError(
			models.ErrFileNotFound,
			fmt.Sprintf("Path not found: %s", oldPath),
		)
	}

	// Build new path
	parentDir := filepath.Dir(oldResolvedPath)
	newResolvedPath := filepath.Join(parentDir, newName)

	// Validate new path
	if _, err := utils.ValidatePath(project.Path, newResolvedPath); err != nil {
		return models.NewAppError(
			models.ErrInvalidPath,
			"Invalid new path",
		)
	}

	// Check if new path already exists
	if utils.FileExists(newResolvedPath) {
		return models.NewAppError(
			models.ErrFileAccessDenied,
			fmt.Sprintf("Path already exists: %s", newName),
		)
	}

	// Rename
	if err := os.Rename(oldResolvedPath, newResolvedPath); err != nil {
		return models.NewAppErrorWithDetails(
			models.ErrFileAccessDenied,
			"Failed to rename file",
			err.Error(),
		)
	}

	return nil
}

// CreateDirectory creates a new directory
func (s *FileService) CreateDirectory(projectID string, dirPath string) error {
	// Get project
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return err
	}

	// Validate and resolve path
	resolvedPath, err := s.resolvePath(project.Path, dirPath)
	if err != nil {
		return err
	}

	// Check if directory already exists
	if utils.FileExists(resolvedPath) {
		return models.NewAppError(
			models.ErrFileAccessDenied,
			fmt.Sprintf("Directory already exists: %s", dirPath),
		)
	}

	// Create directory
	if err := os.MkdirAll(resolvedPath, 0755); err != nil {
		return models.NewAppErrorWithDetails(
			models.ErrFileAccessDenied,
			"Failed to create directory",
			err.Error(),
		)
	}

	return nil
}

// CopyFile copies a file or directory
func (s *FileService) CopyFile(projectID string, srcPath string, dstPath string) error {
	// Get project
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return err
	}

	// Validate and resolve paths
	srcResolvedPath, err := s.resolvePath(project.Path, srcPath)
	if err != nil {
		return err
	}

	dstResolvedPath, err := s.resolvePath(project.Path, dstPath)
	if err != nil {
		return err
	}

	// Check if source exists
	if !utils.FileExists(srcResolvedPath) {
		return models.NewAppError(
			models.ErrFileNotFound,
			fmt.Sprintf("Source path not found: %s", srcPath),
		)
	}

	// Check if destination already exists
	if utils.FileExists(dstResolvedPath) {
		return models.NewAppError(
			models.ErrFileAccessDenied,
			fmt.Sprintf("Destination already exists: %s", dstPath),
		)
	}

	// Copy file or directory
	if utils.IsDir(srcResolvedPath) {
		return s.copyDirectory(srcResolvedPath, dstResolvedPath)
	} else {
		return s.copySingleFile(srcResolvedPath, dstResolvedPath)
	}
}

// Helper methods

func (s *FileService) resolvePath(projectPath string, userPath string) (string, error) {
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

func (s *FileService) copySingleFile(src, dst string) error {
	// Ensure destination directory exists
	dstDir := filepath.Dir(dst)
	if err := os.MkdirAll(dstDir, 0755); err != nil {
		return err
	}

	// Open source file
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	// Create destination file
	dstFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	// Copy contents
	_, err = io.Copy(dstFile, srcFile)
	return err
}

func (s *FileService) copyDirectory(src, dst string) error {
	// Create destination directory
	if err := os.MkdirAll(dst, 0755); err != nil {
		return err
	}

	// Walk source directory
	return filepath.Walk(src, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Calculate relative path
		relPath, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}

		// Build destination path
		dstPath := filepath.Join(dst, relPath)

		if info.IsDir() {
			// Create directory
			return os.MkdirAll(dstPath, info.Mode())
		} else {
			// Copy file
			return s.copySingleFile(path, dstPath)
		}
	})
}

// CopyFileFromExternal copies a file or directory from an external path into the project
func (s *FileService) CopyFileFromExternal(projectID string, externalPath string, destinationPath string) error {
	// Get project
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return err
	}

	// Validate external path exists
	if !utils.FileExists(externalPath) {
		return models.NewAppError(
			models.ErrFileNotFound,
			fmt.Sprintf("Source file not found: %s", externalPath),
		)
	}

	// Resolve destination path within project
	dstResolvedPath, err := s.resolvePath(project.Path, destinationPath)
	if err != nil {
		return err
	}

	// Check if destination already exists
	if utils.FileExists(dstResolvedPath) {
		return models.NewAppError(
			models.ErrFileAccessDenied,
			fmt.Sprintf("Destination already exists: %s", destinationPath),
		)
	}

	// Copy file or directory
	if utils.IsDir(externalPath) {
		return s.copyDirectory(externalPath, dstResolvedPath)
	} else {
		return s.copySingleFile(externalPath, dstResolvedPath)
	}
}

