'use client';

import React, { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useI18n } from '@/contexts/I18nContext';
import { useUIStyleStore } from '@/lib/themes/store';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtime, DashboardUpdateEvent } from '@/hooks/use-realtime';
import {
  DollarSign,
  Bed,
  Wifi,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  LucideIcon,
  AlertTriangle,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ─── Animated Counter Hook ──────────────────────────────────────────────────
function useAnimatedCounter(target: number, duration: number = 1200, enabled: boolean = true) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const prevTargetRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // When target changes, reset animation start time (display naturally goes from 0 via eased * target)
    if (prevTargetRef.current !== target) {
      prevTargetRef.current = target;
      startTimeRef.current = null;
    }

    const animate = (timestamp: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // ease-out cubic for a satisfying deceleration
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(target);
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [target, duration, enabled]);

  return display;
}

// ─── Sparkline data per variant ─────────────────────────────────────────────
const sparklineData: Record<string, number[]> = {
  emerald: [30, 45, 35, 55, 50, 65, 60, 75, 70, 85, 80, 90],
  violet:  [25, 40, 55, 45, 60, 50, 70, 65, 80, 75, 85, 95],
  cyan:    [60, 45, 70, 50, 65, 55, 40, 70, 60, 50, 75, 55],
  amber:   [35, 50, 40, 55, 65, 50, 70, 60, 80, 70, 85, 90],
};

// ─── Variant Config ─────────────────────────────────────────────────────────
type CardVariant = 'emerald' | 'violet' | 'cyan' | 'amber';

const variantConfig: Record<CardVariant, {
  iconGradient: string;
  topBarGradient: string;
  barColor: string;
  barHoverColor: string;
  glowColor: string;
  iconBg: string;
}> = {
  emerald: {
    iconGradient: 'bg-gradient-to-br from-emerald-400 to-teal-600',
    topBarGradient: 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600',
    barColor: 'bg-emerald-500 dark:bg-emerald-500',
    barHoverColor: 'bg-emerald-600 dark:bg-emerald-400',
    glowColor: 'group-hover:shadow-emerald-500/40',
    iconBg: 'from-emerald-500 to-teal-600',
  },
  violet: {
    iconGradient: 'bg-gradient-to-br from-violet-400 to-purple-600',
    topBarGradient: 'bg-gradient-to-r from-violet-500 via-purple-500 to-violet-600',
    barColor: 'bg-violet-500 dark:bg-violet-500',
    barHoverColor: 'bg-violet-600 dark:bg-violet-400',
    glowColor: 'group-hover:shadow-violet-500/40',
    iconBg: 'from-violet-500 to-purple-600',
  },
  cyan: {
    iconGradient: 'bg-gradient-to-br from-cyan-400 to-blue-500',
    topBarGradient: 'bg-gradient-to-r from-cyan-500 via-blue-500 to-cyan-600',
    barColor: 'bg-cyan-500 dark:bg-cyan-500',
    barHoverColor: 'bg-cyan-600 dark:bg-cyan-400',
    glowColor: 'group-hover:shadow-cyan-500/40',
    iconBg: 'from-cyan-500 to-blue-600',
  },
  amber: {
    iconGradient: 'bg-gradient-to-br from-amber-400 to-orange-500',
    topBarGradient: 'bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600',
    barColor: 'bg-amber-500 dark:bg-amber-500',
    barHoverColor: 'bg-amber-600 dark:bg-amber-400',
    glowColor: 'group-hover:shadow-amber-500/40',
    iconBg: 'from-amber-500 to-orange-600',
  },
};

// ─── Sparkline Component ────────────────────────────────────────────────────
function SparklineBars({ variant, delay = 0 }: { variant: CardVariant; delay?: number }) {
  const [mounted, setMounted] = useState(false);
  const config = variantConfig[variant];
  const bars = sparklineData[variant] || sparklineData.emerald;

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div className="flex items-end gap-[3px] h-6 mt-3 w-full">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          initial={{ scaleY: 0, opacity: 0 }}
          animate={mounted ? { scaleY: 1, opacity: 1 } : { scaleY: 0, opacity: 0 }}
          transition={{
            duration: 0.4,
            delay: delay / 1000 + i * 0.04,
            ease: 'easeOut',
          }}
          style={{ transformOrigin: 'bottom', height: `${h}%` }}
          className={cn(
            'flex-1 rounded-[2px] transition-colors duration-300',
            config.barColor,
            'group-hover:' + config.barHoverColor
          )}
        />
      ))}
    </div>
  );
}

// ─── KPI Card Component ─────────────────────────────────────────────────────
function KPICard({
  title,
  numericValue,
  formattedValue,
  subtitle,
  change,
  changeLabel,
  icon: Icon,
  trend,
  variant = 'emerald',
  index = 0,
  animateIn = true,
}: {
  title: string;
  numericValue: number;
  formattedValue: string;
  subtitle?: string;
  change?: number;
  changeLabel?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  variant?: CardVariant;
  index?: number;
  animateIn?: boolean;
}) {
  const { themeId } = useUIStyleStore();
  const isNeumorphism = themeId === 'neumorphism';
  const isGlassmorphism = themeId === 'frosted-glass';
  const config = variantConfig[variant];

  const animatedValue = useAnimatedCounter(numericValue, 1400, animateIn);

  // Determine display value: use animated counter for numeric, preserve formatting for currency
  const displayValue = typeof numericValue === 'number' && numericValue >= 0
    ? formattedValue.replace(String(numericValue), String(animatedValue))
    : formattedValue;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: 'easeOut' }}
      whileHover={{ scale: 1.03, y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="h-full cursor-pointer"
    >
      <Card
        className={cn(
          'group relative overflow-hidden transition-all duration-300 h-full rounded-2xl',
          'hover:shadow-2xl hover:-translate-y-1',
          config.glowColor,
          isNeumorphism
            ? 'border border-border/50 shadow-[6px_6px_12px_var(--neu-shadow-dark),-6px_-6px_12px_var(--neu-shadow-light)]'
            : isGlassmorphism
              ? 'border border-white/40 bg-card/60 backdrop-blur-xl shadow-lg'
              : 'border border-border/50 bg-card shadow-md'
        )}
      >
        {/* Gradient top accent bar — 2px */}
        <div
          className={cn(
            'absolute top-0 left-0 right-0 h-[2px] rounded-t-2xl z-20',
            config.topBarGradient
          )}
        />

        {/* Decorative background blur orb */}
        <div
          className={cn(
            'absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-[0.06] blur-2xl transition-all duration-700',
            'group-hover:opacity-[0.12] group-hover:scale-125',
            config.iconGradient
          )}
        />

        {/* Bottom-left subtle glow on hover */}
        <div
          className={cn(
            'absolute -bottom-8 -left-8 w-24 h-24 rounded-full opacity-0 blur-2xl transition-opacity duration-700',
            'group-hover:opacity-[0.08]',
            config.iconGradient
          )}
        />

        <CardContent className="p-5 pt-6 relative z-10">
          <div className="flex items-start justify-between gap-4">
            {/* Left: text content */}
            <div className="space-y-2 flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
                {title}
              </p>

              <div className="flex items-baseline gap-2 flex-wrap">
                <motion.span
                  className="text-[28px] font-extrabold tracking-tight tabular-nums text-foreground leading-none"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.08 + 0.15 }}
                >
                  {displayValue}
                </motion.span>
                {subtitle && (
                  <span className="text-xs text-muted-foreground/80 truncate font-medium">
                    {subtitle}
                  </span>
                )}
              </div>

              {/* Trend badge */}
              {change !== undefined && (
                <div className="flex items-center gap-1.5 pt-1">
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 text-[11px] font-bold px-2 py-[3px] rounded-full border transition-all duration-300',
                      trend === 'up' &&
                        'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50',
                      trend === 'down' &&
                        'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/50',
                      trend === 'neutral' &&
                        'bg-muted/50 text-muted-foreground border-border dark:bg-muted/40 dark:border-border'
                    )}
                  >
                    {trend === 'up' && <ArrowUpRight className="h-3 w-3" />}
                    {trend === 'down' && <ArrowDownRight className="h-3 w-3" />}
                    {trend === 'neutral' && <Minus className="h-3 w-3" />}
                    {change > 0 ? '+' : ''}
                    {change}%
                  </span>
                  {changeLabel && (
                    <span className="text-[11px] text-muted-foreground/70 truncate font-medium">
                      {changeLabel}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Right: circular icon */}
            <div className="relative flex-shrink-0">
              {/* Pulse ring on hover */}
              <div
                className={cn(
                  'absolute inset-0 rounded-full opacity-0 scale-100 transition-all duration-500',
                  'group-hover:opacity-30 group-hover:scale-125 group-hover:animate-[iconPulse_1.5s_ease-out]',
                  config.iconGradient
                )}
              />
              <div
                className={cn(
                  'relative w-12 h-12 rounded-full flex items-center justify-center',
                  'shadow-lg transition-all duration-300',
                  'group-hover:scale-110 group-hover:shadow-xl',
                  config.iconGradient
                )}
              >
                <Icon className="h-5 w-5 text-white drop-shadow-sm" />
              </div>
            </div>
          </div>

          {/* Sparkline */}
          <SparklineBars variant={variant} delay={index * 80 + 200} />
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Skeleton Card ──────────────────────────────────────────────────────────
function KPICardSkeleton({ index = 0 }: { index?: number }) {
  const { themeId } = useUIStyleStore();
  const isNeumorphism = themeId === 'neumorphism';
  const isGlassmorphism = themeId === 'frosted-glass';

  const accentColors = [
    'bg-emerald-400/70',
    'bg-violet-400/70',
    'bg-cyan-400/70',
    'bg-amber-400/70',
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
      className="h-full"
    >
      <Card
        className={cn(
          'h-full rounded-2xl overflow-hidden',
          isNeumorphism
            ? 'border border-border/50 shadow-[6px_6px_12px_var(--neu-shadow-dark),-6px_-6px_12px_var(--neu-shadow-light)]'
            : isGlassmorphism
              ? 'border border-white/40 bg-card/60 backdrop-blur-xl shadow-lg'
              : 'border border-border/50 bg-card shadow-md'
        )}
      >
        {/* Accent bar skeleton */}
        <Skeleton
          className={cn(
            'h-[2px] w-full rounded-none',
            accentColors[index % accentColors.length]
          )}
        />

        <CardContent className="p-5 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              {/* Title */}
              <Skeleton className="h-3 w-28 rounded-full" />
              {/* Value */}
              <Skeleton className="h-8 w-32 rounded-lg" />
              {/* Trend badge */}
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            {/* Icon skeleton — circular */}
            <Skeleton className="h-12 w-12 rounded-full flex-shrink-0" />
          </div>
          {/* Sparkline skeleton */}
          <div className="flex items-end gap-[3px] h-6 mt-4 w-full">
            {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 50].map((h, i) => (
              <Skeleton
                key={i}
                className="flex-1 rounded-[2px]"
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Error Card ─────────────────────────────────────────────────────────────
function KPICardError() {
  const { themeId } = useUIStyleStore();
  const isNeumorphism = themeId === 'neumorphism';

  return (
    <Card
      className={cn(
        'h-full rounded-2xl',
        isNeumorphism
          ? 'border border-border/50 shadow-[6px_6px_12px_var(--neu-shadow-dark),-6px_-6px_12px_var(--neu-shadow-light)]'
          : 'border border-destructive/50 shadow-md bg-card'
      )}
    >
      <CardContent className="p-5 flex flex-col items-center justify-center h-[160px] gap-2">
        <div className="h-9 w-9 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="h-4.5 w-4.5 text-destructive/70" />
        </div>
        <span className="text-xs text-muted-foreground font-medium">
          Failed to load
        </span>
      </CardContent>
    </Card>
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────
interface DashboardStats {
  revenue: { today: number; thisWeek: number; thisMonth: number; change: number };
  occupancy: { today: number; thisWeek: number; thisMonth: number; change: number };
  bookings: { today: number; thisWeek: number; thisMonth: number; pending: number };
  guests: { checkedIn: number; arriving: number; departing: number; total: number };
  adr: number;
  revpar: number;
  activeWifiSessions: number;
  pendingServiceRequests: number;
}

// ─── Main Export ────────────────────────────────────────────────────────────
export function KPICards() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { formatCurrency } = useCurrency();
  const { tDashboard, tCommon } = useI18n();
  useAuth();

  // Handle real-time dashboard updates
  const handleDashboardUpdate = useCallback((event: DashboardUpdateEvent) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[KPICards] Received dashboard update:', event.type);
    }
    if (event.type === 'stats') {
      fetchStats();
    }
  }, []);

  const { connectionStatus } = useRealtime({
    showToasts: false,
    onDashboardUpdate: handleDashboardUpdate,
  });

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/dashboard');
      const result = await response.json();
      if (result.success) {
        setStats(result.data.stats);
      } else {
        setError(result.error?.message || 'Failed to load stats');
      }
    } catch {
      setError('Failed to fetch dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Auto-refresh every 30 seconds if not connected via WebSocket
  useEffect(() => {
    if (connectionStatus.connected) return;
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [connectionStatus.connected, fetchStats]);

  // ─── Build KPI data (4 cards) — must be before early returns (hooks rule) ──
  const kpiCards = useMemo(() => {
    if (!stats) return [];
    const cards: Array<{
      title: string;
      numericValue: number;
      formattedValue: string;
      subtitle?: string;
      change?: number;
      changeLabel?: string;
      icon: LucideIcon;
      trend: 'up' | 'down' | 'neutral';
      variant: CardVariant;
    }> = [
      {
        title: tDashboard('totalRevenue'),
        numericValue: stats.revenue.today,
        formattedValue: formatCurrency(stats.revenue.today),
        change: stats.revenue.change,
        changeLabel: tDashboard('vsYesterday'),
        icon: DollarSign,
        trend: stats.revenue.change >= 0 ? 'up' : 'down',
        variant: 'emerald',
      },
      {
        title: tDashboard('occupancyRate'),
        numericValue: stats.occupancy.today,
        formattedValue: `${stats.occupancy.today}%`,
        change: stats.occupancy.change,
        changeLabel: tDashboard('vsLastWeek'),
        icon: Bed,
        trend: stats.occupancy.change >= 0 ? 'up' : 'down',
        variant: 'violet',
      },
      {
        title: tDashboard('wifiSessions'),
        numericValue: stats.activeWifiSessions,
        formattedValue: String(stats.activeWifiSessions),
        subtitle: tDashboard('activeNow'),
        icon: Wifi,
        trend: 'up',
        variant: 'cyan',
      },
      {
        title: tDashboard('serviceRequests'),
        numericValue: stats.pendingServiceRequests,
        formattedValue: String(stats.pendingServiceRequests),
        subtitle: tCommon('pending'),
        icon: Sparkles,
        trend: 'neutral',
        variant: 'amber',
      },
    ];
    return cards;
  }, [stats, formatCurrency, tDashboard, tCommon]);

  // ─── Loading State ────────────────────────────────────────────────────
  if (isLoading || kpiCards.length === 0) {
    return (
      <>
        <style>{iconPulseKeyframes}</style>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <KPICardSkeleton key={i} index={i} />
          ))}
        </div>
      </>
    );
  }

  // ─── Error State ──────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <KPICardError key={i} />
        ))}
      </div>
    );
  }

  return (
    <>
      <style>{iconPulseKeyframes}</style>
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi, index) => (
          <KPICard key={index} {...kpi} index={index} animateIn />
        ))}
      </div>
    </>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// ─── Keyframes (injected via <style> to avoid Tailwind JIT issues) ─────────
const iconPulseKeyframes = `
  @keyframes iconPulse {
    0% {
      transform: scale(1);
      opacity: 0.3;
    }
    50% {
      transform: scale(1.4);
      opacity: 0;
    }
    100% {
      transform: scale(1);
      opacity: 0;
    }
  }
`;
