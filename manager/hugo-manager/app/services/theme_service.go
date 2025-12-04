package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"hugo-manager/app/models"
	"hugo-manager/app/utils"

	"github.com/google/uuid"
	"github.com/pelletier/go-toml/v2"
)

// ThemeService handles theme management operations
type ThemeService struct {
	projectService *ProjectService
	hugoService    *HugoService
	configService  *ConfigService
	indexCachePath string
	indexCache     []*models.Theme
	indexCacheTime time.Time
	githubToken    string // Optional GitHub token for API authentication
}

// NewThemeService creates a new theme service
func NewThemeService(projectService *ProjectService, hugoService *HugoService, configService *ConfigService) (*ThemeService, error) {
	configDir, err := utils.GetConfigDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get config directory: %w", err)
	}
	
	indexCachePath := filepath.Join(configDir, "theme-index.json")
	
	return &ThemeService{
		projectService: projectService,
		hugoService:    hugoService,
		configService:  configService,
		indexCachePath: indexCachePath,
		indexCache:     []*models.Theme{},
	}, nil
}

// SearchThemes searches for themes by query
func (s *ThemeService) SearchThemes(query string, filters map[string]interface{}) ([]*models.Theme, error) {
	themes, err := s.GetThemeIndex()
	if err != nil {
		return nil, err
	}
	
	var results []*models.Theme
	queryLower := strings.ToLower(query)
	
	for _, theme := range themes {
		// Filter by query
		if query != "" {
			matched := false
			if strings.Contains(strings.ToLower(theme.Name), queryLower) {
				matched = true
			}
			if strings.Contains(strings.ToLower(theme.Description), queryLower) {
				matched = true
			}
			for _, tag := range theme.Tags {
				if strings.Contains(strings.ToLower(tag), queryLower) {
					matched = true
					break
				}
			}
			if !matched {
				continue
			}
		}
		
		// Apply filters
		if minVersion, ok := filters["minVersion"].(string); ok && minVersion != "" {
			// Version comparison would go here
		}
		
		if tags, ok := filters["tags"].([]string); ok && len(tags) > 0 {
			hasTag := false
			for _, filterTag := range tags {
				for _, themeTag := range theme.Tags {
					if strings.EqualFold(themeTag, filterTag) {
						hasTag = true
						break
					}
				}
				if hasTag {
					break
				}
			}
			if !hasTag {
				continue
			}
		}
		
		results = append(results, theme)
	}
	
	return results, nil
}

// GetThemeIndex gets the theme index (from cache or fetches)
func (s *ThemeService) GetThemeIndex() ([]*models.Theme, error) {
	// Check if cache is valid (24 hours)
	if len(s.indexCache) > 0 && time.Since(s.indexCacheTime) < 24*time.Hour {
		return s.indexCache, nil
	}
	
	// Try to load from disk
	if data, err := os.ReadFile(s.indexCachePath); err == nil {
		var themes []*models.Theme
		if err := json.Unmarshal(data, &themes); err == nil {
			s.indexCache = themes
			s.indexCacheTime = time.Now()
			return themes, nil
		}
	}
	
	// Cache is empty or invalid, return empty list
	// In production, this would fetch from hugoThemesSiteBuilder
	return []*models.Theme{}, nil
}

// UpdateThemeIndex updates the theme index cache
func (s *ThemeService) UpdateThemeIndex() error {
	// Fetch themes from themes.gohugo.io
	// Primary method: scrape themes.gohugo.io to get actual theme repositories
	// This is more reliable than hugoThemesSiteBuilder since themes are in separate repos
	
	var themes []*models.Theme
	var err error
	
	// Try website scraping first
	themes, err = s.fetchThemesFromWebsite()
	if err != nil {
		// Fallback: try GitHub API approach
		themes, err = s.fetchThemesFromGitHub()
		if err != nil {
			return fmt.Errorf("failed to fetch themes from both sources: website error: %v, github error: %v", err, err)
		}
	}
	
	if len(themes) == 0 {
		return fmt.Errorf("no themes were fetched - index update may have failed")
	}
	
	s.indexCache = themes
	s.indexCacheTime = time.Now()
	
	// Save to disk
	data, err := json.MarshalIndent(themes, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal theme index: %w", err)
	}
	
	if err := os.WriteFile(s.indexCachePath, data, 0644); err != nil {
		return fmt.Errorf("failed to save theme index: %w", err)
	}
	
	return nil
}

// SetGitHubToken sets a GitHub token for authenticated API requests
func (s *ThemeService) SetGitHubToken(token string) {
	s.githubToken = token
}

// getGitHubToken retrieves GitHub token from environment or service
func (s *ThemeService) getGitHubToken() string {
	if s.githubToken != "" {
		return s.githubToken
	}
	// Fallback to environment variable
	return os.Getenv("GITHUB_TOKEN")
}

// fetchThemesFromGitHub fetches themes from hugoThemesSiteBuilder repository
func (s *ThemeService) fetchThemesFromGitHub() ([]*models.Theme, error) {
	// Use GitHub API to get themes from hugoThemesSiteBuilder
	// Repository: https://github.com/gohugoio/hugoThemesSiteBuilder
	
	client := &http.Client{Timeout: 30 * time.Second}
	
	// Fetch the themes list from GitHub API
	// We'll use the GitHub API to get repository contents
	apiURL := "https://api.github.com/repos/gohugoio/hugoThemesSiteBuilder/contents/themes"
	
	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	// GitHub API allows requests without auth for public repos, but rate limits are lower
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	
	// Add authentication if token is available
	if token := s.getGitHubToken(); token != "" {
		req.Header.Set("Authorization", "token "+token)
	}
	
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch from GitHub: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GitHub API returned status %d", resp.StatusCode)
	}
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}
	
	var contents []struct {
		Name string `json:"name"`
		Type string `json:"type"`
		URL  string `json:"url"`
	}
	
	if err := json.Unmarshal(body, &contents); err != nil {
		return nil, fmt.Errorf("failed to parse GitHub response: %w", err)
	}
	
	var themes []*models.Theme
	for _, item := range contents {
		if item.Type == "dir" {
			// Fetch theme.toml for this theme
			theme, err := s.fetchThemeFromGitHub(item.Name)
			if err != nil {
				// Skip themes that fail to parse
				continue
			}
			themes = append(themes, theme)
		}
	}
	
	return themes, nil
}

// fetchThemeFromGitHub fetches a single theme's metadata from GitHub
func (s *ThemeService) fetchThemeFromGitHub(themeName string) (*models.Theme, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	
	// Fetch theme.toml from GitHub
	apiURL := fmt.Sprintf("https://raw.githubusercontent.com/gohugoio/hugoThemesSiteBuilder/main/themes/%s/theme.toml", themeName)
	
	resp, err := client.Get(apiURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("theme.toml not found for %s", themeName)
	}
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	
	// Parse theme.toml
	var themeData map[string]interface{}
	if err := toml.Unmarshal(body, &themeData); err != nil {
		return nil, fmt.Errorf("failed to parse theme.toml: %w", err)
	}
	
	theme := &models.Theme{
		ID:   uuid.New().String(),
		Name: themeName,
		Path: fmt.Sprintf("github.com/gohugoio/hugoThemesSiteBuilder/themes/%s", themeName),
	}
	
	// Extract metadata
	if name, ok := themeData["name"].(string); ok {
		theme.Name = name
	}
	if desc, ok := themeData["description"].(string); ok {
		theme.Description = desc
	}
	if tags, ok := themeData["tags"].([]interface{}); ok {
		for _, tag := range tags {
			if tagStr, ok := tag.(string); ok {
				theme.Tags = append(theme.Tags, tagStr)
			}
		}
	}
	if minVersion, ok := themeData["min_version"].(string); ok {
		theme.MinVersion = minVersion
	}
	if author, ok := themeData["author"].(map[string]interface{}); ok {
		if name, ok := author["name"].(string); ok {
			theme.Author = name
		}
	}
	if license, ok := themeData["license"].(string); ok {
		theme.License = license
	}
	
	// Try to get GitHub URL from theme data
	if homepage, ok := themeData["homepage"].(string); ok {
		theme.GitHubPath = homepage
	} else {
		// Construct GitHub URL from theme name
		theme.GitHubPath = fmt.Sprintf("https://github.com/gohugoio/hugoThemesSiteBuilder/tree/main/themes/%s", themeName)
	}
	
	return theme, nil
}

// SearchGitHubThemes searches GitHub directly for Hugo themes
func (s *ThemeService) SearchGitHubThemes(query string, limit int) ([]*models.Theme, error) {
	if limit <= 0 {
		limit = 30
	}
	
	client := &http.Client{Timeout: 30 * time.Second}
	
	// GitHub search API: search for repositories with "hugo-theme" in name or topic
	searchQuery := fmt.Sprintf("hugo-theme+%s+in:name,description,topic", query)
	apiURL := fmt.Sprintf("https://api.github.com/search/repositories?q=%s&sort=stars&order=desc&per_page=%d", searchQuery, limit)
	
	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}
	
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	
	// Add authentication if token is available
	if token := s.getGitHubToken(); token != "" {
		req.Header.Set("Authorization", "token "+token)
	}
	
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch from GitHub: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == 403 {
			return nil, fmt.Errorf("GitHub API rate limit exceeded. Set GITHUB_TOKEN environment variable for higher limits")
		}
		return nil, fmt.Errorf("GitHub API returned status %d", resp.StatusCode)
	}
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}
	
	var searchResult struct {
		Items []struct {
			ID          int    `json:"id"`
			Name        string `json:"name"`
			FullName    string `json:"full_name"`
			Description string `json:"description"`
			HTMLURL     string `json:"html_url"`
			Stars       int    `json:"stargazers_count"`
			Topics      []string `json:"topics"`
		} `json:"items"`
	}
	
	if err := json.Unmarshal(body, &searchResult); err != nil {
		return nil, fmt.Errorf("failed to parse GitHub response: %w", err)
	}
	
	var themes []*models.Theme
	for _, item := range searchResult.Items {
		theme := &models.Theme{
			ID:          uuid.New().String(),
			Name:        item.Name,
			Description: item.Description,
			GitHubPath:  item.HTMLURL,
			Path:        fmt.Sprintf("github.com/%s", item.FullName),
			Tags:        item.Topics,
		}
		
		// Try to fetch theme.toml for more metadata
		themeMetadata, err := s.fetchThemeMetadataFromGitHub(item.FullName)
		if err == nil && themeMetadata != nil {
			if themeMetadata.Name != "" {
				theme.Name = themeMetadata.Name
			}
			if themeMetadata.Description != "" {
				theme.Description = themeMetadata.Description
			}
			if len(themeMetadata.Tags) > 0 {
				theme.Tags = themeMetadata.Tags
			}
			theme.Author = themeMetadata.Author
			theme.License = themeMetadata.License
			theme.MinVersion = themeMetadata.MinVersion
		}
		
		themes = append(themes, theme)
	}
	
	return themes, nil
}

// fetchThemeMetadataFromGitHub fetches theme.toml from a GitHub repository
func (s *ThemeService) fetchThemeMetadataFromGitHub(repoFullName string) (*models.ThemeMetadata, error) {
	client := &http.Client{Timeout: 10 * time.Second}
	
	// Try common theme.toml locations
	paths := []string{"theme.toml", "archetypes/theme.toml", "exampleSite/theme.toml"}
	
	for _, path := range paths {
		apiURL := fmt.Sprintf("https://raw.githubusercontent.com/%s/main/%s", repoFullName, path)
		
		req, err := http.NewRequest("GET", apiURL, nil)
		if err != nil {
			continue
		}
		
		if token := s.getGitHubToken(); token != "" {
			req.Header.Set("Authorization", "token "+token)
		}
		
		resp, err := client.Do(req)
		if err != nil || resp.StatusCode != http.StatusOK {
			if resp != nil {
				resp.Body.Close()
			}
			continue
		}
		
		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			continue
		}
		
		// Parse theme.toml
		var themeData map[string]interface{}
		if err := toml.Unmarshal(body, &themeData); err != nil {
			continue
		}
		
		metadata := &models.ThemeMetadata{}
		
		if name, ok := themeData["name"].(string); ok {
			metadata.Name = name
		}
		if desc, ok := themeData["description"].(string); ok {
			metadata.Description = desc
		}
		if tags, ok := themeData["tags"].([]interface{}); ok {
			for _, tag := range tags {
				if tagStr, ok := tag.(string); ok {
					metadata.Tags = append(metadata.Tags, tagStr)
				}
			}
		}
		if minVersion, ok := themeData["min_version"].(string); ok {
			metadata.MinVersion = minVersion
		}
		if author, ok := themeData["author"].(map[string]interface{}); ok {
			if name, ok := author["name"].(string); ok {
				metadata.Author = name
			}
		}
		if license, ok := themeData["license"].(string); ok {
			metadata.License = license
		}
		metadata.GitHubURL = fmt.Sprintf("https://github.com/%s", repoFullName)
		
		return metadata, nil
	}
	
	return nil, fmt.Errorf("theme.toml not found")
}

// fetchThemesFromWebsite scrapes themes from themes.gohugo.io
func (s *ThemeService) fetchThemesFromWebsite() ([]*models.Theme, error) {
	client := &http.Client{Timeout: 60 * time.Second}
	
	// Fetch the main themes page
	resp, err := client.Get("https://themes.gohugo.io/")
	if err != nil {
		return nil, fmt.Errorf("failed to fetch themes.gohugo.io: %w", err)
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("themes.gohugo.io returned status %d", resp.StatusCode)
	}
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}
	
	html := string(body)
	
	// Extract theme links - themes.gohugo.io has links like /themes/theme-name/
	// Try multiple patterns to catch different HTML structures
	themeLinkPatterns := []*regexp.Regexp{
		regexp.MustCompile(`href=["']/themes/([^/"']+)/["']`),  // Standard href="/themes/name/"
		regexp.MustCompile(`/themes/([a-zA-Z0-9-_]+)/`),        // Any /themes/name/ reference
	}
	
	themeMap := make(map[string]bool)
	var themeSlugs []string
	
	// Try each pattern
	for _, pattern := range themeLinkPatterns {
		matches := pattern.FindAllStringSubmatch(html, -1)
		for _, match := range matches {
			if len(match) > 1 {
				themeSlug := match[1]
				// Filter out invalid slugs
				if !themeMap[themeSlug] && themeSlug != "" && themeSlug != "themes" && 
				   !strings.Contains(themeSlug, " ") && len(themeSlug) > 2 {
					themeMap[themeSlug] = true
					themeSlugs = append(themeSlugs, themeSlug)
				}
			}
		}
	}
	
	if len(themeSlugs) == 0 {
		// Try a simpler fallback pattern
		simplePattern := regexp.MustCompile(`themes/([a-z0-9-]+)`)
		simpleMatches := simplePattern.FindAllStringSubmatch(html, -1)
		for _, match := range simpleMatches {
			if len(match) > 1 {
				themeSlug := match[1]
				if !themeMap[themeSlug] && themeSlug != "themes" && len(themeSlug) > 2 {
					themeMap[themeSlug] = true
					themeSlugs = append(themeSlugs, themeSlug)
				}
			}
		}
	}
	
	if len(themeSlugs) == 0 {
		return nil, fmt.Errorf("no theme slugs found on themes.gohugo.io - website structure may have changed")
	}
	
	// Fetch detailed info for each theme (limit for initial performance)
	// In production, could fetch all or implement pagination
	maxThemes := 300
	if len(themeSlugs) > maxThemes {
		themeSlugs = themeSlugs[:maxThemes]
	}
	
	var themes []*models.Theme
	successCount := 0
	for i, slug := range themeSlugs {
		theme, err := s.fetchThemeDetailsFromWebsite(slug)
		if err != nil {
			// Skip themes that fail, but continue with others
			// Log error for debugging but don't fail entire operation
			continue
		}
		if theme != nil && theme.Name != "" {
			themes = append(themes, theme)
			successCount++
		}
		
		// Small delay to avoid rate limiting (every 10 themes)
		if i > 0 && i%10 == 0 {
			time.Sleep(200 * time.Millisecond)
		}
	}
	
	if len(themes) == 0 {
		return nil, fmt.Errorf("failed to fetch any theme details (tried %d themes)", len(themeSlugs))
	}
	
	return themes, nil
}

// fetchThemeDetailsFromWebsite fetches detailed information for a single theme
func (s *ThemeService) fetchThemeDetailsFromWebsite(themeSlug string) (*models.Theme, error) {
	client := &http.Client{Timeout: 15 * time.Second}
	
	url := fmt.Sprintf("https://themes.gohugo.io/themes/%s/", themeSlug)
	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("theme page returned status %d", resp.StatusCode)
	}
	
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	
	html := string(body)
	
	theme := &models.Theme{
		ID:        uuid.New().String(),
		Name:      themeSlug,
		GitHubPath: "", // Will be set if we find a valid GitHub URL
	}
	
	// Extract theme name from <h1> tag (multiple patterns)
	namePatterns := []*regexp.Regexp{
		regexp.MustCompile(`<h1[^>]*>([^<]+)</h1>`),
		regexp.MustCompile(`<h1[^>]*>([^<]+)</h1>`),
		regexp.MustCompile(`#\s+([^\n<]+)`),
	}
	for _, pattern := range namePatterns {
		if matches := pattern.FindStringSubmatch(html); len(matches) > 1 {
			name := strings.TrimSpace(matches[1])
			if name != "" {
				theme.Name = name
				break
			}
		}
	}
	
	// Extract description (multiple patterns)
	descPatterns := []*regexp.Regexp{
		regexp.MustCompile(`<h1[^>]*>.*?</h1>\s*<p[^>]*>([^<]+)</p>`),
		regexp.MustCompile(`<p[^>]*class="[^"]*description[^"]*"[^>]*>([^<]+)</p>`),
		regexp.MustCompile(`description[^>]*>([^<]+)</`),
	}
	for _, pattern := range descPatterns {
		if matches := pattern.FindStringSubmatch(html); len(matches) > 1 {
			desc := strings.TrimSpace(matches[1])
			if desc != "" && len(desc) > 10 {
				theme.Description = desc
				break
			}
		}
	}
	
	// Extract GitHub repository URL
	// Collect all GitHub URLs first, then filter out false positives
	githubPatterns := []*regexp.Regexp{
		// Direct href links
		regexp.MustCompile(`href=["'](https://github\.com/[^/"']+/[^/"']+)["']`),
		// GitHub links without https://
		regexp.MustCompile(`github\.com/([^/"'\s<>]+/[^/"'\s<>]+)`),
		// JSON-LD structured data
		regexp.MustCompile(`"codeRepository":\s*"https://github\.com/([^/"']+/[^/"']+)"`),
		regexp.MustCompile(`"repository":\s*"https://github\.com/([^/"']+/[^/"']+)"`),
	}
	
	var candidateURLs []string
	foundURLs := make(map[string]bool)
	
	// Collect all potential GitHub URLs
	for _, pattern := range githubPatterns {
		matches := pattern.FindAllStringSubmatch(html, -1)
		for _, match := range matches {
			if len(match) > 1 {
				githubURL := match[1]
				if !strings.HasPrefix(githubURL, "http") {
					githubURL = "https://github.com/" + githubURL
				}
				// Normalize URL (remove trailing slashes, fragments, etc.)
				githubURL = strings.TrimSuffix(githubURL, "/")
				if idx := strings.Index(githubURL, "#"); idx != -1 {
					githubURL = githubURL[:idx]
				}
				if idx := strings.Index(githubURL, "?"); idx != -1 {
					githubURL = githubURL[:idx]
				}
				
				// Validate it's a proper GitHub repo URL
				if strings.HasPrefix(githubURL, "https://github.com/") {
					parts := strings.Split(strings.TrimPrefix(githubURL, "https://github.com/"), "/")
					if len(parts) >= 2 {
						repoPath := parts[0] + "/" + parts[1]
						
						// Skip known false positives
						if repoPath == "gohugoio/hugo" {
							continue
						}
						
						// Avoid duplicates
						if !foundURLs[githubURL] {
							candidateURLs = append(candidateURLs, githubURL)
							foundURLs[githubURL] = true
						}
					}
				}
			}
		}
	}
	
	// Filter candidates: prefer URLs that don't match common false positives
	// and prioritize URLs that appear earlier in the page (likely in main content)
	for _, url := range candidateURLs {
		repoPath := strings.TrimPrefix(url, "https://github.com/")
		parts := strings.Split(repoPath, "/")
		if len(parts) >= 2 {
			repoOwnerAndName := parts[0] + "/" + parts[1]
			
			// Skip gohugoio/hugo (main Hugo repo)
			if repoOwnerAndName == "gohugoio/hugo" {
				continue
			}
			
			// Skip hugoThemesSiteBuilder unless it's specifically for this theme
			if repoOwnerAndName == "gohugoio/hugoThemesSiteBuilder" {
				// Only use if the path includes this theme
				if !strings.Contains(url, themeSlug) {
					continue
				}
			}
			
			// Found a valid theme repository URL
			theme.GitHubPath = url
			theme.Path = strings.TrimPrefix(url, "https://")
			break
		}
	}
	
	// If no GitHub URL found, try to construct from common patterns
	if theme.Path == "" {
		// Some themes might be in the hugoThemesSiteBuilder structure
		// But most are in their own repos, so we'll leave it empty and let user specify
		theme.Path = fmt.Sprintf("github.com/%s/%s", "unknown", themeSlug)
		// Don't set GitHubPath if we couldn't find a valid repo
		if theme.GitHubPath == "" {
			theme.GitHubPath = ""
		}
	}
	
	// Extract tags (improved pattern)
	tagPatterns := []*regexp.Regexp{
		regexp.MustCompile(`<a[^>]*href=["']/themes/[^"']*["'][^>]*>([^<]+)</a>`),
		regexp.MustCompile(`tag[^>]*>([^<]+)</`),
		regexp.MustCompile(`"tags":\s*\[([^\]]+)\]`),
	}
	
	tagMap := make(map[string]bool)
	for _, pattern := range tagPatterns {
		matches := pattern.FindAllStringSubmatch(html, -1)
		for _, match := range matches {
			if len(match) > 1 {
				tag := strings.TrimSpace(strings.Trim(match[1], `"`))
				if tag != "" && tag != theme.Name && !tagMap[tag] {
					tagMap[tag] = true
					theme.Tags = append(theme.Tags, tag)
				}
			}
		}
	}
	
	// Extract author (improved patterns)
	authorPatterns := []*regexp.Regexp{
		regexp.MustCompile(`Author[^<]*<[^>]*>([^<]+)</`),
		regexp.MustCompile(`"author"[^>]*>([^<]+)</`),
		regexp.MustCompile(`By\s+([^<\n]+)`),
	}
	for _, pattern := range authorPatterns {
		if matches := pattern.FindStringSubmatch(html); len(matches) > 1 {
			author := strings.TrimSpace(matches[1])
			if author != "" {
				theme.Author = author
				break
			}
		}
	}
	
	// Extract license (improved patterns)
	licensePatterns := []*regexp.Regexp{
		regexp.MustCompile(`License[^<]*<[^>]*>([^<]+)</`),
		regexp.MustCompile(`"license"[^>]*>([^<]+)</`),
	}
	for _, pattern := range licensePatterns {
		if matches := pattern.FindStringSubmatch(html); len(matches) > 1 {
			license := strings.TrimSpace(matches[1])
			if license != "" {
				theme.License = license
				break
			}
		}
	}
	
	return theme, nil
}

// GetThemeMetadata gets theme metadata from theme.toml
func (s *ThemeService) GetThemeMetadata(themePath string) (*models.ThemeMetadata, error) {
	// Try to find theme.toml in the theme directory
	themeTomlPath := filepath.Join(themePath, "theme.toml")
	if _, err := os.Stat(themeTomlPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("theme.toml not found in %s", themePath)
	}
	
	data, err := os.ReadFile(themeTomlPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read theme.toml: %w", err)
	}
	
	var themeData map[string]interface{}
	if err := toml.Unmarshal(data, &themeData); err != nil {
		return nil, fmt.Errorf("failed to parse theme.toml: %w", err)
	}
	
	metadata := &models.ThemeMetadata{}
	
	if name, ok := themeData["name"].(string); ok {
		metadata.Name = name
	}
	if desc, ok := themeData["description"].(string); ok {
		metadata.Description = desc
	}
	if tags, ok := themeData["tags"].([]interface{}); ok {
		for _, tag := range tags {
			if tagStr, ok := tag.(string); ok {
				metadata.Tags = append(metadata.Tags, tagStr)
			}
		}
	}
	if minVersion, ok := themeData["min_version"].(string); ok {
		metadata.MinVersion = minVersion
	}
	if author, ok := themeData["author"].(map[string]interface{}); ok {
		if name, ok := author["name"].(string); ok {
			metadata.Author = name
		}
	}
	if license, ok := themeData["license"].(string); ok {
		metadata.License = license
	}
	
	return metadata, nil
}

// InstallTheme installs a theme via Hugo Modules
func (s *ThemeService) InstallTheme(projectID string, themePath string) error {
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return err
	}
	
	// Check if Hugo is installed
	if !s.hugoService.IsInstalled() {
		return fmt.Errorf("Hugo is not installed")
	}
	
	// Run: hugo mod get <themePath>
	cmd := exec.Command("hugo", "mod", "get", themePath)
	cmd.Dir = project.Path
	
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to install theme: %v\n%s", err, string(output))
	}
	
	// Update project config to include theme
	if project.Config == nil {
		project.Config = &models.Config{}
	}
	
	// Check if theme is already in the list
	themeExists := false
	for _, existingTheme := range project.Config.Themes {
		if existingTheme == themePath {
			themeExists = true
			break
		}
	}
	
	if !themeExists {
		// Add theme to config
		project.Config.Themes = append(project.Config.Themes, themePath)
		
		// Save config to file using config service
		if s.configService != nil {
			// Convert themes array to interface{} array for UpdateConfig
			themes := make([]interface{}, len(project.Config.Themes))
			for i, theme := range project.Config.Themes {
				themes[i] = theme
			}
			
			// Update config using UpdateConfig method
			// Try "themes" first (array), then "theme" (single string)
			if err := s.configService.UpdateConfig(projectID, []string{"themes"}, themes); err != nil {
				// If "themes" key doesn't work, try "theme" as a single value
				// For single theme, use the last theme in the list
				if len(project.Config.Themes) == 1 {
					if err := s.configService.UpdateConfig(projectID, []string{"theme"}, project.Config.Themes[0]); err != nil {
						// Log error but don't fail installation - theme is already installed via hugo mod
						fmt.Printf("Warning: Failed to save theme to config file: %v\n", err)
					}
				} else {
					// Multiple themes - use "themes" array
					fmt.Printf("Warning: Failed to save themes to config file: %v\n", err)
				}
			}
		}
	}
	
	return nil
}

// InstallThemeSubmodule installs a theme via Git submodule (legacy)
func (s *ThemeService) InstallThemeSubmodule(projectID string, themeURL string, themeName string) error {
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return err
	}
	
	// Check if git is installed
	if _, err := exec.LookPath("git"); err != nil {
		return fmt.Errorf("Git is not installed")
	}
	
	themesDir := filepath.Join(project.Path, "themes")
	if err := os.MkdirAll(themesDir, 0755); err != nil {
		return fmt.Errorf("failed to create themes directory: %w", err)
	}
	
	themePath := filepath.Join(themesDir, themeName)
	
	// Check if theme already exists
	if _, err := os.Stat(themePath); err == nil {
		return fmt.Errorf("theme %s already exists", themeName)
	}
	
	// Initialize git repo if needed
	gitPath := filepath.Join(project.Path, ".git")
	if _, err := os.Stat(gitPath); os.IsNotExist(err) {
		cmd := exec.Command("git", "init")
		cmd.Dir = project.Path
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to initialize git: %v", err)
		}
	}
	
	// Add submodule
	cmd := exec.Command("git", "submodule", "add", themeURL, filepath.Join("themes", themeName))
	cmd.Dir = project.Path
	
	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to add submodule: %v\n%s", err, string(output))
	}
	
	// Update project config
	if project.Config == nil {
		project.Config = &models.Config{}
	}
	
	// Check if theme is already in the list
	themeExists := false
	for _, existingTheme := range project.Config.Themes {
		if existingTheme == themeName {
			themeExists = true
			break
		}
	}
	
	if !themeExists {
		// Add theme to config
		project.Config.Themes = append(project.Config.Themes, themeName)
		
		// Save config to file using config service
		if s.configService != nil {
			// Convert themes array to interface{} array for UpdateConfig
			themes := make([]interface{}, len(project.Config.Themes))
			for i, theme := range project.Config.Themes {
				themes[i] = theme
			}
			
			// Update config using UpdateConfig method
			// Try "themes" first (array), then "theme" (single string)
			if err := s.configService.UpdateConfig(projectID, []string{"themes"}, themes); err != nil {
				// If "themes" key doesn't work, try "theme" as a single value
				// For single theme, use the last theme in the list
				if len(project.Config.Themes) == 1 {
					if err := s.configService.UpdateConfig(projectID, []string{"theme"}, project.Config.Themes[0]); err != nil {
						// Log error but don't fail installation - theme is already installed via git submodule
						fmt.Printf("Warning: Failed to save theme to config file: %v\n", err)
					}
				} else {
					// Multiple themes - use "themes" array
					fmt.Printf("Warning: Failed to save themes to config file: %v\n", err)
				}
			}
		}
	}
	
	return nil
}

// RemoveTheme removes a theme from a project
func (s *ThemeService) RemoveTheme(projectID string, themePath string) error {
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return err
	}
	
	// Remove from config
	if project.Config != nil {
		var newThemes []string
		for _, theme := range project.Config.Themes {
			if theme != themePath {
				newThemes = append(newThemes, theme)
			}
		}
		project.Config.Themes = newThemes
	}
	
	// If it's a submodule, remove it
	themeDir := filepath.Join(project.Path, "themes", filepath.Base(themePath))
	if _, err := os.Stat(themeDir); err == nil {
		// Check if it's a submodule
		gitmodulesPath := filepath.Join(project.Path, ".gitmodules")
		if _, err := os.Stat(gitmodulesPath); err == nil {
			// Remove submodule
			cmd := exec.Command("git", "submodule", "deinit", "-f", filepath.Join("themes", filepath.Base(themePath)))
			cmd.Dir = project.Path
			cmd.Run() // Ignore errors
			
			cmd = exec.Command("git", "rm", "-f", filepath.Join("themes", filepath.Base(themePath)))
			cmd.Dir = project.Path
			cmd.Run() // Ignore errors
		}
		
		// Remove directory
		os.RemoveAll(themeDir)
	}
	
	return nil
}

// GetInstalledThemes gets all installed themes for a project
func (s *ThemeService) GetInstalledThemes(projectID string) ([]*models.Theme, error) {
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return nil, err
	}
	
	var themes []*models.Theme
	
	// Check themes from config
	if project.Config != nil {
		for _, themePath := range project.Config.Themes {
			theme := &models.Theme{
				ID:        uuid.New().String(),
				Name:      filepath.Base(themePath),
				Path:      themePath,
				Installed: true,
			}
			
			// Try to get metadata
			var themeDir string
			if strings.HasPrefix(themePath, "github.com/") || strings.HasPrefix(themePath, "golang.org/") {
				// Hugo module - check in themes directory or modules cache
				themeDir = filepath.Join(project.Path, "themes", filepath.Base(themePath))
			} else {
				// Local theme
				themeDir = filepath.Join(project.Path, "themes", themePath)
			}
			
			if metadata, err := s.GetThemeMetadata(themeDir); err == nil {
				theme.Description = metadata.Description
				theme.Tags = metadata.Tags
				theme.MinVersion = metadata.MinVersion
				theme.Author = metadata.Author
				theme.License = metadata.License
			}
			
			theme.LocalPath = themeDir
			themes = append(themes, theme)
		}
	}
	
	return themes, nil
}

// UpdateTheme updates a theme to the latest version
func (s *ThemeService) UpdateTheme(projectID string, themePath string) error {
	project, err := s.projectService.GetProject(projectID)
	if err != nil {
		return err
	}
	
	// Check if Hugo is installed
	if !s.hugoService.IsInstalled() {
		return fmt.Errorf("Hugo is not installed")
	}
	
	// For Hugo Modules
	if strings.HasPrefix(themePath, "github.com/") || strings.HasPrefix(themePath, "golang.org/") {
		// Run: hugo mod get -u <themePath>
		cmd := exec.Command("hugo", "mod", "get", "-u", themePath)
		cmd.Dir = project.Path
		
		output, err := cmd.CombinedOutput()
		if err != nil {
			return fmt.Errorf("failed to update theme: %v\n%s", err, string(output))
		}
	} else {
		// For submodules, update the submodule
		themeDir := filepath.Join(project.Path, "themes", filepath.Base(themePath))
		if _, err := os.Stat(themeDir); err == nil {
			cmd := exec.Command("git", "submodule", "update", "--remote", filepath.Join("themes", filepath.Base(themePath)))
			cmd.Dir = project.Path
			
			output, err := cmd.CombinedOutput()
			if err != nil {
				return fmt.Errorf("failed to update submodule: %v\n%s", err, string(output))
			}
		}
	}
	
	return nil
}

// GetThemeFromMarketplace gets theme information from themes.gohugo.io
func (s *ThemeService) GetThemeFromMarketplace(themeName string) (*models.Theme, error) {
	// Try to get from cache first
	themes, err := s.GetThemeIndex()
	if err == nil {
		for _, theme := range themes {
			if strings.EqualFold(theme.Name, themeName) {
				return theme, nil
			}
		}
	}
	
	// If not in cache, try to fetch from GitHub
	theme, err := s.fetchThemeFromGitHub(themeName)
	if err == nil {
		return theme, nil
	}
	
	// Fallback: return basic theme info
	return &models.Theme{
		ID:        uuid.New().String(),
		Name:      themeName,
		Path:      fmt.Sprintf("github.com/gohugoio/hugoThemesSiteBuilder/themes/%s", themeName),
		GitHubPath: fmt.Sprintf("https://themes.gohugo.io/themes/%s/", themeName),
	}, nil
}

