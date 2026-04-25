'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  Video,
  VideoOff,
  Maximize2,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Wrench,
  Grid3X3,
  Grid2X2,
  Radio,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { SectionGuard } from '@/components/common/section-guard';

interface Camera {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'maintenance';
  isRecording: boolean;
  streamType: string;
  streamUrl?: string;
  groupId?: string;
  groupName?: string;
  posX?: number;
  posY?: number;
}

interface CameraGroup {
  id: string;
  name: string;
}

interface CameraStats {
  total: number;
  online: number;
  offline: number;
  maintenance: number;
  recording: number;
}

/** Individual camera video player with HLS.js support */
function CameraPlayer({ camera }: { camera: Camera }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<unknown>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isStreamReady, setIsStreamReady] = useState(false);

  // Store native event listeners for cleanup (Safari path)
  const nativeListenersRef = useRef<{ loadedmetadata: (() => void) | null; error: (() => void) | null }>({
    loadedmetadata: null,
    error: null,
  });

  const hasStream = !!(camera.streamUrl && (camera.streamType === 'hls' || camera.streamType === 'rtsp'));

  const initPlayer = useCallback(async () => {
    if (!hasStream || !videoRef.current || !camera.streamUrl) return;

    setIsLoading(true);
    setHasError(false);

    try {
      const Hls = (await import('hls.js')).default;

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        hlsRef.current = hls;

        hls.loadSource(camera.streamUrl);
        hls.attachMedia(videoRef.current);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setIsStreamReady(true);
          setIsLoading(false);
          videoRef.current?.play().catch(() => {
            // Autoplay may be blocked by browser
          });
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            setHasError(true);
            setIsLoading(false);
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              // Try to recover from network errors
              hls.startLoad();
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            } else {
              hls.destroy();
            }
          }
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari native HLS support
        const handleLoadedMetadata = () => {
          setIsStreamReady(true);
          setIsLoading(false);
          videoRef.current?.play().catch(() => {
            // Autoplay may be blocked
          });
        };
        const handleError = () => {
          setHasError(true);
          setIsLoading(false);
        };

        // Store refs for cleanup
        nativeListenersRef.current = { loadedmetadata: handleLoadedMetadata, error: handleError };

        videoRef.current.src = camera.streamUrl;
        videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
        videoRef.current.addEventListener('error', handleError);
      }
    } catch (error) {
      console.error('Error initializing video player:', error);
      setHasError(true);
      setIsLoading(false);
    }
  }, [camera.streamUrl, camera.streamType, hasStream]);

  useEffect(() => {
    initPlayer();

    return () => {
      if (hlsRef.current) {
        const hls = hlsRef.current as { destroy: () => void };
        hls.destroy();
        hlsRef.current = null;
      }
      if (videoRef.current) {
        // Remove native event listeners (Safari path)
        if (nativeListenersRef.current.loadedmetadata) {
          videoRef.current.removeEventListener('loadedmetadata', nativeListenersRef.current.loadedmetadata);
        }
        if (nativeListenersRef.current.error) {
          videoRef.current.removeEventListener('error', nativeListenersRef.current.error);
        }
        nativeListenersRef.current = { loadedmetadata: null, error: null };
        videoRef.current.src = '';
      }
    };
  }, [initPlayer]);

  // If no stream URL, show placeholder
  if (!hasStream) {
    return (
      <div className="relative aspect-video bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        {camera.status === 'online' ? (
          <>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white/50">
                <Video className="h-12 w-12 mx-auto mb-2" />
                <p className="text-sm">{camera.name}</p>
                <p className="text-xs">{camera.location}</p>
              </div>
            </div>
            {camera.isRecording && (
              <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500/80 px-2 py-1 rounded">
                <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                <span className="text-xs text-white font-medium">REC</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <div className="absolute bottom-2 left-2 text-xs text-white/70 font-mono">
              {new Date().toLocaleString()}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-white/50">
            <VideoOff className="h-12 w-12 mb-2" />
            <p className="text-sm font-medium capitalize">{camera.status}</p>
            <p className="text-xs">{camera.name}</p>
          </div>
        )}
      </div>
    );
  }

  // Stream player
  return (
    <div className="relative aspect-video bg-black">
      {/* Video element */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        muted
        autoPlay
        playsInline
      />

      {/* Loading overlay */}
      {isLoading && !isStreamReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="text-center text-white">
            <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin" />
            <p className="text-sm">Connecting to stream...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="text-center text-white/70">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Stream unavailable</p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-white border border-white/30 hover:bg-white/10"
              onClick={initPlayer}
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Camera name overlay */}
      <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-white text-xs font-medium">
        {camera.name}
      </div>

      {/* Status badge */}
      <div className="absolute top-2 right-2">
        <Badge
          variant="outline"
          className={cn(
            'text-xs border-0 bg-black/60 backdrop-blur-sm',
            isStreamReady ? 'text-emerald-400 dark:text-emerald-300' : 'text-amber-400 dark:text-amber-300'
          )}
        >
          <div className={cn('h-1.5 w-1.5 rounded-full mr-1.5', isStreamReady ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse')} />
          {isStreamReady ? 'LIVE' : 'CONNECTING'}
        </Badge>
      </div>

      {/* Recording indicator */}
      {camera.isRecording && (
        <div className="absolute top-10 right-2 flex items-center gap-1 bg-red-500/80 px-2 py-0.5 rounded">
          <div className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-xs text-white font-medium">REC</span>
        </div>
      )}
    </div>
  );
}

export default function LiveCamera() {
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [groups, setGroups] = useState<CameraGroup[]>([]);
  const [stats, setStats] = useState<CameraStats>({
    total: 0,
    online: 0,
    offline: 0,
    maintenance: 0,
    recording: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCamera, setSelectedCamera] = useState<Camera | null>(null);
  const [gridSize, setGridSize] = useState<'1x1' | '2x2' | '3x3'>('2x2');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  
  const filteredCameras = groupFilter === 'all' 
    ? cameras 
    : cameras.filter(c => c.groupId === groupFilter);

  useEffect(() => {
    fetchCameras();
  }, []);

  const fetchCameras = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/security/cameras');
      const data = await response.json();

      if (data.success) {
        setCameras(data.data.cameras);
        setGroups(data.data.groups);
        setStats(data.data.stats);
        
        // Set first camera as selected if not already
        if (!selectedCamera && data.data.cameras.length > 0) {
          setSelectedCamera(data.data.cameras[0]);
        }
      } else {
        toast.error('Failed to fetch cameras');
      }
    } catch (error) {
      console.error('Error fetching cameras:', error);
      toast.error('Failed to load camera data');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />;
      case 'offline':
        return <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400" />;
      case 'maintenance':
        return <Wrench className="h-4 w-4 text-amber-500 dark:text-amber-400" />;
      default:
        return <VideoOff className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'border-emerald-500/50';
      case 'offline':
        return 'border-red-500/50';
      case 'maintenance':
        return 'border-amber-500/50';
      default:
        return 'border-gray-500/50';
    }
  };

  const getGridCols = () => {
    switch (gridSize) {
      case '1x1':
        return 'grid-cols-1';
      case '2x2':
        return 'grid-cols-1 md:grid-cols-2';
      case '3x3':
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      default:
        return 'grid-cols-2';
    }
  };

  const visibleCameras = gridSize === '1x1' && selectedCamera 
    ? [selectedCamera] 
    : filteredCameras.slice(0, gridSize === '2x2' ? 4 : 9);

  return (
    <SectionGuard permission="surveillance.view">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Video className="h-5 w-5" />
            Live Camera View
            <Badge className="bg-red-500 animate-pulse ml-2">
              <Radio className="h-3 w-3 mr-1" />
              LIVE
            </Badge>
          </h2>
          <p className="text-sm text-muted-foreground">
            Monitor property security cameras in real-time
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchCameras} disabled={isLoading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
          <div className="flex border rounded-lg overflow-hidden">
            <Button
              variant={gridSize === '1x1' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setGridSize('1x1')}
            >
              1x1
            </Button>
            <Button
              variant={gridSize === '2x2' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setGridSize('2x2')}
            >
              2x2
            </Button>
            <Button
              variant={gridSize === '3x3' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              onClick={() => setGridSize('3x3')}
            >
              3x3
            </Button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.online}</div>
              <div className="text-xs text-muted-foreground">Online</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <VideoOff className="h-4 w-4 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.offline}</div>
              <div className="text-xs text-muted-foreground">Offline</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Wrench className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.maintenance}</div>
              <div className="text-xs text-muted-foreground">Maintenance</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Radio className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.recording}</div>
              <div className="text-xs text-muted-foreground">Recording</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Filter by area" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Areas</SelectItem>
                {groups.map(group => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : cameras.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Video className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No cameras configured</p>
            <p className="text-sm text-muted-foreground mt-2">
              Add cameras through the property settings
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Camera Grid */}
          <div className={cn('grid gap-4', getGridCols())}>
            {visibleCameras.map((camera) => (
              <Card 
                key={camera.id} 
                className={cn('overflow-hidden border-2', getStatusColor(camera.status))}
              >
                <CardContent className="p-0">
                  {/* Camera Feed - HLS player or placeholder */}
                  <CameraPlayer camera={camera} />
                  {/* Camera Info */}
                  <div className="p-3 flex items-center justify-between bg-muted/50">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(camera.status)}
                      <div>
                        <p className="text-sm font-medium">{camera.name}</p>
                        <p className="text-xs text-muted-foreground">{camera.location}</p>
                      </div>
                    </div>
                    {camera.groupName && (
                      <Badge variant="outline" className="text-xs">
                        {camera.groupName}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Camera List */}
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-lg">All Cameras</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[200px]">
                <div className="divide-y">
                  {cameras.map((camera) => (
                    <div
                      key={camera.id}
                      className={cn(
                        'p-3 flex items-center justify-between hover:bg-muted/50 cursor-pointer',
                        selectedCamera?.id === camera.id && 'bg-muted'
                      )}
                      onClick={() => {
                        setSelectedCamera(camera);
                        setGridSize('1x1');
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {getStatusIcon(camera.status)}
                        <div>
                          <p className="text-sm font-medium">{camera.name}</p>
                          <p className="text-xs text-muted-foreground">{camera.location}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {camera.isRecording && (
                          <Badge className="bg-red-500 text-white text-xs">REC</Badge>
                        )}
                        <Badge variant="outline" className="text-xs capitalize">
                          {camera.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </>
      )}
    </div>
    </SectionGuard>
  );
}
