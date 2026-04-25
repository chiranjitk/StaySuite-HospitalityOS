'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Hotel, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekLabels = ['This Week', '+1 Week', '+2 Weeks', '+3 Weeks'];

const getColorForValue = (value: number) => {
  if (value >= 90) return 'bg-gradient-to-br from-red-500 to-red-600';
  if (value >= 75) return 'bg-gradient-to-br from-orange-400 to-orange-500';
  if (value >= 60) return 'bg-gradient-to-br from-amber-300 to-amber-400';
  if (value >= 45) return 'bg-gradient-to-br from-yellow-300 to-yellow-400';
  if (value >= 30) return 'bg-gradient-to-br from-lime-300 to-lime-400';
  if (value >= 15) return 'bg-gradient-to-br from-green-300 to-green-400';
  return 'bg-gradient-to-br from-emerald-300 to-emerald-400';
};

const getTextColor = (value: number) => {
  if (value >= 60) return 'text-white';
  return 'text-gray-800';
};

// Get current day column index (0=Sun)
const todayIndex = new Date().getDay();

// null means no data available for that cell
type HeatmapGrid = (number | null)[][];

export function OccupancyHeatmap() {
  const [hoveredCell, setHoveredCell] = useState<{ week: number; day: number } | null>(null);
  const [heatmapData, setHeatmapData] = useState<HeatmapGrid | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hasRealData, setHasRealData] = useState(false);

  useEffect(() => {
    const fetchOccupancy = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/dashboard/occupancy-forecast');
        if (!res.ok) throw new Error('API request failed');
        const json = await res.json();

        if (!json.success || !json.data?.forecastData) {
          setError(true);
          return;
        }

        const forecastDays = json.data.forecastData; // 7-day forecast
        const dataHasRealData = json.data.hasData === true && json.data.totalRooms > 0;
        setHasRealData(dataHasRealData);

        // Build 4-week grid: first week from API, rest as null (unavailable)
        const grid: HeatmapGrid = [];

        // Week 0: map the 7 API days to Sun-Sat order
        const week0: (number | null)[] = new Array(7).fill(null);
        forecastDays.forEach((day: { occupancy: number; day: string }) => {
          // API returns 'day' as weekday short name (e.g., 'Mon', 'Tue')
          const dayIdx = dayLabels.findIndex((label) => label === day.day);
          if (dayIdx !== -1) {
            week0[dayIdx] = dataHasRealData ? day.occupancy : null;
          }
        });
        grid.push(week0);

        // Weeks 1-3: no data available
        for (let w = 1; w < 4; w++) {
          grid.push(new Array(7).fill(null));
        }

        setHeatmapData(grid);
      } catch (err) {
        console.error('Failed to fetch occupancy forecast:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchOccupancy();
  }, []);

  if (loading) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hotel className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Occupancy Heatmap</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">
              4-week forecast
            </span>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !heatmapData) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hotel className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Occupancy Heatmap</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">
              4-week forecast
            </span>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">Forecast unavailable</p>
            <p className="text-xs text-muted-foreground/60">
              Could not load occupancy data. Please try again later.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hotel className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-semibold">Occupancy Heatmap</CardTitle>
            </div>
            <span className="text-xs text-muted-foreground">
              This week only · live data
            </span>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          {!hasRealData ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <AlertCircle className="h-7 w-7 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No occupancy data</p>
              <p className="text-xs text-muted-foreground/60 text-center max-w-[240px]">
                Add properties and bookings to see real occupancy forecasts.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Column headers */}
              <div className="grid grid-cols-[70px_repeat(7,1fr)] gap-1">
                <div className="text-xs text-muted-foreground"></div>
                {dayLabels.map((day) => (
                  <div
                    key={day}
                    className={cn(
                      'text-xs text-center font-medium text-muted-foreground py-1',
                      dayLabels.indexOf(day) === todayIndex && 'text-primary font-bold'
                    )}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Heatmap rows */}
              {heatmapData.map((weekData, weekIdx) => {
                const isWeekUnavailable = weekIdx > 0;
                return (
                  <div key={weekIdx} className="grid grid-cols-[70px_repeat(7,1fr)] gap-1">
                    <div className="text-xs text-muted-foreground flex items-center pr-2">
                      {weekLabels[weekIdx]}
                      {isWeekUnavailable && (
                        <span className="ml-1 text-[9px] text-muted-foreground/50">(unavailable)</span>
                      )}
                    </div>
                    {weekData.map((value, dayIdx) => {
                      if (value === null) {
                        // No data cell
                        const cellDate = new Date();
                        cellDate.setDate(cellDate.getDate() + (weekIdx * 7) + (dayIdx - todayIndex));
                        return (
                          <Tooltip key={`${weekIdx}-${dayIdx}`}>
                            <TooltipTrigger asChild>
                              <div className="h-8 rounded-sm bg-muted/40 flex items-center justify-center text-[10px] text-muted-foreground/50">
                                –
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs">
                              <div className="font-medium">{format(cellDate, 'EEE, MMM d')}</div>
                              <div className="text-muted-foreground">No forecast data</div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      }

                      const isToday = weekIdx === 0 && dayIdx === todayIndex;
                      const isHovered = hoveredCell?.week === weekIdx && hoveredCell?.day === dayIdx;
                      const cellDate = new Date();
                      cellDate.setDate(cellDate.getDate() + (dayIdx - todayIndex));

                      return (
                        <Tooltip key={`${weekIdx}-${dayIdx}`}>
                          <TooltipTrigger asChild>
                            <div
                              className={cn(
                                'h-8 rounded-sm cursor-pointer transition-all duration-150 flex items-center justify-center text-[10px] font-medium',
                                getColorForValue(value),
                                getTextColor(value),
                                isToday && 'ring-2 ring-inset ring-primary ring-offset-1 ring-offset-background rounded-md',
                                isHovered && 'scale-110 z-10 shadow-md',
                              )}
                              onMouseEnter={() => setHoveredCell({ week: weekIdx, day: dayIdx })}
                              onMouseLeave={() => setHoveredCell(null)}
                            >
                              {value}%
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <div className="font-medium">{format(cellDate, 'EEE, MMM d')}</div>
                            <div className={cn(
                              'font-bold',
                              value >= 90 ? 'text-red-600 dark:text-red-400' : value >= 75 ? 'text-orange-600 dark:text-orange-400' : value >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                            )}>
                              {value}% occupancy
                            </div>
                            <div className="text-muted-foreground">
                              {value >= 90 ? 'Very High' : value >= 75 ? 'High' : value >= 60 ? 'Moderate' : value >= 45 ? 'Low' : 'Very Low'}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Legend */}
          {hasRealData && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t">
              <span className="text-xs text-muted-foreground">Low</span>
              <div className="flex gap-0.5">
                {[15, 30, 45, 60, 75, 90].map((val) => (
                  <div
                    key={val}
                    className={cn('w-6 h-3 rounded-sm', getColorForValue(val))}
                  />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">High</span>
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
