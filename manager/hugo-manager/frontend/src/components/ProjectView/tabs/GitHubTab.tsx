import { useState, useEffect } from 'react';
import {
  GetGitStatus,
  GetGitConfig,
  GetBranches,
  StageFiles,
  CommitChanges,
  PushToGitHub,
  PullFromGitHub,
  InitializeGitRepository,
  LinkProjectToGitHub,
  GetGitHubRepositories,
  GetCommitHistory,
} from '../../../../wailsjs/go/handlers/App';
import type { Project, GitStatus, GitConfig, GitBranch, GitCommit } from '../../../types';
import { useToast } from '../../../hooks/useToast';
import Button from '../../ui/Button';
import Badge from '../../ui/Badge';
import Input from '../../ui/Input';
import Card from '../../ui/Card';
import LoadingSpinner from '../../ui/LoadingSpinner';
import EmptyState from '../../ui/EmptyState';

interface GitHubTabProps {
  project: Project;
  onProjectUpdate?: () => void;
}

// Helper function to format time ago
const formatTimeAgo = (date: Date): string => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
};

export default function GitHubTab({ project, onProjectUpdate }: GitHubTabProps) {
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [gitConfig, setGitConfig] = useState<GitConfig | null>(null);
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [repositories, setRepositories] = useState<any[]>([]);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commitMessage, setCommitMessage] = useState('');
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [committing, setCommitting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [lastCommit, setLastCommit] = useState<{ message: string; files: string[]; time: Date } | null>(null);
  const [lastPush, setLastPush] = useState<{ branch: string; time: Date } | null>(null);
  const toast = useToast();

  useEffect(() => {
    loadGitInfo();
  }, [project.id]);

  const loadGitInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const [status, config, branchList, commitHistory] = await Promise.all([
        GetGitStatus(project.id).catch(() => null),
        GetGitConfig(project.id).catch(() => null),
        GetBranches(project.id).catch(() => []),
        GetCommitHistory(project.id, 20).catch(() => []),
      ]);

      if (status) {
        setGitStatus({
          modifiedFiles: status.modifiedFiles || [],
          stagedFiles: status.stagedFiles || [],
          untrackedFiles: status.untrackedFiles || [],
          currentBranch: status.currentBranch || '',
          hasChanges: status.hasChanges || false,
          isClean: status.isClean || false,
          commitsAhead: status.commitsAhead || 0,
          commitsBehind: status.commitsBehind || 0,
        });
      } else {
        // If status is null, set empty status to keep UI visible
        setGitStatus({
          modifiedFiles: [],
          stagedFiles: [],
          untrackedFiles: [],
          currentBranch: '',
          hasChanges: false,
          isClean: true,
          commitsAhead: 0,
          commitsBehind: 0,
        });
      }

      if (config) {
        setGitConfig({
          userName: config.userName || '',
          userEmail: config.userEmail || '',
          remoteUrl: config.remoteUrl || '',
          credentialHelper: config.credentialHelper || '',
          isGitRepo: config.isGitRepo || false,
        });
      } else {
        // If config is null, set default to keep UI visible
        setGitConfig({
          userName: '',
          userEmail: '',
          remoteUrl: '',
          credentialHelper: '',
          isGitRepo: false,
        });
      }

      setBranches(branchList || []);
      setCommits(commitHistory || []);
    } catch (err: any) {
      console.error('Error loading git info:', err);
      setError(err.message || 'Failed to load git information');
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeGit = async () => {
    try {
      await InitializeGitRepository(project.id);
      toast.success('Git repository initialized');
      loadGitInfo();
      if (onProjectUpdate) onProjectUpdate();
    } catch (err: any) {
      toast.error(err.message || 'Failed to initialize git repository');
    }
  };

  const handleLinkRepository = async () => {
    if (!repoUrl.trim()) {
      toast.error('Please enter a repository URL');
      return;
    }

    try {
      await LinkProjectToGitHub(project.id, repoUrl.trim());
      toast.success('Repository linked successfully');
      setShowLinkDialog(false);
      setRepoUrl('');
      loadGitInfo();
      if (onProjectUpdate) onProjectUpdate();
    } catch (err: any) {
      toast.error(err.message || 'Failed to link repository');
    }
  };

  const handleStageFiles = async (files: string[]) => {
    try {
      console.log('Staging files:', files);
      await StageFiles(project.id, files);
      console.log('Files staged successfully');
      toast.success(`Staged ${files.length} file(s)`);
      await loadGitInfo(); // Wait for git info to refresh
    } catch (err: any) {
      console.error('Stage error:', err);
      toast.error(err.message || 'Failed to stage files');
    }
  };

  const handleCommit = async () => {
    if (!commitMessage.trim()) {
      toast.error('Please enter a commit message');
      return;
    }

    setCommitting(true);
    try {
      // Refresh git status first to ensure we have the latest state
      const freshStatus = await GetGitStatus(project.id);
      
      // Check if there are actually staged files
      if (!freshStatus || freshStatus.stagedFiles.length === 0) {
        toast.error('No staged files to commit. Please stage files first by selecting them and clicking "Stage Selected".');
        await loadGitInfo(); // Refresh UI
        setCommitting(false);
        return;
      }

      // Store the files that were staged before commit
      const committedFiles = [...freshStatus.stagedFiles];
      
      console.log('Committing changes:', { projectId: project.id, message: commitMessage.trim(), stagedFiles: committedFiles });
      await CommitChanges(project.id, commitMessage.trim());
      console.log('Commit successful');
      
      // Show success message with committed files
      const fileList = committedFiles.length <= 3 
        ? committedFiles.join(', ')
        : `${committedFiles.slice(0, 3).join(', ')} and ${committedFiles.length - 3} more`;
      
      toast.success(`Committed ${committedFiles.length} file(s): ${fileList}`);
      
      // Store last commit info for display
      setLastCommit({
        message: commitMessage.trim(),
        files: committedFiles,
        time: new Date()
      });
      
      setCommitMessage('');
      setSelectedFiles(new Set()); // Clear selected files
      await loadGitInfo(); // Wait for git status to refresh
      if (onProjectUpdate) onProjectUpdate();
    } catch (err: any) {
      console.error('Commit error:', err);
      let errorMessage = err?.message || err?.toString() || 'Failed to commit changes';
      
      // Provide helpful error messages for common git issues
      if (errorMessage.includes('no changes added to commit') || errorMessage.includes('nothing to commit')) {
        errorMessage = 'No staged files to commit. Please stage files first by selecting them and clicking "Stage Selected".';
        // Refresh to show current state
        await loadGitInfo();
      } else if (errorMessage.includes('user.name') || errorMessage.includes('user.email') || errorMessage.includes('Please tell me who you are')) {
        errorMessage = 'Git user name and email not configured. Please run:\n' +
          'git config --global user.name "Your Name"\n' +
          'git config --global user.email "your.email@example.com"';
      }
      
      toast.error(errorMessage);
      // Still refresh to show current state even if commit failed
      await loadGitInfo();
    } finally {
      setCommitting(false);
    }
  };

  const handlePush = async () => {
    if (!gitStatus?.currentBranch) {
      toast.error('No branch selected');
      return;
    }

    setPushing(true);
    console.log('Pushing to GitHub:', { projectId: project.id, branch: gitStatus.currentBranch });
    
    try {
      await PushToGitHub(project.id, 'origin', gitStatus.currentBranch);
      console.log('Push successful');
      toast.success(`Pushed ${gitStatus.currentBranch} to GitHub successfully`);
      
      // Store last push info for display
      setLastPush({
        branch: gitStatus.currentBranch,
        time: new Date()
      });
      
      await loadGitInfo();
    } catch (err: any) {
      console.error('Push error:', err);
      let errorMessage = err?.message || err?.toString() || 'Failed to push to GitHub';
      
      // Provide helpful error messages for common push issues
      if (errorMessage.includes('failed to push') || errorMessage.includes('rejected')) {
        errorMessage = 'Push rejected. You may need to pull changes first or check your permissions.';
      } else if (errorMessage.includes('authentication') || errorMessage.includes('credentials')) {
        errorMessage = 'Authentication failed. Please check your Git credentials.';
      } else if (errorMessage.includes('no upstream') || errorMessage.includes('upstream branch')) {
        errorMessage = `No upstream branch set. Run: git push --set-upstream origin ${gitStatus.currentBranch}`;
      }
      
      toast.error(errorMessage);
    } finally {
      setPushing(false);
    }
  };

  const handlePull = async () => {
    if (!gitStatus?.currentBranch) {
      toast.error('No branch selected');
      return;
    }

    setPulling(true);
    console.log('Pulling from GitHub:', { projectId: project.id, branch: gitStatus.currentBranch });
    
    try {
      await PullFromGitHub(project.id, 'origin', gitStatus.currentBranch);
      console.log('Pull successful');
      toast.success(`Pulled ${gitStatus.currentBranch} from GitHub successfully`);
      await loadGitInfo();
      if (onProjectUpdate) onProjectUpdate();
    } catch (err: any) {
      console.error('Pull error:', err);
      let errorMessage = err?.message || err?.toString() || 'Failed to pull from GitHub';
      
      // Provide helpful error messages for common pull issues
      if (errorMessage.includes('conflict')) {
        errorMessage = 'Pull failed due to conflicts. Please resolve conflicts manually.';
      } else if (errorMessage.includes('authentication') || errorMessage.includes('credentials')) {
        errorMessage = 'Authentication failed. Please check your Git credentials.';
      } else if (errorMessage.includes('uncommitted changes') || errorMessage.includes('would be overwritten')) {
        errorMessage = 'You have uncommitted changes. Please commit or stash them first.';
      }
      
      toast.error(errorMessage);
    } finally {
      setPulling(false);
    }
  };

  const toggleFileSelection = (file: string) => {
    const newSelection = new Set(selectedFiles);
    if (newSelection.has(file)) {
      newSelection.delete(file);
    } else {
      newSelection.add(file);
    }
    setSelectedFiles(newSelection);
  };

  const getAllSelectableFiles = (): string[] => {
    if (!gitStatus) return [];
    return [...gitStatus.modifiedFiles, ...gitStatus.untrackedFiles];
  };

  const handleSelectAll = () => {
    const allFiles = getAllSelectableFiles();
    setSelectedFiles(new Set(allFiles));
  };

  const handleDeselectAll = () => {
    setSelectedFiles(new Set());
  };

  const isAllSelected = (): boolean => {
    const allFiles = getAllSelectableFiles();
    return allFiles.length > 0 && allFiles.every(file => selectedFiles.has(file));
  };

  const stageSelectedFiles = async () => {
    if (selectedFiles.size === 0) {
      toast.error('Please select files to stage');
      return;
    }
    await handleStageFiles(Array.from(selectedFiles));
    setSelectedFiles(new Set());
  };

  if (loading && !gitStatus && !gitConfig) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && !gitConfig?.isGitRepo) {
    return (
      <div className="p-6">
        <EmptyState
          title="Git Repository Not Initialized"
          description="This project is not a git repository. Initialize it to start using GitHub integration."
          action={{
            label: "Initialize Git Repository",
            onClick: handleInitializeGit
          }}
        />
      </div>
    );
  }

  const totalChanges = (gitStatus?.modifiedFiles.length || 0) + 
                      (gitStatus?.stagedFiles.length || 0) + 
                      (gitStatus?.untrackedFiles.length || 0);

  return (
    <div className="h-full flex flex-col bg-hugo-bg-primary">
      {/* Header Bar */}
      <div className="border-b border-hugo-border-default bg-hugo-bg-secondary px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {gitConfig?.isGitRepo && gitStatus?.currentBranch && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-hugo-text-tertiary">Branch:</span>
                  <Badge variant="success" className="font-mono text-xs px-2 py-1">
                    {gitStatus.currentBranch}
                  </Badge>
                </div>
                {gitConfig.remoteUrl && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-hugo-text-tertiary">Remote:</span>
                    <span className="text-sm text-hugo-text-secondary font-mono">
                      {gitConfig.remoteUrl.replace('https://github.com/', '').replace('.git', '')}
                    </span>
                  </div>
                )}
                {/* Sync Status - VS Code style */}
                {(gitStatus.commitsAhead > 0 || gitStatus.commitsBehind > 0) && (
                  <div className="flex items-center gap-1">
                    {gitStatus.commitsAhead > 0 && (
                      <Badge variant="warning" className="flex items-center gap-1 px-2 py-1">
                        <span className="text-xs">↑{gitStatus.commitsAhead}</span>
                      </Badge>
                    )}
                    {gitStatus.commitsBehind > 0 && (
                      <Badge variant="info" className="flex items-center gap-1 px-2 py-1">
                        <span className="text-xs">↓{gitStatus.commitsBehind}</span>
                      </Badge>
                    )}
                  </div>
                )}
              </>
            )}
            {totalChanges > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-hugo-text-tertiary">Changes:</span>
                <Badge variant="warning">{totalChanges}</Badge>
              </div>
            )}
          </div>
          <Button onClick={loadGitInfo} variant="secondary" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Left Panel: Changes */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden border-r border-hugo-border-default min-w-0">
          {!gitConfig?.isGitRepo ? (
            <div className="p-6">
              <EmptyState
                title="Git Repository Not Initialized"
                description="Initialize a git repository to start tracking changes and syncing with GitHub."
                action={{
                  label: "Initialize Git Repository",
                  onClick: handleInitializeGit
                }}
              />
            </div>
          ) : !gitConfig.remoteUrl ? (
            <div className="p-6">
              <Card>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Link to GitHub</h3>
                  <p className="text-sm text-hugo-text-secondary">
                    Link this repository to a GitHub remote to enable push and pull operations.
                  </p>
                  <Button
                    onClick={() => setShowLinkDialog(true)}
                    variant="primary"
                  >
                    Link Repository
                  </Button>
                </div>
              </Card>
            </div>
          ) : gitStatus && gitStatus.isClean ? (
            <div className="p-6 space-y-4">
              <div className="flex flex-col items-center justify-center py-12">
                <div className="text-4xl mb-4">✓</div>
                <h3 className="text-lg font-semibold text-hugo-text-primary mb-2">
                  Working directory is clean
                </h3>
                <p className="text-sm text-hugo-text-secondary">
                  No uncommitted changes
                </p>
              </div>
              
              {/* Recent Activity */}
              {(lastCommit || lastPush) && (
                <Card className="bg-green-500/5 border-green-500/20">
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-green-400 flex items-center gap-2">
                      <span>✓</span>
                      Recent Activity
                    </h4>
                    
                    {lastCommit && (
                      <div className="text-xs space-y-1">
                        <div className="flex items-start gap-2">
                          <span className="text-green-400 flex-shrink-0">●</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-hugo-text-primary font-medium">
                              Committed: {lastCommit.message}
                            </div>
                            <div className="text-hugo-text-tertiary">
                              {lastCommit.files.length} file(s) • {formatTimeAgo(lastCommit.time)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {lastPush && (
                      <div className="text-xs space-y-1">
                        <div className="flex items-start gap-2">
                          <span className="text-green-400 flex-shrink-0">●</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-hugo-text-primary font-medium">
                              Pushed to {lastPush.branch}
                            </div>
                            <div className="text-hugo-text-tertiary">
                              {formatTimeAgo(lastPush.time)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </div>
          ) : gitStatus ? (
            <div className="p-4 space-y-4 overflow-x-auto">
              {/* Select All Controls */}
              {getAllSelectableFiles().length > 0 && (
                <div className="flex items-center justify-between px-3 py-2 bg-hugo-bg-secondary rounded-lg border border-hugo-border-default">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={isAllSelected()}
                      onChange={(e) => {
                        if (e.target.checked) {
                          handleSelectAll();
                        } else {
                          handleDeselectAll();
                        }
                      }}
                      className="rounded w-4 h-4"
                    />
                    <span className="text-sm font-medium text-hugo-text-primary">
                      {isAllSelected() ? 'Deselect All' : 'Select All'}
                    </span>
                    <span className="text-xs text-hugo-text-tertiary">
                      ({selectedFiles.size} of {getAllSelectableFiles().length} selected)
                    </span>
                  </div>
                  {selectedFiles.size > 0 && (
                    <Button
                      onClick={stageSelectedFiles}
                      variant="primary"
                      size="sm"
                    >
                      Stage Selected
                    </Button>
                  )}
                </div>
              )}

              {/* Staged Changes */}
              {gitStatus && gitStatus.stagedFiles.length > 0 && (
                <Card>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-hugo-text-primary flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        Staged Changes ({gitStatus.stagedFiles.length})
                      </h4>
                    </div>
                    <div className="space-y-1 min-w-0">
                      {gitStatus.stagedFiles.map((file) => (
                        <div
                          key={file}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-hugo-bg-secondary rounded text-sm min-w-0"
                        >
                          <span className="text-green-500 flex-shrink-0">●</span>
                          <span className="text-hugo-text-primary flex-1 font-mono text-xs overflow-x-auto whitespace-nowrap min-w-0 text-left" title={file} style={{ scrollbarWidth: 'thin' }}>
                            {file}
                          </span>
                          <Badge variant="success" className="flex-shrink-0 ml-2">Staged</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}

              {/* Unstaged Changes */}
              {gitStatus && (gitStatus.modifiedFiles.length > 0 || gitStatus.untrackedFiles.length > 0) && (
                <Card>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-hugo-text-primary flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                        Unstaged Changes ({gitStatus.modifiedFiles.length + gitStatus.untrackedFiles.length})
                      </h4>
                    </div>
                    <div className="space-y-1 min-w-0">
                      {/* Modified Files */}
                      {gitStatus.modifiedFiles.map((file) => (
                        <div
                          key={file}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-hugo-bg-secondary rounded text-sm cursor-pointer min-w-0"
                          onClick={() => toggleFileSelection(file)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedFiles.has(file)}
                            onChange={() => toggleFileSelection(file)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded w-4 h-4 flex-shrink-0"
                          />
                          <span className="text-yellow-500 flex-shrink-0">●</span>
                          <span className="text-hugo-text-primary flex-1 font-mono text-xs overflow-x-auto whitespace-nowrap min-w-0 text-left" title={file} style={{ scrollbarWidth: 'thin' }}>
                            {file}
                          </span>
                          <Badge variant="warning" className="flex-shrink-0 ml-2">Modified</Badge>
                        </div>
                      ))}
                      {/* Untracked Files */}
                      {gitStatus.untrackedFiles.map((file) => (
                        <div
                          key={file}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-hugo-bg-secondary rounded text-sm cursor-pointer min-w-0"
                          onClick={() => toggleFileSelection(file)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedFiles.has(file)}
                            onChange={() => toggleFileSelection(file)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded w-4 h-4 flex-shrink-0"
                          />
                          <span className="text-blue-500 flex-shrink-0">●</span>
                          <span className="text-hugo-text-primary flex-1 font-mono text-xs overflow-x-auto whitespace-nowrap min-w-0 text-left" title={file} style={{ scrollbarWidth: 'thin' }}>
                            {file}
                          </span>
                          <Badge variant="info" className="flex-shrink-0 ml-2">New</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}
            </div>
          ) : null}
        </div>

        {/* Right Panel: Commit & Push */}
        <div className="w-80 border-l border-hugo-border-default bg-hugo-bg-secondary flex flex-col">
          {gitConfig?.isGitRepo ? (
            <div className="p-4 space-y-4 h-full flex flex-col">
              {/* Recent Activity - Show at top of right panel */}
              {(lastCommit || lastPush) && (
                <Card className="bg-green-500/5 border-green-500/20">
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-green-400 flex items-center gap-2">
                      <span>✓</span>
                      Recent Activity
                    </h4>
                    
                    {lastCommit && (
                      <div className="text-xs space-y-1">
                        <div className="flex items-start gap-2">
                          <span className="text-green-400 flex-shrink-0">●</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-hugo-text-primary font-medium">
                              Committed: {lastCommit.message}
                            </div>
                            <div className="text-hugo-text-tertiary">
                              {lastCommit.files.length} file(s) • {formatTimeAgo(lastCommit.time)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {lastPush && (
                      <div className="text-xs space-y-1">
                        <div className="flex items-start gap-2">
                          <span className="text-green-400 flex-shrink-0">●</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-hugo-text-primary font-medium">
                              Pushed to {lastPush.branch}
                            </div>
                            <div className="text-hugo-text-tertiary">
                              {formatTimeAgo(lastPush.time)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}
              
              {/* Repository Info */}
              <Card>
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-hugo-text-primary">Repository</h3>
                  <div className="space-y-2 text-xs">
                    {gitConfig.remoteUrl && (
                      <div>
                        <span className="text-hugo-text-tertiary">Remote:</span>
                        <div className="text-hugo-text-secondary font-mono mt-1 break-all">
                          {gitConfig.remoteUrl}
                        </div>
                      </div>
                    )}
                    {gitConfig.userName && (
                      <div>
                        <span className="text-hugo-text-tertiary">User:</span>
                        <div className="text-hugo-text-secondary mt-1">
                          {gitConfig.userName}
                          {gitConfig.userEmail && (
                            <span className="text-hugo-text-tertiary"> ({gitConfig.userEmail})</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              {/* Commit Section */}
              {gitStatus && gitStatus.stagedFiles.length > 0 && (
                <Card>
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-hugo-text-primary">Commit</h3>
                    <div className="space-y-2">
                      <textarea
                        placeholder="Enter commit message..."
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-hugo-bg-primary border border-hugo-border-default rounded text-hugo-text-primary placeholder-hugo-text-tertiary focus:outline-none focus:ring-2 focus:ring-hugo-accent-teal resize-none"
                        rows={4}
                      />
                      <Button
                        onClick={handleCommit}
                        variant="primary"
                        disabled={!commitMessage.trim() || committing}
                        isLoading={committing}
                        className="w-full"
                      >
                        {committing ? 'Committing...' : `Commit ${gitStatus.stagedFiles.length} file${gitStatus.stagedFiles.length !== 1 ? 's' : ''}`}
                      </Button>
                    </div>
                  </div>
                </Card>
              )}

              {/* Push & Pull Section */}
              {gitConfig.remoteUrl && gitStatus && gitStatus.currentBranch && (
                <Card className="flex-1 flex flex-col">
                  <div className="space-y-3 flex-1 flex flex-col">
                    <h3 className="text-sm font-semibold text-hugo-text-primary">Sync</h3>
                    
                    {/* Sync Status */}
                    {(gitStatus.commitsAhead > 0 || gitStatus.commitsBehind > 0) && (
                      <div className="flex items-center gap-2 text-xs">
                        {gitStatus.commitsAhead > 0 && (
                          <Badge variant="warning" className="flex items-center gap-1">
                            <span>↑ {gitStatus.commitsAhead}</span>
                          </Badge>
                        )}
                        {gitStatus.commitsBehind > 0 && (
                          <Badge variant="info" className="flex items-center gap-1">
                            <span>↓ {gitStatus.commitsBehind}</span>
                          </Badge>
                        )}
                        <span className="text-hugo-text-tertiary">
                          {gitStatus.commitsAhead > 0 && gitStatus.commitsBehind > 0
                            ? 'Changes to push and pull'
                            : gitStatus.commitsAhead > 0
                            ? 'Changes to push'
                            : 'Changes to pull'}
                        </span>
                      </div>
                    )}
                    
                    <div className="space-y-2 flex-1">
                      {/* Show hint if there are staged changes that need to be committed */}
                      {gitStatus.stagedFiles.length > 0 && gitStatus.commitsAhead === 0 && (
                        <div className="text-xs text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded px-2 py-1.5">
                          💡 Commit your staged changes before pushing
                        </div>
                      )}
                      
                      <Button
                        onClick={handlePush}
                        variant="primary"
                        disabled={!gitStatus.currentBranch || pushing || pulling}
                        className="w-full"
                      >
                        {pushing ? 'Pushing...' : `PUSH${gitStatus.commitsAhead > 0 ? ` (${gitStatus.commitsAhead})` : ''}`}
                      </Button>
                      <Button
                        onClick={handlePull}
                        variant="secondary"
                        disabled={!gitStatus.currentBranch || pushing || pulling}
                        className="w-full"
                      >
                        {pulling ? 'Pulling...' : `PULL${gitStatus.commitsBehind > 0 ? ` (${gitStatus.commitsBehind})` : ''}`}
                      </Button>
                    </div>
                    {gitStatus.currentBranch && (
                      <div className="pt-3 border-t border-hugo-border-default">
                        <div className="text-xs text-hugo-text-tertiary">
                          Branch: <span className="text-hugo-text-secondary font-mono">{gitStatus.currentBranch}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* Commit History */}
              {commits.length > 0 && (
                <Card>
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-hugo-text-primary">Recent Commits</h3>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                      {commits.map((commit) => (
                        <div
                          key={commit.hash}
                          className="border-l-2 border-hugo-border-default pl-3 py-2 hover:border-blue-500 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className="text-xs text-hugo-text-primary font-medium line-clamp-2">
                              {commit.message}
                            </p>
                            <code className="text-xs text-hugo-text-tertiary font-mono flex-shrink-0">
                              {commit.shortHash}
                            </code>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-hugo-text-tertiary">
                            <span>{commit.author}</span>
                            <span>•</span>
                            <span>{formatTimeAgo(new Date(commit.date))}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}

              {/* Branches */}
              {branches.length > 0 && (
                <Card>
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-hugo-text-primary">Branches</h3>
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {branches.map((branch, index) => (
                        <div
                          key={`${branch.name}-${branch.isRemote ? 'remote' : 'local'}-${index}`}
                          className="flex items-center justify-between px-2 py-1.5 hover:bg-hugo-bg-primary rounded text-xs"
                        >
                          <span className="text-hugo-text-secondary font-mono">{branch.name}</span>
                          <div className="flex items-center gap-1">
                            {branch.isCurrent && <Badge variant="success">Current</Badge>}
                            {branch.isRemote && <Badge variant="info">Remote</Badge>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )}
            </div>
          ) : (
            <div className="p-6">
              <EmptyState
                title="No Git Repository"
                description="Initialize a git repository to start using version control."
                action={{
                  label: "Initialize Repository",
                  onClick: handleInitializeGit
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Link Repository Dialog */}
      {showLinkDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Link to GitHub Repository</h3>
              <Input
                placeholder="https://github.com/username/repo.git"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
              />
              <div className="flex gap-2 justify-end">
                <Button
                  onClick={() => {
                    setShowLinkDialog(false);
                    setRepoUrl('');
                  }}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button onClick={handleLinkRepository} variant="primary">
                  Link
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
