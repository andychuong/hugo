import { useState, useEffect } from 'react';
import { 
  GetPageStructure,
  GetEditableRegions,
  UpdatePageField,
  GetVisualEditingConfig,
  UpdateVisualEditingConfig,
  SetVisualEditingEnabled,
  GetSiteStructure
} from '../../../wailsjs/go/handlers/App';
import { models } from '../../../wailsjs/go/models';
import { useToast } from '../../hooks/useToast';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Badge from '../ui/Badge';
import Input from '../ui/Input';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import VisualEditingOverlay from './VisualEditingOverlay';

type Project = models.Project;
type PageStructure = models.PageStructure;
type EditableRegion = models.EditableRegion;
type VisualEditingConfig = models.VisualEditingConfig;

interface VisualEditorProps {
  project: Project;
  pagePath?: string;
  onContentUpdated?: () => void;
}

export default function VisualEditor({ project, pagePath, onContentUpdated }: VisualEditorProps) {
  const [config, setConfig] = useState<VisualEditingConfig | null>(null);
  const [pageStructure, setPageStructure] = useState<PageStructure | null>(null);
  const [editableRegions, setEditableRegions] = useState<EditableRegion[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<EditableRegion | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [viewMode, setViewMode] = useState<'list' | 'preview'>('list');
  const [serverUrl, setServerUrl] = useState<string>('');
  const toast = useToast();

  useEffect(() => {
    loadConfig();
  }, [project.id]);

  useEffect(() => {
    if (pagePath && config?.enabled) {
      loadPageStructure();
    }
  }, [project.id, pagePath, config?.enabled]);

  useEffect(() => {
    // Get server URL from project status if server is running
    if (project.status?.isServing && project.status?.serverUrl) {
      setServerUrl(project.status.serverUrl);
    } else {
      setServerUrl('');
    }
  }, [project.status]);

  const loadConfig = async () => {
    try {
      const data = await GetVisualEditingConfig(project.id);
      setConfig(data);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load visual editing config');
    }
  };

  const loadPageStructure = async () => {
    if (!pagePath) return;
    
    setLoading(true);
    try {
      const structure = await GetPageStructure(project.id, pagePath);
      setPageStructure(structure);
      setEditableRegions(structure.regions || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load page structure');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async (enabled: boolean) => {
    try {
      await SetVisualEditingEnabled(project.id, enabled);
      const updatedConfig = await GetVisualEditingConfig(project.id);
      setConfig(updatedConfig);
      toast.success(`Visual editing ${enabled ? 'enabled' : 'disabled'}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update visual editing');
    }
  };

  const handleUpdateConfig = async () => {
    if (!config) return;
    
    setSaving(true);
    try {
      await UpdateVisualEditingConfig(project.id, config);
      toast.success('Visual editing configuration updated');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleEditRegion = (region: EditableRegion) => {
    setSelectedRegion(region);
    setEditValue(String(region.value || ''));
  };

  const handleSaveEdit = async () => {
    if (!selectedRegion || !pagePath) return;
    
    setSaving(true);
    try {
      await UpdatePageField(project.id, pagePath, selectedRegion.field, editValue);
      toast.success('Field updated successfully');
      setSelectedRegion(null);
      setEditValue('');
      loadPageStructure();
      onContentUpdated?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update field');
    } finally {
      setSaving(false);
    }
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-hugo-text-primary">Visual Editing</h2>
          <p className="text-sm text-hugo-text-tertiary mt-1">
            Edit content visually with structured data
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={config.enabled ? 'success' : 'neutral'}>
            {config.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
          <Button
            onClick={() => handleToggleEnabled(!config.enabled)}
            variant={config.enabled ? 'secondary' : 'primary'}
            size="sm"
          >
            {config.enabled ? 'Disable' : 'Enable'}
          </Button>
        </div>
      </div>

      {/* Configuration */}
      <Card className="p-4">
        <h3 className="text-lg font-semibold text-hugo-text-primary mb-4">Configuration</h3>
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.injectAttrs}
                onChange={(e) => setConfig({ ...config, injectAttrs: e.target.checked })}
                className="rounded"
              />
              <span className="text-sm text-hugo-text-secondary">Inject visual editing attributes</span>
            </label>
          </div>
          
          <Input
            label="API Endpoint"
            value={config.apiEndpoint || ''}
            onChange={(e) => setConfig({ ...config, apiEndpoint: e.target.value })}
            placeholder="/api/visual-editing"
          />
          
          <Button onClick={handleUpdateConfig} variant="primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </Card>

      {/* View Mode Toggle */}
      {config.enabled && pagePath && pageStructure && (
        <div className="flex gap-2 mb-4">
          <Button
            onClick={() => setViewMode('list')}
            variant={viewMode === 'list' ? 'primary' : 'secondary'}
            size="sm"
          >
            List View
          </Button>
          <Button
            onClick={() => setViewMode('preview')}
            variant={viewMode === 'preview' ? 'primary' : 'secondary'}
            size="sm"
            disabled={!serverUrl}
          >
            Live Preview
          </Button>
        </div>
      )}

      {/* Page Structure */}
      {config.enabled && pagePath ? (
        <div className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : pageStructure ? (
            <>
              {viewMode === 'preview' && serverUrl ? (
                <VisualEditingOverlay
                  projectId={project.id}
                  pageStructure={pageStructure}
                  serverUrl={serverUrl}
                  onUpdate={() => {
                    loadPageStructure();
                    onContentUpdated?.();
                  }}
                />
              ) : (
                <>
                  <Card className="p-4">
                    <h3 className="text-lg font-semibold text-hugo-text-primary mb-4">
                      Page: {pageStructure.page.title || pagePath}
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div><strong>Path:</strong> {pageStructure.page.path}</div>
                      <div><strong>Permalink:</strong> {pageStructure.page.permalink}</div>
                      <div><strong>Kind:</strong> {pageStructure.page.kind}</div>
                    </div>
                  </Card>

                  <Card className="p-4">
                    <h3 className="text-lg font-semibold text-hugo-text-primary mb-4">
                      Editable Regions
                    </h3>
                    {editableRegions.length === 0 ? (
                      <EmptyState
                        title="No editable regions found"
                        description="This page doesn't have any editable regions configured"
                      />
                    ) : (
                      <div className="space-y-3">
                        {editableRegions.map((region) => (
                          <div
                            key={region.id}
                            className="border border-hugo-border-default rounded p-3 hover:bg-hugo-bg-secondary"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <div className="font-medium text-hugo-text-primary">{region.label}</div>
                                <div className="text-xs text-hugo-text-tertiary mt-1">
                                  Field: {region.field} | Type: {region.type}
                                </div>
                              </div>
                              <Button
                                onClick={() => handleEditRegion(region)}
                                variant="secondary"
                                size="sm"
                              >
                                Edit
                              </Button>
                            </div>
                            <div className="text-sm text-hugo-text-secondary mt-2 p-2 bg-hugo-bg-secondary rounded">
                              {String(region.value || '').substring(0, 100)}
                              {String(region.value || '').length > 100 && '...'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </>
              )}
            </>
          ) : (
            <EmptyState
              title="No page selected"
              description="Select a page to view its editable regions"
            />
          )}
        </div>
      ) : !config.enabled ? (
        <Card className="p-4">
          <p className="text-hugo-text-tertiary">
            Enable visual editing to view and edit page structures
          </p>
        </Card>
      ) : (
        <Card className="p-4">
          <p className="text-hugo-text-tertiary">
            Select a page to view its editable regions
          </p>
        </Card>
      )}

      {/* Edit Dialog */}
      {selectedRegion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl p-6 max-h-[80vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-hugo-text-primary mb-4">
              Edit {selectedRegion.label}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-hugo-text-secondary mb-2">
                  {selectedRegion.label} ({selectedRegion.type})
                </label>
                {selectedRegion.type === 'markdown' || selectedRegion.type === 'text' ? (
                  <textarea
                    className="w-full px-3 py-2 bg-hugo-bg-secondary border border-hugo-border-default rounded text-hugo-text-primary font-mono text-sm"
                    rows={10}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                  />
                ) : (
                  <Input
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                  />
                )}
              </div>

              <div className="flex gap-2 justify-end pt-4">
                <Button
                  onClick={() => {
                    setSelectedRegion(null);
                    setEditValue('');
                  }}
                  variant="secondary"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  variant="primary"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

