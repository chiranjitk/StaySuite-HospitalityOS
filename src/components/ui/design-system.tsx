'use client';

import React, { forwardRef } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LucideIcon } from 'lucide-react';

/* ============================================
   GRADIENT CARD COMPONENT
   Card with gradient top border
   ============================================ */
interface GradientCardProps extends React.ComponentPropsWithoutRef<typeof Card> {
  variant?: 'default' | 'primary' | 'emerald' | 'blue' | 'amber' | 'violet';
  hover?: boolean;
}

export const GradientCard = forwardRef<HTMLDivElement, GradientCardProps>(
  ({ className, variant = 'default', hover = true, children, ...props }, ref) => {
    return (
      <Card
        ref={ref}
        className={cn(
          'relative overflow-hidden transition-all duration-300',
          hover && 'hover:shadow-lg hover:-translate-y-0.5',
          className
        )}
        {...props}
      >
        {/* Gradient top border */}
        <div
          className={cn(
            'absolute top-0 left-0 right-0 h-[3px]',
            variant === 'default' && 'bg-gradient-to-r from-violet-500 to-purple-600 dark:from-amber-400 dark:to-amber-600',
            variant === 'primary' && 'bg-gradient-to-r from-violet-500 to-indigo-600 dark:from-amber-400 dark:to-amber-600',
            variant === 'emerald' && 'bg-gradient-to-r from-emerald-400 to-teal-500',
            variant === 'blue' && 'bg-gradient-to-r from-blue-400 to-indigo-500',
            variant === 'amber' && 'bg-gradient-to-r from-amber-400 to-orange-500',
            variant === 'violet' && 'bg-gradient-to-r from-violet-400 to-purple-500'
          )}
        />
        {children}
      </Card>
    );
  }
);
GradientCard.displayName = 'GradientCard';

/* ============================================
   GRADIENT BUTTON COMPONENT
   Button with gradient background
   ============================================ */
interface GradientButtonProps extends React.ComponentProps<'button'> {
  variant?: 'primary' | 'emerald' | 'amber' | 'danger';
}

export const GradientButton = forwardRef<HTMLButtonElement, GradientButtonProps>(
  ({ className, variant = 'primary', children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        className={cn(
          'font-semibold shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5',
          variant === 'primary' && 'bg-gradient-to-r from-violet-500 to-indigo-600 text-white hover:from-violet-600 hover:to-indigo-700 dark:from-amber-400 dark:to-amber-600 dark:text-gray-900 dark:hover:from-amber-500 dark:hover:to-amber-700',
          variant === 'emerald' && 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700',
          variant === 'amber' && 'bg-gradient-to-r from-amber-400 to-orange-500 text-white hover:from-amber-500 hover:to-orange-600',
          variant === 'danger' && 'bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-600 hover:to-rose-700',
          className
        )}
        {...props}
      >
        {children}
      </Button>
    );
  }
);
GradientButton.displayName = 'GradientButton';

/* ============================================
   GRADIENT ICON COMPONENT
   Icon with gradient background
   ============================================ */
interface GradientIconProps {
  icon: LucideIcon;
  variant?: 'primary' | 'emerald' | 'blue' | 'amber' | 'violet' | 'rose';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function GradientIcon({ icon: Icon, variant = 'primary', size = 'md', className }: GradientIconProps) {
  const sizeClasses = {
    sm: 'h-8 w-8 [&>svg]:h-4 [&>svg]:w-4',
    md: 'h-10 w-10 [&>svg]:h-5 [&>svg]:w-5',
    lg: 'h-12 w-12 [&>svg]:h-6 [&>svg]:w-6',
  };

  const variantClasses = {
    primary: 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white dark:from-amber-400 dark:to-amber-600 dark:text-gray-900',
    emerald: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white',
    blue: 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white',
    amber: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white',
    violet: 'bg-gradient-to-br from-violet-500 to-purple-600 text-white',
    rose: 'bg-gradient-to-br from-rose-500 to-pink-600 text-white',
  };

  return (
    <div className={cn('rounded-xl flex items-center justify-center shadow-lg', sizeClasses[size], variantClasses[variant], className)}>
      <Icon />
    </div>
  );
}

/* ============================================
   STAT CARD COMPONENT
   KPI stat card with gradient styling
   ============================================ */
interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconVariant?: 'primary' | 'emerald' | 'blue' | 'amber' | 'violet' | 'rose';
  change?: {
    value: string;
    positive?: boolean;
  };
  description?: string;
  className?: string;
}

export function StatCard({ title, value, icon, iconVariant = 'primary', change, description, className }: StatCardProps) {
  return (
    <GradientCard className={cn('p-4', className)}>
      <div className="flex items-start justify-between">
        <GradientIcon icon={icon} variant={iconVariant} size="md" />
        {change && (
          <span
            className={cn(
              'text-xs font-semibold px-2 py-1 rounded-full',
              change.positive
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            )}
          >
            {change.value}
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-2xl font-bold text-gradient">{value}</p>
        <p className="text-sm text-muted-foreground mt-1">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </div>
    </GradientCard>
  );
}

/* ============================================
   PAGE HEADER COMPONENT
   Consistent page header with gradient styling
   ============================================ */
interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon: Icon, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4', className)}>
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 dark:from-amber-400 dark:to-amber-600 flex items-center justify-center shadow-lg">
            <Icon className="h-5 w-5 text-white dark:text-gray-900" />
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold">
            <span className="bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-amber-400 dark:to-amber-600 bg-clip-text text-transparent">
              {title}
            </span>
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-3">{actions}</div>
      )}
    </div>
  );
}

/* ============================================
   STATS GRID COMPONENT
   Responsive grid for stat cards
   ============================================ */
interface StatsGridProps {
  children: React.ReactNode;
  className?: string;
}

export function StatsGrid({ children, className }: StatsGridProps) {
  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-4 gap-4', className)}>
      {children}
    </div>
  );
}

/* ============================================
   GRADIENT DIVIDER COMPONENT
   Horizontal gradient line
   ============================================ */
export function GradientDivider({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'h-[1px] bg-gradient-to-r from-transparent via-violet-500 to-transparent dark:via-amber-400',
        className
      )}
    />
  );
}

/* ============================================
   GRADIENT BADGE COMPONENT
   Badge with gradient background
   ============================================ */
interface GradientBadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  className?: string;
}

export function GradientBadge({ children, variant = 'primary', className }: GradientBadgeProps) {
  const variantClasses = {
    primary: 'bg-gradient-to-r from-violet-500 to-indigo-600 text-white dark:from-amber-400 dark:to-amber-600 dark:text-gray-900',
    success: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white',
    warning: 'bg-gradient-to-r from-amber-400 to-orange-500 text-white',
    danger: 'bg-gradient-to-r from-red-500 to-rose-600 text-white',
    info: 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
        variantClasses[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ============================================
   EMPTY STATE COMPONENT
   Consistent empty state display
   ============================================ */
interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-gray-800 dark:to-gray-900 flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-violet-500 dark:text-amber-400" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ============================================
   GRADIENT PROGRESS BAR
   ============================================ */
interface GradientProgressProps {
  value: number;
  max?: number;
  className?: string;
  variant?: 'primary' | 'emerald' | 'amber';
}

export function GradientProgress({ value, max = 100, className, variant = 'primary' }: GradientProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const variantClasses = {
    primary: 'from-violet-500 to-indigo-600 dark:from-amber-400 dark:to-amber-600',
    emerald: 'from-emerald-500 to-teal-600',
    amber: 'from-amber-400 to-orange-500',
  };

  return (
    <div className={cn('h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden', className)}>
      <div
        className={cn('h-full bg-gradient-to-r rounded-full transition-all duration-500', variantClasses[variant])}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

/* ============================================
   GLOW EFFECT COMPONENT
   ============================================ */
interface GlowEffectProps {
  children: React.ReactNode;
  className?: string;
}

export function GlowEffect({ children, className }: GlowEffectProps) {
  return (
    <div className={cn('relative group', className)}>
      <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500 to-indigo-600 dark:from-amber-400 dark:to-amber-600 rounded-xl blur opacity-0 group-hover:opacity-30 transition duration-300" />
      <div className="relative">{children}</div>
    </div>
  );
}
