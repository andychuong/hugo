import { useState } from 'react';
import { models } from '../../../../wailsjs/go/models';
import ThemeBrowser from '../../ThemeBrowser/ThemeBrowser';
import ThemeManager from '../../ThemeManager/ThemeManager';

type Project = models.Project;

interface ThemesTabProps {
  project: Project;
  onProjectUpdate?: () => void;
}

export default function ThemesTab({ project, onProjectUpdate }: ThemesTabProps) {
  const [browseThemesExpanded, setBrowseThemesExpanded] = useState(true);

  return (
    <div className="p-6 space-y-6">
      {/* Browse Themes - Collapsible */}
      <div className="border-b border-hugo-border-default pb-4">
        <button
          onClick={() => setBrowseThemesExpanded(!browseThemesExpanded)}
          className="flex items-center gap-2 w-full text-left mb-4 group"
        >
          <svg
            className={`w-5 h-5 text-hugo-text-tertiary transition-transform ${browseThemesExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <h3 className="text-lg font-semibold text-hugo-text-primary">Browse Themes</h3>
        </button>
        {browseThemesExpanded && (
          <ThemeBrowser project={project} onThemeInstalled={onProjectUpdate} />
        )}
      </div>
      
      {/* Installed Themes */}
      <div className="border-b border-hugo-border-default pb-4">
        <div className="flex items-center gap-2 mb-4">
          <svg
            className="w-5 h-5 text-hugo-text-tertiary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <h3 className="text-lg font-semibold text-hugo-text-primary">Installed Themes</h3>
        </div>
        <ThemeManager project={project} onThemeRemoved={onProjectUpdate} />
      </div>
    </div>
  );
}

