'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Keyboard,
  Search,
  Plus,
  ArrowRight,
  Bell,
  RefreshCw,
  PanelLeft,
  Command,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ShortcutItem {
  keys: string[];
  label: string;
  icon: React.ElementType;
  color: string;
}

const shortcuts: ShortcutItem[] = [
  { keys: ['Ctrl', 'K'], label: 'Search / Command Palette', icon: Search, color: 'text-teal-600 dark:text-teal-400' },
  { keys: ['Ctrl', 'N'], label: 'New Booking', icon: Plus, color: 'text-emerald-600 dark:text-emerald-400' },
  { keys: ['Ctrl', 'R'], label: 'Refresh Dashboard', icon: RefreshCw, color: 'text-sky-600 dark:text-sky-400' },
  { keys: ['Ctrl', '\\'], label: 'Toggle Sidebar', icon: PanelLeft, color: 'text-violet-600 dark:text-violet-400' },
  { keys: ['Ctrl', '.'], label: 'Notifications', icon: Bell, color: 'text-amber-600 dark:text-amber-400' },
  { keys: ['Ctrl', 'Enter'], label: 'Quick Action', icon: ArrowRight, color: 'text-rose-600 dark:text-rose-400' },
];

export function KeyboardShortcutsWidget() {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
      {/* Accent bar */}
      <div className="h-[2px] bg-gradient-to-r from-slate-400 via-slate-500 to-slate-400" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-slate-600" />
            Keyboard Shortcuts
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Less' : `+${shortcuts.length - 3} more`}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-1.5">
        <AnimatePresence initial={false}>
          {(isExpanded ? shortcuts : shortcuts.slice(0, 3)).map((shortcut, i) => {
            const Icon = shortcut.icon;
            return (
              <motion.div
                key={shortcut.label}
                initial={isExpanded && i >= 3 ? { opacity: 0, height: 0 } : false}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15, delay: i * 0.03 }}
                className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
              >
                <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', shortcut.color)} />
                <span className="text-xs text-foreground/80 flex-1">{shortcut.label}</span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, ki) => (
                    <React.Fragment key={key}>
                      {ki > 0 && <span className="text-[10px] text-muted-foreground/50">+</span>}
                      <kbd className={cn(
                        "inline-flex h-5 min-w-[20px] items-center justify-center px-1.5 rounded-md text-[10px] font-mono font-medium",
                        "border border-border/50 bg-muted/50 text-muted-foreground",
                        "group-hover:border-primary/50 group-hover:text-foreground transition-colors"
                      )}>
                        {key}
                      </kbd>
                    </React.Fragment>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
