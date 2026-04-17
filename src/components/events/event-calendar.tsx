'use client';

import { useState, useEffect } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Users,
  Clock,
  Building,
  MapPin
} from 'lucide-react';
import { toast } from 'sonner';
import { startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO, startOfWeek, endOfWeek, addDays } from 'date-fns';

interface Property {
  id: string;
  name: string;
}

interface EventSpace {
  id: string;
  name: string;
  propertyId: string;
}

interface Event {
  id: string;
  tenantId: string;
  propertyId: string;
  spaceId: string | null;
  name: string;
  type: string;
  description: string | null;
  organizerName: string;
  organizerEmail: string;
  organizerPhone: string;
  startDate: string;
  endDate: string;
  setupStart: string | null;
  teardownEnd: string | null;
  expectedAttendance: number;
  actualAttendance: number | null;
  spaceCharge: number;
  cateringCharge: number;
  avCharge: number;
  otherCharges: number;
  totalAmount: number;
  currency: string;
  depositAmount: number;
  depositPaid: boolean;
  status: string;
  contractUrl: string | null;
  contractSignedAt: string | null;
  notes: string | null;
  property: {
    id: string;
    name: string;
  };
  space: {
    id: string;
    name: string;
  } | null;
}

interface Stats {
  total: number;
  inquiry: number;
  confirmed: number;
  in_progress: number;
  completed: number;
  cancelled: number;
  upcoming: number;
  totalRevenue: number;
}

export default function EventCalendar() {
  const { formatCurrency } = useCurrency();
  const { formatDate, formatDateTime } = useTimezone();
  const [events, setEvents] = useState<Event[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [spaces, setSpaces] = useState<EventSpace[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0, inquiry: 0, confirmed: 0, in_progress: 0, completed: 0, cancelled: 0, upcoming: 0, totalRevenue: 0
  });
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [propertyFilter, setPropertyFilter] = useState('all');
  const [spaceFilter, setSpaceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  useEffect(() => {
    fetchProperties();
    fetchSpaces();
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [propertyFilter, spaceFilter, statusFilter]);

  useEffect(() => {
    if (propertyFilter !== 'all') {
      const filteredSpaces = spaces.filter(s => s.propertyId === propertyFilter);
      if (spaceFilter !== 'all' && !filteredSpaces.find(s => s.id === spaceFilter)) {
        setSpaceFilter('all');
      }
    }
  }, [propertyFilter, spaces]);

  const fetchProperties = async () => {
    try {
      const response = await fetch('/api/properties');
      if (response.ok) {
        const data = await response.json();
        setProperties(data.properties || []);
      }
    } catch (error) {
      console.error('Error fetching properties:', error);
    }
  };

  const fetchSpaces = async () => {
    try {
      const response = await fetch('/api/events/spaces');
      if (response.ok) {
        const data = await response.json();
        setSpaces(data.spaces || []);
      }
    } catch (error) {
      console.error('Error fetching spaces:', error);
    }
  };

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (propertyFilter !== 'all') params.append('propertyId', propertyFilter);
      if (spaceFilter !== 'all') params.append('spaceId', spaceFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);

      const response = await fetch(`/api/events?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch events');
      
      const data = await response.json();
      setEvents(data.events || []);
      setStats(data.stats || {
        total: 0, inquiry: 0, confirmed: 0, in_progress: 0, completed: 0, cancelled: 0, upcoming: 0, totalRevenue: 0
      });
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'inquiry': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'confirmed': return 'bg-green-100 text-green-800 border-green-200';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'conference': return 'bg-purple-500';
      case 'wedding': return 'bg-pink-500';
      case 'meeting': return 'bg-blue-500';
      case 'party': return 'bg-orange-500';
      default: return 'bg-teal-500';
    }
  };

  // Generate calendar days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Get events for a specific day
  const getEventsForDay = (day: Date) => {
    return events.filter(event => {
      const eventStart = parseISO(event.startDate);
      const eventEnd = parseISO(event.endDate);
      return day >= startOfDay(eventStart) && day <= endOfDay(eventEnd);
    });
  };

  const startOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const endOfDay = (date: Date) => {
    const d = new Date(date);
    d.setHours(23, 59, 59, 999);
    return d;
  };

  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const filteredSpaces = propertyFilter === 'all' 
    ? spaces 
    : spaces.filter(s => s.propertyId === propertyFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Event Calendar</h2>
          <p className="text-muted-foreground">View and manage events in calendar view</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-8">
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Total</div>
            <div className="text-xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Inquiry</div>
            <div className="text-xl font-bold text-blue-600">{stats.inquiry}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Confirmed</div>
            <div className="text-xl font-bold text-green-600">{stats.confirmed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">In Progress</div>
            <div className="text-xl font-bold text-yellow-600">{stats.in_progress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Completed</div>
            <div className="text-xl font-bold text-gray-600">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Cancelled</div>
            <div className="text-xl font-bold text-red-600">{stats.cancelled}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Upcoming</div>
            <div className="text-xl font-bold text-teal-600">{stats.upcoming}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm text-muted-foreground">Revenue</div>
            <div className="text-lg font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <Select value={propertyFilter} onValueChange={setPropertyFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Properties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {properties.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={spaceFilter} onValueChange={setSpaceFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Spaces" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Spaces</SelectItem>
                {filteredSpaces.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="inquiry">Inquiry</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle className="text-lg min-w-[180px] text-center">
                {formatDate(currentDate)}
              </CardTitle>
              <Button variant="outline" size="icon" onClick={goToNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={goToToday}>
              <CalendarIcon className="h-4 w-4 mr-2" />
              Today
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Weekday Headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
                {day}
              </div>
            ))}

            {/* Calendar Days */}
            {calendarDays.map((day, i) => {
              const dayEvents = getEventsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              
              return (
                <div
                  key={i}
                  className={`min-h-[100px] p-1 border rounded-md ${
                    !isCurrentMonth ? 'bg-muted/30 text-muted-foreground' : ''
                  } ${isToday(day) ? 'border-teal-500 border-2' : 'border-border'}`}
                >
                  <div className={`text-sm font-medium mb-1 ${isToday(day) ? 'text-teal-600' : ''}`}>
                    {day.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 3).map(event => (
                      <div
                        key={event.id}
                        className={`text-xs px-1 py-0.5 rounded cursor-pointer truncate ${getStatusColor(event.status)}`}
                        onClick={() => { setSelectedEvent(event); setIsDetailOpen(true); }}
                      >
                        {event.name}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-xs text-muted-foreground px-1">
                        +{dayEvents.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Event Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${getTypeColor(selectedEvent?.type || '')}`} />
              {selectedEvent?.name}
            </DialogTitle>
            <DialogDescription>
              Event details and information
            </DialogDescription>
          </DialogHeader>
          
          {selectedEvent && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(selectedEvent.status)}>
                  {selectedEvent.status.replace('_', ' ')}
                </Badge>
                <Badge variant="outline">{selectedEvent.type}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedEvent.property.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedEvent.space?.name || 'No space assigned'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedEvent.expectedAttendance} expected</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {formatDateTime(parseISO(selectedEvent.startDate))} - 
                      {formatDateTime(parseISO(selectedEvent.endDate))}
                    </span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Organizer: </span>
                    <span>{selectedEvent.organizerName}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Email: </span>
                    <span>{selectedEvent.organizerEmail}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Phone: </span>
                    <span>{selectedEvent.organizerPhone}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <div className="text-sm text-muted-foreground">Space Charge</div>
                  <div className="font-medium">{formatCurrency(selectedEvent.spaceCharge)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Catering Charge</div>
                  <div className="font-medium">{formatCurrency(selectedEvent.cateringCharge)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">A/V Charge</div>
                  <div className="font-medium">{formatCurrency(selectedEvent.avCharge)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Other Charges</div>
                  <div className="font-medium">{formatCurrency(selectedEvent.otherCharges)}</div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-4 border-t">
                <div>
                  <div className="text-sm text-muted-foreground">Total Amount</div>
                  <div className="text-2xl font-bold">{formatCurrency(selectedEvent.totalAmount)}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">Deposit</div>
                  <div className="font-medium">
                    {formatCurrency(selectedEvent.depositAmount)}
                    {selectedEvent.depositPaid && <Badge className="ml-2 bg-green-100 text-green-800">Paid</Badge>}
                  </div>
                </div>
              </div>

              {selectedEvent.notes && (
                <div className="pt-4 border-t">
                  <div className="text-sm text-muted-foreground mb-1">Notes</div>
                  <div className="text-sm bg-muted p-3 rounded-md">{selectedEvent.notes}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
