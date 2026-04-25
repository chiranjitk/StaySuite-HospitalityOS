'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { LucideIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ==========================================================================
   ANIMATION VARIANTS — Staggered children entrance
   ========================================================================== */

const sectionVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

const childVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: 'easeOut' },
  },
};

const labelVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.25, ease: 'easeOut' },
  },
};

/* ==========================================================================
   1. ENTERPRISE SECTION — Main section wrapper
   ========================================================================== */

interface EnterpriseSectionProps {
  /** Section title displayed in the header */
  title: string;
  /** Lucide icon rendered in the header */
  icon: LucideIcon;
  /** Optional description below the title */
  description?: string;
  /** Optional action buttons/controls in the header */
  actions?: React.ReactNode;
  /** Section content — typically widget cards */
  children: React.ReactNode;
  /** Visual variant controlling background & spacing */
  variant?: 'default' | 'highlighted' | 'compact';
  /** Additional CSS classes */
  className?: string;
}

export function EnterpriseSection({
  title,
  icon: Icon,
  description,
  actions,
  children,
  variant = 'default',
  className,
}: EnterpriseSectionProps) {
  return (
    <motion.section
      variants={sectionVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        'enterprise-section flex flex-col gap-[var(--space-xl)]',
        variant === 'compact' && 'gap-[var(--space-lg)]',
        className
      )}
    >
      {/* ── Header ── */}
      <div className="enterprise-section-header flex flex-col gap-[var(--space-xs)]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-muted/80 flex-shrink-0">
              <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <h2
              className={cn(
                'text-sm font-semibold text-foreground tracking-tight truncate',
                variant === 'compact' && 'text-xs'
              )}
            >
              {title}
            </h2>
          </div>
          {actions && (
            <div className="flex items-center gap-2 flex-shrink-0">
              {actions}
            </div>
          )}
        </div>

        {description && variant !== 'compact' && (
          <p className="text-xs text-muted-foreground leading-relaxed pl-[2.375rem]">
            {description}
          </p>
        )}

        {/* Divider line */}
        <div className="h-px bg-border w-full mt-1" />
      </div>

      {/* ── Content container ── */}
      <motion.div
        variants={childVariants}
        className={cn(
          variant === 'highlighted' &&
            'bg-muted/30 rounded-xl border border-border/60 p-4 sm:p-5',
          variant === 'compact' && 'gap-[var(--space-md)]'
        )}
      >
        {children}
      </motion.div>
    </motion.section>
  );
}

/* ==========================================================================
   2. ENTERPRISE SECTION LABEL — Reusable section label
   ========================================================================== */

interface EnterpriseSectionLabelProps {
  /** Lucide icon in a rounded container */
  icon: LucideIcon;
  /** Label text (rendered uppercase) */
  title: string;
  /** Optional badge with text and variant */
  badge?: {
    text: string;
    variant?: 'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'live';
  };
  /** Additional CSS classes */
  className?: string;
}

export function EnterpriseSectionLabel({
  icon: Icon,
  title,
  badge,
  className,
}: EnterpriseSectionLabelProps) {
  return (
    <motion.div
      variants={labelVariants}
      initial="hidden"
      animate="visible"
      className={cn(
        'flex items-center gap-2.5',
        className
      )}
    >
      {/* Icon pill */}
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 flex-shrink-0">
        <Icon className="h-3 w-3 text-primary" />
      </div>

      {/* Title */}
      <h3 className="enterprise-section-title text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground whitespace-nowrap">
        {title}
      </h3>

      {/* Divider extending from label */}
      <div className="flex-1 h-px bg-border min-w-[1rem]" />

      {/* Optional badge */}
      {badge && (
        <Badge
          variant={badge.variant ?? 'secondary'}
          className="text-[10px] px-1.5 py-0 h-5 font-semibold"
        >
          {badge.text}
        </Badge>
      )}
    </motion.div>
  );
}

/* ==========================================================================
   3. ENTERPRISE WIDGET CARD — Standard widget container
   ========================================================================== */

interface EnterpriseWidgetCardProps {
  /** Widget title */
  title: string;
  /** Optional icon in the header */
  icon?: LucideIcon;
  /** Optional description text */
  description?: string;
  /** Optional action element rendered in the header */
  action?: React.ReactNode;
  /** Widget content */
  children: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Show loading skeleton state */
  loading?: boolean;
  /** Message to show when content is empty */
  emptyMessage?: string;
}

function WidgetLoadingSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32 rounded" />
        <Skeleton className="h-4 w-16 rounded" />
      </div>
      <Skeleton className="h-3 w-48 rounded" />
      <div className="flex items-center gap-3 pt-2">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-24 rounded" />
          <Skeleton className="h-3 w-32 rounded" />
        </div>
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-20 rounded" />
          <Skeleton className="h-3 w-28 rounded" />
        </div>
      </div>
    </div>
  );
}

function WidgetEmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60 mb-3">
        <svg
          className="h-5 w-5 text-muted-foreground/50"
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18" />
          <path d="m9 16 2 2 4-4" />
        </svg>
      </div>
      <p className="text-sm text-muted-foreground font-medium">{message}</p>
    </div>
  );
}

export function EnterpriseWidgetCard({
  title,
  icon: Icon,
  description,
  action,
  children,
  className,
  loading = false,
  emptyMessage,
}: EnterpriseWidgetCardProps) {
  return (
    <motion.div variants={childVariants}>
      <Card
        className={cn(
          'enterprise-card group',
          'hover:shadow-[var(--shadow-md)] hover:border-border/80',
          'transition-all duration-200',
          className
        )}
      >
        {/* ── Header ── */}
        {(title || action) && (
          <CardHeader className="pb-0 gap-0 border-b border-border/40 pb-4 mb-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                {Icon && (
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/80 flex-shrink-0 mt-0.5">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-foreground leading-tight">
                    {title}
                  </h3>
                  {description && (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {description}
                    </p>
                  )}
                </div>
              </div>
              {action && (
                <div className="flex-shrink-0">{action}</div>
              )}
            </div>
          </CardHeader>
        )}

        {/* ── Body ── */}
        <CardContent
          className={cn(
            'pt-4',
            !title && !action && 'pt-6'
          )}
        >
          <AnimatePresence mode="wait">
            {loading ? (
              <WidgetLoadingSkeleton key="loading" />
            ) : emptyMessage && !children ? (
              <WidgetEmptyState key="empty" message={emptyMessage} />
            ) : (
              <motion.div
                key="content"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                {children}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ==========================================================================
   4. ENTERPRISE KPI BAR — Compact inline KPI strip
   ========================================================================== */

interface KPIItem {
  /** KPI display value */
  value: string | number;
  /** Label below the value */
  label: string;
  /** Optional icon */
  icon?: LucideIcon;
  /** Optional color accent: 'default' | 'success' | 'warning' | 'danger' | 'info' */
  color?: string;
}

interface EnterpriseKPIBarProps {
  /** Array of KPI items to display */
  items: KPIItem[];
  /** Additional CSS classes */
  className?: string;
}

const kpiColorMap: Record<string, { value: string; icon: string; dot: string }> = {
  default: {
    value: 'text-foreground',
    icon: 'bg-muted text-muted-foreground',
    dot: 'bg-border',
  },
  success: {
    value: 'text-emerald-600 dark:text-emerald-400',
    icon: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    dot: 'bg-emerald-500 dark:bg-emerald-400',
  },
  warning: {
    value: 'text-amber-600 dark:text-amber-400',
    icon: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
    dot: 'bg-amber-500 dark:bg-amber-400',
  },
  danger: {
    value: 'text-red-600 dark:text-red-400',
    icon: 'bg-red-500/15 text-red-600 dark:text-red-400',
    dot: 'bg-red-500 dark:bg-red-400',
  },
  info: {
    value: 'text-sky-600 dark:text-sky-400',
    icon: 'bg-sky-500/15 text-sky-600 dark:text-sky-400',
    dot: 'bg-sky-500 dark:bg-sky-400',
  },
};

export function EnterpriseKPIBar({ items, className }: EnterpriseKPIBarProps) {
  if (!items || items.length === 0) return null;

  return (
    <motion.div
      variants={childVariants}
      className={cn(
        'flex items-stretch gap-3 overflow-x-auto scrollbar-thin pb-1',
        className
      )}
    >
      {items.map((item, index) => {
        const colorKey = item.color ?? 'default';
        const colors = kpiColorMap[colorKey] ?? kpiColorMap.default;
        const ItemIcon = item.icon;

        return (
          <div
            key={`${item.label}-${index}`}
            className={cn(
              'flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg',
              'bg-card border border-border/60 flex-shrink-0',
              'min-w-[140px] sm:min-w-[160px]',
              'hover:border-border hover:shadow-[var(--shadow-xs)]',
              'transition-all duration-150'
            )}
          >
            {/* Optional icon */}
            {ItemIcon ? (
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-md flex-shrink-0',
                  colors.icon
                )}
              >
                <ItemIcon className="h-3.5 w-3.5" />
              </div>
            ) : (
              <div
                className={cn(
                  'h-1.5 w-1.5 rounded-full flex-shrink-0',
                  colors.dot
                )}
              />
            )}

            {/* Value + label */}
            <div className="flex flex-col min-w-0">
              <span
                className={cn(
                  'text-sm font-bold font-variant-numeric:tabular-nums leading-tight truncate',
                  colors.value
                )}
              >
                {item.value}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-[0.06em] mt-0.5 truncate">
                {item.label}
              </span>
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}

/* ==========================================================================
   5. ENTERPRISE TIMELINE ITEM — Timeline/feed item for activity feeds
   ========================================================================== */

type TimelineStatus = 'success' | 'warning' | 'danger' | 'info';

interface EnterpriseTimelineItemProps {
  /** Lucide icon for the event type */
  icon: LucideIcon;
  /** Event title */
  title: string;
  /** Event description */
  description: string;
  /** Timestamp display string */
  timestamp: string;
  /** Optional status indicator */
  status?: TimelineStatus;
  /** Optional click handler */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

const statusDotMap: Record<TimelineStatus, string> = {
  success: 'bg-emerald-500 dark:bg-emerald-400',
  warning: 'bg-amber-500 dark:bg-amber-400',
  danger: 'bg-red-500 dark:bg-red-400',
  info: 'bg-sky-500 dark:bg-sky-400',
};

const statusIconBgMap: Record<TimelineStatus, string> = {
  success: 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  danger: 'bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400',
  info: 'bg-sky-500/10 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
};

export function EnterpriseTimelineItem({
  icon: Icon,
  title,
  description,
  timestamp,
  status,
  onClick,
  className,
}: EnterpriseTimelineItemProps) {
  const Component = onClick ? 'button' : 'div';

  return (
    <motion.div
      variants={childVariants}
      className="w-full"
    >
      <Component
        onClick={onClick}
        className={cn(
          'flex items-start gap-3 w-full text-left px-3 py-3 rounded-lg',
          'hover:bg-muted/50 transition-colors duration-150',
          'group cursor-default',
          onClick && 'cursor-pointer',
          className
        )}
        type={onClick ? 'button' : undefined}
      >
        {/* Icon container with optional status tint */}
        <div className="relative flex-shrink-0 mt-0.5">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              'bg-muted/80 text-muted-foreground',
              status && statusIconBgMap[status]
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>

          {/* Status dot indicator — bottom-right of icon */}
          {status && (
            <span
              className={cn(
                'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full',
                'ring-2 ring-background dark:ring-card',
                statusDotMap[status]
              )}
            />
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-start justify-between gap-2">
            <h4
              className={cn(
                'text-sm font-medium text-foreground leading-snug truncate',
                onClick && 'group-hover:text-primary transition-colors'
              )}
            >
              {title}
            </h4>
            <time className="text-[10px] text-muted-foreground font-medium whitespace-nowrap flex-shrink-0 tabular-nums mt-0.5">
              {timestamp}
            </time>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {description}
          </p>
        </div>

        {/* Chevron for clickable items */}
        {onClick && (
          <div className="flex-shrink-0 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <svg
              className="h-3.5 w-3.5 text-muted-foreground/60"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
        )}
      </Component>
    </motion.div>
  );
}

/* ==========================================================================
   EXPORTS
   ========================================================================== */

export type { EnterpriseSectionProps, EnterpriseSectionLabelProps, EnterpriseWidgetCardProps, EnterpriseKPIBarProps, KPIItem, EnterpriseTimelineItemProps };
