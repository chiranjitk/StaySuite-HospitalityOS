'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Cloud,
  CloudSun,
  Sun,
  Moon,
  Droplets,
  Wind,
  Thermometer,
  Umbrella,
  MapPin,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface WeatherData {
  temp: number;
  condition: string;
  icon: React.ElementType;
  humidity: number;
  windSpeed: number;
  feelsLike: number;
  high: number;
  low: number;
}

// Mock weather data - no external API needed
const getMockWeather = (): WeatherData => {
  const hour = new Date().getHours();
  const isNight = hour >= 20 || hour < 6;

  const conditions = [
    { temp: 24, condition: 'Partly Cloudy', icon: CloudSun, humidity: 62, windSpeed: 12, feelsLike: 26, high: 28, low: 18 },
    { temp: 28, condition: 'Sunny', icon: Sun, humidity: 45, windSpeed: 8, feelsLike: 30, high: 31, low: 21 },
    { temp: 22, condition: 'Cloudy', icon: Cloud, humidity: 70, windSpeed: 15, feelsLike: 23, high: 25, low: 17 },
  ];

  const weather = conditions[Math.floor(Math.random() * conditions.length)];

  return {
    ...weather,
    temp: isNight ? weather.temp - 3 : weather.temp,
    icon: isNight ? Moon : weather.icon,
    condition: isNight ? 'Clear Night' : weather.condition,
  };
};

export function WeatherWidget() {
  const [weather] = useState<WeatherData>(getMockWeather);
  const WeatherIcon = weather.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className={cn(
        "border-0 shadow-sm rounded-2xl overflow-hidden relative transition-all duration-300",
        "hover:shadow-lg hover:-translate-y-0.5",
        "bg-gradient-to-br from-sky-50 via-blue-50/50 to-cyan-50/30 dark:from-sky-950/30 dark:via-blue-950/20 dark:to-cyan-950/10"
      )}>
        {/* Animated gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-sky-400 via-blue-400 to-cyan-400" />
        
        <CardContent className="p-4 relative">
          {/* Location */}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-3">
            <MapPin className="h-3 w-3" />
            <span className="font-medium">Hotel Location</span>
          </div>

          <div className="flex items-center justify-between">
            {/* Temperature */}
            <div>
              <div className="flex items-start">
                <span className="text-3xl font-bold text-foreground tabular-nums" style={{ fontFeatureSettings: 'tnum' }}>
                  {weather.temp}°
                </span>
                <span className="text-sm text-muted-foreground mt-1">C</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{weather.condition}</p>
              <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground/70">
                <span className="tabular-nums">H: {weather.high}°</span>
                <span>·</span>
                <span className="tabular-nums">L: {weather.low}°</span>
              </div>
            </div>

            {/* Weather Icon */}
            <div className={cn(
              "p-3 rounded-2xl transition-all duration-500",
              "bg-gradient-to-br from-sky-100 to-blue-100 dark:from-sky-900/40 dark:to-blue-900/30",
              "hover:scale-110 hover:shadow-lg"
            )}>
              <WeatherIcon className="h-7 w-7 text-sky-600 dark:text-sky-400" />
            </div>
          </div>

          {/* Details row */}
          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/30">
            <div className="flex items-center gap-1.5 text-[11px]">
              <Droplets className="h-3 w-3 text-blue-500" />
              <span className="text-muted-foreground">Humidity</span>
              <span className="ml-auto font-medium tabular-nums">{weather.humidity}%</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <Wind className="h-3 w-3 text-sky-500" />
              <span className="text-muted-foreground">Wind</span>
              <span className="ml-auto font-medium tabular-nums">{weather.windSpeed} km/h</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <Thermometer className="h-3 w-3 text-amber-500" />
              <span className="text-muted-foreground">Feels Like</span>
              <span className="ml-auto font-medium tabular-nums">{weather.feelsLike}°</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px]">
              <Umbrella className="h-3 w-3 text-violet-500" />
              <span className="text-muted-foreground">UV Index</span>
              <span className="ml-auto font-medium tabular-nums">Moderate</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
