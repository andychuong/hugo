# Hugo Manager

A desktop application for managing multiple Hugo static site projects, designed for small business users and developers who work with multiple Hugo sites.

## Project Structure

```
hugo-manager/
├── app/                      # Wails backend
│   ├── main.go              # Application entry point
│   ├── models/              # Data models
│   │   ├── project.go
│   │   ├── build.go
│   │   ├── server.go
│   │   ├── file.go
│   │   ├── config.go
│   │   ├── theme.go
│   │   └── errors.go
│   ├── services/            # Business logic
│   │   ├── project_service.go
│   │   ├── project_storage.go
│   │   ├── hugo_service.go
│   │   └── build_service.go
│   ├── handlers/            # Wails bindings
│   │   └── app.go
│   └── utils/               # Utility functions
│       ├── path.go
│       ├── uuid.go
│       ├── file.go
│       ├── config.go
│       └── logger.go
├── frontend/                # React frontend
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── style.css
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── package.json
├── build/                    # Build configuration
├── wails.json               # Wails configuration
├── go.mod
└── README.md
```

## Phase 1: Foundation & Setup ✅

### Completed Tasks

1. **Project Initialization**
   - ✅ Initialized Wails project with React + TypeScript template
   - ✅ Set up project directory structure
   - ✅ Configured Go workspace to use local Hugo source

2. **Frontend Setup**
   - ✅ Configured Tailwind CSS
   - ✅ Set up PostCSS
   - ✅ Created basic UI layout with Tailwind styling

3. **Backend Models**
   - ✅ Created `Project` model
   - ✅ Created `Build` model
   - ✅ Created `Server` model
   - ✅ Created `FileInfo` model
   - ✅ Created `Config` model (including VisualEditingConfig)
   - ✅ Created `Theme` model
   - ✅ Created error types

4. **Utility Functions**
   - ✅ Path validation utilities
   - ✅ UUID generation
   - ✅ File system helpers
   - ✅ Config file parsers (TOML, YAML, JSON)
   - ✅ Logger setup

5. **Development Environment**
   - ✅ Go workspace configured
   - ✅ Dependencies installed
   - ✅ Basic Wails bindings structure created

## Development

### Prerequisites

- Go 1.24+
- Node.js 16+
- Wails CLI (`go install github.com/wailsapp/wails/v2/cmd/wails@latest`)

### Running the App

```bash
# Development mode (with hot reload)
cd manager/hugo-manager
wails dev

# Build for production
wails build
```

### Project Location

This project is located at: `manager/hugo-manager/` within the Hugo repository.

The Go workspace (`go.work`) is configured to use:
- The main Hugo module (`.`)
- The Hugo Manager module (`./manager/hugo-manager`)

This allows the Manager to use Hugo's source code directly via the `replace` directive in `go.mod`.

## Phase 2: Project Management ✅ COMPLETED

### Completed Tasks

1. **Project Service**
   - ✅ Project discovery (scan directories for Hugo projects)
   - ✅ Project validation (check if directory is a Hugo project)
   - ✅ Add/remove/get projects
   - ✅ Project metadata loading and refresh
   - ✅ Hugo config file parsing (TOML, YAML, JSON)
   - ✅ Hugo version detection

2. **Project Storage**
   - ✅ Config file structure design
   - ✅ Project persistence (save/load from disk)
   - ✅ Project cache in memory
   - ✅ Platform-specific config directories

3. **Frontend Components**
   - ✅ ProjectList component with search/filter
   - ✅ ProjectCard component with status indicators
   - ✅ ProjectView component with tabs
   - ✅ Overview, Files, Config, and Build tabs
   - ✅ Project scanning and management UI

4. **Wails Integration**
   - ✅ Project management bindings
   - ✅ Hugo version detection bindings
   - ✅ Error handling

## Phase 3: Build System ✅ COMPLETED

### Completed Tasks

1. **Build Service**
   - ✅ Hugo CLI execution wrapper
   - ✅ Build command execution with options
   - ✅ Build status tracking
   - ✅ Build log collection
   - ✅ Build history storage
   - ✅ Error handling
   - ✅ Support for build options (environment, draft, future, expired, minify, verbose)

2. **Build Management**
   - ✅ Concurrent build limiting (max 3 concurrent builds)
   - ✅ Build cancellation
   - ✅ Build queue support
   - ✅ Build progress tracking
   - ✅ Build artifacts info (file count)

3. **Frontend: Build UI**
   - ✅ BuildStatus component integrated in BuildTab
   - ✅ Build controls (start, cancel)
   - ✅ Build progress display with progress bar
   - ✅ Build logs display in real-time
   - ✅ Build history viewer
   - ✅ Build error display
   - ✅ Build options UI (environment, draft, future, expired, minify, verbose)

## Next Steps

Phase 4 will implement:
- Development server management
- Server start/stop controls
- Port management
- Server status monitoring

## License

Part of the Hugo project.
