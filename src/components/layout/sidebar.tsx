'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  ChevronDown, 
  ChevronRight, 
  Search,
  PanelLeftClose,
  PanelLeft,
  X,
  Lock,
  Sparkles,
  Crown,
  Layers,
  Box,
  Minimize,
  Building2,
  Loader2,
  Zap,
  Flame,
  Gem,
  Moon,
  Clapperboard,
  LogOut,
  Settings,
  User,
  Activity,
  TrendingUp,
  Users,
  BedDouble,
  DollarSign,
  Keyboard,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { navigationConfig, NavSection, NavItem } from '@/config/navigation';
import { useUIStore } from '@/store';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFeatureFlags } from '@/contexts/FeatureFlagsContext';
import { usePermissions } from '@/contexts/PermissionContext';
import { getFeatureForMenuItem } from '@/lib/feature-flags';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslatedNavigation } from '@/hooks/useNavigationTranslations';
import { useUIStyleStore } from '@/lib/themes/store';
import { useTenantSwitcher } from '@/hooks/use-tenant-switcher';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// =============================================
// CONSTANTS
// =============================================
const SIDEBAR_EXPANDED_WIDTH = 260;
const SIDEBAR_COLLAPSED_WIDTH = 68;

// =============================================
// CUSTOM SCROLLBAR STYLES - BRIGHTER
// =============================================
const scrollbarStyles = `
  .sidebar-scroll::-webkit-scrollbar {
    width: 4px;
  }
  .sidebar-scroll::-webkit-scrollbar-track {
    background: transparent;
  }
  .sidebar-scroll::-webkit-scrollbar-thumb {
    background: oklch(from var(--sidebar-foreground) l c h / 0.20);
    border-radius: 9999px;
  }
  .sidebar-scroll::-webkit-scrollbar-thumb:hover {
    background: oklch(from var(--sidebar-foreground) l c h / 0.35);
  }
  .sidebar-scroll {
    scrollbar-width: thin;
    scrollbar-color: oklch(from var(--sidebar-foreground) l c h / 0.20) transparent;
  }
`;

// =============================================
// KEYFRAME ANIMATIONS
// =============================================
const keyframeStyles = `
  @keyframes searchRingExpand {
    0% { box-shadow: 0 0 0 0 oklch(from var(--sidebar-primary) l c h / 0.3); }
    50% { box-shadow: 0 0 0 6px oklch(from var(--sidebar-primary) l c h / 0.08); }
    100% { box-shadow: 0 0 0 0 oklch(from var(--sidebar-primary) l c h / 0); }
  }
  .search-ring-animate {
    animation: searchRingExpand 1.5s ease-out infinite;
  }
  @keyframes statBarGrow {
    from { transform: scaleX(0); }
    to { transform: scaleX(1); }
  }
  .stat-bar-grow {
    animation: statBarGrow 1s ease-out forwards;
    transform-origin: left;
  }
`;

// =============================================
// INTERFACES
// =============================================
interface SidebarProps {
  className?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

interface SidebarItemProps {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
  isFeatureEnabled: boolean;
  hasPermission: boolean;
  collapsed?: boolean;
}

interface SidebarSectionProps {
  section: NavSection;
  isExpanded: boolean;
  onToggle: () => void;
  activeSection: string;
  onNavClick: (href: string) => void;
  visibleItems: NavItem[];
  isMenuItemVisible: (menuItem: string) => boolean;
  canAccessMenu: (menuItem: string) => boolean;
}

interface NavigationContentProps {
  filteredNavigation: NavSection[];
  expandedSections: string[];
  toggleSection: (title: string) => void;
  activeSection: string;
  handleNavClick: (href: string) => void;
  isMenuItemVisible: (menuItem: string) => boolean;
  canAccessMenu: (menuItem: string) => boolean;
}

interface SearchInputProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

interface LogoProps {
  showClose?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
}

// =============================================
// ULTRA-MODERN PREMIUM SIDEBAR ITEM
// =============================================
function SidebarItem({ item, isActive, onClick, isFeatureEnabled, hasPermission, collapsed }: SidebarItemProps) {
  const menuItemId = item.href.replace('#', '');
  const featureId = getFeatureForMenuItem(menuItemId);
  
  if (!hasPermission) return null;
  
  // Collapsed mode: icon-only with tooltip
  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={item.href}
            onClick={onClick}
            className={cn(
              "relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 mx-auto group/item",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
              isActive
                ? "bg-sidebar-accent/40 text-primary"
                : "text-sidebar-foreground hover:bg-sidebar-accent/40 hover:text-sidebar-foreground"
            )}
          >
            {isActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-primary rounded-r-full" />
            )}
            <item.icon className="h-4 w-4" />
            {item.badge && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-sidebar-primary text-white text-[9px] font-bold px-1 animate-pulse">
                {item.badge}
              </span>
            )}
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="text-xs font-medium bg-sidebar-accent/95 backdrop-blur-xl border-sidebar-border/30 text-sidebar-foreground">
          {item.title}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Disabled/locked item
  if (!isFeatureEnabled && featureId) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] opacity-50 cursor-not-allowed group/item">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-sidebar-accent/20 flex-shrink-0">
          <item.icon className="h-3.5 w-3.5 text-sidebar-foreground" />
        </div>
        <span className="flex-1 truncate text-sidebar-foreground">{item.title}</span>
        <Lock className="h-3 w-3 text-sidebar-foreground" />
      </div>
    );
  }
  
  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        "group/item relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium",
        "transition-all duration-200 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary/30 focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
        isActive
          ? "bg-sidebar-accent/40 text-foreground font-semibold"
          : "text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/40 hover:scale-[1.01]"
      )}
    >
      {/* Active left accent bar - clean 2px solid */}
      <div className={cn(
        "absolute left-0 top-1/2 -translate-y-1/2 rounded-r-full transition-all duration-300 ease-out",
        isActive
          ? "h-5 w-[2px] bg-primary"
          : "h-0 w-0 bg-transparent group-hover/item:h-2 group-hover/item:w-[2px] group-hover/item:bg-primary/30"
      )} />

      {/* Icon in soft rounded container with teal tint when active */}
      <div className={cn(
        "flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200 ease-out flex-shrink-0",
        isActive
          ? "bg-gradient-to-br from-sidebar-primary/15 to-sidebar-ring/5 text-sidebar-primary shadow-sm shadow-sidebar-primary/10"
          : "bg-transparent text-sidebar-foreground group-hover/item:bg-sidebar-accent/50 group-hover/item:text-sidebar-foreground"
      )}>
        <item.icon className="h-3.5 w-3.5" />
      </div>

      <span className={cn(
        "flex-1 truncate transition-all duration-200"
      )}>{item.title}</span>

      {/* Notification badge with animated pulse */}
      {item.badge && (
        <span className={cn(
          "relative inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-md text-[10px] font-semibold tabular-nums transition-all duration-200",
          isActive
            ? "bg-gradient-to-r from-sidebar-primary/20 to-sidebar-ring/15 text-sidebar-primary"
            : "bg-sidebar-accent/50 text-sidebar-foreground"
        )}>
          {item.badge}
          {/* Animated pulse ring for badges */}
          <span className={cn(
            "absolute inset-0 rounded-md animate-ping opacity-20",
            isActive ? "bg-sidebar-primary" : "bg-sidebar-foreground/50"
          )} />
        </span>
      )}
    </Link>
  );
}

// =============================================
// ULTRA-MODERN SIDEBAR SECTION (with framer-motion)
// =============================================
function SidebarSection({ section, isExpanded, onToggle, activeSection, onNavClick, visibleItems, isMenuItemVisible, canAccessMenu }: SidebarSectionProps) {
  const hasActiveItem = visibleItems.some(item => activeSection === item.href.replace('#', ''));
  
  if (visibleItems.length === 0) return null;
  
  return (
    <div>
      <button
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-[0.12em] transition-all duration-200 group/section",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary/30",
          "hover:bg-sidebar-accent/20",
          hasActiveItem 
            ? "text-sidebar-primary" 
            : "text-sidebar-foreground hover:text-sidebar-foreground"
        )}
      >
        {/* Section icon with gradient accent when active */}
        <div className={cn(
          "flex items-center justify-center w-5 h-5 rounded-md transition-all duration-200",
          hasActiveItem 
            ? "bg-gradient-to-br from-sidebar-primary/20 to-sidebar-ring/10 text-sidebar-primary" 
            : "text-sidebar-foreground/50 group-hover/section:text-sidebar-foreground/70"
        )}>
          <section.icon className="h-2.5 w-2.5" />
        </div>
        <span className="flex-1 text-left">{section.title}</span>
        <motion.div
          animate={{ rotate: isExpanded ? 0 : -90 }}
          transition={{ duration: 0.2, ease: 'easeInOut' }}
        >
          <ChevronDown className="h-3 w-3" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-0.5 ml-1.5 pl-3 border-l border-sidebar-border/20 space-y-px">
              {visibleItems.map((item) => {
                const menuItemId = item.href.replace('#', '');
                return (
                  <SidebarItem
                    key={item.id || item.href}
                    item={item}
                    isActive={activeSection === menuItemId}
                    onClick={() => onNavClick(item.href)}
                    isFeatureEnabled={true}
                    hasPermission={true}
                  />
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// =============================================
// NAVIGATION CONTENT
// =============================================
function NavigationContent({ 
  filteredNavigation, 
  expandedSections, 
  toggleSection, 
  activeSection, 
  handleNavClick,
  isMenuItemVisible,
  canAccessMenu
}: NavigationContentProps) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth sidebar-scroll">
      <nav className="px-3 py-2 space-y-0.5">
        {filteredNavigation.map((section, idx) => {
          const visibleItems = section.items.filter(item => {
            const menuItemId = item.href.replace('#', '');
            return canAccessMenu(menuItemId) && isMenuItemVisible(menuItemId);
          });
          
          if (visibleItems.length === 0) return null;
          
          let showDivider = false;
          if (idx < filteredNavigation.length - 1) {
            const nextSection = filteredNavigation[idx + 1];
            const nextVisibleItems = nextSection.items.filter(item => {
              const menuItemId = item.href.replace('#', '');
              return canAccessMenu(menuItemId) && isMenuItemVisible(menuItemId);
            });
            showDivider = nextVisibleItems.length > 0;
          }
          
          const sectionEl = (
            <SidebarSection
              key={section.id}
              section={section}
              isExpanded={expandedSections.includes(section.id)}
              onToggle={() => toggleSection(section.id)}
              activeSection={activeSection}
              onNavClick={handleNavClick}
              visibleItems={visibleItems}
              isMenuItemVisible={isMenuItemVisible}
              canAccessMenu={canAccessMenu}
            />
          );
          
          return showDivider ? (
            <React.Fragment key={section.id}>
              {sectionEl}
              <div className="mx-4 my-2 h-px bg-gradient-to-r from-transparent via-sidebar-border/30 to-transparent" />
            </React.Fragment>
          ) : (
            sectionEl
          );
        })}
      </nav>
    </div>
  );
}

// =============================================
// GLASS-STYLE SEARCH INPUT (Enhanced)
// =============================================
function SearchInput({ searchQuery, setSearchQuery }: SearchInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  
  return (
    <div className="px-3 pt-2 pb-1 flex-shrink-0">
      <div className="relative group/search">
        <motion.div
          animate={{ 
            x: isFocused ? -1 : 0,
            scale: isFocused ? 1.05 : 1 
          }}
          transition={{ duration: 0.2 }}
        >
          <Search className={cn(
            "absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 transition-colors duration-300 z-10",
            isFocused 
              ? "text-sidebar-primary" 
              : "text-sidebar-foreground group-focus-within/search:text-sidebar-foreground"
          )} />
        </motion.div>
        <Input
          placeholder="Search navigation..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={cn(
            "pl-9 pr-8 h-8 text-sidebar-foreground text-[13px] placeholder:text-sidebar-foreground/50",
            "bg-sidebar-accent/25 backdrop-blur-sm border-sidebar-border/[0.10]",
            "transition-all duration-300 ease-out rounded-xl",
            "focus-visible:ring-1 focus-visible:ring-sidebar-primary/30",
            "focus-visible:bg-sidebar-accent/40 focus-visible:border-sidebar-primary/20",
            "hover:bg-sidebar-accent/30 hover:border-sidebar-border/15",
            isFocused && "search-ring-animate"
          )}
        />
        {/* Ctrl+K shortcut hint - enhanced styling */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          <kbd className={cn(
            "hidden sm:inline-flex h-[18px] items-center gap-0.5 rounded-md border px-1.5 font-mono text-[10px] font-medium transition-all duration-200",
            isFocused
              ? "border-sidebar-primary/30 bg-sidebar-primary/10 text-sidebar-primary"
              : "border-sidebar-border/35 bg-sidebar-accent/20 text-sidebar-foreground"
          )}>
            <Keyboard className="h-2 w-2" />K
          </kbd>
        </div>
      </div>
    </div>
  );
}

// =============================================
// TENANT SWITCHER - Compact & Clean
// =============================================
function TenantSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { isPlatformAdmin, availableTenants, activeTenantId, switchTenant, isLoading } =
    useTenantSwitcher();

  if (!isPlatformAdmin) return null;

  if (collapsed) {
    return (
      <div className="px-2 py-2 border-t border-sidebar-border/15 flex-shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center h-9 w-9 mx-auto rounded-xl bg-sidebar-accent/20 border border-sidebar-border/15 cursor-pointer hover:bg-sidebar-accent/30 transition-all duration-200">
              <Crown className="h-3.5 w-3.5 text-amber-400 dark:text-amber-300" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="text-xs font-medium">
            Platform Admin
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="px-3 py-2 border-t border-sidebar-border/15 flex-shrink-0">
      <div className="flex items-center gap-2 mb-1.5">
        <Crown className="h-3 w-3 text-amber-400 dark:text-amber-300 flex-shrink-0" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground">
          Platform Admin
        </span>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-2 text-[11px] text-sidebar-foreground py-1 px-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Loading...
        </div>
      ) : availableTenants.length === 0 ? (
        <div className="text-[11px] text-sidebar-foreground py-1 px-1">
          No tenants found
        </div>
      ) : (
        <Select
          value={activeTenantId ?? ''}
          onValueChange={(val) => switchTenant(val)}
        >
          <SelectTrigger className="w-full h-8 bg-sidebar-accent/20 backdrop-blur-sm border-sidebar-border/[0.12] text-sidebar-foreground text-[11px] rounded-xl focus-visible:ring-sidebar-primary/30 hover:bg-sidebar-accent/25 hover:border-sidebar-border/20 transition-all duration-200">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="h-3 w-3 text-sidebar-foreground flex-shrink-0" />
              <SelectValue placeholder="Select tenant" />
            </div>
          </SelectTrigger>
          <SelectContent>
            {availableTenants.map((tenant) => (
              <SelectItem key={tenant.id} value={tenant.id}>
                <div className="flex items-center gap-2">
                  <span className="truncate">{tenant.name}</span>
                  <span className="ml-auto text-[10px] px-1.5 py-0 rounded bg-sidebar-accent/60 text-sidebar-foreground font-medium flex-shrink-0">
                    {tenant.plan}
                  </span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// =============================================
// QUICK STATS FOOTER (Enhanced with gradient bars & mount animation)
// =============================================
function formatRevenue(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(1)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

function QuickStats({ collapsed }: { collapsed?: boolean }) {
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState<{ occupancyRate: number; revenueToday: number } | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchStats() {
      try {
        const res = await fetch('/api/dashboard/quick-stats');
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (json.success && json.data && !cancelled) {
          const { totalRooms, availableRooms, revenueToday } = json.data;
          const occupancyRate = totalRooms > 0
            ? Math.round(((totalRooms - availableRooms) / totalRooms) * 100)
            : 0;
          setStats({ occupancyRate, revenueToday: revenueToday || 0 });
        }
      } catch {
        // Silently fail — will show "--" fallback
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchStats();
    return () => { cancelled = true; };
  }, []);

  const occupancyDisplay = loading ? '...' : stats ? `${stats.occupancyRate}%` : '--';
  const revenueDisplay = loading ? '...' : stats ? formatRevenue(stats.revenueToday) : '--';
  const barOccupancy = stats ? stats.occupancyRate : 0;
  // Revenue bar: map today's revenue against a reasonable daily target ($10K)
  // so the bar gives a visual sense of progress even without a real target
  const revenueTarget = 10_000;
  const barRevenue = stats && stats.revenueToday > 0
    ? Math.min(100, Math.round((stats.revenueToday / revenueTarget) * 100))
    : 0;

  if (collapsed) {
    return (
      <div className="px-2 py-2 border-t border-sidebar-border/15 flex-shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center justify-center h-9 w-9 mx-auto rounded-xl bg-sidebar-accent/20 transition-all duration-200">
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 text-emerald-400 dark:text-emerald-300 animate-spin" />
              ) : (
                <Activity className="h-3.5 w-3.5 text-emerald-400 dark:text-emerald-300" />
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="text-xs font-medium">
            {occupancyDisplay} Occupancy · {revenueDisplay} Revenue
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="px-3 py-2.5 border-t border-sidebar-border/15 flex-shrink-0">
      <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-sidebar-accent/[0.12] border border-sidebar-border/[0.08]">
        {/* Occupancy */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <BedDouble className="h-3 w-3 text-emerald-400 dark:text-emerald-300 flex-shrink-0" />
            {loading ? (
              <Loader2 className="h-3 w-3 text-sidebar-foreground animate-spin" />
            ) : (
              <span className="text-[11px] font-semibold text-sidebar-foreground tabular-nums">{occupancyDisplay}</span>
            )}
          </div>
          <p className="text-[9px] text-sidebar-foreground mt-0.5 uppercase tracking-wider">Occupancy</p>
          {/* Mini gradient bar */}
          <div className="mt-1 h-1 rounded-full bg-sidebar-accent/30 overflow-hidden">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-sidebar-primary to-sidebar-ring stat-bar-grow w-0"
              style={{ width: mounted && !loading ? `${barOccupancy}%` : undefined, transition: 'width 1s ease-out' }}
            />
          </div>
        </div>
        
        {/* Divider */}
        <div className="w-px h-6 bg-sidebar-border/15" />
        
        {/* Revenue */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <DollarSign className="h-3 w-3 text-sidebar-primary flex-shrink-0" />
            {loading ? (
              <Loader2 className="h-3 w-3 text-sidebar-foreground animate-spin" />
            ) : (
              <span className="text-[11px] font-semibold text-sidebar-foreground tabular-nums">{revenueDisplay}</span>
            )}
          </div>
          <p className="text-[9px] text-sidebar-foreground mt-0.5 uppercase tracking-wider">Revenue</p>
          {/* Mini gradient bar */}
          <div className="mt-1 h-1 rounded-full bg-sidebar-accent/30 overflow-hidden">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-sidebar-primary to-sidebar-ring stat-bar-grow w-0"
              style={{ width: mounted && !loading ? `${barRevenue}%` : undefined, transition: 'width 1s ease-out 0.2s' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================
// ULTRA-MODERN USER PROFILE (Enhanced)
// =============================================
function UserProfile({ collapsed }: { collapsed?: boolean }) {
  const { user } = useAuth();
  const { roleName, isAdmin } = usePermissions();
  
  const initials = user 
    ? `${user.firstName?.charAt(0) || ''}${user.lastName?.charAt(0) || ''}`.toUpperCase()
    : 'U';
  
  const displayName = user?.name || 'User';
  const tenantName = user?.tenant?.name || 'Hotel';

  if (collapsed) {
    return (
      <div className="px-2 py-2 border-t border-sidebar-border/15 flex-shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative flex items-center justify-center h-9 w-9 mx-auto rounded-xl bg-sidebar-accent/25 cursor-pointer hover:bg-sidebar-accent/35 transition-all duration-200 hover:-translate-y-0.5">
              <span className="text-[11px] font-bold text-sidebar-primary">{initials}</span>
              {/* Online status dot with pulse */}
              <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-40" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 border-[1.5px] border-sidebar" />
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="text-xs font-medium">
            {displayName} · {roleName}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }
  
  return (
    <div className="px-3 py-3 flex-shrink-0">
      {/* Gradient separator above profile */}
      <div className="h-px mb-3 bg-gradient-to-r from-transparent via-sidebar-primary/20 to-transparent" />
      <div className="flex items-center gap-3 p-2.5 rounded-xl bg-sidebar-accent/[0.12] border border-sidebar-border/[0.08] hover:bg-sidebar-accent/20 hover:border-sidebar-border/15 transition-all duration-200 cursor-pointer group/profile hover:-translate-y-[1px] hover:shadow-lg hover:shadow-sidebar-primary/[0.05]">
        {/* Avatar with online status dot */}
        <div className="relative flex-shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sidebar-primary/25 to-sidebar-ring/15 text-sidebar-primary text-xs font-bold transition-all duration-200 group-hover/profile:from-sidebar-primary/30 group-hover/profile:to-sidebar-ring/20 shadow-sm shadow-sidebar-primary/10">
            {initials}
          </div>
          {/* Online status dot with enhanced pulse */}
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 border-[2px] border-sidebar shadow-sm shadow-emerald-400/30" />
          </span>
        </div>
        
        {/* User Info */}
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-sidebar-foreground truncate leading-tight">{displayName}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <p className="text-[11px] text-sidebar-foreground truncate">{tenantName}</p>
            {isAdmin && (
              <Crown className="h-2.5 w-2.5 text-amber-400 dark:text-amber-300 flex-shrink-0" />
            )}
          </div>
        </div>
        
        {/* Role Badge - more prominent with colored pill */}
        <div className="flex-shrink-0">
          <span className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-[0.08em]",
            isAdmin 
              ? "bg-gradient-to-r from-amber-400/15 to-amber-500/10 text-amber-500 border border-amber-400/20 shadow-sm shadow-amber-400/10" 
              : "bg-gradient-to-r from-sidebar-primary/15 to-sidebar-ring/10 text-sidebar-primary border border-sidebar-primary/15 shadow-sm shadow-sidebar-primary/10"
          )}>
            {roleName.charAt(0).toUpperCase() + roleName.slice(1).replace('_', ' ')}
          </span>
        </div>
      </div>
    </div>
  );
}

// =============================================
// PREMIUM LOGO COMPONENT (Enhanced)
// =============================================
function Logo({ showClose, onClose, collapsed }: LogoProps) {
  const { themeId } = useUIStyleStore();
  
  const themeIconMap: Record<string, typeof Sparkles> = {
    'gradient-modern': Sparkles,
    'dark-premium': Crown,
    'cyber-neon': Zap,
    'sakura-pink': Sparkles,
    'glassmorphism': Layers,
    'neumorphism': Box,
    'minimalist': Minimize,
    'netflix-crimson': Flame,
    'obsidian-rose': Gem,
    'midnight-ivory': Moon,
    'scarlet-noir': Clapperboard,
  };
  const ThemeIcon = themeIconMap[themeId] || Sparkles;
  
  return (
    <div className={cn(
      "flex items-center flex-shrink-0",
      collapsed ? "justify-center px-2 py-4" : "justify-between px-4 py-3"
    )}>
      <Link href="/" className={cn("group/logo", collapsed && "flex justify-center")} onClick={onClose}>
        <div className="flex items-center gap-3">
          {/* Premium Logo Mark with gradient & glow */}
          <motion.div 
            className="relative"
            whileHover={{ scale: 1.08, rotate: 2 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          >
            {/* Outer glow ring */}
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-sidebar-primary/30 to-sidebar-ring/20 blur-md opacity-0 group-hover/logo:opacity-100 transition-opacity duration-500" />
            <div className={cn(
              "relative flex items-center justify-center rounded-xl transition-all duration-300",
              "bg-gradient-to-br from-sidebar-primary to-sidebar-ring",
              "shadow-lg shadow-sidebar-primary/25",
              "group-hover/logo:shadow-xl group-hover/logo:shadow-sidebar-primary/40",
              "h-9 w-9 text-xs font-bold"
            )}>
              <span className="text-white drop-shadow-sm font-extrabold">SS</span>
            </div>
            {/* Theme icon badge */}
            {!collapsed && (
              <div className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 rounded-full bg-sidebar border border-sidebar-border/30">
                <ThemeIcon className="h-2 w-2 text-sidebar-primary" />
              </div>
            )}
          </motion.div>
          
          {/* Brand Text */}
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-[14px] font-bold tracking-tight text-sidebar-foreground leading-none">
                StaySuite
              </span>
              <span className="text-[10px] text-sidebar-foreground uppercase tracking-[0.16em] font-medium mt-0.5">
                Hospitality OS
              </span>
            </div>
          )}
        </div>
      </Link>
      
      {showClose && onClose && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-7 w-7 text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/40 rounded-lg transition-all duration-200"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

// =============================================
// COLLAPSED NAVIGATION
// =============================================
function CollapsedNavigation({
  activeSection,
  setActiveSection,
  setExpandedSections,
  isMenuItemVisible,
  canAccessMenu,
  navigation
}: {
  activeSection: string;
  setActiveSection: (section: string) => void;
  setExpandedSections: (sections: string[]) => void;
  isMenuItemVisible: (menuItem: string) => boolean;
  canAccessMenu: (menuItem: string) => boolean;
  navigation: NavSection[];
}) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto scroll-smooth sidebar-scroll">
      <nav className="p-2 space-y-1">
        {navigation.map((section) => {
          const visibleItems = section.items.filter(item => {
            const menuItemId = item.href.replace('#', '');
            return canAccessMenu(menuItemId) && isMenuItemVisible(menuItemId);
          });
          
          if (visibleItems.length === 0) return null;
          
          const firstVisibleItem = visibleItems[0];
          const firstVisibleItemId = firstVisibleItem.href.replace('#', '');
          const isActive = activeSection.startsWith(firstVisibleItemId.split('-')[0]) || 
                           activeSection === firstVisibleItemId;
          
          return (
            <Tooltip key={section.id}>
              <TooltipTrigger asChild>
                <Link
                  href={firstVisibleItem.href}
                  onClick={() => {
                    setActiveSection(firstVisibleItem.href.replace('#', ''));
                    setExpandedSections([section.id]);
                  }}
                  className={cn(
                    "relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 mx-auto group/item",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-primary/40 focus-visible:ring-offset-1 focus-visible:ring-offset-sidebar",
                    isActive
                      ? "bg-sidebar-accent/40 text-primary"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/35 hover:text-sidebar-foreground"
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 bg-primary rounded-r-full" />
                  )}
                  <section.icon className="h-4 w-4" />
                  {/* Notification indicator for section */}
                  {visibleItems.some(item => item.badge) && (
                    <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-sidebar-primary animate-pulse" />
                  )}
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="text-xs font-medium bg-sidebar-accent/95 backdrop-blur-xl border-sidebar-border/30 text-sidebar-foreground">
                {section.title}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>
    </div>
  );
}

// =============================================
// MAIN SIDEBAR COMPONENT
// =============================================
export function Sidebar({ className, mobileOpen = false, onMobileClose }: SidebarProps) {
  const { sidebarCollapsed, setSidebarCollapsed, activeSection, setActiveSection } = useUIStore();
  const { isMenuItemVisible, isLoading } = useFeatureFlags();
  const { canAccessMenu, permissions, isAdmin } = usePermissions();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<string[]>(['dashboard', 'pms', 'bookings']);
  
  const translatedNavigation = useTranslatedNavigation();

  // Escape key handler for mobile
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileOpen) {
        onMobileClose?.();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [mobileOpen, onMobileClose]);

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K / Cmd+K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('[data-sidebar-search] input') as HTMLInputElement;
        searchInput?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleSection = (title: string) => {
    setExpandedSections((prev) =>
      prev.includes(title)
        ? prev.filter((s) => s !== title)
        : [...prev, title]
    );
  };

  const handleNavClick = (href: string) => {
    setActiveSection(href.replace('#', ''));
    onMobileClose?.();
  };

  const filteredNavigation = useMemo(() => {
    const baseNavigation = translatedNavigation.map(section => ({
      ...section,
      items: section.items.filter(item => {
        const menuItemId = item.href.replace('#', '');
        return canAccessMenu(menuItemId) && isMenuItemVisible(menuItemId);
      })
    })).filter(section => section.items.length > 0);
    
    if (!searchQuery.trim()) return baseNavigation;
    
    const query = searchQuery.toLowerCase();
    return baseNavigation
      .map(section => ({
        ...section,
        items: section.items.filter(item => 
          item.title.toLowerCase().includes(query) ||
          section.title.toLowerCase().includes(query)
        )
      }))
      .filter(section => section.items.length > 0);
  }, [searchQuery, isMenuItemVisible, canAccessMenu, translatedNavigation]);

  // Loading state
  if (isLoading) {
    return (
      <>
        <style>{scrollbarStyles}</style>
        <aside className={cn(
          "hidden lg:flex fixed left-0 top-0 z-40 h-screen flex-col",
          "backdrop-blur-xl bg-sidebar border-r border-sidebar-border/[0.10]",
          "shadow-[0_0_60px_-15px_rgba(0,0,0,0.15)]",
          className
        )}
        style={{ width: `${SIDEBAR_EXPANDED_WIDTH}px` }}
        >
          <div className="h-16 flex items-center justify-center">
            <div className="animate-pulse text-sidebar-foreground text-sm">Loading...</div>
          </div>
        </aside>
      </>
    );
  }

  // Sidebar base classes - ultra-modern glassmorphism with FULL brightness
  const sidebarBaseClasses = cn(
    "backdrop-blur-xl bg-sidebar text-sidebar-foreground flex-col",
    "shadow-[0_0_60px_-15px_rgba(0,0,0,0.15)]",
    "border-r border-sidebar-border/[0.10]"
  );

  return (
    <>
      <style>{scrollbarStyles}</style>
      <style>{keyframeStyles}</style>

      {/* Mobile Backdrop - with blur overlay */}
      <div 
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-md transition-all duration-300 lg:hidden",
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onMobileClose}
        aria-hidden="true"
      />
      
      {/* Mobile Sidebar Panel - slide-in with spring animation */}
      <aside className={cn(
        "fixed left-0 top-0 z-50 h-screen flex transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] lg:hidden",
        sidebarBaseClasses,
        mobileOpen ? "translate-x-0 opacity-100" : "-translate-x-full opacity-0",
        className
      )}
      style={{ width: `${SIDEBAR_EXPANDED_WIDTH + 20}px` }}
      role="navigation"
      aria-label="Main navigation"
      >
        {/* Top gradient accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sidebar-primary/40 to-transparent" />
        
        <Logo showClose onClose={onMobileClose} />
        <div data-sidebar-search>
          <SearchInput searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
        </div>
        <NavigationContent 
          filteredNavigation={filteredNavigation}
          expandedSections={expandedSections}
          toggleSection={toggleSection}
          activeSection={activeSection}
          handleNavClick={handleNavClick}
          isMenuItemVisible={isMenuItemVisible}
          canAccessMenu={canAccessMenu}
        />
        <QuickStats />
        <TenantSwitcher />
        <UserProfile />
      </aside>

      {/* Desktop Collapsed Sidebar */}
      {sidebarCollapsed ? (
        <TooltipProvider delayDuration={0}>
          <aside className={cn(
            "hidden lg:flex fixed left-0 top-0 z-40 h-screen flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
            sidebarBaseClasses,
            className
          )}
          style={{ width: `${SIDEBAR_COLLAPSED_WIDTH}px` }}
          role="navigation"
          aria-label="Main navigation"
          >
            {/* Top gradient accent line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sidebar-primary/40 to-transparent" />
            
            <Logo collapsed />
            
            <CollapsedNavigation
              activeSection={activeSection}
              setActiveSection={setActiveSection}
              setExpandedSections={setExpandedSections}
              isMenuItemVisible={isMenuItemVisible}
              canAccessMenu={canAccessMenu}
              navigation={translatedNavigation}
            />

            <QuickStats collapsed />
            <TenantSwitcher collapsed />
            <UserProfile collapsed />

            {/* Collapse toggle */}
            <div className="p-2 border-t border-sidebar-border/[0.10] flex-shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSidebarCollapsed(false)}
                    className="w-10 h-10 mx-auto text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/30 rounded-xl transition-all duration-200 focus-visible:ring-2 focus-visible:ring-sidebar-primary/30"
                    aria-label="Expand sidebar"
                  >
                    <PanelLeft className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="text-xs font-medium">
                  Expand sidebar
                </TooltipContent>
              </Tooltip>
            </div>
          </aside>
        </TooltipProvider>
      ) : (
        /* Desktop Expanded Sidebar */
        <aside className={cn(
          "hidden lg:flex fixed left-0 top-0 z-40 h-screen flex-col transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
          sidebarBaseClasses,
          className
        )}
        style={{ width: `${SIDEBAR_EXPANDED_WIDTH}px` }}
        role="navigation"
        aria-label="Main navigation"
        >
          {/* Top gradient accent line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sidebar-primary/40 to-transparent" />
          
          {/* Bottom gradient accent line under logo */}
          <div className="relative flex-shrink-0">
            <Logo />
            <div className="mx-4 h-px bg-gradient-to-r from-transparent via-sidebar-border/30 to-transparent" />
          </div>

          {/* Header: Logo + Collapse button */}
          <div className="absolute top-3 right-2 z-10">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarCollapsed(true)}
              className="h-7 w-7 text-sidebar-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/30 rounded-lg transition-all duration-200 focus-visible:ring-2 focus-visible:ring-sidebar-primary/30"
              aria-label="Collapse sidebar"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div data-sidebar-search>
            <SearchInput searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
          </div>
          <NavigationContent 
            filteredNavigation={filteredNavigation}
            expandedSections={expandedSections}
            toggleSection={toggleSection}
            activeSection={activeSection}
            handleNavClick={handleNavClick}
            isMenuItemVisible={isMenuItemVisible}
            canAccessMenu={canAccessMenu}
          />
          <QuickStats />
          <TenantSwitcher />
          <UserProfile />
        </aside>
      )}
    </>
  );
}
