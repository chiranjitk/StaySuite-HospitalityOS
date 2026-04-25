'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  StickyNote,
  Trash2,
  Save,
  Tag,
  Clock,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'staysuite-quick-notes';
const MAX_CHARS = 500;

type NoteCategory = 'general' | 'vip-alert' | 'maintenance' | 'housekeeping' | 'front-desk';

interface SavedNote {
  text: string;
  category: NoteCategory;
  savedAt: string;
}

const CATEGORY_OPTIONS: { value: NoteCategory; label: string; color: string }[] = [
  { value: 'general', label: 'General', color: 'text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-900/40' },
  { value: 'vip-alert', label: 'VIP Alert', color: 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/40' },
  { value: 'maintenance', label: 'Maintenance', color: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/40' },
  { value: 'housekeeping', label: 'Housekeeping', color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/40' },
  { value: 'front-desk', label: 'Front Desk', color: 'text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-900/40' },
];

export function QuickNotesWidget() {
  const [text, setText] = useState(() => {
    if (typeof window === 'undefined') return '';
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const note: SavedNote = JSON.parse(stored);
        return note.text;
      }
    } catch {
      // Ignore localStorage errors
    }
    return '';
  });
  const [category, setCategory] = useState<NoteCategory>(() => {
    if (typeof window === 'undefined') return 'general';
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const note: SavedNote = JSON.parse(stored);
        return note.category;
      }
    } catch {
      // Ignore localStorage errors
    }
    return 'general';
  });
  const [savedAt, setSavedAt] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const note: SavedNote = JSON.parse(stored);
        return note.savedAt;
      }
    } catch {
      // Ignore localStorage errors
    }
    return null;
  });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-save with debounce
  const saveNote = useCallback((currentText: string, currentCategory: NoteCategory) => {
    try {
      const now = new Date().toISOString();
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ text: currentText, category: currentCategory, savedAt: now })
      );
      setSavedAt(now);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  const handleTextChange = useCallback((value: string) => {
    if (value.length <= MAX_CHARS) {
      setText(value);
      setSaveStatus('idle');

      // Debounced auto-save (1.5 seconds after last keystroke)
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
      autoSaveTimerRef.current = setTimeout(() => {
        saveNote(value, category);
      }, 1500);
    }
  }, [category, saveNote]);

  const handleCategoryChange = useCallback((value: NoteCategory) => {
    setCategory(value);
    // Save immediately when category changes
    saveNote(text, value);
  }, [text, saveNote]);

  const handleClear = useCallback(() => {
    setText('');
    setCategory('general');
    setSavedAt(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  const handleManualSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    saveNote(text, category);
  }, [text, category, saveNote]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  const charCount = text.length;
  const charPercentage = (charCount / MAX_CHARS) * 100;
  const currentCategoryConfig = CATEGORY_OPTIONS.find((c) => c.value === category) || CATEGORY_OPTIONS[0];
  const isModified = savedAt === null || text === '';

  const formatSavedTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            Quick Notes
          </CardTitle>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-red-600 dark:text-red-400"
                disabled={text.length === 0}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Notes</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete your shift notes. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleClear}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Clear
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Category Selector */}
        <div className="flex items-center gap-2">
          <Tag className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          <Select value={category} onValueChange={(v) => handleCategoryChange(v as NoteCategory)}>
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORY_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value} className="text-xs">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* Category badge */}
          <span
            className={cn(
              'text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 hidden sm:inline-flex',
              currentCategoryConfig.color
            )}
          >
            {currentCategoryConfig.label}
          </span>
        </div>

        {/* Textarea */}
        <div className="relative">
          <Textarea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Shift handoff notes, reminders, observations..."
            className="min-h-[120px] max-h-[200px] resize-none text-sm leading-relaxed pr-2"
          />
        </div>

        {/* Character Count & Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-[11px] tabular-nums transition-colors',
                charPercentage >= 90 ? 'text-red-500 dark:text-red-400 font-medium' : 'text-muted-foreground'
              )}
            >
              {charCount}/{MAX_CHARS}
            </span>
            {/* Mini progress bar */}
            <div className="h-1 w-16 rounded-full bg-muted overflow-hidden">
              <motion.div
                className={cn(
                  'h-full rounded-full transition-colors',
                  charPercentage >= 90 ? 'bg-red-500' : charPercentage >= 70 ? 'bg-amber-500' : 'bg-primary/40'
                )}
                animate={{ width: `${charPercentage}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Saved timestamp */}
            <AnimatePresence mode="wait">
              {saveStatus === 'saved' ? (
                <motion.span
                  key="saved"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400"
                >
                  <Check className="h-3 w-3" />
                  Auto-saved
                </motion.span>
              ) : savedAt ? (
                <motion.span
                  key="time"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground"
                >
                  <Clock className="h-3 w-3" />
                  {formatSavedTime(savedAt)}
                </motion.span>
              ) : null}
            </AnimatePresence>

            {/* Manual save button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleManualSave}
              disabled={text.length === 0}
              title="Save now"
            >
              <Save className={cn('h-3.5 w-3.5', saveStatus === 'saving' && 'animate-pulse')} />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
