import { models } from '../../../wailsjs/go/models';
import Card from '../ui/Card';
import Badge from '../ui/Badge';

type Project = models.Project;

interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
}

export default function ProjectCard({ project, onClick }: ProjectCardProps) {
  const getStatusBadge = () => {
    if (!project.status) return null;
    if (project.status.hasErrors) return <Badge variant="error">Error</Badge>;
    if (project.status.isBuilding) return <Badge variant="warning">Building</Badge>;
    if (project.status.isServing) return <Badge variant="success">Serving</Badge>;
    return <Badge variant="neutral">Idle</Badge>;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  return (
    <Card hover onClick={onClick} className="cursor-pointer h-full flex flex-col">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-2">
          <h3 className="text-lg font-semibold mb-1 text-hugo-text-primary truncate">
            {project.name}
          </h3>
          <p className="text-xs text-hugo-text-tertiary truncate" title={project.path}>
            {project.path}
          </p>
        </div>
        <div className="ml-2 flex-shrink-0">
          {getStatusBadge()}
        </div>
      </div>

      <div className="space-y-2 text-sm flex-1">
        <div className="flex items-center justify-between">
          <span className="text-hugo-text-tertiary">Hugo Version:</span>
          <span className="text-hugo-text-primary font-medium">{project.hugoVersion || 'Unknown'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-hugo-text-tertiary">Last Build:</span>
          <span className="text-hugo-text-primary">{formatDate(project.lastBuild)}</span>
        </div>
        {project.config?.title && (
          <div className="flex items-center justify-between">
            <span className="text-hugo-text-tertiary">Title:</span>
            <span className="text-hugo-text-primary truncate ml-2">{project.config.title}</span>
          </div>
        )}
        {project.themes && project.themes.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-hugo-text-tertiary">Themes:</span>
            <span className="text-hugo-text-primary">{project.themes.length}</span>
          </div>
        )}
      </div>

      {project.status?.errorMessage && (
        <div className="mt-4 p-3 bg-red-900/30 border border-red-700 rounded-lg text-xs text-red-200">
          {project.status.errorMessage}
        </div>
      )}
    </Card>
  );
}

