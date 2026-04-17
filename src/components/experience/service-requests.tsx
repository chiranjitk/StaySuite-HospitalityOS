'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sparkles,
  Plus,
  Search,
  Loader2,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  RefreshCw,
  Star,
  MessageSquare,
  Wrench,
  UtensilsCrossed,
  Bell,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format, formatDistanceToNow } from 'date-fns';

interface Assignee {
  id: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  jobTitle?: string;
}

interface ServiceRequest {
  id: string;
  type: string;
  category?: string;
  subject: string;
  description?: string;
  priority: string;
  status: string;
  source: string;
  requestedAt: string;
  startedAt?: string;
  completedAt?: string;
  rating?: number;
  feedback?: string;
  assignee?: Assignee;
  createdAt: string;
}

const requestTypes = [
  { value: 'room_service', label: 'Room Service', icon: UtensilsCrossed },
  { value: 'housekeeping', label: 'Housekeeping', icon: Sparkles },
  { value: 'maintenance', label: 'Maintenance', icon: Wrench },
  { value: 'concierge', label: 'Concierge', icon: Bell },
  { value: 'other', label: 'Other', icon: MessageSquare },
];

const priorities = [
  { value: 'low', label: 'Low', color: 'bg-gray-500' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-500' },
];

const statuses = [
  { value: 'pending', label: 'Pending', color: 'bg-gray-500' },
  { value: 'assigned', label: 'Assigned', color: 'bg-cyan-500' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-amber-500' },
  { value: 'completed', label: 'Completed', color: 'bg-emerald-500' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-500' },
];

export default function ServiceRequests() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [summary, setSummary] = useState<{
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    byType: Record<string, number>;
    avgRating: number | null;
  } | null>(null);

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    type: 'room_service',
    category: '',
    subject: '',
    description: '',
    priority: 'medium',
  });

  // Fetch service requests
  const fetchRequests = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (typeFilter !== 'all') params.append('type', typeFilter);

      const response = await fetch(`/api/service-requests?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setRequests(result.data);
        setSummary(result.summary);
      }
    } catch (error) {
      console.error('Error fetching service requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch service requests',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter, typeFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchRequests();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Create service request
  const handleCreate = async () => {
    if (!formData.subject) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a subject',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/service-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: user?.tenantId,
          ...formData,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Service request created successfully',
        });
        setIsCreateOpen(false);
        setFormData({
          type: 'room_service',
          category: '',
          subject: '',
          description: '',
          priority: 'medium',
        });
        fetchRequests();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create service request',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating service request:', error);
      toast({
        title: 'Error',
        description: 'Failed to create service request',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Update service request status
  const handleUpdateStatus = async (id: string, status: string) => {
    try {
      const response = await fetch('/api/service-requests', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Status updated successfully',
        });
        fetchRequests();
        if (selectedRequest?.id === id) {
          setSelectedRequest(result.data);
        }
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update status',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const option = statuses.find(o => o.value === status);
    return (
      <Badge variant="secondary" className={cn('text-white', option?.color)}>
        {option?.label || status}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const option = priorities.find(o => o.value === priority);
    return (
      <Badge variant="outline" className={cn('border-2', `border-${priority === 'urgent' ? 'red' : priority === 'high' ? 'orange' : priority === 'medium' ? 'amber' : 'gray'}-500`)}>
        {option?.label || priority}
      </Badge>
    );
  };

  const getTypeIcon = (type: string) => {
    const option = requestTypes.find(o => o.value === type);
    if (option?.icon) {
      const Icon = option.icon;
      return <Icon className="h-4 w-4" />;
    }
    return <MessageSquare className="h-4 w-4" />;
  };

  // Stats
  const pendingCount = summary?.byStatus?.pending || 0;
  const inProgressCount = summary?.byStatus?.in_progress || 0;
  const completedToday = requests.filter(r => 
    r.status === 'completed' && 
    r.completedAt && 
    new Date(r.completedAt).toDateString() === new Date().toDateString()
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Service Requests
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage guest service requests and track fulfillment
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchRequests}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Request
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{pendingCount}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Play className="h-4 w-4 text-cyan-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{inProgressCount}</div>
              <div className="text-xs text-muted-foreground">In Progress</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{completedToday}</div>
              <div className="text-xs text-muted-foreground">Completed Today</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Star className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">
                {summary?.avgRating ? summary.avgRating.toFixed(1) : '-'}
              </div>
              <div className="text-xs text-muted-foreground">Avg Rating</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search requests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {requestTypes.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {statuses.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Sparkles className="h-12 w-12 mb-4" />
              <p>No service requests found</p>
            </div>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="sm:hidden space-y-3 p-4">
                {requests.map((request) => (
                  <div key={request.id} className="p-3 rounded-lg border">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{request.subject}</p>
                        <div className="flex items-center gap-1.5 mt-1">
                          {getTypeIcon(request.type)}
                          <span className="text-xs capitalize text-muted-foreground">{request.type.replace('_', ' ')}</span>
                          <span className="text-xs text-muted-foreground">•</span>
                          {getPriorityBadge(request.priority)}
                        </div>
                      </div>
                      {getStatusBadge(request.status)}
                    </div>
                    {request.assignee && (
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-[10px]">
                          {request.assignee.firstName[0]}{request.assignee.lastName[0]}
                        </div>
                        <span className="text-xs text-muted-foreground">{request.assignee.firstName} {request.assignee.lastName}</span>
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground mb-3">
                      {formatDistanceToNow(new Date(request.requestedAt), { addSuffix: true })}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-9"
                        onClick={() => {
                          setSelectedRequest(request);
                          setIsDetailOpen(true);
                        }}
                      >
                        View
                      </Button>
                      {request.status === 'pending' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-9"
                          onClick={() => handleUpdateStatus(request.id, 'in_progress')}
                        >
                          Start
                        </Button>
                      )}
                      {request.status === 'in_progress' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 h-9 text-emerald-600"
                          onClick={() => handleUpdateStatus(request.id, 'completed')}
                        >
                          Complete
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop Table */}
              <div className="hidden sm:block">
                <ScrollArea className="h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Request</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Assignee</TableHead>
                        <TableHead>Requested</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {requests.map((request) => (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{request.subject}</p>
                              {request.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1">
                                  {request.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getTypeIcon(request.type)}
                              <span className="capitalize">{request.type.replace('_', ' ')}</span>
                            </div>
                          </TableCell>
                          <TableCell>{getPriorityBadge(request.priority)}</TableCell>
                          <TableCell>{getStatusBadge(request.status)}</TableCell>
                          <TableCell>
                            {request.assignee ? (
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-xs">
                                  {request.assignee.firstName[0]}{request.assignee.lastName[0]}
                                </div>
                                <div>
                                  <p className="text-sm">{request.assignee.firstName} {request.assignee.lastName}</p>
                                  {request.assignee.jobTitle && (
                                    <p className="text-xs text-muted-foreground">{request.assignee.jobTitle}</p>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="text-sm">
                                {formatDistanceToNow(new Date(request.requestedAt), { addSuffix: true })}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(request.requestedAt), 'MMM d, HH:mm')}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSelectedRequest(request);
                                  setIsDetailOpen(true);
                                }}
                              >
                                View
                              </Button>
                              {request.status === 'pending' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUpdateStatus(request.id, 'in_progress')}
                                >
                                  Start
                                </Button>
                              )}
                              {request.status === 'in_progress' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="text-emerald-600"
                                  onClick={() => handleUpdateStatus(request.id, 'completed')}
                                >
                                  Complete
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Request Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Service Request</DialogTitle>
            <DialogDescription>
              Log a new guest service request
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Request Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {requestTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                placeholder="Brief description of the request"
                value={formData.subject}
                onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Additional details..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map(priority => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {getTypeIcon(selectedRequest.type)}
                  <span className="font-medium capitalize">{selectedRequest.type.replace('_', ' ')}</span>
                </div>
                {getStatusBadge(selectedRequest.status)}
              </div>
              
              <div>
                <h3 className="font-medium text-lg">{selectedRequest.subject}</h3>
                {selectedRequest.description && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedRequest.description}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Priority:</span>
                  <div className="mt-1">{getPriorityBadge(selectedRequest.priority)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Source:</span>
                  <p className="mt-1 capitalize">{selectedRequest.source}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Requested:</span>
                  <p className="mt-1">{format(new Date(selectedRequest.requestedAt), 'MMM d, yyyy HH:mm')}</p>
                </div>
                {selectedRequest.assignee && (
                  <div>
                    <span className="text-muted-foreground">Assignee:</span>
                    <p className="mt-1">{selectedRequest.assignee.firstName} {selectedRequest.assignee.lastName}</p>
                  </div>
                )}
              </div>

              {selectedRequest.rating && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    <span className="font-medium">{selectedRequest.rating}/5</span>
                  </div>
                  {selectedRequest.feedback && (
                    <p className="text-sm text-muted-foreground">{selectedRequest.feedback}</p>
                  )}
                </div>
              )}

              {/* Status Workflow Actions */}
              {selectedRequest.status !== 'completed' && selectedRequest.status !== 'cancelled' && (
                <div className="flex gap-2">
                  {selectedRequest.status === 'pending' && (
                    <Button 
                      className="flex-1" 
                      onClick={() => {
                        handleUpdateStatus(selectedRequest.id, 'in_progress');
                        setIsDetailOpen(false);
                      }}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start
                    </Button>
                  )}
                  {selectedRequest.status === 'in_progress' && (
                    <Button 
                      className="flex-1" 
                      onClick={() => {
                        handleUpdateStatus(selectedRequest.id, 'completed');
                        setIsDetailOpen(false);
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Complete
                    </Button>
                  )}
                  <Button 
                    variant="outline"
                    onClick={() => {
                      handleUpdateStatus(selectedRequest.id, 'cancelled');
                      setIsDetailOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
