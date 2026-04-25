'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Heart,
  Search,
  Loader2,
  Save,
  Coffee,
  BedDouble,
  Utensils,
  Languages,
  Building,
  CigaretteOff,
  Ban,
  PawPrint,
  Baby,
  Accessibility,
  RefreshCw,
  ChevronRight,
  Settings,
  Check,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface GuestPreferences {
  roomPreferences: {
    floor: string;
    bedType: string;
    pillowType: string;
    roomTemperature: string;
    quietRoom: boolean;
    highFloor: boolean;
    nearElevator: boolean;
    awayFromElevator: boolean;
    connectingRoom: boolean;
    nonSmoking: boolean;
  };
  dietaryPreferences: {
    vegetarian: boolean;
    vegan: boolean;
    glutenFree: boolean;
    halal: boolean;
    kosher: boolean;
    allergies: string[];
    otherRestrictions: string;
  };
  amenities: {
    extraTowels: boolean;
    extraPillows: boolean;
    ironBoard: boolean;
    babyCrib: boolean;
    wheelchairAccess: boolean;
    petFriendly: boolean;
  };
  communication: {
    preferredLanguage: string;
    emailNotifications: boolean;
    smsNotifications: boolean;
    marketingOptIn: boolean;
  };
  otherPreferences: string;
}

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  avatarUrl?: string;
  preferences?: GuestPreferences;
}

const defaultPreferences: GuestPreferences = {
  roomPreferences: {
    floor: 'any',
    bedType: 'any',
    pillowType: 'standard',
    roomTemperature: 'comfortable',
    quietRoom: false,
    highFloor: false,
    nearElevator: false,
    awayFromElevator: false,
    connectingRoom: false,
    nonSmoking: true,
  },
  dietaryPreferences: {
    vegetarian: false,
    vegan: false,
    glutenFree: false,
    halal: false,
    kosher: false,
    allergies: [],
    otherRestrictions: '',
  },
  amenities: {
    extraTowels: false,
    extraPillows: false,
    ironBoard: false,
    babyCrib: false,
    wheelchairAccess: false,
    petFriendly: false,
  },
  communication: {
    preferredLanguage: 'en',
    emailNotifications: true,
    smsNotifications: false,
    marketingOptIn: false,
  },
  otherPreferences: '',
};

const languages = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ar', label: 'Arabic' },
  { value: 'pt', label: 'Portuguese' },
];

const bedTypes = [
  { value: 'any', label: 'No Preference' },
  { value: 'king', label: 'King Bed' },
  { value: 'queen', label: 'Queen Bed' },
  { value: 'twin', label: 'Twin Beds' },
  { value: 'single', label: 'Single Bed' },
];

const pillowTypes = [
  { value: 'standard', label: 'Standard' },
  { value: 'firm', label: 'Firm' },
  { value: 'soft', label: 'Soft' },
  { value: 'memory_foam', label: 'Memory Foam' },
  { value: 'hypoallergenic', label: 'Hypoallergenic' },
];

const commonAllergies = [
  'Peanuts',
  'Shellfish',
  'Dairy',
  'Gluten',
  'Eggs',
  'Soy',
  'Tree Nuts',
  'Fish',
];

const preferenceCategories = [
  { id: 'room', label: 'Room', icon: BedDouble },
  { id: 'dietary', label: 'Dietary', icon: Utensils },
  { id: 'amenities', label: 'Amenities', icon: Coffee },
  { id: 'communication', label: 'Communication', icon: Languages },
];

export default function PreferencesManagement() {
  const { toast } = useToast();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('room');
  const [editPreferences, setEditPreferences] = useState<GuestPreferences>(defaultPreferences);

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    withPreferences: 0,
    dietaryRestrictions: 0,
    specialRequests: 0,
  });

  useEffect(() => {
    fetchGuests();
  }, []);

  const fetchGuests = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/guests?limit=100');
      const result = await response.json();

      if (result.success) {
        setGuests(result.data);

        // Calculate stats
        const withPrefs = result.data.filter((g: Guest) => g.preferences && Object.keys(g.preferences).length > 0).length;
        const dietary = result.data.filter((g: Guest) => {
          const d = g.preferences?.dietaryPreferences;
          return d && (d.vegetarian || d.vegan || d.glutenFree || d.halal || d.kosher || d.allergies?.length > 0);
        }).length;
        const special = result.data.filter((g: Guest) => g.preferences?.otherPreferences).length;

        setStats({
          total: result.data.length,
          withPreferences: withPrefs,
          dietaryRestrictions: dietary,
          specialRequests: special,
        });
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

  const handleSavePreferences = async () => {
    if (!selectedGuest) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/guests/${selectedGuest.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: editPreferences }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Preferences saved successfully',
        });
        setIsEditOpen(false);
        fetchGuests();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to save preferences',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to save preferences',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditDialog = (guest: Guest) => {
    setSelectedGuest(guest);
    setEditPreferences({
      ...defaultPreferences,
      ...guest.preferences,
      roomPreferences: {
        ...defaultPreferences.roomPreferences,
        ...(guest.preferences?.roomPreferences || {}),
      },
      dietaryPreferences: {
        ...defaultPreferences.dietaryPreferences,
        ...(guest.preferences?.dietaryPreferences || {}),
      },
      amenities: {
        ...defaultPreferences.amenities,
        ...(guest.preferences?.amenities || {}),
      },
      communication: {
        ...defaultPreferences.communication,
        ...(guest.preferences?.communication || {}),
      },
    });
    setActiveTab('room');
    setIsEditOpen(true);
  };

  const toggleAllergy = (allergy: string) => {
    const current = editPreferences.dietaryPreferences.allergies || [];
    if (current.includes(allergy)) {
      setEditPreferences({
        ...editPreferences,
        dietaryPreferences: {
          ...editPreferences.dietaryPreferences,
          allergies: current.filter(a => a !== allergy),
        },
      });
    } else {
      setEditPreferences({
        ...editPreferences,
        dietaryPreferences: {
          ...editPreferences.dietaryPreferences,
          allergies: [...current, allergy],
        },
      });
    }
  };

  const getPreferenceSummary = (guest: Guest) => {
    const prefs = guest.preferences;
    if (!prefs) return { count: 0, tags: [] as string[] };

    let count = 0;
    const tags: string[] = [];

    if (prefs.roomPreferences) {
      if (prefs.roomPreferences.nonSmoking) { count++; tags.push('Non-Smoking'); }
      if (prefs.roomPreferences.highFloor) { count++; tags.push('High Floor'); }
      if (prefs.roomPreferences.quietRoom) { count++; tags.push('Quiet Room'); }
    }
    if (prefs.dietaryPreferences) {
      if (prefs.dietaryPreferences.vegetarian) { count++; tags.push('Vegetarian'); }
      if (prefs.dietaryPreferences.vegan) { count++; tags.push('Vegan'); }
      if (prefs.dietaryPreferences.glutenFree) { count++; tags.push('Gluten Free'); }
      if (prefs.dietaryPreferences.halal) { count++; tags.push('Halal'); }
      if (prefs.dietaryPreferences.kosher) { count++; tags.push('Kosher'); }
      if (prefs.dietaryPreferences.allergies?.length) { count++; tags.push(`${prefs.dietaryPreferences.allergies.length} Allergies`); }
    }
    if (prefs.amenities) {
      if (prefs.amenities.extraTowels) { count++; tags.push('Extra Towels'); }
      if (prefs.amenities.extraPillows) { count++; tags.push('Extra Pillows'); }
      if (prefs.amenities.wheelchairAccess) { count++; tags.push('Wheelchair'); }
      if (prefs.amenities.petFriendly) { count++; tags.push('Pet Friendly'); }
    }

    return { count, tags: tags.slice(0, 4) };
  };

  const filteredGuests = guests.filter(guest => {
    const matchesSearch =
      guest.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guest.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guest.email?.toLowerCase().includes(searchQuery.toLowerCase());

    if (categoryFilter === 'all') return matchesSearch;
    if (categoryFilter === 'room') {
      const prefs = guest.preferences?.roomPreferences;
      return matchesSearch && prefs && (
        prefs.nonSmoking || prefs.highFloor || prefs.quietRoom || prefs.nearElevator
      );
    }
    if (categoryFilter === 'dietary') {
      const prefs = guest.preferences?.dietaryPreferences;
      return matchesSearch && prefs && (
        prefs.vegetarian || prefs.vegan || prefs.glutenFree || prefs.halal || prefs.kosher || prefs.allergies?.length > 0
      );
    }
    if (categoryFilter === 'amenities') {
      const prefs = guest.preferences?.amenities;
      return matchesSearch && prefs && (
        prefs.extraTowels || prefs.extraPillows || prefs.babyCrib || prefs.wheelchairAccess || prefs.petFriendly
      );
    }

    return matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Heart className="h-5 w-5" />
            Guest Preferences Management
          </h2>
          <p className="text-sm text-muted-foreground">
            View and manage all guest preferences in one place
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchGuests}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Heart className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Guests</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.withPreferences}</div>
              <div className="text-xs text-muted-foreground">With Preferences</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Utensils className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.dietaryRestrictions}</div>
              <div className="text-xs text-muted-foreground">Dietary Restrictions</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Settings className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.specialRequests}</div>
              <div className="text-xs text-muted-foreground">Special Requests</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="room">Room Preferences</SelectItem>
                <SelectItem value="dietary">Dietary Restrictions</SelectItem>
                <SelectItem value="amenities">Amenity Requests</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Guests Table */}
      <Card>
        <CardContent className="p-0">
          {filteredGuests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Heart className="h-12 w-12 mb-4" />
              <p>No guests found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead>Preferences</TableHead>
                    <TableHead>Quick Tags</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGuests.map((guest) => {
                    const summary = getPreferenceSummary(guest);

                    return (
                      <TableRow key={guest.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={guest.avatarUrl} />
                              <AvatarFallback>
                                {guest.firstName[0]}{guest.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{guest.firstName} {guest.lastName}</p>
                              <p className="text-xs text-muted-foreground">{guest.email || guest.phone}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {summary.count} preferences
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {summary.tags.length > 0 ? (
                              summary.tags.map((tag, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">No preferences set</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(guest)}
                          >
                            <Settings className="h-4 w-4 mr-1" />
                            Edit
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Edit Preferences Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Edit Preferences - {selectedGuest?.firstName} {selectedGuest?.lastName}
            </DialogTitle>
            <DialogDescription>
              Manage guest preferences and special requests
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-4 w-full">
              {preferenceCategories.map((cat) => (
                <TabsTrigger key={cat.id} value={cat.id}>
                  <cat.icon className="h-4 w-4 mr-1" />
                  {cat.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* Room Preferences */}
            <TabsContent value="room" className="space-y-4 py-4">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Preferred Floor</Label>
                  <Select
                    value={editPreferences.roomPreferences.floor}
                    onValueChange={(value) => setEditPreferences({
                      ...editPreferences,
                      roomPreferences: { ...editPreferences.roomPreferences, floor: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">No Preference</SelectItem>
                      <SelectItem value="low">Low Floor (1-3)</SelectItem>
                      <SelectItem value="mid">Mid Floor (4-6)</SelectItem>
                      <SelectItem value="high">High Floor (7+)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Bed Type</Label>
                  <Select
                    value={editPreferences.roomPreferences.bedType}
                    onValueChange={(value) => setEditPreferences({
                      ...editPreferences,
                      roomPreferences: { ...editPreferences.roomPreferences, bedType: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {bedTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Pillow Type</Label>
                  <Select
                    value={editPreferences.roomPreferences.pillowType}
                    onValueChange={(value) => setEditPreferences({
                      ...editPreferences,
                      roomPreferences: { ...editPreferences.roomPreferences, pillowType: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {pillowTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Room Temperature</Label>
                  <Select
                    value={editPreferences.roomPreferences.roomTemperature}
                    onValueChange={(value) => setEditPreferences({
                      ...editPreferences,
                      roomPreferences: { ...editPreferences.roomPreferences, roomTemperature: value }
                    })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cool">Cool (18-20°C)</SelectItem>
                      <SelectItem value="comfortable">Comfortable (21-23°C)</SelectItem>
                      <SelectItem value="warm">Warm (24-26°C)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-3">
                <Label>Room Features</Label>
                <div className="grid gap-2 grid-cols-2">
                  {[
                    { key: 'nonSmoking', label: 'Non-Smoking' },
                    { key: 'quietRoom', label: 'Quiet Room' },
                    { key: 'highFloor', label: 'High Floor' },
                    { key: 'nearElevator', label: 'Near Elevator' },
                    { key: 'awayFromElevator', label: 'Away From Elevator' },
                    { key: 'connectingRoom', label: 'Connecting Room' },
                  ].map((feature) => (
                    <div key={feature.key} className="flex items-center justify-between p-2 rounded-lg border">
                      <span className="text-sm">{feature.label}</span>
                      <Switch
                        checked={editPreferences.roomPreferences[feature.key as keyof typeof editPreferences.roomPreferences] as boolean}
                        onCheckedChange={(checked) => setEditPreferences({
                          ...editPreferences,
                          roomPreferences: { ...editPreferences.roomPreferences, [feature.key]: checked }
                        })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {/* Dietary Preferences */}
            <TabsContent value="dietary" className="space-y-4 py-4">
              <div className="space-y-3">
                <Label>Dietary Requirements</Label>
                <div className="grid gap-2 grid-cols-2">
                  {[
                    { key: 'vegetarian', label: 'Vegetarian' },
                    { key: 'vegan', label: 'Vegan' },
                    { key: 'glutenFree', label: 'Gluten Free' },
                    { key: 'halal', label: 'Halal' },
                    { key: 'kosher', label: 'Kosher' },
                  ].map((diet) => (
                    <div key={diet.key} className="flex items-center justify-between p-2 rounded-lg border">
                      <span className="text-sm">{diet.label}</span>
                      <Switch
                        checked={editPreferences.dietaryPreferences[diet.key as keyof typeof editPreferences.dietaryPreferences] as boolean}
                        onCheckedChange={(checked) => setEditPreferences({
                          ...editPreferences,
                          dietaryPreferences: { ...editPreferences.dietaryPreferences, [diet.key]: checked }
                        })}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Allergies</Label>
                <div className="flex flex-wrap gap-2">
                  {commonAllergies.map((allergy) => (
                    <Badge
                      key={allergy}
                      variant={editPreferences.dietaryPreferences.allergies?.includes(allergy) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleAllergy(allergy)}
                    >
                      {allergy}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Other Dietary Restrictions</Label>
                <Textarea
                  value={editPreferences.dietaryPreferences.otherRestrictions}
                  onChange={(e) => setEditPreferences({
                    ...editPreferences,
                    dietaryPreferences: { ...editPreferences.dietaryPreferences, otherRestrictions: e.target.value }
                  })}
                  placeholder="Any other dietary requirements..."
                  rows={3}
                />
              </div>
            </TabsContent>

            {/* Amenities */}
            <TabsContent value="amenities" className="space-y-4 py-4">
              <div className="grid gap-3 grid-cols-2">
                {[
                  { key: 'extraTowels', label: 'Extra Towels', icon: '🛁' },
                  { key: 'extraPillows', label: 'Extra Pillows', icon: '🛏️' },
                  { key: 'ironBoard', label: 'Iron & Board', icon: '👔' },
                  { key: 'babyCrib', label: 'Baby Crib', icon: '👶' },
                  { key: 'wheelchairAccess', label: 'Wheelchair Access', icon: '♿' },
                  { key: 'petFriendly', label: 'Pet Friendly', icon: '🐕' },
                ].map((amenity) => (
                  <div
                    key={amenity.key}
                    className={cn(
                      'p-4 rounded-lg border cursor-pointer transition-colors',
                      editPreferences.amenities[amenity.key as keyof typeof editPreferences.amenities]
                        ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                        : 'hover:bg-muted/50'
                    )}
                    onClick={() => setEditPreferences({
                      ...editPreferences,
                      amenities: {
                        ...editPreferences.amenities,
                        [amenity.key]: !editPreferences.amenities[amenity.key as keyof typeof editPreferences.amenities]
                      }
                    })}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{amenity.icon}</span>
                        <span className="text-sm font-medium">{amenity.label}</span>
                      </div>
                      {editPreferences.amenities[amenity.key as keyof typeof editPreferences.amenities] && (
                        <Badge className="bg-emerald-500">Selected</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Communication */}
            <TabsContent value="communication" className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Preferred Language</Label>
                <Select
                  value={editPreferences.communication.preferredLanguage}
                  onValueChange={(value) => setEditPreferences({
                    ...editPreferences,
                    communication: { ...editPreferences.communication, preferredLanguage: value }
                  })}
                >
                  <SelectTrigger className="w-full md:w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Notifications</Label>
                {[
                  { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive booking confirmations and updates' },
                  { key: 'smsNotifications', label: 'SMS Notifications', desc: 'Receive important alerts via SMS' },
                  { key: 'marketingOptIn', label: 'Marketing Communications', desc: 'Receive special offers and promotions' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      checked={editPreferences.communication[item.key as keyof typeof editPreferences.communication] as boolean}
                      onCheckedChange={(checked) => setEditPreferences({
                        ...editPreferences,
                        communication: { ...editPreferences.communication, [item.key]: checked }
                      })}
                    />
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>

          {/* Other Preferences */}
          <div className="space-y-2 pt-4 border-t">
            <Label>Other Preferences & Notes</Label>
            <Textarea
              value={editPreferences.otherPreferences}
              onChange={(e) => setEditPreferences({ ...editPreferences, otherPreferences: e.target.value })}
              placeholder="Any other preferences or special requests..."
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePreferences} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Save className="h-4 w-4 mr-2" />
              Save Preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
