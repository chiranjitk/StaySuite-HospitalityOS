'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Keyboard, Navigation, Zap, Eye, X } from 'lucide-react';

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  title: string;
  icon: React.ReactNode;
  shortcuts: Shortcut[];
}

const shortcutGroups: ShortcutGroup[] = [
  {
    title: 'Navigation',
    icon: <Navigation className="h-4 w-4" />,
    shortcuts: [
      { keys: ['Ctrl', 'K'], description: 'Command Palette' },
      { keys: ['Alt', 'D'], description: 'Go to Dashboard' },
      { keys: ['Alt', 'B'], description: 'Go to Bookings' },
      { keys: ['Alt', 'G'], description: 'Go to Guests' },
      { keys: ['Alt', 'R'], description: 'Go to Rooms' },
      { keys: ['Alt', 'F'], description: 'Go to Front Desk' },
    ],
  },
  {
    title: 'Actions',
    icon: <Zap className="h-4 w-4" />,
    shortcuts: [
      { keys: ['Ctrl', 'N'], description: 'Create New' },
      { keys: ['Ctrl', 'S'], description: 'Save' },
      { keys: ['Ctrl', 'F'], description: 'Search' },
      { keys: ['Ctrl', 'P'], description: 'Print' },
      { keys: ['Delete'], description: 'Delete Selected' },
      { keys: ['Escape'], description: 'Close / Cancel' },
    ],
  },
  {
    title: 'View',
    icon: <Eye className="h-4 w-4" />,
    shortcuts: [
      { keys: ['Ctrl', '/'], description: 'Toggle Sidebar' },
      { keys: ['Ctrl', 'D'], description: 'Toggle Dark Mode' },
      { keys: ['Ctrl', '+'], description: 'Zoom In' },
      { keys: ['Ctrl', '-'], description: 'Zoom Out' },
      { keys: ['F11'], description: 'Fullscreen' },
    ],
  },
];

const KeyBadge = ({ children }: { children: string }) => {
  const isModifier = ['Ctrl', 'Alt', 'Cmd', 'Shift'].includes(children);
  const isSpecial = ['Escape', 'F11', 'Delete', 'Tab', 'Enter', 'Space', '?', '/', '+', '-', 'N', 'S', 'P', 'F', 'B', 'G', 'R', 'D', 'K'].includes(children);

  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center min-w-[1.75rem] h-6 px-1.5 rounded-md font-mono text-[11px] font-medium shadow-sm border',
        isModifier
          ? 'bg-gradient-to-b from-gray-100 to-gray-200 border-gray-300 text-gray-700 dark:from-gray-700 dark:to-gray-800 dark:border-gray-600 dark:text-gray-300'
          : 'bg-gradient-to-b from-white to-gray-50 border-gray-200 text-gray-800 dark:from-gray-800 dark:to-gray-900 dark:border-gray-600 dark:text-gray-200'
      )}
    >
      {children}
    </kbd>
  );
};

interface KeyboardShortcutsOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsOverlay({ open, onOpenChange }: KeyboardShortcutsOverlayProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    },
    [onOpenChange]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [open, handleKeyDown]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate and perform actions faster
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3 className="flex items-center gap-2 text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">
                {group.icon}
                {group.title}
              </h3>
              <div className="grid gap-2">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, idx) => (
                        <span key={idx} className="flex items-center gap-1">
                          <KeyBadge>{key}</KeyBadge>
                          {idx < shortcut.keys.length - 1 && (
                            <span className="text-xs text-muted-foreground mx-0.5">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Press <KeyBadge>?</KeyBadge> to open this dialog
          </p>
          <p className="text-xs text-muted-foreground">
            Press <KeyBadge>Esc</KeyBadge> to close
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook to listen for '?' key to toggle keyboard shortcuts overlay
 */
export function useKeyboardShortcuts(onToggle: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (e.key === '?') {
        e.preventDefault();
        onToggle();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onToggle]);
}
