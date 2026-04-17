'use client';

import React, { useState, useEffect } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  Gift,
  Star,
  TrendingUp,
  Award,
  Loader2,
  Plus,
  Minus,
  History,
  Check,
  Crown,
  Sparkles,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTimezone } from '@/contexts/TimezoneContext';
import { cn } from '@/lib/utils';

interface LoyaltyData {
  guest: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
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

interface LoyaltyPointsProps {
  guestId: string;
}

const tierConfig = {
  bronze: {
    label: 'Bronze',
    color: 'bg-amber-700',
    textColor: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    icon: Award,
  },
  silver: {
    label: 'Silver',
    color: 'bg-gray-400',
    textColor: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    icon: Award,
  },
  gold: {
    label: 'Gold',
    color: 'bg-yellow-500',
    textColor: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    icon: Star,
  },
  platinum: {
    label: 'Platinum',
    color: 'bg-slate-600',
    textColor: 'text-slate-600',
    bgColor: 'bg-slate-50',
    borderColor: 'border-slate-200',
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

export function LoyaltyPoints({ guestId }: LoyaltyPointsProps) {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { formatDate } = useTimezone();
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isRedeemOpen, setIsRedeemOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Form state
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add');
  const [adjustReason, setAdjustReason] = useState('');
  const [selectedRedemption, setSelectedRedemption] = useState<string | null>(null);

  useEffect(() => {
    fetchLoyaltyData();
  }, [guestId]);

  const fetchLoyaltyData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/guests/${guestId}/loyalty`);
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error('Error fetching loyalty data:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch loyalty data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdjustPoints = async () => {
    if (!adjustAmount || parseInt(adjustAmount) <= 0) {
      toast({
        title: 'Validation Error',
        description: 'Please enter a valid point amount',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/guests/${guestId}/loyalty`, {
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
        fetchLoyaltyData();
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

  const handleRedeemPoints = async () => {
    if (!selectedRedemption) {
      toast({
        title: 'Validation Error',
        description: 'Please select a redemption option',
        variant: 'destructive',
      });
      return;
    }

    const option = redemptionOptions.find(o => o.id === selectedRedemption);
    if (!option) return;

    if (data && option.points > data.loyalty.points) {
      toast({
        title: 'Insufficient Points',
        description: `You need ${option.points} points for this redemption`,
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/guests/${guestId}/loyalty`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: option.points,
          operation: 'subtract',
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: `Redeemed ${option.name} for ${option.points} points`,
        });
        setIsRedeemOpen(false);
        setSelectedRedemption(null);
        fetchLoyaltyData();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to redeem points',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error redeeming points:', error);
      toast({
        title: 'Error',
        description: 'Failed to redeem points',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className="flex flex-col items-center justify-center py-12">
        <Gift className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Loyalty data not found</p>
      </Card>
    );
  }

  const currentTierConfig = tierConfig[data.loyalty.tier as keyof typeof tierConfig] || tierConfig.bronze;
  const TierIcon = currentTierConfig.icon;

  // Calculate tier progress
  const tierThresholds = data.loyalty.tierThresholds;
  const currentPoints = data.loyalty.points;
  let progressToNextTier = 0;
  let currentTierStart = 0;
  let nextTierThreshold = 0;

  if (currentPoints < tierThresholds.silver) {
    currentTierStart = tierThresholds.bronze;
    nextTierThreshold = tierThresholds.silver;
  } else if (currentPoints < tierThresholds.gold) {
    currentTierStart = tierThresholds.silver;
    nextTierThreshold = tierThresholds.gold;
  } else if (currentPoints < tierThresholds.platinum) {
    currentTierStart = tierThresholds.gold;
    nextTierThreshold = tierThresholds.platinum;
  } else {
    currentTierStart = tierThresholds.platinum;
    nextTierThreshold = tierThresholds.platinum + 10000; // Beyond platinum
  }

  progressToNextTier = ((currentPoints - currentTierStart) / (nextTierThreshold - currentTierStart)) * 100;

  return (
    <div className="space-y-6">
      {/* Tier Card */}
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
                  {data.loyalty.points.toLocaleString()} points
                </p>
              </div>
            </div>
            {data.loyalty.isVip && (
              <Badge className="bg-amber-500 text-white">
                <Crown className="h-3 w-3 mr-1" />
                VIP {data.loyalty.vipLevel}
              </Badge>
            )}
          </div>

          {/* Progress to next tier */}
          {data.loyalty.nextTier && (
            <div className="mt-6">
              <div className="flex justify-between text-sm mb-2">
                <span>{currentTierConfig.label}</span>
                <span>{tierConfig[data.loyalty.nextTier as keyof typeof tierConfig]?.label}</span>
              </div>
              <Progress value={Math.min(progressToNextTier, 100)} className="h-2" />
              <p className="text-sm text-muted-foreground mt-2">
                <span className="font-medium">{data.loyalty.pointsToNextTier.toLocaleString()}</span>
                {' '}points to {tierConfig[data.loyalty.nextTier as keyof typeof tierConfig]?.label}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Quick Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Gift className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Points</span>
          </div>
          <div className="text-2xl font-bold mt-1">{data.loyalty.points.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">{formatCurrency(data.loyalty.points * 0.01)} value</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Multiplier</span>
          </div>
          <div className="text-2xl font-bold mt-1">{data.loyalty.benefits.multiplier}x</div>
          <div className="text-xs text-muted-foreground">Points per $1</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Total Stays</span>
          </div>
          <div className="text-2xl font-bold mt-1">{data.loyalty.totalStays}</div>
          <div className="text-xs text-muted-foreground">Completed</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Award className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Total Spent</span>
          </div>
          <div className="text-2xl font-bold mt-1">{formatCurrency(data.loyalty.totalSpent)}</div>
          <div className="text-xs text-muted-foreground">Lifetime</div>
        </Card>
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <Button onClick={() => setIsAdjustOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adjust Points
        </Button>
        <Button variant="outline" onClick={() => setIsRedeemOpen(true)}>
          <Gift className="h-4 w-4 mr-2" />
          Redeem Points
        </Button>
      </div>

      {/* Tier Benefits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            {currentTierConfig.label} Benefits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 grid-cols-1 md:grid-cols-2">
            {data.loyalty.benefits.benefits.map((benefit, index) => (
              <div key={index} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Points History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <History className="h-5 w-5" />
            Points History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.pointsHistory.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No points history</p>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {data.pointsHistory.map((item) => (
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
                      item.type === 'earned' ? 'text-emerald-600' : 'text-red-600'
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

      {/* Adjust Points Dialog */}
      <Dialog open={isAdjustOpen} onOpenChange={setIsAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Points</DialogTitle>
            <DialogDescription>
              Add or subtract loyalty points for this guest
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

            {adjustAmount && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-sm">
                  Current balance: <span className="font-bold">{data.loyalty.points.toLocaleString()}</span>
                </p>
                <p className="text-sm">
                  New balance: <span className="font-bold">
                    {(adjustType === 'add'
                      ? data.loyalty.points + parseInt(adjustAmount || '0')
                      : Math.max(0, data.loyalty.points - parseInt(adjustAmount || '0'))
                    ).toLocaleString()}
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

      {/* Redeem Points Dialog */}
      <Dialog open={isRedeemOpen} onOpenChange={setIsRedeemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redeem Points</DialogTitle>
            <DialogDescription>
              Exchange your points for rewards. Current balance: {data.loyalty.points.toLocaleString()} points
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {redemptionOptions.map((option) => {
                  const canRedeem = data.loyalty.points >= option.points;
                  const isSelected = selectedRedemption === option.id;
                  
                  return (
                    <div
                      key={option.id}
                      className={cn(
                        'p-4 rounded-lg border cursor-pointer transition-colors',
                        isSelected ? 'border-emerald-500 bg-emerald-50' : 'hover:bg-muted/50',
                        !canRedeem && 'opacity-50 cursor-not-allowed'
                      )}
                      onClick={() => canRedeem && setSelectedRedemption(option.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{option.name}</p>
                          <p className="text-sm text-muted-foreground">
                            Value: {formatCurrency(option.value)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{option.points.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">points</p>
                        </div>
                      </div>
                      {isSelected && (
                        <Badge className="mt-2 bg-emerald-500">Selected</Badge>
                      )}
                      {!canRedeem && (
                        <p className="text-xs text-red-500 mt-1">Insufficient points</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRedeemOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRedeemPoints}
              disabled={isSaving || !selectedRedemption}
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Redeem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
