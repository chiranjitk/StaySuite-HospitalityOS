'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerDescription,
} from '@/components/ui/drawer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Search,
  Mail,
  Phone,
  Loader2,
  Crown,
  Eye,
  Hotel,
  DollarSign,
  Globe,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useMediaQuery } from '@/hooks/use-media-query';

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  nationality?: string;
  country?: string;
  city?: string;
  loyaltyTier: string;
  loyaltyPoints: number;
  totalStays: number;
  totalSpent: number;
  isVip: boolean;
  vipLevel?: string;
  source: string;
  kycStatus: string;
  totalBookings: number;
  createdAt: string;
}

interface GuestsListProps {
  onSelectGuest?: (guestId: string) => void;
}

const loyaltyTiers = [
  { value: 'bronze', label: 'Bronze', color: 'bg-gradient-to-r from-amber-700 to-amber-600', textColor: 'text-amber-200', avatarBg: 'from-amber-500 to-orange-600' },
  { value: 'silver', label: 'Silver', color: 'bg-gradient-to-r from-gray-400 to-gray-300', textColor: 'text-white', avatarBg: 'from-gray-400 to-gray-500' },
  { value: 'gold', label: 'Gold', color: 'bg-gradient-to-r from-yellow-500 to-amber-500', textColor: 'text-yellow-100', avatarBg: 'from-yellow-400 to-amber-600' },
  { value: 'platinum', label: 'Platinum', color: 'bg-gradient-to-r from-slate-500 to-violet-600', textColor: 'text-violet-200', avatarBg: 'from-violet-500 to-purple-600' },
];

const sources = [
  { value: 'direct', label: 'Direct' },
  { value: 'booking_com', label: 'Booking.com' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'expedia', label: 'Expedia' },
  { value: 'walk_in', label: 'Walk-in' },
];

export default function GuestsList({ onSelectGuest }: GuestsListProps) {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();

  // Responsive breakpoints
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const isLargeDesktop = useMediaQuery('(min-width: 1024px)');

  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [loyaltyFilter, setLoyaltyFilter] = useState<string>('all');
  const [vipFilter, setVipFilter] = useState<string>('all');

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    nationality: '',
    address: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    idType: '',
    idNumber: '',
    notes: '',
    loyaltyTier: 'bronze',
    isVip: false,
    vipLevel: '',
    source: 'direct',
  });

  // Fetch guests
  const fetchGuests = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (loyaltyFilter !== 'all') params.append('loyaltyTier', loyaltyFilter);
      if (vipFilter === 'vip') params.append('isVip', 'true');

      const response = await fetch(`/api/guests?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setGuests(result.data);
      }
    } catch (error) {
      console.error('Error fetching guests:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch guests',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGuests();
  }, [loyaltyFilter, vipFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchGuests();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Create guest
  const handleCreate = async () => {
    if (!formData.firstName || !formData.lastName) {
      toast({
        title: 'Validation Error',
        description: 'First name and last name are required',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Guest created successfully',
        });
        setIsCreateOpen(false);
        resetForm();
        fetchGuests();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create guest',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating guest:', error);
      toast({
        title: 'Error',
        description: 'Failed to create guest',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Update guest
  const handleUpdate = async () => {
    if (!selectedGuest) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/guests/${selectedGuest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Guest updated successfully',
        });
        setIsEditOpen(false);
        setSelectedGuest(null);
        fetchGuests();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update guest',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating guest:', error);
      toast({
        title: 'Error',
        description: 'Failed to update guest',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete guest
  const handleDelete = async () => {
    if (!selectedGuest) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/guests/${selectedGuest.id}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Guest deleted successfully',
        });
        setIsDeleteOpen(false);
        setSelectedGuest(null);
        fetchGuests();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to delete guest',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting guest:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete guest',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (guest: Guest) => {
    setSelectedGuest(guest);
    setFormData({
      firstName: guest.firstName,
      lastName: guest.lastName,
      email: guest.email || '',
      phone: guest.phone || '',
      nationality: guest.nationality || '',
      address: '',
      city: guest.city || '',
      state: '',
      country: guest.country || '',
      postalCode: '',
      idType: '',
      idNumber: '',
      notes: '',
      loyaltyTier: guest.loyaltyTier,
      isVip: guest.isVip,
      vipLevel: guest.vipLevel || '',
      source: guest.source,
    });
    setIsEditOpen(true);
  };

  const openDeleteDialog = (guest: Guest) => {
    setSelectedGuest(guest);
    setIsDeleteOpen(true);
  };

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      nationality: '',
      address: '',
      city: '',
      state: '',
      country: '',
      postalCode: '',
      idType: '',
      idNumber: '',
      notes: '',
      loyaltyTier: 'bronze',
      isVip: false,
      vipLevel: '',
      source: 'direct',
    });
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  };

  const getAvatarGradient = (guest: Guest) => {
    if (guest.isVip) return 'from-amber-400 to-amber-600';
    const option = loyaltyTiers.find((o) => o.value === guest.loyaltyTier);
    return option?.avatarBg || 'from-emerald-500 to-teal-600';
  };

  const getLoyaltyBadge = (tier: string) => {
    const option = loyaltyTiers.find((o) => o.value === tier);
    return (
      <Badge variant="secondary" className={cn('text-white font-medium shadow-sm border-0', option?.color)}>
        {option?.label || tier}
      </Badge>
    );
  };

  const getGuestTypeBadge = (guest: Guest) => {
    if (guest.isVip) {
      return (
        <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white font-medium shadow-sm border-0">
          <Crown className="h-3 w-3 mr-1" />
          VIP
        </Badge>
      );
    }
    return getLoyaltyBadge(guest.loyaltyTier);
  };

  const getSourceLabel = (source: string) => {
    return sources.find((s) => s.value === source)?.label || source;
  };

  // Stats
  const stats = {
    total: guests.length,
    vip: guests.filter((g) => g.isVip).length,
    gold: guests.filter(
      (g) => g.loyaltyTier === 'gold' || g.loyaltyTier === 'platinum'
    ).length,
  };

  // ─── Loading Skeletons ─────────────────────────────────────────────
  const MobileSkeletonCards = () => (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
              <Skeleton className="h-10 rounded-lg" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 flex-1 rounded-md" />
              <Skeleton className="h-9 flex-1 rounded-md" />
              <Skeleton className="h-9 flex-1 rounded-md" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const DesktopSkeletonTable = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Guest</TableHead>
          <TableHead>Contact</TableHead>
          <TableHead>Loyalty</TableHead>
          <TableHead>Stays</TableHead>
          <TableHead>Total Spent</TableHead>
          <TableHead>Source</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: 6 }).map((_, i) => (
          <TableRow key={i}>
            <TableCell>
              <div className="flex items-center gap-3">
                <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="space-y-1">
                <Skeleton className="h-3 w-36" />
                <Skeleton className="h-3 w-24" />
              </div>
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-16 rounded-full" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-12" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-4 w-20" />
            </TableCell>
            <TableCell>
              <Skeleton className="h-5 w-20 rounded-full" />
            </TableCell>
            <TableCell>
              <div className="flex justify-end gap-1">
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
                <Skeleton className="h-8 w-8 rounded-md" />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  // ─── Mobile Guest Card ─────────────────────────────────────────────
  const GuestCard = ({ guest }: { guest: Guest }) => (
    <Card className="hover:shadow-md hover:bg-muted/30 transition-all duration-200 group">
      <CardContent className="p-4 space-y-3">
        {/* Row 1: Avatar + Name + Badges */}
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0 ring-2 ring-offset-2 ring-offset-background transition-all duration-200 group-hover:ring-primary/30">
            <AvatarFallback className={cn('bg-gradient-to-br text-white text-sm shadow-sm', getAvatarGradient(guest))}>
              {getInitials(guest.firstName, guest.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm truncate">
                {guest.firstName} {guest.lastName}
              </p>
              {guest.isVip && (
                <Crown className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
              )}
              {getLoyaltyBadge(guest.loyaltyTier)}
            </div>
            {guest.nationality && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {guest.nationality}
              </p>
            )}
          </div>
        </div>

        {/* Row 2: Email & Phone */}
        {(guest.email || guest.phone) && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {guest.email && (
              <div className="flex items-center gap-1.5 min-w-0">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{guest.email}</span>
              </div>
            )}
            {guest.phone && (
              <div className="flex items-center gap-1.5 shrink-0">
                <Phone className="h-3 w-3" />
                <span>{guest.phone}</span>
              </div>
            )}
          </div>
        )}

        {/* Row 3: Key stats mini grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-muted/50 rounded-lg px-2 py-1.5 text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Hotel className="h-3 w-3" />
              <span className="hidden sm:inline">stays</span>
            </div>
            <p className="text-sm font-semibold mt-0.5">{guest.totalStays}</p>
          </div>
          <div className="bg-muted/50 rounded-lg px-2 py-1.5 text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <DollarSign className="h-3 w-3" />
              <span className="hidden sm:inline">spent</span>
            </div>
            <p className="text-sm font-semibold mt-0.5">
              {formatCurrency(guest.totalSpent)}
            </p>
          </div>
          <div className="bg-muted/50 rounded-lg px-2 py-1.5 text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" />
            </div>
            <p className="text-xs font-medium mt-0.5">
              {getSourceLabel(guest.source)}
            </p>
          </div>
        </div>

        {/* Row 4: Action buttons */}
        <div className="flex gap-2 pt-1">
          {onSelectGuest && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-11 text-xs"
              onClick={() => onSelectGuest(guest.id)}
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              View
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-11 text-xs"
            onClick={() => openEditDialog(guest)}
          >
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-11 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => openDeleteDialog(guest)}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  // ─── Tablet Guest Card (compact) ───────────────────────────────────
  const GuestCardCompact = ({ guest }: { guest: Guest }) => (
    <Card className="hover:shadow-md hover:bg-muted/30 transition-all duration-200 group">
      <CardContent className="p-4 space-y-3">
        {/* Row 1: Avatar + Name + Badges + Actions */}
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10 shrink-0 ring-2 ring-offset-2 ring-offset-background transition-all duration-200 group-hover:ring-primary/30">
            <AvatarFallback className={cn('bg-gradient-to-br text-white text-sm shadow-sm', getAvatarGradient(guest))}>
              {getInitials(guest.firstName, guest.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium text-sm truncate">
                {guest.firstName} {guest.lastName}
              </p>
              {getGuestTypeBadge(guest)}
            </div>
            {guest.nationality && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {guest.nationality}
              </p>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            {onSelectGuest && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => onSelectGuest(guest.id)}
                title="View Profile"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => openEditDialog(guest)}
              title="Edit"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => openDeleteDialog(guest)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

        {/* Row 2: Email & Phone */}
        {(guest.email || guest.phone) && (
          <div className="flex gap-6 text-sm text-muted-foreground">
            {guest.email && (
              <div className="flex items-center gap-1.5 min-w-0">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{guest.email}</span>
              </div>
            )}
            {guest.phone && (
              <div className="flex items-center gap-1.5 shrink-0">
                <Phone className="h-3.5 w-3.5" />
                <span>{guest.phone}</span>
              </div>
            )}
          </div>
        )}

        {/* Row 3: Key stats inline */}
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <Hotel className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{guest.totalStays}</span>
            <span className="text-muted-foreground">stays</span>
          </span>
          <span className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">
              {formatCurrency(guest.totalSpent)}
            </span>
          </span>
          <Badge variant="outline" className="text-xs">
            {getSourceLabel(guest.source)}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );

  // ─── Desktop Table Row with Tooltip ────────────────────────────────
  const DesktopTableRow = ({ guest }: { guest: Guest }) => (
    <TableRow className="group hover:bg-muted/40 transition-colors duration-150">
      <TableCell className="w-[200px]">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 ring-2 ring-offset-1 ring-offset-background ring-transparent transition-all duration-200 group-hover:ring-primary/30">
            <AvatarFallback className={cn('bg-gradient-to-br text-white text-sm shadow-sm', getAvatarGradient(guest))}>
              {getInitials(guest.firstName, guest.lastName)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="font-medium text-sm truncate max-w-[120px]">
                    {guest.firstName} {guest.lastName}
                  </p>
                </TooltipTrigger>
                <TooltipContent>
                  {guest.firstName} {guest.lastName}
                </TooltipContent>
              </Tooltip>
              {getGuestTypeBadge(guest)}
            </div>
            {guest.nationality && (
              <p className="text-xs text-muted-foreground">
                {guest.nationality}
              </p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="space-y-1">
          {guest.email && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1.5 text-sm">
                  <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="truncate max-w-[150px]">{guest.email}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>{guest.email}</TooltipContent>
            </Tooltip>
          )}
          {guest.phone && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Phone className="h-3 w-3 shrink-0" />
              <span>{guest.phone}</span>
            </div>
          )}
        </div>
      </TableCell>
      <TableCell>{getLoyaltyBadge(guest.loyaltyTier)}</TableCell>
      <TableCell>
        <div className="text-sm">
          <span className="font-medium">{guest.totalStays}</span>
          <span className="text-muted-foreground"> stays</span>
        </div>
      </TableCell>
      <TableCell>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="font-medium text-sm">
              {formatCurrency(guest.totalSpent)}
            </span>
          </TooltipTrigger>
          <TooltipContent>{formatCurrency(guest.totalSpent)}</TooltipContent>
        </Tooltip>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{getSourceLabel(guest.source)}</Badge>
      </TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {onSelectGuest && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => onSelectGuest(guest.id)}
              title="View Profile"
            >
              <Eye className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => openEditDialog(guest)}
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => openDeleteDialog(guest)}
            title="Delete"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  // ─── Empty State ───────────────────────────────────────────────────
  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-muted-foreground">
      <Users className="h-12 w-12 mb-4 opacity-40" />
      <p className="font-medium text-base">No guests found</p>
      <p className="text-sm mt-1">Add your first guest to get started</p>
    </div>
  );

  // ─── Guest Form (responsive) ───────────────────────────────────────
  const formContent = <GuestForm formData={formData} setFormData={setFormData} />;

  const createFormBody = (
    <>
      <div className="shrink-0">
        {isDesktop ? (
          <>
            <DialogTitle>Add New Guest</DialogTitle>
            <DialogDescription>
              Create a new guest profile
            </DialogDescription>
          </>
        ) : (
          <>
            <DrawerTitle>Add New Guest</DrawerTitle>
            <DrawerDescription>
              Create a new guest profile
            </DrawerDescription>
          </>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-1 -mx-1">
        <div className="py-2">{formContent}</div>
      </div>
      <div className="shrink-0">
        {isDesktop ? (
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Guest
            </Button>
          </DialogFooter>
        ) : (
          <DrawerFooter>
            <Button onClick={handleCreate} disabled={isSaving} className="w-full">
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Guest
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              className="w-full"
            >
              Cancel
            </Button>
          </DrawerFooter>
        )}
      </div>
    </>
  );

  const editFormBody = (
    <>
      <div className="shrink-0">
        {isDesktop ? (
          <>
            <DialogTitle>Edit Guest</DialogTitle>
            <DialogDescription>
              Update guest information
            </DialogDescription>
          </>
        ) : (
          <>
            <DrawerTitle>Edit Guest</DrawerTitle>
            <DrawerDescription>
              Update guest information
            </DrawerDescription>
          </>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-1 -mx-1">
        <div className="py-2">{formContent}</div>
      </div>
      <div className="shrink-0">
        {isDesktop ? (
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Guest
            </Button>
          </DialogFooter>
        ) : (
          <DrawerFooter>
            <Button onClick={handleUpdate} disabled={isSaving} className="w-full">
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update Guest
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsEditOpen(false)}
              className="w-full"
            >
              Cancel
            </Button>
          </DrawerFooter>
        )}
      </div>
    </>
  );

  const deleteFormBody = (
    <>
      <div className="shrink-0">
        {isDesktop ? (
          <>
            <DialogTitle>Delete Guest</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedGuest?.firstName}{' '}
              {selectedGuest?.lastName}&quot;? This action cannot be undone.
            </DialogDescription>
          </>
        ) : (
          <>
            <DrawerTitle>Delete Guest</DrawerTitle>
            <DrawerDescription>
              Are you sure you want to delete &quot;{selectedGuest?.firstName}{' '}
              {selectedGuest?.lastName}&quot;? This action cannot be undone.
            </DrawerDescription>
          </>
        )}
      </div>
      <div className="shrink-0">
        {isDesktop ? (
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSaving}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        ) : (
          <DrawerFooter>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isSaving}
              className="w-full"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsDeleteOpen(false)}
              className="w-full"
            >
              Cancel
            </Button>
          </DrawerFooter>
        )}
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Guests
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage guest profiles and information
          </p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setIsCreateOpen(true);
          }}
          className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg hover:shadow-primary/20 transition-all duration-300"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Guest
        </Button>
      </div>

      {/* ─── Stats Cards ────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-4">
          <div className="text-xl sm:text-2xl font-bold">{stats.total}</div>
          <div className="text-[10px] sm:text-xs text-muted-foreground">
            Total Guests
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="text-xl sm:text-2xl font-bold text-amber-500 dark:text-amber-400">
            {stats.vip}
          </div>
          <div className="text-[10px] sm:text-xs text-muted-foreground">
            VIP Guests
          </div>
        </Card>
        <Card className="p-3 sm:p-4">
          <div className="text-xl sm:text-2xl font-bold text-yellow-500 dark:text-yellow-400">
            {stats.gold}
          </div>
          <div className="text-[10px] sm:text-xs text-muted-foreground">
            Gold/Platinum
          </div>
        </Card>
      </div>

      {/* ─── Filters ────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-11 sm:h-auto focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all duration-200"
                />
              </div>
            </div>
            <div className="flex gap-3 sm:gap-4">
              <Select value={loyaltyFilter} onValueChange={setLoyaltyFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Loyalty Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tiers</SelectItem>
                  {loyaltyTiers.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={vipFilter} onValueChange={setVipFilter}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue placeholder="VIP" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="vip">VIP Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Guest List ─────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          {isLoading ? (
            <div className="py-2">
              {isLargeDesktop ? (
                <DesktopSkeletonTable />
              ) : (
                <MobileSkeletonCards />
              )}
            </div>
          ) : guests.length === 0 ? (
            <EmptyState />
          ) : isLargeDesktop ? (
            /* ── Desktop: Full Table ─────────────────────────────────── */
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Loyalty</TableHead>
                    <TableHead>Stays</TableHead>
                    <TableHead>Total Spent</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guests.map((guest) => (
                    <DesktopTableRow key={guest.id} guest={guest} />
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : isDesktop ? (
            /* ── Tablet: Compact Cards ───────────────────────────────── */
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {guests.map((guest) => (
                  <GuestCardCompact key={guest.id} guest={guest} />
                ))}
              </div>
            </ScrollArea>
          ) : (
            /* ── Mobile: Full Cards ──────────────────────────────────── */
            <ScrollArea className="h-[calc(100vh-420px)] min-h-[400px]">
              <div className="space-y-3">
                {guests.map((guest) => (
                  <GuestCard key={guest.id} guest={guest} />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* ─── Create Dialog / Drawer ─────────────────────────────────── */}
      {isDesktop ? (
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            {createFormBody}
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DrawerContent className="max-h-[90vh] flex flex-col">
            {createFormBody}
          </DrawerContent>
        </Drawer>
      )}

      {/* ─── Edit Dialog / Drawer ───────────────────────────────────── */}
      {isDesktop ? (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
            {editFormBody}
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DrawerContent className="max-h-[90vh] flex flex-col">
            {editFormBody}
          </DrawerContent>
        </Drawer>
      )}

      {/* ─── Delete Dialog / Drawer ─────────────────────────────────── */}
      {isDesktop ? (
        <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DialogContent>{deleteFormBody}</DialogContent>
        </Dialog>
      ) : (
        <Drawer open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
          <DrawerContent>{deleteFormBody}</DrawerContent>
        </Drawer>
      )}
    </div>
  );
}

// ─── Guest Form Component (responsive) ────────────────────────────────

interface GuestFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  nationality: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  idType: string;
  idNumber: string;
  notes: string;
  loyaltyTier: string;
  isVip: boolean;
  vipLevel: string;
  source: string;
}

interface GuestFormProps {
  formData: GuestFormData;
  setFormData: React.Dispatch<React.SetStateAction<GuestFormData>>;
}

function GuestForm({ formData, setFormData }: GuestFormProps) {
  const isDesktop = useMediaQuery('(min-width: 768px)');

  return (
    <div className="grid gap-4">
      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name *</Label>
          <Input
            id="firstName"
            value={formData.firstName as string}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, firstName: e.target.value }))
            }
            placeholder="John"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            value={formData.lastName as string}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, lastName: e.target.value }))
            }
            placeholder="Smith"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email as string}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, email: e.target.value }))
            }
            placeholder="john.smith@email.com"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone as string}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, phone: e.target.value }))
            }
            placeholder="+1 555 123 4567"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="nationality">Nationality</Label>
          <Input
            id="nationality"
            value={formData.nationality as string}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                nationality: e.target.value,
              }))
            }
            placeholder="United States"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="country">Country</Label>
          <Input
            id="country"
            value={formData.country as string}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, country: e.target.value }))
            }
            placeholder="United States"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="city">City</Label>
          <Input
            id="city"
            value={formData.city as string}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, city: e.target.value }))
            }
            placeholder="New York"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="source">Source</Label>
          <Select
            value={formData.source as string}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, source: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sources.map((source) => (
                <SelectItem key={source.value} value={source.value}>
                  {source.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="loyaltyTier">Loyalty Tier</Label>
          <Select
            value={formData.loyaltyTier as string}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, loyaltyTier: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {loyaltyTiers.map((tier) => (
                <SelectItem key={tier.value} value={tier.value}>
                  {tier.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="isVip">VIP Status</Label>
          <Select
            value={(formData.isVip as boolean) ? 'true' : 'false'}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, isVip: value === 'true' }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="false">Regular Guest</SelectItem>
              <SelectItem value="true">VIP Guest</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes as string}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, notes: e.target.value }))
          }
          placeholder="Special preferences, notes about the guest..."
          rows={3}
        />
      </div>
    </div>
  );
}
