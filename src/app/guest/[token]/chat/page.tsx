'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useGuestApp } from '../layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Send,
  Paperclip,
  Loader2,
  Check,
  CheckCheck,
  Headphones,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format, isToday, isYesterday } from 'date-fns';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  content: string;
  isFromStaff: boolean;
  sender: {
    id: string;
    name: string;
    avatar?: string;
  } | null;
  readAt?: string;
  createdAt: string;
}

interface Conversation {
  id: string;
  status: string;
  createdAt: string;
}

export default function ChatPage() {
  const { data: guestData } = useGuestApp();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');

  // Fetch messages
  const fetchMessages = async () => {
    if (!guestData) return;

    try {
      const token = window.location.pathname.split('/')[2];
      const response = await fetch(`/api/guest-app/chat?token=${token}`);
      const result = await response.json();

      if (result.success) {
        setConversation(result.data.conversation);
        setMessages(result.data.messages);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [guestData]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      const token = window.location.pathname.split('/')[2];
      const response = await fetch('/api/guest-app/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          content: newMessage.trim(),
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMessages(prev => [...prev, result.data]);
        setNewMessage('');
        inputRef.current?.focus();
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

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Format time
  const formatTime = (date: string) => {
    const d = new Date(date);
    if (isToday(d)) {
      return format(d, 'HH:mm');
    }
    if (isYesterday(d)) {
      return `Yesterday ${format(d, 'HH:mm')}`;
    }
    return format(d, 'MMM d, HH:mm');
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups: { date: string; messages: Message[] }[], message) => {
    const date = format(new Date(message.createdAt), 'yyyy-MM-dd');
    const existingGroup = groups.find(g => g.date === date);
    if (existingGroup) {
      existingGroup.messages.push(message);
    } else {
      groups.push({ date, messages: [message] });
    }
    return groups;
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-[calc(100vh-180px)]">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16 mt-1" />
            </div>
          </div>
        </div>
        <div className="flex-1 p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className={cn('flex', i % 2 === 0 ? 'justify-start' : 'justify-end')}>
              <Skeleton className={cn('h-12 rounded-2xl', i % 2 === 0 ? 'w-48' : 'w-32')} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)]">
      {/* Chat Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="w-10 h-10">
              <AvatarImage src="" />
              <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
                <Headphones className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-slate-900" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Front Desk</h3>
            <p className="text-xs text-emerald-600 dark:text-emerald-400">
              {conversation?.status === 'open' ? 'Online' : 'Away'}
            </p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
              <Headphones className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="font-medium mb-1">Start a Conversation</p>
            <p className="text-sm max-w-xs">
              Need assistance? Send a message to the front desk and we'll respond as soon as possible.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedMessages.map((group) => (
              <div key={group.date}>
                {/* Date Divider */}
                <div className="flex items-center justify-center mb-4">
                  <span className="text-xs text-muted-foreground bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
                    {format(new Date(group.date), isToday(new Date(group.date)) ? "'Today'" : isYesterday(new Date(group.date)) ? "'Yesterday'" : 'MMM d, yyyy')}
                  </span>
                </div>

                {/* Messages */}
                <div className="space-y-3">
                  {group.messages.map((message, index) => {
                    const isGuest = !message.isFromStaff;
                    const showAvatar = !isGuest && (index === 0 || group.messages[index - 1].isFromStaff !== message.isFromStaff);

                    return (
                      <div
                        key={message.id}
                        className={cn('flex gap-2', isGuest ? 'justify-end' : 'justify-start')}
                      >
                        {/* Avatar */}
                        {!isGuest && showAvatar && (
                          <Avatar className="w-8 h-8 mt-1">
                            <AvatarImage src={message.sender?.avatar} />
                            <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white text-xs">
                              {message.sender?.name?.charAt(0) || 'S'}
                            </AvatarFallback>
                          </Avatar>
                        )}
                        {!isGuest && !showAvatar && <div className="w-8" />}

                        {/* Message Bubble */}
                        <div
                          className={cn(
                            'max-w-[75%] rounded-2xl px-4 py-2',
                            isGuest
                              ? 'bg-sky-500 text-white rounded-br-md'
                              : 'bg-slate-100 dark:bg-slate-800 rounded-bl-md'
                          )}
                        >
                          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                          <div
                            className={cn(
                              'flex items-center justify-end gap-1 mt-1',
                              isGuest ? 'text-sky-100' : 'text-muted-foreground'
                            )}
                          >
                            <span className="text-[10px]">
                              {formatTime(message.createdAt)}
                            </span>
                            {isGuest && (
                              message.readAt ? (
                                <CheckCheck className="h-3 w-3" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            ref={inputRef}
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || isSending}
            size="icon"
            className="shrink-0 bg-sky-500 hover:bg-sky-600"
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Typical response time: under 5 minutes
        </p>
      </div>
    </div>
  );
}
