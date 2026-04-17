'use client';

import { useState, useEffect } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Star, Crown, Gift, TrendingUp, Users, Award, Zap,
  ChevronRight, Medal, Diamond, Circle
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LoyaltyTier {
  name: string;
  minPoints: number;
  maxPoints: number;
  multiplier: number;
  benefits: string[];
  color: string;
  icon: React.ReactNode;
  memberCount: number;
}

interface LoyaltyStats {
  totalMembers: number;
  activeMembers: number;
  pointsEarnedThisMonth: number | null;
  pointsRedeemedThisMonth: number | null;
  averagePointsPerMember: number;
}

interface TopMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  loyaltyTier: string;
  loyaltyPoints: number;
  totalStays: number;
  totalSpent: number;
}

const defaultTiers: LoyaltyTier[] = [
  {
    name: 'Bronze',
    minPoints: 0,
    maxPoints: 999,
    multiplier: 1,
    benefits: ['Earn 1 point per $1 spent', 'Birthday bonus', 'Member-only rates'],
    color: 'from-amber-600 to-amber-800',
    icon: <Medal className="h-5 w-5" />,
    memberCount: 0,
  },
  {
    name: 'Silver',
    minPoints: 1000,
    maxPoints: 4999,
    multiplier: 1.25,
    benefits: ['Earn 1.25 points per $1 spent', '10% bonus on stays', 'Early check-in', 'Free room upgrade when available'],
    color: 'from-gray-400 to-gray-600',
    icon: <Circle className="h-5 w-5" />,
    memberCount: 0,
  },
  {
    name: 'Gold',
    minPoints: 5000,
    maxPoints: 14999,
    multiplier: 1.5,
    benefits: ['Earn 1.5 points per $1 spent', '20% bonus on stays', 'Guaranteed late checkout', 'Welcome amenity', 'Priority reservations'],
    color: 'from-yellow-400 to-yellow-600',
    icon: <Star className="h-5 w-5" />,
    memberCount: 0,
  },
  {
    name: 'Platinum',
    minPoints: 15000,
    maxPoints: 999999,
    multiplier: 2,
    benefits: ['Earn 2 points per $1 spent', '30% bonus on stays', 'Suite upgrades', 'Complimentary breakfast', 'Personal concierge', 'Free spa access'],
    color: 'from-purple-400 to-purple-600',
    icon: <Diamond className="h-5 w-5" />,
    memberCount: 0,
  },
];

const redemptionOptions = [
  { id: 'free_night', name: 'Free Night Stay', points: 5000, value: 150, description: 'Redeem for one free night' },
  { id: 'room_upgrade', name: 'Room Upgrade', points: 2000, value: 50, description: 'Upgrade to next room category' },
  { id: 'spa_voucher', name: 'Spa Voucher', points: 3000, value: 50, description: 'Spa credit' },
  { id: 'dinner_voucher', name: 'Dinner Voucher', points: 2500, value: 75, description: 'Restaurant credit' },
  { id: 'late_checkout', name: 'Late Checkout', points: 1000, value: 25, description: 'Guaranteed 2pm checkout' },
  { id: 'airport_transfer', name: 'Airport Transfer', points: 4000, value: 60, description: 'One-way airport transfer' },
];

export default function LoyaltyPrograms() {
  const { formatCurrency } = useCurrency();
  const [tiers, setTiers] = useState<LoyaltyTier[]>(defaultTiers);
  const [stats, setStats] = useState<LoyaltyStats>({
    totalMembers: 0,
    activeMembers: 0,
    pointsEarnedThisMonth: null,
    pointsRedeemedThisMonth: null,
    averagePointsPerMember: 0,
  });
  const [topMembers, setTopMembers] = useState<TopMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLoyaltyData();
  }, []);

  const fetchLoyaltyData = async () => {
    try {
      setLoading(true);
      
      // Fetch guests for loyalty stats
      const guestsResponse = await fetch('/api/guests');
      const guestsData = await guestsResponse.json();

      if (guestsData.success) {
        const guests = guestsData.data.guests;
        
        // Calculate stats
        const totalMembers = guests.length;
        const activeMembers = guests.filter((g: { totalStays: number }) => g.totalStays > 0).length;
        const totalPoints = guests.reduce((acc: number, g: { loyaltyPoints: number }) => acc + g.loyaltyPoints, 0);
        const avgPoints = totalMembers > 0 ? Math.round(totalPoints / totalMembers) : 0;

        setStats({
          totalMembers,
          activeMembers,
          pointsEarnedThisMonth: null, // Real data requires a dedicated points ledger API
          pointsRedeemedThisMonth: null, // Real data requires a dedicated points ledger API
          averagePointsPerMember: avgPoints,
        });

        // Calculate tier counts
        const tierCounts: Record<string, number> = {
          bronze: 0,
          silver: 0,
          gold: 0,
          platinum: 0,
        };

        guests.forEach((g: { loyaltyTier: string }) => {
          const tier = g.loyaltyTier.toLowerCase();
          if (tierCounts[tier] !== undefined) {
            tierCounts[tier]++;
          }
        });

        setTiers(defaultTiers.map(tier => ({
          ...tier,
          memberCount: tierCounts[tier.name.toLowerCase()] || 0,
        })));

        // Get top members
        const sorted = [...guests]
          .sort((a: { loyaltyPoints: number }, b: { loyaltyPoints: number }) => b.loyaltyPoints - a.loyaltyPoints)
          .slice(0, 5);
        setTopMembers(sorted);
      }
    } catch (error) {
      console.error('Error fetching loyalty data:', error);
      toast.error('Failed to fetch loyalty data');
    } finally {
      setLoading(false);
    }
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      bronze: 'bg-gradient-to-r from-amber-100 to-amber-200 text-amber-800 dark:from-amber-900 dark:to-amber-800 dark:text-amber-300',
      silver: 'bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800 dark:from-gray-800 dark:to-gray-700 dark:text-gray-300',
      gold: 'bg-gradient-to-r from-yellow-100 to-yellow-200 text-yellow-800 dark:from-yellow-900 dark:to-yellow-800 dark:text-yellow-300',
      platinum: 'bg-gradient-to-r from-violet-100 to-violet-200 text-violet-800 dark:from-violet-900 dark:to-violet-800 dark:text-violet-300',
      diamond: 'bg-gradient-to-r from-cyan-100 to-cyan-200 text-cyan-800 dark:from-cyan-900 dark:to-cyan-800 dark:text-cyan-300',
    };
    return colors[tier.toLowerCase()] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Loyalty Programs</h1>
        <p className="text-muted-foreground">
          Manage guest loyalty tiers, rewards, and benefits
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950 dark:to-teal-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Total Members</p>
                <p className="text-2xl font-bold">{stats.totalMembers.toLocaleString()}</p>
              </div>
              <div className="rounded-full bg-emerald-100 dark:bg-emerald-900 p-3">
                <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Points Earned (Month)</p>
                <p className="text-2xl font-bold">{stats.pointsEarnedThisMonth !== null ? stats.pointsEarnedThisMonth.toLocaleString() : 'N/A'}</p>
              </div>
              <div className="rounded-full bg-amber-100 dark:bg-amber-900 p-3">
                <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950 dark:to-sky-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Points Redeemed (Month)</p>
                <p className="text-2xl font-bold">{stats.pointsRedeemedThisMonth !== null ? stats.pointsRedeemedThisMonth.toLocaleString() : 'N/A'}</p>
              </div>
              <div className="rounded-full bg-cyan-100 dark:bg-cyan-900 p-3">
                <Gift className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950 dark:to-pink-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Avg Points/Member</p>
                <p className="text-2xl font-bold">{stats.averagePointsPerMember.toLocaleString()}</p>
              </div>
              <div className="rounded-full bg-rose-100 dark:bg-rose-900 p-3">
                <Zap className="h-5 w-5 text-rose-600 dark:text-rose-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="tiers" className="space-y-6">
        <TabsList>
          <TabsTrigger value="tiers">Tier Levels</TabsTrigger>
          <TabsTrigger value="redemptions">Redemption Options</TabsTrigger>
          <TabsTrigger value="leaderboard">Top Members</TabsTrigger>
        </TabsList>

        {/* Tier Levels Tab */}
        <TabsContent value="tiers" className="space-y-6">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
            {tiers.map((tier) => (
              <Card key={tier.name} className="relative overflow-hidden hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
                <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${tier.color}`} />
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`rounded-full bg-gradient-to-r ${tier.color} p-2 text-white`}>
                        {tier.icon}
                      </div>
                      <CardTitle className="text-lg">{tier.name}</CardTitle>
                    </div>
                    <Badge variant="secondary" className="bg-gradient-to-r from-violet-100 to-violet-200 text-violet-800 dark:from-violet-900 dark:to-violet-800 dark:text-violet-300">{tier.memberCount} members</Badge>
                  </div>
                  <CardDescription>
                    {tier.minPoints.toLocaleString()} - {tier.maxPoints === 999999 ? '∞' : tier.maxPoints.toLocaleString()} points
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{tier.multiplier}x points multiplier</span>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Benefits:</p>
                    <ul className="space-y-1">
                      {tier.benefits.map((benefit, i) => (
                        <li key={i} className="text-sm flex items-start gap-2">
                          <ChevronRight className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tier Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Member Distribution</CardTitle>
              <CardDescription>Current breakdown of members across loyalty tiers</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {tiers.map((tier) => (
                  <div key={tier.name} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">{tier.name}</span>
                      <span>{tier.memberCount} members ({stats.totalMembers > 0 ? Math.round((tier.memberCount / stats.totalMembers) * 100) : 0}%)</span>
                    </div>
                    <Progress 
                      value={stats.totalMembers > 0 ? (tier.memberCount / stats.totalMembers) * 100 : 0}
                      className="h-2"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Redemption Options Tab */}
        <TabsContent value="redemptions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Points Redemption Options</CardTitle>
              <CardDescription>Available rewards that guests can redeem with their points</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {redemptionOptions.map((option) => (
                  <Card key={option.id} className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Gift className="h-5 w-5 text-emerald-600" />
                          <h4 className="font-medium">{option.name}</h4>
                        </div>
                        <Badge className="bg-gradient-to-r from-amber-100 to-amber-200 text-amber-800 dark:from-amber-900 dark:to-amber-800 dark:text-amber-300">
                          {option.points.toLocaleString()} pts
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{option.description} ({formatCurrency(option.value)})</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Points Value Calculator */}
          <Card>
            <CardHeader>
              <CardTitle>Points Value</CardTitle>
              <CardDescription>Estimated value of loyalty points</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 grid-cols-1 md:grid-cols-3">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-3xl font-bold text-emerald-600">{formatCurrency(0.01)}</p>
                  <p className="text-sm text-muted-foreground">Per Point Value</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-3xl font-bold text-amber-600">100</p>
                  <p className="text-sm text-muted-foreground">Points per unit currency spent</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-3xl font-bold text-cyan-600">5,000</p>
                  <p className="text-sm text-muted-foreground">Points for Free Night</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Top Members Tab */}
        <TabsContent value="leaderboard" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Loyalty Members</CardTitle>
              <CardDescription>Highest point earners across all tiers</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
                </div>
              ) : topMembers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No members found
                </div>
              ) : (
                <div className="space-y-4">
                  {topMembers.map((member, index) => (
                    <div key={member.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg hover:bg-muted/80 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`flex items-center justify-center h-10 w-10 rounded-full font-bold text-white ${
                          index === 0 ? 'bg-amber-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-700' : 'bg-gray-300'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-medium">
                          {member.firstName[0]}{member.lastName[0]}
                        </div>
                        <div>
                          <p className="font-medium">{member.firstName} {member.lastName}</p>
                          <p className="text-sm text-muted-foreground">{member.email || 'No email'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className={cn(getTierColor(member.loyaltyTier), 'shadow-sm')}>
                          <Crown className="h-3 w-3 mr-1" />
                          {member.loyaltyTier}
                        </Badge>
                        <div className="text-right">
                          <p className="font-bold bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">{member.loyaltyPoints.toLocaleString()} pts</p>
                          <p className="text-sm text-muted-foreground">{member.totalStays} stays</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
