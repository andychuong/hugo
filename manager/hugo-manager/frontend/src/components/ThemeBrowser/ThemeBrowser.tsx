import { useState, useEffect } from 'react';
import { 
  SearchThemes, 
  GetThemeIndex, 
  UpdateThemeIndex,
  InstallTheme,
  InstallThemeSubmodule,
  GetThemeFromMarketplace
} from '../../../wailsjs/go/handlers/App';
import { BrowserOpenURL } from '../../../wailsjs/runtime/runtime';
import { models } from '../../../wailsjs/go/models';
import { useToast } from '../../hooks/useToast';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';

type Theme = models.Theme;
type Project = models.Project;

interface ThemeBrowserProps {
  project: Project;
  onThemeInstalled?: () => void;
}

export default function ThemeBrowser({ project, onThemeInstalled }: ThemeBrowserProps) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [installing, setInstalling] = useState<string | null>(null);
  const [showInstallDialog, setShowInstallDialog] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const [installMethod, setInstallMethod] = useState<'module' | 'submodule'>('module');
  const [installPath, setInstallPath] = useState('');
  const toast = useToast();

  useEffect(() => {
    loadThemes();
  }, []);

  const loadThemes = async () => {
    setLoading(true);
    try {
      const data = await GetThemeIndex();
      setThemes(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load themes');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      if (!searchQuery.trim()) {
        // If no search query, show all themes
        await loadThemes();
      } else {
        // Search with query
        const results = await SearchThemes(searchQuery, {});
        setThemes(results || []);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to search themes');
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    if (!selectedTheme) {
      console.error('No theme selected');
      toast.error('No theme selected');
      return;
    }

    if (!project || !project.id) {
      console.error('No project selected');
      toast.error('No project selected');
      return;
    }
    
    console.log('Starting installation...', {
      theme: selectedTheme.name,
      method: installMethod,
      projectId: project.id,
      installPath: installPath.trim() || (installMethod === 'module' ? selectedTheme.path : selectedTheme.githubPath)
    });
    
    setInstalling(selectedTheme.id);
    try {
      if (installMethod === 'module') {
        const themePath = installPath.trim() || selectedTheme.path;
        if (!themePath) {
          throw new Error('Theme path is required');
        }
        console.log('Installing theme via module:', { projectId: project.id, themePath });
        toast.info(`Installing ${selectedTheme.name} via Hugo Modules...`);
        await InstallTheme(project.id, themePath);
        console.log('Theme installed successfully');
        toast.success(`Theme ${selectedTheme.name} installed successfully`);
      } else {
        const themeURL = installPath.trim() || selectedTheme.githubPath;
        if (!themeURL) {
          throw new Error('GitHub URL is required');
        }
        const themeName = selectedTheme.name.toLowerCase().replace(/\s+/g, '-');
        console.log('Installing theme via submodule:', { projectId: project.id, themeURL, themeName });
        toast.info(`Installing ${selectedTheme.name} via Git Submodule...`);
        await InstallThemeSubmodule(project.id, themeURL, themeName);
        console.log('Theme installed successfully');
        toast.success(`Theme ${selectedTheme.name} installed successfully`);
      }
      setShowInstallDialog(false);
      setSelectedTheme(null);
      setInstallPath('');
      onThemeInstalled?.();
    } catch (err: any) {
      console.error('Theme installation error:', err);
      console.error('Error details:', {
        message: err?.message,
        Message: err?.Message,
        code: err?.code,
        stack: err?.stack,
        toString: err?.toString(),
        fullError: err
      });
      
      // Extract error message from various possible formats
      let errorMessage = 'Failed to install theme';
      if (err) {
        if (typeof err === 'string') {
          errorMessage = err;
        } else if (err.message) {
          errorMessage = err.message;
        } else if (err.Message) {
          errorMessage = err.Message;
        } else if (err.toString && typeof err.toString === 'function') {
          const errStr = err.toString();
          // If toString returns something meaningful (not just "[object Object]")
          if (errStr && !errStr.startsWith('[object')) {
            errorMessage = errStr;
          }
        }
      }
      
      // Clean up error message - remove newlines and extra whitespace
      errorMessage = errorMessage.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      
      // Truncate very long error messages
      if (errorMessage.length > 200) {
        errorMessage = errorMessage.substring(0, 200) + '...';
      }
      
      toast.error(`Installation failed: ${errorMessage}`);
    } finally {
      setInstalling(null);
    }
  };

  const handleUpdateIndex = async () => {
    setLoading(true);
    try {
      toast.info('Updating theme index... This may take a minute.');
      await UpdateThemeIndex();
      // Reload themes after update
      const updatedThemes = await GetThemeIndex();
      setThemes(updatedThemes || []);
      const themeCount = (updatedThemes || []).length;
      if (themeCount > 0) {
        toast.success(`Theme index updated! Found ${themeCount} themes.`);
      } else {
        toast.warning('Theme index updated but no themes found. The update may have failed or the website structure changed.');
      }
    } catch (err: any) {
      console.error('Theme index update error:', err);
      toast.error(err.message || 'Failed to update theme index. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  // Sort themes: installed first, then by name
  const sortedThemes = [...themes].sort((a, b) => {
    if (a.installed && !b.installed) return -1;
    if (!a.installed && b.installed) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="space-y-6">
      {/* Search and Update Index */}
      <div className="flex gap-2 items-center">
        <Input
          placeholder="Search themes by name, description, or tags..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          className="flex-1 h-10"
        />
        <Button onClick={handleSearch} variant="primary" disabled={loading} size="md">
          {loading ? 'Searching...' : 'Search'}
        </Button>
        {searchQuery && (
          <Button onClick={() => { setSearchQuery(''); loadThemes(); }} variant="secondary" size="md">
            Clear
          </Button>
        )}
        <Button onClick={handleUpdateIndex} variant="secondary" disabled={loading} size="md" className="whitespace-nowrap">
          {loading ? 'Updating...' : 'Update Index'}
        </Button>
      </div>

      {/* Themes Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-hugo-text-tertiary mt-4">
            {themes.length === 0 ? 'Fetching themes from themes.gohugo.io...' : 'Searching themes...'}
          </p>
        </div>
      ) : themes.length === 0 ? (
        <EmptyState
          title={searchQuery ? `No themes found for "${searchQuery}"` : "No themes found"}
          description={searchQuery 
            ? "Try a different search term or update the theme index to refresh the theme list"
            : "Update the theme index to load themes from themes.gohugo.io"}
          action={{
            label: "Update Index",
            onClick: handleUpdateIndex
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedThemes.map((theme) => (
            <Card key={theme.id} className="p-4 hover:bg-hugo-bg-secondary transition-colors">
              <div className="flex flex-col h-full">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    {theme.githubPath ? (
                      <button
                        onClick={() => BrowserOpenURL(theme.githubPath)}
                        className="text-lg font-semibold text-hugo-text-primary hover:text-hugo-accent-teal transition-colors cursor-pointer flex items-center gap-1 group"
                        title="Open GitHub repository"
                      >
                        <span>{theme.name}</span>
                        <svg 
                          className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                    ) : (
                      <h3 className="text-lg font-semibold text-hugo-text-primary">
                        {theme.name}
                      </h3>
                    )}
                  </div>
                  {theme.installed && (
                    <Badge variant="success">Installed</Badge>
                  )}
                </div>
                
                {theme.description && (
                  <p className="text-sm text-hugo-text-secondary mb-3 flex-1">
                    {theme.description}
                  </p>
                )}
                
                {theme.tags && theme.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-3">
                    {theme.tags.slice(0, 3).map((tag, idx) => (
                      <Badge key={idx} variant="neutral" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-hugo-border-default">
                  <div className="text-xs text-hugo-text-tertiary">
                    {theme.author && <div>By {theme.author}</div>}
                    {theme.minVersion && <div>Min Hugo: {theme.minVersion}</div>}
                  </div>
                  <Button
                    onClick={() => {
                      setSelectedTheme(theme);
                      setShowInstallDialog(true);
                    }}
                    variant="primary"
                    size="sm"
                    disabled={theme.installed}
                  >
                    {theme.installed ? 'Installed' : 'Install'}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Install Dialog */}
      {showInstallDialog && selectedTheme && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md p-6 relative">
            {installing === selectedTheme.id && (
              <div className="absolute inset-0 bg-hugo-bg-primary/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-3">
                  <LoadingSpinner size="lg" />
                  <p className="text-sm text-hugo-text-secondary">
                    Installing {selectedTheme.name}...
                  </p>
                  <p className="text-xs text-hugo-text-tertiary">
                    This may take a moment
                  </p>
                </div>
              </div>
            )}
            <h3 className="text-xl font-bold text-hugo-text-primary mb-4">
              Install {selectedTheme.name}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-hugo-text-secondary mb-2">
                  Installation Method
                </label>
                <select
                  className="w-full px-3 py-2 bg-hugo-bg-secondary border border-hugo-border-default rounded text-hugo-text-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  value={installMethod}
                  onChange={(e) => setInstallMethod(e.target.value as 'module' | 'submodule')}
                  disabled={installing === selectedTheme.id}
                >
                  <option value="module">Hugo Modules (Recommended)</option>
                  <option value="submodule">Git Submodule (Legacy)</option>
                </select>
              </div>

              {installMethod === 'module' ? (
                <Input
                  label="Theme Path"
                  value={installPath || selectedTheme.path}
                  onChange={(e) => setInstallPath(e.target.value)}
                  placeholder="e.g., github.com/user/theme"
                  helperText="Leave empty to use default theme path"
                  disabled={installing === selectedTheme.id}
                />
              ) : (
                <Input
                  label="GitHub URL"
                  value={installPath || selectedTheme.githubPath}
                  onChange={(e) => setInstallPath(e.target.value)}
                  placeholder="https://github.com/user/theme.git"
                  disabled={installing === selectedTheme.id}
                />
              )}

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  onClick={() => {
                    if (installing === selectedTheme.id) {
                      // Don't allow closing during installation
                      return;
                    }
                    setShowInstallDialog(false);
                    setSelectedTheme(null);
                    setInstallPath('');
                  }}
                  variant="secondary"
                  disabled={installing === selectedTheme.id}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleInstall}
                  variant="primary"
                  isLoading={installing === selectedTheme.id}
                  disabled={installing === selectedTheme.id}
                >
                  {installing === selectedTheme.id ? 'Installing...' : 'Install'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

