'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Users,
  UserPlus,
  Building2,
  Key,
  RefreshCw,
  Search,
  Phone,
  Mail,
  Calendar,
  CheckCircle2,
  AlertCircle,
  MapPin,
  IdCard,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { differenceInDays, addDays, format } from 'date-fns';

// ============ CONSTANTS ============
const COUNTRIES = [
  { code: 'IN', name: 'India', phoneCode: '+91', nationality: 'Indian' },
  { code: 'US', name: 'United States', phoneCode: '+1', nationality: 'American' },
  { code: 'GB', name: 'United Kingdom', phoneCode: '+44', nationality: 'British' },
  { code: 'AE', name: 'United Arab Emirates', phoneCode: '+971', nationality: 'Emirati' },
  { code: 'SA', name: 'Saudi Arabia', phoneCode: '+966', nationality: 'Saudi' },
  { code: 'SG', name: 'Singapore', phoneCode: '+65', nationality: 'Singaporean' },
  { code: 'MY', name: 'Malaysia', phoneCode: '+60', nationality: 'Malaysian' },
  { code: 'TH', name: 'Thailand', phoneCode: '+66', nationality: 'Thai' },
  { code: 'AU', name: 'Australia', phoneCode: '+61', nationality: 'Australian' },
  { code: 'CA', name: 'Canada', phoneCode: '+1', nationality: 'Canadian' },
  { code: 'DE', name: 'Germany', phoneCode: '+49', nationality: 'German' },
  { code: 'FR', name: 'France', phoneCode: '+33', nationality: 'French' },
  { code: 'IT', name: 'Italy', phoneCode: '+39', nationality: 'Italian' },
  { code: 'ES', name: 'Spain', phoneCode: '+34', nationality: 'Spanish' },
  { code: 'NL', name: 'Netherlands', phoneCode: '+31', nationality: 'Dutch' },
  { code: 'CH', name: 'Switzerland', phoneCode: '+41', nationality: 'Swiss' },
  { code: 'JP', name: 'Japan', phoneCode: '+81', nationality: 'Japanese' },
  { code: 'CN', name: 'China', phoneCode: '+86', nationality: 'Chinese' },
  { code: 'KR', name: 'South Korea', phoneCode: '+82', nationality: 'South Korean' },
  { code: 'BR', name: 'Brazil', phoneCode: '+55', nationality: 'Brazilian' },
  { code: 'MX', name: 'Mexico', phoneCode: '+52', nationality: 'Mexican' },
  { code: 'RU', name: 'Russia', phoneCode: '+7', nationality: 'Russian' },
  { code: 'ZA', name: 'South Africa', phoneCode: '+27', nationality: 'South African' },
  { code: 'NG', name: 'Nigeria', phoneCode: '+234', nationality: 'Nigerian' },
  { code: 'EG', name: 'Egypt', phoneCode: '+20', nationality: 'Egyptian' },
  { code: 'TR', name: 'Turkey', phoneCode: '+90', nationality: 'Turkish' },
  { code: 'ID', name: 'Indonesia', phoneCode: '+62', nationality: 'Indonesian' },
  { code: 'PH', name: 'Philippines', phoneCode: '+63', nationality: 'Filipino' },
  { code: 'VN', name: 'Vietnam', phoneCode: '+84', nationality: 'Vietnamese' },
  { code: 'BD', name: 'Bangladesh', phoneCode: '+880', nationality: 'Bangladeshi' },
  { code: 'PK', name: 'Pakistan', phoneCode: '+92', nationality: 'Pakistani' },
  { code: 'LK', name: 'Sri Lanka', phoneCode: '+94', nationality: 'Sri Lankan' },
  { code: 'NP', name: 'Nepal', phoneCode: '+977', nationality: 'Nepali' },
  { code: 'BH', name: 'Bahrain', phoneCode: '+973', nationality: 'Bahraini' },
  { code: 'KW', name: 'Kuwait', phoneCode: '+965', nationality: 'Kuwaiti' },
  { code: 'OM', name: 'Oman', phoneCode: '+968', nationality: 'Omani' },
  { code: 'QA', name: 'Qatar', phoneCode: '+974', nationality: 'Qatari' },
  { code: 'NZ', name: 'New Zealand', phoneCode: '+64', nationality: 'New Zealander' },
  { code: 'SE', name: 'Sweden', phoneCode: '+46', nationality: 'Swedish' },
  { code: 'NO', name: 'Norway', phoneCode: '+47', nationality: 'Norwegian' },
  { code: 'DK', name: 'Denmark', phoneCode: '+45', nationality: 'Danish' },
  { code: 'FI', name: 'Finland', phoneCode: '+358', nationality: 'Finnish' },
  { code: 'IE', name: 'Ireland', phoneCode: '+353', nationality: 'Irish' },
  { code: 'AT', name: 'Austria', phoneCode: '+43', nationality: 'Austrian' },
  { code: 'BE', name: 'Belgium', phoneCode: '+32', nationality: 'Belgian' },
  { code: 'PT', name: 'Portugal', phoneCode: '+351', nationality: 'Portuguese' },
  { code: 'GR', name: 'Greece', phoneCode: '+30', nationality: 'Greek' },
  { code: 'PL', name: 'Poland', phoneCode: '+48', nationality: 'Polish' },
  { code: 'CZ', name: 'Czech Republic', phoneCode: '+420', nationality: 'Czech' },
  { code: 'HU', name: 'Hungary', phoneCode: '+36', nationality: 'Hungarian' },
  { code: 'RO', name: 'Romania', phoneCode: '+40', nationality: 'Romanian' },
  { code: 'IL', name: 'Israel', phoneCode: '+972', nationality: 'Israeli' },
  { code: 'KE', name: 'Kenya', phoneCode: '+254', nationality: 'Kenyan' },
  { code: 'MA', name: 'Morocco', phoneCode: '+212', nationality: 'Moroccan' },
  { code: 'TW', name: 'Taiwan', phoneCode: '+886', nationality: 'Taiwanese' },
  { code: 'HK', name: 'Hong Kong', phoneCode: '+852', nationality: 'Hong Konger' },
  { code: 'OTHER', name: 'Other', phoneCode: '', nationality: '' },
];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra',
  'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha',
  'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  // Union Territories
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

const ID_TYPES_BY_COUNTRY: Record<string, Array<{ value: string; label: string }>> = {
  IN: [
    { value: 'aadhaar', label: 'Aadhaar Card' },
    { value: 'pan', label: 'PAN Card' },
    { value: 'passport', label: 'Passport' },
    { value: 'voter_id', label: 'Voter ID' },
    { value: 'driving_license', label: 'Driving License' },
  ],
  US: [
    { value: 'passport', label: 'Passport' },
    { value: 'drivers_license', label: "Driver's License" },
    { value: 'state_id', label: 'State ID' },
    { value: 'ssn', label: 'Social Security Number' },
  ],
  GB: [
    { value: 'passport', label: 'Passport' },
    { value: 'driving_license', label: 'Driving License' },
    { value: 'national_insurance', label: 'National Insurance Number' },
  ],
  AE: [
    { value: 'passport', label: 'Passport' },
    { value: 'emirates_id', label: 'Emirates ID' },
    { value: 'driving_license', label: 'Driving License' },
  ],
  SA: [
    { value: 'passport', label: 'Passport' },
    { value: 'national_id', label: 'National ID' },
    { value: 'iqama', label: 'Iqama (Residence Permit)' },
  ],
  DEFAULT: [
    { value: 'passport', label: 'Passport' },
    { value: 'national_id', label: 'National ID' },
    { value: 'driving_license', label: 'Driving License' },
  ],
};

// ============ INTERFACES ============
interface Property {
  id: string;
  name: string;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  defaultTaxRate?: number;
  taxComponents?: Array<{ name: string; rate: number; type?: string }>;
  serviceChargePercent?: number;
}

interface TaxSettings {
  defaultTaxRate: number;
  taxComponents: Array<{ name: string; rate: number; type?: string }>;
  serviceChargePercent: number;
}

interface RoomType {
  id: string;
  name: string;
  code: string;
  basePrice: number;
  maxAdults: number;
  maxChildren: number;
  totalRooms: number;
}

interface Room {
  id: string;
  number: string;
  floor: number;
  status: string;
  roomType: {
    id: string;
    name: string;
    basePrice: number;
  };
}

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  isVip: boolean;
  loyaltyTier: string;
}

// ============ MAIN COMPONENT ============
export default function WalkIn() {
  const { toast } = useToast();
  const { formatCurrency, currency } = useCurrency();
  const { formatDate } = useTimezone();
  const { user } = useAuth();
  
  const currencySymbol = currency.symbol;
  
  // Data states
  const [properties, setProperties] = useState<Property[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [existingGuests, setExistingGuests] = useState<Guest[]>([]);
  const [taxSettings, setTaxSettings] = useState<TaxSettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearchingGuests, setIsSearchingGuests] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form states
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [useExistingGuest, setUseExistingGuest] = useState(false);
  const [selectedGuestId, setSelectedGuestId] = useState<string>('');
  const [guestSearchQuery, setGuestSearchQuery] = useState('');
  
  // Guest form - global with smart defaults
  const [guestForm, setGuestForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    countryCode: 'IN',
    nationality: 'Indian',
    idType: 'passport',
    idNumber: '',
    address: '',
    city: '',
    state: '',
    postalCode: '',
  });
  
  // Booking form
  const [bookingForm, setBookingForm] = useState({
    checkIn: format(new Date(), 'yyyy-MM-dd'),
    checkOut: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    adults: 1,
    children: 0,
    roomRate: 0,
    specialRequests: '',
  });

  // Get selected country data
  const selectedCountry = useMemo(() => 
    COUNTRIES.find(c => c.code === guestForm.countryCode) || COUNTRIES[0],
    [guestForm.countryCode]
  );

  // Get ID types for selected country
  const idTypes = useMemo(() => 
    ID_TYPES_BY_COUNTRY[guestForm.countryCode] || ID_TYPES_BY_COUNTRY.DEFAULT,
    [guestForm.countryCode]
  );

  // Check if country is India (for state dropdown)
  const isIndia = guestForm.countryCode === 'IN';

  // Handle country change - update related fields
  const handleCountryChange = (countryCode: string) => {
    const country = COUNTRIES.find(c => c.code === countryCode);
    setGuestForm(prev => ({
      ...prev,
      countryCode,
      nationality: country?.nationality || '',
      state: '', // Reset state when country changes
      // Set default ID type based on country
      idType: countryCode === 'IN' ? 'aadhaar' : 'passport',
    }));
  };

  // Fetch properties on mount
  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await fetch('/api/properties');
        const result = await response.json();
        if (result.success) {
          setProperties(result.data);
          if (result.data.length > 0) {
            setSelectedPropertyId(result.data[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching properties:', error);
      }
    };
    fetchProperties();
  }, []);

  // Fetch room types and tax settings when property changes
  useEffect(() => {
    const fetchRoomTypes = async () => {
      if (!selectedPropertyId) return;
      try {
        const response = await fetch(`/api/room-types?propertyId=${selectedPropertyId}`);
        const result = await response.json();
        if (result.success) {
          setRoomTypes(result.data);
          if (result.data.length > 0) {
            setSelectedRoomTypeId(result.data[0].id);
            setBookingForm(prev => ({ ...prev, roomRate: result.data[0].basePrice }));
          }
        }
      } catch (error) {
        console.error('Error fetching room types:', error);
      }
    };

    const fetchTaxSettings = async () => {
      if (!selectedPropertyId) return;
      try {
        const response = await fetch(`/api/properties/${selectedPropertyId}/tax-settings`);
        const result = await response.json();
        if (result.success) {
          setTaxSettings({
            defaultTaxRate: result.data.defaultTaxRate || 0,
            taxComponents: result.data.taxComponents || [],
            serviceChargePercent: result.data.serviceChargePercent || 0,
          });
        }
      } catch (error) {
        console.error('Error fetching tax settings:', error);
        setTaxSettings({
          defaultTaxRate: 0,
          taxComponents: [],
          serviceChargePercent: 0,
        });
      }
    };

    fetchRoomTypes();
    fetchTaxSettings();
  }, [selectedPropertyId]);

  // Fetch available rooms when room type changes
  useEffect(() => {
    const fetchAvailableRooms = async () => {
      if (!selectedPropertyId || !selectedRoomTypeId) return;
      try {
        setIsLoading(true);
        const response = await fetch(
          `/api/rooms?propertyId=${selectedPropertyId}&roomTypeId=${selectedRoomTypeId}&status=available`
        );
        const result = await response.json();
        if (result.success) {
          setAvailableRooms(result.data);
          if (result.data.length > 0) {
            setSelectedRoomId(result.data[0].id);
          }
        }
      } catch (error) {
        console.error('Error fetching available rooms:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAvailableRooms();
  }, [selectedPropertyId, selectedRoomTypeId]);

  // Search existing guests
  const searchGuests = async (query: string) => {
    if (query.length < 2) {
      setExistingGuests([]);
      return;
    }
    setIsSearchingGuests(true);
    try {
      const response = await fetch(`/api/guests?search=${query}&limit=10`);
      const result = await response.json();
      if (result.success) {
        setExistingGuests(result.data);
      }
    } catch (error) {
      console.error('Error searching guests:', error);
    } finally {
      setIsSearchingGuests(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (guestSearchQuery) {
        searchGuests(guestSearchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [guestSearchQuery]);

  // Calculate totals
  const nights = differenceInDays(new Date(bookingForm.checkOut), new Date(bookingForm.checkIn));
  const roomRate = bookingForm.roomRate || 0;
  const subtotal = roomRate * nights;

  let taxes = 0;
  let taxBreakdown: Array<{ name: string; amount: number }> = [];

  if (taxSettings) {
    if (taxSettings.taxComponents && taxSettings.taxComponents.length > 0) {
      for (const component of taxSettings.taxComponents) {
        const amount = subtotal * (component.rate / 100);
        taxes += amount;
        taxBreakdown.push({ name: component.name, amount });
      }
    } else if (taxSettings.defaultTaxRate > 0) {
      taxes = subtotal * (taxSettings.defaultTaxRate / 100);
      taxBreakdown.push({ name: 'Tax', amount: taxes });
    }
  }

  const serviceCharge = taxSettings?.serviceChargePercent
    ? subtotal * (taxSettings.serviceChargePercent / 100)
    : 0;

  const totalAmount = subtotal + taxes + serviceCharge;

  // Create walk-in booking
  const createWalkIn = async () => {
    if (!selectedPropertyId || !selectedRoomTypeId || !selectedRoomId) {
      toast({
        title: 'Validation Error',
        description: 'Please select property, room type, and room',
        variant: 'destructive',
      });
      return;
    }

    if (!useExistingGuest) {
      if (!guestForm.firstName || !guestForm.lastName) {
        toast({
          title: 'Validation Error',
          description: 'Please enter guest name',
          variant: 'destructive',
        });
        return;
      }
      if (!guestForm.phone) {
        toast({
          title: 'Validation Error',
          description: 'Please enter guest phone number',
          variant: 'destructive',
        });
        return;
      }
    } else if (!selectedGuestId) {
      toast({
        title: 'Validation Error',
        description: 'Please select an existing guest',
        variant: 'destructive',
      });
      return;
    }

    if (nights <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Check-out must be after check-in',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      let guestId = selectedGuestId;

      if (!useExistingGuest) {
        const guestResponse = await fetch('/api/guests', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...guestForm,
            country: guestForm.countryCode,
            source: 'walk_in',
            tenantId: user?.tenantId || '',
          }),
        });
        const guestResult = await guestResponse.json();
        if (!guestResult.success) {
          toast({
            title: 'Error',
            description: guestResult.error?.message || 'Failed to create guest',
            variant: 'destructive',
          });
          setIsSaving(false);
          return;
        }
        guestId = guestResult.data.id;
      }

      const bookingResponse = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedPropertyId,
          primaryGuestId: guestId,
          roomId: selectedRoomId,
          roomTypeId: selectedRoomTypeId,
          checkIn: new Date(bookingForm.checkIn + 'T00:00:00').toISOString(),
          checkOut: new Date(bookingForm.checkOut + 'T00:00:00').toISOString(),
          checkInLocalDate: bookingForm.checkIn,
          checkOutLocalDate: bookingForm.checkOut,
          adults: bookingForm.adults,
          children: bookingForm.children,
          roomRate,
          totalAmount,
          taxes,
          fees: serviceCharge,
          source: 'walk_in',
          status: 'confirmed',
          specialRequests: bookingForm.specialRequests || undefined,
        }),
      });
      const bookingResult = await bookingResponse.json();

      if (bookingResult.success) {
        toast({
          title: 'Booking Created',
          description: `Walk-in booking ${bookingResult.data.confirmationCode} created successfully`,
        });
        // Reset form
        setGuestForm({
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          countryCode: 'IN',
          nationality: 'Indian',
          idType: 'aadhaar',
          idNumber: '',
          address: '',
          city: '',
          state: '',
          postalCode: '',
        });
        setBookingForm(prev => ({
          ...prev,
          adults: 1,
          children: 0,
          specialRequests: '',
        }));
        // Refresh available rooms
        if (selectedPropertyId && selectedRoomTypeId) {
          const response = await fetch(
            `/api/rooms?propertyId=${selectedPropertyId}&roomTypeId=${selectedRoomTypeId}&status=available`
          );
          const result = await response.json();
          if (result.success) {
            setAvailableRooms(result.data);
            if (result.data.length > 0) {
              setSelectedRoomId(result.data[0].id);
            }
          }
        }
      } else {
        toast({
          title: 'Error',
          description: bookingResult.error?.message || 'Failed to create booking',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating walk-in:', error);
      toast({
        title: 'Error',
        description: 'Failed to create walk-in booking',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedRoomType = roomTypes.find(rt => rt.id === selectedRoomTypeId);
  const selectedRoom = availableRooms.find(r => r.id === selectedRoomId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Walk-in Booking
          </h2>
          <p className="text-sm text-muted-foreground">
            Create a new walk-in reservation with guest registration
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Guest & Booking Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Property & Room Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Property & Room</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map(property => (
                      <SelectItem key={property.id} value={property.id}>
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4" />
                          {property.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select 
                  value={selectedRoomTypeId} 
                  onValueChange={(value) => {
                    setSelectedRoomTypeId(value);
                    const rt = roomTypes.find(r => r.id === value);
                    if (rt) {
                      setBookingForm(prev => ({ ...prev, roomRate: rt.basePrice }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select room type" />
                  </SelectTrigger>
                  <SelectContent>
                    {roomTypes.map(type => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.name} - {formatCurrency(type.basePrice)}/night
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                {isLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : availableRooms.length === 0 ? (
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm">No available rooms for this room type</span>
                  </div>
                ) : (
                  <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Assign room" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRooms.map(room => (
                        <SelectItem key={room.id} value={room.id}>
                          <div className="flex items-center gap-2">
                            <Key className="h-4 w-4" />
                            Room {room.number} - Floor {room.floor}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {availableRooms.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {availableRooms.length} room(s) available
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Guest Information */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Guest Information</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Existing Guest</span>
                  <Switch
                    checked={useExistingGuest}
                    onCheckedChange={setUseExistingGuest}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {useExistingGuest ? (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, email or phone..."
                      value={guestSearchQuery}
                      onChange={(e) => setGuestSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>

                  {isSearchingGuests ? (
                    <div className="flex items-center justify-center py-4">
                      <RefreshCw className="h-5 w-5 animate-spin" />
                    </div>
                  ) : existingGuests.length > 0 ? (
                    <ScrollArea className="h-48">
                      <div className="space-y-2">
                        {existingGuests.map(guest => (
                          <button
                            key={guest.id}
                            onClick={() => setSelectedGuestId(guest.id)}
                            className={cn(
                              "w-full p-3 rounded-lg border text-left transition-all",
                              selectedGuestId === guest.id
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-muted/50"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">
                                  {guest.firstName} {guest.lastName}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {guest.email && <span>{guest.email}</span>}
                                  {guest.email && guest.phone && <span> • </span>}
                                  {guest.phone && <span>{guest.phone}</span>}
                                </p>
                              </div>
                              {guest.isVip && (
                                <Badge className="bg-amber-100 text-amber-700">VIP</Badge>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : guestSearchQuery.length >= 2 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      No guests found
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Name Row */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      placeholder="First name *"
                      value={guestForm.firstName}
                      onChange={(e) => setGuestForm(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                    <Input
                      placeholder="Last name *"
                      value={guestForm.lastName}
                      onChange={(e) => setGuestForm(prev => ({ ...prev, lastName: e.target.value }))}
                    />
                  </div>

                  {/* Contact Row */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="email"
                        placeholder="Email address"
                        value={guestForm.email}
                        onChange={(e) => setGuestForm(prev => ({ ...prev, email: e.target.value }))}
                        className="pl-9"
                      />
                    </div>
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={`Phone number * (${selectedCountry.phoneCode})`}
                        value={guestForm.phone}
                        onChange={(e) => setGuestForm(prev => ({ ...prev, phone: e.target.value }))}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  {/* Country & ID Row */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                      <Select value={guestForm.countryCode} onValueChange={handleCountryChange}>
                        <SelectTrigger className="pl-9">
                          <SelectValue placeholder="Country" />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRIES.map(country => (
                            <SelectItem key={country.code} value={country.code}>
                              {country.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Select 
                      value={guestForm.idType} 
                      onValueChange={(value) => setGuestForm(prev => ({ ...prev, idType: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="ID type" />
                      </SelectTrigger>
                      <SelectContent>
                        {idTypes.map(idType => (
                          <SelectItem key={idType.value} value={idType.value}>
                            {idType.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="relative">
                      <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="ID number"
                        value={guestForm.idNumber}
                        onChange={(e) => setGuestForm(prev => ({ ...prev, idNumber: e.target.value }))}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  {/* Nationality (auto-filled but editable) */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      placeholder="Nationality"
                      value={guestForm.nationality}
                      onChange={(e) => setGuestForm(prev => ({ ...prev, nationality: e.target.value }))}
                    />
                  </div>

                  {/* Address */}
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Textarea
                      placeholder="Street address"
                      value={guestForm.address}
                      onChange={(e) => setGuestForm(prev => ({ ...prev, address: e.target.value }))}
                      className="pl-9 min-h-[60px]"
                    />
                  </div>

                  {/* City, State/Region, Postal Code */}
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Input
                      placeholder="City"
                      value={guestForm.city}
                      onChange={(e) => setGuestForm(prev => ({ ...prev, city: e.target.value }))}
                    />
                    {isIndia ? (
                      <Select 
                        value={guestForm.state} 
                        onValueChange={(value) => setGuestForm(prev => ({ ...prev, state: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="State" />
                        </SelectTrigger>
                        <SelectContent>
                          {INDIAN_STATES.map(state => (
                            <SelectItem key={state} value={state}>
                              {state}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        placeholder="State / Province / Region"
                        value={guestForm.state}
                        onChange={(e) => setGuestForm(prev => ({ ...prev, state: e.target.value }))}
                      />
                    )}
                    <Input
                      placeholder={isIndia ? "PIN Code" : "Postal / ZIP Code"}
                      value={guestForm.postalCode}
                      onChange={(e) => setGuestForm(prev => ({ ...prev, postalCode: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stay Details */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Stay Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={bookingForm.checkIn}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, checkIn: e.target.value }))}
                    className="pl-9"
                  />
                </div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={bookingForm.checkOut}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, checkOut: e.target.value }))}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  type="number"
                  min="1"
                  max={selectedRoomType?.maxAdults || 4}
                  placeholder="Adults"
                  value={bookingForm.adults}
                  onChange={(e) => setBookingForm(prev => ({ ...prev, adults: parseInt(e.target.value) || 1 }))}
                />
                <Input
                  type="number"
                  min="0"
                  max={selectedRoomType?.maxChildren || 2}
                  placeholder="Children"
                  value={bookingForm.children}
                  onChange={(e) => setBookingForm(prev => ({ ...prev, children: parseInt(e.target.value) || 0 }))}
                />
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                    {currencySymbol}
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Rate per night"
                    value={bookingForm.roomRate}
                    onChange={(e) => setBookingForm(prev => ({ ...prev, roomRate: parseFloat(e.target.value) || 0 }))}
                    className="pl-9"
                  />
                </div>
              </div>

              <Textarea
                placeholder="Special requests (early check-in, room preferences, dietary requirements...)"
                value={bookingForm.specialRequests}
                onChange={(e) => setBookingForm(prev => ({ ...prev, specialRequests: e.target.value }))}
                rows={2}
              />
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Summary */}
        <div className="space-y-6">
          <Card className="lg:sticky lg:top-6">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Booking Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Room Info */}
              {selectedRoomType && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{selectedRoomType.name}</span>
                  </div>
                  {selectedRoom && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Key className="h-4 w-4" />
                      Room {selectedRoom.number} - Floor {selectedRoom.floor}
                    </div>
                  )}
                </div>
              )}

              {/* Dates */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Check-in</span>
                  <span>{formatDate(bookingForm.checkIn)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Check-out</span>
                  <span>{formatDate(bookingForm.checkOut)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Duration</span>
                  <span>{nights} night{nights > 1 ? 's' : ''}</span>
                </div>
              </div>

              <Separator />

              {/* Guests */}
              <div className="flex items-center gap-2 text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span>{bookingForm.adults} adult{bookingForm.adults > 1 ? 's' : ''}</span>
                {bookingForm.children > 0 && (
                  <span>, {bookingForm.children} child{bookingForm.children > 1 ? 'ren' : ''}</span>
                )}
              </div>

              <Separator />

              {/* Pricing */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Room Rate</span>
                  <span>{formatCurrency(roomRate)} × {nights} nights</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {taxBreakdown.map((tax, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{tax.name}</span>
                    <span>{formatCurrency(tax.amount)}</span>
                  </div>
                ))}
                {taxBreakdown.length === 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Taxes</span>
                    <span>{formatCurrency(taxes)}</span>
                  </div>
                )}
                {serviceCharge > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Service Charge ({taxSettings?.serviceChargePercent}%)</span>
                    <span>{formatCurrency(serviceCharge)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-medium text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(totalAmount)}</span>
                </div>
              </div>

              <Separator />

              {/* Create Button */}
              <Button 
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={createWalkIn}
                disabled={isSaving || availableRooms.length === 0}
              >
                {isSaving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Create Walk-in Booking
                  </>
                )}
              </Button>

              {availableRooms.length === 0 && selectedRoomType && (
                <div className="flex items-center gap-2 text-sm text-amber-600 justify-center">
                  <AlertCircle className="h-4 w-4" />
                  No rooms available
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
