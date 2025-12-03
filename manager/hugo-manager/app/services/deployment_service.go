package services

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"hugo-manager/app/models"
	"hugo-manager/app/utils"

	"github.com/google/uuid"
)

// DeploymentService handles deployment operations
type DeploymentService struct {
	projectService *ProjectService
	buildService   *BuildService
	storagePath    string
}

// NewDeploymentService creates a new deployment service
func NewDeploymentService(projectService *ProjectService, buildService *BuildService) (*DeploymentService, error) {
	storagePath, err := utils.GetConfigDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get config directory: %w", err)
	}
	
	deploymentsPath := filepath.Join(storagePath, "deployments")
	if err := os.MkdirAll(deploymentsPath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create deployments directory: %w", err)
	}
	
	return &DeploymentService{
		projectService: projectService,
		buildService:   buildService,
		storagePath:    deploymentsPath,
	}, nil
}

// CreateDeployment creates a new deployment configuration
func (s *DeploymentService) CreateDeployment(projectID string, deploymentType string, config map[string]interface{}) (*models.Deployment, error) {
	deployment := &models.Deployment{
		ID:        uuid.New().String(),
		ProjectID: projectID,
		Type:      deploymentType,
		Config:    config,
		Status:    "pending",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	
	if err := s.saveDeployment(deployment); err != nil {
		return nil, err
	}
	
	return deployment, nil
}

// GetDeployment gets a deployment by ID
func (s *DeploymentService) GetDeployment(deploymentID string) (*models.Deployment, error) {
	path := filepath.Join(s.storagePath, deploymentID+".json")
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("deployment not found: %w", err)
	}
	
	var deployment models.Deployment
	if err := json.Unmarshal(data, &deployment); err != nil {
		return nil, fmt.Errorf("failed to parse deployment: %w", err)
	}
	
	return &deployment, nil
}

// GetDeploymentsForProject gets all deployments for a project
func (s *DeploymentService) GetDeploymentsForProject(projectID string) ([]*models.Deployment, error) {
	entries, err := os.ReadDir(s.storagePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read deployments directory: %w", err)
	}
	
	var deployments []*models.Deployment
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		
		path := filepath.Join(s.storagePath, entry.Name())
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		
		var deployment models.Deployment
		if err := json.Unmarshal(data, &deployment); err != nil {
			continue
		}
		
		if deployment.ProjectID == projectID {
			deployments = append(deployments, &deployment)
		}
	}
	
	return deployments, nil
}

// UpdateDeployment updates a deployment configuration
func (s *DeploymentService) UpdateDeployment(deploymentID string, config map[string]interface{}) (*models.Deployment, error) {
	deployment, err := s.GetDeployment(deploymentID)
	if err != nil {
		return nil, err
	}
	
	deployment.Config = config
	deployment.UpdatedAt = time.Now()
	
	if err := s.saveDeployment(deployment); err != nil {
		return nil, err
	}
	
	return deployment, nil
}

// DeleteDeployment deletes a deployment configuration
func (s *DeploymentService) DeleteDeployment(deploymentID string) error {
	path := filepath.Join(s.storagePath, deploymentID+".json")
	return os.Remove(path)
}

// Deploy executes a deployment
func (s *DeploymentService) Deploy(deploymentID string, options models.DeploymentOptions) (*models.DeploymentHistory, error) {
	deployment, err := s.GetDeployment(deploymentID)
	if err != nil {
		return nil, err
	}
	
	project, err := s.projectService.GetProject(deployment.ProjectID)
	if err != nil {
		return nil, err
	}
	
	history := &models.DeploymentHistory{
		ID:           uuid.New().String(),
		DeploymentID: deploymentID,
		ProjectID:    deployment.ProjectID,
		Status:       "building",
		CreatedAt:    time.Now(),
		Logs:         []string{},
	}
	
	// Build the project first
	buildStart := time.Now()
	_, err = s.buildService.StartBuild(deployment.ProjectID, options.BuildOptions)
	if err != nil {
		history.Status = "failed"
		history.Error = fmt.Sprintf("Build failed: %v", err)
		history.BuildTime = time.Since(buildStart).Milliseconds()
		s.saveDeploymentHistory(history)
		return history, err
	}
	
	// Wait for build to complete
	for {
		status, err := s.buildService.GetBuildStatus(deployment.ProjectID)
		if err != nil {
			history.Status = "failed"
			history.Error = fmt.Sprintf("Failed to get build status: %v", err)
			history.BuildTime = time.Since(buildStart).Milliseconds()
			s.saveDeploymentHistory(history)
			return history, err
		}
		
		if status.Status == "completed" {
			history.BuildTime = time.Since(buildStart).Milliseconds()
			break
		} else if status.Status == "failed" {
			history.Status = "failed"
			history.Error = "Build failed"
			history.BuildTime = time.Since(buildStart).Milliseconds()
			s.saveDeploymentHistory(history)
			return history, fmt.Errorf("build failed")
		}
		
		time.Sleep(500 * time.Millisecond)
	}
	
	// Deploy based on type
	deployStart := time.Now()
	history.Status = "deploying"
	
	var deployErr error
	var deployURL string
	
	switch deployment.Type {
	case "netlify":
		deployURL, deployErr = s.deployToNetlify(deployment, project, history)
	case "vercel":
		deployURL, deployErr = s.deployToVercel(deployment, project, history)
	case "github-pages":
		deployURL, deployErr = s.deployToGitHubPages(deployment, project, options, history)
	case "ftp":
		deployErr = s.deployToFTP(deployment, project, history)
	case "s3":
		deployURL, deployErr = s.deployToS3(deployment, project, history)
	case "generic":
		deployErr = s.deployGeneric(deployment, project, history)
	default:
		deployErr = fmt.Errorf("unsupported deployment type: %s", deployment.Type)
	}
	
	history.DeployTime = time.Since(deployStart).Milliseconds()
	
	if deployErr != nil {
		history.Status = "failed"
		history.Error = deployErr.Error()
	} else {
		history.Status = "success"
		history.URL = deployURL
	}
	
	s.saveDeploymentHistory(history)
	
	// Update deployment status
	deployment.Status = history.Status
	deployment.UpdatedAt = time.Now()
	s.saveDeployment(deployment)
	
	return history, deployErr
}

// deployToNetlify deploys to Netlify
func (s *DeploymentService) deployToNetlify(deployment *models.Deployment, project *models.Project, history *models.DeploymentHistory) (string, error) {
	apiToken, _ := deployment.Config["apiToken"].(string)
	siteID, _ := deployment.Config["siteId"].(string)
	
	if apiToken == "" || siteID == "" {
		return "", fmt.Errorf("Netlify API token and site ID are required")
	}
	
	// Check if Netlify CLI is installed
	if _, err := exec.LookPath("netlify"); err != nil {
		return "", fmt.Errorf("Netlify CLI is not installed. Please install it: npm install -g netlify-cli")
	}
	
	publishDir := project.Config.PublishDir
	if publishDir == "" {
		publishDir = "public"
	}
	
	buildPath := filepath.Join(project.Path, publishDir)
	
	// Use Netlify CLI to deploy
	cmd := exec.Command("netlify", "deploy", "--prod", "--dir", buildPath, "--site", siteID)
	cmd.Env = append(os.Environ(), "NETLIFY_AUTH_TOKEN="+apiToken)
	
	output, err := cmd.CombinedOutput()
	history.Logs = append(history.Logs, string(output))
	
	if err != nil {
		return "", fmt.Errorf("netlify deploy failed: %v", err)
	}
	
	// Extract URL from output (simplified - in production, parse properly)
	url := fmt.Sprintf("https://%s.netlify.app", siteID)
	
	return url, nil
}

// deployToVercel deploys to Vercel
func (s *DeploymentService) deployToVercel(deployment *models.Deployment, project *models.Project, history *models.DeploymentHistory) (string, error) {
	apiToken, _ := deployment.Config["apiToken"].(string)
	projectName, _ := deployment.Config["projectName"].(string)
	
	if apiToken == "" {
		return "", fmt.Errorf("Vercel API token is required")
	}
	
	// Check if Vercel CLI is installed
	if _, err := exec.LookPath("vercel"); err != nil {
		return "", fmt.Errorf("Vercel CLI is not installed. Please install it: npm install -g vercel")
	}
	
	publishDir := project.Config.PublishDir
	if publishDir == "" {
		publishDir = "public"
	}
	
	buildPath := filepath.Join(project.Path, publishDir)
	
	// Use Vercel CLI to deploy
	cmd := exec.Command("vercel", "--prod", "--yes", "--token", apiToken)
	if projectName != "" {
		cmd.Args = append(cmd.Args, "--name", projectName)
	}
	cmd.Dir = buildPath
	
	output, err := cmd.CombinedOutput()
	history.Logs = append(history.Logs, string(output))
	
	if err != nil {
		return "", fmt.Errorf("vercel deploy failed: %v", err)
	}
	
	// Extract URL from output (simplified - in production, parse properly)
	url := "https://" + projectName + ".vercel.app"
	
	return url, nil
}

// deployToGitHubPages deploys to GitHub Pages
func (s *DeploymentService) deployToGitHubPages(deployment *models.Deployment, project *models.Project, options models.DeploymentOptions, history *models.DeploymentHistory) (string, error) {
	repo, _ := deployment.Config["repository"].(string)
	branch, _ := deployment.Config["branch"].(string)
	if branch == "" {
		branch = "gh-pages"
	}
	
	if repo == "" {
		return "", fmt.Errorf("GitHub repository URL is required")
	}
	
	// Check if git is installed
	if _, err := exec.LookPath("git"); err != nil {
		return "", fmt.Errorf("Git is not installed")
	}
	
	publishDir := project.Config.PublishDir
	if publishDir == "" {
		publishDir = "public"
	}
	
	buildPath := filepath.Join(project.Path, publishDir)
	
	// Initialize git repo in build directory if needed
	gitPath := filepath.Join(buildPath, ".git")
	if _, err := os.Stat(gitPath); os.IsNotExist(err) {
		cmd := exec.Command("git", "init")
		cmd.Dir = buildPath
		if err := cmd.Run(); err != nil {
			return "", fmt.Errorf("failed to initialize git: %v", err)
		}
		
		cmd = exec.Command("git", "remote", "add", "origin", repo)
		cmd.Dir = buildPath
		if err := cmd.Run(); err != nil {
			// Remote might already exist, continue
		}
	}
	
	// Add, commit, and push
	cmd := exec.Command("git", "add", ".")
	cmd.Dir = buildPath
	if output, err := cmd.CombinedOutput(); err != nil {
		history.Logs = append(history.Logs, string(output))
		return "", fmt.Errorf("git add failed: %v", err)
	}
	
	cmd = exec.Command("git", "commit", "-m", "Deploy from Hugo Manager")
	cmd.Dir = buildPath
	output, err := cmd.CombinedOutput()
	history.Logs = append(history.Logs, string(output))
	if err != nil {
		// Commit might fail if nothing changed, continue
	}
	
	cmd = exec.Command("git", "push", "-f", "origin", "HEAD:"+branch)
	cmd.Dir = buildPath
	output, err = cmd.CombinedOutput()
	history.Logs = append(history.Logs, string(output))
	
	if err != nil {
		return "", fmt.Errorf("git push failed: %v", err)
	}
	
	// Extract URL from repo
	url := fmt.Sprintf("https://%s.github.io/%s", repo, filepath.Base(repo))
	
	return url, nil
}

// deployToFTP deploys via FTP
func (s *DeploymentService) deployToFTP(deployment *models.Deployment, project *models.Project, history *models.DeploymentHistory) error {
	host, _ := deployment.Config["host"].(string)
	port, _ := deployment.Config["port"].(string)
	username, _ := deployment.Config["username"].(string)
	password, _ := deployment.Config["password"].(string)
	remotePath, _ := deployment.Config["remotePath"].(string)
	useTLS, _ := deployment.Config["useTLS"].(bool)
	
	if host == "" || username == "" || password == "" {
		return fmt.Errorf("FTP host, username, and password are required")
	}
	
	if port == "" {
		if useTLS {
			port = "21"
		} else {
			port = "21"
		}
	}
	
	if remotePath == "" {
		remotePath = "/"
	}
	
	publishDir := project.Config.PublishDir
	if publishDir == "" {
		publishDir = "public"
	}
	
	buildPath := filepath.Join(project.Path, publishDir)
	
	// Check if rclone is installed (recommended for FTP)
	if _, err := exec.LookPath("rclone"); err == nil {
		// Use rclone for FTP deployment
		history.Logs = append(history.Logs, "Using rclone for FTP deployment...")
		
		// Create rclone config command
		configName := fmt.Sprintf("hugo-manager-ftp-%s", deployment.ID[:8])
		
		// Use rclone copy command
		cmd := exec.Command("rclone", "copy", buildPath, configName+":"+remotePath, 
			"--ftp-host", host,
			"--ftp-port", port,
			"--ftp-user", username,
			"--ftp-pass", password,
			"--progress",
			"--transfers", "10",
			"--checkers", "8")
		
		if useTLS {
			cmd.Args = append(cmd.Args, "--ftp-tls")
		}
		
		output, err := cmd.CombinedOutput()
		history.Logs = append(history.Logs, string(output))
		
		if err != nil {
			return fmt.Errorf("rclone FTP deployment failed: %v", err)
		}
		
		history.Logs = append(history.Logs, "FTP deployment completed successfully")
		return nil
	}
	
	// Fallback: Check if lftp is installed
	if _, err := exec.LookPath("lftp"); err == nil {
		history.Logs = append(history.Logs, "Using lftp for FTP deployment...")
		
		protocol := "ftp"
		if useTLS {
			protocol = "ftps"
		}
		
		ftpURL := fmt.Sprintf("%s://%s:%s@%s:%s%s", protocol, username, password, host, port, remotePath)
		
		// Create lftp script
		lftpScript := fmt.Sprintf(`
set ftp:ssl-allow no
set ssl:verify-certificate no
open %s
mirror -R -e -v %s %s
quit
`, ftpURL, buildPath, remotePath)
		
		cmd := exec.Command("lftp", "-c", lftpScript)
		output, err := cmd.CombinedOutput()
		history.Logs = append(history.Logs, string(output))
		
		if err != nil {
			return fmt.Errorf("lftp deployment failed: %v", err)
		}
		
		history.Logs = append(history.Logs, "FTP deployment completed successfully")
		return nil
	}
	
	// No FTP client found
	return fmt.Errorf("FTP deployment requires either 'rclone' or 'lftp' to be installed. Please install one:\n  - rclone: https://rclone.org/install/\n  - lftp: brew install lftp (macOS) or apt-get install lftp (Linux)")
}

// deployToS3 deploys to AWS S3
func (s *DeploymentService) deployToS3(deployment *models.Deployment, project *models.Project, history *models.DeploymentHistory) (string, error) {
	bucket, _ := deployment.Config["bucket"].(string)
	region, _ := deployment.Config["region"].(string)
	accessKey, _ := deployment.Config["accessKey"].(string)
	secretKey, _ := deployment.Config["secretKey"].(string)
	prefix, _ := deployment.Config["prefix"].(string)
	cloudfrontID, _ := deployment.Config["cloudfrontId"].(string)
	
	if bucket == "" {
		return "", fmt.Errorf("S3 bucket name is required")
	}
	
	if region == "" {
		region = "us-east-1"
	}
	
	publishDir := project.Config.PublishDir
	if publishDir == "" {
		publishDir = "public"
	}
	
	buildPath := filepath.Join(project.Path, publishDir)
	
	// Check if AWS CLI is installed
	if _, err := exec.LookPath("aws"); err == nil {
		history.Logs = append(history.Logs, "Using AWS CLI for S3 deployment...")
		
		// Set AWS credentials if provided
		cmd := exec.Command("aws", "s3", "sync", buildPath, fmt.Sprintf("s3://%s/%s", bucket, prefix),
			"--delete",
			"--region", region)
		
		if accessKey != "" && secretKey != "" {
			cmd.Env = os.Environ()
			cmd.Env = append(cmd.Env, "AWS_ACCESS_KEY_ID="+accessKey)
			cmd.Env = append(cmd.Env, "AWS_SECRET_ACCESS_KEY="+secretKey)
			cmd.Env = append(cmd.Env, "AWS_DEFAULT_REGION="+region)
		}
		
		output, err := cmd.CombinedOutput()
		history.Logs = append(history.Logs, string(output))
		
		if err != nil {
			return "", fmt.Errorf("AWS S3 sync failed: %v", err)
		}
		
		// Invalidate CloudFront if configured
		if cloudfrontID != "" {
			history.Logs = append(history.Logs, fmt.Sprintf("Invalidating CloudFront distribution %s...", cloudfrontID))
			cfCmd := exec.Command("aws", "cloudfront", "create-invalidation",
				"--distribution-id", cloudfrontID,
				"--paths", "/*")
			
			if accessKey != "" && secretKey != "" {
				cfCmd.Env = os.Environ()
				cfCmd.Env = append(cfCmd.Env, "AWS_ACCESS_KEY_ID="+accessKey)
				cfCmd.Env = append(cfCmd.Env, "AWS_SECRET_ACCESS_KEY="+secretKey)
				cfCmd.Env = append(cfCmd.Env, "AWS_DEFAULT_REGION="+region)
			}
			
			cfOutput, cfErr := cfCmd.CombinedOutput()
			history.Logs = append(history.Logs, string(cfOutput))
			if cfErr != nil {
				history.Logs = append(history.Logs, fmt.Sprintf("Warning: CloudFront invalidation failed: %v", cfErr))
			}
		}
		
		url := fmt.Sprintf("https://%s.s3.%s.amazonaws.com", bucket, region)
		if prefix != "" {
			url += "/" + prefix
		}
		history.URL = url
		
		history.Logs = append(history.Logs, "S3 deployment completed successfully")
		return url, nil
	}
	
	// Check if rclone is installed (alternative)
	if _, err := exec.LookPath("rclone"); err == nil {
		history.Logs = append(history.Logs, "Using rclone for S3 deployment...")
		
		configName := fmt.Sprintf("hugo-manager-s3-%s", deployment.ID[:8])
		s3Path := fmt.Sprintf("%s:%s/%s", configName, bucket, prefix)
		
		cmd := exec.Command("rclone", "copy", buildPath, s3Path,
			"--s3-region", region,
			"--s3-access-key-id", accessKey,
			"--s3-secret-access-key", secretKey,
			"--progress",
			"--transfers", "10",
			"--checkers", "8")
		
		output, err := cmd.CombinedOutput()
		history.Logs = append(history.Logs, string(output))
		
		if err != nil {
			return "", fmt.Errorf("rclone S3 deployment failed: %v", err)
		}
		
		url := fmt.Sprintf("https://%s.s3.%s.amazonaws.com", bucket, region)
		if prefix != "" {
			url += "/" + prefix
		}
		history.URL = url
		
		history.Logs = append(history.Logs, "S3 deployment completed successfully")
		return url, nil
	}
	
	// No S3 client found
	return "", fmt.Errorf("S3 deployment requires either 'aws' CLI or 'rclone' to be installed. Please install one:\n  - AWS CLI: https://aws.amazon.com/cli/\n  - rclone: https://rclone.org/install/")
}

// deployGeneric performs a generic deployment (custom script)
func (s *DeploymentService) deployGeneric(deployment *models.Deployment, project *models.Project, history *models.DeploymentHistory) error {
	script, _ := deployment.Config["script"].(string)
	if script == "" {
		return fmt.Errorf("deployment script is required for generic deployment")
	}
	
	// Execute custom script
	cmd := exec.Command("sh", "-c", script)
	cmd.Dir = project.Path
	cmd.Env = os.Environ()
	cmd.Env = append(cmd.Env, "HUGO_PROJECT_PATH="+project.Path)
	
	publishDir := project.Config.PublishDir
	if publishDir == "" {
		publishDir = "public"
	}
	cmd.Env = append(cmd.Env, "HUGO_PUBLISH_DIR="+filepath.Join(project.Path, publishDir))
	
	output, err := cmd.CombinedOutput()
	history.Logs = append(history.Logs, string(output))
	
	if err != nil {
		return fmt.Errorf("deployment script failed: %v", err)
	}
	
	return nil
}

// GetDeploymentHistory gets deployment history for a deployment
func (s *DeploymentService) GetDeploymentHistory(deploymentID string, limit int) ([]*models.DeploymentHistory, error) {
	historyPath := filepath.Join(s.storagePath, "history")
	if err := os.MkdirAll(historyPath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create history directory: %w", err)
	}
	
	entries, err := os.ReadDir(historyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read history directory: %w", err)
	}
	
	var histories []*models.DeploymentHistory
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}
		
		path := filepath.Join(historyPath, entry.Name())
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		
		var history models.DeploymentHistory
		if err := json.Unmarshal(data, &history); err != nil {
			continue
		}
		
		if history.DeploymentID == deploymentID {
			histories = append(histories, &history)
		}
	}
	
	// Sort by created date (newest first) and limit
	if limit > 0 && limit < len(histories) {
		histories = histories[:limit]
	}
	
	return histories, nil
}

// saveDeployment saves a deployment to disk
func (s *DeploymentService) saveDeployment(deployment *models.Deployment) error {
	path := filepath.Join(s.storagePath, deployment.ID+".json")
	data, err := json.MarshalIndent(deployment, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal deployment: %w", err)
	}
	
	return os.WriteFile(path, data, 0644)
}

// saveDeploymentHistory saves deployment history to disk
func (s *DeploymentService) saveDeploymentHistory(history *models.DeploymentHistory) error {
	historyPath := filepath.Join(s.storagePath, "history")
	if err := os.MkdirAll(historyPath, 0755); err != nil {
		return fmt.Errorf("failed to create history directory: %w", err)
	}
	
	path := filepath.Join(historyPath, history.ID+".json")
	data, err := json.MarshalIndent(history, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal history: %w", err)
	}
	
	return os.WriteFile(path, data, 0644)
}

