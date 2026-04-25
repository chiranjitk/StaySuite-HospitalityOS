'use client';

import React from 'react';
import { 
  CalendarPlus, 
  LogIn, 
  LogOut, 
  Users, 
  CreditCard, 
  Sparkles, 
  Wifi,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store';
import { motion } from 'framer-motion';

const quickActions = [
  { label: 'New Booking', icon: CalendarPlus, gradient: 'from-emerald-400 to-emerald-600', tooltip: 'Create a new room reservation', section: 'bookings-calendar' },
  { label: 'Check In', icon: LogIn, gradient: 'from-teal-400 to-teal-600', tooltip: 'Process a guest arrival', section: 'frontdesk-checkin' },
  { label: 'Check Out', icon: LogOut, gradient: 'from-amber-400 to-orange-500', tooltip: 'Process a guest departure', section: 'frontdesk-checkout' },
  { label: 'New Guest', icon: Users, gradient: 'from-violet-400 to-purple-500', tooltip: 'Add a new guest profile', section: 'guests-list' },
  { label: 'Payment', icon: CreditCard, gradient: 'from-pink-400 to-rose-500', tooltip: 'Record a payment transaction', section: 'billing-payments' },
  { label: 'Service', icon: Sparkles, gradient: 'from-cyan-400 to-sky-500', tooltip: 'Submit a service request', section: 'experience-requests' },
  { label: 'Message', icon: MessageSquare, gradient: 'from-orange-400 to-amber-500', tooltip: 'Send a guest message', section: 'experience-chat' },
  { label: 'WiFi Pass', icon: Wifi, gradient: 'from-emerald-400 to-cyan-500', tooltip: 'Generate a WiFi voucher', section: 'wifi-vouchers' },
];

export function QuickActions() {
  const { setActiveSection } = useUIStore();

  return (
    <div className="relative">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick Actions</h3>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {quickActions.map((action, i) => (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
            whileHover={{ y: -3, scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => setActiveSection(action.section)}
            className={cn(
              "group/action relative flex flex-col items-center gap-2 py-3 px-1 rounded-xl",
              "cursor-pointer transition-all duration-200",
              "hover:bg-muted/60 active:bg-muted/80"
            )}
            title={action.tooltip}
          >
            {/* Icon with gradient */}
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center shadow-sm",
              "bg-gradient-to-br transition-all duration-300",
              "group-hover/action:shadow-md group-hover/action:scale-110",
              action.gradient
            )}>
              <action.icon className="h-4.5 w-4.5 text-white" />
            </div>
            {/* Label */}
            <span className="text-[11px] font-medium text-muted-foreground group-hover/action:text-foreground transition-colors text-center leading-tight">
              {action.label}
            </span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
