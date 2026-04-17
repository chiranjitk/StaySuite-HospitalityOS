'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CalendarPlus, 
  LogIn, 
  LogOut, 
  Users, 
  CreditCard, 
  Sparkles, 
  Wifi,
  MessageSquare,
  FileText,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';
import { useToast } from '@/hooks/use-toast';

const quickActions = [
  { label: 'New Booking', icon: CalendarPlus, gradient: 'from-emerald-400 to-emerald-600', tooltip: 'Create a new room reservation', section: 'bookings-calendar' },
  { label: 'Check In', icon: LogIn, gradient: 'from-teal-400 to-teal-600', tooltip: 'Process a guest arrival', section: 'frontdesk-checkin' },
  { label: 'Check Out', icon: LogOut, gradient: 'from-amber-400 to-amber-600', tooltip: 'Process a guest departure', section: 'frontdesk-checkout' },
  { label: 'New Guest', icon: Users, gradient: 'from-violet-400 to-violet-600', tooltip: 'Add a new guest profile', section: 'guests-list' },
  { label: 'Payment', icon: CreditCard, gradient: 'from-pink-400 to-pink-600', tooltip: 'Record a payment transaction', section: 'billing-payments' },
  { label: 'Service', icon: Sparkles, gradient: 'from-cyan-400 to-cyan-600', tooltip: 'Submit a service request', section: 'experience-requests' },
  { label: 'Message', icon: MessageSquare, gradient: 'from-rose-400 to-rose-600', tooltip: 'Send a guest message', section: 'experience-chat' },
  { label: 'WiFi Pass', icon: Wifi, gradient: 'from-sky-400 to-sky-600', tooltip: 'Generate a WiFi voucher', section: 'wifi-vouchers' },
];

export function QuickActions() {
  const { setActiveSection } = useUIStore();
  const { toast } = useToast();

  return (
    <>
      {/* Embedded keyframes for button hover glow */}
      <style>{`
        @keyframes subtleGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.1); }
          50% { box-shadow: 0 0 8px 2px rgba(99, 102, 241, 0.08); }
        }
      `}</style>
      <Card className="border-0 shadow-sm rounded-2xl">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
            <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 rounded-lg" onClick={() => toast({ title: 'Customize', description: 'Quick action customization coming soon' })}>
              Customize
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {quickActions.map((action) => (
              <div key={action.label} className="relative group/action">
                {/* Tooltip */}
                <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-50 px-2.5 py-1 bg-popover text-popover-foreground text-[10px] font-medium rounded-md shadow-lg border opacity-0 group-hover/action:opacity-100 pointer-events-none transition-all duration-200 whitespace-nowrap">
                  {action.tooltip}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-popover border-r border-b rotate-45" />
                </div>
                <Button
                  variant="outline"
                  className={cn(
                    "h-auto flex-col gap-2.5 py-3.5 px-2 w-full",
                    "border border-border/40 bg-muted/20",
                    "hover:bg-muted/50 hover:shadow-lg hover:shadow-muted/20 hover:-translate-y-1 hover:border-border/60",
                    "active:scale-95 active:translate-y-0",
                    "transition-all duration-200 rounded-xl"
                  )}
                  onClick={() => setActiveSection(action.section)}
                >
                  <div className={cn(
                    "rounded-lg p-2.5 shadow-sm",
                    "bg-gradient-to-br transition-all duration-200",
                    "group-hover/action:shadow-md group-hover/action:scale-110",
                    action.gradient
                  )}>
                    <action.icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[11px] font-medium group-hover/action:text-foreground transition-colors">{action.label}</span>
                  </div>
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
