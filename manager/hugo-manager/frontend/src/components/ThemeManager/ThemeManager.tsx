import { useState, useEffect } from 'react';
import { 
  GetInstalledThemes,
  RemoveTheme,
  UpdateTheme
} from '../../../wailsjs/go/handlers/App';
import { models } from '../../../wailsjs/go/models';
import { useToast } from '../../hooks/useToast';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';

type Theme = models.Theme;
type Project = models.Project;

interface ThemeManagerProps {
  project: Project;
  onThemeRemoved?: () => void;
}

export default function ThemeManager({ project, onThemeRemoved }: ThemeManagerProps) {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    loadThemes();
  }, [project.id]);

  const loadThemes = async () => {
    setLoading(true);
    try {
      const data = await GetInstalledThemes(project.id);
      setThemes(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load installed themes');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (theme: Theme) => {
    if (!confirm(`Are you sure you want to remove ${theme.name}?`)) {
      return;
    }
    
    try {
      await RemoveTheme(project.id, theme.path);
      toast.success(`Theme ${theme.name} removed`);
      loadThemes();
      onThemeRemoved?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove theme');
    }
  };

  const handleUpdate = async (theme: Theme) => {
    setUpdating(theme.id);
    try {
      await UpdateTheme(project.id, theme.path);
      toast.success(`Theme ${theme.name} updated`);
      loadThemes();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update theme');
    } finally {
      setUpdating(null);
    }
  };

  if (loading && themes.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Themes List */}
      {themes.length === 0 ? (
        <EmptyState
          title="No themes installed"
          description="Install themes from the theme browser to get started"
        />
      ) : (
        <div className="space-y-4">
          {themes.map((theme) => (
            <Card key={theme.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-hugo-text-primary">
                      {theme.name}
                    </h3>
                    <Badge variant="success">Installed</Badge>
                  </div>
                  
                  {theme.description && (
                    <p className="text-sm text-hugo-text-secondary mb-3">
                      {theme.description}
                    </p>
                  )}
                  
                  <div className="text-sm text-hugo-text-tertiary space-y-1">
                    <div>Path: <code className="text-xs bg-hugo-bg-secondary px-1 py-0.5 rounded">{theme.path}</code></div>
                    {theme.localPath && (
                      <div>Local: <code className="text-xs bg-hugo-bg-secondary px-1 py-0.5 rounded">{theme.localPath}</code></div>
                    )}
                    {theme.author && <div>Author: {theme.author}</div>}
                    {theme.license && <div>License: {theme.license}</div>}
                    {theme.minVersion && <div>Min Hugo Version: {theme.minVersion}</div>}
                    {theme.version && <div>Version: {theme.version}</div>}
                  </div>
                  
                  {theme.tags && theme.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {theme.tags.map((tag, idx) => (
                        <Badge key={idx} variant="neutral" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2 ml-4">
                  <Button
                    onClick={() => handleUpdate(theme)}
                    variant="secondary"
                    size="sm"
                    disabled={updating === theme.id}
                  >
                    {updating === theme.id ? 'Updating...' : 'Update'}
                  </Button>
                  <Button
                    onClick={() => handleRemove(theme)}
                    variant="danger"
                    size="sm"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

