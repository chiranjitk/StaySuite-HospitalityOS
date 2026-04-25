'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  Crown,
  Medal,
  Award,
  Star,
  TrendingUp,
  Users,
  Gift,
  Heart,
  ChevronRight,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface LoyaltyTier {
  name: string;
  icon: React.ElementType;
  count: number;
  percentage: number;
  color: string;
  bg: string;
  border: string;
  minPoints: number;
  maxPoints: number;
}

interface LoyaltyData {
  totalMembers: number;
  activeMembers: number;
  retentionRate: number;
  avgSpend: number;
  pointsIssued: number;
  pointsRedeemed: number;
  tiers: LoyaltyTier[];
  topGuests: Array<{
    name: string;
    tier: string;
    points: number;
    stays: number;
  }>;
}

const TIER_ICONS: Record<string, React.ElementType> = {
  platinum: Crown,
  gold: Medal,
  silver: Award,
  bronze: Star,
};

const TIER_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  platinum: { color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/50', border: 'border-violet-200 dark:border-violet-800' },
  gold: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/50', border: 'border-amber-200 dark:border-amber-800' },
  silver: { color: 'text-slate-600', bg: 'bg-slate-50 dark:bg-slate-950/50', border: 'border-slate-200 dark:border-slate-800' },
  bronze: { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/50', border: 'border-orange-200 dark:border-orange-800' },
};

function TierBar({ tier, index }: { tier: LoyaltyTier; index: number }) {
  const Icon = tier.icon;
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.1 + 0.3 }}
      className="space-y-1.5"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={cn('h-3.5 w-3.5', tier.color)} />
          <span className="text-xs font-semibold">{tier.name}</span>
          <span className="text-[10px] text-muted-foreground/60">{tier.count}</span>
        </div>
        <span className="text-xs font-bold tabular-nums">{tier.percentage}%</span>
      </div>
      <div className="relative h-2 bg-muted/40 rounded-full overflow-hidden">
        <motion.div
          className={cn('absolute inset-y-0 left-0 rounded-full', tier.bg, 'opacity-80')}
          initial={{ width: 0 }}
          animate={{ width: `${tier.percentage}%` }}
          transition={{ duration: 0.8, delay: index * 0.1 + 0.5, ease: 'easeOut' }}
        />
      </div>
    </motion.div>
  );
}

export function LoyaltyWidget() {
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchLoyaltyData() {
      try {
        const response = await fetch('/api/loyalty/tiers?includeStats=true');
        const result = await response.json();
        if (result.success && result.data && result.data.length > 0) {
          const tiers = result.data;
          const stats = result.stats || {};

          // Calculate total members from stats
          const totalMembers = Object.values(stats).reduce((sum: number, s: { count?: number }) => sum + (s.count || 0), 0);
          const activeMembers = totalMembers; // No separate active count in API

          // Build tier list for display
          const tierList: LoyaltyTier[] = tiers
            .filter((t: { isActive?: boolean }) => t.isActive !== false)
            .map((tier: { name?: string; displayName?: string; minPoints?: number; maxPoints?: number | null }) => {
              const tierName = tier.name || '';
              const lowerName = tierName.toLowerCase();
              const colors = TIER_COLORS[lowerName] || TIER_COLORS.bronze;
              const tierStat = stats[tierName] || { count: 0, totalPoints: 0 };
              return {
                name: tier.displayName || tierName,
                icon: TIER_ICONS[lowerName] || Star,
                count: tierStat.count || 0,
                percentage: totalMembers > 0 ? Math.round((tierStat.count / totalMembers) * 100) : 0,
                ...colors,
                minPoints: tier.minPoints || 0,
                maxPoints: tier.maxPoints || 0,
              };
            });

          const totalPoints = Object.values(stats).reduce((sum: number, s: { totalPoints?: number }) => sum + (s.totalPoints || 0), 0);

          setData({
            totalMembers,
            activeMembers,
            retentionRate: 0, // Not available from API
            avgSpend: 0, // Not available from API
            pointsIssued: totalPoints,
            pointsRedeemed: 0, // Not available from API
            tiers: tierList,
            topGuests: [], // Not available from this API
          });
        } else {
          setData(null);
        }
      } catch {
        setData(null);
      } finally {
        setIsLoading(false);
      }
    }
    fetchLoyaltyData();
  }, []);

  if (isLoading) {
    return (
      <Card className="border border-border/50 shadow-sm rounded-2xl">
        <CardHeader className="pb-3">
          <div className="h-5 w-40 bg-muted/50 animate-pulse rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="space-y-1.5">
              <div className="h-4 bg-muted/40 animate-pulse rounded w-3/4" />
              <div className="h-2 bg-muted/15 animate-pulse rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!data || data.tiers.length === 0) {
    return (
      <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden">
        <div className="h-[2px] bg-gradient-to-r from-violet-400 via-amber-400 to-orange-400" />
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            Guest Loyalty
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="rounded-full bg-violet-50 dark:bg-violet-900/40 p-3 mb-3">
              <Crown className="h-6 w-6 text-violet-400 dark:text-violet-300" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No loyalty data yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Loyalty program tiers will appear once configured</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const pointsRedemptionRate = data.pointsIssued > 0
    ? Math.round((data.pointsRedeemed / data.pointsIssued) * 100)
    : 0;

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
      {/* Accent bar */}
      <div className="h-[2px] bg-gradient-to-r from-violet-400 via-amber-400 to-orange-400" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Crown className="h-4 w-4 text-primary" />
            Guest Loyalty
          </CardTitle>
          <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400">
            {data.totalMembers} members
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50 border border-violet-100/50 dark:border-violet-800/50">
            <div className="flex items-center gap-1 mb-1">
              <Users className="h-3 w-3 text-violet-600 dark:text-violet-400" />
              <span className="text-[10px] text-muted-foreground font-medium">Members</span>
            </div>
            <p className="text-lg font-bold text-violet-600 dark:text-violet-400 tabular-nums">{data.activeMembers}</p>
            <p className="text-[10px] text-muted-foreground/60">{data.totalMembers} total</p>
          </div>
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 border border-amber-100/50 dark:border-amber-800/50">
            <div className="flex items-center gap-1 mb-1">
              <Gift className="h-3 w-3 text-amber-600 dark:text-amber-400" />
              <span className="text-[10px] text-muted-foreground font-medium">Points Issued</span>
            </div>
            <p className="text-lg font-bold text-amber-600 dark:text-amber-400 tabular-nums">{(data.pointsIssued / 1000).toFixed(0)}K</p>
            <p className="text-[10px] text-muted-foreground/60">{pointsRedemptionRate}% redeemed</p>
          </div>
        </div>

        {/* Tier distribution */}
        {data.tiers.length > 0 && (
          <div className="space-y-2.5">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tier Distribution</p>
            {data.tiers.map((tier, i) => (
              <TierBar key={tier.name} tier={tier} index={i} />
            ))}
          </div>
        )}

        {/* Top guests */}
        {data.topGuests.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-border/50">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Top Members</p>
            {data.topGuests.slice(0, 3).map((guest, i) => {
              const tierData = data.tiers.find(t => t.name === guest.tier);
              const TierIcon = tierData?.icon || Star;
              return (
                <motion.div
                  key={guest.name}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 + 0.6 }}
                  className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/50 transition-colors group cursor-pointer"
                >
                  <div className={cn(
                    'h-7 w-7 rounded-full flex items-center justify-center',
                    tierData?.bg || 'bg-muted/50'
                  )}>
                    <TierIcon className={cn('h-3.5 w-3.5', tierData?.color || 'text-muted-foreground')} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{guest.name}</p>
                    <p className="text-[10px] text-muted-foreground">{guest.stays} stays · {(guest.points / 1000).toFixed(1)}K pts</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-muted-foreground/60 transition-colors" />
                </motion.div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
