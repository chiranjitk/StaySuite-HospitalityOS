'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Bed,
  Coffee,
  Utensils,
  MessageSquare,
  Settings2,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Preferences {
  // Room Preferences
  floorPreference?: string;
  bedType?: string;
  pillowType?: string;
  temperature?: string;
  quietRoom?: boolean;
  highFloor?: boolean;
  nearElevator?: boolean;
  awayFromElevator?: boolean;
  
  // Dietary Preferences
  vegetarian?: boolean;
  vegan?: boolean;
  glutenFree?: boolean;
  halal?: boolean;
  kosher?: boolean;
  allergies?: string[];
  
  // Amenities
  extraTowels?: boolean;
  extraPillows?: boolean;
  ironBoard?: boolean;
  cribRequest?: boolean;
  wheelchairAccessible?: boolean;
  petFriendly?: boolean;
  
  // Communication
  language?: string;
  emailNotifications?: boolean;
  smsNotifications?: boolean;
  marketingOptIn?: boolean;
}

interface PreferenceSelectionProps {
  token: string;
  initialPreferences: Preferences;
  isComplete: boolean;
  onUpdate: (preferences: Preferences) => void;
  onComplete: () => void;
}

const floorOptions = [
  { value: 'no_preference', label: 'No Preference' },
  { value: 'low', label: 'Low Floor (1-3)' },
  { value: 'medium', label: 'Medium Floor (4-6)' },
  { value: 'high', label: 'High Floor (7+)' },
];

const bedTypes = [
  { value: 'no_preference', label: 'No Preference' },
  { value: 'king', label: 'King Bed' },
  { value: 'queen', label: 'Queen Bed' },
  { value: 'twin', label: 'Twin Beds' },
];

const pillowTypes = [
  { value: 'no_preference', label: 'No Preference' },
  { value: 'soft', label: 'Soft' },
  { value: 'medium', label: 'Medium' },
  { value: 'firm', label: 'Firm' },
  { value: 'hypoallergenic', label: 'Hypoallergenic' },
];

const temperaturePrefs = [
  { value: 'no_preference', label: 'No Preference' },
  { value: 'cool', label: 'Cool (18-20°C)' },
  { value: 'moderate', label: 'Moderate (21-23°C)' },
  { value: 'warm', label: 'Warm (24-26°C)' },
];

const languages = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ar', label: 'Arabic' },
];

const commonAllergies = [
  'Peanuts', 'Tree Nuts', 'Dairy', 'Eggs', 'Shellfish',
  'Soy', 'Wheat', 'Fish', 'Sesame',
];

export function PreferenceSelection({ 
  token, 
  initialPreferences, 
  isComplete, 
  onUpdate, 
  onComplete 
}: PreferenceSelectionProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>(initialPreferences);

  useEffect(() => {
    setPreferences(initialPreferences);
  }, [initialPreferences]);

  const updatePreference = <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const toggleAllergy = (allergy: string) => {
    setPreferences(prev => {
      const current = prev.allergies || [];
      const updated = current.includes(allergy)
        ? current.filter(a => a !== allergy)
        : [...current, allergy];
      return { ...prev, allergies: updated };
    });
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      // In a real implementation, we'd call an API to save preferences
      // For now, we'll just update the local state and mark as complete
      
      // Simulating API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      toast({
        title: 'Success',
        description: 'Preferences saved successfully',
      });
      onUpdate(preferences);
      onComplete();
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast({
        title: 'Error',
        description: 'Failed to save preferences',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const hasPreferences = Object.values(preferences).some(v => 
    v === true || (Array.isArray(v) && v.length > 0) || (typeof v === 'string' && v && v !== 'no_preference')
  );

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
              <Settings2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Preferences</CardTitle>
              <CardDescription>Customize your stay experience</CardDescription>
            </div>
          </div>
          {isComplete || hasPreferences ? (
            <Badge className="bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Saved
            </Badge>
          ) : (
            <Badge variant="secondary">
              Optional
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="room" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="room" className="text-xs">
              <Bed className="h-3 w-3 mr-1" />
              Room
            </TabsTrigger>
            <TabsTrigger value="dietary" className="text-xs">
              <Utensils className="h-3 w-3 mr-1" />
              Dietary
            </TabsTrigger>
            <TabsTrigger value="amenities" className="text-xs">
              <Coffee className="h-3 w-3 mr-1" />
              Amenities
            </TabsTrigger>
            <TabsTrigger value="communication" className="text-xs">
              <MessageSquare className="h-3 w-3 mr-1" />
              Comm.
            </TabsTrigger>
          </TabsList>

          {/* Room Preferences */}
          <TabsContent value="room" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Floor Preference</Label>
                <Select
                  value={preferences.floorPreference || 'no_preference'}
                  onValueChange={(value) => updatePreference('floorPreference', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {floorOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Bed Type</Label>
                <Select
                  value={preferences.bedType || 'no_preference'}
                  onValueChange={(value) => updatePreference('bedType', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {bedTypes.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pillow Type</Label>
                <Select
                  value={preferences.pillowType || 'no_preference'}
                  onValueChange={(value) => updatePreference('pillowType', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {pillowTypes.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Temperature</Label>
                <Select
                  value={preferences.temperature || 'no_preference'}
                  onValueChange={(value) => updatePreference('temperature', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {temperaturePrefs.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-3 pt-2">
              <Label className="text-sm font-medium">Additional Room Preferences</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'quietRoom', label: 'Quiet Room' },
                  { key: 'highFloor', label: 'High Floor' },
                  { key: 'nearElevator', label: 'Near Elevator' },
                  { key: 'awayFromElevator', label: 'Away from Elevator' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <span className="text-sm">{label}</span>
                    <Switch
                      checked={preferences[key as keyof Preferences] as boolean}
                      onCheckedChange={(checked) => updatePreference(key as keyof Preferences, checked)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Dietary Preferences */}
          <TabsContent value="dietary" className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Dietary Requirements</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'vegetarian', label: 'Vegetarian' },
                  { key: 'vegan', label: 'Vegan' },
                  { key: 'glutenFree', label: 'Gluten-Free' },
                  { key: 'halal', label: 'Halal' },
                  { key: 'kosher', label: 'Kosher' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <span className="text-sm">{label}</span>
                    <Switch
                      checked={preferences[key as keyof Preferences] as boolean}
                      onCheckedChange={(checked) => updatePreference(key as keyof Preferences, checked)}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-medium">Allergies</Label>
              <div className="grid grid-cols-3 gap-2">
                {commonAllergies.map((allergy) => {
                  const isSelected = preferences.allergies?.includes(allergy);
                  return (
                    <button
                      key={allergy}
                      onClick={() => toggleAllergy(allergy)}
                      className={cn(
                        "p-2 rounded-lg border text-xs font-medium transition-colors",
                        isSelected
                          ? "bg-red-100 border-red-300 text-red-700"
                          : "bg-muted/50 border-transparent hover:bg-muted"
                      )}
                    >
                      {allergy}
                    </button>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          {/* Amenities */}
          <TabsContent value="amenities" className="space-y-4">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Room Amenities</Label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'extraTowels', label: 'Extra Towels' },
                  { key: 'extraPillows', label: 'Extra Pillows' },
                  { key: 'ironBoard', label: 'Iron & Board' },
                  { key: 'cribRequest', label: 'Baby Crib' },
                  { key: 'wheelchairAccessible', label: 'Wheelchair Accessible' },
                  { key: 'petFriendly', label: 'Pet-Friendly Room' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <span className="text-sm">{label}</span>
                    <Switch
                      checked={preferences[key as keyof Preferences] as boolean}
                      onCheckedChange={(checked) => updatePreference(key as keyof Preferences, checked)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* Communication */}
          <TabsContent value="communication" className="space-y-4">
            <div className="space-y-3">
              <Label>Preferred Language</Label>
              <Select
                value={preferences.language || 'en'}
                onValueChange={(value) => updatePreference('language', value)}
              >
                <SelectTrigger>
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

            <div className="space-y-3">
              <Label className="text-sm font-medium">Notification Preferences</Label>
              <div className="space-y-2">
                {[
                  { key: 'emailNotifications', label: 'Email Notifications', description: 'Receive booking updates via email' },
                  { key: 'smsNotifications', label: 'SMS Notifications', description: 'Receive text messages for important updates' },
                  { key: 'marketingOptIn', label: 'Marketing Communications', description: 'Receive special offers and promotions' },
                ].map(({ key, label, description }) => (
                  <div key={key} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{description}</p>
                    </div>
                    <Switch
                      checked={preferences[key as keyof Preferences] as boolean}
                      onCheckedChange={(checked) => updatePreference(key as keyof Preferences, checked)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Button className="w-full mt-4" onClick={handleSave} disabled={isLoading}>
          {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Preferences
        </Button>
      </CardContent>
    </Card>
  );
}
