import { useEffect, useRef, useState } from 'react';
import Card from './Card';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: string;
  disabled?: boolean;
  divider?: boolean;
  handler: () => void;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  x: number;
  y: number;
  onClose: () => void;
}

export default function ContextMenu({ items, x, y, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  useEffect(() => {
    // Adjust position if menu would go off screen
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      let adjustedX = x;
      let adjustedY = y;

      if (x + rect.width > windowWidth) {
        adjustedX = windowWidth - rect.width - 10;
      }
      if (y + rect.height > windowHeight) {
        adjustedY = windowHeight - rect.height - 10;
      }
      if (adjustedX < 0) adjustedX = 10;
      if (adjustedY < 0) adjustedY = 10;

      setPosition({ x: adjustedX, y: adjustedY });
    }
  }, [x, y]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    // Close on outside click - delay to avoid immediate close
    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleClickOutside, true);
    }, 100);

    document.addEventListener('keydown', handleEscape);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleClickOutside, true);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleItemClick = (item: ContextMenuItem) => {
    if (!item.disabled && !item.divider) {
      item.handler();
      onClose();
    }
  };

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] pointer-events-auto"
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <Card className="p-1 min-w-[200px] shadow-2xl border-2 border-hugo-border-default bg-hugo-bg-primary">
        {items.map((item, index) => {
          if (item.divider) {
            return (
              <div
                key={`divider-${index}`}
                className="h-px bg-hugo-border-default my-1"
              />
            );
          }

          return (
            <button
              key={item.id}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleItemClick(item);
              }}
              disabled={item.disabled}
              type="button"
              className={`
                w-full px-3 py-2 text-left text-sm flex items-center gap-2
                rounded transition-colors
                ${item.disabled 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'cursor-pointer text-hugo-text-primary hover:bg-hugo-accent-teal/20 hover:text-hugo-accent-teal'
                }
                ${item.id === 'remove' ? 'hover:bg-red-900/30 hover:text-red-300' : ''}
              `}
            >
              {item.icon && <span className="text-base">{item.icon}</span>}
              <span className="font-medium">{item.label}</span>
            </button>
          );
        })}
      </Card>
    </div>
  );
}

// Hook for managing context menu
export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState<{
    items: ContextMenuItem[];
    x: number;
    y: number;
  } | null>(null);

  const showContextMenu = (items: ContextMenuItem[], x: number, y: number) => {
    setContextMenu({ items, x, y });
  };

  const hideContextMenu = () => {
    setContextMenu(null);
  };

  return {
    contextMenu,
    showContextMenu,
    hideContextMenu,
  };
}







