import { useState, useEffect } from 'react';
import { GetProject, RefreshProject, GetBuildStatus } from '../../../wailsjs/go/handlers/App';
import { models } from '../../../wailsjs/go/models';
import { ErrorBoundary } from '../ErrorBoundary';
import OverviewTab from './tabs/OverviewTab';
import ConfigTab from './tabs/ConfigTab';
import FilesTab from './tabs/FilesTab';
import BuildTab from './tabs/BuildTab';
import ServerTab from './tabs/ServerTab';
import DeploymentTab from './tabs/DeploymentTab';
import ThemeBrowser from '../ThemeBrowser/ThemeBrowser';
import ThemeManager from '../ThemeManager/ThemeManager';
import ThemesTab from './tabs/ThemesTab';
import GitHubTab from './tabs/GitHubTab';
import ContentList from '../ContentList/ContentList';
import ContentWizard from '../ContentWizard/ContentWizard';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import LoadingSpinner from '../ui/LoadingSpinner';
import { useToast } from '../../hooks/useToast';

type Project = models.Project;

interface ProjectViewProps {
  projectId: string;
  onBack?: () => void;
}

type Tab = 'overview' | 'files' | 'content' | 'config' | 'build' | 'server' | 'deploy' | 'themes' | 'github';

export default function ProjectView({ projectId, onBack }: ProjectViewProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showContentWizard, setShowContentWizard] = useState(false);
  const [contentRefreshTrigger, setContentRefreshTrigger] = useState(0);
  const [lastBuildStatus, setLastBuildStatus] = useState<string | null>(null);
  const toast = useToast();

  const loadProject = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await GetProject(projectId);
      // Ensure project has required fields
      if (data) {
        // Ensure config exists
        if (!data.config) {
          data.config = models.Config.createFrom({});
        }
        // Ensure status exists
        if (!data.status) {
          data.status = models.Status.createFrom({});
        }
        // Ensure arrays exist
        if (!data.themes) {
          data.themes = [];
        }
        if (data.config) {
          if (!data.config.themes) {
            data.config.themes = [];
          }
          if (!data.config.languages) {
            data.config.languages = [];
          }
          if (!data.config.params) {
            data.config.params = {};
          }
        }
        setProject(data);
      } else {
        setError('Project data is null');
      }
    } catch (err: any) {
      console.error('Error loading project:', err);
      setError(err.message || 'Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!project) return;
    try {
      const refreshed = await RefreshProject(project.id);
      setProject(refreshed);
      toast.success('Project refreshed successfully');
    } catch (err: any) {
      toast.error(err.message || 'Failed to refresh project');
      setError(err.message || 'Failed to refresh project');
    }
  };

  useEffect(() => {
    if (projectId) {
      loadProject();
    }
  }, [projectId]);

  // Load build status to show last build result
  useEffect(() => {
    if (!project?.id || project.status?.isBuilding) {
      return;
    }

    const checkBuildStatus = async () => {
      try {
        const buildStatus = await GetBuildStatus(project.id);
        if (buildStatus.status === 'success' || buildStatus.status === 'failed') {
          setLastBuildStatus(buildStatus.status);
        } else {
          setLastBuildStatus(null);
        }
      } catch (err) {
        // Build status might not exist, that's okay
        setLastBuildStatus(null);
      }
    };

    checkBuildStatus();
  }, [project?.id, project?.status?.isBuilding, project?.lastBuild]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="p-6">
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
          {error || 'Project not found'}
        </div>
        {onBack && (
          <Button onClick={onBack} variant="secondary" className="mt-4">
            Back to Projects
          </Button>
        )}
      </div>
    );
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'files', label: 'Files' },
    { id: 'content', label: 'Content' },
    { id: 'config', label: 'Config' },
    { id: 'build', label: 'Build' },
    { id: 'server', label: 'Server' },
    { id: 'deploy', label: 'Deploy' },
    { id: 'themes', label: 'Themes' },
    { id: 'github', label: 'GitHub' },
  ];

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-hugo-text-tertiary">No project data available</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-hugo-bg-primary">
      {/* Status Indicators - moved below tabs */}
      <div className="border-b border-hugo-border-default py-1.5 bg-hugo-bg-secondary">
        <div className="flex gap-3 text-sm items-center flex-wrap" style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          <div className="flex items-center gap-2">
            <span className="text-hugo-text-tertiary">Server:</span>
            {project.status?.isServing ? (
              <Badge variant="success">Serving</Badge>
            ) : (
              <Badge variant="neutral">Idle</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-hugo-text-tertiary">Build:</span>
            {project.status?.isBuilding ? (
              <Badge variant="warning">Building</Badge>
            ) : lastBuildStatus === 'success' && project.lastBuild ? (
              <Badge variant="success" title={`Last build: ${new Date(project.lastBuild).toLocaleString()}`}>
                Success
              </Badge>
            ) : lastBuildStatus === 'failed' ? (
              <Badge variant="error">Failed</Badge>
            ) : project.lastBuild ? (
              <Badge variant="success" title={`Last build: ${new Date(project.lastBuild).toLocaleString()}`}>
                Success
              </Badge>
            ) : (
              <Badge variant="neutral">Idle</Badge>
            )}
          </div>
          {project.status?.hasErrors && (
            <div className="flex items-center gap-2">
              <span className="text-hugo-text-tertiary">Status:</span>
              <Badge variant="error">Error</Badge>
            </div>
          )}
          <div className="ml-auto flex gap-2">
            <Button onClick={handleRefresh} variant="secondary" size="sm">
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-hugo-border-default">
        <div className="flex gap-0" style={{ paddingLeft: '1.5rem', paddingRight: '1.5rem' }}>
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`${index === 0 ? 'pl-0' : 'pl-3'} pr-3 py-2 font-medium transition-colors ${
                activeTab === tab.id
                  ? 'border-b-2 border-hugo-accent-teal text-hugo-accent-teal'
                  : 'text-hugo-text-tertiary hover:text-hugo-text-secondary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'files' && project ? (
        <div className="flex-1 overflow-hidden bg-hugo-bg-primary">
          <FilesTab project={project} />
        </div>
      ) : activeTab === 'content' && project ? (
        <div className="flex-1 overflow-hidden bg-hugo-bg-primary">
          <ContentList 
            project={project} 
            refreshTrigger={contentRefreshTrigger}
            onNewContent={() => setShowContentWizard(true)}
          />
          {showContentWizard && (
            <ContentWizard
              project={project}
              onClose={() => setShowContentWizard(false)}
              onCreated={() => {
                setShowContentWizard(false);
                toast.success('Content created successfully');
                // Trigger ContentList refresh
                setContentRefreshTrigger(prev => prev + 1);
              }}
            />
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-6 bg-hugo-bg-primary">
          {activeTab === 'overview' && project && (
            <div className="min-h-full">
              <OverviewTab project={project} />
            </div>
          )}
          {activeTab === 'config' && project && (
            <div className="min-h-full">
              <ConfigTab project={project} />
            </div>
          )}
          {activeTab === 'build' && project && (
            <div className="min-h-full">
              <ErrorBoundary>
                <BuildTab project={project} onProjectUpdate={loadProject} />
              </ErrorBoundary>
            </div>
          )}
          {activeTab === 'server' && project && (
            <div className="min-h-full">
              <ErrorBoundary>
                <ServerTab project={project} onProjectUpdate={loadProject} />
              </ErrorBoundary>
            </div>
          )}
          {activeTab === 'deploy' && project && (
            <div className="min-h-full">
              <ErrorBoundary>
                <DeploymentTab project={project} onProjectUpdate={loadProject} />
              </ErrorBoundary>
            </div>
          )}
          {activeTab === 'themes' && project && (
            <div className="min-h-full">
              <ErrorBoundary>
                <ThemesTab project={project} onProjectUpdate={loadProject} />
              </ErrorBoundary>
            </div>
          )}
          {activeTab === 'github' && project && (
            <div className="min-h-full">
              <ErrorBoundary>
                <GitHubTab project={project} onProjectUpdate={loadProject} />
              </ErrorBoundary>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

