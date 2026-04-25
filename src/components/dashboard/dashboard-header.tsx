'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download, Maximize2, Minimize2 } from 'lucide-react';
import { toast } from 'sonner';

interface DashboardHeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastUpdated?: Date;
}

export function DashboardHeader({ onRefresh, isRefreshing, lastUpdated }: DashboardHeaderProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleRefresh = useCallback(() => {
    if (onRefresh) {
      onRefresh();
      toast.success('Dashboard data refreshed');
    }
  }, [onRefresh]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  const timeAgo = lastUpdated
    ? Math.round((Date.now() - lastUpdated.getTime()) / 1000 / 60)
    : null;

  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        {timeAgo !== null && (
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">
            Updated {timeAgo === 0 ? 'just now' : `${timeAgo}m ago`}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-primary/10"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Refresh dashboard"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-muted-foreground ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-primary/10"
          onClick={toggleFullscreen}
          title="Toggle fullscreen"
        >
          {isFullscreen ? (
            <Minimize2 className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </Button>
      </div>
    </div>
  );
}
