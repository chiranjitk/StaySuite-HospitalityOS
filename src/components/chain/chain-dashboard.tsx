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
  Loader2,
  Building2,
  Users,
  BedDouble,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Calendar,
  DollarSign,
  BarChart3,
} from 'lucide-react';
import { useCurrency } from '@/contexts/CurrencyContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface Brand {
  id: string;
  name: string;
  code: string;
  logo: string | null;
  primaryColor: string | null;
  propertyCount: number;
  status: string;
}

interface PropertyPerformance {
  id: string;
  name: string;
  city: string;
  country: string;
  type: string;
  status: string;
  totalRooms: number;
  bookings: number;
  revenue: number;
  occupancy: number;
}

interface DashboardData {
  overview: {
    totalProperties: number;
    totalRooms: number;
    totalBrands: number;
    occupancyRate: number;
    activeGuests: number;
    todayArrivals: number;
    todayDepartures: number;
  };
  metrics: {
    bookings: {
      current: number;
      previous: number;
      change: number;
    };
    revenue: {
      current: number;
      previous: number;
      change: number;
    };
  };
  brands: Brand[];
  properties: PropertyPerformance[];
}

const COLORS = ['#0D9488', '#14B8A6', '#2DD4BF', '#5EEAD4', '#99F6E4', '#CCFBF1'];

export default function ChainDashboard() {
  const { formatCurrency } = useCurrency();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('all');

  // Fetch dashboard data
  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedBrandId !== 'all') {
        params.append('brandId', selectedBrandId);
      }

      const response = await fetch(`/api/chain/dashboard?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        toast.error('Failed to fetch dashboard data');
      }
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, [selectedBrandId]);

  // Prepare chart data
  const propertyChartData = data?.properties.slice(0, 6).map((p) => ({
    name: p.name.length > 12 ? p.name.substring(0, 12) + '...' : p.name,
    revenue: p.revenue,
    occupancy: Math.round(p.occupancy),
    bookings: p.bookings,
  })) || [];

  const brandDistributionData = data?.brands.map((b, i) => ({
    name: b.name,
    value: b.propertyCount,
    color: b.primaryColor || COLORS[i % COLORS.length],
  })) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400" />
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
          <h1 className="text-2xl font-bold tracking-tight">Chain Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of all properties in your hotel chain
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedBrandId} onValueChange={setSelectedBrandId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by brand" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {data.brands.map((brand) => (
                <SelectItem key={brand.id} value={brand.id}>
                  {brand.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Properties</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.totalProperties}</div>
            <p className="text-xs text-muted-foreground">
              {data.overview.totalBrands} brands
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Rooms</CardTitle>
            <BedDouble className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.totalRooms}</div>
            <p className="text-xs text-muted-foreground">
              Across all properties
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Occupancy Rate</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.occupancyRate}%</div>
            <p className="text-xs text-muted-foreground">
              Current occupancy
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Guests</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.overview.activeGuests}</div>
            <p className="text-xs text-muted-foreground">
              Currently staying
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{data.metrics.bookings.current}</div>
              <Badge
                variant="secondary"
                className={
                  data.metrics.bookings.change >= 0
                    ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:text-red-200'
                }
              >
                {data.metrics.bookings.change >= 0 ? (
                  <TrendingUp className="h-3 w-3 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                {Math.abs(data.metrics.bookings.change)}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              vs {data.metrics.bookings.previous} last month
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">
                {formatCurrency(data.metrics.revenue.current)}
              </div>
              <Badge
                variant="secondary"
                className={
                  data.metrics.revenue.change >= 0
                    ? 'bg-green-100 text-green-800 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:text-red-200'
                }
              >
                {data.metrics.revenue.change >= 0 ? (
                  <TrendingUp className="h-3 w-3 mr-1" />
                ) : (
                  <TrendingDown className="h-3 w-3 mr-1" />
                )}
                {Math.abs(data.metrics.revenue.change)}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              vs {formatCurrency(data.metrics.revenue.previous)} last month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Today's Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Today&apos;s Arrivals</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <ArrowRightLeft className="h-8 w-8 text-teal-600 dark:text-teal-400" />
              <div>
                <div className="text-3xl font-bold">{data.overview.todayArrivals}</div>
                <p className="text-sm text-muted-foreground">
                  Check-ins scheduled
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Today&apos;s Departures</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <ArrowRightLeft className="h-8 w-8 text-orange-500 dark:text-orange-400" />
              <div>
                <div className="text-3xl font-bold">{data.overview.todayDepartures}</div>
                <p className="text-sm text-muted-foreground">
                  Check-outs scheduled
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Property Performance</CardTitle>
            <CardDescription>Revenue and occupancy by property</CardDescription>
          </CardHeader>
          <CardContent>
            {propertyChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={propertyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" orientation="left" stroke="#0D9488" />
                  <YAxis yAxisId="right" orientation="right" stroke="#64748b" />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="revenue" fill="#0D9488" name="Revenue" />
                  <Bar yAxisId="right" dataKey="occupancy" fill="#14B8A6" name="Occupancy (%)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No property data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Brand Distribution</CardTitle>
            <CardDescription>Properties by brand</CardDescription>
          </CardHeader>
          <CardContent>
            {brandDistributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={brandDistributionData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {brandDistributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No brand data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Brands Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Brands Overview</CardTitle>
          <CardDescription>All brands in your chain</CardDescription>
        </CardHeader>
        <CardContent>
          {data.brands.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No brands created yet
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {data.brands.map((brand) => (
                <Card key={brand.id} className="overflow-hidden">
                  <div
                    className="h-2"
                    style={{ backgroundColor: brand.primaryColor || '#0D9488' }}
                  />
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: brand.primaryColor || '#0D9488' }}
                      >
                        {brand.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold">{brand.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {brand.propertyCount} properties
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Properties Table */}
      <Card>
        <CardHeader>
          <CardTitle>Properties Performance</CardTitle>
          <CardDescription>Performance metrics for each property</CardDescription>
        </CardHeader>
        <CardContent>
          {data.properties.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No properties available
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.properties.map((property) => (
                  <TableRow key={property.id}>
                    <TableCell>
                      <div className="font-medium">{property.name}</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{property.type}</Badge>
                    </TableCell>
                    <TableCell>
                      {property.city}, {property.country}
                    </TableCell>
                    <TableCell className="text-right">{property.totalRooms}</TableCell>
                    <TableCell className="text-right">{property.bookings}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(property.revenue)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="secondary"
                        className={
                          property.occupancy >= 70
                            ? 'bg-green-100 text-green-800 dark:text-green-200'
                            : property.occupancy >= 40
                            ? 'bg-yellow-100 text-yellow-800 dark:text-yellow-200'
                            : 'bg-red-100 text-red-800 dark:text-red-200'
                        }
                      >
                        {property.occupancy.toFixed(1)}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
