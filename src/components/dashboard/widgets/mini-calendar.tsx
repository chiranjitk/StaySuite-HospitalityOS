'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Users,
  Wrench,
  PartyPopper,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CalendarEvent {
  day: number;
  type: 'checkin' | 'checkout' | 'maintenance' | 'event';
  count: number;
  label: string;
}

interface ApiEvent {
  id: string;
  name: string;
  type?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  expectedGuests?: number;
  venue?: string;
  status?: string;
}

const EVENT_CONFIG: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  checkin: { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500', icon: Users },
  checkout: { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500', icon: Users },
  maintenance: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500', icon: Wrench },
  event: { color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500', icon: PartyPopper },
};

function mapApiEventsToCalendar(apiEvents: ApiEvent[], year: number, month: number): CalendarEvent[] {
  const eventMap = new Map<number, Map<string, { count: number; label: string }>>();

  apiEvents.forEach(evt => {
    try {
      const evtDate = new Date(evt.date);
      if (evtDate.getFullYear() === year && evtDate.getMonth() === month) {
        const day = evtDate.getDate();
        if (!eventMap.has(day)) {
          eventMap.set(day, new Map());
        }
        const dayMap = eventMap.get(day)!;

        // Map event types to calendar categories
        let calType: CalendarEvent['type'] = 'event';
        const typeLower = (evt.type || '').toLowerCase();
        if (typeLower.includes('checkin') || typeLower.includes('check_in') || typeLower.includes('arrival')) {
          calType = 'checkin';
        } else if (typeLower.includes('checkout') || typeLower.includes('check_out') || typeLower.includes('departure')) {
          calType = 'checkout';
        } else if (typeLower.includes('maintenance') || typeLower.includes('repair')) {
          calType = 'maintenance';
        }

        const key = calType;
        const existing = dayMap.get(key);
        dayMap.set(key, {
          count: (existing?.count || 0) + 1,
          label: evt.name || calType,
        });
      }
    } catch {
      // Skip invalid dates
    }
  });

  const events: CalendarEvent[] = [];
  eventMap.forEach((typeMap, day) => {
    typeMap.forEach((info, type) => {
      events.push({
        day,
        type: type as CalendarEvent['type'],
        count: info.count,
        label: info.label,
      });
    });
  });

  return events;
}

export function MiniCalendarWidget() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();

  useEffect(() => {
    async function fetchEvents() {
      setIsLoadingEvents(true);
      try {
        const response = await fetch('/api/dashboard/events');
        const result = await response.json();
        if (result.success && result.data?.events) {
          const mappedEvents = mapApiEventsToCalendar(result.data.events, year, month);
          setEvents(mappedEvents);
        } else {
          setEvents([]);
        }
      } catch {
        setEvents([]);
      } finally {
        setIsLoadingEvents(false);
      }
    }
    fetchEvents();
  }, [year, month]);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
    setSelectedDay(null);
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
    setSelectedDay(null);
  };

  const isToday = (day: number) =>
    day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  const getEventsForDay = (day: number) => events.filter(e => e.day === day);
  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  // Week day headers
  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  // Build calendar grid cells
  const calendarCells = [];
  // Empty cells before first day
  for (let i = 0; i < firstDayOfMonth; i++) {
    calendarCells.push(null);
  }
  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    calendarCells.push(day);
  }

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            Calendar
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[130px] text-center">{monthName}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoadingEvents ? (
          <div className="space-y-3">
            <div className="grid grid-cols-7 gap-0.5">
              {weekDays.map((wd) => (
                <div key={wd} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
                  {wd}
                </div>
              ))}
              {calendarCells.map((day, i) => (
                <div key={i} className="h-9">
                  {day !== null && (
                    <div className="h-full w-full rounded-lg bg-muted/15 animate-pulse" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-0.5">
              {/* Week day headers */}
              {weekDays.map((wd) => (
                <div key={wd} className="text-center text-[10px] font-semibold text-muted-foreground py-1">
                  {wd}
                </div>
              ))}
              
              {/* Calendar days */}
              {calendarCells.map((day, i) => {
                if (day === null) {
                  return <div key={`empty-${i}`} className="h-9" />;
                }
                const dayEvents = getEventsForDay(day);
                const dayIsToday = isToday(day);
                const isSelected = selectedDay === day;

                return (
                  <motion.button
                    key={day}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setSelectedDay(day)}
                    className={cn(
                      'relative h-9 w-full rounded-lg text-xs font-medium transition-all duration-200',
                      'flex flex-col items-center justify-center gap-0',
                      'hover:bg-muted/60',
                      dayIsToday && 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground',
                      isSelected && !dayIsToday && 'bg-primary/10 ring-1 ring-primary/50',
                      !dayIsToday && !isSelected && 'text-foreground'
                    )}
                  >
                    <span className={cn(
                      'leading-none',
                      dayIsToday && 'font-bold'
                    )}>
                      {day}
                    </span>
                    {/* Event dots */}
                    {dayEvents.length > 0 && (
                      <div className="flex gap-[2px] mt-[1px]">
                        {dayEvents.slice(0, 3).map((evt, ei) => (
                          <span
                            key={ei}
                            className={cn('h-[3px] w-[3px] rounded-full', EVENT_CONFIG[evt.type].bg)}
                          />
                        ))}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground pt-1 border-t border-border/50">
              <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Check-in</div>
              <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-orange-500" /> Check-out</div>
              <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Maint.</div>
              <div className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-violet-500" /> Event</div>
            </div>

            {/* Selected day events */}
            <AnimatePresence mode="wait">
              {selectedDay && selectedDayEvents.length > 0 && (
                <motion.div
                  key={selectedDay}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-1.5 pt-2 border-t border-border/50 overflow-hidden"
                >
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    {new Date(year, month, selectedDay).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </p>
                  {selectedDayEvents.map((evt, i) => {
                    const config = EVENT_CONFIG[evt.type];
                    const Icon = config.icon;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className={cn(
                          'flex items-center gap-2 p-2 rounded-lg',
                          'bg-muted/50 hover:bg-muted/50 transition-colors'
                        )}
                      >
                        <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', config.color)} />
                        <span className="text-xs font-medium flex-1">{evt.label}</span>
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                          {evt.count}
                        </Badge>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
              {selectedDay && selectedDayEvents.length === 0 && (
                <motion.div
                  key={`empty-${selectedDay}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-2 border-t border-border/50"
                >
                  <p className="text-[11px] text-muted-foreground">No events this day</p>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </CardContent>
    </Card>
  );
}
