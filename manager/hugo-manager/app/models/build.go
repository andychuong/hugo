package models

import "time"

// Build represents a build operation
type Build struct {
	ID             string    `json:"id"`
	ProjectID      string    `json:"projectId"`
	Status         string    `json:"status"` // "running", "success", "failed"
	StartTime      time.Time `json:"startTime"`
	EndTime        time.Time `json:"endTime"`
	Duration       int64     `json:"duration"` // milliseconds
	Output         string    `json:"output"`
	Error          string    `json:"error"`
	FilesGenerated int       `json:"filesGenerated"`
}

// BuildOptions represents options for a build
type BuildOptions struct {
	Environment string   `json:"environment"` // "development", "production"
	Draft       bool     `json:"draft"`
	Future      bool     `json:"future"`
	Expired     bool     `json:"expired"`
	Minify      bool     `json:"minify"`
	Verbose     bool     `json:"verbose"`
	ExtraArgs   []string `json:"extraArgs"`
}

// BuildResult represents the result of a build
type BuildResult struct {
	Success   bool   `json:"success"`
	Output    string `json:"output"`
	Error     string `json:"error"`
	Duration  int64  `json:"duration"` // milliseconds
	FilesGenerated int `json:"filesGenerated"`
}

