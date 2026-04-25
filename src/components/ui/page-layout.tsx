'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LucideIcon, Loader2 } from 'lucide-react';

// ============================================
// PAGE CONTAINER
// ============================================

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn('page-container', className)}>
      {children}
    </div>
  );
}

// ============================================
// PAGE HEADER
// ============================================

interface PageHeaderProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ icon: Icon, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('page-header', className)}>
      <div className="page-header-content">
        <h2 className="page-title">
          {Icon && <Icon className="page-title-icon" />}
          {title}
        </h2>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

// ============================================
// STATS GRID
// ============================================

interface StatItem {
  icon?: LucideIcon;
  value: string | number;
  label: string;
  iconColor?: 'teal' | 'emerald' | 'blue' | 'amber' | 'purple' | 'rose';
}

interface StatsGridProps {
  stats: StatItem[];
  className?: string;
}

export function StatsGrid({ stats, className }: StatsGridProps) {
  return (
    <div className={cn('stats-grid', className)}>
      {stats.map((stat, index) => (
        <StatCard key={index} {...stat} />
      ))}
    </div>
  );
}

function StatCard({ icon: Icon, value, label, iconColor = 'teal' }: StatItem) {
  return (
    <Card className="stat-card">
      <CardContent className="p-3">
        <div className="stat-card-inner">
          {Icon && (
            <div className={cn('stat-icon', `stat-icon-${iconColor}`)}>
              <Icon className="h-4 w-4" />
            </div>
          )}
          <div>
            <p className="stat-value">{value}</p>
            <p className="stat-label">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// FILTER BAR
// ============================================

interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <Card className={cn('filter-bar', className)}>
      <CardContent className="p-3">
        <div className="filter-bar-inner">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

interface FilterSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function FilterSearch({ value, onChange, placeholder = 'Search...', className }: FilterSearchProps) {
  return (
    <div className={cn('filter-search', className)}>
      <svg 
        className="filter-search-icon" 
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
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.3-4.3"></path>
      </svg>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="filter-search-input"
      />
    </div>
  );
}

interface FilterActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function FilterActions({ children, className }: FilterActionsProps) {
  return <div className={cn('filter-actions', className)}>{children}</div>;
}

// ============================================
// DATA CARD
// ============================================

interface DataCardProps {
  children: React.ReactNode;
  className?: string;
  headerContent?: React.ReactNode;
  headerColor?: string;
}

export function DataCard({ children, className, headerContent, headerColor }: DataCardProps) {
  return (
    <Card className={cn('data-card card-hover', className)}>
      {headerContent && (
        <div 
          className="data-card-header" 
          style={headerColor ? { backgroundColor: headerColor } : undefined}
        >
          {headerContent}
        </div>
      )}
      <CardContent className="data-card-body">
        {children}
      </CardContent>
    </Card>
  );
}

// ============================================
// DATA TABLE WRAPPER
// ============================================

interface DataTableWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export function DataTableWrapper({ children, className }: DataTableWrapperProps) {
  return (
    <Card className={cn('data-table-wrapper', className)}>
      <CardContent className="p-0">
        {children}
      </CardContent>
    </Card>
  );
}

// ============================================
// EMPTY STATE
// ============================================

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <Card className={cn('data-card', className)}>
      <CardContent className="p-6">
        <div className="empty-state">
          {Icon && <Icon className="empty-state-icon" />}
          <p className="empty-state-title">{title}</p>
          {description && <p className="empty-state-description">{description}</p>}
          {action && (
            <Button className="mt-4" onClick={action.onClick}>
              {action.icon && <action.icon className="h-4 w-4 mr-2" />}
              {action.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================
// LOADING STATE
// ============================================

interface LoadingStateProps {
  className?: string;
}

export function LoadingState({ className }: LoadingStateProps) {
  return (
    <div className={cn('loading-state', className)}>
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

// ============================================
// QUICK STATS (For cards)
// ============================================

interface QuickStatProps {
  value: string | number;
  label: string;
  valueColor?: 'primary' | 'success';
  className?: string;
}

export function QuickStat({ value, label, valueColor = 'primary', className }: QuickStatProps) {
  return (
    <div className={cn('quick-stat', className)}>
      <p className={cn('quick-stat-value', `quick-stat-value-${valueColor}`)}>{value}</p>
      <p className="quick-stat-label">{label}</p>
    </div>
  );
}

// ============================================
// INFO LINE
// ============================================

interface InfoLineProps {
  children: React.ReactNode;
  className?: string;
}

export function InfoLine({ children, className }: InfoLineProps) {
  return (
    <div className={cn('info-line', className)}>
      {children}
    </div>
  );
}

interface InfoLineItemProps {
  icon?: LucideIcon;
  children: React.ReactNode;
}

export function InfoLineItem({ icon: Icon, children }: InfoLineItemProps) {
  return (
    <div className="info-line-item">
      {Icon && <Icon className="h-3 w-3" />}
      {children}
    </div>
  );
}

// ============================================
// SECTION DIVIDER
// ============================================

interface SectionDividerProps {
  className?: string;
}

export function SectionDivider({ className }: SectionDividerProps) {
  return <div className={cn('section-divider', className)} />;
}

// ============================================
// BADGE HELPERS
// ============================================

interface StatusBadgeProps {
  status: string;
  options: { value: string; label: string; color?: string }[];
  className?: string;
}

export function StatusBadge({ status, options, className }: StatusBadgeProps) {
  const option = options.find(o => o.value === status);
  return (
    <span className={cn('badge', option?.color ? `bg-${option.color}` : 'badge-neutral', className)}>
      {option?.label || status}
    </span>
  );
}
