'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  MessageSquare,
  Send,
  Users,
  Hash,
  Plus,
  Loader2,
  Circle,
  CheckCheck,
  Clock,
  Search,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  jobTitle: string;
  status: string;
  avatar?: string;
}

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  timestamp: Date | string;
  type: 'user' | 'system';
  isRead: boolean;
  readBy?: string[];
  attachments?: string[];
}

interface ChatChannel {
  id: string;
  name: string;
  type: 'team' | 'direct';
  members: StaffMember[];
  lastMessage?: Message;
  unreadCount: number;
}

interface OnlineUser {
  id: string;
  username: string;
}

export default function InternalCommunication() {
  const { user } = useAuth();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelMembers, setNewChannelMembers] = useState<string[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    const socketInstance = io('/?XTransformPort=3003', {
      path: '/',
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
    });

    socketRef.current = socketInstance;

    socketInstance.on('connect', () => {
      setIsConnected(true);
      if (user) {
        socketInstance.emit('join', { 
          username: `${user.firstName} ${user.lastName}`,
          userId: user.id 
        });
      }
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
    });

    socketInstance.on('message', (msg: Message) => {
      if (activeChannel) {
        setMessages(prev => [...prev, msg]);
      }
    });

    socketInstance.on('user-joined', (data: { user: OnlineUser; message: Message }) => {
      setOnlineUsers(prev => {
        if (!prev.find(u => u.id === data.user.id)) {
          return [...prev, data.user];
        }
        return prev;
      });
    });

    socketInstance.on('user-left', (data: { user: OnlineUser; message: Message }) => {
      setOnlineUsers(prev => prev.filter(u => u.id !== data.user.id));
    });

    socketInstance.on('users-list', (data: { users: OnlineUser[] }) => {
      setOnlineUsers(data.users);
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [user]);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Fetch staff list
        const staffRes = await fetch('/api/users');
        if (staffRes.ok) {
          const staffData = await staffRes.json();
          setStaff(staffData.users || []);
        }

        // Fetch channels
        const channelsRes = await fetch('/api/staff/channels');
        if (channelsRes.ok) {
          const channelsData = await channelsRes.json();
          setChannels(channelsData.channels || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        toast.error('Failed to load communication data');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Fetch messages when channel changes
  useEffect(() => {
    const fetchMessages = async () => {
      if (!activeChannel) return;

      try {
        const res = await fetch(`/api/staff/channels/${activeChannel.id}/messages`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (error) {
        console.error('Error fetching messages:', error);
      }
    };

    fetchMessages();
  }, [activeChannel]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (!messageInput.trim() || !activeChannel || !socketRef.current || !user) return;

    const message: Message = {
      id: crypto.randomUUID(),
      content: messageInput.trim(),
      senderId: user.id,
      senderName: `${user.firstName} ${user.lastName}`,
      timestamp: new Date(),
      type: 'user',
      isRead: false,
    };

    socketRef.current.emit('message', {
      content: message.content,
      username: message.senderName,
      channelId: activeChannel.id,
    });

    setMessages(prev => [...prev, message]);
    setMessageInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const createChannel = async () => {
    if (!newChannelName.trim()) {
      toast.error('Channel name is required');
      return;
    }

    try {
      const response = await fetch('/api/staff/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newChannelName,
          type: 'team',
          memberIds: newChannelMembers,
        }),
      });

      if (!response.ok) throw new Error('Failed to create channel');

      const data = await response.json();
      setChannels(prev => [...prev, data.channel]);
      setIsCreateChannelOpen(false);
      setNewChannelName('');
      setNewChannelMembers([]);
      toast.success('Channel created successfully');
    } catch (error) {
      toast.error('Failed to create channel');
    }
  };

  const startDirectMessage = async (member: StaffMember) => {
    // Check if DM channel already exists
    const existingChannel = channels.find(
      c => c.type === 'direct' && c.members.some(m => m.id === member.id)
    );

    if (existingChannel) {
      setActiveChannel(existingChannel);
      return;
    }

    try {
      // Persist DM channel via API
      const response = await fetch('/api/staff/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${member.firstName} ${member.lastName}`,
          type: 'direct',
          memberIds: [member.id],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.channel) {
          setChannels(prev => [...prev, data.channel]);
          setActiveChannel(data.channel);
        }
      } else {
        toast.error('Failed to create conversation');
      }
    } catch (error) {
      toast.error('Failed to create conversation');
    }
  };

  const filteredStaff = useMemo(() => {
    if (!searchQuery) return staff;
    return staff.filter(s => 
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.department?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [staff, searchQuery]);

  const filteredChannels = useMemo(() => {
    if (!searchQuery) return channels;
    return channels.filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [channels, searchQuery]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatTime = (timestamp: Date | string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (timestamp: Date | string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString();
  };

  const isUserOnline = (userId: string) => {
    return onlineUsers.some(u => u.id === userId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Internal Communication</h2>
          <p className="text-muted-foreground">
            Team messaging and collaboration
            <span className={`ml-2 inline-flex items-center gap-1 text-sm ${isConnected ? 'text-green-600' : 'text-red-600 dark:text-red-400'}`}>
              <Circle className={`h-2 w-2 ${isConnected ? 'fill-green-600' : 'fill-red-600'}`} />
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </p>
        </div>
        <Button onClick={() => setIsCreateChannelOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Channel
        </Button>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-220px)]">
        {/* Sidebar - Channels & Staff */}
        <Card className="lg:col-span-1 overflow-hidden">
          <CardHeader className="pb-3">
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs defaultValue="channels">
              <TabsList className="w-full">
                <TabsTrigger value="channels" className="flex-1">
                  <Hash className="mr-2 h-4 w-4" />
                  Channels
                </TabsTrigger>
                <TabsTrigger value="staff" className="flex-1">
                  <Users className="mr-2 h-4 w-4" />
                  Staff
                </TabsTrigger>
              </TabsList>

              <TabsContent value="channels" className="m-0">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-1 p-2">
                    {filteredChannels.map((channel) => (
                      <button
                        key={channel.id}
                        onClick={() => setActiveChannel(channel)}
                        className={`w-full text-left p-3 rounded-lg hover:bg-muted transition-colors ${
                          activeChannel?.id === channel.id ? 'bg-muted' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {channel.type === 'team' ? (
                              <Hash className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {getInitials(channel.name)}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <span className="font-medium">{channel.name}</span>
                          </div>
                          {channel.unreadCount > 0 && (
                            <Badge className="h-5 w-5 p-0 flex items-center justify-center">
                              {channel.unreadCount}
                            </Badge>
                          )}
                        </div>
                        {channel.lastMessage && (
                          <p className="text-sm text-muted-foreground truncate mt-1">
                            {channel.lastMessage.content}
                          </p>
                        )}
                      </button>
                    ))}
                    {filteredChannels.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No channels found
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="staff" className="m-0">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-1 p-2">
                    {filteredStaff.map((member) => (
                      <button
                        key={member.id}
                        onClick={() => startDirectMessage(member)}
                        className="w-full text-left p-3 rounded-lg hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-sm">
                                {getInitials(`${member.firstName} ${member.lastName}`)}
                              </AvatarFallback>
                            </Avatar>
                            <span
                              className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background ${
                                isUserOnline(member.id) ? 'bg-green-500' : 'bg-gray-400'
                              }`}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">
                              {member.firstName} {member.lastName}
                            </p>
                            <p className="text-sm text-muted-foreground truncate">
                              {member.department || member.jobTitle}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                    {filteredStaff.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No staff members found
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Main Chat Area */}
        <Card className="lg:col-span-3 flex flex-col overflow-hidden">
          {activeChannel ? (
            <>
              {/* Channel Header */}
              <CardHeader className="border-b px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {activeChannel.type === 'team' ? (
                      <Hash className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-sm">
                          {getInitials(activeChannel.name)}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div>
                      <CardTitle className="text-lg">{activeChannel.name}</CardTitle>
                      {activeChannel.type === 'team' && (
                        <CardDescription>
                          {activeChannel.members.length} members
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" title="Voice call" onClick={() => toast.info('Voice call initiated')}>
                      <Phone className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Video call" onClick={() => toast.info('Video call initiated')}>
                      <Video className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title="More options" onClick={() => toast.info('Additional options')}>
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full" ref={scrollRef}>
                  <div className="p-4 space-y-4">
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-center">
                        <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-lg font-medium">No messages yet</p>
                        <p className="text-sm text-muted-foreground">
                          Start the conversation by sending a message
                        </p>
                      </div>
                    ) : (
                      messages.map((msg, index) => {
                        const showDate = index === 0 || 
                          formatDate(messages[index - 1].timestamp) !== formatDate(msg.timestamp);
                        
                        return (
                          <div key={msg.id}>
                            {showDate && (
                              <div className="flex items-center gap-4 my-4">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-xs text-muted-foreground">
                                  {formatDate(msg.timestamp)}
                                </span>
                                <div className="flex-1 h-px bg-border" />
                              </div>
                            )}
                            <div
                              className={`flex gap-3 ${
                                msg.senderId === user?.id ? 'flex-row-reverse' : ''
                              }`}
                            >
                              <Avatar className="h-8 w-8 flex-shrink-0">
                                <AvatarFallback className="text-xs">
                                  {getInitials(msg.senderName)}
                                </AvatarFallback>
                              </Avatar>
                              <div
                                className={`max-w-[70%] ${
                                  msg.senderId === user?.id
                                    ? 'bg-teal-600 text-white'
                                    : 'bg-muted'
                                } rounded-lg px-3 py-2`}
                              >
                                {msg.type === 'system' ? (
                                  <p className="text-sm italic text-center">{msg.content}</p>
                                ) : (
                                  <>
                                    <p className="text-sm">{msg.content}</p>
                                    <div
                                      className={`flex items-center gap-1 mt-1 text-xs ${
                                        msg.senderId === user?.id
                                          ? 'text-teal-100'
                                          : 'text-muted-foreground'
                                      }`}
                                    >
                                      <span>{formatTime(msg.timestamp)}</span>
                                      {msg.isRead && msg.senderId === user?.id && (
                                        <CheckCheck className="h-3 w-3" />
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </CardContent>

              {/* Message Input */}
              <div className="border-t p-4">
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" title="Attach file" onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*,.pdf,.doc,.docx';
                    input.onchange = (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (file) toast.info(`File attached: ${file.name}`);
                    };
                    input.click();
                  }}>
                    <Paperclip className="h-4 w-4" />
                  </Button>
                  <Input
                    placeholder="Type a message..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="flex-1"
                  />
                  <Button variant="ghost" size="icon" title="Emoji" onClick={() => toast.info('Emoji picker coming soon')}>
                    <Smile className="h-4 w-4" />
                  </Button>
                  <Button onClick={sendMessage} disabled={!messageInput.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm text-muted-foreground">
                  Choose a channel or start a direct message
                </p>
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Create Channel Dialog */}
      <Dialog open={isCreateChannelOpen} onOpenChange={setIsCreateChannelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Channel</DialogTitle>
            <DialogDescription>
              Create a new team channel for group discussions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="channelName">Channel Name</Label>
              <Input
                id="channelName"
                value={newChannelName}
                onChange={(e) => setNewChannelName(e.target.value)}
                placeholder="e.g., front-desk-team"
              />
            </div>
            <div className="space-y-2">
              <Label>Add Members</Label>
              <Select
                value={newChannelMembers[0] || ''}
                onValueChange={(value) => 
                  setNewChannelMembers(prev => 
                    prev.includes(value) 
                      ? prev.filter(id => id !== value)
                      : [...prev, value]
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select members" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.firstName} {s.lastName} - {s.department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {newChannelMembers.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {newChannelMembers.map((id) => {
                    const member = staff.find(s => s.id === id);
                    if (!member) return null;
                    return (
                      <Badge key={id} variant="secondary">
                        {member.firstName} {member.lastName}
                        <button
                          className="ml-1"
                          onClick={() => setNewChannelMembers(prev => prev.filter(m => m !== id))}
                        >
                          ×
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateChannelOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createChannel}>Create Channel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
