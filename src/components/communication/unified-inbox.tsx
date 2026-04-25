'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  MessageSquare,
  Send,
  Paperclip,
  Phone,
  Mail,
  MoreVertical,
  Search,
  Loader2,
  RefreshCw,
  Inbox,
  CheckCircle2,
  Clock,
  AlertCircle,
  Filter,
  UserPlus,
  Tag,
  Archive,
  Trash2,
  Reply,
  Forward,
  Star,
  StarOff,
  Users,
  Smartphone,
  Globe,
  Bot,
  ChevronDown,
  Plus,
  FileText,
  X,
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Smile,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow, isToday, isYesterday } from 'date-fns';

// Types
interface ChatMessage {
  id: string;
  content: string;
  senderType: string;
  senderId?: string;
  sender?: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  messageType: string;
  sentAt: string;
  status: string;
  attachments?: { name: string; url: string; type: string }[];
}

interface Conversation {
  id: string;
  guestId?: string;
  bookingId?: string;
  channel: string;
  channelRef?: string;
  subject?: string;
  status: string;
  priority: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  tags: string[];
  guest?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    avatar?: string;
  };
  booking?: {
    confirmationCode: string;
    room?: { number: string };
  };
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  };
  messages?: ChatMessage[];
}

interface MessageTemplate {
  id: string;
  name: string;
  category: string;
  channel: string;
  subject?: string;
  body: string;
  shortcut?: string;
  isQuickReply: boolean;
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role?: string;
}

// Channel configuration
const channelConfig: Record<string, { icon: typeof MessageSquare; color: string; label: string }> = {
  app: { icon: MessageSquare, color: 'bg-emerald-500', label: 'App' },
  whatsapp: { icon: Smartphone, color: 'bg-green-500', label: 'WhatsApp' },
  email: { icon: Mail, color: 'bg-amber-500', label: 'Email' },
  sms: { icon: Phone, color: 'bg-purple-500', label: 'SMS' },
  ota: { icon: Globe, color: 'bg-cyan-500', label: 'OTA' },
};

// Status configuration
const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
  open: { icon: Clock, color: 'text-amber-500 dark:text-amber-400', label: 'Open' },
  pending: { icon: AlertCircle, color: 'text-orange-500 dark:text-orange-400', label: 'Pending' },
  resolved: { icon: CheckCircle2, color: 'text-emerald-500 dark:text-emerald-400', label: 'Resolved' },
  closed: { icon: Archive, color: 'text-gray-500', label: 'Closed' },
};

// Priority configuration
const priorityConfig: Record<string, { color: string; label: string }> = {
  low: { color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', label: 'Low' },
  normal: { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'Normal' },
  high: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', label: 'High' },
  urgent: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Urgent' },
};

export default function UnifiedInbox() {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [activeChannel, setActiveChannel] = useState<string>('all');
  const [activeStatus, setActiveStatus] = useState<string>('all');
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    pending: 0,
    resolved: 0,
    totalUnread: 0,
  });

  // Fetch conversations
  const fetchConversations = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      // tenantId is derived from authenticated session on the backend
      if (searchQuery) params.append('search', searchQuery);
      if (activeChannel !== 'all') params.append('channel', activeChannel);
      if (activeStatus !== 'all') params.append('status', activeStatus);

      const response = await fetch(`/api/communication/conversations?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setConversations(result.data);
        setStats(result.stats);
      } else {
        throw new Error(result.error?.message || 'Failed to fetch conversations');
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch conversations',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, activeChannel, activeStatus, toast]);

  // Fetch staff members
  const fetchStaffMembers = useCallback(async () => {
    try {
      // tenantId is derived from authenticated session on the backend
      const response = await fetch('/api/users');
      const result = await response.json();
      if (result.success) {
        setStaffMembers(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching staff members:', error);
    }
  }, []);

  // Fetch templates
  const fetchTemplates = useCallback(async () => {
    try {
      // tenantId is derived from authenticated session on the backend
      const response = await fetch('/api/communication/templates');
      const result = await response.json();
      if (result.success) {
        setTemplates(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
    fetchStaffMembers();
    fetchTemplates();
  }, [fetchConversations, fetchStaffMembers, fetchTemplates]);

  // Fetch messages for selected conversation
  const fetchMessages = useCallback(async (conversationId: string) => {
    setIsLoadingMessages(true);
    try {
      const response = await fetch(`/api/communication/conversations/${conversationId}/messages`);
      const result = await response.json();

      if (result.success) {
        setMessages(result.data);
      } else {
        throw new Error(result.error?.message || 'Failed to fetch messages');
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch messages',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingMessages(false);
    }
  }, [toast]);

  // Fetch messages when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
    }
  }, [selectedConversation, fetchMessages]);

  // Send message
  const handleSendMessage = async () => {
    if (!messageInput.trim() || !selectedConversation) return;

    setIsSending(true);
    try {
      const response = await fetch(`/api/communication/conversations/${selectedConversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: messageInput,
          senderType: 'staff',
          messageType: 'text',
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMessages((prev) => [...prev, result.data]);
        setMessageInput('');
        // Update conversation's last message
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation.id
              ? { ...c, lastMessage: messageInput, lastMessageAt: new Date().toISOString() }
              : c
          )
        );
      } else {
        throw new Error(result.error?.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  // Update conversation status
  const handleUpdateStatus = async (conversationId: string, status: string) => {
    try {
      const response = await fetch('/api/communication/conversations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: conversationId, status }),
      });

      const result = await response.json();

      if (result.success) {
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, status } : c))
        );
        if (selectedConversation?.id === conversationId) {
          setSelectedConversation((prev) => prev ? { ...prev, status } : null);
        }
        toast({
          title: 'Status Updated',
          description: `Conversation marked as ${status}`,
        });
      } else {
        throw new Error(result.error?.message || 'Failed to update status');
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

  // Assign conversation
  const handleAssignConversation = async (conversationId: string, assignedTo: string) => {
    try {
      const response = await fetch('/api/communication/conversations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: conversationId, assignedTo }),
      });

      const result = await response.json();

      if (result.success) {
        const assignedMember = staffMembers.find((s) => s.id === assignedTo);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  assignedTo: assignedMember
                    ? { id: assignedMember.id, firstName: assignedMember.firstName, lastName: assignedMember.lastName, avatar: assignedMember.avatar }
                    : undefined,
                }
              : c
          )
        );
        if (selectedConversation?.id === conversationId) {
          setSelectedConversation((prev) =>
            prev
              ? {
                  ...prev,
                  assignedTo: assignedMember
                    ? { id: assignedMember.id, firstName: assignedMember.firstName, lastName: assignedMember.lastName, avatar: assignedMember.avatar }
                    : undefined,
                }
              : null
          );
        }
        toast({
          title: 'Assigned',
          description: `Conversation assigned to ${assignedMember?.firstName} ${assignedMember?.lastName}`,
        });
      } else {
        throw new Error(result.error?.message || 'Failed to assign conversation');
      }
    } catch (error) {
      console.error('Error assigning conversation:', error);
      toast({
        title: 'Error',
        description: 'Failed to assign conversation',
        variant: 'destructive',
      });
    }
  };

  // Use template
  const handleUseTemplate = (template: MessageTemplate) => {
    setMessageInput(template.body);
    setShowTemplateDialog(false);
  };

  // Quick reply shortcuts
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Group conversations by date
  const groupedConversations = useMemo(() => {
    const groups: Record<string, Conversation[]> = {
      'Unread': [],
      'Today': [],
      'Yesterday': [],
      'This Week': [],
      'Older': [],
    };

    conversations.forEach((conv) => {
      if (conv.unreadCount > 0) {
        groups['Unread'].push(conv);
      } else if (conv.lastMessageAt) {
        const date = new Date(conv.lastMessageAt);
        if (isToday(date)) {
          groups['Today'].push(conv);
        } else if (isYesterday(date)) {
          groups['Yesterday'].push(conv);
        } else {
          groups['This Week'].push(conv);
        }
      } else {
        groups['Older'].push(conv);
      }
    });

    return groups;
  }, [conversations]);

  // Filter quick reply templates
  const quickReplyTemplates = useMemo(() => {
    return templates.filter((t) => t.isQuickReply);
  }, [templates]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Inbox className="h-5 w-5" />
            Unified Inbox
            {stats.totalUnread > 0 && (
              <Badge className="ml-2 bg-red-500">{stats.totalUnread}</Badge>
            )}
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage all guest communications in one place
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchConversations()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gray-500/10">
              <Inbox className="h-4 w-4 text-gray-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 cursor-pointer hover:bg-muted/50" onClick={() => setActiveStatus('open')}>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.open}</div>
              <div className="text-xs text-muted-foreground">Open</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 cursor-pointer hover:bg-muted/50" onClick={() => setActiveStatus('pending')}>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <AlertCircle className="h-4 w-4 text-orange-500 dark:text-orange-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 cursor-pointer hover:bg-muted/50" onClick={() => setActiveStatus('resolved')}>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.resolved}</div>
              <div className="text-xs text-muted-foreground">Resolved</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Mail className="h-4 w-4 text-red-500 dark:text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.totalUnread}</div>
              <div className="text-xs text-muted-foreground">Unread</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Select value={activeChannel} onValueChange={setActiveChannel}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Channel" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            <SelectItem value="app">App</SelectItem>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="ota">OTA</SelectItem>
          </SelectContent>
        </Select>
        <Select value={activeStatus} onValueChange={setActiveStatus}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Chat Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-[600px]">
        {/* Conversation List */}
        <Card className="lg:col-span-1">
          <CardHeader className="p-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {isLoading ? (
                <div className="p-4 space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Inbox className="h-12 w-12 mb-4" />
                  <p>No conversations found</p>
                </div>
              ) : (
                Object.entries(groupedConversations).map(([group, convs]) => {
                  if (convs.length === 0) return null;
                  return (
                    <div key={group}>
                      <div className="px-4 py-2 text-xs font-semibold text-muted-foreground bg-muted/30">
                        {group} ({convs.length})
                      </div>
                      {convs.map((conversation) => {
                        const ChannelIcon = channelConfig[conversation.channel]?.icon || MessageSquare;
                        const channelColor = channelConfig[conversation.channel]?.color || 'bg-gray-500';
                        
                        return (
                          <div
                            key={conversation.id}
                            className={cn(
                              'p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors',
                              selectedConversation?.id === conversation.id && 'bg-muted'
                            )}
                            onClick={() => setSelectedConversation(conversation)}
                          >
                            <div className="flex items-start gap-3">
                              <div className="relative">
                                <Avatar className="h-10 w-10">
                                  <AvatarImage src={conversation.guest?.avatar} />
                                  <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
                                    {conversation.guest?.firstName?.[0]}{conversation.guest?.lastName?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className={cn('absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center', channelColor)}>
                                  <ChannelIcon className="h-2.5 w-2.5 text-white" />
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium truncate">
                                    {conversation.guest?.firstName} {conversation.guest?.lastName}
                                  </p>
                                  {conversation.unreadCount > 0 && (
                                    <Badge className="bg-red-500 text-white text-xs">
                                      {conversation.unreadCount}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground truncate">
                                  {conversation.subject || conversation.lastMessage || 'No messages yet'}
                                </p>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <Badge variant="outline" className={cn('text-xs', priorityConfig[conversation.priority]?.color || '')}>
                                    {priorityConfig[conversation.priority]?.label || conversation.priority}
                                  </Badge>
                                  {conversation.assignedTo && (
                                    <span className="text-xs text-muted-foreground">
                                      @ {conversation.assignedTo.firstName}
                                    </span>
                                  )}
                                  {conversation.lastMessageAt && (
                                    <span className="text-xs text-muted-foreground ml-auto">
                                      {formatDistanceToNow(new Date(conversation.lastMessageAt), { addSuffix: true })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Chat Window */}
        <Card className="lg:col-span-2 flex flex-col">
          {selectedConversation ? (
            <>
              {/* Chat Header */}
              <CardHeader className="p-4 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedConversation.guest?.avatar} />
                      <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
                        {selectedConversation.guest?.firstName?.[0]}{selectedConversation.guest?.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {selectedConversation.guest?.firstName} {selectedConversation.guest?.lastName}
                      </p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {channelConfig[selectedConversation.channel] && (
                          <Badge
                            variant="outline"
                            className={cn('text-xs text-white', channelConfig[selectedConversation.channel].color)}
                          >
                            {channelConfig[selectedConversation.channel].label}
                          </Badge>
                        )}
                        {selectedConversation.booking?.room && (
                          <span>Room {selectedConversation.booking.room.number}</span>
                        )}
                        {selectedConversation.subject && (
                          <span className="truncate max-w-[200px]">{selectedConversation.subject}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Status Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          {(() => {
                            const statusCfg = statusConfig[selectedConversation.status];
                            if (!statusCfg) return null;
                            const StatusIcon = statusCfg.icon;
                            return <StatusIcon className={cn('h-4 w-4 mr-2', statusCfg.color)} />;
                          })()}
                          {statusConfig[selectedConversation.status]?.label || selectedConversation.status}
                          <ChevronDown className="h-4 w-4 ml-2" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {Object.entries(statusConfig).map(([key, config]) => {
                          const StatusIcon = config.icon;
                          return (
                            <DropdownMenuItem key={key} onClick={() => handleUpdateStatus(selectedConversation.id, key)}>
                              <StatusIcon className={cn('h-4 w-4 mr-2', config.color)} />
                              {config.label}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Assign Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm">
                          <UserPlus className="h-4 w-4 mr-2" />
                          {selectedConversation.assignedTo
                            ? `${selectedConversation.assignedTo.firstName} ${selectedConversation.assignedTo.lastName}`
                            : 'Assign'}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>Assign To</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleAssignConversation(selectedConversation.id, '')}>
                          <X className="h-4 w-4 mr-2" />
                          Unassign
                        </DropdownMenuItem>
                        {staffMembers.map((member) => (
                          <DropdownMenuItem key={member.id} onClick={() => handleAssignConversation(selectedConversation.id, member.id)}>
                            <Avatar className="h-6 w-6 mr-2">
                              <AvatarImage src={member.avatar} />
                              <AvatarFallback className="text-xs">
                                {member.firstName?.[0]}{member.lastName?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            {member.firstName} {member.lastName}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* More Options */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => toast({ title: 'Reply', description: 'Reply composer opened' })}>
                          <Reply className="h-4 w-4 mr-2" />
                          Reply
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast({ title: 'Forward', description: 'Select a recipient to forward this message' })}>
                          <Forward className="h-4 w-4 mr-2" />
                          Forward
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => toast({ title: 'Added to favorites', description: 'Conversation marked as favorite' })}>
                          <Star className="h-4 w-4 mr-2" />
                          Add to Favorites
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast({ title: 'Tags', description: 'Tag management for conversations' })}>
                          <Tag className="h-4 w-4 mr-2" />
                          Add Tags
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-red-600 dark:text-red-400" onClick={() => {
                          if (selectedConversation) {
                            setConversations(prev => prev.filter(c => c.id !== selectedConversation.id));
                            setSelectedConversation(null);
                            toast({ title: 'Deleted', description: 'Conversation deleted' });
                          }
                        }}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Conversation
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                {isLoadingMessages ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mb-4" />
                    <p>No messages yet</p>
                    <p className="text-sm">Start the conversation</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          'flex',
                          message.senderType === 'guest' ? 'justify-start' : 'justify-end'
                        )}
                      >
                        <div
                          className={cn(
                            'max-w-[70%] rounded-lg p-3',
                            message.senderType === 'guest'
                              ? 'bg-muted'
                              : 'bg-emerald-500 text-white'
                          )}
                        >
                          {message.senderType === 'staff' && message.sender && (
                            <p className="text-xs opacity-70 mb-1">
                              {message.sender.firstName} {message.sender.lastName}
                            </p>
                          )}
                          <p className="whitespace-pre-wrap">{message.content}</p>
                          <p className={cn(
                            'text-xs mt-1',
                            message.senderType === 'guest' ? 'text-muted-foreground' : 'text-white/70'
                          )}>
                            {format(new Date(message.sentAt), 'HH:mm')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Quick Reply Templates */}
              {quickReplyTemplates.length > 0 && (
                <div className="px-4 py-2 border-t border-b bg-muted/30">
                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">Quick Replies:</span>
                    {quickReplyTemplates.slice(0, 5).map((template) => (
                      <Button
                        key={template.id}
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs whitespace-nowrap"
                        onClick={() => handleUseTemplate(template)}
                      >
                        {template.shortcut || template.name}
                      </Button>
                    ))}
                    {templates.length > 5 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setShowTemplateDialog(true)}
                      >
                        +{templates.length - 5} more
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Message Input */}
              <div className="p-4 border-t">
                {/* Rich Text Toolbar */}
                <div className="flex items-center gap-1 mb-2 pb-2 border-b">
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Bold" onClick={() => document.execCommand('bold')}>
                    <Bold className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Italic" onClick={() => document.execCommand('italic')}>
                    <Italic className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Link" onClick={() => {
                    const url = window.prompt('Enter URL:');
                    if (url) document.execCommand('createLink', false, url);
                  }}>
                    <Link2 className="h-4 w-4" />
                  </Button>
                  <Separator orientation="vertical" className="h-5 mx-1" />
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Bullet List" onClick={() => document.execCommand('insertUnorderedList')}>
                    <List className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Numbered List" onClick={() => document.execCommand('insertOrderedList')}>
                    <ListOrdered className="h-4 w-4" />
                  </Button>
                  <Separator orientation="vertical" className="h-5 mx-1" />
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Emoji" onClick={() => toast({ title: 'Emoji', description: 'Emoji picker coming soon' })}>
                    <Smile className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Attach File" onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*,.pdf,.doc,.docx';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) toast({ title: 'File attached', description: file.name });
                    };
                    input.click();
                  }}>
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Separator orientation="vertical" className="h-5 mx-1" />
                  <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        <FileText className="h-4 w-4 mr-1" />
                        Templates
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>Message Templates</DialogTitle>
                        <DialogDescription>
                          Select a template to use for your message
                        </DialogDescription>
                      </DialogHeader>
                      <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-2">
                          {templates.map((template) => (
                            <Card
                              key={template.id}
                              className="p-3 cursor-pointer hover:bg-muted/50"
                              onClick={() => handleUseTemplate(template)}
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-medium text-sm">{template.name}</p>
                                  <p className="text-xs text-muted-foreground">{template.category}</p>
                                </div>
                                <Badge variant="outline" className="text-xs">{template.channel}</Badge>
                              </div>
                              <p className="text-sm mt-2 text-muted-foreground line-clamp-2">{template.body}</p>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Input Area */}
                <div className="flex items-end gap-2">
                  <Textarea
                    placeholder="Type a message... (Press Enter to send, Shift+Enter for new line)"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-1 min-h-[60px] max-h-[150px] resize-none"
                  />
                  <Button onClick={handleSendMessage} disabled={isSending || !messageInput.trim()} className="h-[60px]">
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Inbox className="h-16 w-16 mb-4" />
              <p className="text-lg font-medium">Select a conversation</p>
              <p className="text-sm">Choose a conversation from the list to start messaging</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
