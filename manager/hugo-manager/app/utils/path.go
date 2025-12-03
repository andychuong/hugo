package utils

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
)

// ValidatePath ensures a path is within the base directory (prevents directory traversal)
func ValidatePath(basePath, userPath string) (string, error) {
	// Resolve absolute paths
	absBase, err := filepath.Abs(basePath)
	if err != nil {
		return "", err
	}

	absPath, err := filepath.Abs(filepath.Join(basePath, userPath))
	if err != nil {
		return "", err
	}

	// Clean the path to remove any ".." components
	absPath = filepath.Clean(absPath)

	// Ensure path is within base directory
	if !strings.HasPrefix(absPath, absBase) {
		return "", errors.New("path traversal detected: path outside base directory")
	}

	return absPath, nil
}

// IsHugoProject checks if a directory is a Hugo project
func IsHugoProject(path string) bool {
	// Check for common Hugo config files
	configFiles := []string{
		"hugo.toml",
		"hugo.yaml",
		"hugo.json",
		"config.toml",
		"config.yaml",
		"config.json",
	}

	for _, configFile := range configFiles {
		if _, err := os.Stat(filepath.Join(path, configFile)); err == nil {
			return true
		}
	}

	return false
}

// GetConfigDir returns the platform-specific config directory
func GetConfigDir() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}

	var configDir string
	// Use runtime.GOOS for proper OS detection
	switch runtime.GOOS {
	case "windows":
		appData := os.Getenv("APPDATA")
		if appData == "" {
			appData = filepath.Join(homeDir, "AppData", "Roaming")
		}
		configDir = filepath.Join(appData, "HugoManager")
	case "darwin":
		configDir = filepath.Join(homeDir, "Library", "Application Support", "HugoManager")
	default: // Linux and others
		configDir = filepath.Join(homeDir, ".config", "hugo-manager")
	}

	// Create directory if it doesn't exist
	if err := os.MkdirAll(configDir, 0755); err != nil {
		return "", err
	}

	return configDir, nil
}

