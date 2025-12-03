import { useState, useEffect } from 'react';
import { 
  GetDeploymentsForProject, 
  CreateDeployment, 
  UpdateDeployment, 
  DeleteDeployment,
  Deploy,
  GetDeploymentHistory
} from '../../../../wailsjs/go/handlers/App';
import { models } from '../../../../wailsjs/go/models';
import type { Project } from '../../../types';
import { useToast } from '../../../hooks/useToast';
import Button from '../../ui/Button';
import Badge from '../../ui/Badge';
import Input from '../../ui/Input';
import Card from '../../ui/Card';
import LoadingSpinner from '../../ui/LoadingSpinner';
import EmptyState from '../../ui/EmptyState';

type Deployment = models.Deployment;
type DeploymentHistory = models.DeploymentHistory;
type DeploymentOptions = models.DeploymentOptions;

interface DeploymentTabProps {
  project: Project;
  onProjectUpdate?: () => void;
}

type DeploymentType = 'netlify' | 'vercel' | 'github-pages' | 'ftp' | 's3' | 'generic';

export default function DeploymentTab({ project, onProjectUpdate }: DeploymentTabProps) {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [deploymentHistory, setDeploymentHistory] = useState<DeploymentHistory[]>([]);
  const [deploying, setDeploying] = useState<string | null>(null);
  const toast = useToast();

  // Form state for creating/editing deployment
  const [deploymentType, setDeploymentType] = useState<DeploymentType>('netlify');
  const [config, setConfig] = useState<Record<string, string>>({});

  useEffect(() => {
    loadDeployments();
  }, [project.id]);

  const loadDeployments = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await GetDeploymentsForProject(project.id);
      setDeployments(data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load deployments');
      toast.error(err.message || 'Failed to load deployments');
    } finally {
      setLoading(false);
    }
  };

  const loadDeploymentHistory = async (deploymentId: string) => {
    try {
      const history = await GetDeploymentHistory(deploymentId, 10);
      setDeploymentHistory(history || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load deployment history');
    }
  };

  const handleCreateDeployment = async () => {
    try {
      const deployment = await CreateDeployment(project.id, deploymentType, config);
      toast.success('Deployment configuration created');
      setShowCreateDialog(false);
      setConfig({});
      loadDeployments();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create deployment');
    }
  };

  const handleDeleteDeployment = async (deploymentId: string) => {
    if (!confirm('Are you sure you want to delete this deployment configuration?')) {
      return;
    }
    try {
      await DeleteDeployment(deploymentId);
      toast.success('Deployment configuration deleted');
      loadDeployments();
      if (selectedDeployment?.id === deploymentId) {
        setSelectedDeployment(null);
        setDeploymentHistory([]);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete deployment');
    }
  };

  const handleDeploy = async (deployment: Deployment) => {
    setDeploying(deployment.id);
    try {
      const buildOptions = new models.BuildOptions({
        environment: 'production',
        draft: false,
        future: false,
        expired: false,
        minify: false,
        verbose: false,
        extraArgs: [],
      });
      
      const options = models.DeploymentOptions.createFrom({
        buildOptions: buildOptions,
        environment: 'production',
      });
      
      const history = await Deploy(deployment.id, options);
      toast.success(`Deployment ${history.status === 'success' ? 'succeeded' : 'failed'}`);
      loadDeploymentHistory(deployment.id);
      loadDeployments();
    } catch (err: any) {
      toast.error(err.message || 'Deployment failed');
    } finally {
      setDeploying(null);
    }
  };

  const getDeploymentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'netlify': 'Netlify',
      'vercel': 'Vercel',
      'github-pages': 'GitHub Pages',
      'ftp': 'FTP',
      's3': 'AWS S3',
      'generic': 'Generic',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'success' | 'error' | 'warning' | 'neutral'> = {
      'success': 'success',
      'failed': 'error',
      'pending': 'neutral',
      'building': 'warning',
      'deploying': 'warning',
    };
    return <Badge variant={variants[status] || 'neutral'}>{status}</Badge>;
  };

  const renderConfigFields = () => {
    switch (deploymentType) {
      case 'netlify':
        return (
          <>
            <Input
              label="API Token"
              type="password"
              value={config.apiToken || ''}
              onChange={(e) => setConfig({ ...config, apiToken: e.target.value })}
              placeholder="Enter Netlify API token"
            />
            <Input
              label="Site ID"
              value={config.siteId || ''}
              onChange={(e) => setConfig({ ...config, siteId: e.target.value })}
              placeholder="Enter Netlify site ID"
            />
          </>
        );
      case 'vercel':
        return (
          <>
            <Input
              label="API Token"
              type="password"
              value={config.apiToken || ''}
              onChange={(e) => setConfig({ ...config, apiToken: e.target.value })}
              placeholder="Enter Vercel API token"
            />
            <Input
              label="Project Name (optional)"
              value={config.projectName || ''}
              onChange={(e) => setConfig({ ...config, projectName: e.target.value })}
              placeholder="Enter project name"
            />
          </>
        );
      case 'github-pages':
        return (
          <>
            <Input
              label="Repository URL"
              value={config.repository || ''}
              onChange={(e) => setConfig({ ...config, repository: e.target.value })}
              placeholder="https://github.com/username/repo.git"
            />
            <Input
              label="Branch"
              value={config.branch || 'gh-pages'}
              onChange={(e) => setConfig({ ...config, branch: e.target.value })}
              placeholder="gh-pages"
            />
          </>
        );
      case 'generic':
        return (
          <div>
            <label className="block text-sm font-medium text-hugo-text-secondary mb-2">
              Deployment Script
            </label>
            <textarea
              className="w-full px-3 py-2 bg-hugo-bg-secondary border border-hugo-border-default rounded text-hugo-text-primary font-mono text-sm"
              rows={6}
              value={config.script || ''}
              onChange={(e) => setConfig({ ...config, script: e.target.value })}
              placeholder="Enter deployment script (bash/sh)"
            />
          </div>
        );
      default:
        return <p className="text-hugo-text-tertiary">Configuration fields for {deploymentType} coming soon</p>;
    }
  };

  if (loading && deployments.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-hugo-text-primary">Deployments</h2>
          <p className="text-sm text-hugo-text-tertiary mt-1">
            Configure and manage deployments for this project
          </p>
        </div>
        <Button
          onClick={() => setShowCreateDialog(true)}
          variant="primary"
        >
          + New Deployment
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200">
          {error}
        </div>
      )}

      {/* Deployments List */}
      {deployments.length === 0 ? (
        <EmptyState
          title="No deployments configured"
          description="Create a deployment configuration to deploy your site to various platforms"
          action={{
            label: "Create Deployment",
            onClick: () => setShowCreateDialog(true)
          }}
        />
      ) : (
        <div className="grid gap-4">
          {deployments.map((deployment) => (
            <Card key={deployment.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-hugo-text-primary">
                      {getDeploymentTypeLabel(deployment.type)}
                    </h3>
                    {getStatusBadge(deployment.status)}
                  </div>
                  <div className="text-sm text-hugo-text-tertiary space-y-1">
                    <div>ID: {deployment.id.substring(0, 8)}...</div>
                    <div>Created: {new Date(deployment.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setSelectedDeployment(deployment);
                      loadDeploymentHistory(deployment.id);
                    }}
                    variant="secondary"
                    size="sm"
                  >
                    View History
                  </Button>
                  <Button
                    onClick={() => handleDeploy(deployment)}
                    variant="primary"
                    size="sm"
                    disabled={deploying === deployment.id}
                  >
                    {deploying === deployment.id ? 'Deploying...' : 'Deploy'}
                  </Button>
                  <Button
                    onClick={() => handleDeleteDeployment(deployment.id)}
                    variant="danger"
                    size="sm"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Deployment History */}
      {selectedDeployment && deploymentHistory.length > 0 && (
        <Card className="p-4">
          <h3 className="text-lg font-semibold text-hugo-text-primary mb-4">
            Deployment History: {getDeploymentTypeLabel(selectedDeployment.type)}
          </h3>
          <div className="space-y-3">
            {deploymentHistory.map((history) => (
              <div key={history.id} className="border-b border-hugo-border-default pb-3 last:border-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getStatusBadge(history.status)}
                    {history.url && (
                      <a
                        href={history.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-hugo-accent-blue hover:underline text-sm"
                      >
                        {history.url}
                      </a>
                    )}
                  </div>
                  <div className="text-sm text-hugo-text-tertiary">
                    {new Date(history.createdAt).toLocaleString()}
                  </div>
                </div>
                {history.error && (
                  <div className="text-sm text-red-400 mt-2">{history.error}</div>
                )}
                <div className="text-xs text-hugo-text-tertiary mt-2">
                  Build: {history.buildTime}ms | Deploy: {history.deployTime}ms
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Create Deployment Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-hugo-text-primary mb-4">Create Deployment</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-hugo-text-secondary mb-2">
                  Deployment Type
                </label>
                <select
                  className="w-full px-3 py-2 bg-hugo-bg-secondary border border-hugo-border-default rounded text-hugo-text-primary"
                  value={deploymentType}
                  onChange={(e) => {
                    setDeploymentType(e.target.value as DeploymentType);
                    setConfig({});
                  }}
                >
                  <option value="netlify">Netlify</option>
                  <option value="vercel">Vercel</option>
                  <option value="github-pages">GitHub Pages</option>
                  <option value="generic">Generic (Custom Script)</option>
                </select>
              </div>

              {renderConfigFields()}

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  onClick={() => {
                    setShowCreateDialog(false);
                    setConfig({});
                  }}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateDeployment}
                  variant="primary"
                >
                  Create
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

