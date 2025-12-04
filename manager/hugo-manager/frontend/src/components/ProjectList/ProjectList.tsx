import { useState, useEffect } from 'react';
import { GetProjects, ScanDirectory, SelectDirectory, RemoveProject, OpenInFileExplorer } from '../../../wailsjs/go/handlers/App';
import { models } from '../../../wailsjs/go/models';
import ProjectCard from '../ProjectCard/ProjectCard';
import Button from '../ui/Button';
import Input from '../ui/Input';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import ContextMenu, { useContextMenu, ContextMenuItem } from '../ui/ContextMenu';
import VirtualList from '../ui/VirtualList';
import { useToast } from '../../hooks/useToast';

type Project = models.Project;

interface ProjectListProps {
  onProjectSelect?: (project: Project) => void;
}

export default function ProjectList({ onProjectSelect }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu();
  const toast = useToast();

  const loadProjects = async () => {
    setLoading(true);
    try {
      const data = await GetProjects();
      setProjects(data || []);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleScanDirectory = async () => {
    try {
      const path = await SelectDirectory('Select directory to scan for Hugo projects');
      if (!path) return;

      setLoading(true);
      try {
        await ScanDirectory(path);
        await loadProjects();
        toast.success('Directory scanned successfully');
      } catch (err: any) {
        toast.error(err.message || 'Failed to scan directory');
      } finally {
        setLoading(false);
      }
    } catch (err: any) {
      // User cancelled or error occurred
      if (err.message && !err.message.includes('cancelled')) {
        toast.error(err.message || 'Failed to select directory');
      }
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleProjectContextMenu = (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    e.stopPropagation();

    const items: ContextMenuItem[] = [
      {
        id: 'open',
        label: 'Open Project',
        icon: '📂',
        handler: () => onProjectSelect?.(project),
      },
      {
        id: 'open-folder',
        label: 'Open in File Explorer',
        icon: '📁',
        handler: async () => {
          try {
            await OpenInFileExplorer(project.path);
          } catch (err: any) {
            toast.error(err.message || 'Failed to open file explorer');
          }
        },
      },
      { id: 'divider-1', label: '', handler: () => {}, divider: true },
      {
        id: 'remove',
        label: 'Remove Project',
        icon: '🗑️',
        handler: async () => {
          if (confirm(`Are you sure you want to remove "${project.name}"?`)) {
            try {
              await RemoveProject(project.id);
              toast.success('Project removed');
              await loadProjects();
            } catch (err: any) {
              toast.error(err.message || 'Failed to remove project');
            }
          }
        },
      },
    ];

    showContextMenu(items, e.clientX, e.clientY);
  };

  return (
    <div className="w-full">
      {/* Search and Actions Bar */}
      <div className="mb-4 flex items-center gap-2">
        <Input
          type="text"
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1"
        />
        <Button
          onClick={handleScanDirectory}
          variant="primary"
          isLoading={loading}
          size="sm"
          className="whitespace-nowrap"
        >
          Scan Directory
        </Button>
        <Button
          onClick={loadProjects}
          variant="secondary"
          isLoading={loading}
          size="sm"
        >
          Refresh
        </Button>
      </div>

      {/* Projects Section Header */}
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-hugo-text-primary">
          {searchQuery ? `Search Results (${filteredProjects.length})` : `Projects (${projects.length})`}
        </h2>
        {searchQuery && (
          <p className="text-xs text-hugo-text-tertiary mt-0.5">
            Searching for "{searchQuery}"
          </p>
        )}
      </div>

      {/* Projects Grid or Empty State */}
      {loading && projects.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="py-8">
          <EmptyState
            title={searchQuery ? 'No projects match your search' : 'No projects found'}
            description={searchQuery 
              ? 'Try adjusting your search terms' 
              : 'Get started by scanning a directory for Hugo projects'}
            action={!searchQuery ? {
              label: 'Scan for Hugo Projects',
              onClick: handleScanDirectory,
            } : undefined}
          />
        </div>
      ) : filteredProjects.length > 50 ? (
        // Use virtual scrolling for large lists
        <VirtualList
          items={filteredProjects}
          itemHeight={200} // Approximate card height
          containerHeight={600}
          renderItem={(project) => (
            <div className="p-2">
              <div
                onContextMenu={(e) => handleProjectContextMenu(e, project)}
              >
                <ProjectCard
                  project={project}
                  onClick={() => onProjectSelect?.(project)}
                />
              </div>
            </div>
          )}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onContextMenu={(e) => handleProjectContextMenu(e, project)}
            >
              <ProjectCard
                project={project}
                onClick={() => onProjectSelect?.(project)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          items={contextMenu.items}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={hideContextMenu}
        />
      )}
    </div>
  );
}

