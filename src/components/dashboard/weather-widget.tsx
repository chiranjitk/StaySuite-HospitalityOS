'use client';

import React, { useState, useEffect } from 'react';
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
  AlertCircle,
  Loader2,
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

// Map WMO weather codes to conditions and icons
function getWeatherInfo(code: number, isNight: boolean): { condition: string; icon: React.ElementType } {
  if (isNight) {
    if (code === 0) return { condition: 'Clear Night', icon: Moon };
    if (code <= 3) return { condition: 'Partly Cloudy', icon: Moon };
    return { condition: 'Overcast', icon: Cloud };
  }

  if (code === 0) return { condition: 'Clear Sky', icon: Sun };
  if (code === 1) return { condition: 'Mainly Clear', icon: Sun };
  if (code === 2) return { condition: 'Partly Cloudy', icon: CloudSun };
  if (code === 3) return { condition: 'Overcast', icon: Cloud };
  if (code >= 45 && code <= 48) return { condition: 'Foggy', icon: Cloud };
  if (code >= 51 && code <= 55) return { condition: 'Drizzle', icon: Droplets };
  if (code >= 56 && code <= 57) return { condition: 'Freezing Drizzle', icon: Droplets };
  if (code >= 61 && code <= 65) return { condition: 'Rain', icon: Umbrella };
  if (code >= 66 && code <= 67) return { condition: 'Freezing Rain', icon: Umbrella };
  if (code >= 71 && code <= 77) return { condition: 'Snow', icon: Cloud };
  if (code >= 80 && code <= 82) return { condition: 'Rain Showers', icon: Umbrella };
  if (code >= 85 && code <= 86) return { condition: 'Snow Showers', icon: Cloud };
  if (code >= 95) return { condition: 'Thunderstorm', icon: Cloud };
  return { condition: 'Unknown', icon: Cloud };
}

export function WeatherWidget() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true);
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=22.57&longitude=88.36&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,apparent_temperature&daily=temperature_2m_max,temperature_2m_min&timezone=auto'
        );
        if (!res.ok) throw new Error('Weather API failed');

        const data = await res.json();
        const current = data.current;
        const daily = data.daily;

        const hour = new Date().getHours();
        const isNight = hour >= 20 || hour < 6;
        const { condition, icon } = getWeatherInfo(current.weather_code, isNight);

        setWeather({
          temp: Math.round(current.temperature_2m),
          condition,
          icon,
          humidity: current.relative_humidity_2m,
          windSpeed: Math.round(current.wind_speed_10m),
          feelsLike: Math.round(current.apparent_temperature),
          high: Math.round(daily.temperature_2m_max[0]),
          low: Math.round(daily.temperature_2m_min[0]),
        });
      } catch (err) {
        console.error('Failed to fetch weather data:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className={cn(
        "border border-border/50 shadow-sm rounded-2xl overflow-hidden relative transition-all duration-300",
        "hover:shadow-lg hover:-translate-y-0.5",
        "bg-gradient-to-br from-sky-50 via-blue-50/50 to-cyan-50/60 dark:from-sky-950/50 dark:via-blue-950/50 dark:to-cyan-950/50"
      )}>
        {/* Animated gradient accent */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-sky-400 via-blue-400 to-cyan-400" />
        
        <CardContent className="p-4 relative">
          {/* Location */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span className="font-medium">Kolkata</span>
            </div>
            <span className="text-[10px] text-muted-foreground/60 font-medium uppercase tracking-wider">Live</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error || !weather ? (
            <div className="flex flex-col items-center justify-center py-6 gap-2">
              <AlertCircle className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground text-center">Weather unavailable</p>
              <p className="text-[10px] text-muted-foreground/60">Could not load weather data</p>
            </div>
          ) : (
            <>
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
                  "bg-gradient-to-br from-sky-100 to-blue-100 dark:from-sky-900/40 dark:to-blue-900/50",
                  "hover:scale-110 hover:shadow-lg"
                )}>
                  <weather.icon className="h-7 w-7 text-sky-600 dark:text-sky-400" />
                </div>
              </div>

              {/* Details row */}
              <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/50">
                <div className="flex items-center gap-1.5 text-[11px]">
                  <Droplets className="h-3 w-3 text-blue-500 dark:text-blue-400" />
                  <span className="text-muted-foreground">Humidity</span>
                  <span className="ml-auto font-medium tabular-nums">{weather.humidity}%</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <Wind className="h-3 w-3 text-sky-500 dark:text-sky-400" />
                  <span className="text-muted-foreground">Wind</span>
                  <span className="ml-auto font-medium tabular-nums">{weather.windSpeed} km/h</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <Thermometer className="h-3 w-3 text-amber-500 dark:text-amber-400" />
                  <span className="text-muted-foreground">Feels Like</span>
                  <span className="ml-auto font-medium tabular-nums">{weather.feelsLike}°</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <Umbrella className="h-3 w-3 text-violet-500 dark:text-violet-400" />
                  <span className="text-muted-foreground">Condition</span>
                  <span className="ml-auto font-medium">{weather.condition.split(' ')[0]}</span>
                </div>
              </div>
            </>
          )}

          {/* Data source note */}
          {!loading && (
            <p className="text-[10px] text-muted-foreground/50 mt-2 text-center">
              Weather data for Kolkata via Open-Meteo
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
