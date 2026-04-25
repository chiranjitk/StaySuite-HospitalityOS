'use client';

import React, { useState, useEffect } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
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
  Gift,
  Search,
  Loader2,
  Star,
  TrendingUp,
  Award,
  Plus,
  Minus,
  History,
  Check,
  Crown,
  Sparkles,
  RefreshCw,
  ChevronRight,
  DollarSign,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useTimezone } from '@/contexts/TimezoneContext';

interface LoyaltyData {
  guest: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    avatarUrl?: string;
    loyaltyTier: string;
    loyaltyPoints: number;
    totalStays: number;
    totalSpent: number;
    isVip: boolean;
    vipLevel?: string;
  };
  loyalty: {
    tier: string;
    points: number;
    totalStays: number;
    totalSpent: number;
    isVip: boolean;
    vipLevel?: string;
    benefits: {
      multiplier: number;
      benefits: string[];
    };
    nextTier: string | null;
    pointsToNextTier: number;
    tierThresholds: Record<string, number>;
  };
  pointsHistory: Array<{
    id: string;
    date: string;
    type: string;
    points: number;
    description: string;
    reference?: string;
  }>;
}

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  avatarUrl?: string;
  loyaltyTier: string;
  loyaltyPoints: number;
  totalStays: number;
  totalSpent: number;
  isVip: boolean;
}

const tierConfig = {
  bronze: {
    label: 'Bronze',
    color: 'bg-amber-700',
    textColor: 'text-amber-700 dark:text-amber-300',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: Award,
  },
  silver: {
    label: 'Silver',
    color: 'bg-gray-400',
    textColor: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-50 dark:bg-gray-800',
    borderColor: 'border-gray-200 dark:border-gray-700',
    icon: Award,
  },
  gold: {
    label: 'Gold',
    color: 'bg-yellow-500',
    textColor: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    icon: Star,
  },
  platinum: {
    label: 'Platinum',
    color: 'bg-slate-600',
    textColor: 'text-slate-600 dark:text-slate-400',
    bgColor: 'bg-slate-50 dark:bg-slate-800',
    borderColor: 'border-slate-200 dark:border-slate-700',
    icon: Crown,
  },
};

const redemptionOptions = [
  { id: 'free_night', name: 'Free Night Stay', points: 5000, value: 150 },
  { id: 'room_upgrade', name: 'Room Upgrade', points: 2000, value: 50 },
  { id: 'spa_voucher', name: 'Spa Voucher', points: 3000, value: 75 },
  { id: 'dinner_voucher', name: 'Dinner Voucher', points: 1500, value: 40 },
  { id: 'airport_transfer', name: 'Airport Transfer', points: 2500, value: 60 },
  { id: 'late_checkout', name: 'Late Checkout', points: 500, value: 25 },
];

export default function LoyaltyManagement() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { formatDate } = useTimezone();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [loyaltyData, setLoyaltyData] = useState<LoyaltyData | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add');
  const [adjustReason, setAdjustReason] = useState('');

  // Stats
  const [stats, setStats] = useState({
    totalMembers: 0,
    totalPoints: 0,
    totalRedemptions: 0,
    avgPointsPerMember: 0,
    tierDistribution: { bronze: 0, silver: 0, gold: 0, platinum: 0 },
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
        const totalPoints = result.data.reduce((sum: number, g: Guest) => sum + (g.loyaltyPoints || 0), 0);
        const tierDistribution = {
          bronze: result.data.filter((g: Guest) => (g.loyaltyTier || 'bronze') === 'bronze').length,
          silver: result.data.filter((g: Guest) => g.loyaltyTier === 'silver').length,
          gold: result.data.filter((g: Guest) => g.loyaltyTier === 'gold').length,
          platinum: result.data.filter((g: Guest) => g.loyaltyTier === 'platinum').length,
        };

        setStats({
          totalMembers: result.data.length,
          totalPoints,
          totalRedemptions: 0, // Would need to track this
          avgPointsPerMember: result.data.length > 0 ? Math.round(totalPoints / result.data.length) : 0,
          tierDistribution,
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

  const fetchLoyaltyDetails = async (guestId: string) => {
    setIsLoadingDetails(true);
    try {
      const response = await fetch(`/api/guests/${guestId}/loyalty`);
      const result = await response.json();

      if (result.success) {
        setLoyaltyData(result.data);
      }
    } catch (error) {
      console.error('Error fetching loyalty details:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch loyalty details',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleOpenDetail = (guest: Guest) => {
    setSelectedGuest(guest);
    setIsDetailOpen(true);
    fetchLoyaltyDetails(guest.id);
  };

  const handleAdjustPoints = async () => {
    if (!selectedGuest || !adjustAmount || parseInt(adjustAmount) <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid point amount',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/guests/${selectedGuest.id}/loyalty`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: parseInt(adjustAmount),
          operation: adjustType,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: `Points ${adjustType === 'add' ? 'added' : 'subtracted'} successfully`,
        });
        setIsAdjustOpen(false);
        setAdjustAmount('');
        setAdjustReason('');
        fetchLoyaltyDetails(selectedGuest.id);
        fetchGuests();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to adjust points',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error adjusting points:', error);
      toast({
        title: 'Error',
        description: 'Failed to adjust points',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredGuests = guests.filter(guest => {
    const matchesSearch =
      guest.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guest.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guest.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTier = tierFilter === 'all' || (guest.loyaltyTier || 'bronze') === tierFilter;
    return matchesSearch && matchesTier;
  });

  const getTierConfig = (tier: string) => {
    return tierConfig[tier as keyof typeof tierConfig] || tierConfig.bronze;
  };

  const formatPoints = (points: number) => {
    return points.toLocaleString();
  };

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
            <Gift className="h-5 w-5" />
            Loyalty & Points Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage guest loyalty programs and reward points
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
              <Users className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.totalMembers}</div>
              <div className="text-xs text-muted-foreground">Total Members</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Star className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatPoints(stats.totalPoints)}</div>
              <div className="text-xs text-muted-foreground">Total Points</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <TrendingUp className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatPoints(stats.avgPointsPerMember)}</div>
              <div className="text-xs text-muted-foreground">Avg Points/Member</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Crown className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.tierDistribution.platinum + stats.tierDistribution.gold}</div>
              <div className="text-xs text-muted-foreground">VIP Members</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Tier Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Tier Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 grid-cols-4">
            {Object.entries(tierConfig).map(([tier, config]) => (
              <div key={tier} className="text-center">
                <div className={cn('w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center', config.color)}>
                  <config.icon className="h-6 w-6 text-white" />
                </div>
                <div className="text-2xl font-bold">{stats.tierDistribution[tier as keyof typeof stats.tierDistribution]}</div>
                <div className="text-xs text-muted-foreground">{config.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="bronze">Bronze</SelectItem>
                <SelectItem value="silver">Silver</SelectItem>
                <SelectItem value="gold">Gold</SelectItem>
                <SelectItem value="platinum">Platinum</SelectItem>
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
              <Gift className="h-12 w-12 mb-4" />
              <p>No guests found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead>Points</TableHead>
                    <TableHead>Total Stays</TableHead>
                    <TableHead>Total Spent</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGuests.map((guest) => {
                    const tierInfo = getTierConfig(guest.loyaltyTier || 'bronze');
                    const TierIcon = tierInfo.icon;

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
                              <p className="text-xs text-muted-foreground">{guest.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={cn('w-6 h-6 rounded-full flex items-center justify-center', tierInfo.color)}>
                              <TierIcon className="h-3 w-3 text-white" />
                            </div>
                            <span className={cn('font-medium', tierInfo.textColor)}>{tierInfo.label}</span>
                            {guest.isVip && (
                              <Badge className="bg-amber-500 text-white text-xs">VIP</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{formatPoints(guest.loyaltyPoints || 0)}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{guest.totalStays || 0} stays</Badge>
                        </TableCell>
                        <TableCell>
                          <span className="font-medium">{formatCurrency(guest.totalSpent || 0)}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenDetail(guest)}
                          >
                            View Details
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

      {/* Guest Loyalty Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Loyalty Details - {selectedGuest?.firstName} {selectedGuest?.lastName}
            </DialogTitle>
            <DialogDescription>
              View and manage loyalty points and tier status
            </DialogDescription>
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : loyaltyData ? (
            <div className="space-y-6 py-4">
              {/* Tier Card */}
              {(() => {
                const currentTierConfig = getTierConfig(loyaltyData.loyalty.tier);
                const TierIcon = currentTierConfig.icon;

                return (
                  <Card className={cn('overflow-hidden', currentTierConfig.bgColor, currentTierConfig.borderColor)}>
                    <div className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={cn('w-16 h-16 rounded-full flex items-center justify-center', currentTierConfig.color)}>
                            <TierIcon className="h-8 w-8 text-white" />
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold">{currentTierConfig.label} Member</h3>
                            <p className="text-muted-foreground">
                              {formatPoints(loyaltyData.loyalty.points)} points
                            </p>
                          </div>
                        </div>
                        {loyaltyData.loyalty.isVip && (
                          <Badge className="bg-amber-500 text-white">
                            <Crown className="h-3 w-3 mr-1" />
                            VIP {loyaltyData.loyalty.vipLevel}
                          </Badge>
                        )}
                      </div>

                      {/* Progress to next tier */}
                      {loyaltyData.loyalty.nextTier && (
                        <div className="mt-6">
                          <Progress value={Math.min((loyaltyData.loyalty.points / loyaltyData.loyalty.tierThresholds[loyaltyData.loyalty.nextTier]) * 100, 100)} className="h-2" />
                          <p className="text-sm text-muted-foreground mt-2">
                            <span className="font-medium">{formatPoints(loyaltyData.loyalty.pointsToNextTier)}</span>
                            {' '}points to {getTierConfig(loyaltyData.loyalty.nextTier).label}
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })()}

              {/* Quick Stats */}
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <Gift className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Points</span>
                  </div>
                  <div className="text-2xl font-bold mt-1">{formatPoints(loyaltyData.loyalty.points)}</div>
                  <div className="text-xs text-muted-foreground">{formatCurrency(loyaltyData.loyalty.points * 0.01)} value</div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Multiplier</span>
                  </div>
                  <div className="text-2xl font-bold mt-1">{loyaltyData.loyalty.benefits.multiplier}x</div>
                  <div className="text-xs text-muted-foreground">Points per $1</div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Total Stays</span>
                  </div>
                  <div className="text-2xl font-bold mt-1">{loyaltyData.loyalty.totalStays}</div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </Card>
                <Card className="p-4">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Total Spent</span>
                  </div>
                  <div className="text-2xl font-bold mt-1">{formatCurrency(loyaltyData.loyalty.totalSpent)}</div>
                  <div className="text-xs text-muted-foreground">Lifetime</div>
                </Card>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <Button onClick={() => setIsAdjustOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adjust Points
                </Button>
              </div>

              {/* Points History */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Points History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loyaltyData.pointsHistory.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">No points history</p>
                  ) : (
                    <ScrollArea className="h-[200px]">
                      <div className="space-y-3">
                        {loyaltyData.pointsHistory.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                          >
                            <div>
                              <p className="font-medium">{item.description}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatDate(item.date)}
                                {item.reference && ` • Ref: ${item.reference}`}
                              </p>
                            </div>
                            <div className={cn(
                              'text-lg font-bold',
                              item.type === 'earned' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'
                            )}>
                              {item.type === 'earned' ? '+' : '-'}{item.points}
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Gift className="h-12 w-12 mx-auto mb-4" />
              <p>No loyalty data found</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Adjust Points Dialog */}
      <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Points</DialogTitle>
            <DialogDescription>
              Add or subtract loyalty points for {selectedGuest?.firstName} {selectedGuest?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Button
                variant={adjustType === 'add' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setAdjustType('add')}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
              <Button
                variant={adjustType === 'subtract' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setAdjustType('subtract')}
              >
                <Minus className="h-4 w-4 mr-2" />
                Subtract
              </Button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="points">Points Amount</Label>
              <Input
                id="points"
                type="number"
                min="1"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="Enter points"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason (Optional)</Label>
              <Input
                id="reason"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g., Compensated for service issue"
              />
            </div>

            {adjustAmount && loyaltyData && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm">
                  Current balance: <span className="font-bold">{formatPoints(loyaltyData.loyalty.points)}</span>
                </p>
                <p className="text-sm">
                  New balance: <span className="font-bold">
                    {formatPoints(adjustType === 'add'
                      ? loyaltyData.loyalty.points + parseInt(adjustAmount || '0')
                      : Math.max(0, loyaltyData.loyalty.points - parseInt(adjustAmount || '0'))
                    )}
                  </span>
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAdjustOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdjustPoints} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {adjustType === 'add' ? 'Add Points' : 'Subtract Points'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
