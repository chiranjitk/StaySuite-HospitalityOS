'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus,
  Calendar,
  DollarSign,
  Percent,
  Clock,
  TrendingUp,
  TrendingDown,
  Edit,
  Trash2,
  Copy,
  MoreHorizontal,
  CheckCircle,
  RefreshCw,
  Tag,
  Settings,
  Sun,
  Moon,
  Building2,
  Users,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  Sparkles,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameDay, addMonths, subMonths, isWeekend, getDay } from 'date-fns';
import { useCurrency } from '@/contexts/CurrencyContext';
import { cn } from '@/lib/utils';

// Types
interface RoomType {
  id: string;
  name: string;
  code: string;
  basePrice: number;
  propertyId: string;
}

interface RatePlan {
  id: string;
  roomTypeId: string;
  name: string;
  code: string;
  description?: string;
  basePrice: number;
  currency: string;
  mealPlan: string;
  minStay: number;
  maxStay?: number;
  advanceBookingDays?: number;
  cancellationPolicy?: string;
  cancellationHours?: number;
  promoCode?: string;
  discountPercent?: number;
  discountAmount?: number;
  promoStart?: string;
  promoEnd?: string;
  status: string;
  hasActivePromo?: boolean;
  effectivePrice?: number;
  discountDisplay?: string;
  roomType?: RoomType;
}

interface PricingRule {
  id: string;
  name: string;
  type: 'markup' | 'markdown' | 'dynamic' | 'seasonal';
  value: number;
  valueType: 'percentage' | 'fixed';
  conditions: {
    minOccupancy?: number;
    maxOccupancy?: number;
    daysOfWeek?: string[];
    minLeadTime?: number;
    maxLeadTime?: number;
    minStay?: number;
    maxStay?: number;
  };
  priority: number;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  roomTypes: string[];
  description?: string;
}

interface PriceOverride {
  date: string;
  roomTypeId: string;
  price: number;
  reason?: string;
  minStay?: number;
}

interface RatePlanStats {
  totalPlans: number;
  activePlans: number;
  mealPlanDistribution: { mealPlan: string; count: number }[];
}

interface PricingRuleStats {
  totalRules: number;
  activeRules: number;
  avgAdjustment: number;
  seasonalRules: number;
}

// Constants
const mealPlanLabels: Record<string, string> = {
  room_only: 'Room Only',
  bed_breakfast: 'Bed & Breakfast',
  half_board: 'Half Board',
  full_board: 'Full Board',
  all_inclusive: 'All Inclusive',
};

const mealPlanColors: Record<string, string> = {
  room_only: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  bed_breakfast: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  half_board: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  full_board: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300',
  all_inclusive: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
};

const ruleTypeLabels: Record<string, string> = {
  markup: 'Price Increase',
  markdown: 'Price Decrease',
  dynamic: 'Dynamic Pricing',
  seasonal: 'Seasonal Rate',
};

const ruleTypeColors: Record<string, string> = {
  markup: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  markdown: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  dynamic: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
  seasonal: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
};

const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Helper function to get price color based on deviation from base
const getPriceColor = (basePrice: number, currentPrice: number): string => {
  const deviation = ((currentPrice - basePrice) / basePrice) * 100;
  if (deviation > 20) return 'bg-red-500 text-white';
  if (deviation > 10) return 'bg-orange-400 text-white';
  if (deviation > 0) return 'bg-amber-300 text-amber-900';
  if (deviation < -20) return 'bg-emerald-500 text-white';
  if (deviation < -10) return 'bg-emerald-400 text-white';
  if (deviation < 0) return 'bg-emerald-300 text-emerald-900';
  return 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200';
};

export default function RatePlansPricingRules() {
  const { toast } = useToast();
  const { formatCurrency, currency } = useCurrency();
  
  // State
  const [ratePlans, setRatePlans] = useState<RatePlan[]>([]);
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [priceOverrides, setPriceOverrides] = useState<PriceOverride[]>([]);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [ratePlanStats, setRatePlanStats] = useState<RatePlanStats | null>(null);
  const [pricingRuleStats, setPricingRuleStats] = useState<PricingRuleStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('calendar');

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedRoomType, setSelectedRoomType] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [isPriceOverrideOpen, setIsPriceOverrideOpen] = useState(false);
  const [overrideData, setOverrideData] = useState({ price: 0, reason: '', minStay: 1 });

  // Dialog states
  const [isCreateRatePlanOpen, setIsCreateRatePlanOpen] = useState(false);
  const [isCreateRuleOpen, setIsCreateRuleOpen] = useState(false);
  const [editingRatePlan, setEditingRatePlan] = useState<RatePlan | null>(null);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);

  // Form states
  const [newRatePlan, setNewRatePlan] = useState<Partial<RatePlan>>({
    name: '',
    code: '',
    basePrice: 0,
    mealPlan: 'room_only',
    minStay: 1,
    status: 'active',
    currency: 'USD',
  });

  const [newRule, setNewRule] = useState<Partial<PricingRule>>({
    name: '',
    type: 'markup',
    value: 10,
    valueType: 'percentage',
    isActive: true,
    priority: 1,
    effectiveFrom: format(new Date(), 'yyyy-MM-dd'),
    roomTypes: [],
    conditions: {},
  });

  // Fetch all data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [ratePlansRes, rulesRes, roomTypesRes] = await Promise.all([
        fetch('/api/rate-plans'),
        fetch('/api/revenue/pricing-rules'),
        fetch('/api/room-types'),
      ]);

      const ratePlansData = await ratePlansRes.json();
      const rulesData = await rulesRes.json();
      const roomTypesData = await roomTypesRes.json();

      if (ratePlansData.success) {
        setRatePlans(ratePlansData.data || []);
        setRatePlanStats(ratePlansData.stats || {
          totalPlans: 0,
          activePlans: 0,
          mealPlanDistribution: [],
        });
      }

      if (rulesData.success) {
        setPricingRules(rulesData.data || []);
        setPricingRuleStats(rulesData.stats || {
          totalRules: 0,
          activeRules: 0,
          avgAdjustment: 0,
          seasonalRules: 0,
        });
      }

      if (roomTypesData.success) {
        setRoomTypes(roomTypesData.data || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ title: 'Error', description: 'Failed to load pricing data', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getPriceForDay = (day: Date, roomTypeId: string): number => {
    const roomType = roomTypes.find(rt => rt.id === roomTypeId);
    if (!roomType) return 0;

    // Check for override first
    const dateStr = format(day, 'yyyy-MM-dd');
    const override = priceOverrides.find(o => o.date === dateStr && o.roomTypeId === roomTypeId);
    if (override) return override.price;

    // Apply active rules
    let price = roomType.basePrice;
    const dayOfWeek = format(day, 'EEE');
    
    pricingRules.filter(r => r.isActive && (!r.roomTypes.length || r.roomTypes.includes(roomTypeId))).forEach(rule => {
      // Check if rule applies to this day
      if (rule.conditions?.daysOfWeek?.length && !rule.conditions.daysOfWeek.includes(dayOfWeek)) return;
      
      // Apply adjustment
      if (rule.valueType === 'percentage') {
        price = price * (1 + (rule.type === 'markdown' ? -rule.value : rule.value) / 100);
      } else {
        price = price + (rule.type === 'markdown' ? -rule.value : rule.value);
      }
    });

    // Weekend markup
    if (isWeekend(day)) {
      price = price * 1.1; // 10% weekend markup
    }

    return Math.round(price);
  };

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setOverrideData({ price: 0, reason: '', minStay: 1 });
    setIsPriceOverrideOpen(true);
  };

  const handlePriceOverride = async () => {
    if (!selectedDate || !selectedRoomType) return;
    
    setIsSaving(true);
    try {
      // In a real app, this would call an API
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      setPriceOverrides(prev => [
        ...prev.filter(o => !(o.date === dateStr && o.roomTypeId === selectedRoomType)),
        { date: dateStr, roomTypeId: selectedRoomType, ...overrideData }
      ]);
      toast({ title: 'Success', description: 'Price override saved' });
      setIsPriceOverrideOpen(false);
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save override', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // Rate Plan Actions
  const createRatePlan = async () => {
    if (!newRatePlan.name || !newRatePlan.code || !newRatePlan.roomTypeId) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/rate-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRatePlan),
      });

      const data = await response.json();

      if (data.success) {
        setRatePlans(prev => [...prev, data.data]);
        setIsCreateRatePlanOpen(false);
        resetRatePlanForm();
        toast({ title: 'Success', description: 'Rate plan created' });
      } else {
        toast({ title: 'Error', description: data.error?.message || 'Failed to create rate plan', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error creating rate plan:', error);
      toast({ title: 'Error', description: 'Failed to create rate plan', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const updateRatePlan = async () => {
    if (!editingRatePlan) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/rate-plans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRatePlan),
      });

      const data = await response.json();

      if (data.success) {
        setRatePlans(prev => prev.map(r => (r.id === editingRatePlan.id ? data.data : r)));
        setEditingRatePlan(null);
        toast({ title: 'Success', description: 'Rate plan updated' });
      } else {
        toast({ title: 'Error', description: 'Failed to update rate plan', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error updating rate plan:', error);
      toast({ title: 'Error', description: 'Failed to update rate plan', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteRatePlan = async (id: string) => {
    try {
      const response = await fetch(`/api/rate-plans?ids=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setRatePlans(prev => prev.filter(r => r.id !== id));
        toast({ title: 'Success', description: 'Rate plan deleted' });
      } else {
        toast({ title: 'Error', description: 'Failed to delete rate plan', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error deleting rate plan:', error);
      toast({ title: 'Error', description: 'Failed to delete rate plan', variant: 'destructive' });
    }
  };

  // Pricing Rule Actions
  const createRule = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/revenue/pricing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule),
      });

      const data = await response.json();

      if (data.success) {
        setPricingRules(prev => [...prev, data.data]);
        setIsCreateRuleOpen(false);
        resetRuleForm();
        toast({ title: 'Success', description: 'Pricing rule created' });
      } else {
        toast({ title: 'Error', description: data.error?.message || 'Failed to create rule', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error creating rule:', error);
      toast({ title: 'Error', description: 'Failed to create rule', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const updateRule = async () => {
    if (!editingRule) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/revenue/pricing-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRule),
      });

      const data = await response.json();

      if (data.success) {
        setPricingRules(prev => prev.map(r => (r.id === editingRule.id ? data.data : r)));
        setEditingRule(null);
        toast({ title: 'Success', description: 'Pricing rule updated' });
      } else {
        toast({ title: 'Error', description: 'Failed to update rule', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error updating rule:', error);
      toast({ title: 'Error', description: 'Failed to update rule', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleRuleActive = async (id: string) => {
    const rule = pricingRules.find(r => r.id === id);
    if (!rule) return;

    try {
      const response = await fetch('/api/revenue/pricing-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !rule.isActive }),
      });

      const data = await response.json();

      if (data.success) {
        setPricingRules(prev =>
          prev.map(r => (r.id === id ? { ...r, isActive: !r.isActive } : r))
        );
        toast({ title: 'Success', description: 'Rule status updated' });
      } else {
        toast({ title: 'Error', description: 'Failed to update rule', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error updating rule:', error);
      toast({ title: 'Error', description: 'Failed to update rule', variant: 'destructive' });
    }
  };

  const deleteRule = async (id: string) => {
    try {
      const response = await fetch(`/api/revenue/pricing-rules?id=${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        setPricingRules(prev => prev.filter(rule => rule.id !== id));
        toast({ title: 'Success', description: 'Rule deleted' });
      } else {
        toast({ title: 'Error', description: 'Failed to delete rule', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error deleting rule:', error);
      toast({ title: 'Error', description: 'Failed to delete rule', variant: 'destructive' });
    }
  };

  const duplicateRule = async (rule: PricingRule) => {
    try {
      const response = await fetch('/api/revenue/pricing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rule, name: `${rule.name} (Copy)` }),
      });

      const data = await response.json();

      if (data.success) {
        setPricingRules(prev => [...prev, data.data]);
        toast({ title: 'Success', description: 'Rule duplicated' });
      } else {
        toast({ title: 'Error', description: 'Failed to duplicate rule', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error duplicating rule:', error);
      toast({ title: 'Error', description: 'Failed to duplicate rule', variant: 'destructive' });
    }
  };

  const resetRatePlanForm = () => {
    setNewRatePlan({
      name: '',
      code: '',
      basePrice: 0,
      mealPlan: 'room_only',
      minStay: 1,
      status: 'active',
      currency: 'USD',
    });
    setEditingRatePlan(null);
  };

  const resetRuleForm = () => {
    setNewRule({
      name: '',
      type: 'markup',
      value: 10,
      valueType: 'percentage',
      isActive: true,
      priority: 1,
      effectiveFrom: format(new Date(), 'yyyy-MM-dd'),
      roomTypes: [],
      conditions: {},
    });
    setEditingRule(null);
  };

  // Loading skeleton
  if (isLoading || !ratePlanStats || !pricingRuleStats) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-2 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6 text-emerald-600" />
            Pricing Management
          </h2>
          <p className="text-muted-foreground">Unified dashboard for rates, rules, and calendar</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Rate Plans</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{ratePlanStats.totalPlans}</p>
              </div>
              <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                <Tag className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Active Plans</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{ratePlanStats.activePlans}</p>
              </div>
              <div className="p-3 rounded-full bg-amber-200 dark:bg-amber-800">
                <CheckCircle className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-violet-700 dark:text-violet-400">Pricing Rules</p>
                <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">{pricingRuleStats.totalRules}</p>
              </div>
              <div className="p-3 rounded-full bg-violet-200 dark:bg-violet-800">
                <Settings className="h-6 w-6 text-violet-700 dark:text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-cyan-700 dark:text-cyan-400">Avg Adjustment</p>
                <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{pricingRuleStats.avgAdjustment}%</p>
              </div>
              <div className="p-3 rounded-full bg-cyan-200 dark:bg-cyan-800">
                <Percent className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 sm:max-w-lg">
          <TabsTrigger value="calendar" className="gap-2">
            <Grid3X3 className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="rate-plans" className="gap-2">
            <Tag className="h-4 w-4" />
            Rate Plans
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-2">
            <Settings className="h-4 w-4" />
            Rules
          </TabsTrigger>
        </TabsList>

        {/* Calendar Tab - Visual Pricing Calendar */}
        <TabsContent value="calendar" className="mt-6 space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Pricing Calendar
                  </CardTitle>
                  <CardDescription>Click a date to set price override</CardDescription>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Select value={selectedRoomType} onValueChange={setSelectedRoomType}>
                    <SelectTrigger className="w-full sm:w-48">
                      <SelectValue placeholder="Select room type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Room Types</SelectItem>
                      {roomTypes.map(rt => (
                        <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="font-medium w-32 text-center">{format(currentMonth, 'MMMM yyyy')}</span>
                    <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Legend */}
              <div className="flex flex-wrap items-center gap-4 mb-4 text-sm">
                <span className="text-muted-foreground">Price deviation:</span>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-emerald-400" />
                  <span>-20%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-slate-200" />
                  <span>Base</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-amber-300" />
                  <span>+10%</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-4 h-4 rounded bg-red-500" />
                  <span>+20%</span>
                </div>
              </div>

              {/* Calendar Grid */}
              {selectedRoomType === 'all' ? (
                <div className="border rounded-lg overflow-x-auto">
                  {/* Matrix View - All Room Types */}
                  <div className="min-w-[800px]">
                    {/* Header Row - Dates */}
                    <div className="grid bg-muted/50 border-b" style={{ gridTemplateColumns: `140px repeat(${calendarDays.length}, minmax(40px, 1fr))` }}>
                      <div className="p-2 font-medium text-sm border-r">Room Type</div>
                      {calendarDays.map((day) => (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            'p-2 text-center border-r last:border-r-0 text-xs',
                            isToday(day) && 'bg-primary/10 font-semibold'
                          )}
                        >
                          <div className="text-muted-foreground">{format(day, 'EEE')}</div>
                          <div className={cn(isWeekend(day) && 'text-amber-600')}>{format(day, 'd')}</div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Room Type Rows */}
                    {roomTypes.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No room types available</p>
                      </div>
                    ) : (
                      roomTypes.map((roomType) => (
                        <div 
                          key={roomType.id} 
                          className="grid border-b last:border-b-0 hover:bg-muted/20"
                          style={{ gridTemplateColumns: `140px repeat(${calendarDays.length}, minmax(40px, 1fr))` }}
                        >
                          <div className="p-2 border-r bg-muted/30">
                            <div className="font-medium text-sm truncate">{roomType.name}</div>
                            <div className="text-xs text-muted-foreground">{formatCurrency(roomType.basePrice)}/night</div>
                          </div>
                          {calendarDays.map((day) => {
                            const price = getPriceForDay(day, roomType.id);
                            const priceColor = getPriceColor(roomType.basePrice, price);
                            
                            return (
                              <div
                                key={day.toISOString()}
                                className={cn(
                                  'p-1 border-r last:border-r-0 text-center cursor-pointer hover:bg-muted/40 transition-colors',
                                  isToday(day) && 'bg-primary/5',
                                  isWeekend(day) && 'bg-amber-50/50 dark:bg-amber-900/10'
                                )}
                                onClick={() => {
                                  setSelectedRoomType(roomType.id);
                                  handleDayClick(day);
                                }}
                                title={`${roomType.name} - ${format(day, 'MMM d')}: ${formatCurrency(price)}`}
                              >
                                <div className={cn("text-[10px] px-1 py-0.5 rounded font-medium", priceColor)}>
                                  {price}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  {/* Weekday Headers */}
                  <div className="grid grid-cols-7 bg-muted/50">
                    {weekDays.map(day => (
                      <div key={day} className="p-2 text-center text-sm font-medium border-r last:border-r-0">
                        {day}
                      </div>
                    ))}
                  </div>
                  
                  {/* Calendar Days */}
                  <div className="grid grid-cols-7">
                    {calendarDays.map((day, i) => {
                      const roomType = roomTypes.find(rt => rt.id === selectedRoomType);
                      const price = roomType ? getPriceForDay(day, selectedRoomType) : 0;
                      const priceColor = roomType ? getPriceColor(roomType.basePrice, price) : '';
                      const isWeekendDay = isWeekend(day);
                      
                      // Pad first week
                      const firstDayOfMonth = getDay(startOfMonth(currentMonth));
                      if (i === 0 && firstDayOfMonth > 0) {
                        return (
                          <React.Fragment key={day.toISOString()}>
                            {Array.from({ length: firstDayOfMonth }).map((_, j) => (
                              <div key={`pad-${j}`} className="min-h-20 p-1 border-r border-b bg-muted/20" />
                            ))}
                            <div
                              className={cn(
                                "min-h-20 p-1 border-r border-b cursor-pointer hover:bg-muted/50 transition-colors",
                                isToday(day) && "ring-2 ring-primary ring-inset",
                                isWeekendDay && "bg-muted/20"
                              )}
                              onClick={() => handleDayClick(day)}
                            >
                              <div className="text-xs font-medium mb-1">{format(day, 'd')}</div>
                              <div className={cn("text-xs px-1 py-0.5 rounded font-medium", priceColor)}>
                                {formatCurrency(price)}
                              </div>
                            </div>
                          </React.Fragment>
                        );
                      }
                      
                      return (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            "min-h-20 p-1 border-r border-b cursor-pointer hover:bg-muted/50 transition-colors",
                            isToday(day) && "ring-2 ring-primary ring-inset",
                            isWeekendDay && "bg-muted/20"
                          )}
                          onClick={() => handleDayClick(day)}
                        >
                          <div className="text-xs font-medium mb-1">{format(day, 'd')}</div>
                          <div className={cn("text-xs px-1 py-0.5 rounded font-medium", priceColor)}>
                            {formatCurrency(price)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Active Rules Summary */}
              <div className="mt-4 p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Active Pricing Rules
                </h4>
                <div className="flex flex-wrap gap-2">
                  {pricingRules.filter(r => r.isActive).slice(0, 5).map(rule => (
                    <Badge key={rule.id} variant="outline" className={cn("gap-1", ruleTypeColors[rule.type])}>
                      {rule.type === 'markdown' ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                      {rule.name}: {rule.type === 'markdown' ? '-' : '+'}{rule.value}{rule.valueType === 'percentage' ? '%' : ''}
                    </Badge>
                  ))}
                  {pricingRules.filter(r => r.isActive).length > 5 && (
                    <Badge variant="outline">+{pricingRules.filter(r => r.isActive).length - 5} more</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rate Plans Tab */}
        <TabsContent value="rate-plans" className="mt-6 space-y-4">
          <div className="flex justify-between items-center">
            <CardDescription>Pricing models (BAR, seasonal, corporate)</CardDescription>
            <Dialog open={isCreateRatePlanOpen} onOpenChange={setIsCreateRatePlanOpen}>
              <Button onClick={() => setIsCreateRatePlanOpen(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4" />
                Create Rate Plan
              </Button>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create Rate Plan</DialogTitle>
                  <DialogDescription>
                    Set up a new pricing model for a room type
                  </DialogDescription>
                </DialogHeader>
                <RatePlanForm
                  ratePlan={newRatePlan}
                  onChange={setNewRatePlan}
                  roomTypes={roomTypes}
                  onSave={createRatePlan}
                  onCancel={() => { setIsCreateRatePlanOpen(false); resetRatePlanForm(); }}
                  isSaving={isSaving}
                />
              </DialogContent>
            </Dialog>
          </div>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {ratePlans.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Tag className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No rate plans yet</p>
                  <p className="text-sm">Create your first rate plan to get started</p>
                </div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Plan Name</TableHead>
                          <TableHead>Room Type</TableHead>
                          <TableHead>Meal Plan</TableHead>
                          <TableHead>Base Price</TableHead>
                          <TableHead>Min Stay</TableHead>
                          <TableHead>Promo</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ratePlans.map((plan) => (
                          <TableRow key={plan.id} className={plan.status !== 'active' ? 'opacity-60' : ''}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{plan.name}</p>
                                <p className="text-xs text-muted-foreground">{plan.code}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {plan.roomType?.name || 'Unknown'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={mealPlanColors[plan.mealPlan] || ''}>
                                {mealPlanLabels[plan.mealPlan] || plan.mealPlan}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="font-medium">
                                {plan.hasActivePromo && plan.effectivePrice ? (
                                  <>
                                    <span className="line-through text-muted-foreground mr-1">
                                      {formatCurrency(plan.basePrice)}
                                    </span>
                                    <span className="text-emerald-600">
                                      {formatCurrency(plan.effectivePrice)}
                                    </span>
                                  </>
                                ) : (
                                  formatCurrency(plan.basePrice)
                                )}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span>{plan.minStay}+ nights</span>
                            </TableCell>
                            <TableCell>
                              {plan.hasActivePromo ? (
                                <div className="flex flex-col">
                                  <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300">
                                    {plan.discountDisplay}
                                  </Badge>
                                </div>
                              ) : plan.promoCode ? (
                                <span className="text-xs text-muted-foreground">
                                  Code: {plan.promoCode}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                                {plan.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => setEditingRatePlan(plan)}>
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={() => deleteRatePlan(plan.id)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Mobile cards */}
                  <div className="md:hidden space-y-3 p-3">
                    {ratePlans.map((plan) => (
                      <Card key={plan.id} className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium truncate">{plan.name}</p>
                            <p className="text-xs text-muted-foreground">{plan.code}</p>
                          </div>
                          <Badge variant={plan.status === 'active' ? 'default' : 'secondary'}>
                            {plan.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <Badge variant="outline">{plan.roomType?.name || 'Unknown'}</Badge>
                          <Badge className={mealPlanColors[plan.mealPlan] || ''}>
                            {mealPlanLabels[plan.mealPlan] || plan.mealPlan}
                          </Badge>
                          <span className="text-xs text-muted-foreground self-center">{plan.minStay}+ nights</span>
                        </div>
                        <div className="mt-2">
                          <span className="font-medium">
                            {plan.hasActivePromo && plan.effectivePrice ? (
                              <>
                                <span className="line-through text-muted-foreground mr-1">{formatCurrency(plan.basePrice)}</span>
                                <span className="text-emerald-600">{formatCurrency(plan.effectivePrice)}</span>
                              </>
                            ) : (
                              formatCurrency(plan.basePrice)
                            )}
                          </span>
                          {plan.hasActivePromo && (
                            <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300 ml-2">
                              {plan.discountDisplay}
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-2 mt-3 pt-2 border-t">
                          <Button variant="outline" size="sm" className="flex-1 h-9 min-h-[44px]" onClick={() => setEditingRatePlan(plan)}>
                            <Edit className="h-3 w-3 mr-1" />Edit
                          </Button>
                          <Button variant="outline" size="sm" className="h-9 min-h-[44px] text-red-600" onClick={() => deleteRatePlan(plan.id)}>
                            <Trash2 className="h-3 w-3 mr-1" />Delete
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Edit Rate Plan Dialog */}
          <Dialog open={!!editingRatePlan} onOpenChange={() => setEditingRatePlan(null)}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Edit Rate Plan</DialogTitle>
                <DialogDescription>
                  Update the rate plan settings
                </DialogDescription>
              </DialogHeader>
              {editingRatePlan && (
                <RatePlanForm
                  ratePlan={editingRatePlan}
                  onChange={(plan) => setEditingRatePlan(plan as RatePlan)}
                  roomTypes={roomTypes}
                  onSave={updateRatePlan}
                  onCancel={() => setEditingRatePlan(null)}
                  isSaving={isSaving}
                />
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Pricing Rules Tab */}
        <TabsContent value="rules" className="mt-6 space-y-4">
          <div className="flex justify-between items-center">
            <CardDescription>Dynamic adjustments (weekday, demand, events)</CardDescription>
            <Dialog open={isCreateRuleOpen} onOpenChange={setIsCreateRuleOpen}>
              <Button onClick={() => setIsCreateRuleOpen(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                <Plus className="h-4 w-4" />
                Create Rule
              </Button>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Create Pricing Rule</DialogTitle>
                  <DialogDescription>
                    Set up an automated pricing adjustment rule
                  </DialogDescription>
                </DialogHeader>
                <RuleForm
                  rule={newRule}
                  onChange={setNewRule}
                  roomTypes={roomTypes}
                  onSave={createRule}
                  onCancel={() => { setIsCreateRuleOpen(false); resetRuleForm(); }}
                  isSaving={isSaving}
                />
              </DialogContent>
            </Dialog>
          </div>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {pricingRules.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Settings className="h-12 w-12 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No pricing rules yet</p>
                  <p className="text-sm">Create your first pricing rule to get started</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rule Name</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Adjustment</TableHead>
                        <TableHead>Conditions</TableHead>
                        <TableHead>Effective Period</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pricingRules.map((rule) => (
                        <TableRow key={rule.id} className={!rule.isActive ? 'opacity-60' : ''}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{rule.name}</p>
                              {rule.description && (
                                <p className="text-xs text-muted-foreground">{rule.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={ruleTypeColors[rule.type]}>
                              {ruleTypeLabels[rule.type]}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {rule.type === 'markdown' ? (
                                <TrendingDown className="h-4 w-4 text-red-500" />
                              ) : (
                                <TrendingUp className="h-4 w-4 text-emerald-500" />
                              )}
                              <span className={rule.type === 'markdown' ? 'text-red-600' : 'text-emerald-600'}>
                                {rule.type === 'markdown' ? '-' : '+'}{rule.value}{rule.valueType === 'percentage' ? '%' : ''}
                                {rule.valueType === 'fixed' && formatCurrency(rule.value).replace(/[\d.,]/g, '').trim()}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {rule.conditions?.daysOfWeek && rule.conditions.daysOfWeek.length > 0 && (
                                <Badge variant="outline" className="text-xs">
                                  {rule.conditions.daysOfWeek.join(', ')}
                                </Badge>
                              )}
                              {rule.conditions?.minStay && (
                                <Badge variant="outline" className="text-xs">
                                  {rule.conditions.minStay}+ nights
                                </Badge>
                              )}
                              {rule.conditions?.maxLeadTime && (
                                <Badge variant="outline" className="text-xs">
                                  Within {rule.conditions.maxLeadTime} days
                                </Badge>
                              )}
                              {(!rule.conditions?.daysOfWeek?.length && !rule.conditions?.minStay && !rule.conditions?.maxLeadTime) && (
                                <span className="text-muted-foreground text-sm">All conditions</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p>{rule.effectiveFrom ? format(new Date(rule.effectiveFrom), 'MMM dd, yyyy') : '-'}</p>
                              {rule.effectiveTo && (
                                <p className="text-muted-foreground">to {format(new Date(rule.effectiveTo), 'MMM dd, yyyy')}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={rule.isActive}
                              onCheckedChange={() => toggleRuleActive(rule.id)}
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setEditingRule(rule)}>
                                  <Edit className="h-4 w-4 mr-2" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => duplicateRule(rule)}>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Duplicate
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => deleteRule(rule.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Edit Rule Dialog */}
          <Dialog open={!!editingRule} onOpenChange={() => setEditingRule(null)}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Edit Pricing Rule</DialogTitle>
                <DialogDescription>
                  Update the pricing rule settings
                </DialogDescription>
              </DialogHeader>
              {editingRule && (
                <RuleForm
                  rule={editingRule}
                  onChange={(rule) => setEditingRule(rule as PricingRule)}
                  roomTypes={roomTypes}
                  onSave={updateRule}
                  onCancel={() => setEditingRule(null)}
                  isSaving={isSaving}
                />
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>

      {/* Price Override Dialog */}
      <Dialog open={isPriceOverrideOpen} onOpenChange={setIsPriceOverrideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Price Override</DialogTitle>
            <DialogDescription>
              {selectedDate && `Override price for ${format(selectedDate, 'MMMM d, yyyy')}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Custom Price</Label>
              <Input
                type="number"
                value={overrideData.price}
                onChange={(e) => setOverrideData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                placeholder="Enter price"
              />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input
                value={overrideData.reason}
                onChange={(e) => setOverrideData(prev => ({ ...prev, reason: e.target.value }))}
                placeholder="e.g., Holiday, Event, Peak Season"
              />
            </div>
            <div className="space-y-2">
              <Label>Minimum Stay (nights)</Label>
              <Input
                type="number"
                min="1"
                value={overrideData.minStay}
                onChange={(e) => setOverrideData(prev => ({ ...prev, minStay: parseInt(e.target.value) || 1 }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPriceOverrideOpen(false)}>Cancel</Button>
            <Button onClick={handlePriceOverride} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
              {isSaving ? 'Saving...' : 'Save Override'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Rate Plan Form Component
function RatePlanForm({
  ratePlan,
  onChange,
  roomTypes,
  onSave,
  onCancel,
  isSaving,
}: {
  ratePlan: Partial<RatePlan>;
  onChange: (plan: Partial<RatePlan>) => void;
  roomTypes: RoomType[];
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Plan Name *</Label>
        <Input
          placeholder="e.g., Best Available Rate"
          value={ratePlan.name || ''}
          onChange={(e) => onChange({ ...ratePlan, name: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Code *</Label>
          <Input
            placeholder="e.g., BAR"
            value={ratePlan.code || ''}
            onChange={(e) => onChange({ ...ratePlan, code: e.target.value.toUpperCase() })}
          />
        </div>
        <div className="space-y-2">
          <Label>Room Type *</Label>
          <Select
            value={ratePlan.roomTypeId || ''}
            onValueChange={(value) => onChange({ ...ratePlan, roomTypeId: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select room type" />
            </SelectTrigger>
            <SelectContent>
              {roomTypes.map(rt => (
                <SelectItem key={rt.id} value={rt.id}>
                  {rt.name} ({rt.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Base Price *</Label>
          <Input
            type="number"
            placeholder="0.00"
            value={ratePlan.basePrice || ''}
            onChange={(e) => onChange({ ...ratePlan, basePrice: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label>Meal Plan</Label>
          <Select
            value={ratePlan.mealPlan || 'room_only'}
            onValueChange={(value) => onChange({ ...ratePlan, mealPlan: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="room_only">Room Only</SelectItem>
              <SelectItem value="bed_breakfast">Bed & Breakfast</SelectItem>
              <SelectItem value="half_board">Half Board</SelectItem>
              <SelectItem value="full_board">Full Board</SelectItem>
              <SelectItem value="all_inclusive">All Inclusive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Min Stay (nights)</Label>
          <Input
            type="number"
            placeholder="1"
            value={ratePlan.minStay || ''}
            onChange={(e) => onChange({ ...ratePlan, minStay: parseInt(e.target.value) || 1 })}
          />
        </div>
        <div className="space-y-2">
          <Label>Max Stay (nights)</Label>
          <Input
            type="number"
            placeholder="Unlimited"
            value={ratePlan.maxStay || ''}
            onChange={(e) => onChange({ ...ratePlan, maxStay: parseInt(e.target.value) || undefined })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          placeholder="Describe this rate plan"
          value={ratePlan.description || ''}
          onChange={(e) => onChange({ ...ratePlan, description: e.target.value })}
        />
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={onSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
          {isSaving ? 'Saving...' : 'Save Plan'}
        </Button>
      </DialogFooter>
    </div>
  );
}

// Rule Form Component
function RuleForm({
  rule,
  onChange,
  roomTypes,
  onSave,
  onCancel,
  isSaving,
}: {
  rule: Partial<PricingRule>;
  onChange: (rule: Partial<PricingRule>) => void;
  roomTypes: RoomType[];
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  return (
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label>Rule Name *</Label>
        <Input
          placeholder="e.g., Weekend Premium"
          value={rule.name || ''}
          onChange={(e) => onChange({ ...rule, name: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Rule Type</Label>
          <Select
            value={rule.type}
            onValueChange={(value) => onChange({ ...rule, type: value as PricingRule['type'] })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="markup">Price Increase</SelectItem>
              <SelectItem value="markdown">Price Decrease</SelectItem>
              <SelectItem value="dynamic">Dynamic Pricing</SelectItem>
              <SelectItem value="seasonal">Seasonal Rate</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Value Type</Label>
          <Select
            value={rule.valueType}
            onValueChange={(value) => onChange({ ...rule, valueType: value as 'percentage' | 'fixed' })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="percentage">Percentage (%)</SelectItem>
              <SelectItem value="fixed">Fixed Amount</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Adjustment Value</Label>
          <Input
            type="number"
            placeholder="Enter value"
            value={rule.value || ''}
            onChange={(e) => onChange({ ...rule, value: parseFloat(e.target.value) || 0 })}
          />
        </div>
        <div className="space-y-2">
          <Label>Priority</Label>
          <Input
            type="number"
            placeholder="1"
            value={rule.priority || ''}
            onChange={(e) => onChange({ ...rule, priority: parseInt(e.target.value) || 1 })}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Effective From</Label>
          <Input
            type="date"
            value={rule.effectiveFrom || ''}
            onChange={(e) => onChange({ ...rule, effectiveFrom: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Effective To (Optional)</Label>
          <Input
            type="date"
            value={rule.effectiveTo || ''}
            onChange={(e) => onChange({ ...rule, effectiveTo: e.target.value })}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Room Types (leave empty for all)</Label>
        <Select
          value={rule.roomTypes?.[0] || '__all__'}
          onValueChange={(value) => onChange({ ...rule, roomTypes: value === '__all__' ? [] : [value] })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select room type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Room Types</SelectItem>
            {roomTypes.map(rt => (
              <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea
          placeholder="Describe this pricing rule"
          value={rule.description || ''}
          onChange={(e) => onChange({ ...rule, description: e.target.value })}
        />
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={onSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
          {isSaving ? 'Saving...' : 'Save Rule'}
        </Button>
      </DialogFooter>
    </div>
  );
}
