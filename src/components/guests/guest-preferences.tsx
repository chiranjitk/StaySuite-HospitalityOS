'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Heart,
  Save,
  Loader2,
  Coffee,
  BedDouble,
  Utensils,
  Car,
  Accessibility,
  Ban,
  PawPrint,
  Baby,
  Languages,
  Building,
  CigaretteOff,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface GuestPreferencesProps {
  guestId: string;
}

interface Preferences {
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

const defaultPreferences: Preferences = {
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

export function GuestPreferences({ guestId }: GuestPreferencesProps) {
  const { toast } = useToast();
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState<'room' | 'dietary' | 'amenities' | 'communication'>('room');

  useEffect(() => {
    fetchPreferences();
  }, [guestId]);

  const fetchPreferences = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/guests/${guestId}`);
      const result = await response.json();
      
      if (result.success && result.data.preferences) {
        // Merge with defaults
        setPreferences({
          ...defaultPreferences,
          ...result.data.preferences,
          roomPreferences: {
            ...defaultPreferences.roomPreferences,
            ...(result.data.preferences.roomPreferences || {}),
          },
          dietaryPreferences: {
            ...defaultPreferences.dietaryPreferences,
            ...(result.data.preferences.dietaryPreferences || {}),
          },
          amenities: {
            ...defaultPreferences.amenities,
            ...(result.data.preferences.amenities || {}),
          },
          communication: {
            ...defaultPreferences.communication,
            ...(result.data.preferences.communication || {}),
          },
        });
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch preferences',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/guests/${guestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Preferences saved successfully',
        });
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

  const updateRoomPreference = (key: keyof Preferences['roomPreferences'], value: boolean | string) => {
    setPreferences(prev => ({
      ...prev,
      roomPreferences: {
        ...prev.roomPreferences,
        [key]: value,
      },
    }));
  };

  const updateDietaryPreference = (key: keyof Preferences['dietaryPreferences'], value: boolean | string | string[]) => {
    setPreferences(prev => ({
      ...prev,
      dietaryPreferences: {
        ...prev.dietaryPreferences,
        [key]: value,
      },
    }));
  };

  const updateAmenity = (key: keyof Preferences['amenities'], value: boolean) => {
    setPreferences(prev => ({
      ...prev,
      amenities: {
        ...prev.amenities,
        [key]: value,
      },
    }));
  };

  const updateCommunication = (key: keyof Preferences['communication'], value: boolean | string) => {
    setPreferences(prev => ({
      ...prev,
      communication: {
        ...prev.communication,
        [key]: value,
      },
    }));
  };

  const toggleAllergy = (allergy: string) => {
    const current = preferences.dietaryPreferences.allergies;
    if (current.includes(allergy)) {
      updateDietaryPreference('allergies', current.filter(a => a !== allergy));
    } else {
      updateDietaryPreference('allergies', [...current, allergy]);
    }
  };

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section Tabs */}
      <div className="flex gap-2 flex-wrap">
        {[
          { id: 'room', label: 'Room', icon: BedDouble },
          { id: 'dietary', label: 'Dietary', icon: Utensils },
          { id: 'amenities', label: 'Amenities', icon: Coffee },
          { id: 'communication', label: 'Communication', icon: Languages },
        ].map((section) => (
          <Button
            key={section.id}
            variant={activeSection === section.id ? 'default' : 'outline'}
            onClick={() => setActiveSection(section.id as typeof activeSection)}
          >
            <section.icon className="h-4 w-4 mr-2" />
            {section.label}
          </Button>
        ))}
      </div>

      {/* Room Preferences */}
      {activeSection === 'room' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BedDouble className="h-5 w-5" />
              Room Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Preferred Floor</Label>
                <Select
                  value={preferences.roomPreferences.floor}
                  onValueChange={(value) => updateRoomPreference('floor', value)}
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
                  value={preferences.roomPreferences.bedType}
                  onValueChange={(value) => updateRoomPreference('bedType', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {bedTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Pillow Type</Label>
                <Select
                  value={preferences.roomPreferences.pillowType}
                  onValueChange={(value) => updateRoomPreference('pillowType', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pillowTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Room Temperature</Label>
                <Select
                  value={preferences.roomPreferences.roomTemperature}
                  onValueChange={(value) => updateRoomPreference('roomTemperature', value)}
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

            <div className="space-y-4">
              <Label className="text-base">Room Features</Label>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
                {[
                  { key: 'nonSmoking', label: 'Non-Smoking', icon: Ban },
                  { key: 'quietRoom', label: 'Quiet Room', icon: BedDouble },
                  { key: 'highFloor', label: 'High Floor', icon: Building },
                  { key: 'nearElevator', label: 'Near Elevator', icon: Building },
                  { key: 'awayFromElevator', label: 'Away From Elevator', icon: Building },
                  { key: 'connectingRoom', label: 'Connecting Room', icon: BedDouble },
                ].map((feature) => (
                  <div
                    key={feature.key}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <span className="text-sm">{feature.label}</span>
                    <Switch
                      checked={preferences.roomPreferences[feature.key as keyof Preferences['roomPreferences']] as boolean}
                      onCheckedChange={(checked) =>
                        updateRoomPreference(feature.key as keyof Preferences['roomPreferences'], checked)
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dietary Preferences */}
      {activeSection === 'dietary' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Utensils className="h-5 w-5" />
              Dietary Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <Label className="text-base">Dietary Requirements</Label>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-3">
                {[
                  { key: 'vegetarian', label: 'Vegetarian' },
                  { key: 'vegan', label: 'Vegan' },
                  { key: 'glutenFree', label: 'Gluten Free' },
                  { key: 'halal', label: 'Halal' },
                  { key: 'kosher', label: 'Kosher' },
                ].map((diet) => (
                  <div
                    key={diet.key}
                    className="flex items-center justify-between p-3 rounded-lg border"
                  >
                    <span className="text-sm">{diet.label}</span>
                    <Switch
                      checked={preferences.dietaryPreferences[diet.key as keyof Preferences['dietaryPreferences']] as boolean}
                      onCheckedChange={(checked) =>
                        updateDietaryPreference(diet.key as keyof Preferences['dietaryPreferences'], checked)
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-base">Allergies</Label>
              <div className="flex flex-wrap gap-2">
                {commonAllergies.map((allergy) => (
                  <Badge
                    key={allergy}
                    variant={preferences.dietaryPreferences.allergies.includes(allergy) ? 'default' : 'outline'}
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
                value={preferences.dietaryPreferences.otherRestrictions}
                onChange={(e) => updateDietaryPreference('otherRestrictions', e.target.value)}
                placeholder="Any other dietary requirements or restrictions..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Amenities */}
      {activeSection === 'amenities' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Coffee className="h-5 w-5" />
              Amenity Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
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
                    preferences.amenities[amenity.key as keyof Preferences['amenities']]
                      ? 'bg-emerald-50 border-emerald-200'
                      : 'hover:bg-muted/50'
                  )}
                  onClick={() =>
                    updateAmenity(
                      amenity.key as keyof Preferences['amenities'],
                      !preferences.amenities[amenity.key as keyof Preferences['amenities']]
                    )
                  }
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{amenity.icon}</span>
                      <span className="text-sm font-medium">{amenity.label}</span>
                    </div>
                    {preferences.amenities[amenity.key as keyof Preferences['amenities']] && (
                      <Badge className="bg-emerald-500">Selected</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Communication */}
      {activeSection === 'communication' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Languages className="h-5 w-5" />
              Communication Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Preferred Language</Label>
              <Select
                value={preferences.communication.preferredLanguage}
                onValueChange={(value) => updateCommunication('preferredLanguage', value)}
              >
                <SelectTrigger className="w-full md:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4">
              <Label className="text-base">Notifications</Label>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">Email Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Receive booking confirmations and updates via email
                    </p>
                  </div>
                  <Switch
                    checked={preferences.communication.emailNotifications}
                    onCheckedChange={(checked) => updateCommunication('emailNotifications', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">SMS Notifications</p>
                    <p className="text-sm text-muted-foreground">
                      Receive important alerts via SMS
                    </p>
                  </div>
                  <Switch
                    checked={preferences.communication.smsNotifications}
                    onCheckedChange={(checked) => updateCommunication('smsNotifications', checked)}
                  />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium">Marketing Communications</p>
                    <p className="text-sm text-muted-foreground">
                      Receive special offers and promotional content
                    </p>
                  </div>
                  <Switch
                    checked={preferences.communication.marketingOptIn}
                    onCheckedChange={(checked) => updateCommunication('marketingOptIn', checked)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Other Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Other Preferences & Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={preferences.otherPreferences}
            onChange={(e) =>
              setPreferences(prev => ({ ...prev, otherPreferences: e.target.value }))
            }
            placeholder="Any other preferences or special requests..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} className="min-w-32">
          {isSaving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Preferences
        </Button>
      </div>
    </div>
  );
}
