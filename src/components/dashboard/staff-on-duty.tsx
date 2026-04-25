'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Clock, Shield, HeadphonesIcon, Wrench, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface StaffMember {
  id: string;
  name: string;
  initials: string;
  avatar?: string;
  role: string;
  shiftStart: string;
  shiftEnd: string;
  isOnline: boolean;
}

const roleIcons: Record<string, React.ElementType> = {
  'Front Desk': HeadphonesIcon,
  'Concierge': Sparkles,
  'Housekeeping': Wrench,
  'Maintenance': Wrench,
  'Security': Shield,
};

const roleColors: Record<string, string> = {
  'Front Desk': 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
  'Concierge': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'Housekeeping': 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  'Maintenance': 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  'Security': 'bg-red-500/10 text-red-600 dark:text-red-400',
};

export function StaffOnDutyWidget() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [totalOnDuty, setTotalOnDuty] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchStaff = async () => {
      try {
        const response = await fetch('/api/dashboard/staff-on-duty');
        const result = await response.json();
        if (result.success && result.data && !cancelled) {
          setStaff(result.data.staff);
          setTotalOnDuty(result.data.totalOnDuty);
        }
      } catch {
        // Keep existing state on error
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchStaff();
    const interval = setInterval(fetchStaff, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  if (isLoading) {
    return (
      <Card className="border border-border/50 shadow-sm rounded-2xl">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const onlineCount = staff.filter(s => s.isOnline).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Staff On Duty
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 text-xs tabular-nums">
                {onlineCount} active
              </Badge>
              <Badge variant="outline" className="text-xs tabular-nums">
                {totalOnDuty} total
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent">
            {staff.map((member, idx) => {
              const RoleIcon = roleIcons[member.role] || Users;
              const roleColor = roleColors[member.role] || 'bg-muted text-muted-foreground';

              return (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors duration-200 cursor-default"
                >
                  {/* Avatar with status dot */}
                  <div className="relative flex-shrink-0">
                    <div className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold',
                      member.isOnline
                        ? 'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}>
                      {member.initials}
                    </div>
                    <span className={cn(
                      'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background',
                      member.isOnline ? 'bg-emerald-500' : 'bg-slate-400'
                    )} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{member.name}</p>
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        'inline-flex items-center gap-1 text-[10px] px-1.5 py-0 rounded-md font-medium',
                        roleColor
                      )}>
                        <RoleIcon className="h-2.5 w-2.5" />
                        {member.role}
                      </span>
                    </div>
                  </div>

                  {/* Shift time */}
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-shrink-0">
                    <Clock className="h-2.5 w-2.5" />
                    <span className="tabular-nums">{formatTime(member.shiftStart)}</span>
                    <span>-</span>
                    <span className="tabular-nums">{formatTime(member.shiftEnd)}</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
