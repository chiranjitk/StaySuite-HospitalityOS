'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Calendar as CalendarIcon,
  Users,
  ChevronRight,
  Loader2,
  CheckCircle,
  Hotel,
  Star,
  Wifi,
  Coffee,
  Car,
  Utensils,
  Clock,
  Shield,
  CreditCard,
} from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { toast } from 'sonner';

interface RoomType {
  id: string;
  name: string;
  code: string;
  description: string | null;
  maxAdults: number;
  maxChildren: number;
  maxOccupancy: number;
  sizeSqMeters: number | null;
  amenities: string[];
  images: string[];
  basePrice: number;
  currency: string;
}

interface AvailabilityItem {
  roomType: RoomType;
  availability: {
    totalRooms: number;
    availableRooms: number;
    bookedRooms: number;
    lockedRooms: number;
    isAvailable: boolean;
  };
  pricing: {
    nights: number;
    pricePerNight: number;
    totalPrice: number;
    currency: string;
    ratePlan: {
      id: string;
      name: string;
      mealPlan: string;
      cancellationPolicy: string | null;
    } | null;
  };
  fitsCapacity: boolean;
}

interface SearchCriteria {
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  nights: number;
}

interface BookingConfirmation {
  success: boolean;
  booking: {
    id: string;
    confirmationCode: string;
    checkIn: string;
    checkOut: string;
    adults: number;
    children: number;
    totalAmount: number;
    currency: string;
    status: string;
    room: {
      number: string | null;
      type: string | null;
    };
    guest: {
      firstName: string;
      lastName: string;
      email: string;
    };
    portalToken: string;
    portalUrl: string;
  };
  pricing: {
    nights: number;
    pricePerNight: number;
    roomRate: number;
    taxes: number;
    totalAmount: number;
    mealPlan: string;
    cancellationPolicy: string | null;
  };
}

export default function PublicBookingPage() {
  // Search state
  const [checkIn, setCheckIn] = useState<Date>(addDays(new Date(), 1));
  const [checkOut, setCheckOut] = useState<Date>(addDays(new Date(), 2));
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  
  // Data state
  const [availability, setAvailability] = useState<AvailabilityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  
  // Booking state
  const [selectedRoom, setSelectedRoom] = useState<AvailabilityItem | null>(null);
  const [bookingDialog, setBookingDialog] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<BookingConfirmation | null>(null);
  
  // Guest details form
  const [guestForm, setGuestForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    specialRequests: '',
  });

  const propertyId = 'demo-property-id'; // In production, this would come from URL/hostname

  const searchAvailability = async () => {
    if (!checkIn || !checkOut) {
      toast.error('Please select check-in and check-out dates');
      return;
    }

    if (checkIn >= checkOut) {
      toast.error('Check-out must be after check-in');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({
        propertyId,
        checkIn: checkIn.toISOString(),
        checkOut: checkOut.toISOString(),
        adults: adults.toString(),
        children: children.toString(),
      });

      const response = await fetch(`/api/booking-engine/availability?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to search availability');
      
      const data = await response.json();
      setAvailability(data.availability);
      setSearched(true);
    } catch (error) {
      console.error('Error searching availability:', error);
      toast.error('Failed to search availability. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBooking = async () => {
    if (!selectedRoom) return;

    if (!guestForm.firstName || !guestForm.lastName || !guestForm.email) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/booking-engine/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          roomTypeId: selectedRoom.roomType.id,
          ratePlanId: selectedRoom.pricing.ratePlan?.id,
          checkIn: checkIn.toISOString(),
          checkOut: checkOut.toISOString(),
          adults,
          children,
          infants: 0,
          guestDetails: {
            firstName: guestForm.firstName,
            lastName: guestForm.lastName,
            email: guestForm.email,
            phone: guestForm.phone,
          },
          specialRequests: guestForm.specialRequests,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create booking');
      }

      const data = await response.json();
      setConfirmation(data);
      setBookingDialog(false);
      toast.success('Booking confirmed!');
    } catch (error) {
      console.error('Error creating booking:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create booking');
    } finally {
      setSubmitting(false);
    }
  };

  const getAmenityIcon = (amenity: string) => {
    const iconMap: Record<string, React.ReactNode> = {
      'wifi': <Wifi className="h-4 w-4" />,
      'breakfast': <Coffee className="h-4 w-4" />,
      'parking': <Car className="h-4 w-4" />,
      'restaurant': <Utensils className="h-4 w-4" />,
    };
    return iconMap[amenity.toLowerCase()] || null;
  };

  const getMealPlanLabel = (mealPlan: string) => {
    const labels: Record<string, string> = {
      'room_only': 'Room Only',
      'breakfast': 'Breakfast Included',
      'half_board': 'Half Board',
      'full_board': 'Full Board',
      'all_inclusive': 'All Inclusive',
    };
    return labels[mealPlan] || mealPlan;
  };

  // Reset booking dialog state
  const resetBooking = () => {
    setSelectedRoom(null);
    setBookingDialog(false);
    setGuestForm({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      specialRequests: '',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50 to-white">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Hotel className="h-8 w-8 text-teal-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Grand Hotel</h1>
                <p className="text-sm text-muted-foreground">Book your perfect stay</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Shield className="h-4 w-4" />
              Secure Booking
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Search Box */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Find Your Perfect Room</CardTitle>
            <CardDescription>
              Select your dates and number of guests to see available rooms
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              {/* Check-in */}
              <div className="space-y-2">
                <Label>Check-in</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {checkIn ? format(checkIn, 'MMM dd, yyyy') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={checkIn}
                      onSelect={(date) => date && setCheckIn(date)}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Check-out */}
              <div className="space-y-2">
                <Label>Check-out</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {checkOut ? format(checkOut, 'MMM dd, yyyy') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={checkOut}
                      onSelect={(date) => date && setCheckOut(date)}
                      disabled={(date) => date <= checkIn}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Adults */}
              <div className="space-y-2">
                <Label>Adults</Label>
                <Select value={adults.toString()} onValueChange={(v) => setAdults(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n} Adult{n > 1 ? 's' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Children */}
              <div className="space-y-2">
                <Label>Children</Label>
                <Select value={children.toString()} onValueChange={(v) => setChildren(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4].map((n) => (
                      <SelectItem key={n} value={n.toString()}>
                        {n} Child{n !== 1 ? 'ren' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search Button */}
              <div className="space-y-2 flex items-end">
                <Button
                  className="w-full bg-teal-600 hover:bg-teal-700"
                  onClick={searchAvailability}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Users className="h-4 w-4 mr-2" />
                  )}
                  Search
                </Button>
              </div>
            </div>

            {/* Search Summary */}
            <div className="mt-4 flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                <Clock className="h-4 w-4 inline mr-1" />
                {checkIn && checkOut && `${differenceInDays(checkOut, checkIn)} night${differenceInDays(checkOut, checkIn) > 1 ? 's' : ''}`}
              </span>
              <span>
                <Users className="h-4 w-4 inline mr-1" />
                {adults + children} guest{(adults + children) > 1 ? 's' : ''}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {searched && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Available Rooms</h2>
              <Badge variant="secondary">
                {availability.filter(a => a.availability.isAvailable).length} room types available
              </Badge>
            </div>

            {availability.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground">No rooms available for the selected dates.</p>
              </Card>
            ) : (
              <div className="grid gap-6">
                {availability.map((item) => (
                  <Card key={item.roomType.id} className={item.availability.isAvailable ? '' : 'opacity-60'}>
                    <CardContent className="p-0">
                      <div className="flex flex-col md:flex-row">
                        {/* Room Image */}
                        <div className="md:w-64 h-48 md:h-auto bg-gray-200 relative">
                          <img
                            src={item.roomType.images?.[0] || '/placeholder-room.jpg'}
                            alt={item.roomType.name}
                            className="w-full h-full object-cover"
                          />
                          {item.availability.availableRooms <= 2 && item.availability.isAvailable && (
                            <Badge className="absolute top-2 left-2 bg-orange-500">
                              Only {item.availability.availableRooms} left!
                            </Badge>
                          )}
                        </div>

                        {/* Room Details */}
                        <div className="flex-1 p-6">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="text-lg font-semibold">{item.roomType.name}</h3>
                              {item.roomType.sizeSqMeters && (
                                <p className="text-sm text-muted-foreground">
                                  {item.roomType.sizeSqMeters} m²
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star key={star} className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                              ))}
                            </div>
                          </div>

                          <p className="text-sm text-muted-foreground mb-4">
                            {item.roomType.description || 'Comfortable room with modern amenities.'}
                          </p>

                          {/* Amenities */}
                          <div className="flex flex-wrap gap-2 mb-4">
                            {item.roomType.amenities?.slice(0, 5).map((amenity, index) => (
                              <Badge key={index} variant="outline" className="font-normal">
                                {getAmenityIcon(amenity)}
                                <span className="ml-1">{amenity}</span>
                              </Badge>
                            ))}
                          </div>

                          {/* Capacity Info */}
                          <div className="flex items-center gap-4 text-sm mb-4">
                            <span className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              Max {item.roomType.maxOccupancy} guests
                            </span>
                            {!item.fitsCapacity && (
                              <Badge variant="destructive" className="text-xs">
                                Exceeds capacity
                              </Badge>
                            )}
                          </div>

                          {/* Pricing & Book */}
                          <div className="flex items-end justify-between border-t pt-4">
                            <div>
                              {item.pricing.ratePlan && (
                                <p className="text-sm text-muted-foreground mb-1">
                                  {item.pricing.ratePlan.name} • {getMealPlanLabel(item.pricing.ratePlan.mealPlan)}
                                </p>
                              )}
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold">${item.pricing.pricePerNight}</span>
                                <span className="text-muted-foreground">/ night</span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Total: ${item.pricing.totalPrice.toFixed(2)} for {item.pricing.nights} night{item.pricing.nights > 1 ? 's' : ''}
                              </p>
                            </div>
                            <Button
                              className="bg-teal-600 hover:bg-teal-700"
                              disabled={!item.availability.isAvailable || !item.fitsCapacity}
                              onClick={() => {
                                setSelectedRoom(item);
                                setBookingDialog(true);
                              }}
                            >
                              {item.availability.isAvailable ? 'Book Now' : 'Not Available'}
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Trust Signals */}
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <Card className="text-center">
            <CardContent className="pt-6">
              <Shield className="h-8 w-8 mx-auto mb-3 text-teal-600" />
              <h3 className="font-semibold mb-1">Secure Booking</h3>
              <p className="text-sm text-muted-foreground">
                Your payment information is encrypted and secure
              </p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <CheckCircle className="h-8 w-8 mx-auto mb-3 text-teal-600" />
              <h3 className="font-semibold mb-1">Best Price Guarantee</h3>
              <p className="text-sm text-muted-foreground">
                Book direct for the best available rates
              </p>
            </CardContent>
          </Card>
          <Card className="text-center">
            <CardContent className="pt-6">
              <CreditCard className="h-8 w-8 mx-auto mb-3 text-teal-600" />
              <h3 className="font-semibold mb-1">Free Cancellation</h3>
              <p className="text-sm text-muted-foreground">
                Cancel up to 24 hours before check-in
              </p>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Booking Dialog */}
      <Dialog open={bookingDialog} onOpenChange={(open) => { if (!open) resetBooking(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Your Booking</DialogTitle>
            <DialogDescription>
              Enter your details to confirm the reservation
            </DialogDescription>
          </DialogHeader>

          {selectedRoom && (
            <div className="space-y-4">
              {/* Booking Summary */}
              <div className="bg-muted rounded-lg p-4">
                <h4 className="font-medium mb-2">{selectedRoom.roomType.name}</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>
                    {format(checkIn, 'MMM dd')} - {format(checkOut, 'MMM dd, yyyy')} ({selectedRoom.pricing.nights} nights)
                  </p>
                  <p>{adults} adult{adults > 1 ? 's' : ''}{children > 0 ? `, ${children} child${children > 1 ? 'ren' : ''}` : ''}</p>
                  <p className="font-medium text-foreground pt-2">
                    Total: ${selectedRoom.pricing.totalPrice.toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Guest Form */}
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="firstName">First Name *</Label>
                    <Input
                      id="firstName"
                      value={guestForm.firstName}
                      onChange={(e) => setGuestForm(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="lastName">Last Name *</Label>
                    <Input
                      id="lastName"
                      value={guestForm.lastName}
                      onChange={(e) => setGuestForm(prev => ({ ...prev, lastName: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={guestForm.email}
                    onChange={(e) => setGuestForm(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={guestForm.phone}
                    onChange={(e) => setGuestForm(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="requests">Special Requests</Label>
                  <Input
                    id="requests"
                    value={guestForm.specialRequests}
                    onChange={(e) => setGuestForm(prev => ({ ...prev, specialRequests: e.target.value }))}
                    placeholder="Early check-in, high floor, etc."
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={resetBooking}>
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                  onClick={handleBooking}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : null}
                  Confirm Booking
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmation} onOpenChange={() => setConfirmation(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-center">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-600" />
              Booking Confirmed!
            </DialogTitle>
            <DialogDescription className="text-center">
              Your reservation has been successfully created
            </DialogDescription>
          </DialogHeader>

          {confirmation && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground mb-1">Confirmation Code</p>
                <p className="text-2xl font-bold text-green-600">{confirmation.booking.confirmationCode}</p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Guest</span>
                  <span>{confirmation.booking.guest.firstName} {confirmation.booking.guest.lastName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Room</span>
                  <span>{confirmation.booking.room.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Check-in</span>
                  <span>{format(new Date(confirmation.booking.checkIn), 'MMM dd, yyyy')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Check-out</span>
                  <span>{format(new Date(confirmation.booking.checkOut), 'MMM dd, yyyy')}</span>
                </div>
                <div className="flex justify-between font-medium pt-2 border-t">
                  <span>Total</span>
                  <span>${confirmation.pricing.totalAmount.toFixed(2)}</span>
                </div>
              </div>

              <div className="bg-muted rounded-lg p-3 text-sm">
                <p className="font-medium mb-1">What&apos;s Next?</p>
                <p className="text-muted-foreground">
                  A confirmation email has been sent to {confirmation.booking.guest.email}.
                  You can manage your booking through the guest portal.
                </p>
              </div>

              <Button
                className="w-full bg-teal-600 hover:bg-teal-700"
                onClick={() => window.location.href = `/portal?token=${confirmation.booking.portalToken}`}
              >
                Manage Booking
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="border-t mt-16 py-8 bg-gray-50">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} Grand Hotel. All rights reserved.</p>
          <p className="mt-1">
            Powered by <span className="font-medium text-teal-600">StaySuite</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
