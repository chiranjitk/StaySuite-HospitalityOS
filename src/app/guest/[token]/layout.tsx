'use client';

import React, { useState, useEffect, createContext, useContext } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import {
  Home,
  ConciergeBell,
  MessageCircle,
  Key,
  User,
  FileText,
  Star,
  Moon,
  Sun,
  Phone,
  MapPin,
  Clock,
} from 'lucide-react';

// Guest App Context
interface GuestAppContextType {
  data: GuestAppData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const GuestAppContext = createContext<GuestAppContextType>({
  data: null,
  isLoading: true,
  error: null,
  refetch: async () => {},
});

export const useGuestApp = () => useContext(GuestAppContext);

// Types
interface GuestAppData {
  booking: {
    id: string;
    confirmationCode: string;
    status: string;
    checkIn: string;
    checkOut: string;
    checkInTime: string;
    checkOutTime: string;
    adults: number;
    children: number;
    infants: number;
    totalNights: number;
    nightsRemaining: number;
    specialRequests?: string;
  };
  guest: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    nationality?: string;
    loyaltyTier: string;
    loyaltyPoints: number;
    isVip: boolean;
    preferences: Record<string, unknown>;
  };
  room: {
    id: string;
    number: string;
    floor: number;
    status: string;
    digitalKeyEnabled: boolean;
    digitalKeySecret?: string;
  } | null;
  roomType: {
    id: string;
    name: string;
    description?: string;
    amenities: string[];
    basePrice: number;
  };
  property: {
    id: string;
    name: string;
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
    address: string;
    city: string;
    country: string;
    phone?: string;
    email?: string;
    timezone: string;
    currency: string;
  };
  bill: {
    totalCharges: number;
    totalPaid: number;
    balanceDue: number;
    currency: string;
    recentCharges: Array<{
      id: string;
      description: string;
      category: string;
      amount: number;
      date: string;
    }>;
  };
  recentRequests: Array<{
    id: string;
    type: string;
    subject: string;
    status: string;
    createdAt: string;
  }>;
  additionalGuests: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  }>;
}

// Navigation Items
const navItems = [
  { href: '', label: 'Home', icon: Home },
  { href: '/services', label: 'Services', icon: ConciergeBell },
  { href: '/chat', label: 'Chat', icon: MessageCircle },
  { href: '/key', label: 'Key', icon: Key },
  { href: '/feedback', label: 'Feedback', icon: Star },
];

export default function GuestAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const token = params.token as string;

  const [data, setData] = useState<GuestAppData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  // Fetch guest app data
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/guest-app?token=${token}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error?.message || 'Failed to load');
      }
    } catch (err) {
      console.error('Error fetching guest app data:', err);
      setError('Failed to load guest data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  // Dark mode toggle
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Check system preference for dark mode
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setDarkMode(mediaQuery.matches);
  }, []);

  // Get current nav item
  const currentPath = pathname.replace(`/guest/${token}`, '') || '';
  const isActive = (href: string) => currentPath === href;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
        <div className="w-full max-w-md p-4 space-y-4">
          <Skeleton className="h-20 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
            <Key className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Unable to Access</h2>
          <p className="text-muted-foreground text-sm mb-4">
            {error || 'Invalid or expired access link'}
          </p>
          <button
            onClick={fetchData}
            className="text-primary text-sm underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <GuestAppContext.Provider value={{ data, isLoading, error, refetch: fetchData }}>
      <div
        className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20"
        style={{
          '--property-primary': data.property.primaryColor || '#0ea5e9',
          '--property-secondary': data.property.secondaryColor || '#6366f1',
        } as React.CSSProperties}
      >
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              {/* Property Info */}
              <div className="flex items-center gap-3">
                {data.property.logo ? (
                  <img
                    src={data.property.logo}
                    alt={data.property.name}
                    className="w-8 h-8 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                    {data.property.name.charAt(0)}
                  </div>
                )}
                <div>
                  <h1 className="font-semibold text-sm">{data.property.name}</h1>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Room {data.room?.number || 'TBD'}</span>
                    {data.room && (
                      <>
                        <span>•</span>
                        <span>Floor {data.room.floor}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDarkMode(!darkMode)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  {darkMode ? (
                    <Sun className="h-5 w-5 text-amber-500" />
                  ) : (
                    <Moon className="h-5 w-5 text-slate-600" />
                  )}
                </button>
                <button
                  onClick={() => router.push(`/guest/${token}/profile`)}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white text-sm font-medium"
                >
                  {data.guest.firstName.charAt(0)}
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-lg mx-auto">
          {children}
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 safe-area-inset-bottom">
          <div className="max-w-lg mx-auto px-2">
            <div className="flex items-center justify-around py-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <button
                    key={item.href}
                    onClick={() => router.push(`/guest/${token}${item.href}`)}
                    className={cn(
                      'flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-colors min-w-[60px]',
                      active
                        ? 'text-sky-500 dark:text-sky-400'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                    )}
                  >
                    <Icon className={cn('h-5 w-5', active && 'stroke-[2.5px]')} />
                    <span className="text-[10px] font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Quick Actions FAB */}
        <div className="fixed bottom-24 right-4 z-40">
          <div className="flex flex-col gap-2">
            <button
              onClick={() => router.push(`/guest/${token}/bill`)}
              className="w-12 h-12 rounded-full bg-white dark:bg-slate-800 shadow-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              <FileText className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </button>
            {data.property.phone && (
              <a
                href={`tel:${data.property.phone}`}
                className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg flex items-center justify-center hover:opacity-90 transition-opacity"
              >
                <Phone className="h-5 w-5 text-white" />
              </a>
            )}
          </div>
        </div>
      </div>
    </GuestAppContext.Provider>
  );
}

// Safe area for iOS
const styles = `
  .safe-area-inset-bottom {
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
`;

if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.innerText = styles;
  document.head.appendChild(styleSheet);
}
