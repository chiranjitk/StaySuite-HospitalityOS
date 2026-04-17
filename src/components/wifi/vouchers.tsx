'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Ticket,
  Plus,
  Search,
  Loader2,
  QrCode,
  Copy,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { format, formatDistanceToNow } from 'date-fns';

interface WiFiPlan {
  id: string;
  name: string;
  downloadSpeed: number;
  uploadSpeed: number;
  dataLimit: number | null;
  sessionLimit: number | null;
  validityDays: number;
  price: number;
  currency: string;
}

interface WiFiVoucher {
  id: string;
  code: string;
  plan: WiFiPlan;
  isUsed: boolean;
  usedAt: string | null;
  validFrom: string;
  validUntil: string;
  status: string;
  createdAt: string;
}

const voucherStatuses = [
  { value: 'active', label: 'Active', color: 'bg-gradient-to-r from-emerald-500 to-green-500' },
  { value: 'used', label: 'Used', color: 'bg-gradient-to-r from-gray-400 to-gray-500' },
  { value: 'expired', label: 'Expired', color: 'bg-gradient-to-r from-red-400 to-rose-500' },
  { value: 'revoked', label: 'Revoked', color: 'bg-gradient-to-r from-red-500 to-red-600' },
];

export default function WifiVouchers() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [vouchers, setVouchers] = useState<WiFiVoucher[]>([]);
  const [plans, setPlans] = useState<WiFiPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [summary, setSummary] = useState({
    byStatus: {} as Record<string, number>,
    totalUsed: 0,
  });

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<WiFiVoucher | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    planId: '',
    quantity: 1,
    validityDays: 1,
  });

  // Fetch plans for dropdown
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await fetch('/api/wifi/plans?status=active');
        const result = await response.json();
        if (result.success) {
          setPlans(result.data);
          if (result.data.length > 0) {
            setFormData(prev => ({
              ...prev,
              planId: result.data[0].id,
              validityDays: result.data[0].validityDays,
            }));
          }
        }
      } catch (error) {
        console.error('Error fetching plans:', error);
      }
    };
    fetchPlans();
  }, []);

  // Fetch vouchers
  const fetchVouchers = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('search', searchQuery);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (planFilter !== 'all') params.append('planId', planFilter);

      const response = await fetch(`/api/wifi/vouchers?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setVouchers(result.data);
        setSummary(result.summary);
      }
    } catch (error) {
      console.error('Error fetching vouchers:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch WiFi vouchers',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVouchers();
  }, [statusFilter, planFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        fetchVouchers();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Create vouchers
  const handleCreate = async () => {
    if (!formData.planId) {
      toast({
        title: 'Validation Error',
        description: 'Please select a WiFi plan',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/wifi/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: `Created ${result.data.length} voucher(s) successfully`,
        });
        setIsCreateOpen(false);
        resetForm();
        fetchVouchers();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to create vouchers',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating vouchers:', error);
      toast({
        title: 'Error',
        description: 'Failed to create vouchers',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Revoke voucher
  const handleRevoke = async (voucherId: string) => {
    try {
      const response = await fetch(`/api/wifi/vouchers?id=${voucherId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Voucher revoked successfully',
        });
        fetchVouchers();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to revoke voucher',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error revoking voucher:', error);
      toast({
        title: 'Error',
        description: 'Failed to revoke voucher',
        variant: 'destructive',
      });
    }
  };

  // Copy code to clipboard
  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
      toast({
        title: 'Copied',
        description: 'Voucher code copied to clipboard',
      });
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Show QR code
  const showQRCode = (voucher: WiFiVoucher) => {
    setSelectedVoucher(voucher);
    setIsQROpen(true);
  };

  const resetForm = () => {
    setFormData({
      planId: plans[0]?.id || '',
      quantity: 1,
      validityDays: plans[0]?.validityDays || 1,
    });
  };

  const getStatusBadge = (status: string) => {
    const option = voucherStatuses.find(o => o.value === status);
    return (
      <Badge variant="secondary" className={cn('text-white', option?.color)}>
        {option?.label || status}
      </Badge>
    );
  };

  const selectedPlan = plans.find(p => p.id === formData.planId);

  // Stats
  const activeVouchers = vouchers.filter(v => v.status === 'active').length;
  const usedVouchers = vouchers.filter(v => v.status === 'used').length;
  const totalVouchers = vouchers.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Ticket className="h-5 w-5" />
            WiFi Vouchers
          </h2>
          <p className="text-sm text-muted-foreground">
            Generate and manage WiFi access vouchers
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchVouchers}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button className="bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white shadow-md hover:shadow-lg transition-all" onClick={() => { resetForm(); setIsCreateOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Generate Vouchers
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Ticket className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalVouchers}</div>
              <div className="text-xs text-muted-foreground">Total Vouchers</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{activeVouchers}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gray-500/10">
              <CheckCircle className="h-4 w-4 text-gray-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{usedVouchers}</div>
              <div className="text-xs text-muted-foreground">Used</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{vouchers.filter(v => v.status === 'expired').length}</div>
              <div className="text-xs text-muted-foreground">Expired</div>
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
                  placeholder="Search by voucher code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Plans" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Plans</SelectItem>
                {plans.map(plan => (
                  <SelectItem key={plan.id} value={plan.id}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {voucherStatuses.map(status => (
                  <SelectItem key={status.value} value={status.value}>
                    {status.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Vouchers Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : vouchers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="rounded-full bg-muted/50 p-4 mb-3">
                <Ticket className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <h3 className="text-sm font-medium text-muted-foreground">No WiFi vouchers found</h3>
              <p className="text-xs text-muted-foreground/60 mt-1">Generate your first voucher to get started</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Voucher Code</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Validity</TableHead>
                    <TableHead>Used</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vouchers.map((voucher) => (
                    <TableRow key={voucher.id} className="transition-colors hover:bg-muted/60">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="bg-gradient-to-r from-slate-100 to-gray-100 dark:from-slate-800 dark:to-gray-800 px-2.5 py-1 rounded-md text-sm font-mono border border-border shadow-sm">
                            {voucher.code}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-md hover:bg-violet-100 hover:text-violet-600 dark:hover:bg-violet-900/30 transition-all"
                            onClick={() => copyToClipboard(voucher.code)}
                          >
                            {copiedCode === voucher.code ? (
                              <CheckCircle className="h-3 w-3 text-emerald-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-medium text-sm">{voucher.plan.name}</p>
                            <Badge variant="outline" className={cn(
                              'text-[10px] px-1.5 py-0',
                              voucher.plan.price === 0 && 'border-emerald-300 text-emerald-700 bg-emerald-50',
                              voucher.plan.price > 0 && voucher.plan.price < 100 && 'border-blue-300 text-blue-700 bg-blue-50',
                              voucher.plan.price >= 100 && 'border-violet-300 text-violet-700 bg-violet-50'
                            )}>
                              {voucher.plan.price === 0 ? 'Complimentary' : voucher.plan.price < 100 ? 'Paid' : 'Premium'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {voucher.plan.downloadSpeed}/{voucher.plan.uploadSpeed} Mbps
                            {voucher.plan.dataLimit && ` - ${voucher.plan.dataLimit}MB`}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm">
                            {format(new Date(voucher.validFrom), 'MMM d')} - {format(new Date(voucher.validUntil), 'MMM d, yyyy')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {voucher.plan.validityDays} day(s)
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {voucher.isUsed ? (
                          <div>
                            <div className="flex items-center gap-1 text-emerald-600">
                              <CheckCircle className="h-3 w-3" />
                              <span className="text-sm">Yes</span>
                            </div>
                            {voucher.usedAt && (
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(voucher.usedAt))} ago
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <XCircle className="h-3 w-3" />
                            <span className="text-sm">No</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(voucher.status)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => showQRCode(voucher)}
                            title="Show QR Code"
                          >
                            <QrCode className="h-4 w-4" />
                          </Button>
                          {voucher.status === 'active' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:text-red-700"
                              onClick={() => handleRevoke(voucher.id)}
                              title="Revoke Voucher"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate WiFi Vouchers</DialogTitle>
            <DialogDescription>
              Create new WiFi access vouchers for guests
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="planId">WiFi Plan</Label>
              <Select
                value={formData.planId}
                onValueChange={(value) => {
                  const plan = plans.find(p => p.id === value);
                  setFormData(prev => ({
                    ...prev,
                    planId: value,
                    validityDays: plan?.validityDays || 1,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map(plan => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - {plan.price > 0 ? formatCurrency(plan.price) : 'Free'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  min="1"
                  max="100"
                  value={formData.quantity}
                  onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validityDays">Validity (Days)</Label>
                <Input
                  id="validityDays"
                  type="number"
                  min="1"
                  value={formData.validityDays}
                  onChange={(e) => setFormData(prev => ({ ...prev, validityDays: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>
            {selectedPlan && (
              <Card className="p-4 bg-muted/50">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Speed:</span>
                    <span>{selectedPlan.downloadSpeed}/{selectedPlan.uploadSpeed} Mbps</span>
                  </div>
                  {selectedPlan.dataLimit && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Data Limit:</span>
                      <span>{selectedPlan.dataLimit} MB</span>
                    </div>
                  )}
                  {selectedPlan.sessionLimit && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Session Limit:</span>
                      <span>{selectedPlan.sessionLimit} min</span>
                    </div>
                  )}
                  <div className="flex justify-between font-medium pt-2 border-t">
                    <span>Total Cost:</span>
                    <span>{formatCurrency(selectedPlan.price * formData.quantity)}</span>
                  </div>
                </div>
              </Card>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate {formData.quantity} Voucher{formData.quantity > 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={isQROpen} onOpenChange={setIsQROpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Voucher QR Code</DialogTitle>
            <DialogDescription>
              Scan this QR code to connect to WiFi
            </DialogDescription>
          </DialogHeader>
          {selectedVoucher && (
            <div className="flex flex-col items-center py-4">
              {/* QR Code Placeholder */}
              <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center mb-4">
                <div className="text-center">
                  <QrCode className="h-16 w-16 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">QR Code</p>
                  <p className="text-xs text-muted-foreground">(Placeholder)</p>
                </div>
              </div>
              <code className="bg-muted px-4 py-2 rounded text-lg font-mono mb-4">
                {selectedVoucher.code}
              </code>
              <div className="w-full space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Plan:</span>
                  <span className="font-medium">{selectedVoucher.plan.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Speed:</span>
                  <span>{selectedVoucher.plan.downloadSpeed}/{selectedVoucher.plan.uploadSpeed} Mbps</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valid Until:</span>
                  <span>{format(new Date(selectedVoucher.validUntil), 'MMM d, yyyy')}</span>
                </div>
              </div>
              <Button
                className="mt-4 w-full"
                variant="outline"
                onClick={() => copyToClipboard(selectedVoucher.code)}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Code
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
