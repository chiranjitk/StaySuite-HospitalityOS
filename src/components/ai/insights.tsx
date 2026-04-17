'use client';

import { useState, useEffect } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Lightbulb, TrendingUp, AlertTriangle, Sparkles, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface AIInsight {
  id: string;
  category: 'revenue' | 'operations' | 'guest';
  type: 'opportunity' | 'alert' | 'insight' | 'recommendation' | 'prediction';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  potentialRevenue?: number;
  createdAt: string;
  action: string;
  status: 'active' | 'dismissed' | 'acted';
}

export default function AIInsights() {
  const { formatCurrency } = useCurrency();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, opportunities: 0, alerts: 0, totalPotentialRevenue: 0 });

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    try {
      const response = await fetch('/api/ai/insights');
      const data = await response.json();
      if (data.success) {
        setInsights(data.data.insights);
        setStats(data.data.stats);
      }
    } catch {
      toast.error('Failed to fetch AI insights');
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (id: string) => {
    // Optimistically update local state
    setInsights(insights.map(i => i.id === id ? { ...i, status: 'dismissed' } : i));
    try {
      const response = await fetch('/api/ai/insights', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insightId: id, action: 'dismiss' }),
      });
      if (!response.ok) {
        // Revert on failure
        setInsights(insights.map(i => i.id === id ? { ...i, status: 'active' } : i));
        toast.error('Failed to dismiss insight');
        return;
      }
      toast.success('Insight dismissed');
    } catch {
      // Revert on failure
      setInsights(insights.map(i => i.id === id ? { ...i, status: 'active' } : i));
      toast.error('Failed to dismiss insight');
    }
  };

  const handleAct = async (id: string) => {
    // Optimistically update local state
    setInsights(insights.map(i => i.id === id ? { ...i, status: 'acted' } : i));
    try {
      const response = await fetch('/api/ai/insights', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insightId: id, action: 'apply' }),
      });
      if (!response.ok) {
        // Revert on failure
        setInsights(insights.map(i => i.id === id ? { ...i, status: 'active' } : i));
        toast.error('Failed to initiate action');
        return;
      }
      toast.success('Action initiated');
    } catch {
      // Revert on failure
      setInsights(insights.map(i => i.id === id ? { ...i, status: 'active' } : i));
      toast.error('Failed to initiate action');
    }
  };

  const typeIcons = {
    opportunity: TrendingUp,
    alert: AlertTriangle,
    insight: Lightbulb,
    recommendation: Sparkles,
    prediction: Sparkles,
  };

  const typeColors = {
    opportunity: 'from-emerald-500/20 to-green-500/20',
    alert: 'from-red-500/20 to-rose-500/20',
    insight: 'from-cyan-500/20 to-teal-500/20',
    recommendation: 'from-amber-500/20 to-orange-500/20',
    prediction: 'from-violet-500/20 to-purple-500/20',
  };

  const impactColors = {
    high: 'bg-red-500',
    medium: 'bg-amber-500',
    low: 'bg-gray-500',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activeInsights = insights.filter(i => i.status === 'active');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Insights</h2>
          <p className="text-muted-foreground">AI-powered recommendations and opportunities</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="pb-2">
            <CardDescription>Total Insights</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription>Opportunities</CardDescription>
            <CardTitle className="text-2xl">{stats.opportunities}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription>Alerts</CardDescription>
            <CardTitle className="text-2xl">{stats.alerts}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardHeader className="pb-2">
            <CardDescription>Potential Revenue</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(stats.totalPotentialRevenue)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Insights Grid */}
      <div className="grid gap-4">
        {activeInsights.map((insight) => {
          const Icon = typeIcons[insight.type];
          return (
            <Card key={insight.id} className="overflow-hidden">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg bg-gradient-to-br ${typeColors[insight.type]} flex items-center justify-center`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{insight.title}</CardTitle>
                      <CardDescription className="capitalize">{insight.category} • {insight.type}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${impactColors[insight.impact]}`} title={`${insight.impact} impact`} />
                    <Badge variant="outline" className="capitalize">{insight.impact} Impact</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{insight.description}</p>
                {insight.potentialRevenue && (
                  <div className="flex items-center gap-2 mb-4 p-2 bg-emerald-500/10 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <span className="text-sm font-medium text-emerald-600">
                      Potential Revenue: {formatCurrency(insight.potentialRevenue)}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-4 border-t">
                  <Button size="sm" onClick={() => handleAct(insight.id)}>
                    <Check className="h-4 w-4 mr-2" />
                    {insight.action}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleDismiss(insight.id)}>
                    <X className="h-4 w-4 mr-2" />
                    Dismiss
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {activeInsights.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Lightbulb className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No active insights at the moment</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
