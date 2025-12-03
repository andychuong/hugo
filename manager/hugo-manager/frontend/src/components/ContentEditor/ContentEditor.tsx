import { useState, useEffect } from 'react';
import { models } from '../../../wailsjs/go/models';
import { 
  GetContent, 
  UpdateContent,
  DeleteContent 
} from '../../../wailsjs/go/handlers/App';
import { Content, ContentOptions } from '../../types';

type Project = models.Project;

interface ContentEditorProps {
  project: Project;
  contentPath: string | null;
  onClose?: () => void;
  onSaved?: () => void;
}

export default function ContentEditor({ project, contentPath, onClose, onSaved }: ContentEditorProps) {
  const [content, setContent] = useState<Content | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editFrontMatter, setEditFrontMatter] = useState<Record<string, any>>({});
  const [editFormat, setEditFormat] = useState('yaml');
  const [editIsDraft, setEditIsDraft] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Load content when path changes
  useEffect(() => {
    if (contentPath) {
      loadContent();
    } else {
      setContent(null);
    }
  }, [contentPath, project.id]);

  const loadContent = async () => {
    if (!contentPath) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await GetContent(project.id, contentPath);
      setContent(data);
      setEditTitle(data.title || '');
      setEditContent(data.content || '');
      setEditFrontMatter(data.frontMatter || {});
      setEditFormat(data.format || 'yaml');
      setEditIsDraft(data.isDraft || false);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!contentPath) return;

    setLoading(true);
    setError(null);
    try {
      const options: ContentOptions = {
        title: editTitle,
        path: contentPath || '',
        content: editContent,
        frontMatter: editFrontMatter,
        format: editFormat,
        isDraft: editIsDraft,
        archetype: '',
      };

      await UpdateContent(project.id, contentPath, options);
      setIsEditing(false);
      await loadContent();
      if (onSaved) {
        onSaved();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save content');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!contentPath) return;

    setLoading(true);
    setError(null);
    try {
      await DeleteContent(project.id, contentPath);
      setShowDeleteConfirm(false);
      if (onClose) {
        onClose();
      }
      if (onSaved) {
        onSaved();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete content');
    } finally {
      setLoading(false);
    }
  };

  const updateFrontMatterField = (key: string, value: any) => {
    setEditFrontMatter(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const removeFrontMatterField = (key: string) => {
    setEditFrontMatter(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const addFrontMatterField = () => {
    const key = prompt('Enter field name:');
    if (key && key.trim()) {
      updateFrontMatterField(key.trim(), '');
    }
  };

  if (!contentPath) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        Select a content file to edit
      </div>
    );
  }

  if (loading && !content) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        Loading...
      </div>
    );
  }

  if (error && !content) {
    return (
      <div className="p-4 bg-red-900/50 border border-red-700 text-red-200">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-300">{content?.title || contentPath}</span>
          {content?.isDraft && (
            <span className="px-2 py-1 bg-yellow-900/50 text-yellow-200 text-xs rounded">Draft</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                disabled={loading}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 rounded text-sm disabled:opacity-50"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  loadContent();
                }}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="px-3 py-1 bg-hugo-accent-teal hover:bg-hugo-accent-tealLight rounded text-sm"
              >
                Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
              >
                Delete
              </button>
            </>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              Close
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

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {isEditing ? (
          <div className="p-4 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-blue-500"
                placeholder="Content title"
              />
            </div>

            {/* Draft toggle */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="draft"
                checked={editIsDraft}
                onChange={(e) => setEditIsDraft(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="draft" className="text-sm text-gray-300">Draft</label>
            </div>

            {/* Format selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Front Matter Format</label>
              <select
                value={editFormat}
                onChange={(e) => setEditFormat(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-blue-500"
              >
                <option value="yaml">YAML</option>
                <option value="toml">TOML</option>
                <option value="json">JSON</option>
              </select>
            </div>

            {/* Front Matter Editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Front Matter</label>
                <button
                  onClick={addFrontMatterField}
                  className="px-2 py-1 bg-hugo-accent-teal hover:bg-hugo-accent-tealLight rounded text-xs"
                >
                  + Add Field
                </button>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded p-3 space-y-2">
                {Object.entries(editFrontMatter).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={key}
                      readOnly
                      className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-sm text-gray-300"
                    />
                    <input
                      type="text"
                      value={String(value)}
                      onChange={(e) => {
                        // Try to parse as number or boolean
                        let parsedValue: any = e.target.value;
                        if (e.target.value === 'true') parsedValue = true;
                        else if (e.target.value === 'false') parsedValue = false;
                        else if (!isNaN(Number(e.target.value)) && e.target.value !== '') {
                          parsedValue = Number(e.target.value);
                        }
                        updateFrontMatterField(key, parsedValue);
                      }}
                      className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={() => removeFrontMatterField(key)}
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {Object.keys(editFrontMatter).length === 0 && (
                  <div className="text-sm text-gray-500 text-center py-2">
                    No front matter fields. Click "+ Add Field" to add one.
                  </div>
                )}
              </div>
            </div>

            {/* Content Editor */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Content</label>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full h-64 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-gray-100 font-mono text-sm focus:outline-none focus:border-blue-500"
                placeholder="Content body (Markdown)"
                spellCheck={false}
              />
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4">
            {/* Metadata */}
            <div className="bg-gray-800 border border-gray-700 rounded p-3">
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-400">Path:</span>
                  <span className="text-gray-200 font-mono">{content?.path}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Format:</span>
                  <span className="text-gray-200">{content?.format.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Draft:</span>
                  <span className="text-gray-200">{content?.isDraft ? 'Yes' : 'No'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Modified:</span>
                  <span className="text-gray-200">
                    {content?.modTime ? new Date(content.modTime).toLocaleString() : 'Unknown'}
                  </span>
                </div>
              </div>
            </div>

            {/* Front Matter Preview */}
            {content && Object.keys(content.frontMatter).length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Front Matter</label>
                <pre className="bg-gray-800 border border-gray-700 rounded p-3 text-sm text-gray-200 font-mono overflow-x-auto">
                  {JSON.stringify(content.frontMatter, null, 2)}
                </pre>
              </div>
            )}

            {/* Content Preview */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Content</label>
              <pre className="bg-gray-800 border border-gray-700 rounded p-3 text-sm text-gray-200 font-mono whitespace-pre-wrap">
                {content?.content || '(empty)'}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Delete Content</h3>
            <p className="text-gray-300 mb-4">
              Are you sure you want to delete "{content?.title || contentPath}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

