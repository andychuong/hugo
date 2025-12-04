import { useState, useEffect, useRef } from 'react';
import Card from './Card';
import Input from './Input';

export interface Command {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  category?: string;
  handler: () => void;
  shortcut?: string;
}

interface CommandPaletteProps {
  commands: Command[];
  onClose: () => void;
}

export default function CommandPalette({ commands, onClose }: CommandPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter commands based on search
  const filteredCommands = commands.filter(cmd => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      cmd.label.toLowerCase().includes(query) ||
      cmd.description?.toLowerCase().includes(query) ||
      cmd.category?.toLowerCase().includes(query)
    );
  });

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    const category = cmd.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(cmd);
    return acc;
  }, {} as Record<string, Command[]>);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].handler();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [filteredCommands, selectedIndex, onClose]);

  useEffect(() => {
    inputRef.current?.focus();
    setSelectedIndex(0);
  }, [searchQuery]);

  useEffect(() => {
    // Scroll selected item into view
    const selectedElement = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    selectedElement?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex]);

  const handleCommandClick = (command: Command) => {
    command.handler();
    onClose();
  };

  const handleCardClick = (e?: React.MouseEvent) => {
    e?.stopPropagation();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-32 z-50" onClick={onClose}>
      <Card className="w-full max-w-2xl p-0" onClick={handleCardClick}>
        {/* Search input */}
        <div className="p-4 border-b border-hugo-border-default">
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type to search commands..."
            className="w-full px-3 py-2 bg-hugo-bg-secondary border border-hugo-border-default rounded text-hugo-text-primary focus:outline-none focus:border-hugo-accent-teal"
          />
        </div>

        {/* Commands list */}
        <div ref={listRef} className="max-h-96 overflow-y-auto">
          {Object.keys(groupedCommands).length === 0 ? (
            <div className="p-8 text-center text-hugo-text-tertiary">
              No commands found
            </div>
          ) : (
            Object.entries(groupedCommands).map(([category, categoryCommands]) => (
              <div key={category}>
                <div className="px-4 py-2 text-xs font-semibold text-hugo-text-tertiary uppercase tracking-wide bg-hugo-bg-secondary">
                  {category}
                </div>
                {categoryCommands.map((command, index) => {
                  const globalIndex = filteredCommands.indexOf(command);
                  const isSelected = globalIndex === selectedIndex;
                  
                  return (
                    <div
                      key={command.id}
                      data-index={globalIndex}
                      onClick={() => handleCommandClick(command)}
                      className={`
                        px-4 py-3 cursor-pointer flex items-center justify-between
                        ${isSelected ? 'bg-hugo-accent-blue/20' : 'hover:bg-hugo-bg-secondary'}
                      `}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {command.icon && (
                          <span className="text-lg flex-shrink-0">{command.icon}</span>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-hugo-text-primary truncate">
                            {command.label}
                          </div>
                          {command.description && (
                            <div className="text-sm text-hugo-text-tertiary truncate">
                              {command.description}
                            </div>
                          )}
                        </div>
                      </div>
                      {command.shortcut && (
                        <div className="flex items-center gap-1 text-xs text-hugo-text-tertiary flex-shrink-0 ml-4">
                          {command.shortcut.split('+').map((key, i) => (
                            <span key={i}>
                              <kbd className="px-1.5 py-0.5 bg-hugo-bg-tertiary rounded text-xs">
                                {key}
                              </kbd>
                              {i < command.shortcut!.split('+').length - 1 && <span>+</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-hugo-border-default text-xs text-hugo-text-tertiary flex items-center justify-between">
          <div>
            <kbd className="px-1.5 py-0.5 bg-hugo-bg-tertiary rounded">↑</kbd>
            <kbd className="px-1.5 py-0.5 bg-hugo-bg-tertiary rounded ml-1">↓</kbd>
            {' '}Navigate
            {' • '}
            <kbd className="px-1.5 py-0.5 bg-hugo-bg-tertiary rounded">Enter</kbd>
            {' '}Select
            {' • '}
            <kbd className="px-1.5 py-0.5 bg-hugo-bg-tertiary rounded">Esc</kbd>
            {' '}Close
          </div>
        </div>
      </Card>
    </div>
  );
}

