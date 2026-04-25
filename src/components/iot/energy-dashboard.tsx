'use client';

import { useState, useEffect } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Zap, Droplets, Flame, Leaf, TrendingDown, TrendingUp,
  ArrowDownRight, ArrowUpRight, Calendar, RefreshCw, BarChart3
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface EnergyData {
  dailyMetrics: Array<{
    date: string;
    electricityKwh: number;
    gasM3: number;
    waterM3: number;
    totalCost: number;
    carbonFootprint: number;
    propertyName: string;
  }>;
  totals: {
    electricityKwh: number;
    gasM3: number;
    waterM3: number;
    electricityCost: number;
    gasCost: number;
    waterCost: number;
    carbonFootprint: number;
    totalCost: number;
  };
  dailyAvg: {
    electricityKwh: number;
    gasM3: number;
    waterM3: number;
    cost: number;
  };
  propertyBreakdown: Array<{
    propertyId: string;
    propertyName: string;
    electricityKwh: number;
    gasM3: number;
    waterM3: number;
    totalCost: number;
    carbonFootprint: number;
  }>;
  savings: {
    comparedToLastMonth: number;
    costSavings: number;
    carbonReduction: number;
  };
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function EnergyDashboard() {
  const { formatCurrency } = useCurrency();
  const [data, setData] = useState<EnergyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30days');
  const [selectedProperty, setSelectedProperty] = useState('all');

  useEffect(() => {
    fetchEnergyData();
  }, [period, selectedProperty]);

  const fetchEnergyData = async () => {
    try {
      setLoading(true);
      
      const params = new URLSearchParams();
      if (selectedProperty !== 'all') {
        params.append('propertyId', selectedProperty);
      }
      
      // Calculate date range based on period
      const now = new Date();
      let startDate: Date;
      
      switch (period) {
        case '7days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90days':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      
      params.append('startDate', startDate.toISOString());
      params.append('endDate', now.toISOString());

      const response = await fetch(`/api/iot/energy?${params.toString()}`);
      
      if (response.ok) {
        const energyData = await response.json();
        setData(energyData);
      }
    } catch (error) {
      console.error('Error fetching energy data:', error);
      toast.error('Failed to fetch energy data');
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number, decimals: number = 0) => {
    return num.toFixed(decimals);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No energy data available
      </div>
    );
  }

  const pieData = [
    { name: 'Electricity', value: data.totals.electricityCost, color: COLORS[0] },
    { name: 'Gas', value: data.totals.gasCost, color: COLORS[1] },
    { name: 'Water', value: data.totals.waterCost, color: COLORS[2] }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Energy Dashboard</h1>
            <p className="text-muted-foreground">
              Monitor energy consumption and sustainability metrics
            </p>
          </div>
          <Button variant="outline" onClick={fetchEnergyData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7days">Last 7 Days</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="90days">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
            <Select value={selectedProperty} onValueChange={setSelectedProperty}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Properties</SelectItem>
                {data.propertyBreakdown.map((p) => (
                  <SelectItem key={p.propertyId} value={p.propertyId}>
                    {p.propertyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Energy Cost</p>
                <p className="text-2xl font-bold">{formatCurrency(data.totals.totalCost)}</p>
                <div className={`flex items-center text-sm ${
                  data.savings.comparedToLastMonth < 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {data.savings.comparedToLastMonth < 0 ? (
                    <>
                      <TrendingDown className="h-4 w-4 mr-1" />
                      {Math.abs(data.savings.comparedToLastMonth)}% savings
                    </>
                  ) : (
                    <>
                      <TrendingUp className="h-4 w-4 mr-1" />
                      {data.savings.comparedToLastMonth}% increase
                    </>
                  )}
                </div>
              </div>
              <div className="p-3 rounded-full bg-teal-100">
                <Zap className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Electricity</p>
                <p className="text-2xl font-bold">{formatNumber(data.totals.electricityKwh)} kWh</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(data.totals.electricityCost)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-yellow-100">
                <Zap className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Gas</p>
                <p className="text-2xl font-bold">{formatNumber(data.totals.gasM3)} m³</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(data.totals.gasCost)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-orange-100">
                <Flame className="h-6 w-6 text-orange-600 dark:text-orange-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Water</p>
                <p className="text-2xl font-bold">{formatNumber(data.totals.waterM3)} m³</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(data.totals.waterCost)}
                </p>
              </div>
              <div className="p-3 rounded-full bg-blue-100">
                <Droplets className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Green Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-green-50 dark:bg-green-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-400">Carbon Footprint</p>
                <p className="text-2xl font-bold text-green-800 dark:text-green-300">
                  {formatNumber(data.totals.carbonFootprint)} kg CO₂
                </p>
              </div>
              <Leaf className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-teal-50 dark:bg-teal-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-teal-700 dark:text-teal-400">Cost Savings</p>
                <p className="text-2xl font-bold text-teal-800 dark:text-teal-300">
                  {formatCurrency(data.savings.costSavings)}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-teal-600 dark:text-teal-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-emerald-50 dark:bg-emerald-950">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Carbon Reduction</p>
                <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-300">
                  {formatNumber(data.savings.carbonReduction)} kg CO₂
                </p>
              </div>
              <Leaf className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="consumption" className="space-y-4">
        <TabsList>
          <TabsTrigger value="consumption">Consumption Trends</TabsTrigger>
          <TabsTrigger value="costs">Cost Breakdown</TabsTrigger>
          <TabsTrigger value="properties">By Property</TabsTrigger>
        </TabsList>

        <TabsContent value="consumption" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Daily Energy Consumption</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.dailyMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area 
                      type="monotone" 
                      dataKey="electricityKwh" 
                      stackId="1"
                      stroke="#10b981" 
                      fill="#10b981" 
                      fillOpacity={0.6}
                      name="Electricity (kWh)"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="gasM3" 
                      stackId="2"
                      stroke="#f59e0b" 
                      fill="#f59e0b" 
                      fillOpacity={0.6}
                      name="Gas (m³)"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="waterM3" 
                      stackId="3"
                      stroke="#3b82f6" 
                      fill="#3b82f6" 
                      fillOpacity={0.6}
                      name="Water (m³)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Carbon Footprint Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.dailyMetrics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} />
                    <YAxis />
                    <Tooltip />
                    <Line 
                      type="monotone" 
                      dataKey="carbonFootprint" 
                      stroke="#10b981" 
                      strokeWidth={2}
                      name="CO₂ (kg)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Cost by Resource</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        fill="#8884d8"
                        paddingAngle={5}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Daily Cost Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.dailyMetrics}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                      <Bar dataKey="totalCost" fill="#10b981" name="Daily Cost" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="properties" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Energy by Property</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property</TableHead>
                      <TableHead className="text-right">Electricity (kWh)</TableHead>
                      <TableHead className="text-right">Gas (m³)</TableHead>
                      <TableHead className="text-right">Water (m³)</TableHead>
                      <TableHead className="text-right">Total Cost</TableHead>
                      <TableHead className="text-right">CO₂ (kg)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.propertyBreakdown.map((property) => (
                      <TableRow key={property.propertyId}>
                        <TableCell className="font-medium">{property.propertyName}</TableCell>
                        <TableCell className="text-right">{formatNumber(property.electricityKwh)}</TableCell>
                        <TableCell className="text-right">{formatNumber(property.gasM3)}</TableCell>
                        <TableCell className="text-right">{formatNumber(property.waterM3)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(property.totalCost)}</TableCell>
                        <TableCell className="text-right">{formatNumber(property.carbonFootprint)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Property Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.propertyBreakdown} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="propertyName" type="category" width={100} />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                    <Bar dataKey="electricityCost" stackId="a" fill="#10b981" name="Electricity" />
                    <Bar dataKey="gasCost" stackId="a" fill="#f59e0b" name="Gas" />
                    <Bar dataKey="waterCost" stackId="a" fill="#3b82f6" name="Water" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Daily Averages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Daily Averages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Avg Electricity</p>
              <p className="text-xl font-bold">{formatNumber(data.dailyAvg.electricityKwh, 1)} kWh</p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Avg Gas</p>
              <p className="text-xl font-bold">{formatNumber(data.dailyAvg.gasM3, 1)} m³</p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Avg Water</p>
              <p className="text-xl font-bold">{formatNumber(data.dailyAvg.waterM3, 1)} m³</p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">Avg Daily Cost</p>
              <p className="text-xl font-bold">{formatCurrency(data.dailyAvg.cost)}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
