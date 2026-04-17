'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Hotel } from 'lucide-react';
import { format } from 'date-fns';

// Mock occupancy data: 7 days x 4 weeks
const generateMockData = () => {
  const data: number[][] = [];
  const today = new Date();
  const currentDay = today.getDay(); // 0=Sun, 6=Sat

  for (let week = 0; week < 4; week++) {
    const weekData: number[] = [];
    for (let day = 0; day < 7; day++) {
      // Generate realistic hotel occupancy patterns
      // Weekdays (Mon-Fri) higher, weekends (Sat-Sun) moderate
      // Weekends have higher leisure travel
      let base: number;
      if (day === 0 || day === 6) {
        // Sunday and Saturday - moderate to high
        base = 65 + Math.random() * 30;
      } else if (day === 5) {
        // Friday - high check-in day
        base = 70 + Math.random() * 25;
      } else {
        // Mon-Thu - business travel pattern
        base = 60 + Math.random() * 35;
      }

      // Add some seasonal/weekly variation
      const weekMultiplier = 1 - (week * 0.05); // Slight decrease for future weeks
      const value = Math.min(100, Math.max(15, Math.round(base * weekMultiplier)));

      weekData.push(value);
    }
    data.push(weekData);
  }
  return data;
};

const heatmapData = generateMockData();

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

export function OccupancyHeatmap() {
  const [hoveredCell, setHoveredCell] = useState<{ week: number; day: number } | null>(null);

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
              4-week forecast
            </span>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
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
            {heatmapData.map((weekData, weekIdx) => (
              <div key={weekIdx} className="grid grid-cols-[70px_repeat(7,1fr)] gap-1">
                <div className="text-xs text-muted-foreground flex items-center pr-2">
                  {weekLabels[weekIdx]}
                </div>
                {weekData.map((value, dayIdx) => {
                  const isToday = weekIdx === 0 && dayIdx === todayIndex;
                  const isHovered = hoveredCell?.week === weekIdx && hoveredCell?.day === dayIdx;
                  const cellDate = new Date();
                  cellDate.setDate(cellDate.getDate() + (weekIdx * 7) + (dayIdx - todayIndex));

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
                          value >= 90 ? 'text-red-600' : value >= 75 ? 'text-orange-600' : value >= 60 ? 'text-amber-600' : 'text-emerald-600'
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
            ))}
          </div>

          {/* Legend */}
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
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
