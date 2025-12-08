import { useState, useEffect, useRef } from 'react';
import { BuildProject, GetBuildStatus, GetBuildLogs, CancelBuild, GetBuildHistory } from '../../../../wailsjs/go/handlers/App';
import { models, services } from '../../../../wailsjs/go/models';
import type { Project } from '../../../types';
import { useToast } from '../../../hooks/useToast';
import Badge from '../../ui/Badge';

type BuildStatusResponse = services.BuildStatusResponse;
type Build = models.Build;
type BuildOptions = models.BuildOptions;

interface BuildTabProps {
  project: Project;
  onProjectUpdate?: () => void;
}

export default function BuildTab({ project, onProjectUpdate }: BuildTabProps) {
  const [buildStatus, setBuildStatus] = useState<BuildStatusResponse | null>(null);
  const [buildLogs, setBuildLogs] = useState<string[]>([]);
  const [buildHistory, setBuildHistory] = useState<Build[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [lastSuccessfulBuild, setLastSuccessfulBuild] = useState<Date | null>(null);
  const [showSuccessAnimation, setShowSuccessAnimation] = useState(false);
  const [expandedBuildId, setExpandedBuildId] = useState<string | null>(null);
  const previousBuildStatusRef = useRef<string | null>(null);
  const toast = useToast();
  const [buildOptions, setBuildOptions] = useState<BuildOptions>(() => {
    return new models.BuildOptions({
      environment: 'production',
      draft: false,
      future: false,
      expired: false,
      minify: false,
      verbose: false,
      extraArgs: [],
    });
  });

  // Poll build status when building
  useEffect(() => {
    if (!project.status?.isBuilding) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const status = await GetBuildStatus(project.id);
        const previousStatus = previousBuildStatusRef.current;
        previousBuildStatusRef.current = status.status;
        
        setBuildStatus(status);
        
        // Fetch logs
        const logs = await GetBuildLogs(project.id, 100);
        setBuildLogs(logs);

        // If build finished, refresh project and history
        if (status.status !== 'running') {
          clearInterval(interval);
          
          // Check if build just completed successfully
          if (status.status === 'success' && previousStatus === 'running') {
            setLastSuccessfulBuild(new Date());
            setShowSuccessAnimation(true);
            toast.success('Build completed successfully!');
            
            // Hide animation after 3 seconds
            setTimeout(() => setShowSuccessAnimation(false), 3000);
          } else if (status.status === 'failed' && previousStatus === 'running') {
            toast.error('Build failed');
          }
          
          // Refresh project and history
          if (onProjectUpdate) {
            onProjectUpdate();
          }
          loadBuildHistory();
          loadBuildStatus(); // Refresh status one more time
        }
      } catch (err: any) {
        console.error('Failed to get build status:', err);
      }
    }, 500); // Poll every 500ms for faster updates

    return () => clearInterval(interval);
  }, [project.id, project.status?.isBuilding, toast, onProjectUpdate]);

  // Load initial build status and history
  useEffect(() => {
    // Only load if project is valid
    if (project?.id) {
      loadBuildStatus().catch(err => {
        console.error('Error loading build status:', err);
      });
      loadBuildHistory().catch(err => {
        console.error('Error loading build history:', err);
      });
    }
  }, [project.id]);

  const loadBuildStatus = async () => {
    try {
      const status = await GetBuildStatus(project.id);
      setBuildStatus(status);
      
      const logs = await GetBuildLogs(project.id, 100);
      setBuildLogs(logs);
    } catch (err: any) {
      // Build status might not exist yet, that's okay
      const errorCode = err?.code || err?.Code || '';
      if (errorCode !== 'BUILD_NOT_FOUND') {
        console.error('Failed to load build status:', err);
      }
      // Don't set error state for missing build status
    }
  };

  const loadBuildHistory = async () => {
    try {
      const history = await GetBuildHistory(project.id, 10);
      // Ensure we always set an array, even if the API returns null/undefined
      setBuildHistory(Array.isArray(history) ? history : []);
    } catch (err: any) {
      console.error('Failed to load build history:', err);
      // Set empty array on error to prevent null issues
      setBuildHistory([]);
    }
  };

  const handleBuild = async () => {
    setIsLoading(true);
    setError(null);
    previousBuildStatusRef.current = null;

    try {
      // Ensure we're using a proper BuildOptions instance
      const options = new models.BuildOptions({
        environment: buildOptions.environment || 'production',
        draft: buildOptions.draft || false,
        future: buildOptions.future || false,
        expired: buildOptions.expired || false,
        minify: buildOptions.minify || false,
        verbose: buildOptions.verbose || false,
        extraArgs: buildOptions.extraArgs || [],
      });
      
      console.log('Starting build for project:', project.id, 'with options:', options);
      const build = await BuildProject(project.id, options);
      console.log('Build started successfully:', build);
      
      // Immediately load build status to show it's running
      await loadBuildStatus();
      
      // Small delay to ensure backend has updated the project status
      setTimeout(() => {
        // Refresh project to get updated status
        if (onProjectUpdate) {
          try {
            onProjectUpdate();
          } catch (refreshErr) {
            console.error('Error refreshing project:', refreshErr);
          }
        }
      }, 100);
    } catch (err: any) {
      console.error('Build error details:', err);
      let errorMessage = 'Failed to start build';
      
      if (err) {
        if (typeof err === 'string') {
          errorMessage = err;
        } else if (err.message) {
          errorMessage = err.message;
        } else if (err.Message) {
          errorMessage = err.Message;
        } else if (err.code) {
          errorMessage = `Error ${err.code}: ${err.message || 'Unknown error'}`;
        } else if (err.toString) {
          errorMessage = err.toString();
        }
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
      console.error('Build error:', errorMessage, err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await CancelBuild(project.id);
      await loadBuildStatus();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel build');
      console.error('Cancel error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-yellow-900/50 text-yellow-200';
      case 'success':
        return 'bg-green-900/50 text-green-200';
      case 'failed':
        return 'bg-red-900/50 text-red-200';
      case 'cancelled':
        return 'bg-gray-900/50 text-gray-200';
      default:
        return 'bg-gray-900/50 text-gray-200';
    }
  };

  const formatDuration = (ms: number) => {
    if (!ms || ms < 0) return '0ms';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Safety check
  if (!project || !project.id) {
    return (
      <div className="p-6">
        <p className="text-gray-400">No project selected</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Success Message - View Site */}
      {buildStatus?.status === 'success' && !project.status?.isServing && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <svg className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-green-200 font-semibold mb-1">Build Successful!</h3>
              <p className="text-green-300/80 text-sm mb-3">
                Your site has been built successfully. To view it, go to the <strong>Server</strong> tab and click "Start Server".
              </p>
              <p className="text-green-300/60 text-xs">
                💡 Tip: The built files are in the <code className="bg-green-900/30 px-1 py-0.5 rounded">public/</code> directory, but they need to be served by a web server to work correctly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Build Status */}
      <div className={`bg-gray-800 rounded-lg p-6 transition-all duration-300 ${
        showSuccessAnimation ? 'ring-2 ring-green-500 ring-opacity-50' : ''
      }`}>
        <h2 className="text-xl font-semibold mb-4">Build Status</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Status:</span>
            {project.status?.isBuilding ? (
              <Badge variant="warning">Building...</Badge>
            ) : buildStatus?.status === 'success' ? (
              <Badge variant="success">Success</Badge>
            ) : buildStatus?.status === 'failed' ? (
              <Badge variant="error">Failed</Badge>
            ) : project.status?.hasErrors ? (
              <Badge variant="error">Error</Badge>
            ) : (
              <Badge variant="neutral">Ready</Badge>
            )}
          </div>

          {buildStatus && (
            <>
              {buildStatus.progress > 0 && buildStatus.progress < 100 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Progress:</span>
                    <span className="text-white">{buildStatus.progress}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${buildStatus.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {buildStatus.startTime && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Started:</span>
                  <span className="text-white">
                    {new Date(buildStatus.startTime).toLocaleString()}
                  </span>
                </div>
              )}

              {buildStatus.endTime && buildStatus.status !== 'running' && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Completed:</span>
                  <span className="text-white">
                    {new Date(buildStatus.endTime).toLocaleString()}
                  </span>
                </div>
              )}
            </>
          )}

          {project.lastBuild && !buildStatus?.endTime && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Last Build:</span>
              <span className="text-white">
                {new Date(project.lastBuild).toLocaleString()}
              </span>
            </div>
          )}
          
          {buildStatus?.status === 'success' && buildStatus.startTime && buildStatus.endTime && (
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Duration:</span>
              <span className="text-white">
                {formatDuration(new Date(buildStatus.endTime).getTime() - new Date(buildStatus.startTime).getTime())}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Build Controls */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Build Actions</h2>
          <button
            onClick={() => setShowOptions(!showOptions)}
            className="text-sm text-hugo-accent-teal hover:text-hugo-accent-tealLight"
          >
            {showOptions ? 'Hide Options' : 'Show Options'}
          </button>
        </div>

        {showOptions && (
          <div className="mb-4 p-4 bg-gray-900/50 rounded-lg space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Environment
              </label>
              <select
                value={buildOptions.environment}
                onChange={(e) => setBuildOptions({ ...buildOptions, environment: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              >
                <option value="production">Production</option>
                <option value="development">Development</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={buildOptions.draft}
                  onChange={(e) => setBuildOptions({ ...buildOptions, draft: e.target.checked })}
                  className="rounded bg-gray-700 border-gray-600 text-hugo-accent-teal focus:ring-hugo-accent-teal"
                />
                <span className="text-sm text-gray-300">Build Drafts</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={buildOptions.future}
                  onChange={(e) => setBuildOptions({ ...buildOptions, future: e.target.checked })}
                  className="rounded bg-gray-700 border-gray-600 text-hugo-accent-teal focus:ring-hugo-accent-teal"
                />
                <span className="text-sm text-gray-300">Build Future</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={buildOptions.expired}
                  onChange={(e) => setBuildOptions({ ...buildOptions, expired: e.target.checked })}
                  className="rounded bg-gray-700 border-gray-600 text-hugo-accent-teal focus:ring-hugo-accent-teal"
                />
                <span className="text-sm text-gray-300">Build Expired</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={buildOptions.minify}
                  onChange={(e) => setBuildOptions({ ...buildOptions, minify: e.target.checked })}
                  className="rounded bg-gray-700 border-gray-600 text-hugo-accent-teal focus:ring-hugo-accent-teal"
                />
                <span className="text-sm text-gray-300">Minify</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={buildOptions.verbose}
                  onChange={(e) => setBuildOptions({ ...buildOptions, verbose: e.target.checked })}
                  className="rounded bg-gray-700 border-gray-600 text-hugo-accent-teal focus:ring-hugo-accent-teal"
                />
                <span className="text-sm text-gray-300">Verbose</span>
              </label>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {project.status?.isBuilding ? (
            <button
              onClick={handleCancel}
              disabled={isLoading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel Build
            </button>
          ) : (
            <button
              onClick={handleBuild}
              disabled={isLoading}
              className="px-4 py-2 bg-hugo-accent-teal hover:bg-hugo-accent-tealLight text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Starting...' : 'Build Project'}
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-4">
          <p className="text-red-200">{error}</p>
        </div>
      )}

      {/* Build Logs */}
      {buildLogs.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Build Logs</h2>
          <div className="bg-gray-900 rounded p-4 font-mono text-sm text-gray-300 max-h-64 overflow-y-auto">
            {buildLogs.map((log, index) => (
              <div key={index} className="mb-1">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Build History */}
      {buildHistory && Array.isArray(buildHistory) && buildHistory.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Build History</h2>
          <div className="space-y-2">
            {buildHistory.map((build) => {
              const isExpanded = expandedBuildId === build.id;
              const hasDetails = (build.error && build.error.trim()) || (build.output && build.output.trim());
              const canExpand = build.status === 'failed' && hasDetails;
              
              return (
                <div key={build.id} className="bg-gray-900/50 rounded overflow-hidden">
                  <div
                    className={`p-4 flex items-center justify-between ${
                      canExpand ? 'cursor-pointer hover:bg-gray-900/70 transition-colors' : ''
                    }`}
                    onClick={() => canExpand && setExpandedBuildId(isExpanded ? null : build.id)}
                  >
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      <span className={`px-2 py-1 rounded text-xs flex-shrink-0 ${getStatusColor(build.status)}`}>
                        {build.status}
                      </span>
                      <span className="text-sm text-gray-400 flex-shrink-0">
                        {build.startTime ? new Date(build.startTime).toLocaleString() : 'Unknown'}
                      </span>
                      {build.duration && build.duration > 0 && (
                        <span className="text-sm text-gray-400 flex-shrink-0">
                          {formatDuration(build.duration)}
                        </span>
                      )}
                      {build.filesGenerated && build.filesGenerated > 0 && (
                        <span className="text-sm text-gray-400 flex-shrink-0">
                          {build.filesGenerated} files
                        </span>
                      )}
                      {build.error && (
                        <span className="text-xs text-red-400 truncate flex-1 min-w-0">
                          {build.error}
                        </span>
                      )}
                    </div>
                    {canExpand && (
                      <button
                        className="ml-4 text-gray-400 hover:text-white transition-colors flex-shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedBuildId(isExpanded ? null : build.id);
                        }}
                      >
                        <svg
                          className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                  </div>
                  
                  {isExpanded && hasDetails && (
                    <div className="border-t border-gray-700 p-4 space-y-4">
                      {build.error && build.error.trim() && (
                        <div>
                          <h4 className="text-sm font-semibold text-red-400 mb-2">Error Message</h4>
                          <div className="bg-red-900/20 border border-red-800/50 rounded p-3 font-mono text-sm text-red-200 whitespace-pre-wrap break-words">
                            {build.error}
                          </div>
                        </div>
                      )}
                      {build.output && build.output.trim() && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-300 mb-2">Build Output</h4>
                          <div className="bg-gray-900 rounded p-3 font-mono text-sm text-gray-300 max-h-96 overflow-y-auto whitespace-pre-wrap break-words">
                            {build.output.split('\n').map((line, index) => (
                              <div key={index} className="mb-1">
                                {line || '\u00A0'}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
