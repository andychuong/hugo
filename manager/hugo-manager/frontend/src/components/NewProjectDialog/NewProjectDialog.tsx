import { useState } from 'react';
import { CreateNewProject, SelectDirectory } from '../../../wailsjs/go/handlers/App';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useToast } from '../../hooks/useToast';

interface NewProjectDialogProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function NewProjectDialog({ onClose, onCreated }: NewProjectDialogProps) {
  const [projectName, setProjectName] = useState('');
  const [parentPath, setParentPath] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleSelectDirectory = async () => {
    try {
      const path = await SelectDirectory('Select parent directory for new project');
      if (path) {
        setParentPath(path);
      }
    } catch (err: any) {
      if (err.message && !err.message.includes('cancelled')) {
        toast.error(err.message || 'Failed to select directory');
      }
    }
  };

  const handleCreate = async () => {
    if (!projectName.trim()) {
      toast.error('Project name is required');
      return;
    }

    if (!parentPath.trim()) {
      toast.error('Parent directory is required');
      return;
    }

    setLoading(true);
    try {
      await CreateNewProject(projectName.trim(), parentPath);
      toast.success(`Project "${projectName}" created successfully`);
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-hugo-bg-secondary rounded-lg p-6 w-96 border border-hugo-border-default">
        <h3 className="text-xl font-semibold mb-4 text-hugo-text-primary">Create New Project</h3>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-hugo-text-secondary mb-2">
              Project Name
            </label>
            <Input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="my-hugo-site"
              className="w-full"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') onClose();
              }}
            />
            <p className="text-xs text-hugo-text-tertiary mt-1">
              This will be the name of your project directory
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-hugo-text-secondary mb-2">
              Parent Directory
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={parentPath}
                onChange={(e) => setParentPath(e.target.value)}
                placeholder="Select directory..."
                className="flex-1"
                readOnly
              />
              <Button
                onClick={handleSelectDirectory}
                variant="secondary"
                size="sm"
              >
                Browse
              </Button>
            </div>
            <p className="text-xs text-hugo-text-tertiary mt-1">
              Where to create the new project
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button
            onClick={onClose}
            variant="secondary"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            variant="primary"
            isLoading={loading}
            disabled={!projectName.trim() || !parentPath.trim()}
          >
            Create Project
          </Button>
        </div>
      </div>
    </div>
  );
}






