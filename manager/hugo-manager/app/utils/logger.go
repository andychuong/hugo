package utils

import (
	"log"
	"os"
)

var (
	// Logger is the application logger
	Logger *log.Logger
)

// InitLogger initializes the application logger
func InitLogger(logFile string) error {
	file, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0666)
	if err != nil {
		return err
	}

	Logger = log.New(file, "", log.Ldate|log.Ltime|log.Lshortfile)
	return nil
}

// LogError logs an error message
func LogError(err error) {
	if Logger != nil {
		Logger.Printf("ERROR: %v", err)
	} else {
		log.Printf("ERROR: %v", err)
	}
}

// LogInfo logs an info message
func LogInfo(message string) {
	if Logger != nil {
		Logger.Printf("INFO: %s", message)
	} else {
		log.Printf("INFO: %s", message)
	}
}

