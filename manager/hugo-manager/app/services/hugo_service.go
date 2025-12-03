package services

import (
	"bytes"
	"fmt"
	"os/exec"
	"regexp"
	"strings"
)

// HugoService handles Hugo CLI operations
type HugoService struct {
	hugoPath string
}

// NewHugoService creates a new HugoService instance
func NewHugoService() *HugoService {
	return &HugoService{
		hugoPath: "hugo", // Default to "hugo" in PATH
	}
}

// GetVersion returns the Hugo version
func (s *HugoService) GetVersion() (string, error) {
	cmd := exec.Command(s.hugoPath, "version")
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		return "", fmt.Errorf("failed to execute hugo version: %w", err)
	}

	output := stdout.String()
	if output == "" {
		output = stderr.String()
	}

	// Parse version from output
	// Hugo version output format: "hugo v0.120.0+extended darwin/arm64 BuildDate=..."
	versionRegex := regexp.MustCompile(`hugo\s+v?([\d.]+(?:\+[a-zA-Z]+)?)`)
	matches := versionRegex.FindStringSubmatch(output)
	if len(matches) > 1 {
		return matches[1], nil
	}

	// Fallback: return raw output
	return strings.TrimSpace(output), nil
}

// IsInstalled checks if Hugo is installed
func (s *HugoService) IsInstalled() bool {
	_, err := s.GetVersion()
	return err == nil
}

// ExecuteCommand executes a Hugo command
func (s *HugoService) ExecuteCommand(projectPath string, command string, args []string) (string, error) {
	cmdArgs := append([]string{command}, args...)
	cmd := exec.Command(s.hugoPath, cmdArgs...)
	cmd.Dir = projectPath

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		return "", fmt.Errorf("hugo error: %s", stderr.String())
	}

	return stdout.String(), nil
}

// Build executes a Hugo build command
func (s *HugoService) Build(projectPath string, options BuildOptions) (string, error) {
	args := []string{}

	if options.Environment != "" {
		args = append(args, "--environment", options.Environment)
	}

	if options.Draft {
		args = append(args, "--buildDrafts")
	}

	if options.Future {
		args = append(args, "--buildFuture")
	}

	if options.Expired {
		args = append(args, "--buildExpired")
	}

	return s.ExecuteCommand(projectPath, "build", args)
}

// BuildOptions represents options for building
type BuildOptions struct {
	Environment string `json:"environment"`
	Draft       bool   `json:"draft"`
	Future      bool   `json:"future"`
	Expired     bool   `json:"expired"`
}

// CreateNewSite creates a new Hugo site at the specified path
func (s *HugoService) CreateNewSite(path, name string) error {
	// Check if Hugo is installed
	if !s.IsInstalled() {
		return fmt.Errorf("Hugo is not installed. Please install Hugo to create a new site")
	}

	// Execute: hugo new site <name>
	cmd := exec.Command(s.hugoPath, "new", "site", name)
	cmd.Dir = path

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("failed to create Hugo site: %s", stderr.String())
	}

	return nil
}

