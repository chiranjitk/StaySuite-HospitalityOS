'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import {
  UserCheck,
  Trophy,
  Clock,
  Target,
  CheckCircle2,
  ListTodo,
  ArrowUpRight,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface StaffMember {
  name: string;
  role: string;
  score: number;
  initials: string;
  color: string;
  bg: string;
}

interface StaffData {
  topPerformers: StaffMember[];
  shiftCompletion: number;
  tasksCompleted: number;
  tasksPending: number;
  onTimeRate: number;
}

function getMockData(): StaffData {
  return {
    topPerformers: [
      { name: 'Priya Sharma', role: 'Front Desk', score: 96, initials: 'PS', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
      { name: 'Amit Patel', role: 'Housekeeping', score: 92, initials: 'AP', color: 'text-sky-600', bg: 'bg-sky-50 dark:bg-sky-950/30' },
      { name: 'Neha Singh', role: 'F&B Service', score: 88, initials: 'NS', color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/30' },
      { name: 'Raj Kumar', role: 'Maintenance', score: 94, initials: 'RK', color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/30' },
    ],
    shiftCompletion: 87,
    tasksCompleted: 24,
    tasksPending: 6,
    onTimeRate: 91,
  };
}

// Circular progress indicator
function CircularProgress({ value, size = 56, strokeWidth = 5, color = 'stroke-emerald-500' }: { value: number; size?: number; strokeWidth?: number; color?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/20"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          className={color}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold tabular-nums">{value}%</span>
      </div>
    </div>
  );
}

export default function StaffPerformanceWidget() {
  const [data, setData] = useState<StaffData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setData(getMockData());
      setIsLoading(false);
    }, 900);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return (
      <Card className="border border-border/50 shadow-sm rounded-2xl">
        <CardHeader className="pb-3">
          <div className="h-5 w-40 bg-muted/30 animate-pulse rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-10 bg-muted/20 animate-pulse rounded" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const totalTasks = data.tasksCompleted + data.tasksPending;
  const completionRate = Math.round((data.tasksCompleted / totalTasks) * 100);

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
      {/* Accent bar */}
      <div className="h-[2px] bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-emerald-600" />
            Staff Performance
          </CardTitle>
          <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-emerald-200 text-emerald-700 dark:border-emerald-800 dark:text-emerald-400">
            This Shift
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Top performers */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Top Performers</p>
          {data.topPerformers.map((staff, i) => (
            <motion.div
              key={staff.name}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 + 0.2 }}
              className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-muted/30 transition-colors"
            >
              <div className={cn('h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold', staff.bg, staff.color)}>
                {staff.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium truncate">{staff.name}</p>
                  <span className={cn('text-xs font-bold tabular-nums', staff.color)}>{staff.score}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{staff.role}</span>
                  <div className="flex-1 h-1.5 bg-muted/20 rounded-full overflow-hidden">
                    <motion.div
                      className={cn('h-full rounded-full', staff.bg)}
                      initial={{ width: 0 }}
                      animate={{ width: `${staff.score}%` }}
                      transition={{ duration: 0.8, delay: i * 0.1 + 0.5, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/30">
          <div className="text-center p-2 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/10">
            <CircularProgress value={data.shiftCompletion} size={44} strokeWidth={4} />
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">Shift Done</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-sky-50/50 dark:bg-sky-950/10">
            <div className="flex items-center justify-center gap-1 h-[44px]">
              <CheckCircle2 className="h-4 w-4 text-sky-600" />
              <span className="text-lg font-bold text-sky-600 tabular-nums">{data.tasksCompleted}</span>
              <span className="text-xs text-muted-foreground">/ {totalTasks}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">Tasks Done</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-amber-50/50 dark:bg-amber-950/10">
            <div className="flex items-center justify-center gap-1 h-[44px]">
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="text-lg font-bold text-amber-600 tabular-nums">{data.onTimeRate}%</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 font-medium">On Time</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
