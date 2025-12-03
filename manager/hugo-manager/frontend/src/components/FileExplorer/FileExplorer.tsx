import { useState, useEffect, useCallback } from 'react';
import { models } from '../../../wailsjs/go/models';
import { 
  GetProjectStructure, 
  ReadFile, 
  WriteFile, 
  CreateFile, 
  DeleteFile, 
  RenameFile, 
  CreateDirectory 
} from '../../../wailsjs/go/handlers/App';

type Project = models.Project;
type FileInfo = models.FileInfo;

interface FileExplorerProps {
  project: Project;
}

interface TreeNode {
  path: string;
  name: string;
  isDir: boolean;
  extension: string;
  children?: TreeNode[];
  loaded?: boolean;
  loading?: boolean;
}

export default function FileExplorer({ project }: FileExplorerProps) {
  const [rootNodes, setRootNodes] = useState<TreeNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['.']));
  const [loadedPaths, setLoadedPaths] = useState<Map<string, TreeNode[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState<string>('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createType, setCreateType] = useState<'file' | 'directory'>('file');
  const [createName, setCreateName] = useState('');
  const [createPath, setCreatePath] = useState<string>('.');
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');

  // Load files for a path
  const loadFiles = useCallback(async (path: string): Promise<TreeNode[]> => {
    try {
      const fileList = await GetProjectStructure(project.id, path);
      // Sort: directories first, then files, both alphabetically
      const sorted = fileList.sort((a: FileInfo, b: FileInfo) => {
        if (a.isDir !== b.isDir) {
          return a.isDir ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
      
      return sorted.map(file => ({
        path: file.path,
        name: file.name,
        isDir: file.isDir,
        extension: file.extension,
        children: file.isDir ? [] : undefined,
        loaded: false,
      }));
    } catch (err: any) {
      throw new Error(err.message || 'Failed to load files');
    }
  }, [project.id]);

  // Load root files
  useEffect(() => {
    const loadRoot = async () => {
      setLoading(true);
      setError(null);
      try {
        const files = await loadFiles('.');
        setRootNodes(files);
        setLoadedPaths(new Map([['.', files]]));
      } catch (err: any) {
        setError(err.message || 'Failed to load files');
      } finally {
        setLoading(false);
      }
    };
    loadRoot();
  }, [project.id, loadFiles]);

  // Load children for a directory
  const loadChildren = useCallback(async (nodePath: string, forceRefresh: boolean = false) => {
    if (!forceRefresh && loadedPaths.has(nodePath)) {
      return; // Already loaded
    }

    // Mark as loading
    setLoadedPaths(prev => {
      const newMap = new Map(prev);
      const nodes = newMap.get(nodePath === '.' ? '.' : nodePath) || [];
      const updatedNodes = nodes.map(node => 
        node.path === nodePath ? { ...node, loading: true } : node
      );
      newMap.set(nodePath === '.' ? '.' : nodePath, updatedNodes);
      return newMap;
    });

    try {
      const children = await loadFiles(nodePath);
      
      setLoadedPaths(prev => {
        const newMap = new Map(prev);
        const nodes = newMap.get(nodePath === '.' ? '.' : nodePath) || [];
        const updatedNodes = nodes.map(node => 
          node.path === nodePath 
            ? { ...node, children, loaded: true, loading: false }
            : node
        );
        newMap.set(nodePath === '.' ? '.' : nodePath, updatedNodes);
        newMap.set(nodePath, children);
        return newMap;
      });

      // Update root nodes if this is the root
      if (nodePath === '.') {
        setRootNodes(children);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load directory');
      // Remove loading state on error
      setLoadedPaths(prev => {
        const newMap = new Map(prev);
        const nodes = newMap.get(nodePath === '.' ? '.' : nodePath) || [];
        const updatedNodes = nodes.map(node => 
          node.path === nodePath ? { ...node, loading: false } : node
        );
        newMap.set(nodePath === '.' ? '.' : nodePath, updatedNodes);
        return newMap;
      });
    }
  }, [loadFiles, loadedPaths]);

  // Toggle folder expansion
  const toggleExpand = useCallback(async (nodePath: string) => {
    const isExpanded = expandedPaths.has(nodePath);
    
    if (isExpanded) {
      // Collapse
      setExpandedPaths(prev => {
        const next = new Set(prev);
        next.delete(nodePath);
        return next;
      });
    } else {
      // Expand - load children if not loaded
      setExpandedPaths(prev => new Set([...prev, nodePath]));
      await loadChildren(nodePath);
    }
  }, [expandedPaths, loadChildren]);

  // Load file content
  const loadFileContent = async (filePath: string) => {
    setLoading(true);
    setError(null);
    try {
      const content = await ReadFile(project.id, filePath);
      setFileContent(content);
      setEditContent(content);
      setSelectedFile(filePath);
      setIsEditing(false);
    } catch (err: any) {
      setError(err.message || 'Failed to load file');
    } finally {
      setLoading(false);
    }
  };

  // Save file content
  const saveFile = async () => {
    if (!selectedFile) return;
    setLoading(true);
    setError(null);
    try {
      await WriteFile(project.id, selectedFile, editContent);
      setFileContent(editContent);
      setIsEditing(false);
      // Reload the parent directory
      const parentPath = selectedFile.includes('/') 
        ? selectedFile.substring(0, selectedFile.lastIndexOf('/'))
        : '.';
      if (loadedPaths.has(parentPath)) {
        await loadChildren(parentPath);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save file');
    } finally {
      setLoading(false);
    }
  };

  // Create file or directory
  const handleCreate = async () => {
    if (!createName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const newPath = createPath === '.' ? createName : `${createPath}/${createName}`;
      if (createType === 'file') {
        await CreateFile(project.id, newPath, '');
      } else {
        await CreateDirectory(project.id, newPath);
      }
      setShowCreateDialog(false);
      setCreateName('');
      
      // Reload the parent directory (force refresh to see new file)
      await loadChildren(createPath, true);
      
      // Expand parent if not already expanded
      if (!expandedPaths.has(createPath)) {
        setExpandedPaths(prev => new Set([...prev, createPath]));
      }
      
      // If creating at root, also ensure root is visible
      if (createPath === '.') {
        setExpandedPaths(prev => new Set([...prev, '.']));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create');
    } finally {
      setLoading(false);
    }
  };

  // Delete file or directory
  const handleDelete = async (filePath: string) => {
    if (!confirm(`Are you sure you want to delete ${filePath}?`)) return;
    setLoading(true);
    setError(null);
    try {
      await DeleteFile(project.id, filePath);
      if (selectedFile === filePath) {
        setSelectedFile(null);
        setFileContent('');
      }
      // Reload parent directory (force refresh)
      const parentPath = filePath.includes('/') 
        ? filePath.substring(0, filePath.lastIndexOf('/'))
        : '.';
      await loadChildren(parentPath, true);
      
      // Also reload root if deleting from root
      if (parentPath === '.') {
        const files = await loadFiles('.');
        setRootNodes(files);
        setLoadedPaths(prev => {
          const newMap = new Map(prev);
          newMap.set('.', files);
          return newMap;
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  // Rename file or directory
  const handleRename = async () => {
    if (!renameTarget || !renameName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await RenameFile(project.id, renameTarget, renameName);
      setShowRenameDialog(false);
      setRenameTarget(null);
      setRenameName('');
      // Update selected file if it was renamed
      if (selectedFile === renameTarget) {
        const newPath = renameTarget.includes('/')
          ? renameTarget.substring(0, renameTarget.lastIndexOf('/')) + '/' + renameName
          : renameName;
        setSelectedFile(newPath);
      }
      // Reload parent directory (force refresh)
      const parentPath = renameTarget.includes('/') 
        ? renameTarget.substring(0, renameTarget.lastIndexOf('/'))
        : '.';
      await loadChildren(parentPath, true);
      
      // Also reload root if renaming from root
      if (parentPath === '.') {
        const files = await loadFiles('.');
        setRootNodes(files);
        setLoadedPaths(prev => {
          const newMap = new Map(prev);
          newMap.set('.', files);
          return newMap;
        });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to rename');
    } finally {
      setLoading(false);
    }
  };

  // Check if file is editable
  const isEditable = (filePath: string): boolean => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    return ['md', 'txt', 'toml', 'yaml', 'yml', 'json', 'html', 'css', 'js', 'ts', 'tsx', 'jsx'].includes(ext || '');
  };

  // Render tree node recursively
  const renderTreeNode = (node: TreeNode, depth: number = 0): JSX.Element => {
    const isExpanded = expandedPaths.has(node.path);
    const hasChildren = node.isDir && (node.children?.length || 0) > 0;
    const isLoading = node.loading;
    const children = loadedPaths.get(node.path) || node.children || [];

    return (
      <div key={node.path}>
        <div
          className={`group flex items-center gap-2 p-1 rounded hover:bg-hugo-bg-tertiary cursor-pointer ${
            selectedFile === node.path ? 'bg-hugo-bg-tertiary' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={(e) => {
            if (node.isDir) {
              e.stopPropagation();
              toggleExpand(node.path);
            } else {
              loadFileContent(node.path);
            }
          }}
        >
          {/* Expand/collapse icon for directories */}
          <span className="w-4 text-xs text-hugo-text-muted">
            {node.isDir ? (
              isLoading ? (
                '⟳'
              ) : isExpanded ? (
                '▼'
              ) : (
                '▶'
              )
            ) : (
              ' '
            )}
          </span>
          
          {/* File/folder icon */}
          <span className="text-lg">
            {node.isDir ? '📁' : getFileIcon(node.extension)}
          </span>
          
          {/* File name */}
          <span className="flex-1 text-sm truncate">{node.name}</span>
          
          {/* Action buttons */}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setRenameTarget(node.path);
                setRenameName(node.name);
                setShowRenameDialog(true);
              }}
              className="p-1 hover:bg-hugo-bg-tertiary rounded text-xs"
              title="Rename"
            >
              ✏️
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(node.path);
              }}
              className="p-1 hover:bg-red-900 rounded text-xs"
              title="Delete"
            >
              🗑️
            </button>
            {node.isDir && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCreatePath(node.path);
                  setCreateType('file');
                  setShowCreateDialog(true);
                }}
                className="p-1 hover:bg-hugo-bg-tertiary rounded text-xs"
                title="Create file here"
              >
                +
              </button>
            )}
          </div>
        </div>
        
        {/* Render children if expanded */}
        {node.isDir && isExpanded && children.length > 0 && (
          <div>
            {children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="bg-hugo-bg-secondary border-b border-hugo-border-default px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-hugo-text-secondary">{project.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setCreatePath('.');
              setCreateType('file');
              setShowCreateDialog(true);
            }}
            className="px-3 py-1 bg-hugo-accent-blue hover:bg-hugo-accent-blueLight rounded text-sm text-white uppercase tracking-wide h-7"
          >
            + File
          </button>
          <button
            onClick={() => {
              setCreatePath('.');
              setCreateType('directory');
              setShowCreateDialog(true);
            }}
            className="px-3 py-1 bg-hugo-accent-blue hover:bg-hugo-accent-blueLight rounded text-sm text-white uppercase tracking-wide h-7"
          >
            + Folder
          </button>
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
        {/* File tree */}
        <div className="w-1/3 border-r border-hugo-border-default overflow-y-auto bg-hugo-bg-primary">
          {loading && rootNodes.length === 0 ? (
            <div className="p-4 text-hugo-text-tertiary text-center">Loading...</div>
          ) : rootNodes.length === 0 ? (
            <div className="p-4 text-hugo-text-tertiary text-center">Empty directory</div>
          ) : (
            <div className="p-2">
              {rootNodes.map(node => renderTreeNode(node, 0))}
            </div>
          )}
        </div>

        {/* File content viewer/editor */}
        <div className="flex-1 flex flex-col bg-hugo-bg-primary">
          {selectedFile ? (
            <>
              <div className="border-b border-hugo-border-default p-2 flex items-center justify-between bg-hugo-bg-secondary">
                <span className="text-sm font-mono text-hugo-text-secondary">{selectedFile}</span>
                <div className="flex items-center gap-2">
                  {isEditable(selectedFile) && (
                    <>
                      {isEditing ? (
                        <>
                          <button
                            onClick={saveFile}
                            disabled={loading}
                            className="px-3 py-1 bg-hugo-accent-teal hover:bg-hugo-accent-tealLight rounded text-sm disabled:opacity-50"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setIsEditing(false);
                              setEditContent(fileContent);
                            }}
                            className="px-3 py-1 bg-hugo-bg-tertiary hover:bg-hugo-bg-hover rounded text-sm"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setIsEditing(true)}
                          className="px-3 py-1 bg-hugo-accent-teal hover:bg-hugo-accent-tealLight rounded text-sm"
                        >
                          Edit
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {isEditing ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-full bg-hugo-bg-primary text-hugo-text-primary font-mono text-sm p-4 rounded border border-hugo-border-default focus:outline-none focus:border-hugo-accent-teal"
                    spellCheck={false}
                  />
                ) : (
                  <pre className="text-hugo-text-primary font-mono text-sm whitespace-pre-wrap">
                    {fileContent || '(empty file)'}
                  </pre>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-hugo-text-tertiary">
              Select a file to view its contents
            </div>
          )}
        </div>
      </div>

      {/* Create dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-hugo-bg-secondary rounded-lg p-6 w-96 border border-hugo-border-default">
            <h3 className="text-lg font-semibold mb-4">
              Create {createType === 'file' ? 'File' : 'Directory'}
            </h3>
            <input
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder={`Enter ${createType} name`}
                    className="w-full px-3 py-2 bg-hugo-bg-tertiary border border-hugo-border-default rounded mb-4 focus:outline-none focus:border-hugo-accent-teal text-hugo-text-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setShowCreateDialog(false);
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateDialog(false);
                  setCreateName('');
                }}
                className="px-4 py-2 bg-hugo-bg-tertiary hover:bg-hugo-bg-hover rounded text-hugo-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!createName.trim() || loading}
                className="px-4 py-2 bg-hugo-accent-teal hover:bg-hugo-accent-tealLight rounded disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename dialog */}
      {showRenameDialog && renameTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-hugo-bg-secondary rounded-lg p-6 w-96 border border-hugo-border-default">
            <h3 className="text-lg font-semibold mb-4">Rename</h3>
            <input
              type="text"
              value={renameName}
              onChange={(e) => setRenameName(e.target.value)}
              placeholder="Enter new name"
                    className="w-full px-3 py-2 bg-hugo-bg-tertiary border border-hugo-border-default rounded mb-4 focus:outline-none focus:border-hugo-accent-teal text-hugo-text-primary"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename();
                if (e.key === 'Escape') setShowRenameDialog(false);
              }}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRenameDialog(false);
                  setRenameTarget(null);
                  setRenameName('');
                }}
                className="px-4 py-2 bg-hugo-bg-tertiary hover:bg-hugo-bg-hover rounded text-hugo-text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleRename}
                disabled={!renameName.trim() || loading}
                className="px-4 py-2 bg-hugo-accent-teal hover:bg-hugo-accent-tealLight rounded disabled:opacity-50"
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Get file icon based on extension
function getFileIcon(ext: string): string {
  const icons: Record<string, string> = {
    md: '📝',
    txt: '📄',
    toml: '⚙️',
    yaml: '⚙️',
    yml: '⚙️',
    json: '📋',
    html: '🌐',
    css: '🎨',
    js: '📜',
    ts: '📜',
    tsx: '⚛️',
    jsx: '⚛️',
    go: '🐹',
    png: '🖼️',
    jpg: '🖼️',
    jpeg: '🖼️',
    gif: '🖼️',
    svg: '🖼️',
  };
  return icons[ext.toLowerCase()] || '📄';
}
