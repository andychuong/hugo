package models

// ServerInfo represents information about a running Hugo server
type ServerInfo struct {
	ProjectID  string `json:"projectId"`
	IsRunning  bool   `json:"isRunning"`
	URL        string `json:"url"`
	Port       int    `json:"port"`
	PID        int    `json:"pid"`
	StartTime  string `json:"startTime"`
}

// ServerOptions represents options for starting a server
type ServerOptions struct {
	Port          int    `json:"port"`
	BaseURL       string `json:"baseURL"`
	BuildDrafts   bool   `json:"buildDrafts"`
	BuildFuture   bool   `json:"buildFuture"`
	BuildExpired  bool   `json:"buildExpired"`
	DisableLiveReload bool `json:"disableLiveReload"`
}

