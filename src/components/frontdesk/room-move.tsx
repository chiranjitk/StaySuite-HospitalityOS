'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowRightLeft,
  Search,
  Loader2,
  Building2,
  BedDouble,
  ArrowUpCircle,
  ArrowDownCircle,
  MinusCircle,
  Layers,
  Wifi,
  Car,
  Waves,
  Mountain,
  Eye,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useTimezone } from '@/contexts/TimezoneContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface Room {
  id: string;
  number: string;
  floor: number;
  status: string;
  housekeepingStatus: string;
  roomTypeId: string;
  isSmoking: boolean;
  hasBalcony: boolean;
  hasSeaView: boolean;
  hasMountainView: boolean;
  isAccessible: boolean;
  roomType: {
    id: string;
    name: string;
    code: string;
    basePrice: number;
    currency: string;
    amenities: string;
  };
}

interface Booking {
  id: string;
  confirmationCode: string;
  status: string;
  checkIn: string;
  checkOut: string;
  roomRate: number;
  currency: string;
  primaryGuest: {
    id: string;
    firstName: string;
    lastName: string;
  };
  room: {
    id: string;
    number: string;
    floor: number;
  } | null;
  roomType: {
    id: string;
    name: string;
    code: string;
    basePrice: number;
  };
  property: {
    id: string;
    name: string;
  };
}

interface MoveHistoryEntry {
  id: string;
  fromRoomNumber: string;
  toRoomNumber: string;
  reason: string;
  reasonDisplay: string;
  previousRate: number;
  newRate: number;
  rateDifference: number;
  rateChangeDisplay: string;
  isUpgrade: boolean;
  isDowngrade: boolean;
  notes: string | null;
  movedBy: string | null;
  createdAt: string;
  property: {
    id: string;
    name: string;
  };
}

const REASON_OPTIONS = [
  { value: 'guest_request', label: 'Guest Request', icon: User },
  { value: 'maintenance', label: 'Maintenance Issue', icon: AlertCircle },
  { value: 'upgrade', label: 'Complimentary Upgrade', icon: ArrowUpCircle },
  { value: 'availability', label: 'Availability Issue', icon: BedDouble },
  { value: 'other', label: 'Other', icon: ArrowRightLeft },
];

export default function RoomMove() {
  const { toast } = useToast();
  const { formatDate, formatDateTime } = useTimezone();
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Booking[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [selectedToRoom, setSelectedToRoom] = useState<Room | null>(null);

  const [reason, setReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [moveHistory, setMoveHistory] = useState<MoveHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Search checked-in bookings
  const searchBookings = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        status: 'checked_in',
        search: searchQuery.trim(),
        limit: '10',
      });
      const response = await fetch(`/api/bookings?${params}`);
      const result = await response.json();
      if (result.success) {
        setSearchResults(result.data || []);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to search bookings', variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) searchBookings();
      else setSearchResults([]);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Select booking & fetch data
  const selectBooking = async (booking: Booking) => {
    setSelectedBooking(booking);
    setSearchResults([]);
    setSelectedToRoom(null);
    setReason('');
    setNotes('');

    // Fetch available rooms for the same property and room type
    fetchAvailableRooms(booking.property.id);
    // Fetch move history
    fetchMoveHistory(booking.id);
  };

  const fetchAvailableRooms = async (propertyId: string) => {
    setIsLoadingRooms(true);
    try {
      const response = await fetch(`/api/rooms?propertyId=${propertyId}&status=available&limit=50`);
      const result = await response.json();
      if (result.success) {
        setAvailableRooms(result.data || []);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch available rooms', variant: 'destructive' });
    } finally {
      setIsLoadingRooms(false);
    }
  };

  const fetchMoveHistory = async (bookingId: string) => {
    setIsLoadingHistory(true);
    try {
      const response = await fetch(`/api/bookings/room-move/history?bookingId=${bookingId}`);
      const result = await response.json();
      if (result.success) {
        setMoveHistory(result.data || []);
      }
    } catch {
      // No history or error
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Process room move
  const processMove = async () => {
    if (!selectedBooking || !selectedToRoom || !reason) return;

    setIsProcessing(true);
    try {
      const response = await fetch('/api/bookings/room-move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: selectedBooking.id,
          fromRoomId: selectedBooking.room?.id,
          toRoomId: selectedToRoom.id,
          reason,
          notes: notes || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Room Moved Successfully',
          description: `Guest moved to Room ${result.data.roomNumber} (${result.data.roomType})`,
        });
        setShowConfirm(false);
        setSelectedToRoom(null);
        setReason('');
        setNotes('');
        // Refresh
        selectBooking({ ...selectedBooking, room: { id: selectedToRoom.id, number: result.data.roomNumber, floor: selectedToRoom.floor } } as Booking);
      } else {
        toast({
          title: 'Move Failed',
          description: result.error?.message || 'Failed to move room',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to process room move', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
    }
  };

  // Get amenity icons
  const getAmenityIcon = (amenity: string) => {
    const a = amenity.toLowerCase();
    if (a.includes('wifi') || a.includes('internet')) return <Wifi className="h-3 w-3" />;
    if (a.includes('parking') || a.includes('car')) return <Car className="h-3 w-3" />;
    if (a.includes('pool') || a.includes('swim')) return <Waves className="h-3 w-3" />;
    if (a.includes('view') || a.includes('mountain')) return <Mountain className="h-3 w-3" />;
    return null;
  };

  const fromRoomRate = selectedBooking?.roomType?.basePrice || 0;
  const toRoomRate = selectedToRoom?.roomType?.basePrice || 0;
  const rateDiff = toRoomRate - fromRoomRate;

  const selectedReason = REASON_OPTIONS.find(r => r.value === reason);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Room Move / Transfer
          </h2>
          <p className="text-sm text-muted-foreground">
            Move checked-in guests to different rooms during their stay
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by confirmation code or guest name (checked-in guests)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="mt-3 border rounded-lg shadow-lg max-h-[250px] overflow-y-auto">
              {searchResults.map((booking) => (
                <button
                  key={booking.id}
                  onClick={() => selectBooking(booking)}
                  className="w-full text-left p-3 hover:bg-muted/50 transition-colors border-b last:border-b-0"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {booking.primaryGuest.firstName} {booking.primaryGuest.lastName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {booking.confirmationCode} · Room {booking.room?.number || 'TBD'}
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {booking.roomType.name}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Room Move Interface */}
      {selectedBooking && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Current Room & Move Target */}
          <div className="space-y-6">
            {/* Current Room */}
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  Current Room
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-3xl font-bold text-primary">{selectedBooking.room?.number || 'TBD'}</p>
                    <p className="text-sm text-muted-foreground">{selectedBooking.roomType.name}</p>
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-1">
                      <Layers className="h-3 w-3 text-muted-foreground" />
                      <span>Floor {selectedBooking.room?.floor || '-'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground" />
                      <span>{selectedBooking.primaryGuest.firstName} {selectedBooking.primaryGuest.lastName}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span>Rate: {formatCurrency(selectedBooking.roomRate)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Target Room Selection */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4" />
                  Move To Room
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Room list */}
                {isLoadingRooms ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : availableRooms.length === 0 ? (
                  <div className="p-6 text-center text-muted-foreground">
                    <BedDouble className="h-8 w-8 mx-auto mb-2" />
                    <p>No available rooms found</p>
                  </div>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                    {availableRooms.map(room => (
                      <motion.button
                        key={room.id}
                        onClick={() => setSelectedToRoom(room)}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className={cn(
                          "w-full text-left p-3 rounded-lg border-2 transition-colors",
                          selectedToRoom?.id === room.id
                            ? "border-primary bg-primary/5"
                            : "border-transparent bg-muted/30 hover:bg-muted/60"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-lg">{room.number}</p>
                            <p className="text-sm text-muted-foreground">{room.roomType.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(room.roomType.basePrice)}</p>
                            <p className="text-xs text-muted-foreground">Floor {room.floor}</p>
                          </div>
                        </div>
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {room.roomType.amenities && JSON.parse(room.roomType.amenities).slice(0, 5).map((amenity: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-[10px] h-5 gap-0.5">
                              {getAmenityIcon(amenity)}
                              {amenity}
                            </Badge>
                          ))}
                          {room.hasBalcony && <Badge variant="outline" className="text-[10px] h-5">Balcony</Badge>}
                          {room.hasSeaView && <Badge variant="outline" className="text-[10px] h-5">Sea View</Badge>}
                          {room.isAccessible && <Badge variant="outline" className="text-[10px] h-5">Accessible</Badge>}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                )}

                {/* Selected room comparison */}
                {selectedToRoom && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <h4 className="text-sm font-medium mb-2">Room Comparison</h4>
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">From</p>
                          <p className="font-bold">{selectedBooking.room?.number}</p>
                          <p className="text-xs text-muted-foreground">{selectedBooking.roomType.name}</p>
                        </div>
                        <div className="flex items-center justify-center">
                          <ArrowRightLeft className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">To</p>
                          <p className="font-bold">{selectedToRoom.number}</p>
                          <p className="text-xs text-muted-foreground">{selectedToRoom.roomType.name}</p>
                        </div>
                      </div>
                    </div>

                    {/* Rate Difference */}
                    <div className={cn(
                      "p-4 rounded-lg border",
                      rateDiff > 0
                        ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                        : rateDiff < 0
                          ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
                          : "bg-muted"
                    )}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {rateDiff > 0 ? (
                            <ArrowUpCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                          ) : rateDiff < 0 ? (
                            <ArrowDownCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                          ) : (
                            <MinusCircle className="h-5 w-5 text-muted-foreground" />
                          )}
                          <div>
                            <p className="text-sm font-medium">
                              {rateDiff > 0 ? 'Upgrade' : rateDiff < 0 ? 'Downgrade' : 'Same Rate'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatCurrency(fromRoomRate)} → {formatCurrency(toRoomRate)}
                            </p>
                          </div>
                        </div>
                        <p className={cn(
                          "text-lg font-bold",
                          rateDiff > 0 && "text-green-600 dark:text-green-400",
                          rateDiff < 0 && "text-red-600 dark:text-red-400",
                        )}>
                          {rateDiff >= 0 ? '+' : ''}{formatCurrency(rateDiff)}/night
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Move Details & History */}
          <div className="space-y-6">
            {/* Move Details */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Move Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Reason</Label>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select reason for move" />
                    </SelectTrigger>
                    <SelectContent>
                      {REASON_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <span className="flex items-center gap-2">
                            <opt.icon className="h-4 w-4" />
                            {opt.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Additional notes about this room move..."
                    rows={3}
                  />
                </div>

                {/* Validation warnings */}
                {selectedToRoom && selectedToRoom.housekeepingStatus !== 'clean' && (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Target room status: {selectedToRoom.housekeepingStatus}. Housekeeping may be needed.</span>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={() => setShowConfirm(true)}
                  disabled={!selectedToRoom || !reason}
                >
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Move to Room {selectedToRoom?.number}
                </Button>
              </CardContent>
            </Card>

            {/* Move History */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Move History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoadingHistory ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : moveHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No room moves recorded for this booking
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>From</TableHead>
                        <TableHead>To</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-right">Rate Δ</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {moveHistory.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-mono">{entry.fromRoomNumber}</TableCell>
                          <TableCell className="font-mono font-medium">{entry.toRoomNumber}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {entry.reasonDisplay}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className={cn(
                              "font-medium",
                              entry.isUpgrade && "text-green-600 dark:text-green-400",
                              entry.isDowngrade && "text-red-600 dark:text-red-400",
                            )}>
                              {entry.rateChangeDisplay}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDateTime(entry.createdAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!selectedBooking && searchResults.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ArrowRightLeft className="h-12 w-12 mb-4" />
            <p className="text-lg font-medium">Search for a Checked-In Guest</p>
            <p className="text-sm">Find a checked-in booking to initiate a room move</p>
          </CardContent>
        </Card>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Confirm Room Move
            </DialogTitle>
            <DialogDescription>
              Please review the room move details below
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Move Summary */}
            <div className="p-4 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Guest</span>
                <span className="font-medium">{selectedBooking?.primaryGuest.firstName} {selectedBooking?.primaryGuest.lastName}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Booking</span>
                <span className="font-mono">{selectedBooking?.confirmationCode}</span>
              </div>
              <div className="flex items-center justify-center gap-4 py-2">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">From</p>
                  <p className="text-xl font-bold">{selectedBooking?.room?.number}</p>
                  <p className="text-xs">{selectedBooking?.roomType.name}</p>
                </div>
                <ArrowRightLeft className="h-6 w-6 text-primary" />
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">To</p>
                  <p className="text-xl font-bold text-primary">{selectedToRoom?.number}</p>
                  <p className="text-xs">{selectedToRoom?.roomType.name}</p>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Reason</span>
                <span className="font-medium">{selectedReason?.label}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Rate Change</span>
                <span className={cn(
                  "font-bold",
                  rateDiff > 0 && "text-green-600",
                  rateDiff < 0 && "text-red-600",
                )}>
                  {rateDiff >= 0 ? '+' : ''}{formatCurrency(rateDiff)}/night
                </span>
              </div>
            </div>

            {notes && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <p className="text-muted-foreground">Notes:</p>
                <p>{notes}</p>
              </div>
            )}

            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>This action cannot be easily undone. The previous room will be marked for housekeeping.</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button onClick={processMove} disabled={isProcessing}>
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Moving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirm Move
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
