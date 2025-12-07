package utils

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

// GitConfig represents git configuration
type GitConfig struct {
	UserName        string `json:"userName"`
	UserEmail       string `json:"userEmail"`
	RemoteURL       string `json:"remoteUrl"`
	CredentialHelper string `json:"credentialHelper"`
	IsGitRepo       bool   `json:"isGitRepo"`
}

// GitStatus represents the status of a git repository
type GitStatus struct {
	ModifiedFiles  []string `json:"modifiedFiles"`
	StagedFiles    []string `json:"stagedFiles"`
	UntrackedFiles []string `json:"untrackedFiles"`
	CurrentBranch  string   `json:"currentBranch"`
	HasChanges     bool     `json:"hasChanges"`
	IsClean        bool     `json:"isClean"`
	CommitsAhead   int      `json:"commitsAhead"`
	CommitsBehind  int      `json:"commitsBehind"`
}

// ExecuteGitCommand executes a git command with proper environment setup
func ExecuteGitCommand(dir string, args ...string) ([]byte, error) {
	cmd := exec.Command("git", args...)
	cmd.Dir = dir

	// Inherit all environment variables (including PATH, SSH_AUTH_SOCK, etc.)
	cmd.Env = os.Environ()

	// Ensure HOME is set (important for credential helpers)
	if home := os.Getenv("HOME"); home == "" {
		if userHome, err := os.UserHomeDir(); err == nil {
			cmd.Env = append(cmd.Env, "HOME="+userHome)
		}
	}

	// Ensure SSH_AUTH_SOCK is inherited (for SSH key authentication)
	if sshAuthSock := os.Getenv("SSH_AUTH_SOCK"); sshAuthSock != "" {
		// Already in os.Environ(), but being explicit
		_ = sshAuthSock
	}

	return cmd.CombinedOutput()
}

// IsGitRepository checks if a directory is a git repository
func IsGitRepository(path string) bool {
	gitPath := filepath.Join(path, ".git")
	info, err := os.Stat(gitPath)
	return err == nil && info.IsDir()
}

// GetGitConfig retrieves git configuration for a repository
func GetGitConfig(repoPath string) (*GitConfig, error) {
	config := &GitConfig{
		IsGitRepo: IsGitRepository(repoPath),
	}

	if !config.IsGitRepo {
		return config, nil
	}

	// Get user.name
	output, err := ExecuteGitCommand(repoPath, "config", "user.name")
	if err == nil {
		config.UserName = strings.TrimSpace(string(output))
	}

	// Get user.email
	output, err = ExecuteGitCommand(repoPath, "config", "user.email")
	if err == nil {
		config.UserEmail = strings.TrimSpace(string(output))
	}

	// Get remote URL
	output, err = ExecuteGitCommand(repoPath, "remote", "get-url", "origin")
	if err == nil {
		config.RemoteURL = strings.TrimSpace(string(output))
	}

	// Get global credential helper
	output, err = ExecuteGitCommand(repoPath, "config", "--global", "credential.helper")
	if err == nil {
		config.CredentialHelper = strings.TrimSpace(string(output))
	}

	return config, nil
}

// GetGitStatus retrieves the git status for a repository
func GetGitStatus(repoPath string) (*GitStatus, error) {
	if !IsGitRepository(repoPath) {
		return &GitStatus{
			IsClean: true,
		}, nil
	}

	status := &GitStatus{
		ModifiedFiles:  []string{},
		StagedFiles:    []string{},
		UntrackedFiles: []string{},
	}

	// Get current branch
	output, err := ExecuteGitCommand(repoPath, "branch", "--show-current")
	if err == nil {
		status.CurrentBranch = strings.TrimSpace(string(output))
	}

	// Get commits ahead/behind remote
	if status.CurrentBranch != "" {
		// First, fetch remote refs quietly (don't fail if no remote)
		ExecuteGitCommand(repoPath, "fetch", "--quiet")
		
		// Get ahead/behind count
		output, err = ExecuteGitCommand(repoPath, "rev-list", "--left-right", "--count", status.CurrentBranch+"...origin/"+status.CurrentBranch)
		if err == nil {
			parts := strings.Fields(strings.TrimSpace(string(output)))
			if len(parts) == 2 {
				ahead, _ := strconv.Atoi(parts[0])
				behind, _ := strconv.Atoi(parts[1])
				status.CommitsAhead = ahead
				status.CommitsBehind = behind
			}
		}
	}

	// Get status in short format
	output, err = ExecuteGitCommand(repoPath, "status", "--porcelain")
	if err != nil {
		return nil, fmt.Errorf("failed to get git status: %w", err)
	}

	// Don't trim the output! Git status lines start with status codes that might be spaces
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if line == "" {
			continue
		}

		// Parse git status line format: XY filename
		// X = staged status (index), Y = unstaged status (working tree)
		// Format: "XY filename" where X and Y are status codes
		if len(line) < 3 {
			continue
		}

		stagedStatus := line[0]    // Index status
		unstagedStatus := line[1]  // Working tree status
		filename := strings.TrimSpace(line[2:]) // Start from position 2, not 3
		
		// Debug logging
		fmt.Printf("[GitStatus] Line: %q | Staged: %q | Unstaged: %q | File: %q\n", 
			line, string(stagedStatus), string(unstagedStatus), filename)

		// Handle untracked files first (both X and Y are '?')
		if stagedStatus == '?' && unstagedStatus == '?' {
			status.UntrackedFiles = append(status.UntrackedFiles, filename)
			status.HasChanges = true
			continue
		}

		// Handle staged files (X is not space or ?)
		if stagedStatus != ' ' && stagedStatus != '?' {
			status.StagedFiles = append(status.StagedFiles, filename)
			status.HasChanges = true
		}

		// Handle modified files (Y is not space or ?)
		// Only add to modified if not already in staged
		if unstagedStatus != ' ' && unstagedStatus != '?' {
			// Check if not already in staged files
			isStaged := false
			for _, staged := range status.StagedFiles {
				if staged == filename {
					isStaged = true
					break
				}
			}
			if !isStaged {
				status.ModifiedFiles = append(status.ModifiedFiles, filename)
				status.HasChanges = true
			}
		}
	}

	status.IsClean = !status.HasChanges
	return status, nil
}

// GetRemoteURL gets the remote URL for a repository
func GetRemoteURL(repoPath string, remote string) (string, error) {
	if remote == "" {
		remote = "origin"
	}

	output, err := ExecuteGitCommand(repoPath, "remote", "get-url", remote)
	if err != nil {
		return "", fmt.Errorf("failed to get remote URL: %w", err)
	}

	return strings.TrimSpace(string(output)), nil
}

// DetectAuthMethod detects whether a repository uses SSH or HTTPS authentication
func DetectAuthMethod(remoteURL string) string {
	if strings.HasPrefix(remoteURL, "git@") || strings.Contains(remoteURL, "ssh://") {
		return "ssh"
	}
	return "https"
}

// CheckGitCredentials checks if git credentials are configured
// This is a basic check - actual authentication happens during git operations
func CheckGitCredentials(repoPath string) (bool, error) {
	if !IsGitRepository(repoPath) {
		return false, nil
	}

	// Try to get remote URL
	remoteURL, err := GetRemoteURL(repoPath, "origin")
	if err != nil {
		return false, nil // No remote configured
	}

	// Check if we can access the remote (this will trigger credential check)
	// Use a lightweight command that doesn't require authentication
	_, err = ExecuteGitCommand(repoPath, "ls-remote", "--heads", remoteURL, "HEAD")
	return err == nil, nil
}

// GetBranches gets list of branches (local and remote)
func GetBranches(repoPath string) ([]string, []string, error) {
	if !IsGitRepository(repoPath) {
		return []string{}, []string{}, nil
	}

	var localBranches []string
	var remoteBranches []string

	// Get local branches
	output, err := ExecuteGitCommand(repoPath, "branch", "--format", "%(refname:short)")
	if err == nil {
		lines := strings.Split(strings.TrimSpace(string(output)), "\n")
		for _, line := range lines {
			if line != "" {
				localBranches = append(localBranches, line)
			}
		}
	}

	// Get remote branches
	output, err = ExecuteGitCommand(repoPath, "branch", "-r", "--format", "%(refname:short)")
	if err == nil {
		lines := strings.Split(strings.TrimSpace(string(output)), "\n")
		for _, line := range lines {
			if line != "" && !strings.Contains(line, "HEAD") {
				remoteBranches = append(remoteBranches, line)
			}
		}
	}

	return localBranches, remoteBranches, nil
}

// GetCurrentBranch gets the current branch name
func GetCurrentBranch(repoPath string) (string, error) {
	if !IsGitRepository(repoPath) {
		return "", fmt.Errorf("not a git repository")
	}

	output, err := ExecuteGitCommand(repoPath, "branch", "--show-current")
	if err != nil {
		return "", fmt.Errorf("failed to get current branch: %w", err)
	}

	return strings.TrimSpace(string(output)), nil
}

// GitCommit represents a git commit
type GitCommit struct {
	Hash      string `json:"hash"`
	ShortHash string `json:"shortHash"`
	Author    string `json:"author"`
	Email     string `json:"email"`
	Date      string `json:"date"`
	Message   string `json:"message"`
	Branch    string `json:"branch"`
}

// GetCommitHistory retrieves commit history for a repository
func GetCommitHistory(repoPath string, limit int) ([]GitCommit, error) {
	if !IsGitRepository(repoPath) {
		return []GitCommit{}, nil
	}

	if limit <= 0 {
		limit = 20 // Default to 20 commits
	}

	// Format: hash|short_hash|author|email|date|message
	format := "%H|%h|%an|%ae|%aI|%s"
	limitStr := strconv.Itoa(limit)
	
	output, err := ExecuteGitCommand(repoPath, "log", "--format="+format, "-n", limitStr)
	if err != nil {
		return nil, fmt.Errorf("failed to get commit history: %w", err)
	}

	var commits []GitCommit
	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	
	for _, line := range lines {
		if line == "" {
			continue
		}

		parts := strings.SplitN(line, "|", 6)
		if len(parts) != 6 {
			continue
		}

		commit := GitCommit{
			Hash:      parts[0],
			ShortHash: parts[1],
			Author:    parts[2],
			Email:     parts[3],
			Date:      parts[4],
			Message:   parts[5],
		}

		commits = append(commits, commit)
	}

	return commits, nil
}

