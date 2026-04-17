'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hotel, Users, Calendar, DollarSign, TrendingUp,
  Star, MapPin, Wifi, Car, Coffee, ArrowRight, Check,
  BedDouble, Bath, Tv, Wind, Sparkles, Crown, Box, Minus, Zap,
  Sun, Moon, Monitor, Palette
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useThemeStore, initializeTheme } from '@/lib/themes/store';
import { ThemeId, ThemeConfig, getAllThemes } from '@/lib/themes/config';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// Theme icon mapping
const themeIcons: Partial<Record<ThemeId, typeof Sparkles>> = {
  'gradient-modern': Sparkles,
  'dark-premium': Crown,
  'cyber-neon': Zap,
  'sakura-pink': Sparkles,
  'neumorphism': Box,
  'minimalist': Minus,
};

// Theme preview gradient colors
const themeGradients: Partial<Record<ThemeId, string>> = {
  'gradient-modern': 'from-violet-500 via-purple-500 to-indigo-600',
  'dark-premium': 'from-amber-400 via-orange-500 to-amber-600',
  'cyber-neon': 'from-cyan-400 via-purple-500 to-pink-500',
  'sakura-pink': 'from-pink-300 via-pink-400 to-rose-500',
  'neumorphism': 'from-teal-400 via-cyan-500 to-teal-600',
  'minimalist': 'from-gray-400 via-gray-500 to-gray-600',
};

// Sample dashboard card for theme preview
const ThemePreviewCard = ({ themeId }: { themeId: ThemeId }) => {
  const gradient = themeGradients[themeId];
  const isNeon = themeId === 'cyber-neon';
  const isNeumorphic = themeId === 'neumorphism';
  const isMinimal = themeId === 'minimalist';

  return (
    <div className="space-y-3">
      {/* Header with gradient */}
      <div className={cn(
        'h-24 rounded-xl relative overflow-hidden',
        `bg-gradient-to-br ${gradient}`
      )}>
        {isNeon && (
          <div className="absolute inset-0 bg-black/10" />
        )}
        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-bold text-lg">The Grand Palace</h3>
              <p className="text-white/70 text-xs flex items-center gap-1">
                <MapPin className="h-3 w-3" /> Paris, France
              </p>
            </div>
            <div className="flex items-center gap-1 bg-white/20 backdrop-blur-sm rounded-full px-2 py-0.5">
              <Star className="h-3 w-3 text-yellow-300 fill-yellow-300" />
              <span className="text-white text-xs font-medium">4.9</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { icon: BedDouble, value: '250', label: 'Rooms' },
          { icon: Users, value: '1,234', label: 'Guests' },
          { icon: DollarSign, value: '$89K', label: 'Revenue' },
        ].map((stat, i) => (
          <div
            key={i}
            className={cn(
              'p-2 rounded-lg text-center',
              isNeumorphic && 'shadow-[4px_4px_8px_#d1d5db,-4px_-4px_8px_#ffffff] bg-gray-100',
              isNeon && 'border border-cyan-500/30 shadow-[0_0_8px_rgba(0,255,255,0.3)]',
              isMinimal && 'border border-gray-200',
              !isNeumorphic && !isNeon && !isMinimal && 'bg-gray-50 dark:bg-gray-800'
            )}
          >
            <stat.icon className="h-4 w-4 mx-auto text-muted-foreground" />
            <p className="text-base font-bold">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button
          size="sm"
          className={cn(
            'flex-1 text-xs',
            themeId === 'gradient-modern' && 'bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700',
            themeId === 'dark-premium' && 'bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-gray-900',
            themeId === 'cyber-neon' && 'bg-gradient-to-r from-cyan-400 to-pink-500 hover:from-cyan-500 hover:to-pink-600',
            themeId === 'sakura-pink' && 'bg-gradient-to-r from-pink-400 to-rose-500 hover:from-pink-500 hover:to-rose-600',
            themeId === 'minimalist' && 'bg-gray-900 hover:bg-gray-800 text-white'
          )}
        >
          New Booking
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs"
        >
          View Dashboard
        </Button>
      </div>
    </div>
  );
};

// Theme card in grid
interface ThemeCardProps {
  theme: ThemeConfig;
  isActive: boolean;
  onSelect: () => void;
}

const ThemeCard = ({ theme, isActive, onSelect }: ThemeCardProps) => {
  const Icon = themeIcons[theme.id] || Sparkles;
  const gradient = themeGradients[theme.id] || 'from-gray-400 via-gray-500 to-gray-600';

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={cn(
        'cursor-pointer rounded-2xl overflow-hidden transition-all duration-300',
        'border-2',
        isActive
          ? 'border-primary shadow-lg shadow-primary/20 ring-2 ring-primary/30'
          : 'border-transparent hover:border-muted-foreground/30'
      )}
    >
      {/* Theme Preview */}
      <div className={cn(
        'aspect-[4/3] relative overflow-hidden',
        `bg-gradient-to-br ${gradient}`
      )}>
        {/* Icon */}
        <div className="absolute top-3 left-3 h-10 w-10 rounded-xl bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
          <Icon className="h-5 w-5 text-gray-700" />
        </div>

        {/* Selected Badge */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute top-3 right-3 h-6 w-6 rounded-full bg-white flex items-center justify-center shadow-lg"
            >
              <Check className="h-4 w-4 text-green-600" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mini Preview */}
        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex gap-1.5">
            <div className="flex-1 h-1.5 rounded-full bg-white/40" />
            <div className="flex-1 h-1.5 rounded-full bg-white/30" />
            <div className="w-8 h-1.5 rounded-full bg-white/20" />
          </div>
        </div>
      </div>

      {/* Theme Info */}
      <div className="p-3 bg-card">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{theme.name}</h3>
          {isActive && (
            <span className="text-xs text-primary font-medium">Active</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{theme.description}</p>
      </div>
    </motion.div>
  );
};

// Mode button
interface ModeButtonProps {
  mode: 'light' | 'dark' | 'system';
  currentMode: string;
  icon: typeof Sun;
  label: string;
  onSelect: () => void;
}

const ModeButton = ({ mode, currentMode, icon: Icon, label, onSelect }: ModeButtonProps) => {
  const isActive = mode === currentMode;

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={cn(
        'flex-1 flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-200',
        'border-2',
        isActive
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-transparent bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground'
      )}
    >
      <Icon className="h-5 w-5" />
      <span className="text-xs font-medium">{label}</span>
    </motion.button>
  );
};

// Main Theme Switcher Component
export function UIStyleShowcase() {
  const { themeId, mode, setTheme, setMode } = useThemeStore();
  const themes = getAllThemes();
  const [previewTheme, setPreviewTheme] = useState<ThemeId>(themeId);

  // Initialize theme on mount
  useEffect(() => {
    initializeTheme();
  }, []);

  const handleThemeSelect = (id: ThemeId) => {
    setPreviewTheme(id);
    setTheme(id);
  };

  const handleModeSelect = (newMode: 'light' | 'dark' | 'system') => {
    setMode(newMode);
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-full px-4 py-2 mb-4"
          >
            <Palette className="h-4 w-4 text-primary" />
            <span className="text-primary text-sm font-medium">Theme Settings</span>
          </motion.div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Choose Your Theme
          </h1>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Personalize your StaySuite experience with our curated collection of beautiful themes.
            Each theme is designed for optimal usability and visual appeal.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Theme Selection */}
          <div className="space-y-6">
            {/* Mode Selection */}
            <Card className="p-5">
              <h2 className="text-lg font-semibold mb-4">Color Mode</h2>
              <div className="flex gap-2">
                <ModeButton
                  mode="light"
                  currentMode={mode}
                  icon={Sun}
                  label="Light"
                  onSelect={() => handleModeSelect('light')}
                />
                <ModeButton
                  mode="dark"
                  currentMode={mode}
                  icon={Moon}
                  label="Dark"
                  onSelect={() => handleModeSelect('dark')}
                />
                <ModeButton
                  mode="system"
                  currentMode={mode}
                  icon={Monitor}
                  label="System"
                  onSelect={() => handleModeSelect('system')}
                />
              </div>
            </Card>

            {/* Theme Selection */}
            <Card className="p-5">
              <h2 className="text-lg font-semibold mb-4">Theme Style</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {themes.map((theme) => (
                  <ThemeCard
                    key={theme.id}
                    theme={theme}
                    isActive={themeId === theme.id}
                    onSelect={() => handleThemeSelect(theme.id)}
                  />
                ))}
              </div>
            </Card>

            {/* Theme Features */}
            <Card className="p-5">
              <h2 className="text-lg font-semibold mb-4">Active Theme Features</h2>
              <div className="flex flex-wrap gap-2">
                {themes.find(t => t.id === themeId)?.features && (
                  <>
                    {themes.find(t => t.id === themeId)!.features.glassEffect && (
                      <span className="px-3 py-1.5 rounded-full bg-blue-500/10 text-blue-500 text-sm font-medium border border-blue-500/20">
                        Glass Effect
                      </span>
                    )}
                    {themes.find(t => t.id === themeId)!.features.softShadows && (
                      <span className="px-3 py-1.5 rounded-full bg-purple-500/10 text-purple-500 text-sm font-medium border border-purple-500/20">
                        Soft Shadows
                      </span>
                    )}
                    {themes.find(t => t.id === themeId)!.features.gradients && (
                      <span className="px-3 py-1.5 rounded-full bg-pink-500/10 text-pink-500 text-sm font-medium border border-pink-500/20">
                        Gradients
                      </span>
                    )}
                    {themes.find(t => t.id === themeId)!.features.animations && (
                      <span className="px-3 py-1.5 rounded-full bg-green-500/10 text-green-500 text-sm font-medium border border-green-500/20">
                        Animations
                      </span>
                    )}
                    <span className="px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-600 text-sm font-medium border border-amber-500/20">
                      Rounded: {themes.find(t => t.id === themeId)!.features.roundedCorners.toUpperCase()}
                    </span>
                  </>
                )}
              </div>
            </Card>
          </div>

          {/* Right: Live Preview */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Card className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Live Preview</h2>
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
              </div>

              {/* Phone Frame */}
              <div className="flex justify-center">
                <div className="w-full max-w-sm bg-gray-950 rounded-[2.5rem] p-2 shadow-2xl border border-gray-800">
                  <div className="bg-background rounded-[2rem] overflow-hidden">
                    {/* Status Bar */}
                    <div className="flex items-center justify-between px-5 py-2 bg-muted/50">
                      <span className="text-xs font-medium">9:41</span>
                      <div className="flex items-center gap-1">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4].map(i => (
                            <div key={i} className="w-1 bg-foreground/60 rounded-full" style={{ height: `${i * 2 + 4}px` }} />
                          ))}
                        </div>
                        <div className="w-6 h-2.5 bg-foreground/60 rounded-sm" />
                      </div>
                    </div>

                    {/* Preview Content */}
                    <div className="p-4">
                      <motion.div
                        key={previewTheme}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <ThemePreviewCard themeId={previewTheme} />
                      </motion.div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Theme Name */}
              <div className="text-center mt-4">
                <h3 className="font-semibold text-lg">
                  {themes.find(t => t.id === previewTheme)?.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {themes.find(t => t.id === previewTheme)?.description}
                </p>
              </div>
            </Card>

            {/* Apply Button */}
            <div className="mt-4">
              <Button
                className="w-full h-12 text-base font-semibold bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-600 hover:to-indigo-700 text-white shadow-lg shadow-violet-500/30"
                onClick={() => {
                  setTheme(previewTheme);
                }}
              >
                <Sparkles className="h-5 w-5 mr-2" />
                Apply Theme
              </Button>
              <p className="text-center text-xs text-muted-foreground mt-2">
                Theme preferences are saved automatically
              </p>
            </div>
          </div>
        </div>

        {/* Theme Comparison */}
        <Card className="p-5">
          <h2 className="text-lg font-semibold mb-4">All Themes Comparison</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {themes.map((theme) => {
              const Icon = themeIcons[theme.id] || Sparkles;
              const gradient = themeGradients[theme.id] || 'from-gray-400 via-gray-500 to-gray-600';

              return (
                <motion.button
                  key={theme.id}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => handleThemeSelect(theme.id)}
                  className={cn(
                    'p-3 rounded-xl transition-all text-left',
                    themeId === theme.id
                      ? 'bg-primary/10 border-2 border-primary ring-2 ring-primary/20'
                      : 'bg-muted/50 border-2 border-transparent hover:border-muted-foreground/20'
                  )}
                >
                  <div className={cn('w-10 h-10 rounded-lg mb-2 flex items-center justify-center', `bg-gradient-to-br ${gradient}`)}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <h4 className="font-medium text-sm">{theme.name}</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{theme.description}</p>
                </motion.button>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default UIStyleShowcase;
