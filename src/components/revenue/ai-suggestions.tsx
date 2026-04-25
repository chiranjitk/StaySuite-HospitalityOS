'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain,
  Sparkles,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Target,
  Zap,
  RefreshCw,
  Settings,
  CheckCircle,
  AlertTriangle,
  Info,
  Lightbulb,
} from 'lucide-react';
import { toast } from 'sonner';

interface AISuggestion {
  id: string;
  type: 'pricing' | 'marketing' | 'operations' | 'revenue';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  potentialRevenue: number;
  confidence: number;
  status: 'pending' | 'applied' | 'dismissed';
  createdAt: string;
}

interface AISuggestionsSummary {
  total: number;
  pending: number;
  applied: number;
  totalPotentialRevenue: number;
  avgConfidence: number;
}

const typeColors: Record<string, string> = {
  pricing: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  marketing: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
  operations: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
  revenue: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
};

const impactColors: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  low: 'bg-muted text-muted-foreground',
};

export default function AISuggestions() {
  const { formatCurrency } = useCurrency();
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [summary, setSummary] = useState<AISuggestionsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAutoApply, setIsAutoApply] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/revenue/ai-suggestions');
      const result = await response.json();
      
      if (result.success) {
        setSuggestions(result.data);
        setSummary(result.summary);
      } else {
        toast.error('Failed to load AI suggestions');
      }
    } catch (error) {
      console.error('Error fetching AI suggestions:', error);
      toast.error('Failed to load AI suggestions');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchData();
      toast.success('AI suggestions refreshed');
    } catch (error) {
      toast.error('Failed to refresh suggestions');
    } finally {
      setIsRefreshing(false);
    }
  };

  const applySuggestion = async (id: string) => {
    try {
      const response = await fetch('/api/revenue/ai-suggestions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'applied' }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSuggestions(prev =>
          prev.map(s => s.id === id ? { ...s, status: 'applied' as const } : s)
        );
        toast.success('Suggestion applied successfully');
      } else {
        toast.error('Failed to apply suggestion');
      }
    } catch (error) {
      console.error('Error applying suggestion:', error);
      toast.error('Failed to apply suggestion');
    }
  };

  const dismissSuggestion = async (id: string) => {
    try {
      const response = await fetch('/api/revenue/ai-suggestions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'dismissed' }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        setSuggestions(prev =>
          prev.map(s => s.id === id ? { ...s, status: 'dismissed' as const } : s)
        );
        toast.info('Suggestion dismissed');
      } else {
        toast.error('Failed to dismiss suggestion');
      }
    } catch (error) {
      console.error('Error dismissing suggestion:', error);
      toast.error('Failed to dismiss suggestion');
    }
  };

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending');
  const appliedSuggestions = suggestions.filter(s => s.status === 'applied');
  const totalPotentialRevenue = summary?.totalPotentialRevenue || pendingSuggestions.reduce((sum, s) => sum + s.potentialRevenue, 0);
  const avgConfidence = summary?.avgConfidence || 87;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-32" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
          {[1, 2, 3].map(i => (
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
          <h2 className="text-2xl font-bold">AI Revenue Suggestions</h2>
          <p className="text-muted-foreground">Machine learning powered recommendations</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 mr-2">
            <span className="text-sm text-muted-foreground">Auto-apply</span>
            <Switch checked={isAutoApply} onCheckedChange={setIsAutoApply} />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Potential Revenue</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                  {formatCurrency(totalPotentialRevenue)}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                  From {pendingSuggestions.length} suggestions
                </p>
              </div>
              <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                <DollarSign className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-violet-700 dark:text-violet-400">Avg Confidence</p>
                <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">{avgConfidence}%</p>
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-1">
                  Prediction accuracy
                </p>
              </div>
              <div className="p-3 rounded-full bg-violet-200 dark:bg-violet-800">
                <Brain className="h-6 w-6 text-violet-700 dark:text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Applied This Month</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{appliedSuggestions.length}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Suggestions implemented
                </p>
              </div>
              <div className="p-3 rounded-full bg-amber-200 dark:bg-amber-800">
                <CheckCircle className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Info Banner */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-violet-50 to-emerald-50 dark:from-violet-950 dark:to-emerald-950">
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-full bg-white dark:bg-gray-800">
              <Sparkles className="h-6 w-6 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <h3 className="font-semibold">AI-Powered Revenue Optimization</h3>
              <p className="text-sm text-muted-foreground">
                Our AI analyzes your booking patterns, market trends, competitor pricing, and historical data 
                to generate actionable revenue optimization suggestions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Suggestions Tabs */}
      <Tabs defaultValue="all">
        <TabsList className="grid w-full grid-cols-4 max-w-[500px]">
          <TabsTrigger value="all">All ({suggestions.length})</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="marketing">Marketing</TabsTrigger>
          <TabsTrigger value="operations">Operations</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4 mt-4">
          {pendingSuggestions.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center">
                <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">No pending suggestions at the moment</p>
                <p className="text-sm text-muted-foreground">Check back later for new AI recommendations</p>
              </CardContent>
            </Card>
          ) : (
            pendingSuggestions.map((suggestion) => (
              <SuggestionCard
                key={suggestion.id}
                suggestion={suggestion}
                onApply={applySuggestion}
                onDismiss={dismissSuggestion}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="pricing" className="space-y-4 mt-4">
          {pendingSuggestions.filter(s => s.type === 'pricing').map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onApply={applySuggestion}
              onDismiss={dismissSuggestion}
            />
          ))}
        </TabsContent>

        <TabsContent value="marketing" className="space-y-4 mt-4">
          {pendingSuggestions.filter(s => s.type === 'marketing').map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onApply={applySuggestion}
              onDismiss={dismissSuggestion}
            />
          ))}
        </TabsContent>

        <TabsContent value="operations" className="space-y-4 mt-4">
          {pendingSuggestions.filter(s => s.type === 'operations' || s.type === 'revenue').map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onApply={applySuggestion}
              onDismiss={dismissSuggestion}
            />
          ))}
        </TabsContent>
      </Tabs>

      {/* Applied Suggestions */}
      {appliedSuggestions.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
              <CardTitle className="text-lg">Applied Suggestions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {appliedSuggestions.map((suggestion) => (
                <div
                  key={suggestion.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
                    <div>
                      <p className="font-medium">{suggestion.title}</p>
                      <p className="text-sm text-muted-foreground">{suggestion.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-600 dark:text-emerald-400">+{formatCurrency(suggestion.potentialRevenue)}</p>
                    <p className="text-xs text-muted-foreground">Potential impact</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Suggestion Card Component
function SuggestionCard({
  suggestion,
  onApply,
  onDismiss,
}: {
  suggestion: AISuggestion;
  onApply: (id: string) => void;
  onDismiss: (id: string) => void;
}) {
  const { formatCurrency } = useCurrency();
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`p-2 rounded-lg ${
              suggestion.type === 'pricing' ? 'bg-emerald-100 dark:bg-emerald-900' :
              suggestion.type === 'marketing' ? 'bg-violet-100 dark:bg-violet-900' :
              suggestion.type === 'operations' ? 'bg-cyan-100 dark:bg-cyan-900' :
              'bg-amber-100 dark:bg-amber-900'
            }`}>
              {suggestion.type === 'pricing' && <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
              {suggestion.type === 'marketing' && <Target className="h-5 w-5 text-violet-600 dark:text-violet-400" />}
              {suggestion.type === 'operations' && <Settings className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />}
              {suggestion.type === 'revenue' && <TrendingUp className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold">{suggestion.title}</h3>
                <Badge className={typeColors[suggestion.type]}>
                  {suggestion.type}
                </Badge>
                <Badge className={impactColors[suggestion.impact]}>
                  {suggestion.impact} impact
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{suggestion.description}</p>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Potential: {formatCurrency(suggestion.potentialRevenue)}/mo
                </span>
                <span className="flex items-center gap-1">
                  <Brain className="h-3 w-3" />
                  Confidence: {suggestion.confidence}%
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDismiss(suggestion.id)}
            >
              Dismiss
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => onApply(suggestion.id)}
            >
              Apply
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
