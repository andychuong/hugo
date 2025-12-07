import { useState, useEffect } from 'react';
import {
  SearchHugoProjects,
  CloneGitHubRepository,
  CheckIfHugoProject,
  SelectDirectory,
} from '../../../wailsjs/go/handlers/App';
import type { GitHubRepository, HugoProjectInfo } from '../../types';
import { useToast } from '../../hooks/useToast';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';

interface ImportFromGitHubDialogProps {
  onClose: () => void;
  onImported?: () => void;
}

export default function ImportFromGitHubDialog({
  onClose,
  onImported,
}: ImportFromGitHubDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepository | null>(null);
  const [hugoInfo, setHugoInfo] = useState<HugoProjectInfo | null>(null);
  const [cloning, setCloning] = useState(false);
  const toast = useToast();

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const results = await SearchHugoProjects(searchQuery.trim(), 20);
      setRepositories(results || []);
      if (results.length === 0) {
        toast.info('No Hugo projects found');
      }
    } catch (err: any) {
      console.error('Error searching Hugo projects:', err);
      setError(err.message || 'Failed to search Hugo projects');
      toast.error(err.message || 'Failed to search Hugo projects');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckHugoProject = async (repo: GitHubRepository) => {
    const parts = repo.fullName.split('/');
    if (parts.length !== 2) return;

    try {
      const info = await CheckIfHugoProject(parts[0], parts[1]);
      setHugoInfo(info);
      setSelectedRepo(repo);
    } catch (err: any) {
      console.error('Error checking Hugo project:', err);
      toast.error(err.message || 'Failed to check Hugo project');
    }
  };

  const handleClone = async () => {
    if (!selectedRepo) return;

    try {
      // Ask user to select target directory
      const targetDir = await SelectDirectory('Select directory to clone repository');
      if (!targetDir) return;

      setCloning(true);
      const cloneUrl = selectedRepo.cloneUrl || selectedRepo.sshUrl;
      if (!cloneUrl) {
        throw new Error('No clone URL available');
      }

      // Clone to a subdirectory with the repo name
      const repoName = selectedRepo.name;
      const fullPath = targetDir.endsWith(repoName)
        ? targetDir
        : `${targetDir}/${repoName}`;

      await CloneGitHubRepository(cloneUrl, fullPath);
      toast.success(`Repository cloned successfully to ${fullPath}`);
      if (onImported) {
        onImported();
      }
      onClose();
    } catch (err: any) {
      console.error('Error cloning repository:', err);
      toast.error(err.message || 'Failed to clone repository');
    } finally {
      setCloning(false);
    }
  };

  useEffect(() => {
    // Auto-search for popular Hugo projects on mount
    // Note: This will search for empty query which should return popular Hugo projects
    const autoSearch = async () => {
      setLoading(true);
      setError(null);
      try {
        const results = await SearchHugoProjects('', 20);
        setRepositories(results || []);
      } catch (err: any) {
        console.error('Error searching Hugo projects:', err);
        setError(err.message || 'Failed to search Hugo projects');
      } finally {
        setLoading(false);
      }
    };
    autoSearch();
  }, []);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-hugo-border-default">
          <h2 className="text-xl font-semibold">Import from GitHub</h2>
          <Button onClick={onClose} variant="secondary" size="sm">
            Close
          </Button>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Search */}
          <div className="p-6 border-b border-hugo-border-default">
            <div className="flex gap-2">
              <Input
                placeholder="Search for Hugo projects (e.g., 'blog', 'portfolio')..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                className="flex-1"
              />
              <Button onClick={handleSearch} variant="primary" disabled={loading}>
                {loading ? <LoadingSpinner size="sm" /> : 'Search'}
              </Button>
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-200 mb-4">
                {error}
              </div>
            )}

            {loading && repositories.length === 0 ? (
              <div className="flex items-center justify-center h-64">
                <LoadingSpinner />
              </div>
            ) : repositories.length === 0 ? (
              <EmptyState
                title="No repositories found"
                description="Try searching for Hugo projects or themes"
              />
            ) : (
              <div className="space-y-3">
                {repositories.map((repo) => (
                  <div
                    key={repo.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedRepo?.id === repo.id
                        ? 'border-hugo-accent-teal bg-hugo-accent-teal/10'
                        : 'border-hugo-border-default hover:border-hugo-border-hover'
                    }`}
                    onClick={() => handleCheckHugoProject(repo)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold text-hugo-text-primary">
                            {repo.fullName}
                          </h3>
                          {repo.isHugoProject && (
                            <Badge variant="success">Hugo Project</Badge>
                          )}
                          {repo.isPrivate && (
                            <Badge variant="info">Private</Badge>
                          )}
                        </div>
                        {repo.description && (
                          <p className="text-sm text-hugo-text-secondary mb-2">
                            {repo.description}
                          </p>
                        )}
                        {repo.hugoInfo && (
                          <div className="flex flex-wrap gap-2 mb-2">
                            <Badge variant="success">
                              Confidence: {repo.hugoInfo.confidence}%
                            </Badge>
                            {repo.hugoInfo.configFiles.length > 0 && (
                              <Badge variant="info">
                                {repo.hugoInfo.configFiles.length} config file(s)
                              </Badge>
                            )}
                            {repo.hugoInfo.hasContentDir && (
                              <Badge variant="info">Content</Badge>
                            )}
                            {repo.hugoInfo.hasThemesDir && (
                              <Badge variant="info">Themes</Badge>
                            )}
                          </div>
                        )}
                        <div className="flex items-center gap-4 text-xs text-hugo-text-tertiary">
                          <span>⭐ {repo.stars}</span>
                          <span>🍴 {repo.forks}</span>
                          {repo.language && <span>{repo.language}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selected Repository Info */}
          {selectedRepo && hugoInfo && (
            <div className="p-6 border-t border-hugo-border-default bg-hugo-bg-secondary">
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Selected: {selectedRepo.fullName}</h3>
                  {hugoInfo.reasons.length > 0 && (
                    <div className="text-sm text-hugo-text-secondary">
                      <strong>Detection reasons:</strong>
                      <ul className="list-disc list-inside mt-1">
                        {hugoInfo.reasons.map((reason, idx) => (
                          <li key={idx}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleClone}
                    variant="primary"
                    disabled={cloning}
                    className="flex-1"
                  >
                    {cloning ? (
                      <>
                        <LoadingSpinner size="sm" className="mr-2" />
                        Cloning...
                      </>
                    ) : (
                      'Clone Repository'
                    )}
                  </Button>
                  <Button onClick={onClose} variant="secondary">
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

