import { useState, useEffect } from 'react';
import { AddProject, SelectDirectory, GetProject, OpenInFileExplorer, CreateNewProject, GetBuildStatus, RefreshProject } from '../wailsjs/go/handlers/App';
import { models } from '../wailsjs/go/models';
import ProjectList from './components/ProjectList/ProjectList';
import ProjectView from './components/ProjectView/ProjectView';
import NewProjectDialog from './components/NewProjectDialog/NewProjectDialog';
import MultiSiteManager from './components/MultiSite/MultiSiteManager';
import Button from './components/ui/Button';
import Badge from './components/ui/Badge';
import LoadingSpinner from './components/ui/LoadingSpinner';
import ToastContainer from './components/ui/ToastContainer';
import { useToast } from './hooks/useToast';

type Project = models.Project;

type View = 'list' | 'project' | 'multisite';

// Navigation bar component for project view
function ProjectNavBar({ projectId, onHome }: { projectId: string; onHome: () => void }) {
  const [project, setProject] = useState<Project | null>(null);
  const toast = useToast();

  useEffect(() => {
    const loadProject = async () => {
      try {
        const data = await GetProject(projectId);
        setProject(data);
      } catch (err) {
        console.error('Failed to load project for nav bar:', err);
      }
    };
    loadProject();
  }, [projectId]);

  const handlePathClick = async () => {
    if (!project?.path) return;
    
    try {
      await OpenInFileExplorer(project.path);
    } catch (err: any) {
      toast.error(err.message || 'Failed to open file explorer');
    }
  };

  return (
    <header className="border-b border-hugo-border-default bg-hugo-bg-secondary px-4 py-1.5">
      <div className="flex items-center gap-2">
        <button
          onClick={onHome}
          className="flex items-center justify-center p-0 flex-shrink-0 hover:bg-hugo-bg-tertiary rounded transition-colors"
          title="Home"
        >
          <svg
            className="w-4 h-4 text-hugo-text-secondary hover:text-hugo-text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
        </button>
        <div className="h-3 w-px bg-hugo-border-default" />
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h1 className="text-base font-semibold text-hugo-text-primary truncate">
            {project?.name || 'Loading...'}
          </h1>
          <div className="h-3 w-px bg-hugo-border-default" />
          <button
            onClick={handlePathClick}
            className="text-xs text-hugo-text-tertiary truncate hover:text-hugo-text-secondary transition-colors cursor-pointer"
            title={`Open ${project?.path || ''} in file explorer`}
          >
            {project?.path || ''}
          </button>
        </div>
      </div>
    </header>
  );
}

function App() {
  const [view, setView] = useState<View>('list');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
  const [projectListRefresh, setProjectListRefresh] = useState(0);
  const toast = useToast();

  const handleProjectSelect = (project: Project) => {
    setSelectedProjectId(project.id);
    setView('project');
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedProjectId(null);
  };

  const handleAddProject = async () => {
    try {
      const path = await SelectDirectory('Select Hugo project directory');
      if (!path) return;

      // Extract project name from path
      const pathParts = path.split(/[/\\]/);
      const defaultName = pathParts[pathParts.length - 1] || 'Untitled Project';

      try {
        await AddProject(defaultName, path);
        toast.success(`Project "${defaultName}" added successfully`);
        setProjectListRefresh(prev => prev + 1);
      } catch (err: any) {
        toast.error(err.message || 'Failed to add project');
      }
    } catch (err: any) {
      // User cancelled or error occurred
      if (err.message && !err.message.includes('cancelled')) {
        toast.error(err.message || 'Failed to select directory');
      }
    }
  };

  const handleNewProjectCreated = () => {
    setProjectListRefresh(prev => prev + 1);
  };

  return (
    <div className="h-screen bg-hugo-bg-primary text-hugo-text-primary flex flex-col overflow-hidden">
      {/* Navigation bar - only show when on project view */}
      {view === 'project' && selectedProjectId && (
        <ProjectNavBar projectId={selectedProjectId} onHome={handleBackToList} />
      )}

      <main className="flex-1 overflow-hidden bg-hugo-bg-primary">
        {view === 'list' ? (
          <div className="h-full overflow-auto">
            <div className="max-w-7xl mx-auto px-6 py-6">
              {/* Header Section */}
              <div className="mb-6">
                <h1 className="text-4xl font-medium text-hugo-text-primary mb-2 tracking-tight uppercase" style={{ letterSpacing: '0.02em' }}>
                  Hugo Manager
                </h1>
                <p className="text-hugo-text-secondary text-sm mb-4">Manage your Hugo projects</p>
                <div className="flex items-center gap-3">
                  <Button onClick={() => setShowNewProjectDialog(true)} variant="primary" size="md">
                    Create New Project
                  </Button>
                  <Button onClick={handleAddProject} variant="secondary" size="md">
                    Add Existing Project
                  </Button>
                  <Button onClick={() => setView('multisite')} variant="secondary" size="md">
                    Multi-Site Operations
                  </Button>
                </div>
              </div>

              {/* Projects Section */}
              <div className="border-t border-hugo-border-default pt-6">
                <ProjectList onProjectSelect={handleProjectSelect} key={projectListRefresh} />
              </div>
            </div>
          </div>
        ) : view === 'multisite' ? (
          <div className="h-full overflow-auto">
            <div className="max-w-7xl mx-auto px-6 py-6">
              <div className="mb-4">
                <Button onClick={handleBackToList} variant="secondary" size="sm">
                  ← Back to Projects
                </Button>
              </div>
              <MultiSiteManager />
            </div>
          </div>
        ) : selectedProjectId ? (
          <div className="h-full">
            <ProjectView projectId={selectedProjectId} onBack={handleBackToList} />
          </div>
        ) : null}
      </main>

      {/* Toast notifications */}
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />

      {/* New Project Dialog */}
      {showNewProjectDialog && (
        <NewProjectDialog
          onClose={() => setShowNewProjectDialog(false)}
          onCreated={handleNewProjectCreated}
        />
      )}
    </div>
  );
}

export default App;
