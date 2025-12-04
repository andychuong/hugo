import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  description?: string;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled: boolean = true) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrl ? event.ctrlKey : !event.ctrlKey;
        const metaMatches = shortcut.meta ? event.metaKey : !event.metaKey;
        const shiftMatches = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatches = shortcut.alt ? event.altKey : !event.altKey;

        // Check if we're in an input/textarea/contenteditable
        const target = event.target as HTMLElement;
        const isInput = target.tagName === 'INPUT' || 
                       target.tagName === 'TEXTAREA' || 
                       target.isContentEditable;

        // Allow shortcuts in inputs only if explicitly enabled
        if (isInput && !shortcut.preventDefault) {
          continue;
        }

        if (keyMatches && ctrlMatches && metaMatches && shiftMatches && altMatches) {
          if (shortcut.preventDefault !== false) {
            event.preventDefault();
            event.stopPropagation();
          }
          shortcut.handler();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts, enabled]);
}

// Command palette hook
export function useCommandPalette(
  onOpen: () => void,
  enabled: boolean = true
) {
  useKeyboardShortcuts(
    [
      {
        key: 'k',
        meta: true, // Cmd on Mac, Ctrl on Windows/Linux
        handler: onOpen,
        description: 'Open command palette',
        preventDefault: true,
      },
    ],
    enabled
  );
}

// Common shortcut definitions
export const Shortcuts = {
  // Global
  COMMAND_PALETTE: { key: 'k', meta: true },
  ESCAPE: { key: 'Escape' },
  
  // Project navigation
  NEW_PROJECT: { key: 'n', meta: true, shift: true },
  SCAN_PROJECTS: { key: 's', meta: true, shift: true },
  
  // Build
  BUILD_PROJECT: { key: 'b', meta: true },
  BUILD_ALL: { key: 'b', meta: true, shift: true },
  
  // Server
  START_SERVER: { key: 'r', meta: true },
  STOP_SERVER: { key: 'r', meta: true, shift: true },
  
  // File operations
  NEW_FILE: { key: 'n', meta: true },
  DELETE_FILE: { key: 'Delete', shift: true },
  RENAME_FILE: { key: 'r', meta: true },
  SAVE_FILE: { key: 's', meta: true },
  
  // Navigation
  GO_BACK: { key: 'ArrowLeft', meta: true },
  GO_FORWARD: { key: 'ArrowRight', meta: true },
  
  // Search
  SEARCH: { key: 'f', meta: true },
  SEARCH_FILES: { key: 'p', meta: true },
};

