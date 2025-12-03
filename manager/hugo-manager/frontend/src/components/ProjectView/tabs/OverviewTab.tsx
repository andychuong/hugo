import { models } from '../../../../wailsjs/go/models';

type Project = models.Project;

interface OverviewTabProps {
  project: Project;
}

export default function OverviewTab({ project }: OverviewTabProps) {
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Never';
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return 'Unknown';
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Project Information</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-gray-400">Name:</span>
            <p className="text-white font-medium">{project.name}</p>
          </div>
          <div>
            <span className="text-gray-400">Path:</span>
            <p className="text-white font-mono text-sm">{project.path}</p>
          </div>
          <div>
            <span className="text-gray-400">Hugo Version:</span>
            <p className="text-white">{project.hugoVersion || 'Unknown'}</p>
          </div>
          <div>
            <span className="text-gray-400">Created:</span>
            <p className="text-white">{formatDate(project.createdAt)}</p>
          </div>
          <div>
            <span className="text-gray-400">Last Build:</span>
            <p className="text-white">{formatDate(project.lastBuild)}</p>
          </div>
          <div>
            <span className="text-gray-400">Environment:</span>
            <p className="text-white">{project.config?.environment || 'development'}</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Configuration</h2>
        <div className="space-y-3">
          {project.config?.title && (
            <div>
              <span className="text-gray-400">Title:</span>
              <p className="text-white">{project.config.title}</p>
            </div>
          )}
          {project.config?.baseURL && (
            <div>
              <span className="text-gray-400">Base URL:</span>
              <p className="text-white">{project.config.baseURL}</p>
            </div>
          )}
          <div>
            <span className="text-gray-400">Publish Directory:</span>
            <p className="text-white">{project.config?.publishDir || 'public'}</p>
          </div>
          {project.config && project.config.themes && project.config.themes.length > 0 && (
            <div>
              <span className="text-gray-400">Themes:</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {project.config.themes.map((theme, idx) => (
                  <span key={idx} className="px-2 py-1 bg-hugo-accent-teal/20 rounded text-sm">
                    {theme}
                  </span>
                ))}
              </div>
            </div>
          )}
          {project.config && project.config.languages && project.config.languages.length > 0 && (
            <div>
              <span className="text-gray-400">Languages:</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {project.config.languages.map((lang, idx) => (
                  <span key={idx} className="px-2 py-1 bg-green-900/50 rounded text-sm">
                    {lang}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {project.status?.errorMessage && (
        <div className="bg-red-900/50 border border-red-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2 text-red-200">Error</h2>
          <p className="text-red-200">{project.status.errorMessage}</p>
        </div>
      )}
    </div>
  );
}

