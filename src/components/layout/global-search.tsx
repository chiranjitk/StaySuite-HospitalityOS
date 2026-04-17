'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useDebounce } from '@/hooks/use-debounce';
import { useAuth } from '@/contexts/AuthContext';
import { useUIStore } from '@/store';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Calendar,
  User,
  DoorOpen,
  Building2,
  Users,
  Search,
  Loader2,
  Star,
  Crown,
  MapPin,
  Mail,
  Phone,
  Hash,
  Bed,
  Briefcase,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchResult {
  bookings: Array<{
    id: string;
    confirmationCode: string;
    guestName: string;
    status: string;
    checkIn: string;
    checkOut: string;
    roomNumber?: string;
    propertyId: string;
    propertyName: string;
  }>;
  guests: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string | null;
    phone: string | null;
    loyaltyTier: string;
    isVip: boolean;
    totalStays: number;
  }>;
  rooms: Array<{
    id: string;
    number: string;
    name: string | null;
    floor: number;
    status: string;
    roomTypeName: string;
    propertyId: string;
    propertyName: string;
  }>;
  properties: Array<{
    id: string;
    name: string;
    type: string;
    city: string;
    country: string;
    status: string;
    totalRooms: number;
  }>;
  users: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    jobTitle: string | null;
    department: string | null;
    status: string;
  }>;
}

export function GlobalSearch() {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const debouncedQuery = useDebounce(query, 300);
  const router = useRouter();
  const { user } = useAuth();
  const { commandPaletteOpen, setCommandPaletteOpen, setActiveSection } = useUIStore();

  // Keyboard shortcut to open search
  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  // Reset query when dialog closes
  React.useEffect(() => {
    if (!commandPaletteOpen) {
      setQuery('');
      setResults(null);
    }
  }, [commandPaletteOpen]);

  // Search API call
  React.useEffect(() => {
    const searchItems = async () => {
      if (!debouncedQuery.trim() || !user?.tenantId) {
        setResults(null);
        return;
      }

      setIsLoading(true);
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(debouncedQuery)}&tenantId=${user.tenantId}`
        );
        if (response.ok) {
          const data = await response.json();
          setResults(data);
        }
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    searchItems();
  }, [debouncedQuery, user?.tenantId]);

  const handleSelect = (type: string, id: string) => {
    setCommandPaletteOpen(false);
    setQuery('');
    setResults(null);

    switch (type) {
      case 'booking':
        setActiveSection('bookings-calendar');
        break;
      case 'guest':
        setActiveSection('guests-list');
        break;
      case 'room':
        setActiveSection('pms-rooms');
        break;
      case 'property':
        setActiveSection('pms-properties');
        break;
      case 'user':
        setActiveSection('admin-users');
        break;
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      confirmed: 'text-blue-500',
      checked_in: 'text-green-500',
      checked_out: 'text-gray-500',
      cancelled: 'text-red-500',
      available: 'text-green-500',
      occupied: 'text-orange-500',
      maintenance: 'text-yellow-500',
      active: 'text-green-500',
      inactive: 'text-gray-500',
    };
    return colors[status] || 'text-gray-500';
  };

  return (
    <CommandDialog
      open={commandPaletteOpen}
      onOpenChange={setCommandPaletteOpen}
      title="Global Search"
      description="Search across bookings, guests, rooms, properties, and users."
    >
      <CommandInput
        placeholder="Search bookings, guests, rooms..."
        value={query}
        onValueChange={setQuery}
      />
      <CommandList className="max-h-[400px]">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <CommandEmpty>
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <Search className="h-8 w-8 mb-2 opacity-50" />
                <p className="text-sm">No results found for "{query}"</p>
              </div>
            </CommandEmpty>

            {/* Bookings */}
            {results?.bookings && results.bookings.length > 0 && (
              <CommandGroup heading="Bookings">
                {results.bookings.map((booking) => (
                  <CommandItem
                    key={booking.id}
                    value={`booking-${booking.id}`}
                    onSelect={() => handleSelect('booking', booking.id)}
                    className="flex flex-col items-start gap-1 py-3"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{booking.confirmationCode}</span>
                      <span className={cn('text-xs ml-auto', getStatusColor(booking.status))}>
                        {booking.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground w-full">
                      <User className="h-3 w-3" />
                      <span>{booking.guestName}</span>
                      {booking.roomNumber && (
                        <>
                          <span className="mx-1">•</span>
                          <Bed className="h-3 w-3" />
                          <span>Room {booking.roomNumber}</span>
                        </>
                      )}
                      <span className="mx-1">•</span>
                      <span>
                        {formatDate(booking.checkIn)} - {formatDate(booking.checkOut)}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* Guests */}
            {results?.guests && results.guests.length > 0 && (
              <>
                {results.bookings.length > 0 && <CommandSeparator />}
                <CommandGroup heading="Guests">
                  {results.guests.map((guest) => (
                    <CommandItem
                      key={guest.id}
                      value={`guest-${guest.id}`}
                      onSelect={() => handleSelect('guest', guest.id)}
                      className="flex flex-col items-start gap-1 py-3"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {guest.firstName} {guest.lastName}
                        </span>
                        {guest.isVip && (
                          <Crown className="h-3 w-3 text-yellow-500" />
                        )}
                        <span className="text-xs ml-auto capitalize px-2 py-0.5 rounded-full bg-muted">
                          {guest.loyaltyTier}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground w-full">
                        {guest.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            <span>{guest.email}</span>
                          </div>
                        )}
                        {guest.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            <span>{guest.phone}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 ml-auto">
                          <Star className="h-3 w-3" />
                          <span>{guest.totalStays} stays</span>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {/* Rooms */}
            {results?.rooms && results.rooms.length > 0 && (
              <>
                {(results.bookings.length > 0 || results.guests.length > 0) && <CommandSeparator />}
                <CommandGroup heading="Rooms">
                  {results.rooms.map((room) => (
                    <CommandItem
                      key={room.id}
                      value={`room-${room.id}`}
                      onSelect={() => handleSelect('room', room.id)}
                      className="flex flex-col items-start gap-1 py-3"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <DoorOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Room {room.number}</span>
                        <span className={cn('text-xs ml-auto', getStatusColor(room.status))}>
                          {room.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground w-full">
                        <Hash className="h-3 w-3" />
                        <span>Floor {room.floor}</span>
                        <span className="mx-1">•</span>
                        <span>{room.roomTypeName}</span>
                        {room.name && (
                          <>
                            <span className="mx-1">•</span>
                            <span>{room.name}</span>
                          </>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {/* Properties */}
            {results?.properties && results.properties.length > 0 && (
              <>
                {(results.bookings.length > 0 || results.guests.length > 0 || results.rooms.length > 0) && <CommandSeparator />}
                <CommandGroup heading="Properties">
                  {results.properties.map((property) => (
                    <CommandItem
                      key={property.id}
                      value={`property-${property.id}`}
                      onSelect={() => handleSelect('property', property.id)}
                      className="flex flex-col items-start gap-1 py-3"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{property.name}</span>
                        <span className={cn('text-xs ml-auto', getStatusColor(property.status))}>
                          {property.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground w-full">
                        <MapPin className="h-3 w-3" />
                        <span>{property.city}, {property.country}</span>
                        <span className="mx-1">•</span>
                        <span className="capitalize">{property.type}</span>
                        <span className="mx-1">•</span>
                        <span>{property.totalRooms} rooms</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}

            {/* Users */}
            {results?.users && results.users.length > 0 && (
              <>
                {(results.bookings.length > 0 || results.guests.length > 0 || results.rooms.length > 0 || results.properties.length > 0) && <CommandSeparator />}
                <CommandGroup heading="Users">
                  {results.users.map((u) => (
                    <CommandItem
                      key={u.id}
                      value={`user-${u.id}`}
                      onSelect={() => handleSelect('user', u.id)}
                      className="flex flex-col items-start gap-1 py-3"
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">
                          {u.firstName} {u.lastName}
                        </span>
                        <span className={cn('text-xs ml-auto', getStatusColor(u.status))}>
                          {u.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground w-full">
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          <span>{u.email}</span>
                        </div>
                        {u.jobTitle && (
                          <div className="flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            <span>{u.jobTitle}</span>
                          </div>
                        )}
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </>
        )}
      </CommandList>

      {/* Footer with keyboard hints */}
      <div className="border-t px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">↑↓</kbd>
            {' '}to navigate
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">↵</kbd>
            {' '}to select
          </span>
        </div>
        <span>
          <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">esc</kbd>
          {' '}to close
        </span>
      </div>
    </CommandDialog>
  );
}
