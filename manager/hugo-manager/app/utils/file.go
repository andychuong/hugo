package utils

import (
	"os"
	"path/filepath"
	"time"
)

// FileExists checks if a file exists
func FileExists(path string) bool {
	_, err := os.Stat(path)
	return !os.IsNotExist(err)
}

// IsDir checks if a path is a directory
func IsDir(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return info.IsDir()
}

// GetFileExtension returns the file extension (without the dot)
func GetFileExtension(filename string) string {
	ext := filepath.Ext(filename)
	if len(ext) > 0 {
		return ext[1:] // Remove the dot
	}
	return ""
}

// GetFileInfo returns basic file information
type FileInfo struct {
	Name      string
	Path      string
	IsDir     bool
	Size      int64
	ModTime   time.Time
	Extension string
}

// GetFileInfo returns file information for a given path
func GetFileInfo(path string) (*FileInfo, error) {
	info, err := os.Stat(path)
	if err != nil {
		return nil, err
	}

	return &FileInfo{
		Name:      info.Name(),
		Path:      path,
		IsDir:     info.IsDir(),
		Size:      info.Size(),
		ModTime:   info.ModTime(),
		Extension: GetFileExtension(info.Name()),
	}, nil
}

