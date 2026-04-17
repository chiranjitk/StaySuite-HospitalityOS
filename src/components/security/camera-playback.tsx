'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
  Settings,
  Calendar,
  Clock,
  Download,
  Camera,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { SectionGuard } from '@/components/common/section-guard';

interface PlaybackEvent {
  id: string;
  timestamp: Date;
  type: 'motion' | 'intrusion' | 'tampering' | 'face_detected';
  thumbnail?: string;
  description: string;
  duration: number; // seconds
}

interface CameraInfo {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'maintenance';
  recordingEnabled: boolean;
  retentionDays: number;
}

interface RecordingFile {
  id: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  fileSize: number;
  hasEvents: boolean;
  thumbnailUrl?: string;
}

export default function CameraPlayback() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  
  // Camera selection
  const [cameras, setCameras] = useState<CameraInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  
  // Date selection
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  
  // Recording files for the selected date
  const [recordings, setRecordings] = useState<RecordingFile[]>([]);
  const [selectedRecording, setSelectedRecording] = useState<RecordingFile | null>(null);
  
  // Events timeline
  const [events, setEvents] = useState<PlaybackEvent[]>([]);
  
  // Zoom state for timeline
  const [timelineZoom, setTimelineZoom] = useState(1);

  // Fetch cameras on mount
  useEffect(() => {
    let isMounted = true;
    
    const loadCameras = async () => {
      try {
        const response = await fetch('/api/security/cameras');
        const data = await response.json();
        if (isMounted && data.success) {
          const cameraList = (data.data.cameras || data.data || []).filter((c: CameraInfo) => c.status === 'online');
          setCameras(cameraList);
          if (cameraList.length > 0) {
            setSelectedCamera(cameraList[0].id);
          }
        } else if (isMounted) {
          setCameras([]);
        }
      } catch (error) {
        console.error('Error fetching cameras:', error);
        if (isMounted) {
          setCameras([]);
        }
      }
    };
    
    loadCameras();
    return () => { isMounted = false; };
  }, []);

  // Fetch recordings when camera or date changes
  useEffect(() => {
    if (!selectedCamera || !selectedDate) return;
    
    let isMounted = true;
    
    const loadRecordings = async () => {
      try {
        const response = await fetch(
          `/api/security/cameras/${selectedCamera}/recordings?date=${selectedDate}`
        );
        const data = await response.json();
        if (isMounted && data.success) {
          const apiRecordings = data.data.recordings || [];
          setRecordings(apiRecordings.map((rec: RecordingFile & { duration: number | null; fileSize: number | null }) => ({
            id: rec.id,
            startTime: new Date(rec.startTime),
            endTime: new Date(rec.endTime),
            duration: rec.duration || 0,
            fileSize: rec.fileSize || 0,
            hasEvents: rec.hasEvents,
            thumbnailUrl: rec.thumbnailUrl,
          })));
          
          const apiEvents = data.data.events || [];
          setEvents(apiEvents.map((evt: { id: string; timestamp: string; type: string; description: string; duration?: number }) => ({
            id: evt.id,
            timestamp: new Date(evt.timestamp),
            type: evt.type as PlaybackEvent['type'],
            description: evt.description,
            duration: evt.duration || 0,
          })));
        } else if (isMounted) {
          setRecordings([]);
          setEvents([]);
        }
      } catch (error) {
        console.error('Error fetching recordings:', error);
        if (isMounted) {
          setRecordings([]);
          setEvents([]);
        }
      }
    };
    
    loadRecordings();
    return () => { isMounted = false; };
  }, [selectedCamera, selectedDate]);

  // Update current time during playback
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && videoRef.current) {
      interval = setInterval(() => {
        if (videoRef.current) {
          setCurrentTime(videoRef.current.currentTime);
        }
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleTimeSeek = (value: number[]) => {
    const newTime = value[0];
    setCurrentTime(newTime);
    if (videoRef.current) {
      videoRef.current.currentTime = newTime;
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume / 100;
    }
    if (newVolume === 0) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const skipTime = (seconds: number) => {
    if (videoRef.current) {
      const newTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + seconds));
      videoRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  const selectRecording = (recording: RecordingFile) => {
    setSelectedRecording(recording);
    setCurrentTime(0);
    setIsPlaying(false);
    // In real implementation, this would load the video source
  };

  const jumpToEvent = (event: PlaybackEvent) => {
    if (selectedRecording) {
      const eventTime = (event.timestamp.getTime() - selectedRecording.startTime.getTime()) / 1000;
      if (videoRef.current) {
        videoRef.current.currentTime = eventTime;
        setCurrentTime(eventTime);
      }
    }
  };

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const getEventTypeColor = (type: string): string => {
    switch (type) {
      case 'motion': return 'bg-yellow-500';
      case 'intrusion': return 'bg-red-500';
      case 'tampering': return 'bg-orange-500';
      case 'face_detected': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'motion': return <Camera className="h-3 w-3" />;
      case 'intrusion': return <AlertTriangle className="h-3 w-3" />;
      case 'tampering': return <Settings className="h-3 w-3" />;
      case 'face_detected': return <Camera className="h-3 w-3" />;
      default: return <Camera className="h-3 w-3" />;
    }
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  return (
    <SectionGuard permission="surveillance.playback">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-full">
      {/* Main Video Player */}
      <div className="lg:col-span-3 space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                {cameras.find(c => c.id === selectedCamera)?.name || 'Select Camera'}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Select camera" />
                  </SelectTrigger>
                  <SelectContent>
                    {cameras.map((camera) => (
                      <SelectItem key={camera.id} value={camera.id}>
                        {camera.name} - {camera.location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Video Container */}
            <div className="relative bg-black rounded-lg aspect-video overflow-hidden">
              <video
                ref={videoRef}
                className="w-full h-full object-contain"
                poster="/api/placeholder/800/450"
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    setDuration(videoRef.current.duration);
                  }
                }}
                onEnded={() => setIsPlaying(false)}
              />
              
              {/* Video Overlay - Time Display */}
              <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-1 rounded text-sm font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </div>
              
              {/* Recording Indicator */}
              {selectedRecording && (
                <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/70 text-white px-3 py-1 rounded text-sm">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <span>Recording</span>
                </div>
              )}
              
              {/* No Recording Placeholder */}
              {!selectedRecording && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-white/70">
                    <Camera className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>Select a recording to play</p>
                  </div>
                </div>
              )}
            </div>
            
            {/* Playback Controls */}
            <div className="mt-4 space-y-3">
              {/* Timeline Scrubber */}
              <div className="relative">
                <Slider
                  value={[currentTime]}
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  onValueChange={handleTimeSeek}
                  className="w-full"
                />
                
                {/* Event Markers on Timeline */}
                <div className="absolute top-0 left-0 right-0 h-5 pointer-events-none">
                  {events.map((event) => {
                    const position = selectedRecording
                      ? ((event.timestamp.getTime() - selectedRecording.startTime.getTime()) / 
                          (selectedRecording.duration * 1000)) * 100
                      : 0;
                    return (
                      <div
                        key={event.id}
                        className={`absolute top-0 w-1 h-4 ${getEventTypeColor(event.type)} cursor-pointer pointer-events-auto`}
                        style={{ left: `${Math.min(Math.max(position, 0), 100)}%` }}
                        title={event.description}
                        onClick={() => jumpToEvent(event)}
                      />
                    );
                  })}
                </div>
              </div>
              
              {/* Control Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => skipTime(-30)}>
                    <SkipBack className="h-4 w-4" />
                  </Button>
                  <Button variant="default" size="icon" onClick={handlePlayPause}>
                    {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => skipTime(30)}>
                    <SkipForward className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Volume */}
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={toggleMute}>
                      {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                    </Button>
                    <Slider
                      value={[isMuted ? 0 : volume]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={handleVolumeChange}
                      className="w-24"
                    />
                  </div>
                  
                  {/* Playback Speed */}
                  <Select value={playbackSpeed.toString()} onValueChange={(v) => setPlaybackSpeed(parseFloat(v))}>
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.25">0.25x</SelectItem>
                      <SelectItem value="0.5">0.5x</SelectItem>
                      <SelectItem value="1">1x</SelectItem>
                      <SelectItem value="1.5">1.5x</SelectItem>
                      <SelectItem value="2">2x</SelectItem>
                      <SelectItem value="4">4x</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  {/* Fullscreen */}
                  <Button variant="ghost" size="icon">
                    <Maximize className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Timeline View */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">24-Hour Timeline</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setTimelineZoom(Math.max(1, timelineZoom - 0.5))}>
                  -
                </Button>
                <span className="text-sm">{timelineZoom}x</span>
                <Button variant="outline" size="sm" onClick={() => setTimelineZoom(Math.min(4, timelineZoom + 0.5))}>
                  +
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative overflow-x-auto">
              <div 
                ref={timelineRef}
                className="relative h-20 bg-muted rounded-lg"
                style={{ width: `${100 * timelineZoom}%`, minWidth: '100%' }}
              >
                {/* Hour markers */}
                {Array.from({ length: 25 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0 border-l border-border/50"
                    style={{ left: `${(i / 24) * 100}%` }}
                  >
                    <span className="absolute top-1 left-1 text-xs text-muted-foreground">
                      {i.toString().padStart(2, '0')}:00
                    </span>
                  </div>
                ))}
                
                {/* Recording segments */}
                {recordings.map((rec) => {
                  const startPercent = (rec.startTime.getHours() + rec.startTime.getMinutes() / 60) / 24 * 100;
                  const widthPercent = (rec.duration / 86400) * 100;
                  return (
                    <div
                      key={rec.id}
                      className={`absolute top-8 h-8 rounded cursor-pointer ${
                        selectedRecording?.id === rec.id ? 'bg-primary' : 'bg-primary/50'
                      } ${rec.hasEvents ? 'ring-2 ring-yellow-500' : ''}`}
                      style={{ 
                        left: `${startPercent}%`, 
                        width: `${widthPercent}%`,
                        minWidth: '4px'
                      }}
                      onClick={() => selectRecording(rec)}
                      title={`${rec.startTime.toLocaleTimeString()} - ${formatFileSize(rec.fileSize)}`}
                    />
                  );
                })}
                
                {/* Event markers */}
                {events.map((event) => {
                  const position = (event.timestamp.getHours() + event.timestamp.getMinutes() / 60 + event.timestamp.getSeconds() / 3600) / 24 * 100;
                  return (
                    <div
                      key={event.id}
                      className={`absolute bottom-0 w-1 h-4 ${getEventTypeColor(event.type)} cursor-pointer hover:h-6 transition-all`}
                      style={{ left: `${position}%` }}
                      title={event.description}
                      onClick={() => jumpToEvent(event)}
                    />
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      {/* Sidebar - Recordings & Events */}
      <div className="space-y-4">
        {/* Date Picker */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Select Date
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigateDate('prev')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="flex-1 px-3 py-2 border rounded-md"
              />
              <Button variant="outline" size="icon" onClick={() => navigateDate('next')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* Recordings List */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recordings ({recordings.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-48">
              <div className="p-2 space-y-1">
                {recordings.map((rec) => (
                  <div
                    key={rec.id}
                    className={`p-2 rounded cursor-pointer hover:bg-muted ${
                      selectedRecording?.id === rec.id ? 'bg-muted' : ''
                    }`}
                    onClick={() => selectRecording(rec)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        {rec.startTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatFileSize(rec.fileSize)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {rec.hasEvents && (
                        <Badge variant="outline" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1 text-yellow-500" />
                          Events
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        
        {/* Events List */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Events ({events.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-48">
              <div className="p-2 space-y-2">
                {events.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No events detected
                  </p>
                ) : (
                  events.map((event) => (
                    <div
                      key={event.id}
                      className="p-2 rounded border cursor-pointer hover:bg-muted"
                      onClick={() => jumpToEvent(event)}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`p-1 rounded ${getEventTypeColor(event.type)} text-white`}>
                          {getEventIcon(event.type)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium capitalize">
                            {event.type.replace('_', ' ')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {event.timestamp.toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs mt-1 text-muted-foreground">
                        {event.description}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        
        {/* Export Options */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Export</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button className="w-full" variant="outline" disabled={!selectedRecording}>
                <Download className="h-4 w-4 mr-2" />
                Download Clip
              </Button>
              <Button className="w-full" variant="outline" disabled={events.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Export Event Report
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </SectionGuard>
  );
}
