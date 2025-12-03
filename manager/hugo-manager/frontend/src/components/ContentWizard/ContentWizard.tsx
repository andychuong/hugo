import { useState, useEffect } from 'react';
import { models } from '../../../wailsjs/go/models';
import { CreateContent, ListArchetypes } from '../../../wailsjs/go/handlers/App';
import { ContentOptions, Archetype } from '../../types';

type Project = models.Project;

interface ContentWizardProps {
  project: Project;
  onClose: () => void;
  onCreated?: () => void;
}

export default function ContentWizard({ project, onClose, onCreated }: ContentWizardProps) {
  const [title, setTitle] = useState('');
  const [path, setPath] = useState('');
  const [content, setContent] = useState('');
  const [format, setFormat] = useState('yaml');
  const [isDraft, setIsDraft] = useState(false);
  const [archetype, setArchetype] = useState('');
  const [archetypes, setArchetypes] = useState<Archetype[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1); // 1: Basic info, 2: Content, 3: Review

  // Load archetypes
  useEffect(() => {
    const loadArchetypes = async () => {
      try {
        const data = await ListArchetypes(project.id);
        setArchetypes(data);
      } catch (err) {
        // Ignore errors - archetypes are optional
      }
    };
    loadArchetypes();
  }, [project.id]);

  // Auto-generate path from title
  useEffect(() => {
    if (title && !path) {
      const sanitized = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
      setPath(`content/${sanitized}.md`);
    }
  }, [title, path]);

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const options: ContentOptions = {
        title: title.trim(),
        path: path.trim() || '',
        content: content.trim(),
        frontMatter: {},
        format: format,
        isDraft: isDraft,
        archetype: archetype || '',
      };

      await CreateContent(project.id, options);
      if (onCreated) {
        onCreated();
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create content');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 1 && !title.trim()) {
      setError('Title is required');
      return;
    }
    setStep(step + 1);
    setError(null);
  };

  const prevStep = () => {
    setStep(step - 1);
    setError(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Create New Content</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200"
          >
            ×
          </button>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div className={`flex-1 h-1 rounded ${step >= 1 ? 'bg-hugo-accent-teal' : 'bg-gray-700'}`} />
          <div className={`flex-1 h-1 rounded ${step >= 2 ? 'bg-hugo-accent-teal' : 'bg-gray-700'}`} />
          <div className={`flex-1 h-1 rounded ${step >= 3 ? 'bg-hugo-accent-teal' : 'bg-gray-700'}`} />
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-2 text-sm mb-4 rounded">
            {error}
          </div>
        )}

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Title <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-blue-500"
                placeholder="Content title"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Path
              </label>
              <input
                type="text"
                value={path}
                onChange={(e) => setPath(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 font-mono text-sm focus:outline-none focus:border-blue-500"
                placeholder="content/my-post.md"
              />
              <p className="text-xs text-gray-500 mt-1">
                Path will be auto-generated from title if left empty
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Archetype (optional)
              </label>
              <select
                value={archetype}
                onChange={(e) => setArchetype(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-blue-500"
              >
                <option value="">None</option>
                {archetypes.map((arch) => (
                  <option key={arch.name} value={arch.name}>
                    {arch.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Front Matter Format
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 focus:outline-none focus:border-blue-500"
              >
                <option value="yaml">YAML</option>
                <option value="toml">TOML</option>
                <option value="json">JSON</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="draft"
                checked={isDraft}
                onChange={(e) => setIsDraft(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="draft" className="text-sm text-gray-300">
                Create as draft
              </label>
            </div>
          </div>
        )}

        {/* Step 2: Content */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Content Body (Markdown)
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full h-64 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-gray-100 font-mono text-sm focus:outline-none focus:border-blue-500"
                placeholder="Enter your content here (Markdown supported)"
                spellCheck={false}
              />
              <p className="text-xs text-gray-500 mt-1">
                You can leave this empty and add content later
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-700 rounded p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-400">Title:</span>
                <span className="text-gray-200">{title || '(empty)'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Path:</span>
                <span className="text-gray-200 font-mono text-sm">{path || '(auto-generated)'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Format:</span>
                <span className="text-gray-200">{format.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Draft:</span>
                <span className="text-gray-200">{isDraft ? 'Yes' : 'No'}</span>
              </div>
              {archetype && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Archetype:</span>
                  <span className="text-gray-200">{archetype}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Content length:</span>
                <span className="text-gray-200">{content.length} characters</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-end gap-2 mt-6">
          {step > 1 && (
            <button
              onClick={prevStep}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
            >
              Previous
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={nextStep}
              className="px-4 py-2 bg-hugo-accent-teal hover:bg-hugo-accent-tealLight rounded"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleCreate}
              disabled={loading || !title.trim()}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Content'}
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

