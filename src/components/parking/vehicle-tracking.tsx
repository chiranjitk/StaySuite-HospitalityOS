'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Car,
  Search,
  RefreshCw,
  Loader2,
  MapPin,
  Clock,
  User,
  DollarSign,
  LogIn,
  LogOut,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { exportToCSV } from '@/lib/export-utils';
import { format, formatDistanceToNow } from 'date-fns';
import { usePropertyId } from '@/hooks/use-property';

interface Vehicle {
  id: string;
  licensePlate: string;
  make?: string;
  model?: string;
  color?: string;
  year?: number;
  guestId?: string;
  guest?: {
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
  };
  bookingId?: string;
  slotId?: string;
  slot?: {
    id: string;
    number: string;
    floor: number;
    type: string;
  };
  entryTime?: string;
  exitTime?: string;
  parkingFee: number;
  isPaid: boolean;
  status: string;
  createdAt: string;
}

// Vehicle interface - no mock data, using real API

export default function VehicleTracking() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { propertyId } = usePropertyId();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isEntryOpen, setIsEntryOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state for new entry
  const [entryForm, setEntryForm] = useState({
    licensePlate: '',
    make: '',
    model: '',
    color: '',
  });

  // Fetch vehicles
  useEffect(() => {
    const fetchVehicles = async () => {
      setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (propertyId) params.append('propertyId', propertyId);
        const response = await fetch(`/api/vehicles?${params.toString()}`);
        const result = await response.json();
        if (result.success) {
          setVehicles(result.data);
        }
      } catch (error) {
        console.error('Error fetching vehicles:', error);
        toast({
          title: 'Error',
          description: 'Failed to fetch vehicles',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchVehicles();
  }, [toast, propertyId]);

  const filteredVehicles = vehicles.filter(v => {
    if (statusFilter !== 'all' && v.status !== statusFilter) return false;
    if (searchQuery) {
      return (
        v.licensePlate.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.guest?.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.guest?.lastName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return true;
  });

  const handleVehicleEntry = async () => {
    if (!entryForm.licensePlate) {
      toast({
        title: 'Validation Error',
        description: 'License plate is required',
        variant: 'destructive',
      });
      return;
    }

    if (entryForm.licensePlate.trim().length < 2) {
      toast({
        title: 'Validation Error',
        description: 'License plate must be at least 2 characters',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          licensePlate: entryForm.licensePlate.toUpperCase(),
          make: entryForm.make,
          model: entryForm.model,
          color: entryForm.color,
          ...(propertyId ? { propertyId } : {}),
        }),
      });

      const result = await response.json();

      if (result.success) {
        setVehicles(prev => [result.data, ...prev]);
        setIsEntryOpen(false);
        setEntryForm({ licensePlate: '', make: '', model: '', color: '' });
        toast({
          title: 'Vehicle Entry Recorded',
          description: `Vehicle ${entryForm.licensePlate} has been logged`,
        });
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to log vehicle entry',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error logging vehicle entry:', error);
      toast({
        title: 'Error',
        description: 'Failed to log vehicle entry',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleVehicleExit = async (vehicleId: string) => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/vehicles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: vehicleId,
          action: 'exit',
        }),
      });

      const result = await response.json();

      if (result.success) {
        setVehicles(prev => prev.map(v => v.id === vehicleId ? result.data : v));
        setIsDetailOpen(false);
        toast({
          title: 'Vehicle Exit Recorded',
          description: `Parking fee: ${formatCurrency(result.data.parkingFee)}`,
        });
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to record vehicle exit',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error recording vehicle exit:', error);
      toast({
        title: 'Error',
        description: 'Failed to record vehicle exit',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Stats
  const parkedCount = vehicles.filter(v => v.status === 'parked').length;
  const exitedToday = vehicles.filter(v => 
    v.status === 'exited' && 
    v.exitTime && 
    new Date(v.exitTime).toDateString() === new Date().toDateString()
  ).length;
  const totalFees = vehicles.reduce((sum, v) => sum + v.parkingFee, 0);
  const unpaidFees = vehicles.filter(v => !v.isPaid && v.status === 'parked').reduce((sum, v) => sum + v.parkingFee, 0);

  if (!propertyId) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Car className="h-12 w-12 mb-4" />
        <p className="text-lg font-medium">No Property Selected</p>
        <p className="text-sm">Please select a property to manage vehicle tracking</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Car className="h-5 w-5" />
            Vehicle Tracking
          </h2>
          <p className="text-sm text-muted-foreground">
            Monitor vehicle entry/exit and parking billing
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportToCSV(
            vehicles.map(v => ({
              licensePlate: v.licensePlate,
              make: v.make || '',
              model: v.model || '',
              color: v.color || '',
              status: v.status,
              parkingFee: v.parkingFee,
              isPaid: v.isPaid,
              guestName: v.guest ? `${v.guest.firstName} ${v.guest.lastName}` : '',
            })),
            `vehicle-tracking-${new Date().toISOString().slice(0, 10)}`,
            [
              { key: 'licensePlate', label: 'License Plate' },
              { key: 'make', label: 'Make' },
              { key: 'model', label: 'Model' },
              { key: 'color', label: 'Color' },
              { key: 'guestName', label: 'Guest' },
              { key: 'status', label: 'Status' },
              { key: 'parkingFee', label: 'Fee ($)' },
              { key: 'isPaid', label: 'Paid' },
            ]
          )}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => setIsEntryOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Log Entry
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Car className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{parkedCount}</div>
              <div className="text-xs text-muted-foreground">Currently Parked</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <LogOut className="h-4 w-4 text-cyan-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{exitedToday}</div>
              <div className="text-xs text-muted-foreground">Exited Today</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <DollarSign className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(totalFees)}</div>
              <div className="text-xs text-muted-foreground">Total Fees</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <DollarSign className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{formatCurrency(unpaidFees)}</div>
              <div className="text-xs text-muted-foreground">Unpaid</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by license plate or guest..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="parked">Parked</SelectItem>
                <SelectItem value="exited">Exited</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Vehicles Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredVehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Car className="h-12 w-12 mb-4" />
              <p>No vehicles found</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead>Slot</TableHead>
                    <TableHead>Entry Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Fee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVehicles.map((vehicle) => {
                    const entryTime = vehicle.entryTime ? new Date(vehicle.entryTime) : null;
                    const duration = entryTime 
                      ? formatDistanceToNow(entryTime, { addSuffix: false })
                      : '-';

                    return (
                      <TableRow key={vehicle.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="p-2 rounded-lg bg-muted">
                              <Car className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-medium">{vehicle.licensePlate}</p>
                              <p className="text-xs text-muted-foreground">
                                {vehicle.make} {vehicle.model} {vehicle.year}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {vehicle.guest ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
                                  {vehicle.guest.firstName[0]}{vehicle.guest.lastName[0]}
                                </AvatarFallback>
                              </Avatar>
                              <span>{vehicle.guest.firstName} {vehicle.guest.lastName}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {vehicle.slot ? (
                            <Badge variant="outline">
                              {vehicle.slot.number} (F{vehicle.slot.floor})
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{entryTime ? format(entryTime, 'MMM d, HH:mm') : '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{duration}</span>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{formatCurrency(vehicle.parkingFee)}</p>
                            {!vehicle.isPaid && vehicle.parkingFee > 0 && (
                              <p className="text-xs text-amber-600">Unpaid</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="secondary"
                            className={cn(
                              'text-white',
                              vehicle.status === 'parked' ? 'bg-emerald-500' : 'bg-gray-500'
                            )}
                          >
                            {vehicle.status === 'parked' ? 'Parked' : 'Exited'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedVehicle(vehicle);
                              setIsDetailOpen(true);
                            }}
                          >
                            View
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

      {/* Vehicle Entry Dialog */}
      <Dialog open={isEntryOpen} onOpenChange={setIsEntryOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Vehicle Entry</DialogTitle>
            <DialogDescription>
              Record a new vehicle entering the parking
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>License Plate *</Label>
              <Input
                placeholder="ABC-1234"
                value={entryForm.licensePlate}
                onChange={(e) => setEntryForm(prev => ({ ...prev, licensePlate: e.target.value.toUpperCase() }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Make</Label>
                <Input
                  placeholder="Toyota"
                  value={entryForm.make}
                  onChange={(e) => setEntryForm(prev => ({ ...prev, make: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input
                  placeholder="Camry"
                  value={entryForm.model}
                  onChange={(e) => setEntryForm(prev => ({ ...prev, model: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <Input
                placeholder="Silver"
                value={entryForm.color}
                onChange={(e) => setEntryForm(prev => ({ ...prev, color: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEntryOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleVehicleEntry} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Log Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vehicle Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vehicle Details</DialogTitle>
          </DialogHeader>
          {selectedVehicle && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-muted">
                  <Car className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="font-medium text-lg">{selectedVehicle.licensePlate}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedVehicle.make} {selectedVehicle.model} {selectedVehicle.year}
                  </p>
                  {selectedVehicle.color && (
                    <Badge variant="outline" className="mt-1">{selectedVehicle.color}</Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge 
                    variant="secondary"
                    className={cn(
                      'text-white mt-1',
                      selectedVehicle.status === 'parked' ? 'bg-emerald-500' : 'bg-gray-500'
                    )}
                  >
                    {selectedVehicle.status === 'parked' ? 'Parked' : 'Exited'}
                  </Badge>
                </div>
                {selectedVehicle.slot && (
                  <div>
                    <p className="text-muted-foreground">Slot</p>
                    <p className="font-medium">{selectedVehicle.slot.number} (Floor {selectedVehicle.slot.floor})</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground">Entry Time</p>
                  <p className="font-medium">
                    {selectedVehicle.entryTime 
                      ? format(new Date(selectedVehicle.entryTime), 'MMM d, yyyy HH:mm')
                      : '-'
                    }
                  </p>
                </div>
                {selectedVehicle.exitTime && (
                  <div>
                    <p className="text-muted-foreground">Exit Time</p>
                    <p className="font-medium">
                      {format(new Date(selectedVehicle.exitTime), 'MMM d, yyyy HH:mm')}
                    </p>
                  </div>
                )}
              </div>

              {selectedVehicle.guest && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground mb-2">Guest</p>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-teal-500 text-white">
                        {selectedVehicle.guest.firstName[0]}{selectedVehicle.guest.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{selectedVehicle.guest.firstName} {selectedVehicle.guest.lastName}</p>
                      {selectedVehicle.guest.phone && (
                        <p className="text-xs text-muted-foreground">{selectedVehicle.guest.phone}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Parking Fee</span>
                  <span className="text-xl font-bold">{formatCurrency(selectedVehicle.parkingFee)}</span>
                </div>
                {!selectedVehicle.isPaid && selectedVehicle.parkingFee > 0 && (
                  <Badge className="mt-2 bg-amber-500">Payment Pending</Badge>
                )}
              </div>

              {selectedVehicle.status === 'parked' && (
                <Button 
                  className="w-full"
                  onClick={() => handleVehicleExit(selectedVehicle.id)}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <LogOut className="h-4 w-4 mr-2" />
                  )}
                  Record Exit
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
