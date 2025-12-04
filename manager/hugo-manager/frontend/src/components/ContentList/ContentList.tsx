import { useState, useEffect, useCallback } from 'react';
import { models } from '../../../wailsjs/go/models';
import { ListContent } from '../../../wailsjs/go/handlers/App';
import { ContentList as ContentListType, Content } from '../../types';
import ContentEditor from '../ContentEditor/ContentEditor';
import { copyContentMarkdown } from '../../utils/copyMarkdown';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../ui/ToastContainer';

type Project = models.Project;

interface ContentListProps {
  project: Project;
  refreshTrigger?: number; // Add refresh trigger prop
  onNewContent?: () => void;
}

export default function ContentList({ project, refreshTrigger, onNewContent }: ContentListProps) {
  const [contentList, setContentList] = useState<ContentListType | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState('content');
  const toast = useToast();

  // Load content list
  const loadContent = useCallback(async (path: string = 'content') => {
    setLoading(true);
    setError(null);
    try {
      const data = await ListContent(project.id, path);
      setContentList(data);
      setCurrentPath(path);
    } catch (err: any) {
      setError(err.message || 'Failed to load content');
    } finally {
      setLoading(false);
    }
  }, [project.id]);

  useEffect(() => {
    loadContent();
  }, [loadContent, refreshTrigger]); // Add refreshTrigger to dependencies

  const handleContentSelect = (content: Content) => {
    setSelectedContent(content.path);
  };

  const handleContentSaved = () => {
    loadContent(currentPath);
    setSelectedContent(null);
  };

  const handleCloseEditor = () => {
    setSelectedContent(null);
  };

  // Copy content markdown to clipboard
  const handleCopyContentMarkdown = async (content: Content) => {
    try {
      await copyContentMarkdown(content.path, content.title || undefined);
      toast.success('Content markdown copied to clipboard!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to copy content markdown');
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-hugo-bg-secondary border-b border-hugo-border-default px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-hugo-text-secondary">Content Files</span>
          {contentList && (
            <span className="text-xs text-hugo-text-tertiary">
              ({contentList.total} {contentList.total === 1 ? 'file' : 'files'})
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onNewContent && (
            <button
              onClick={onNewContent}
              className="px-3 py-1 bg-hugo-accent-blue hover:bg-hugo-accent-blueLight rounded text-sm text-white uppercase tracking-wide h-7"
            >
              + New Content
            </button>
          )}
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 text-sm">
          {error}
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Content list */}
        <div className="w-1/3 border-r border-gray-700 overflow-y-auto bg-gray-900">
          {loading ? (
            <div className="p-4 text-gray-400 text-center">Loading...</div>
          ) : contentList && contentList.items.length > 0 ? (
            <div className="p-2 space-y-1">
              {contentList.items.map((content) => (
                <div
                  key={content.id}
                  className={`group p-3 rounded cursor-pointer hover:bg-gray-800 ${
                    selectedContent === content.path ? 'bg-gray-800 border border-blue-500' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div 
                      className="flex-1 min-w-0"
                      onClick={() => handleContentSelect(content)}
                    >
                      <div className="text-sm font-medium text-gray-200 truncate">
                        {content.title || content.path}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 truncate">
                        {content.path}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {content.isDraft && (
                          <span className="px-2 py-0.5 bg-yellow-900/50 text-yellow-200 text-xs rounded">
                            Draft
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          {new Date(content.modTime).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopyContentMarkdown(content);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 bg-hugo-accent-teal hover:bg-hugo-accent-tealLight rounded text-xs text-white ml-2"
                      title="Copy markdown link"
                    >
                      📋
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-gray-400 text-center">
              No content files found
            </div>
          )}
        </div>

        {/* Content editor */}
        <div className="flex-1">
          {selectedContent ? (
            <ContentEditor
              project={project}
              contentPath={selectedContent}
              onClose={handleCloseEditor}
              onSaved={handleContentSaved}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              Select a content file to view or edit
            </div>
          )}
        </div>
      </div>

      {/* Toast notifications */}
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
    </div>
  );
}

