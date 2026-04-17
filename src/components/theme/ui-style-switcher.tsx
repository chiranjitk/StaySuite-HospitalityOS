'use client';

import * as React from 'react';
import { 
  Check, 
  Moon, 
  Sun, 
  Monitor, 
  Sparkles, 
  Crown, 
  Box, 
  Minimize,
  Palette,
  Zap,
  Flame,
  Gem,
  Clapperboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUIStyleStore, UIStyleTheme } from '@/lib/themes/store';

// UI Style theme configuration with enhanced visuals - 10 themes
const uiStyleThemes: Array<{
  id: UIStyleTheme;
  name: string;
  description: string;
  icon: React.ElementType;
  previewGradient: string;
  lightPreview: string;
  darkPreview: string;
  features: string[];
  bestFor: string;
  category: 'original' | 'premium';
}> = [
  {
    id: 'gradient-modern',
    name: 'Gradient Modern',
    description: 'Bold gradients with vibrant violet and indigo colors.',
    icon: Sparkles,
    previewGradient: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 50%, #4F46E5 100%)',
    lightPreview: 'linear-gradient(135deg, #ffffff 0%, #f5f3ff 50%, #ede9fe 100%)',
    darkPreview: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #3730a3 100%)',
    features: ['Vibrant gradients', 'Purple accent', 'Modern feel'],
    bestFor: 'Light mode',
    category: 'original',
  },
  {
    id: 'dark-premium',
    name: 'Dark Premium',
    description: 'Elegant dark theme with luxurious gold accents.',
    icon: Crown,
    previewGradient: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #D4AF37 100%)',
    lightPreview: 'linear-gradient(135deg, #fffbf0 0%, #fef3c7 50%, #fde68a 100%)',
    darkPreview: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
    features: ['Gold accents', 'Elegant dark', 'Luxury feel'],
    bestFor: 'Dark mode',
    category: 'original',
  },
  {
    id: 'cyber-neon',
    name: 'Cyber Neon',
    description: 'Futuristic theme with electric cyan and neon pink accents.',
    icon: Zap,
    previewGradient: 'linear-gradient(135deg, #00F5FF 0%, #FF00FF 50%, #00F5FF 100%)',
    lightPreview: 'linear-gradient(135deg, #f0ffff 0%, #e0ffff 50%, #d0ffff 100%)',
    darkPreview: 'linear-gradient(135deg, #0a1628 0%, #1a2a4a 50%, #0a1628 100%)',
    features: ['Neon glow', 'Cyberpunk', 'Electric colors'],
    bestFor: 'Dark mode',
    category: 'original',
  },
  {
    id: 'sakura-pink',
    name: 'Sakura Pink',
    description: 'Soft and elegant pink theme inspired by cherry blossoms.',
    icon: Sparkles,
    previewGradient: 'linear-gradient(135deg, #FFB7C5 0%, #FF69B4 50%, #DB7093 100%)',
    lightPreview: 'linear-gradient(135deg, #fff5f7 0%, #ffe4e9 50%, #ffd3dc 100%)',
    darkPreview: 'linear-gradient(135deg, #2d1f24 0%, #3d2830 50%, #2d1f24 100%)',
    features: ['Soft pink', 'Elegant', 'Warm tones'],
    bestFor: 'Both modes',
    category: 'original',
  },
  {
    id: 'neumorphism',
    name: 'Neumorphism',
    description: 'Soft UI with subtle shadows creating an extruded effect.',
    icon: Box,
    previewGradient: 'linear-gradient(145deg, #e6e9ef 0%, #d1d5db 50%, #e6e9ef 100%)',
    lightPreview: 'linear-gradient(145deg, #f3f4f6 0%, #e5e7eb 50%, #d1d5db 100%)',
    darkPreview: 'linear-gradient(145deg, #1f2937 0%, #111827 50%, #1f2937 100%)',
    features: ['Soft shadows', 'Extruded feel', 'Tactile design'],
    bestFor: 'Light mode',
    category: 'original',
  },
  {
    id: 'minimalist',
    name: 'Minimalist',
    description: 'Clean, simple design with lots of whitespace.',
    icon: Minimize,
    previewGradient: 'linear-gradient(135deg, #ffffff 0%, #f5f5f5 50%, #171717 100%)',
    lightPreview: 'linear-gradient(135deg, #ffffff 0%, #fafafa 50%, #f5f5f5 100%)',
    darkPreview: 'linear-gradient(135deg, #171717 0%, #0a0a0a 50%, #000000 100%)',
    features: ['Clean design', 'Max whitespace', 'Black & white'],
    bestFor: 'Both modes',
    category: 'original',
  },
  // ===== PREMIUM NETFLIX-STYLE THEMES =====
  {
    id: 'netflix-crimson',
    name: 'Netflix Crimson',
    description: 'Dark cinematic red inspired by streaming platforms.',
    icon: Flame,
    previewGradient: 'linear-gradient(135deg, #8B0000 0%, #DC143C 50%, #B22222 100%)',
    lightPreview: 'linear-gradient(135deg, #fff5f5 0%, #fee2e2 50%, #fecaca 100%)',
    darkPreview: 'linear-gradient(135deg, #0a0204 0%, #1a0508 50%, #120308 100%)',
    features: ['Cinematic red', 'Dark elegance', 'Streaming vibe'],
    bestFor: 'Dark mode',
    category: 'premium',
  },
  {
    id: 'obsidian-rose',
    name: 'Obsidian Rose',
    description: 'Pure obsidian black with luxurious rose gold accents.',
    icon: Gem,
    previewGradient: 'linear-gradient(135deg, #1a1a1a 0%, #B76E79 50%, #E8A87C 100%)',
    lightPreview: 'linear-gradient(135deg, #fff8f6 0%, #fce4e4 50%, #f5d0d0 100%)',
    darkPreview: 'linear-gradient(135deg, #050505 0%, #0d0d0d 50%, #121212 100%)',
    features: ['Rose gold', 'Obsidian black', 'Luxury feel'],
    bestFor: 'Dark mode',
    category: 'premium',
  },
  {
    id: 'midnight-ivory',
    name: 'Midnight Ivory',
    description: 'Deep navy with elegant ivory and cream accents.',
    icon: Moon,
    previewGradient: 'linear-gradient(135deg, #0C1445 0%, #1E3A5F 50%, #FAEBD7 100%)',
    lightPreview: 'linear-gradient(135deg, #faf8f5 0%, #f5efe6 50%, #ede4d4 100%)',
    darkPreview: 'linear-gradient(135deg, #060d24 0%, #0C1445 50%, #152347 100%)',
    features: ['Ivory cream', 'Midnight navy', 'Refined'],
    bestFor: 'Dark mode',
    category: 'premium',
  },
  {
    id: 'scarlet-noir',
    name: 'Scarlet Noir',
    description: 'Pure black with vivid scarlet highlights. The Netflix experience.',
    icon: Clapperboard,
    previewGradient: 'linear-gradient(135deg, #000000 0%, #E50914 50%, #B20710 100%)',
    lightPreview: 'linear-gradient(135deg, #fff5f5 0%, #fee2e2 50%, #fecaca 100%)',
    darkPreview: 'linear-gradient(135deg, #000000 0%, #050505 50%, #0a0a0a 100%)',
    features: ['Netflix-style', 'Pure black', 'Scarlet glow'],
    bestFor: 'Dark mode',
    category: 'premium',
  },
];

interface UIStyleCardProps {
  theme: typeof uiStyleThemes[0];
  isActive: boolean;
  onClick: () => void;
  effectiveMode: 'light' | 'dark';
}

function UIStyleCard({ theme, isActive, onClick, effectiveMode }: UIStyleCardProps) {
  const Icon = theme.icon;
  const previewBg = effectiveMode === 'dark' ? theme.darkPreview : theme.lightPreview;
  
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all w-full group',
        'hover:bg-accent/30 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5',
        'active:scale-[0.99]',
        isActive && 'border-primary ring-2 ring-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-lg shadow-primary/10'
      )}
    >
      {/* Active indicator with animation */}
      <div className={cn(
        "absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-300",
        isActive ? "scale-100 opacity-100" : "scale-0 opacity-0"
      )}>
        <Check className="h-3.5 w-3.5" />
      </div>
      
      {/* Preview gradient with icon */}
      <div className="flex items-center gap-3 w-full">
        <div 
          className="h-12 w-12 rounded-xl shadow-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3"
          style={{ background: theme.previewGradient }}
        >
          <Icon className="h-6 w-6 text-white drop-shadow-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-sm">{theme.name}</h4>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {theme.description}
          </p>
        </div>
      </div>
      
      {/* Preview bar */}
      <div 
        className="h-1.5 w-full rounded-full overflow-hidden"
        style={{ background: 'var(--muted)' }}
      >
        <div 
          className="h-full w-full rounded-full transition-transform duration-500 group-hover:scale-x-105"
          style={{ background: theme.previewGradient }}
        />
      </div>
      
      {/* Features */}
      <div className="flex flex-wrap gap-1.5 w-full">
        {theme.features.slice(0, 2).map((feature) => (
          <span 
            key={feature}
            className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted/80 text-muted-foreground"
          >
            {feature}
          </span>
        ))}
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
          {theme.bestFor}
        </span>
      </div>
    </button>
  );
}

interface UIStyleSwitcherProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function UIStyleSwitcher({ trigger, open, onOpenChange }: UIStyleSwitcherProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;
  
  const {
    themeId,
    mode,
    getEffectiveMode,
    setTheme,
    setMode,
  } = useUIStyleStore();
  
  const effectiveMode = getEffectiveMode();
  const currentTheme = uiStyleThemes.find(t => t.id === themeId);
  const CurrentIcon = currentTheme?.icon || Sparkles;
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 rounded-xl hover:shadow-md transition-all"
          >
            <CurrentIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Theme</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl h-[90vh] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 shrink-0 border-b bg-gradient-to-r from-background to-muted/30">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <Palette className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <span className="bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                Choose Your Style
              </span>
              <p className="text-xs font-normal text-muted-foreground mt-0.5">
                10 handcrafted design themes • Original & Premium collections
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        {/* Mode Toggle */}
        <div className="flex items-center justify-between p-4 px-5 bg-muted/20 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            <div>
              <h4 className="font-medium text-sm">Appearance</h4>
              <p className="text-[11px] text-muted-foreground">
                Light / Dark mode
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-background border shadow-sm">
            <Button
              variant={effectiveMode === 'light' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('light')}
              className={cn(
                "gap-1.5 rounded-md transition-all h-8",
                effectiveMode === 'light' && "shadow-md"
              )}
            >
              <Sun className="h-3.5 w-3.5" />
              <span className="text-xs">Light</span>
            </Button>
            <Button
              variant={effectiveMode === 'dark' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('dark')}
              className={cn(
                "gap-1.5 rounded-md transition-all h-8",
                effectiveMode === 'dark' && "shadow-md"
              )}
            >
              <Moon className="h-3.5 w-3.5" />
              <span className="text-xs">Dark</span>
            </Button>
            <Button
              variant={mode === 'system' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('system')}
              className={cn(
                "rounded-md transition-all h-8",
                mode === 'system' && "shadow-md"
              )}
              title="Use system preference"
            >
              <Monitor className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        
        {/* Theme Selection */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-2">
            {uiStyleThemes.map((theme) => (
              <UIStyleCard
                key={theme.id}
                theme={theme}
                isActive={themeId === theme.id}
                onClick={() => setTheme(theme.id)}
                effectiveMode={effectiveMode}
              />
            ))}
          </div>
        </div>
        
        {/* Footer */}
        <DialogFooter className="p-3 px-5 border-t shrink-0 flex justify-between items-center bg-muted/10">
          <div className="flex items-center gap-2">
            <div 
              className="h-7 w-7 rounded-lg shadow-md"
              style={{ background: currentTheme?.previewGradient }}
            >
              <CurrentIcon className="h-full w-full p-1.5 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium">
                {currentTheme?.name || 'Gradient Modern'}
              </p>
              <p className="text-[10px] text-muted-foreground capitalize">
                {effectiveMode} mode
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setIsOpen(false);
            }}
            className="rounded-xl gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Compact UI Style toggle for header
 */
export function UIStyleToggle() {
  const { themeId, setTheme } = useUIStyleStore();
  const currentTheme = uiStyleThemes.find(t => t.id === themeId);
  const Icon = currentTheme?.icon || Sparkles;
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted">
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 rounded-xl p-2">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          UI Themes • 10 available
        </div>
        <DropdownMenuSeparator className="my-1" />
        <div className="max-h-80 overflow-y-auto">
          {uiStyleThemes.map((theme) => {
            const ThemeIcon = theme.icon;
            return (
              <DropdownMenuItem
                key={theme.id}
                onClick={() => setTheme(theme.id)}
                className={cn(
                  "gap-3 rounded-lg py-2 cursor-pointer",
                  themeId === theme.id && "bg-primary/10 text-primary"
                )}
              >
                <div 
                  className="h-5 w-5 rounded-md flex items-center justify-center shrink-0"
                  style={{ background: theme.previewGradient }}
                >
                  <ThemeIcon className="h-3 w-3 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm">{theme.name}</span>
                  <span className="text-[10px] text-muted-foreground ml-1">• {theme.category}</span>
                </div>
                {themeId === theme.id && (
                  <Check className="h-4 w-4 ml-auto text-primary shrink-0" />
                )}
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Quick theme mode toggle
 */
export function UIThemeToggle() {
  const { getEffectiveMode, toggleMode } = useUIStyleStore();
  const effectiveMode = getEffectiveMode();
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleMode}
      className="h-9 w-9 rounded-xl"
    >
      {effectiveMode === 'dark' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}

export { uiStyleThemes };

/**
 * Hook to access UI style state and actions
 */
export function useUIStyle() {
  const store = useUIStyleStore();
  
  return {
    // State
    themeId: store.themeId,
    mode: store.mode,
    effectiveMode: store.getEffectiveMode(),
    isDark: store.getEffectiveMode() === 'dark',
    isLight: store.getEffectiveMode() === 'light',
    isSystem: store.mode === 'system',
    
    // Actions
    setTheme: store.setTheme,
    setMode: store.setMode,
    toggleMode: store.toggleMode,
  };
}
