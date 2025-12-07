package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"hugo-manager/app/models"
	"hugo-manager/app/utils"
)

// GitHubService handles GitHub API operations and git integration
type GitHubService struct {
	githubToken string
	httpClient  *http.Client
	mu          sync.RWMutex
}

// NewGitHubService creates a new GitHub service
func NewGitHubService() *GitHubService {
	return &GitHubService{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// SetGitHubToken sets the GitHub token for API authentication
func (s *GitHubService) SetGitHubToken(token string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.githubToken = token
}

// getGitHubToken retrieves GitHub token from service or environment
func (s *GitHubService) getGitHubToken() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if s.githubToken != "" {
		return s.githubToken
	}
	return os.Getenv("GITHUB_TOKEN")
}

// makeGitHubRequest makes an authenticated request to GitHub API
func (s *GitHubService) makeGitHubRequest(ctx context.Context, method, url string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "HugoManager/1.0")

	if token := s.getGitHubToken(); token != "" {
		req.Header.Set("Authorization", "token "+token)
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}

	// Handle rate limiting
	if resp.StatusCode == 403 {
		rateLimitRemaining := resp.Header.Get("X-RateLimit-Remaining")
		if rateLimitRemaining == "0" {
			resp.Body.Close()
			return nil, fmt.Errorf("GitHub API rate limit exceeded. Set GITHUB_TOKEN for higher limits")
		}
	}

	return resp, nil
}

// GetGitHubUser gets the authenticated GitHub user
func (s *GitHubService) GetGitHubUser(ctx context.Context) (*models.GitHubUser, error) {
	url := "https://api.github.com/user"
	resp, err := s.makeGitHubRequest(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API returned status %d", resp.StatusCode)
	}

	var user struct {
		Login     string `json:"login"`
		Name      string `json:"name"`
		Email     string `json:"email"`
		AvatarURL string `json:"avatar_url"`
		Bio       string `json:"bio"`
		Company   string `json:"company"`
		Location  string `json:"location"`
		Blog      string `json:"blog"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &models.GitHubUser{
		Login:     user.Login,
		Name:      user.Name,
		Email:     user.Email,
		AvatarURL: user.AvatarURL,
		Bio:       user.Bio,
		Company:   user.Company,
		Location:  user.Location,
		Blog:      user.Blog,
	}, nil
}

// GetUserRepositories gets repositories for the authenticated user
func (s *GitHubService) GetUserRepositories(ctx context.Context) ([]*models.GitHubRepository, error) {
	url := "https://api.github.com/user/repos?per_page=100&sort=updated"
	resp, err := s.makeGitHubRequest(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API returned status %d", resp.StatusCode)
	}

	var repos []struct {
		ID            int64     `json:"id"`
		Name          string    `json:"name"`
		FullName      string    `json:"full_name"`
		Description   string    `json:"description"`
		HTMLURL       string    `json:"html_url"`
		CloneURL      string    `json:"clone_url"`
		SSHURL        string    `json:"ssh_url"`
		DefaultBranch string    `json:"default_branch"`
		Private       bool      `json:"private"`
		Fork          bool      `json:"fork"`
		Stars         int       `json:"stargazers_count"`
		Forks         int       `json:"forks_count"`
		Language      string    `json:"language"`
		Topics        []string  `json:"topics"`
		CreatedAt     time.Time `json:"created_at"`
		UpdatedAt     time.Time `json:"updated_at"`
		PushedAt      time.Time `json:"pushed_at"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&repos); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	result := make([]*models.GitHubRepository, 0, len(repos))
	for _, repo := range repos {
		result = append(result, &models.GitHubRepository{
			ID:            repo.ID,
			Name:          repo.Name,
			FullName:      repo.FullName,
			Description:   repo.Description,
			URL:           repo.HTMLURL,
			CloneURL:      repo.CloneURL,
			SSHURL:        repo.SSHURL,
			DefaultBranch: repo.DefaultBranch,
			IsPrivate:     repo.Private,
			IsFork:        repo.Fork,
			Stars:         repo.Stars,
			Forks:         repo.Forks,
			Language:      repo.Language,
			Topics:        repo.Topics,
			CreatedAt:     repo.CreatedAt,
			UpdatedAt:     repo.UpdatedAt,
			PushedAt:      repo.PushedAt,
		})
	}

	return result, nil
}

// SearchRepositories searches GitHub repositories
func (s *GitHubService) SearchRepositories(ctx context.Context, query string, limit int) ([]*models.GitHubRepository, error) {
	if limit <= 0 {
		limit = 30
	}
	if limit > 100 {
		limit = 100
	}

	url := fmt.Sprintf("https://api.github.com/search/repositories?q=%s&sort=stars&order=desc&per_page=%d", query, limit)
	resp, err := s.makeGitHubRequest(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API returned status %d", resp.StatusCode)
	}

	var searchResult struct {
		Items []struct {
			ID            int64     `json:"id"`
			Name          string    `json:"name"`
			FullName      string    `json:"full_name"`
			Description   string    `json:"description"`
			HTMLURL       string    `json:"html_url"`
			CloneURL      string    `json:"clone_url"`
			SSHURL        string    `json:"ssh_url"`
			DefaultBranch string    `json:"default_branch"`
			Private       bool      `json:"private"`
			Fork          bool      `json:"fork"`
			Stars         int       `json:"stargazers_count"`
			Forks         int       `json:"forks_count"`
			Language      string    `json:"language"`
			Topics        []string  `json:"topics"`
			CreatedAt     time.Time `json:"created_at"`
			UpdatedAt     time.Time `json:"updated_at"`
			PushedAt      time.Time `json:"pushed_at"`
		} `json:"items"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&searchResult); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	result := make([]*models.GitHubRepository, 0, len(searchResult.Items))
	for _, repo := range searchResult.Items {
		result = append(result, &models.GitHubRepository{
			ID:            repo.ID,
			Name:          repo.Name,
			FullName:      repo.FullName,
			Description:   repo.Description,
			URL:           repo.HTMLURL,
			CloneURL:      repo.CloneURL,
			SSHURL:        repo.SSHURL,
			DefaultBranch: repo.DefaultBranch,
			IsPrivate:     repo.Private,
			IsFork:        repo.Fork,
			Stars:         repo.Stars,
			Forks:         repo.Forks,
			Language:      repo.Language,
			Topics:        repo.Topics,
			CreatedAt:     repo.CreatedAt,
			UpdatedAt:     repo.UpdatedAt,
			PushedAt:      repo.PushedAt,
		})
	}

	return result, nil
}

// CheckIfHugoProject checks if a GitHub repository is a Hugo project
func (s *GitHubService) CheckIfHugoProject(ctx context.Context, owner, repo string) (*models.HugoProjectInfo, error) {
	info := &models.HugoProjectInfo{
		IsHugoProject: false,
		Confidence:   0,
		ConfigFiles:   []string{},
		Reasons:       []string{},
	}

	// Hugo config files to check
	configFiles := []string{
		"hugo.toml",
		"hugo.yaml",
		"hugo.json",
		"config.toml",
		"config.yaml",
		"config.json",
	}

	// Check for config files
	for _, configFile := range configFiles {
		url := fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/%s", owner, repo, configFile)
		resp, err := s.makeGitHubRequest(ctx, "GET", url, nil)
		if err != nil {
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusOK {
			info.ConfigFiles = append(info.ConfigFiles, configFile)
			info.Confidence += 50
			info.Reasons = append(info.Reasons, fmt.Sprintf("Found config file: %s", configFile))
		}
	}

	// Check for Hugo directory structure
	dirsToCheck := []struct {
		name  string
		score int
	}{
		{"content", 10},
		{"themes", 10},
		{"archetypes", 10},
		{"layouts", 10},
		{"static", 5},
		{"public", 5},
	}

	for _, dir := range dirsToCheck {
		url := fmt.Sprintf("https://api.github.com/repos/%s/%s/contents/%s", owner, repo, dir.name)
		resp, err := s.makeGitHubRequest(ctx, "GET", url, nil)
		if err != nil {
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusOK {
			info.Confidence += dir.score
			switch dir.name {
			case "content":
				info.HasContentDir = true
			case "themes":
				info.HasThemesDir = true
			case "archetypes":
				info.HasArchetypes = true
			case "layouts":
				info.HasLayouts = true
			}
			info.Reasons = append(info.Reasons, fmt.Sprintf("Found %s/ directory", dir.name))
		}
	}

	// Check repository topics
	repoURL := fmt.Sprintf("https://api.github.com/repos/%s/%s", owner, repo)
	resp, err := s.makeGitHubRequest(ctx, "GET", repoURL, nil)
	if err == nil {
		defer resp.Body.Close()
		if resp.StatusCode == http.StatusOK {
			var repoData struct {
				Description string   `json:"description"`
				Topics      []string `json:"topics"`
			}
			if err := json.NewDecoder(resp.Body).Decode(&repoData); err == nil {
				// Check topics
				for _, topic := range repoData.Topics {
					if strings.Contains(strings.ToLower(topic), "hugo") {
						info.Confidence += 5
						info.Reasons = append(info.Reasons, fmt.Sprintf("Repository topic: %s", topic))
					}
				}

				// Check description
				descLower := strings.ToLower(repoData.Description)
				if strings.Contains(descLower, "hugo") {
					info.Confidence += 5
					info.Reasons = append(info.Reasons, "Description mentions Hugo")
				}
			}
		}
	}

	// Determine if it's a Hugo project
	info.IsHugoProject = info.Confidence >= 50

	return info, nil
}

// SearchHugoProjects searches for Hugo projects on GitHub
func (s *GitHubService) SearchHugoProjects(ctx context.Context, query string, limit int) ([]*models.GitHubRepository, error) {
	// Search for repositories with "hugo" in the query
	searchQuery := fmt.Sprintf("%s+hugo+in:name,description,topic", query)
	if query == "" {
		searchQuery = "hugo+in:name,description,topic"
	}

	repos, err := s.SearchRepositories(ctx, searchQuery, limit)
	if err != nil {
		return nil, err
	}

	// Check each repository to see if it's actually a Hugo project
	hugoRepos := make([]*models.GitHubRepository, 0)
	for _, repo := range repos {
		parts := strings.Split(repo.FullName, "/")
		if len(parts) != 2 {
			continue
		}

		info, err := s.CheckIfHugoProject(ctx, parts[0], parts[1])
		if err != nil {
			continue // Skip if we can't check
		}

		if info.IsHugoProject || info.Confidence >= 30 {
			repo.IsHugoProject = true
			repo.HugoInfo = info
			hugoRepos = append(hugoRepos, repo)
		}
	}

	return hugoRepos, nil
}

// CloneRepository clones a GitHub repository to a local directory
func (s *GitHubService) CloneRepository(repoURL, targetDir string) error {
	// Check if git is installed
	if _, err := exec.LookPath("git"); err != nil {
		return fmt.Errorf("git is not installed")
	}

	// Clone the repository
	cmd := exec.Command("git", "clone", repoURL, targetDir)
	cmd.Env = os.Environ() // Inherit environment for credentials

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("git clone failed: %v\nOutput: %s", err, string(output))
	}

	return nil
}

// GetGitStatus gets git status for a project
func (s *GitHubService) GetGitStatus(projectPath string) (*utils.GitStatus, error) {
	return utils.GetGitStatus(projectPath)
}

// GetGitConfig gets git configuration for a project
func (s *GitHubService) GetGitConfig(projectPath string) (*utils.GitConfig, error) {
	return utils.GetGitConfig(projectPath)
}

// StageFiles stages files for commit
func (s *GitHubService) StageFiles(projectPath string, files []string) error {
	fmt.Printf("[GitHubService] StageFiles called: path=%s, files=%v\n", projectPath, files)
	
	if !utils.IsGitRepository(projectPath) {
		return fmt.Errorf("not a git repository")
	}

	args := append([]string{"add"}, files...)
	fmt.Printf("[GitHubService] Executing: git %v\n", args)
	output, err := utils.ExecuteGitCommand(projectPath, args...)
	if err != nil {
		fmt.Printf("[GitHubService] Stage failed: %v\nOutput: %s\n", err, string(output))
		return fmt.Errorf("git add failed: %v\nOutput: %s", err, string(output))
	}

	fmt.Printf("[GitHubService] Stage successful. Output: %s\n", string(output))
	return nil
}

// CommitChanges commits staged changes
func (s *GitHubService) CommitChanges(projectPath string, message string) error {
	if !utils.IsGitRepository(projectPath) {
		return fmt.Errorf("not a git repository")
	}

	output, err := utils.ExecuteGitCommand(projectPath, "commit", "-m", message)
	if err != nil {
		return fmt.Errorf("git commit failed: %v\nOutput: %s", err, string(output))
	}

	return nil
}

// PushToGitHub pushes changes to GitHub
func (s *GitHubService) PushToGitHub(projectPath string, remote string, branch string) error {
	fmt.Printf("[GitHubService] PushToGitHub called: path=%s, remote=%s, branch=%s\n", projectPath, remote, branch)
	
	if !utils.IsGitRepository(projectPath) {
		return fmt.Errorf("not a git repository")
	}

	if remote == "" {
		remote = "origin"
	}
	if branch == "" {
		currentBranch, err := utils.GetCurrentBranch(projectPath)
		if err != nil {
			return fmt.Errorf("failed to get current branch: %w", err)
		}
		branch = currentBranch
	}

	fmt.Printf("[GitHubService] Executing: git push %s %s\n", remote, branch)
	output, err := utils.ExecuteGitCommand(projectPath, "push", remote, branch)
	
	if err != nil {
		outputStr := string(output)
		fmt.Printf("[GitHubService] Push failed: %v\nOutput: %s\n", err, outputStr)
		
		if strings.Contains(outputStr, "authentication") ||
			strings.Contains(outputStr, "Permission denied") ||
			strings.Contains(outputStr, "fatal: could not read Username") {
			return fmt.Errorf("git authentication failed. Please configure git credentials:\n" +
				"  - For HTTPS: git config --global credential.helper osxkeychain (macOS) or wincred (Windows)\n" +
				"  - For SSH: ensure SSH keys are added to ssh-agent\n" +
				"  - Or set GITHUB_TOKEN environment variable")
		}
		return fmt.Errorf("git push failed: %v\nOutput: %s", err, outputStr)
	}

	fmt.Printf("[GitHubService] Push successful. Output: %s\n", string(output))
	return nil
}

// PullFromGitHub pulls changes from GitHub
func (s *GitHubService) PullFromGitHub(projectPath string, remote string, branch string) error {
	if !utils.IsGitRepository(projectPath) {
		return fmt.Errorf("not a git repository")
	}

	if remote == "" {
		remote = "origin"
	}
	if branch == "" {
		currentBranch, err := utils.GetCurrentBranch(projectPath)
		if err != nil {
			return fmt.Errorf("failed to get current branch: %w", err)
		}
		branch = currentBranch
	}

	output, err := utils.ExecuteGitCommand(projectPath, "pull", remote, branch)
	if err != nil {
		return fmt.Errorf("git pull failed: %v\nOutput: %s", err, string(output))
	}

	return nil
}

// GetBranches gets list of branches
// GetCommitHistory retrieves commit history for a repository
func (s *GitHubService) GetCommitHistory(projectPath string, limit int) ([]*models.GitCommit, error) {
	if !utils.IsGitRepository(projectPath) {
		return []*models.GitCommit{}, nil
	}

	commits, err := utils.GetCommitHistory(projectPath, limit)
	if err != nil {
		return nil, err
	}

	// Convert to models
	result := make([]*models.GitCommit, len(commits))
	for i, commit := range commits {
		// Parse the date string (ISO 8601 format from git)
		date, err := time.Parse(time.RFC3339, commit.Date)
		if err != nil {
			// If parsing fails, use current time
			date = time.Now()
		}
		
		result[i] = &models.GitCommit{
			Hash:      commit.Hash,
			ShortHash: commit.ShortHash,
			Author:    commit.Author,
			Email:     commit.Email,
			Date:      date,
			Message:   commit.Message,
			Branch:    commit.Branch,
		}
	}

	return result, nil
}

func (s *GitHubService) GetBranches(projectPath string) ([]*models.GitBranch, error) {
	if !utils.IsGitRepository(projectPath) {
		return []*models.GitBranch{}, nil
	}

	localBranches, remoteBranches, err := utils.GetBranches(projectPath)
	if err != nil {
		return nil, err
	}

	currentBranch, _ := utils.GetCurrentBranch(projectPath)

	branches := make([]*models.GitBranch, 0)
	for _, name := range localBranches {
		branches = append(branches, &models.GitBranch{
			Name:      name,
			IsRemote:  false,
			IsCurrent: name == currentBranch,
		})
	}

	for _, name := range remoteBranches {
		// Remove "origin/" prefix
		branchName := strings.TrimPrefix(name, "origin/")
		branches = append(branches, &models.GitBranch{
			Name:      branchName,
			IsRemote:  true,
			IsCurrent: false,
		})
	}

	return branches, nil
}

// InitializeGitRepository initializes a git repository in a project
func (s *GitHubService) InitializeGitRepository(projectPath string) error {
	if utils.IsGitRepository(projectPath) {
		return fmt.Errorf("already a git repository")
	}

	output, err := utils.ExecuteGitCommand(projectPath, "init")
	if err != nil {
		return fmt.Errorf("git init failed: %v\nOutput: %s", err, string(output))
	}

	return nil
}

// LinkProjectToGitHub links a project to a GitHub repository
func (s *GitHubService) LinkProjectToGitHub(projectPath string, repoURL string) error {
	if !utils.IsGitRepository(projectPath) {
		// Initialize git if not already a repo
		if err := s.InitializeGitRepository(projectPath); err != nil {
			return fmt.Errorf("failed to initialize git repository: %w", err)
		}
	}

	// Check if remote already exists
	existingRemote, err := utils.GetRemoteURL(projectPath, "origin")
	if err == nil && existingRemote != "" {
		// Update existing remote
		output, err := utils.ExecuteGitCommand(projectPath, "remote", "set-url", "origin", repoURL)
		if err != nil {
			return fmt.Errorf("failed to update remote: %v\nOutput: %s", err, string(output))
		}
	} else {
		// Add new remote
		output, err := utils.ExecuteGitCommand(projectPath, "remote", "add", "origin", repoURL)
		if err != nil {
			return fmt.Errorf("failed to add remote: %v\nOutput: %s", err, string(output))
		}
	}

	return nil
}

// CreateGitHubRepository creates a new GitHub repository (requires GitHub API)
func (s *GitHubService) CreateGitHubRepository(ctx context.Context, name string, description string, isPrivate bool) (*models.GitHubRepository, error) {
	if s.getGitHubToken() == "" {
		return nil, fmt.Errorf("GitHub token is required to create repositories")
	}

	url := "https://api.github.com/user/repos"
	
	repoData := map[string]interface{}{
		"name":        name,
		"description": description,
		"private":     isPrivate,
		"auto_init":   false,
	}

	jsonData, err := json.Marshal(repoData)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := s.makeGitHubRequest(ctx, "POST", url, strings.NewReader(string(jsonData)))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub API returned status %d: %s", resp.StatusCode, string(body))
	}

	var repo struct {
		ID            int64     `json:"id"`
		Name          string    `json:"name"`
		FullName      string    `json:"full_name"`
		Description   string    `json:"description"`
		HTMLURL       string    `json:"html_url"`
		CloneURL      string    `json:"clone_url"`
		SSHURL        string    `json:"ssh_url"`
		DefaultBranch string    `json:"default_branch"`
		Private       bool      `json:"private"`
		Fork          bool      `json:"fork"`
		Stars         int       `json:"stargazers_count"`
		Forks         int       `json:"forks_count"`
		Language      string    `json:"language"`
		Topics        []string  `json:"topics"`
		CreatedAt     time.Time `json:"created_at"`
		UpdatedAt     time.Time `json:"updated_at"`
		PushedAt      time.Time `json:"pushed_at"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&repo); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &models.GitHubRepository{
		ID:            repo.ID,
		Name:          repo.Name,
		FullName:      repo.FullName,
		Description:   repo.Description,
		URL:           repo.HTMLURL,
		CloneURL:      repo.CloneURL,
		SSHURL:        repo.SSHURL,
		DefaultBranch: repo.DefaultBranch,
		IsPrivate:     repo.Private,
		IsFork:        repo.Fork,
		Stars:         repo.Stars,
		Forks:         repo.Forks,
		Language:      repo.Language,
		Topics:        repo.Topics,
		CreatedAt:     repo.CreatedAt,
		UpdatedAt:     repo.UpdatedAt,
		PushedAt:      repo.PushedAt,
	}, nil
}

