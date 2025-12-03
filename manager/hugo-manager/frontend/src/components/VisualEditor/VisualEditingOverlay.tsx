import { useState, useEffect, useRef } from 'react';
import { models } from '../../../wailsjs/go/models';
import { UpdatePageField } from '../../../wailsjs/go/handlers/App';
import { useToast } from '../../hooks/useToast';
import Button from '../ui/Button';
import Card from '../ui/Card';
import Input from '../ui/Input';

type EditableRegion = models.EditableRegion;
type PageStructure = models.PageStructure;

interface VisualEditingOverlayProps {
  projectId: string;
  pageStructure: PageStructure | null;
  serverUrl?: string;
  onUpdate?: () => void;
}

export default function VisualEditingOverlay({
  projectId,
  pageStructure,
  serverUrl,
  onUpdate,
}: VisualEditingOverlayProps) {
  const [selectedRegion, setSelectedRegion] = useState<EditableRegion | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (!serverUrl || !pageStructure) return;

    // Inject visual editing script into iframe
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = () => {
      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) return;

        // Inject visual editing attributes and handlers
        const script = iframeDoc.createElement('script');
        script.textContent = `
          (function() {
            const regions = ${JSON.stringify(pageStructure.regions)};
            
            // Add visual editing attributes to elements
            regions.forEach(region => {
              const elements = document.querySelectorAll(region.selector);
              elements.forEach(el => {
                el.setAttribute('data-editable-region', region.id);
                el.setAttribute('data-field', region.field);
                el.setAttribute('data-type', region.type);
                el.style.cursor = 'pointer';
                el.style.position = 'relative';
                
                // Add hover effect
                el.addEventListener('mouseenter', function() {
                  this.style.outline = '2px solid #3b82f6';
                  this.style.outlineOffset = '2px';
                });
                
                el.addEventListener('mouseleave', function() {
                  if (!this.hasAttribute('data-editing')) {
                    this.style.outline = '';
                    this.style.outlineOffset = '';
                  }
                });
                
                // Add click handler
                el.addEventListener('click', function(e) {
                  e.preventDefault();
                  e.stopPropagation();
                  window.parent.postMessage({
                    type: 'EDIT_REGION',
                    regionId: region.id,
                    region: region
                  }, '*');
                });
              });
            });
            
            // Listen for updates from parent
            window.addEventListener('message', function(event) {
              if (event.data.type === 'UPDATE_REGION') {
                const { regionId, value } = event.data;
                const elements = document.querySelectorAll('[data-editable-region="' + regionId + '"]');
                elements.forEach(el => {
                  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                    el.value = value;
                  } else {
                    el.textContent = value;
                  }
                  el.removeAttribute('data-editing');
                  el.style.outline = '';
                });
              }
            });
          })();
        `;
        iframeDoc.head.appendChild(script);
      } catch (err) {
        console.error('Failed to inject visual editing script:', err);
      }
    };

    iframe.addEventListener('load', handleLoad);
    if (iframe.contentDocument?.readyState === 'complete') {
      handleLoad();
    }

    // Listen for messages from iframe
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'EDIT_REGION') {
        const region = pageStructure.regions.find(r => r.id === event.data.regionId);
        if (region) {
          setSelectedRegion(region);
          setEditValue(String(region.value || ''));
          setIsEditing(true);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      iframe.removeEventListener('load', handleLoad);
      window.removeEventListener('message', handleMessage);
    };
  }, [serverUrl, pageStructure]);

  const handleSave = async () => {
    if (!selectedRegion || !pageStructure) return;

    setSaving(true);
    try {
      await UpdatePageField(projectId, pageStructure.page.path, selectedRegion.field, editValue);
      
      // Notify iframe of update
      const iframe = iframeRef.current;
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage(
          {
            type: 'UPDATE_REGION',
            regionId: selectedRegion.id,
            value: editValue,
          },
          '*'
        );
      }

      toast.success('Field updated successfully');
      setIsEditing(false);
      setSelectedRegion(null);
      setEditValue('');
      onUpdate?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update field');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setSelectedRegion(null);
    setEditValue('');
  };

  if (!serverUrl) {
    return (
      <Card className="p-4">
        <p className="text-hugo-text-tertiary">
          Start the development server to enable live preview with visual editing
        </p>
      </Card>
    );
  }

  return (
    <div className="relative w-full h-full">
      {/* Preview iframe */}
      <div className="relative w-full" style={{ height: 'calc(100vh - 300px)' }}>
        <iframe
          ref={iframeRef}
          src={serverUrl}
          className="w-full h-full border border-hugo-border-default rounded"
          title="Visual Editing Preview"
        />
      </div>

      {/* Edit Panel */}
      {isEditing && selectedRegion && (
        <div className="fixed bottom-0 left-0 right-0 bg-hugo-bg-primary border-t border-hugo-border-default p-4 shadow-lg z-50">
          <Card className="p-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-hugo-text-primary">
                  Edit {selectedRegion.label}
                </h3>
                <p className="text-sm text-hugo-text-tertiary mt-1">
                  Field: {selectedRegion.field} | Type: {selectedRegion.type}
                </p>
              </div>
              <Button onClick={handleCancel} variant="secondary" size="sm">
                Cancel
              </Button>
            </div>

            <div className="space-y-4">
              {selectedRegion.type === 'markdown' || selectedRegion.type === 'text' ? (
                <textarea
                  className="w-full px-3 py-2 bg-hugo-bg-secondary border border-hugo-border-default rounded text-hugo-text-primary font-mono text-sm"
                  rows={8}
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="Enter content..."
                />
              ) : (
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  placeholder="Enter value..."
                />
              )}

              <div className="flex gap-2 justify-end">
                <Button onClick={handleCancel} variant="secondary">
                  Cancel
                </Button>
                <Button onClick={handleSave} variant="primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Instructions overlay */}
      {!isEditing && (
        <div className="absolute top-4 right-4 bg-hugo-bg-secondary/90 backdrop-blur-sm border border-hugo-border-default rounded p-3 max-w-xs">
          <p className="text-sm text-hugo-text-secondary">
            <strong className="text-hugo-text-primary">Visual Editing Mode</strong>
            <br />
            Click on any highlighted element to edit it
          </p>
        </div>
      )}
    </div>
  );
}

