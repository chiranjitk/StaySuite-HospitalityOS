'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  /** A Lucide or similar icon component */
  icon: React.ElementType;
  /** Primary heading text */
  title: string;
  /** Secondary description text */
  description?: string;
  /** Optional call-to-action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Additional class names for the wrapper */
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className
      )}
    >
      {/* Icon container */}
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 mb-5">
        <Icon className="h-8 w-8 text-muted-foreground/60" />
      </div>

      {/* Title */}
      <h3 className="text-lg font-semibold text-foreground mb-1.5">{title}</h3>

      {/* Description */}
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed mb-6">
          {description}
        </p>
      )}

      {/* Action CTA */}
      {action && (
        <Button
          onClick={action.onClick}
          className="rounded-xl shadow-sm transition-all duration-200 hover:shadow-md"
          size="sm"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
