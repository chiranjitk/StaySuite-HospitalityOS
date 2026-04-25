'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import type { LucideIcon } from 'lucide-react';
import { motion } from 'framer-motion';

/* ==========================================================================
   STATUS COLOR MAP — Canonical mapping of hospitality status strings
   ========================================================================== */

export type EnterpriseBadgeVariant =
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral';

export const StatusColorMap: Record<string, EnterpriseBadgeVariant> = {
  // Booking statuses
  confirmed: 'success',
  checked_in: 'success',
  checked_out: 'neutral',
  in_house: 'success',
  pending: 'warning',
  tentative: 'warning',
  cancelled: 'danger',
  no_show: 'danger',
  waitlisted: 'info',

  // Room statuses
  available: 'success',
  occupied: 'info',
  maintenance: 'warning',
  out_of_service: 'danger',
  cleaning: 'warning',
  inspected: 'success',
  dirty: 'danger',

  // Payment statuses
  paid: 'success',
  unpaid: 'warning',
  partially_paid: 'warning',
  refunded: 'info',
  overdue: 'danger',
  failed: 'danger',

  // Guest statuses
  vip: 'warning',
  returning: 'info',
  new_guest: 'neutral',
  blacklisted: 'danger',

  // Task statuses
  open: 'warning',
  in_progress: 'info',
  completed: 'success',
  assigned: 'info',
  overdue_task: 'danger',

  // General
  active: 'success',
  inactive: 'neutral',
  archived: 'neutral',
  deleted: 'danger',
  draft: 'warning',
  published: 'success',
  processing: 'info',
  error: 'danger',
};

/* ==========================================================================
   1. ENTERPRISE CARD
   ========================================================================== */

interface EnterpriseCardProps extends React.ComponentPropsWithoutRef<typeof Card> {
  /** Render a gradient accent bar at the top of the card */
  accent?: boolean;
  /** Enable subtle hover elevation */
  hover?: boolean;
}

export const EnterpriseCard = React.forwardRef<
  HTMLDivElement,
  EnterpriseCardProps
>(({ className, accent = false, hover = false, children, ...props }, ref) => {
  return (
    <Card
      ref={ref}
      className={cn(
        'enterprise-card',
        accent && 'enterprise-card--accent-top',
        hover && 'hover:shadow-md hover:border-border/80',
        className
      )}
      {...props}
    >
      {children}
    </Card>
  );
});
EnterpriseCard.displayName = 'EnterpriseCard';

/* ==========================================================================
   2. ENTERPRISE STAT CARD
   ========================================================================== */

interface TrendIndicator {
  /** Direction of the trend */
  direction: 'up' | 'down' | 'flat';
  /** Display value, e.g. "+12.5%" */
  value: string;
}

interface EnterpriseStatCardProps {
  /** KPI icon component */
  icon: LucideIcon;
  /** Primary metric value */
  value: string | number;
  /** Metric label */
  label: string;
  /** Trend indicator pill */
  trend?: TrendIndicator;
  /** Optional sparkline data rendered as a tiny area chart */
  sparkline?: number[];
  /** Color accent for the icon container */
  iconColor?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

export function EnterpriseStatCard({
  icon: Icon,
  value,
  label,
  trend,
  sparkline,
  iconColor = 'primary',
  className,
}: EnterpriseStatCardProps) {
  const iconColorMap: Record<string, string> = {
    primary: 'stat-icon-primary',
    success: 'stat-icon-emerald',
    warning: 'stat-icon-amber',
    danger: 'stat-icon-rose',
    info: 'stat-icon-blue',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <div className={cn('enterprise-stat p-4', className)}>
        <div className="flex items-start justify-between gap-3">
          {/* Icon */}
          <div className={cn('stat-icon', iconColorMap[iconColor])}>
            <Icon className="h-4 w-4" />
          </div>

          {/* Trend indicator */}
          {trend && (
            <span
              className={cn(
                'text-xs font-semibold px-2 py-0.5 rounded-full',
                trend.direction === 'up' &&
                  'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
                trend.direction === 'down' &&
                  'bg-red-500/10 text-red-600 dark:bg-red-500/15 dark:text-red-400',
                trend.direction === 'flat' &&
                  'bg-muted text-muted-foreground'
              )}
            >
              {trend.value}
            </span>
          )}
        </div>

        {/* Value & label */}
        <div className="mt-3">
          <p className="enterprise-kpi text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5 font-medium uppercase tracking-wide">
            {label}
          </p>
        </div>

        {/* Sparkline */}
        {sparkline && sparkline.length > 1 && (
          <div className="mt-3 h-8 flex items-end gap-px">
            {sparkline.map((point, i) => {
              const max = Math.max(...sparkline);
              const min = Math.min(...sparkline);
              const range = max - min || 1;
              const height = Math.max(4, ((point - min) / range) * 100);
              return (
                <div
                  key={i}
                  className="flex-1 rounded-sm bg-primary/20 dark:bg-primary/30 first:rounded-l-md last:rounded-r-md"
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ==========================================================================
   3. ENTERPRISE METRIC
   ========================================================================== */

interface EnterpriseMetricProps {
  /** Large display value */
  value: string | number;
  /** Label beneath the value */
  label: string;
  /** Optional trend indicator */
  trend?: TrendIndicator;
  /** Optional description text */
  description?: string;
  className?: string;
}

export function EnterpriseMetric({
  value,
  label,
  trend,
  description,
  className,
}: EnterpriseMetricProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn('flex flex-col gap-1.5', className)}
    >
      <div className="flex items-baseline gap-2">
        <span className="enterprise-metric text-foreground">{value}</span>
        {trend && (
          <span
            className={cn(
              'text-sm font-semibold',
              trend.direction === 'up' && 'text-emerald-600 dark:text-emerald-400',
              trend.direction === 'down' && 'text-red-600 dark:text-red-400',
              trend.direction === 'flat' && 'text-muted-foreground'
            )}
          >
            {trend.value}
          </span>
        )}
      </div>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {description && (
        <span className="text-xs text-muted-foreground/80">{description}</span>
      )}
    </motion.div>
  );
}

/* ==========================================================================
   4. ENTERPRISE BADGE
   ========================================================================== */

interface EnterpriseBadgeProps {
  /** Visual variant */
  variant?: EnterpriseBadgeVariant;
  /** Optional leading dot indicator */
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function EnterpriseBadge({
  variant = 'neutral',
  dot = false,
  children,
  className,
}: EnterpriseBadgeProps) {
  const variantClass: Record<EnterpriseBadgeVariant, string> = {
    success: 'enterprise-badge-success',
    warning: 'enterprise-badge-warning',
    danger: 'enterprise-badge-danger',
    info: 'enterprise-badge-info',
    neutral: 'enterprise-badge-neutral',
  };

  const dotColor: Record<EnterpriseBadgeVariant, string> = {
    success: 'bg-emerald-500 dark:bg-emerald-400',
    warning: 'bg-amber-500 dark:bg-amber-400',
    danger: 'bg-red-500 dark:bg-red-400',
    info: 'bg-sky-500 dark:bg-sky-400',
    neutral: 'bg-muted-foreground',
  };

  return (
    <span className={cn('enterprise-badge', variantClass[variant], className)}>
      {dot && (
        <span
          className={cn('inline-block h-1.5 w-1.5 rounded-full', dotColor[variant])}
        />
      )}
      {children}
    </span>
  );
}

/* ==========================================================================
   5. ENTERPRISE STATUS BADGE
   ========================================================================== */

interface EnterpriseStatusBadgeProps {
  /** Raw status string — looked up in StatusColorMap */
  status: string;
  /** Override the automatically resolved display text */
  label?: string;
  /** Show a leading dot */
  dot?: boolean;
  className?: string;
}

export function EnterpriseStatusBadge({
  status,
  label,
  dot = true,
  className,
}: EnterpriseStatusBadgeProps) {
  const variant = StatusColorMap[status.toLowerCase()] ?? 'neutral';
  const displayText = label ?? status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <EnterpriseBadge variant={variant} dot={dot} className={className}>
      {displayText}
    </EnterpriseBadge>
  );
}

/* ==========================================================================
   6. ENTERPRISE TABLE WRAPPER
   ========================================================================== */

interface EnterpriseTableWrapperProps {
  /** Optional header row with title and actions */
  header?: {
    title: string;
    description?: string;
    actions?: React.ReactNode;
  };
  /** Optional filter controls rendered above the table */
  filters?: React.ReactNode;
  /** Table content (usually a <Table> component) */
  children: React.ReactNode;
  /** Maximum height for the scrollable body */
  maxHeight?: string;
  className?: string;
}

export function EnterpriseTableWrapper({
  header,
  filters,
  children,
  maxHeight,
  className,
}: EnterpriseTableWrapperProps) {
  return (
    <div className={cn('enterprise-table-wrapper flex flex-col', className)}>
      {/* Header */}
      {header && (
        <div className="flex flex-col gap-1 px-4 pt-4 pb-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {header.title}
            </h3>
            {header.description && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {header.description}
              </p>
            )}
          </div>
          {header.actions && (
            <div className="flex items-center gap-2 mt-2 sm:mt-0">
              {header.actions}
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      {filters && (
        <div className="px-4 pb-2">{filters}</div>
      )}

      {/* Scrollable body */}
      <div
        className={cn(
          'enterprise-scroll',
          maxHeight ? 'overflow-y-auto' : 'overflow-x-auto'
        )}
        style={maxHeight ? { maxHeight } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

/* ==========================================================================
   7. ENTERPRISE SECTION HEADER
   ========================================================================== */

interface EnterpriseSectionHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function EnterpriseSectionHeader({
  title,
  description,
  actions,
  className,
}: EnterpriseSectionHeaderProps) {
  return (
    <div className={cn('enterprise-section-header', className)}>
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-foreground tracking-tight">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
      )}
    </div>
  );
}

/* ==========================================================================
   8. ENTERPRISE PAGE HEADER
   ========================================================================== */

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface EnterprisePageHeaderProps {
  /** Optional page icon */
  icon?: LucideIcon;
  /** Page title */
  title: string;
  /** Optional description below the title */
  description?: string;
  /** Optional breadcrumb trail */
  breadcrumbs?: BreadcrumbItem[];
  /** Action buttons rendered on the right side */
  actions?: React.ReactNode;
  className?: string;
}

export function EnterprisePageHeader({
  icon: Icon,
  title,
  description,
  breadcrumbs,
  actions,
  className,
}: EnterprisePageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn('flex flex-col gap-3', className)}
    >
      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <React.Fragment key={i}>
                  <BreadcrumbItem>
                    {isLast || !crumb.href ? (
                      <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink href={crumb.href}>
                        {crumb.label}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast && <BreadcrumbSeparator />}
                </React.Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      )}

      {/* Title row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl icon-gradient flex-shrink-0">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground tracking-tight sm:text-2xl">
              {title}
            </h1>
            {description && (
              <p className="text-sm text-muted-foreground mt-0.5">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {actions}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ==========================================================================
   9. ENTERPRISE FILTER BAR
   ========================================================================== */

interface EnterpriseFilterBarProps {
  /** Search input element (controlled externally) */
  search?: React.ReactNode;
  /** Additional filter controls */
  children?: React.ReactNode;
  className?: string;
}

export function EnterpriseFilterBar({
  search,
  children,
  className,
}: EnterpriseFilterBarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center',
        className
      )}
    >
      {search && <div className="flex-1 min-w-0">{search}</div>}
      {children && (
        <div className="flex items-center gap-2 flex-shrink-0">{children}</div>
      )}
    </div>
  );
}

/* ==========================================================================
   10. ENTERPRISE EMPTY STATE
   ========================================================================== */

interface EnterpriseEmptyStateProps {
  /** Icon to display */
  icon: LucideIcon;
  /** Primary heading */
  title: string;
  /** Secondary description */
  description?: string;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
}

export function EnterpriseEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EnterpriseEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/60 mb-4">
        <Icon className="h-7 w-7 text-muted-foreground/60" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1.5 max-w-sm leading-relaxed">
          {description}
        </p>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          size="sm"
          className="mt-5 rounded-lg"
        >
          {action.icon && <action.icon className="h-4 w-4 mr-1.5" />}
          {action.label}
        </Button>
      )}
    </motion.div>
  );
}

/* ==========================================================================
   11. ENTERPRISE LOADING STATE
   ========================================================================== */

interface EnterpriseLoadingStateProps {
  /** Number of skeleton rows to render */
  rows?: number;
  /** Include a header skeleton */
  header?: boolean;
  className?: string;
}

export function EnterpriseLoadingState({
  rows = 5,
  header = true,
  className,
}: EnterpriseLoadingStateProps) {
  return (
    <div className={cn('space-y-3 p-4', className)}>
      {header && (
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      )}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-4 w-4 flex-shrink-0" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/* ==========================================================================
   12. ENTERPRISE ERROR STATE
   ========================================================================== */

interface EnterpriseErrorStateProps {
  /** Error message to display */
  message?: string;
  /** Detailed error info */
  detail?: string;
  /** Retry callback */
  onRetry?: () => void;
  className?: string;
}

export function EnterpriseErrorState({
  message = 'Something went wrong',
  detail,
  onRetry,
  className,
}: EnterpriseErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 mb-4">
        <svg
          className="h-7 w-7 text-red-500 dark:text-red-400"
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
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h3 className="text-base font-semibold text-foreground">{message}</h3>
      {detail && (
        <p className="text-sm text-muted-foreground mt-1.5 max-w-sm">{detail}</p>
      )}
      {onRetry && (
        <Button
          onClick={onRetry}
          variant="outline"
          size="sm"
          className="mt-5 rounded-lg"
        >
          Try again
        </Button>
      )}
    </motion.div>
  );
}

/* ==========================================================================
   13. ENTERPRISE QUICK STAT
   ========================================================================== */

interface EnterpriseQuickStatProps {
  /** Numeric or string value */
  value: string | number;
  /** Label text */
  label: string;
  /** Color emphasis for the value */
  color?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
}

export function EnterpriseQuickStat({
  value,
  label,
  color = 'default',
  className,
}: EnterpriseQuickStatProps) {
  const valueColorMap: Record<string, string> = {
    default: 'text-foreground',
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger: 'text-red-600 dark:text-red-400',
  };

  return (
    <div className={cn('text-center', className)}>
      <p
        className={cn(
          'text-lg font-bold font-variant-numeric: tabular-nums',
          valueColorMap[color]
        )}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
        {label}
      </p>
    </div>
  );
}

/* ==========================================================================
   14. ENTERPRISE PROGRESS METRIC
   ========================================================================== */

interface EnterpriseProgressMetricProps {
  /** 0-100 percentage value */
  value: number;
  /** Label for the progress bar */
  label: string;
  /** Optional subtext showing raw values, e.g. "75 / 100" */
  detail?: string;
  /** Visual variant for the progress bar color */
  variant?: 'primary' | 'success' | 'warning' | 'danger';
  /** Size of the progress bar */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function EnterpriseProgressMetric({
  value,
  label,
  detail,
  variant = 'primary',
  size = 'md',
  className,
}: EnterpriseProgressMetricProps) {
  const clampedValue = Math.min(100, Math.max(0, value));

  const barColorMap: Record<string, string> = {
    primary: 'bg-primary',
    success: 'bg-emerald-500 dark:bg-emerald-400',
    warning: 'bg-amber-500 dark:bg-amber-400',
    danger: 'bg-red-500 dark:bg-red-400',
  };

  const sizeMap: Record<string, string> = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-foreground">
          {clampedValue}%
        </span>
      </div>
      <div
        className={cn(
          'w-full rounded-full bg-muted overflow-hidden',
          sizeMap[size]
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            barColorMap[variant]
          )}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      {detail && (
        <p className="text-xs text-muted-foreground">{detail}</p>
      )}
    </div>
  );
}

/* ==========================================================================
   15. ENTERPRISE INFO GRID
   ========================================================================== */

interface InfoGridItem {
  /** Property label */
  label: string;
  /** Property value */
  value: React.ReactNode;
  /** Span across multiple columns */
  span?: 1 | 2 | 3 | 4;
}

interface EnterpriseInfoGridProps {
  items: InfoGridItem[];
  /** Number of columns (responsive) */
  columns?: 2 | 3 | 4;
  className?: string;
}

export function EnterpriseInfoGrid({
  items,
  columns = 3,
  className,
}: EnterpriseInfoGridProps) {
  const columnsClass: Record<number, string> = {
    2: 'enterprise-grid-2',
    3: 'enterprise-grid-3',
    4: 'enterprise-grid-4',
  };

  return (
    <div className={cn(columnsClass[columns], className)}>
      {items.map((item, i) => {
        const spanClass =
          item.span && item.span > 1
            ? `sm:col-span-${item.span}`
            : undefined;
        return (
          <div
            key={i}
            className={cn(
              'rounded-lg border border-border bg-muted/30 px-3 py-2.5',
              spanClass
            )}
          >
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {item.label}
            </p>
            <p className="text-sm font-medium text-foreground mt-0.5 break-words">
              {item.value}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* ==========================================================================
   16. ENTERPRISE AVATAR GROUP
   ========================================================================== */

interface AvatarItem {
  /** Unique key */
  id: string;
  /** Avatar image URL */
  src?: string;
  /** Fallback text (initials) */
  fallback: string;
  /** Optional alt text */
  alt?: string;
}

interface EnterpriseAvatarGroupProps {
  /** List of avatar items */
  avatars: AvatarItem[];
  /** Maximum avatars to show before "+N" overflow */
  max?: number;
  /** Avatar size in Tailwind units, e.g. "h-8 w-8" */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function EnterpriseAvatarGroup({
  avatars,
  max = 5,
  size = 'md',
  className,
}: EnterpriseAvatarGroupProps) {
  const sizeMap: Record<string, string> = {
    sm: 'h-7 w-7',
    md: 'h-9 w-9',
    lg: 'h-11 w-11',
  };

  const textSizeMap: Record<string, string> = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  };

  const overflow = avatars.length - max;
  const visible = avatars.slice(0, max);

  return (
    <div className={cn('enterprise-avatar-group', className)}>
      {visible.map((avatar) => (
        <Avatar
          key={avatar.id}
          className={cn(
            'ring-2 ring-background border border-border',
            sizeMap[size]
          )}
        >
          {avatar.src && <AvatarImage src={avatar.src} alt={avatar.alt ?? ''} />}
          <AvatarFallback
            className={cn(
              'bg-muted text-muted-foreground font-medium',
              textSizeMap[size]
            )}
          >
            {avatar.fallback}
          </AvatarFallback>
        </Avatar>
      ))}
      {overflow > 0 && (
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-muted ring-2 ring-background border border-border text-muted-foreground font-semibold',
            sizeMap[size],
            textSizeMap[size]
          )}
        >
          +{overflow}
        </div>
      )}
    </div>
  );
}
