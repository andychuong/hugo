import { useState, useEffect, useCallback, useRef } from 'react';
import ContextMenu, { useContextMenu, ContextMenuItem } from '../ui/ContextMenu';
import { models } from '../../../wailsjs/go/models';
import { 
  GetProjectStructure, 
  ReadFile,
  ReadFileAsBase64,
  WriteFile, 
  CreateFile, 
  DeleteFile, 
  RenameFile, 
  CreateDirectory,
  OpenFileDialog,
  OpenMultipleFilesDialog,
  CopyFileFromExternal,
  CopyFile
} from '../../../wailsjs/go/handlers/App';
import { OnFileDrop, OnFileDropOff } from '../../../wailsjs/runtime/runtime';
import { copyImageMarkdown } from '../../utils/copyMarkdown';
import { useToast } from '../../hooks/useToast';
import ToastContainer from '../ui/ToastContainer';

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
  const [fileImageData, setFileImageData] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState<string>('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createType, setCreateType] = useState<'file' | 'directory'>('file');
  const [createName, setCreateName] = useState('');
  const [createPath, setCreatePath] = useState<string>('.');
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [renameName, setRenameName] = useState('');
  const [uploadTargetPath, setUploadTargetPath] = useState<string>('.');
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<TreeNode | null>(null);
  const { contextMenu, showContextMenu, hideContextMenu } = useContextMenu();
  const fileExplorerRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

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

  // Handle file upload
  const handleUploadFiles = useCallback(async (filePaths: string[], targetPath: string) => {
    setLoading(true);
    setError(null);

    try {
      for (const filePath of filePaths) {
        // Get the filename from the external path
        const fileName = filePath.split(/[/\\]/).pop() || 'file';
        const destinationPath = targetPath === '.' ? fileName : `${targetPath}/${fileName}`;

        // Copy file from external location to project
        await CopyFileFromExternal(project.id, filePath, destinationPath);
      }

      // Reload the target directory to show new files
      await loadChildren(targetPath, true);
      
      // Expand target if not already expanded
      setExpandedPaths(prev => {
        if (!prev.has(targetPath)) {
          return new Set([...prev, targetPath]);
        }
        return prev;
      });
    } catch (err: any) {
      setError(err.message || 'Failed to upload files');
    } finally {
      setLoading(false);
    }
  }, [project.id, loadChildren]);

  // Helper function to find folder path at coordinates
  const findFolderAtPoint = useCallback((x: number, y: number): string | null => {
    const elementAtPoint = document.elementFromPoint(x, y);
    if (!elementAtPoint) return null;

    // Find the closest folder element (look for data-folder-path attribute)
    let targetElement: HTMLElement | null = elementAtPoint as HTMLElement;
    while (targetElement && !targetElement.dataset.folderPath) {
      targetElement = targetElement.parentElement;
    }

    return targetElement?.dataset.folderPath || null;
  }, []);

  // Move file or directory
  const handleMoveFile = useCallback(async (srcPath: string, dstPath: string) => {
    setLoading(true);
    setError(null);
    try {
      // Build destination path
      const fileName = srcPath.split('/').pop() || '';
      const destinationPath = dstPath === '.' ? fileName : `${dstPath}/${fileName}`;
      
      // Copy file to new location
      await CopyFile(project.id, srcPath, destinationPath);
      
      // Delete original file
      await DeleteFile(project.id, srcPath);
      
      // Update selected file if it was moved
      if (selectedFile === srcPath) {
        setSelectedFile(destinationPath);
      }
      
      // Reload both source and destination directories
      const srcParentPath = srcPath.includes('/') 
        ? srcPath.substring(0, srcPath.lastIndexOf('/'))
        : '.';
      await loadChildren(srcParentPath, true);
      await loadChildren(dstPath, true);
      
      // Reload root if needed
      if (srcParentPath === '.' || dstPath === '.') {
        const files = await loadFiles('.');
        setRootNodes(files);
        setLoadedPaths(prev => {
          const newMap = new Map(prev);
          newMap.set('.', files);
          return newMap;
        });
      }
      
      toast.success(`Moved ${srcPath} to ${destinationPath}`);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to move file';
      setError(errorMsg);
      toast.error(errorMsg);
      console.error('Move error:', err);
    } finally {
      setLoading(false);
    }
  }, [project.id, selectedFile, loadChildren, loadFiles, toast]);

  // Setup drag-and-drop with element detection and visual feedback
  useEffect(() => {
    const handleFileDrop = (x: number, y: number, paths: string[]) => {
      if (paths.length === 0) return;
      
      // Clear drag over state
      setDragOverPath(null);
      setDraggedNode(null);

      // Find the folder at drop coordinates
      const targetPath = findFolderAtPoint(x, y) || '.';

      // Copy files to the detected folder
      handleUploadFiles(paths, targetPath);
    };

    // Track mouse position during drag to show visual feedback
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault(); // Allow drop
      e.stopPropagation();

      // Check if this is an internal drag (has our custom data type)
      const isInternalDrag = e.dataTransfer?.types.includes('application/x-hugo-file');
      
      if (isInternalDrag) {
        // Internal drag - find folder at mouse position
        const targetPath = findFolderAtPoint(e.clientX, e.clientY);
        setDragOverPath(targetPath);
      } else if (e.dataTransfer?.types.includes('Files')) {
        // External file drag
        const targetPath = findFolderAtPoint(e.clientX, e.clientY);
        setDragOverPath(targetPath);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      // Only clear if we're actually leaving the container
      const container = fileExplorerRef.current;
      if (container && !container.contains(e.relatedTarget as Node)) {
        setDragOverPath(null);
      }
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Check if this is an internal drag
      const draggedPath = e.dataTransfer?.getData('application/x-hugo-file');
      
      if (draggedPath) {
        // Internal drag - move file
        const targetPath = findFolderAtPoint(e.clientX, e.clientY);
        if (targetPath && targetPath !== draggedPath) {
          // Don't allow dropping on self or parent
          const isParent = draggedPath.startsWith(targetPath + '/');
          if (!isParent && targetPath !== draggedPath) {
            await handleMoveFile(draggedPath, targetPath);
          }
        }
      }
      
      setDragOverPath(null);
      setDraggedNode(null);
    };

    // Enable file drop without drop target styling (useDropTarget = false)
    // We'll handle visual feedback ourselves with native drag events
    OnFileDrop(handleFileDrop, false);

    // Add native drag event listeners for visual feedback
    const container = fileExplorerRef.current;
    if (container) {
      container.addEventListener('dragover', handleDragOver);
      container.addEventListener('dragleave', handleDragLeave);
      container.addEventListener('drop', handleDrop);
    }

    return () => {
      OnFileDropOff();
      setDragOverPath(null);
      setDraggedNode(null);
      if (container) {
        container.removeEventListener('dragover', handleDragOver);
        container.removeEventListener('dragleave', handleDragLeave);
        container.removeEventListener('drop', handleDrop);
      }
    };
  }, [handleUploadFiles, findFolderAtPoint, handleMoveFile]);

  // Handle file upload button click
  const handleUploadClick = async () => {
    try {
      const filePath = await OpenFileDialog(
        'Select file to upload',
        'All Files|*.*|Images|*.png,*.jpg,*.jpeg,*.gif,*.svg,*.webp|Documents|*.md,*.txt,*.pdf'
      );
      
      if (!filePath) return; // User cancelled

      await handleUploadFiles([filePath], uploadTargetPath);
    } catch (err: any) {
      if (err.message && !err.message.includes('cancelled')) {
        setError(err.message || 'Failed to upload file');
      }
    }
  };

  // Handle multiple file upload
  const handleUploadMultipleClick = async () => {
    try {
      const filePaths = await OpenMultipleFilesDialog(
        'Select files to upload',
        'All Files|*.*|Images|*.png,*.jpg,*.jpeg,*.gif,*.svg,*.webp|Documents|*.md,*.txt,*.pdf'
      );
      
      if (!filePaths || filePaths.length === 0) return; // User cancelled

      await handleUploadFiles(filePaths, uploadTargetPath);
    } catch (err: any) {
      if (err.message && !err.message.includes('cancelled')) {
        setError(err.message || 'Failed to upload files');
      }
    }
  };

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
    setFileImageData(null);
    setFileContent('');
    try {
      if (isImage(filePath)) {
        // Load image as base64 data URL
        const imageData = await ReadFileAsBase64(project.id, filePath);
        if (!imageData) {
          throw new Error('Failed to load image data');
        }
        // Verify it's a valid data URL
        if (!imageData.startsWith('data:image/')) {
          console.warn('Image data URL format unexpected:', imageData.substring(0, 50));
        }
        setFileImageData(imageData);
        setFileContent('');
      } else {
        // Load text file
        const content = await ReadFile(project.id, filePath);
        setFileContent(content);
        setEditContent(content);
        setFileImageData(null);
      }
      setSelectedFile(filePath);
      setIsEditing(false);
    } catch (err: any) {
      console.error('Error loading file:', err);
      setError(err.message || 'Failed to load file');
      setFileImageData(null);
      setFileContent('');
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
        setFileImageData(null);
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
      toast.success(`Deleted ${filePath}`);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to delete';
      setError(errorMsg);
      toast.error(errorMsg);
      console.error('Delete error:', err);
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

  // Check if file is an image
  const isImage = (filePath: string): boolean => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    return ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext || '');
  };

  // Copy image markdown to clipboard
  const handleCopyImageMarkdown = async (imagePath: string) => {
    try {
      const fileName = imagePath.split('/').pop() || 'image';
      const altText = fileName.replace(/\.[^/.]+$/, ''); // Remove extension for alt text
      await copyImageMarkdown(imagePath, altText);
      
      // Warn if file is not in static/ directory
      if (!imagePath.startsWith('static/')) {
        toast.warning(
          `Markdown copied! Note: File should be in static/ directory for Hugo to serve it. ` +
          `Move ${imagePath} to static/${imagePath} for it to work.`,
          8000
        );
      } else {
        toast.success('Image markdown copied to clipboard!');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to copy image markdown');
    }
  };

  // Handle context menu for file/folder
  const handleNodeContextMenu = (e: React.MouseEvent, node: TreeNode) => {
    e.preventDefault();
    e.stopPropagation();

    const items: ContextMenuItem[] = [];
    const nodeIsExpanded = expandedPaths.has(node.path);

    if (node.isDir) {
      items.push(
        {
          id: 'expand',
          label: nodeIsExpanded ? 'Collapse' : 'Expand',
          icon: nodeIsExpanded ? '▼' : '▶',
          handler: () => toggleExpand(node.path),
        },
        { id: 'divider-1', label: '', handler: () => {}, divider: true },
        {
          id: 'new-file',
          label: 'New File',
          icon: '📄',
          handler: () => {
            setCreatePath(node.path);
            setCreateType('file');
            setShowCreateDialog(true);
          },
        },
        {
          id: 'new-folder',
          label: 'New Folder',
          icon: '📁',
          handler: () => {
            setCreatePath(node.path);
            setCreateType('directory');
            setShowCreateDialog(true);
          },
        },
        { id: 'divider-upload', label: '', handler: () => {}, divider: true },
        {
          id: 'upload-here',
          label: 'Upload Files Here',
          icon: '📤',
          handler: () => {
            setUploadTargetPath(node.path);
            handleUploadMultipleClick();
          },
        },
        { id: 'divider-2', label: '', handler: () => {}, divider: true },
        {
          id: 'rename',
          label: 'Rename',
          icon: '✏️',
          handler: () => {
            setRenameTarget(node.path);
            setRenameName(node.name);
            setShowRenameDialog(true);
          },
        },
        {
          id: 'delete',
          label: 'Delete',
          icon: '🗑️',
          handler: () => handleDelete(node.path),
        }
      );
    } else {
      items.push(
        {
          id: 'open',
          label: 'Open',
          icon: '📄',
          handler: () => loadFileContent(node.path),
        },
        {
          id: 'edit',
          label: 'Edit',
          icon: '✏️',
          handler: () => {
            loadFileContent(node.path);
            setIsEditing(true);
          },
          disabled: !isEditable(node.path),
        },
        { id: 'divider-1', label: '', handler: () => {}, divider: true },
        ...(isImage(node.path) ? [
          {
            id: 'copy-markdown',
            label: 'Copy Markdown',
            icon: '📋',
            handler: () => handleCopyImageMarkdown(node.path),
          },
          { id: 'divider-copy', label: '', handler: () => {}, divider: true },
        ] : []),
        {
          id: 'rename',
          label: 'Rename',
          icon: '✏️',
          handler: () => {
            setRenameTarget(node.path);
            setRenameName(node.name);
            setShowRenameDialog(true);
          },
        },
        {
          id: 'delete',
          label: 'Delete',
          icon: '🗑️',
          handler: () => handleDelete(node.path),
        }
      );
    }

    showContextMenu(items, e.clientX, e.clientY);
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
          data-folder-path={node.isDir ? node.path : undefined}
          data-node-path={node.path}
          draggable={true}
          onDragStart={(e) => {
            setDraggedNode(node);
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('application/x-hugo-file', node.path);
            // Set drag image
            if (e.currentTarget) {
              e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
            }
          }}
          onDragEnd={() => {
            setDraggedNode(null);
            setDragOverPath(null);
          }}
          className={`group flex items-center gap-2 p-1 rounded hover:bg-hugo-bg-tertiary cursor-pointer transition-colors ${
            selectedFile === node.path ? 'bg-hugo-bg-tertiary' : ''
          } ${
            dragOverPath === node.path && node.isDir ? 'bg-hugo-accent-teal/20' : ''
          } ${
            draggedNode?.path === node.path ? 'opacity-50' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={(e) => {
            if (node.isDir) {
              e.stopPropagation();
              toggleExpand(node.path);
              // Set upload target when clicking on a directory
              setUploadTargetPath(node.path);
            } else {
              loadFileContent(node.path);
            }
          }}
          onContextMenu={(e) => {
            handleNodeContextMenu(e, node);
            // Set upload target when right-clicking on a directory
            if (node.isDir) {
              setUploadTargetPath(node.path);
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
    <div 
      ref={fileExplorerRef}
      className="flex flex-col h-full relative"
      style={{ position: 'relative' }}
    >
      {/* Toolbar */}
      <div className="bg-hugo-bg-secondary border-b border-hugo-border-default px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-hugo-text-secondary">{project.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleUploadClick}
            className="px-3 py-1 bg-hugo-accent-teal hover:bg-hugo-accent-tealLight rounded text-sm text-white uppercase tracking-wide h-7"
            title="Upload file"
          >
            📤 Upload
          </button>
          <button
            onClick={handleUploadMultipleClick}
            className="px-3 py-1 bg-hugo-accent-teal hover:bg-hugo-accent-tealLight rounded text-sm text-white uppercase tracking-wide h-7"
            title="Upload multiple files"
          >
            📤 Upload Multiple
          </button>
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
                  {isImage(selectedFile) && !isEditing && (
                    <button
                      onClick={() => handleCopyImageMarkdown(selectedFile)}
                      className="px-3 py-1 bg-hugo-accent-teal hover:bg-hugo-accent-tealLight rounded text-sm flex items-center gap-2"
                      title="Copy image markdown"
                    >
                      <span>📋</span>
                      <span>Copy Markdown</span>
                    </button>
                  )}
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
                {loading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-hugo-text-tertiary">Loading...</div>
                  </div>
                ) : isEditing ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-full bg-hugo-bg-primary text-hugo-text-primary font-mono text-sm p-4 rounded border border-hugo-border-default focus:outline-none focus:border-hugo-accent-teal"
                    spellCheck={false}
                  />
                ) : fileImageData ? (
                  <div className="flex items-center justify-center h-full w-full relative" style={{ minHeight: '200px' }}>
                    <div className="max-w-full max-h-full flex items-center justify-center relative group" style={{ width: '100%', height: '100%' }}>
                      {fileImageData && fileImageData.startsWith('data:image/') ? (
                        <img
                          src={fileImageData}
                          alt={selectedFile || 'Image preview'}
                          className="max-w-full max-h-full object-contain rounded border border-hugo-border-default shadow-lg"
                          style={{ 
                            maxHeight: 'calc(100vh - 200px)',
                            maxWidth: '100%',
                            height: 'auto',
                            width: 'auto'
                          }}
                          onError={(e) => {
                            console.error('Failed to load image. Data URL length:', fileImageData?.length);
                            console.error('Data URL preview:', fileImageData?.substring(0, 100));
                            setError('Failed to display image. The file may be corrupted or in an unsupported format.');
                            e.currentTarget.style.display = 'none';
                          }}
                          onLoad={() => {
                            console.log('Image loaded successfully');
                          }}
                        />
                      ) : (
                        <div className="p-4 text-hugo-text-tertiary">
                          Invalid image data format. Expected data:image/ prefix.
                          <br />
                          <span className="text-xs">Received: {fileImageData?.substring(0, 50)}...</span>
                        </div>
                      )}
                      {/* Copy button overlay */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedFile) {
                              handleCopyImageMarkdown(selectedFile);
                            }
                          }}
                          className="px-3 py-2 bg-hugo-accent-teal hover:bg-hugo-accent-tealLight rounded text-sm text-white shadow-lg flex items-center gap-2"
                          title="Copy image markdown"
                        >
                          <span>📋</span>
                          <span>Copy Markdown</span>
                        </button>
                      </div>
                    </div>
                  </div>
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

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          items={contextMenu.items}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={hideContextMenu}
        />
      )}

      {/* Toast notifications */}
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
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
