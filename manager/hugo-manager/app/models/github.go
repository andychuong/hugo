package models

import (
	"encoding/json"
	"time"
)

// GitHubRepository represents a GitHub repository
type GitHubRepository struct {
	ID            int64     `json:"id"`
	Name          string    `json:"name"`
	FullName      string    `json:"fullName"`      // e.g., "username/repo"
	Description   string    `json:"description"`
	URL           string    `json:"url"`            // HTML URL
	CloneURL      string    `json:"cloneUrl"`       // HTTPS clone URL
	SSHURL        string    `json:"sshUrl"`         // SSH clone URL
	DefaultBranch string    `json:"defaultBranch"`
	IsPrivate     bool      `json:"isPrivate"`
	IsFork        bool      `json:"isFork"`
	Stars         int       `json:"stars"`
	Forks         int       `json:"forks"`
	Language      string    `json:"language"`
	Topics        []string  `json:"topics"`
	CreatedAt     time.Time `json:"-"`
	UpdatedAt     time.Time `json:"-"`
	PushedAt      time.Time `json:"-"`

	// JSON serialized fields
	CreatedAtStr string `json:"createdAt"`
	UpdatedAtStr string  `json:"updatedAt"`
	PushedAtStr  string  `json:"pushedAt"`

	// Hugo-specific
	IsHugoProject bool            `json:"isHugoProject"`
	HugoInfo      *HugoProjectInfo `json:"hugoInfo,omitempty"`
}

// HugoProjectInfo contains information about a Hugo project detected in a GitHub repository
type HugoProjectInfo struct {
	IsHugoProject bool    `json:"isHugoProject"`
	Confidence    int     `json:"confidence"` // 0-100 confidence score
	ConfigFiles   []string `json:"configFiles"` // Found config files
	HasContentDir bool    `json:"hasContentDir"`
	HasThemesDir  bool    `json:"hasThemesDir"`
	HasArchetypes bool    `json:"hasArchetypes"`
	HasLayouts   bool    `json:"hasLayouts"`
	Reasons       []string `json:"reasons"` // Reasons why it's detected as Hugo
}

// GitCommit represents a git commit
type GitCommit struct {
	Hash      string    `json:"hash"`
	ShortHash string    `json:"shortHash"`
	Message   string    `json:"message"`
	Author    string    `json:"author"`
	Email     string    `json:"email"`
	Date      time.Time `json:"-"`
	DateStr   string    `json:"date"`
	Branch    string    `json:"branch,omitempty"`
}

// GitBranch represents a git branch
type GitBranch struct {
	Name      string `json:"name"`
	IsRemote  bool   `json:"isRemote"`
	IsCurrent bool   `json:"isCurrent"`
	Commit    string `json:"commit,omitempty"`
}

// GitHubUser represents a GitHub user
type GitHubUser struct {
	Login     string `json:"login"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	AvatarURL string `json:"avatarUrl"`
	Bio       string `json:"bio"`
	Company   string `json:"company"`
	Location  string `json:"location"`
	Blog      string `json:"blog"`
}

// MarshalJSON custom marshaling for GitHubRepository
func (r *GitHubRepository) MarshalJSON() ([]byte, error) {
	type Alias GitHubRepository
	return json.Marshal(&struct {
		*Alias
		CreatedAtStr string `json:"createdAt"`
		UpdatedAtStr string  `json:"updatedAt"`
		PushedAtStr  string  `json:"pushedAt"`
	}{
		Alias:        (*Alias)(r),
		CreatedAtStr: r.CreatedAt.Format(time.RFC3339),
		UpdatedAtStr: r.UpdatedAt.Format(time.RFC3339),
		PushedAtStr:  r.PushedAt.Format(time.RFC3339),
	})
}

// UnmarshalJSON custom unmarshaling for GitHubRepository
func (r *GitHubRepository) UnmarshalJSON(data []byte) error {
	type Alias GitHubRepository
	aux := &struct {
		*Alias
		CreatedAtStr string `json:"createdAt"`
		UpdatedAtStr string  `json:"updatedAt"`
		PushedAtStr  string  `json:"pushedAt"`
	}{
		Alias: (*Alias)(r),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	if aux.CreatedAtStr != "" {
		if t, err := time.Parse(time.RFC3339, aux.CreatedAtStr); err == nil {
			r.CreatedAt = t
		}
	}
	if aux.UpdatedAtStr != "" {
		if t, err := time.Parse(time.RFC3339, aux.UpdatedAtStr); err == nil {
			r.UpdatedAt = t
		}
	}
	if aux.PushedAtStr != "" {
		if t, err := time.Parse(time.RFC3339, aux.PushedAtStr); err == nil {
			r.PushedAt = t
		}
	}

	return nil
}

// MarshalJSON custom marshaling for GitCommit
func (c *GitCommit) MarshalJSON() ([]byte, error) {
	type Alias GitCommit
	return json.Marshal(&struct {
		*Alias
		DateStr string `json:"date"`
	}{
		Alias:   (*Alias)(c),
		DateStr: c.Date.Format(time.RFC3339),
	})
}

// UnmarshalJSON custom unmarshaling for GitCommit
func (c *GitCommit) UnmarshalJSON(data []byte) error {
	type Alias GitCommit
	aux := &struct {
		*Alias
		DateStr string `json:"date"`
	}{
		Alias: (*Alias)(c),
	}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}

	if aux.DateStr != "" {
		if t, err := time.Parse(time.RFC3339, aux.DateStr); err == nil {
			c.Date = t
		}
	}

	return nil
}

