'use client';

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useI18n } from '@/contexts/I18nContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Search,
  Settings,
  User,
  LogOut,
  Command,
  HelpCircle,
  MessageSquare,
  ChevronDown,
  Menu,
  Plus,
  UserPlus,
  CalendarPlus,
  Sparkles,
  Crown,
  Layers,
  Box,
  Minimize,
  Sun,
  Moon,
  Building2,
  Zap,
  Gem,
  Keyboard,
  Flame,
  Clapperboard,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/contexts/PermissionContext';
import { useUIStore } from '@/store';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { GlobalSearch } from './global-search';
import { CommandPalette, type CommandPaletteHandle } from './command-palette';
import { UIStyleSwitcher, UIThemeToggle, useUIStyle } from '@/components/theme/ui-style-switcher';
import { format } from 'date-fns';
import { useUIStyleStore } from '@/lib/themes/store';
import { NotificationCenter, NotificationBellButton } from '@/components/notifications/notification-center';
import { KeyboardShortcutsOverlay, useKeyboardShortcuts } from '@/components/ui/keyboard-shortcuts-overlay';

interface HeaderProps {
  className?: string;
  onMenuClick?: () => void;
}

// Small emerald pulsing dot for live indicators
function LiveDot() {
  return (
    <span className="relative flex h-1.5 w-1.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
    </span>
  );
}

export function Header({ className, onMenuClick }: HeaderProps) {
  const { user, logout } = useAuth();
  const { canAccessMenu } = usePermissions();
  const { setCommandPaletteOpen, activeSection, setActiveSection, sidebarCollapsed } = useUIStore();
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live clock - updates every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const paletteRef = useRef<CommandPaletteHandle>(null);
  const router = useRouter();
  const { tNav, tCommon, tAuth } = useI18n();
  const { isDark, toggleMode } = useUIStyle();
  const { themeId } = useUIStyleStore();

  // Theme-specific icon - 10 themes
  const ThemeIcon = {
    'gradient-modern': Sparkles,
    'dark-premium': Crown,
    'cyber-neon': Zap,
    'sakura-pink': Sparkles,
    'neumorphism': Box,
    'minimalist': Minimize,
    'netflix-crimson': Flame,
    'obsidian-rose': Gem,
    'midnight-ivory': Moon,
    'scarlet-noir': Clapperboard,
  }[themeId] || Sparkles;

  // Get section title from active section with translations
  const getSectionTitle = () => {
    const section = activeSection.split('-')[0];
    const sectionKeyMap: Record<string, string> = {
      dashboard: 'dashboard',
      pms: 'pms',
      bookings: 'bookings',
      guests: 'guests',
      frontdesk: 'frontDesk',
      experience: 'experience',
      wifi: 'wifi',
      billing: 'billing',
      pos: 'pos',
      housekeeping: 'housekeeping',
      inventory: 'inventory',
      parking: 'parking',
      surveillance: 'security',
      crm: 'crm',
      automation: 'automation',
      reports: 'reports',
      revenue: 'revenue',
      channel: 'channels',
      integrations: 'integrations',
      notifications: 'notifications',
      webhooks: 'webhooks',
      ai: 'ai',
      admin: 'admin',
      settings: 'settings',
      help: 'help',
    };
    const key = sectionKeyMap[section];
    return key ? tNav(key) : tNav('dashboard');
  };

  const handleLogout = async () => {
    await logout();
  };

  const getInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`;
    }
    return 'U';
  };

  // Register keyboard shortcut listener
  const toggleShortcuts = useCallback(() => setShortcutsOpen(prev => !prev), []);
  useKeyboardShortcuts(toggleShortcuts);

  const quickActions = [
    { label: tNav('allBookings'), icon: CalendarPlus, section: 'bookings-calendar', color: 'text-blue-500 dark:text-blue-400', permission: 'bookings-calendar' },
    { label: tNav('checkIn'), icon: UserPlus, section: 'frontdesk-checkin', color: 'text-emerald-500 dark:text-emerald-400', permission: 'frontdesk-checkin' },
    { label: tNav('serviceRequests'), icon: Sparkles, section: 'experience-requests', color: 'text-purple-500 dark:text-purple-400', permission: 'experience-requests' },
  ].filter(action => canAccessMenu(action.permission));

  return (
    <header className={cn(
      "sticky top-0 z-30 flex h-14 sm:h-16 items-center justify-between border-b border-border/30 bg-background/80 backdrop-blur-2xl px-3 sm:px-4 transition-all duration-300",
      sidebarCollapsed ? "lg:ml-[68px]" : "lg:ml-[260px]", // Dynamic margin based on sidebar state
      className
    )}>
      {/* Subtle bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      {/* Left Section */}
      <div className="flex items-center gap-2 md:gap-4 min-w-0 flex-shrink">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 lg:hidden rounded-xl hover:bg-muted/80 active:scale-95 transition-all duration-200"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>

        {/* Page Title - Mobile & Desktop */}
        <div className="flex flex-col">
          <h1 className="text-base md:text-lg font-semibold flex items-center gap-2 truncate group/logo">
            <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-lg shadow-primary/20 transition-all duration-200 group-hover/logo:shadow-primary/40 group-hover/logo:scale-110">
              <ThemeIcon className="h-4 w-4" />
            </div>
            <span className="text-foreground font-semibold transition-all duration-200 relative">
              {getSectionTitle()}
            </span>
          </h1>
          <p className="text-[11px] text-muted-foreground/70 hidden md:flex items-center gap-1.5 tabular-nums">
            <span>{format(currentTime, 'EEEE, MMMM d')}</span>
            <span className="text-muted-foreground/30">•</span>
            <span className="flex items-center gap-1 text-muted-foreground/50">
              <LiveDot />
              {format(currentTime, 'HH:mm:ss')}
            </span>
          </p>
        </div>

      </div>

      {/* Center - Search (Desktop only) */}
      <div className="flex-1 max-w-md mx-4 hidden lg:block">
        <Button
          variant="outline"
          className="relative w-full h-10 justify-start text-muted-foreground bg-muted/30 backdrop-blur-sm hover:bg-muted/40 border-muted-foreground/10 transition-all duration-300 rounded-xl hover:shadow-md hover:shadow-primary/5 hover:border-muted-foreground/20 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:bg-muted/30"
          onClick={() => {
            setCommandPaletteOpen(true);
            paletteRef.current?.open();
          }}
          title="Search modules, bookings, guests, and more..."
        >
          <Search className="mr-2 h-4 w-4 text-muted-foreground/50" />
          <span className="flex-1 text-left text-sm text-muted-foreground/70">Search modules, bookings, guests...</span>
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted/60 px-1.5 font-mono text-[10px] font-medium text-muted-foreground/50 sm:flex">
            <span className="text-xs"><Command className="h-3 w-3" /></span>K
          </kbd>
        </Button>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        {/* Global Search Dialog */}
        <GlobalSearch />

        {/* Quick Actions - Desktop */}
        {quickActions.length > 0 && (
        <DropdownMenu open={showQuickActions} onOpenChange={setShowQuickActions}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="default"
              size="sm"
              className="h-9 gap-1.5 hidden md:flex bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-200 rounded-xl"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden xl:inline">Quick Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 rounded-xl">
            <DropdownMenuLabel>{tCommon('actions')}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {quickActions.map((action) => (
              <DropdownMenuItem
                key={action.section}
                className="gap-2 cursor-pointer rounded-lg"
                onClick={() => {
                  setActiveSection(action.section);
                  setShowQuickActions(false);
                }}
              >
                <action.icon className={cn("h-4 w-4", action.color)} />
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        )}

        {/* Help - Desktop */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 hidden md:flex rounded-xl transition-all duration-200" onClick={() => setActiveSection('help-center')}>
              <HelpCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4} className="text-xs font-medium">Help Center</TooltipContent>
        </Tooltip>

        {/* Keyboard Shortcuts Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 hidden md:flex rounded-xl transition-all duration-200"
              onClick={toggleShortcuts}
            >
              <Keyboard className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4} className="text-xs font-medium">
            Keyboard Shortcuts (?)
          </TooltipContent>
        </Tooltip>

        {/* Mobile Search Button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-11 w-11 text-muted-foreground/60 hover:text-foreground lg:hidden rounded-xl transition-all duration-200"
          onClick={() => {
            setCommandPaletteOpen(true);
            paletteRef.current?.open();
          }}
        >
          <Search className="h-4 w-4" />
          <span className="sr-only">Search</span>
        </Button>

        {/* Language Switcher */}
        <div className="hidden sm:block [&>div]:rounded-xl [&>div]:border-border/50 [&>div]:shadow-sm"><LanguageSwitcher variant="compact" /></div>

        {/* Theme Toggle (Light/Dark) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-muted-foreground/60 hover:text-foreground hover:bg-muted/60 rounded-xl transition-all duration-200"
              onClick={toggleMode}
            >
              {isDark ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4} className="text-xs font-medium">
            {isDark ? 'Light Mode' : 'Dark Mode'}
          </TooltipContent>
        </Tooltip>
        
        {/* UI Style Switcher */}
        <UIStyleSwitcher />

        {/* Notifications - Slide-in Panel */}
        <NotificationBellButton />
        <NotificationCenter />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-11 pl-2 pr-2 md:pr-3 gap-2 hover:bg-muted rounded-xl">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative">
                    <Avatar className="h-8 w-8 shadow-md shadow-primary/15">
                      <AvatarImage src={user?.avatar || undefined} />
                      <AvatarFallback className="bg-gradient-to-br from-primary via-primary/90 to-primary/70 text-primary-foreground text-xs font-medium">
                        {getInitials()}
                      </AvatarFallback>
                    </Avatar>
                    {/* Online status indicator with subtle pulse */}
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                      <span className="animate-[statusPulse_2.5s_ease-in-out_infinite] absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
                      <span className="relative inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500 border-[2px] border-background" />
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={6} className="text-xs font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    Online
                  </span>
                </TooltipContent>
              </Tooltip>
              <style>{`
                @keyframes statusPulse {
                  0%, 100% { transform: scale(1); opacity: 0.4; }
                  50% { transform: scale(1.8); opacity: 0; }
                }
              `}</style>
              <div className="hidden md:flex flex-col items-start">
                <span className="text-sm font-medium leading-none">
                  {user?.firstName || 'User'} {user?.lastName || ''}
                </span>
                <span className="text-[10px] text-muted-foreground leading-none mt-0.5 capitalize">
                  {user?.roleName || 'Staff'}
                </span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden md:block" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 rounded-xl border-border/40 shadow-xl shadow-black/[0.08] bg-background/95 backdrop-blur-xl overflow-hidden">
            <div className="h-[2px] bg-gradient-to-r from-primary/60 via-primary to-primary/60" />
            <DropdownMenuLabel className="font-normal pt-3">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-semibold leading-none">
                  {user?.firstName || 'User'} {user?.lastName || ''}
                </p>
                <p className="text-xs leading-none text-muted-foreground mt-1">
                  {user?.email || 'user@example.com'}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2 cursor-pointer rounded-lg hover:bg-gradient-to-r hover:from-primary/5 hover:to-primary/10 transition-all duration-200" onClick={() => setActiveSection('profile')}>
              <User className="h-4 w-4" />
              {tCommon('profile')}
            </DropdownMenuItem>
            {canAccessMenu('settings-general') && (
              <DropdownMenuItem className="gap-2 cursor-pointer rounded-lg hover:bg-gradient-to-r hover:from-primary/5 hover:to-primary/10 transition-all duration-200" onClick={() => setActiveSection('settings-general')}>
                <Settings className="h-4 w-4" />
                {tCommon('settings')}
              </DropdownMenuItem>
            )}
            {canAccessMenu('help-center') && (
              <DropdownMenuItem className="gap-2 cursor-pointer rounded-lg hover:bg-gradient-to-r hover:from-primary/5 hover:to-primary/10 transition-all duration-200" onClick={() => setActiveSection('help-center')}>
                <MessageSquare className="h-4 w-4" />
                {tCommon('help')}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="gap-2 text-destructive focus:text-destructive cursor-pointer rounded-lg hover:bg-destructive/5 transition-all duration-200"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              {tAuth('logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Command Palette */}
      <CommandPalette ref={paletteRef} />

      {/* Keyboard Shortcuts Overlay */}
      <KeyboardShortcutsOverlay open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </header>
  );
}
