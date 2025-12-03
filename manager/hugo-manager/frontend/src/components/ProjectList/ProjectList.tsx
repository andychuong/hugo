import { useState, useEffect } from 'react';
import { GetProjects, ScanDirectory, SelectDirectory } from '../../../wailsjs/go/handlers/App';
import { models } from '../../../wailsjs/go/models';
import ProjectCard from '../ProjectCard/ProjectCard';
import Button from '../ui/Button';
import Input from '../ui/Input';
import LoadingSpinner from '../ui/LoadingSpinner';
import EmptyState from '../ui/EmptyState';
import { useToast } from '../../hooks/useToast';

type Project = models.Project;

interface ProjectListProps {
  onProjectSelect?: (project: Project) => void;
}

export default function ProjectList({ onProjectSelect }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => onProjectSelect?.(project)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

