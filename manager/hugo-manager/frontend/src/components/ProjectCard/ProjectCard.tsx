import { models } from '../../../wailsjs/go/models';
import Card from '../ui/Card';
import Badge from '../ui/Badge';

type Project = models.Project;

interface ProjectCardProps {
  project: Project;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onMenuClick?: (e: React.MouseEvent) => void;
}

export default function ProjectCard({ project, onClick, onContextMenu, onMenuClick }: ProjectCardProps) {
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
    <div 
      onContextMenu={onContextMenu}
      className="h-full group"
    >
      <Card 
        hover 
        onClick={onClick} 
        className="cursor-pointer h-full flex flex-col relative"
      >
        {/* Menu Button */}
        {onMenuClick && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMenuClick(e);
            }}
            className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-hugo-bg-secondary/80 hover:bg-hugo-bg-secondary opacity-0 group-hover:opacity-100 transition-opacity"
            title="More options"
          >
            <svg className="w-4 h-4 text-hugo-text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        )}
      
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
    </div>
  );
}

