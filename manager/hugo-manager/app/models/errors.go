package models

import "fmt"

// AppError represents an application error
type AppError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Details string `json:"details,omitempty"`
}

func (e *AppError) Error() string {
	if e.Details != "" {
		return fmt.Sprintf("%s: %s (%s)", e.Code, e.Message, e.Details)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// Common error codes
const (
	ErrProjectNotFound       = "PROJECT_NOT_FOUND"
	ErrProjectInvalid        = "PROJECT_INVALID"
	ErrProjectCreationFailed = "PROJECT_CREATION_FAILED"
	ErrBuildFailed        = "BUILD_FAILED"
	ErrBuildNotFound      = "BUILD_NOT_FOUND"
	ErrBuildInProgress    = "BUILD_IN_PROGRESS"
	ErrBuildNotRunning    = "BUILD_NOT_RUNNING"
	ErrServerStartFailed    = "SERVER_START_FAILED"
	ErrServerNotRunning     = "SERVER_NOT_RUNNING"
	ErrServerAlreadyRunning  = "SERVER_ALREADY_RUNNING"
	ErrPortCheckFailed       = "PORT_CHECK_FAILED"
	ErrPortUnavailable       = "PORT_UNAVAILABLE"
	ErrFileNotFound          = "FILE_NOT_FOUND"
	ErrFileAccessDenied   = "FILE_ACCESS_DENIED"
	ErrInvalidPath        = "INVALID_PATH"
	ErrHugoNotInstalled   = "HUGO_NOT_INSTALLED"
	ErrConfigParseFailed  = "CONFIG_PARSE_FAILED"
	ErrContentNotFound    = "CONTENT_NOT_FOUND"
	ErrContentParseFailed = "CONTENT_PARSE_FAILED"
	ErrArchetypeNotFound  = "ARCHETYPE_NOT_FOUND"
	ErrInvalidFrontMatter = "INVALID_FRONT_MATTER"
)

// NewAppError creates a new application error
func NewAppError(code, message string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
	}
}

// NewAppErrorWithDetails creates a new application error with details
func NewAppErrorWithDetails(code, message, details string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Details: details,
	}
}

