'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign,
  Users,
  Globe,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';

interface RevenueByProperty {
  propertyId: string;
  propertyName: string;
  propertyType: string;
  city: string;
  country: string;
  brandId: string | null;
  revenue: number;
  bookings: number;
  totalRooms: number;
  occupancyRate: number;
  adr: number;
}

interface RevenueByBrand {
  brandId: string;
  brandName: string;
  brandCode: string;
  propertyCount: number;
  revenue: number;
  bookings: number;
  avgRevenuePerProperty: number;
}

interface SourceBreakdown {
  source: string;
  count: number;
  percentage: number;
}

interface Nationality {
  nationality: string;
  count: number;
  percentage: number;
}

interface DailyRevenue {
  date: string;
  revenue: number;
}

interface TopPerformer {
  byRevenue: RevenueByProperty[];
  byOccupancy: RevenueByProperty[];
  byBookings: RevenueByProperty[];
}

interface AnalyticsData {
  period: string;
  dateRange: {
    start: string;
    end: string;
  };
  summary: {
    totalProperties: number;
    totalBrands: number;
    totalRooms: number;
    totalBookings: number;
    totalRevenue: number;
    averageOccupancy: number;
    averageADR: number;
  };
  revenueByProperty: RevenueByProperty[];
  revenueByBrand: RevenueByBrand[];
  sourceBreakdown: SourceBreakdown[];
  guestDemographics: {
    nationalities: Nationality[];
  };
  dailyRevenue: DailyRevenue[];
  topPerformers: TopPerformer;
}

const COLORS = ['#0D9488', '#14B8A6', '#2DD4BF', '#5EEAD4', '#99F6E4', '#CCFBF1', '#F97316', '#FB923C'];

export default function CrossPropertyAnalytics() {
  const { formatCurrency } = useCurrency();
  const { formatDate } = useTimezone();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('month');
  const [brandId, setBrandId] = useState<string>('all');

  // Fetch analytics data
  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.append('period', period);
      if (brandId !== 'all') {
        params.append('brandId', brandId);
      }

      const response = await fetch(`/api/chain/analytics?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        toast.error('Failed to fetch analytics data');
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period, brandId]);

  // Prepare chart data
  const revenueChartData = data?.revenueByProperty.slice(0, 8).map((p) => ({
    name: p.propertyName.length > 10 ? p.propertyName.substring(0, 10) + '...' : p.propertyName,
    revenue: p.revenue,
    bookings: p.bookings,
    occupancy: Math.round(p.occupancyRate),
  })) || [];

  const brandChartData = data?.revenueByBrand.map((b, i) => ({
    name: b.brandName,
    revenue: b.revenue,
    properties: b.propertyCount,
    avgRevenue: b.avgRevenuePerProperty,
    color: COLORS[i % COLORS.length],
  })) || [];

  const sourceChartData = data?.sourceBreakdown.map((s, i) => ({
    name: s.source.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
    value: s.count,
    percentage: s.percentage.toFixed(1),
    color: COLORS[i % COLORS.length],
  })) || [];

  const nationalityChartData = data?.guestDemographics.nationalities.slice(0, 6).map((n, i) => ({
    name: n.nationality,
    value: n.count,
    color: COLORS[i % COLORS.length],
  })) || [];

  const trendChartData = data?.dailyRevenue.slice(-30).map((d) => ({
    date: formatDate(new Date(d.date)),
    revenue: d.revenue,
  })) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Cross-Property Analytics</h1>
          <p className="text-muted-foreground">
            Compare performance across all properties
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={brandId} onValueChange={setBrandId}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {data.revenueByBrand.map((brand) => (
                <SelectItem key={brand.brandId} value={brand.brandId}>
                  {brand.brandName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold bg-gradient-to-r from-teal-600 to-teal-400 bg-clip-text text-transparent">{formatCurrency(data.summary.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              {data.summary.totalBookings} bookings
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Occupancy</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent">{data.summary.averageOccupancy.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              {data.summary.totalRooms} total rooms
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg ADR</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-amber-400 bg-clip-text text-transparent">{formatCurrency(data.summary.averageADR)}</div>
            <p className="text-xs text-muted-foreground">
              Average daily rate
            </p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Properties</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-violet-400 bg-clip-text text-transparent">{data.summary.totalProperties}</div>
            <p className="text-xs text-muted-foreground">
              {data.summary.totalBrands} brands
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="properties">By Property</TabsTrigger>
          <TabsTrigger value="brands">By Brand</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Revenue by Property Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Property</CardTitle>
                <CardDescription>Top performing properties by revenue</CardDescription>
              </CardHeader>
              <CardContent>
                {revenueChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={revenueChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(v) => `$${v / 1000}k`} />
                      <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="revenue" fill="#0D9488" name="Revenue" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Booking Sources */}
            <Card>
              <CardHeader>
                <CardTitle>Booking Sources</CardTitle>
                <CardDescription>Breakdown by booking channel</CardDescription>
              </CardHeader>
              <CardContent>
                {sourceChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={sourceChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percentage }) => `${name}: ${percentage}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {sourceChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top Performers */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ArrowUpRight className="h-4 w-4 text-green-600" />
                  Top by Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {data.topPerformers.byRevenue.map((p, i) => (
                      <div key={p.propertyId} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">#{i + 1}</span>
                          <span className="text-sm truncate max-w-[120px]">{p.propertyName}</span>
                        </div>
                        <span className="text-sm font-medium">{formatCurrency(p.revenue)}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-teal-600" />
                  Top by Occupancy
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {data.topPerformers.byOccupancy.map((p, i) => (
                      <div key={p.propertyId} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">#{i + 1}</span>
                          <span className="text-sm truncate max-w-[120px]">{p.propertyName}</span>
                        </div>
                        <Badge variant="secondary" className="bg-teal-100 text-teal-800">
                          {p.occupancyRate.toFixed(0)}%
                        </Badge>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  Top by Bookings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[200px]">
                  <div className="space-y-2">
                    {data.topPerformers.byBookings.map((p, i) => (
                      <div key={p.propertyId} className="flex items-center justify-between py-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">#{i + 1}</span>
                          <span className="text-sm truncate max-w-[120px]">{p.propertyName}</span>
                        </div>
                        <span className="text-sm font-medium">{p.bookings}</span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Guest Demographics */}
          <Card>
            <CardHeader>
              <CardTitle>Guest Demographics</CardTitle>
              <CardDescription>Top nationalities by booking count</CardDescription>
            </CardHeader>
            <CardContent>
              {nationalityChartData.length > 0 ? (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie
                        data={nationalityChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {nationalityChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1">
                    <div className="grid gap-2">
                      {data.guestDemographics.nationalities.slice(0, 6).map((n, i) => (
                        <div key={n.nationality} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[i % COLORS.length] }}
                          />
                          <span className="text-sm flex-1">{n.nationality}</span>
                          <span className="text-sm text-muted-foreground">{n.count}</span>
                          <Badge variant="secondary" className="text-xs">
                            {n.percentage.toFixed(1)}%
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  No demographic data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Property Tab */}
        <TabsContent value="properties" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Property Performance Comparison</CardTitle>
              <CardDescription>
                Detailed metrics for each property
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.revenueByProperty.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No property data available
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Rooms</TableHead>
                      <TableHead className="text-right">Bookings</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Occupancy</TableHead>
                      <TableHead className="text-right">ADR</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.revenueByProperty.map((property) => (
                      <TableRow key={property.propertyId} className="hover:bg-muted/50 transition-colors">
                        <TableCell className="font-medium">{property.propertyName}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{property.propertyType}</Badge>
                        </TableCell>
                        <TableCell>{property.city}, {property.country}</TableCell>
                        <TableCell className="text-right">{property.totalRooms}</TableCell>
                        <TableCell className="text-right">{property.bookings}</TableCell>
                        <TableCell className="text-right">{formatCurrency(property.revenue)}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="secondary"
                            className={cn(
                              'text-white px-2.5 py-0.5 rounded-full text-xs font-medium',
                              property.occupancyRate >= 70
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                                : property.occupancyRate >= 40
                                ? 'bg-gradient-to-r from-amber-500 to-amber-400'
                                : 'bg-gradient-to-r from-red-500 to-rose-400'
                            )}
                          >
                            {property.occupancyRate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(property.adr)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Brand Tab */}
        <TabsContent value="brands" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue by Brand</CardTitle>
                <CardDescription>Compare brand performance</CardDescription>
              </CardHeader>
              <CardContent>
                {brandChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={brandChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v) => `$${v / 1000}k`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Bar dataKey="revenue" fill="#0D9488" name="Total Revenue" />
                      <Bar dataKey="avgRevenue" fill="#14B8A6" name="Avg per Property" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No brand data available
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Brand Overview</CardTitle>
                <CardDescription>Summary by brand</CardDescription>
              </CardHeader>
              <CardContent>
                {data.revenueByBrand.length === 0 ? (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No brand data available
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.revenueByBrand.map((brand, i) => (
                      <div
                        key={brand.brandId}
                        className="flex items-center gap-4 p-3 rounded-lg border hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5"
                      >
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        >
                          {brand.brandName.charAt(0)}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium">{brand.brandName}</div>
                          <div className="text-sm text-muted-foreground">
                            {brand.propertyCount} properties • {brand.bookings} bookings
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(brand.revenue)}</div>
                          <div className="text-xs text-muted-foreground">
                            {formatCurrency(brand.avgRevenuePerProperty)}/property
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Trend</CardTitle>
              <CardDescription>Daily revenue over the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              {trendChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart data={trendChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `$${v / 1000}k`} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#0D9488"
                      fill="#0D9488"
                      fillOpacity={0.3}
                      name="Revenue"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-muted-foreground">
                  No trend data available
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comparison Chart */}
          <Card className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-200 hover:-translate-y-0.5">
            <CardHeader>
              <CardTitle>Property Comparison</CardTitle>
              <CardDescription>Occupancy and bookings comparison</CardDescription>
            </CardHeader>
            <CardContent>
              {revenueChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={revenueChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" orientation="left" />
                    <YAxis yAxisId="right" orientation="right" />
                    <Tooltip />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="bookings"
                      stroke="#0D9488"
                      strokeWidth={2}
                      name="Bookings"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="occupancy"
                      stroke="#F97316"
                      strokeWidth={2}
                      name="Occupancy %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No comparison data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
