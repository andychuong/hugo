import { useState, useEffect } from 'react';
import { StartServer, StopServer, GetServerStatus, GetServerLogs } from '../../../../wailsjs/go/handlers/App';
import { BrowserOpenURL } from '../../../../wailsjs/runtime/runtime';
import { models } from '../../../../wailsjs/go/models';
import type { Project, ServerInfo, ServerOptions } from '../../../types';

interface ServerTabProps {
  project: Project;
  onProjectUpdate?: () => void;
}

export default function ServerTab({ project, onProjectUpdate }: ServerTabProps) {
  const [serverStatus, setServerStatus] = useState<ServerInfo | null>(null);
  const [serverLogs, setServerLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const [serverOptions, setServerOptions] = useState<ServerOptions>({
    port: 1313,
    baseURL: '',
    buildDrafts: false,
    buildFuture: false,
    buildExpired: false,
    disableLiveReload: false,
  });

  // Poll server status when server is running
  useEffect(() => {
    if (!project.status?.isServing) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const status = await GetServerStatus(project.id);
        setServerStatus(status);
        
        // Fetch logs
        const logs = await GetServerLogs(project.id, 100);
        setServerLogs(logs);

        // If server stopped, refresh project
        if (!status.isRunning) {
          clearInterval(interval);
          if (onProjectUpdate) {
            onProjectUpdate();
          }
        }
      } catch (err: any) {
        console.error('Failed to get server status:', err);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(interval);
  }, [project.id, project.status?.isServing, onProjectUpdate]);

  // Load initial server status
  useEffect(() => {
    if (project?.id) {
      loadServerStatus().catch(err => {
        console.error('Error loading server status:', err);
      });
    }
  }, [project.id]);

  const loadServerStatus = async () => {
    try {
      const status = await GetServerStatus(project.id);
      setServerStatus(status);
      
      if (status.isRunning) {
        const logs = await GetServerLogs(project.id, 100);
        setServerLogs(logs);
      }
    } catch (err: any) {
      console.error('Failed to load server status:', err);
    }
  };

  const handleStart = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const options = new models.ServerOptions({
        port: serverOptions.port || 1313,
        baseURL: serverOptions.baseURL || '',
        buildDrafts: serverOptions.buildDrafts || false,
        buildFuture: serverOptions.buildFuture || false,
        buildExpired: serverOptions.buildExpired || false,
        disableLiveReload: serverOptions.disableLiveReload || false,
      });

      console.log('Starting server for project:', project.id, 'with options:', options);
      const info = await StartServer(project.id, options);
      console.log('Server started successfully:', info);
      
      setServerStatus(info);
      
      // Update serverOptions with the actual port/URL in case port was auto-assigned
      if (info.port && info.port !== serverOptions.port) {
        // Port was auto-assigned, update baseURL to match
        const newBaseURL = info.url || `http://localhost:${info.port}`;
        setServerOptions({ ...serverOptions, port: info.port, baseURL: newBaseURL });
      }
      
      // Small delay to ensure backend has updated the project status
      setTimeout(() => {
        if (onProjectUpdate) {
          onProjectUpdate();
        }
      }, 100);
    } catch (err: any) {
      console.error('Server error details:', err);
      let errorMessage = 'Failed to start server';
      
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
      console.error('Server error:', errorMessage, err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Add timeout to prevent UI from getting stuck
      const stopPromise = StopServer(project.id);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Stop operation timed out')), 5000)
      );
      
      await Promise.race([stopPromise, timeoutPromise]);
      
      setServerStatus(null);
      setServerLogs([]);
      
      // Refresh project to get updated status
      if (onProjectUpdate) {
        onProjectUpdate();
      }
    } catch (err: any) {
      // Even if stop fails or times out, update UI to reflect stopped state
      setServerStatus(null);
      setServerLogs([]);
      
      const errorMessage = err.message || 'Failed to stop server';
      setError(errorMessage);
      console.error('Stop error:', err);
      
      // Still refresh project status in case backend updated it
      if (onProjectUpdate) {
        onProjectUpdate();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Safety check
  if (!project || !project.id) {
    return (
      <div className="p-6">
        <p className="text-gray-400">No project selected</p>
      </div>
    );
  }

  const isRunning = project.status?.isServing || serverStatus?.isRunning || false;

  return (
    <div className="space-y-6">
      {/* Server Status */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Server Status</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Status:</span>
            <span className={`px-3 py-1 rounded ${
              isRunning
                ? 'bg-green-900/50 text-green-200'
                : 'bg-gray-700 text-gray-300'
            }`}>
              {isRunning ? '● Running' : '○ Stopped'}
            </span>
          </div>

          {isRunning && serverStatus && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">URL:</span>
                <button
                  onClick={() => BrowserOpenURL(serverStatus.url)}
                  className="text-hugo-accent-teal hover:text-hugo-accent-tealLight underline cursor-pointer"
                  title="Open in browser"
                >
                  {serverStatus.url}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-gray-400">Port:</span>
                <span className="text-white">{serverStatus.port}</span>
              </div>

              {serverStatus.pid && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Process ID:</span>
                  <span className="text-white">{serverStatus.pid}</span>
                </div>
              )}

              {serverStatus.startTime && (
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Started:</span>
                  <span className="text-white">
                    {new Date(serverStatus.startTime).toLocaleString()}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Server Controls */}
      <div className="bg-gray-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Server Actions</h2>
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
                Port
              </label>
              <input
                type="number"
                value={serverOptions.port || 1313}
                onChange={(e) => {
                  const newPort = parseInt(e.target.value) || 1313;
                  // Auto-update baseURL if it's a localhost URL or empty
                  let newBaseURL = serverOptions.baseURL || '';
                  if (!newBaseURL || newBaseURL.match(/^https?:\/\/localhost(:\d+)?\/?$/i) || newBaseURL.match(/^https?:\/\/127\.0\.0\.1(:\d+)?\/?$/i)) {
                    newBaseURL = `http://localhost:${newPort}`;
                  } else if (newBaseURL.match(/^https?:\/\/localhost:\d+/i) || newBaseURL.match(/^https?:\/\/127\.0\.0\.1:\d+/i)) {
                    // Update port in existing localhost URL
                    newBaseURL = newBaseURL.replace(/:\d+/, `:${newPort}`);
                  }
                  setServerOptions({ ...serverOptions, port: newPort, baseURL: newBaseURL });
                }}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
                min="1024"
                max="65535"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Base URL
              </label>
              <input
                type="text"
                value={serverOptions.baseURL || ''}
                onChange={(e) => setServerOptions({ ...serverOptions, baseURL: e.target.value })}
                placeholder={`http://localhost:${serverOptions.port || 1313}`}
                className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-blue-500 focus:outline-none"
              />
              <p className="text-xs text-gray-400 mt-1">
                Used for generating absolute URLs. Leave empty to use default (localhost with port).
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={serverOptions.buildDrafts}
                  onChange={(e) => setServerOptions({ ...serverOptions, buildDrafts: e.target.checked })}
                  className="rounded bg-gray-700 border-gray-600 text-hugo-accent-teal focus:ring-hugo-accent-teal"
                />
                <span className="text-sm text-gray-300">Build Drafts</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={serverOptions.buildFuture}
                  onChange={(e) => setServerOptions({ ...serverOptions, buildFuture: e.target.checked })}
                  className="rounded bg-gray-700 border-gray-600 text-hugo-accent-teal focus:ring-hugo-accent-teal"
                />
                <span className="text-sm text-gray-300">Build Future</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={serverOptions.buildExpired}
                  onChange={(e) => setServerOptions({ ...serverOptions, buildExpired: e.target.checked })}
                  className="rounded bg-gray-700 border-gray-600 text-hugo-accent-teal focus:ring-hugo-accent-teal"
                />
                <span className="text-sm text-gray-300">Build Expired</span>
              </label>

              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={serverOptions.disableLiveReload}
                  onChange={(e) => setServerOptions({ ...serverOptions, disableLiveReload: e.target.checked })}
                  className="rounded bg-gray-700 border-gray-600 text-hugo-accent-teal focus:ring-hugo-accent-teal"
                />
                <span className="text-sm text-gray-300">Disable Live Reload</span>
              </label>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {isRunning ? (
            <button
              onClick={handleStop}
              disabled={isLoading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Stopping...' : 'Stop Server'}
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={isLoading}
              className="px-4 py-2 bg-hugo-accent-teal hover:bg-hugo-accent-tealLight text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Starting...' : 'Start Server'}
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

      {/* Server Logs */}
      {isRunning && serverLogs.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Server Logs</h2>
          <div className="bg-gray-900 rounded p-4 font-mono text-sm text-gray-300 max-h-64 overflow-y-auto">
            {serverLogs.map((log, index) => (
              <div key={index} className="mb-1">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

