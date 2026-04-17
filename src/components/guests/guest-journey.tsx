'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  MapPin,
  CalendarCheck,
  Clock,
  Luggage,
  Hotel,
  MessageSquareHeart,
  HeartHandshake,
  Plus,
  RefreshCw,
  Eye,
  Search,
  Route,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTimezone } from '@/contexts/TimezoneContext';
import { cn } from '@/lib/utils';

interface JourneyEvent {
  id: string;
  stage: string;
  eventType: string;
  title: string;
  description?: string | null;
  source: string;
  occurredAt: string;
  metadata?: string;
  bookingId?: string | null;
}

interface JourneyData {
  guest: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  };
  events: JourneyEvent[];
  stages: Record<string, JourneyEvent[]>;
  stageProgress: Record<string, boolean>;
  currentStage: string;
  totalEvents: number;
}

interface GuestJourneyProps {
  guestId: string;
}

type StageKey = 'discovery' | 'booking' | 'pre_arrival' | 'stay' | 'post_stay' | 'retention';

const stageConfig: Record<StageKey, {
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  dotColor: string;
  icon: React.ElementType;
  description: string;
}> = {
  discovery: {
    label: 'Discovery',
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    dotColor: 'bg-blue-500',
    icon: Search,
    description: 'How the guest found the property',
  },
  booking: {
    label: 'Booking',
    color: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    dotColor: 'bg-emerald-500',
    icon: CalendarCheck,
    description: 'Booking creation and management',
  },
  pre_arrival: {
    label: 'Pre-Arrival',
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    dotColor: 'bg-amber-500',
    icon: Luggage,
    description: 'Pre-stay communications and preparation',
  },
  stay: {
    label: 'Stay',
    color: 'text-orange-700',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    dotColor: 'bg-orange-500',
    icon: Hotel,
    description: 'In-stay experiences and services',
  },
  post_stay: {
    label: 'Post-Stay',
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    dotColor: 'bg-purple-500',
    icon: MessageSquareHeart,
    description: 'Feedback, reviews, and follow-up',
  },
  retention: {
    label: 'Retention',
    color: 'text-pink-700',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-200',
    dotColor: 'bg-pink-500',
    icon: HeartHandshake,
    description: 'Loyalty programs and re-engagement',
  },
};

const stageOrder: StageKey[] = ['discovery', 'booking', 'pre_arrival', 'stay', 'post_stay', 'retention'];

export function GuestJourney({ guestId }: GuestJourneyProps) {
  const { toast } = useToast();
  const { formatDate } = useTimezone();
  const [data, setData] = useState<JourneyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [isAddEventOpen, setIsAddEventOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<JourneyEvent | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Add event form
  const [newEvent, setNewEvent] = useState({
    stage: 'discovery' as StageKey,
    eventType: '',
    title: '',
    description: '',
  });

  useEffect(() => {
    fetchJourney();
  }, [guestId]);

  const fetchJourney = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', '100');
      const response = await fetch(`/api/guests/${guestId}/journey?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        toast({
          title: 'Error',
          description: 'Failed to fetch guest journey',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching journey:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch guest journey',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.eventType) {
      toast({
        title: 'Validation Error',
        description: 'Title and event type are required',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/guests/${guestId}/journey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stage: newEvent.stage,
          eventType: newEvent.eventType,
          title: newEvent.title,
          description: newEvent.description || undefined,
          source: 'manual',
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({ title: 'Success', description: 'Journey event added' });
        setIsAddEventOpen(false);
        setNewEvent({ stage: 'discovery', eventType: '', title: '', description: '' });
        fetchJourney();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to add event',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error adding event:', error);
      toast({
        title: 'Error',
        description: 'Failed to add journey event',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getFilteredEvents = (): JourneyEvent[] => {
    if (!data) return [];
    if (stageFilter === 'all') return data.events;
    return data.events.filter(e => e.stage === stageFilter);
  };

  const getEventStageKey = (stage: string): StageKey => {
    if (stage === 'pre_arrival') return 'pre_arrival';
    return stage as StageKey;
  };

  const getStageInfo = (stage: string) => {
    const key = getEventStageKey(stage);
    return stageConfig[key] || stageConfig.discovery;
  };

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="flex flex-col items-center justify-center py-12">
        <Route className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Unable to load journey data</p>
      </Card>
    );
  }

  const filteredEvents = getFilteredEvents();
  const completedStages = Object.entries(data.stageProgress || {}).filter(([, v]) => v).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Route className="h-5 w-5" />
            Guest Journey Timeline
          </h3>
          <p className="text-sm text-muted-foreground">
            Track the complete guest experience across all touchpoints
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchJourney}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setIsAddEventOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Event
          </Button>
        </div>
      </div>

      {/* Stage Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Journey Progress</span>
            <span className="text-sm text-muted-foreground">
              {completedStages} of {stageOrder.length} stages reached
            </span>
          </div>
          <div className="flex gap-1">
            {stageOrder.map((stage, index) => {
              const config = stageConfig[stage];
              const isActive = data.currentStage === stage;
              const isCompleted = data.stageProgress[stage];

              return (
                <div key={stage} className="flex-1 flex items-center">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={cn(
                        'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border-2 transition-colors',
                        isCompleted
                          ? `${config.dotColor} text-white border-transparent`
                          : isActive
                            ? `border-current ${config.color} ${config.bgColor}`
                            : 'bg-muted text-muted-foreground border-muted'
                      )}
                    >
                      {isCompleted ? (
                        <span className="text-white text-xs">✓</span>
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>
                    <span className={cn('text-[10px] mt-1 text-center leading-tight', isCompleted || isActive ? config.color : 'text-muted-foreground')}>
                      {config.label}
                    </span>
                  </div>
                  {index < stageOrder.length - 1 && (
                    <div
                      className={cn(
                        'h-0.5 flex-1 min-w-4 mt-[-12px]',
                        isCompleted && data.stageProgress[stageOrder[index + 1]]
                          ? config.dotColor
                          : 'bg-muted'
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">Filter by stage:</span>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Stages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {stageOrder.map((stage) => (
              <SelectItem key={stage} value={stage}>
                {stageConfig[stage].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Timeline */}
      {filteredEvents.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <Route className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
          <p className="text-lg font-medium text-muted-foreground">No journey events yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            {stageFilter === 'all'
              ? 'Start tracking this guest\'s journey by adding their first event'
              : 'No events found for the selected stage'}
          </p>
          {stageFilter === 'all' && (
            <Button className="mt-4" size="sm" onClick={() => setIsAddEventOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Event
            </Button>
          )}
        </Card>
      ) : (
        <ScrollArea className="h-[600px]">
          <div className="relative pl-8">
            {/* Vertical line */}
            <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-border" />

            <div className="space-y-6">
              {filteredEvents.map((event, index) => {
                const stageInfo = getStageInfo(event.stage);
                const StageIcon = stageInfo.icon;
                const isFirst = index === 0;
                const isLast = index === filteredEvents.length - 1;

                return (
                  <div key={event.id} className="relative flex gap-4">
                    {/* Timeline dot */}
                    <div
                      className={cn(
                        'absolute -left-8 w-8 h-8 rounded-full flex items-center justify-center z-10 border-2 border-background shadow-sm',
                        stageInfo.bgColor,
                        stageInfo.dotColor
                      )}
                    >
                      <StageIcon className="h-3.5 w-3.5 text-white" />
                    </div>

                    {/* Connector adjustments for first/last */}
                    {isFirst && (
                      <div className="absolute -left-[3.5px] -top-6 w-0.5 h-6 bg-background" />
                    )}
                    {isLast && (
                      <div className="absolute -left-[3.5px] -bottom-6 w-0.5 h-6 bg-background" />
                    )}

                    {/* Event card */}
                    <Card
                      className={cn(
                        'flex-1 overflow-hidden hover:shadow-md transition-shadow cursor-pointer',
                        stageInfo.borderColor
                      )}
                      onClick={() => setSelectedEvent(event)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge
                                variant="secondary"
                                className={cn('text-xs', stageInfo.bgColor, stageInfo.color)}
                              >
                                {stageInfo.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDate(event.occurredAt)}
                              </span>
                            </div>
                            <h4 className="font-medium text-sm">{event.title}</h4>
                            {event.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {event.description}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs shrink-0">
                              {event.source}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      )}

      {/* Stage Summary */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        {stageOrder.map((stage) => {
          const config = stageConfig[stage];
          const eventCount = (data.stages[stage] || []).length;

          return (
            <Card
              key={stage}
              className={cn('p-3 cursor-pointer transition-colors hover:shadow-sm', stageFilter === stage && config.borderColor)}
              onClick={() => setStageFilter(stageFilter === stage ? 'all' : stage)}
            >
              <div className="flex items-center gap-2">
                <div className={cn('p-1.5 rounded-lg', config.bgColor)}>
                  <config.icon className={cn('h-4 w-4', config.color)} />
                </div>
                <div>
                  <div className="text-sm font-medium">{config.label}</div>
                  <div className="text-xs text-muted-foreground">{eventCount} event{eventCount !== 1 ? 's' : ''}</div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Add Event Dialog */}
      <Dialog open={isAddEventOpen} onOpenChange={setIsAddEventOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Journey Event</DialogTitle>
            <DialogDescription>
              Record a new event in the guest&apos;s journey timeline
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Stage *</Label>
              <Select
                value={newEvent.stage}
                onValueChange={(v) => setNewEvent(prev => ({ ...prev, stage: v as StageKey }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stageOrder.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {stageConfig[stage].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Event Type *</Label>
              <Input
                placeholder="e.g., website_visit, booking_created, check_in"
                value={newEvent.eventType}
                onChange={(e) => setNewEvent(prev => ({ ...prev, eventType: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="Event title"
                value={newEvent.title}
                onChange={(e) => setNewEvent(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe what happened..."
                value={newEvent.description}
                onChange={(e) => setNewEvent(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddEventOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddEvent} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Event
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event Detail Dialog */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Event Details</DialogTitle>
            <DialogDescription>
              View full journey event information
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (() => {
            const info = getStageInfo(selectedEvent.stage);
            const StageIcon = info.icon;
            return (
              <div className="space-y-4 py-2">
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-lg', info.bgColor)}>
                    <StageIcon className={cn('h-5 w-5', info.color)} />
                  </div>
                  <div>
                    <Badge variant="secondary" className={cn(info.bgColor, info.color)}>
                      {info.label}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {selectedEvent.eventType} • via {selectedEvent.source}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Title</p>
                    <p className="font-medium">{selectedEvent.title}</p>
                  </div>
                  {selectedEvent.description && (
                    <div>
                      <p className="text-xs text-muted-foreground">Description</p>
                      <p className="text-sm">{selectedEvent.description}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground">Occurred</p>
                    <p className="text-sm flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(selectedEvent.occurredAt)}
                    </p>
                  </div>
                  {selectedEvent.bookingId && (
                    <div>
                      <p className="text-xs text-muted-foreground">Booking Reference</p>
                      <p className="text-sm font-mono">{selectedEvent.bookingId}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default GuestJourney;
