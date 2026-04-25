'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import QRCode from 'qrcode';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  Settings,
  Globe,
  UserCheck,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { usePropertyId } from '@/hooks/use-property';
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
  notes?: string | null;
  issuedTo?: string | null;
  issuedAt?: string | null;
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
  const { propertyId } = usePropertyId();
  const [vouchers, setVouchers] = useState<WiFiVoucher[]>([]);
  const [plans, setPlans] = useState<WiFiPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [planFilter, setPlanFilter] = useState<string>('all');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isQROpen, setIsQROpen] = useState(false);
  const [selectedVoucher, setSelectedVoucher] = useState<WiFiVoucher | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);

  // Issue dialog state
  const [isIssueOpen, setIsIssueOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({ issuedTo: '', notes: '' });
  const [isIssuing, setIsIssuing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    planId: '',
    quantity: 1,
    validityDays: 1,
    notes: '',
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
        toast({ title: 'Error', description: 'Failed to load plans. Please refresh the page.', variant: 'destructive' });
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
  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
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

  // Issue voucher (track giving to someone)
  const handleIssue = async () => {
    if (!selectedVoucher) return;
    if (!issueForm.issuedTo.trim()) {
      toast({ title: 'Validation Error', description: 'Recipient name is required', variant: 'destructive' });
      return;
    }

    setIsIssuing(true);
    try {
      const response = await fetch('/api/wifi/vouchers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedVoucher.id,
          action: 'issue',
          issuedTo: issueForm.issuedTo.trim(),
          notes: issueForm.notes.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Voucher Issued',
          description: `Voucher ${selectedVoucher.code} issued to ${issueForm.issuedTo.trim()}`,
        });
        setIsIssueOpen(false);
        setIssueForm({ issuedTo: '', notes: '' });
        fetchVouchers();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to issue voucher',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error issuing voucher:', error);
      toast({
        title: 'Error',
        description: 'Failed to issue voucher',
        variant: 'destructive',
      });
    } finally {
      setIsIssuing(false);
    }
  };

  // Open issue dialog
  const openIssueDialog = (voucher: WiFiVoucher) => {
    setSelectedVoucher(voucher);
    setIssueForm({ issuedTo: voucher.issuedTo || '', notes: '' });
    setIsIssueOpen(true);
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

  // Captive portal URL for QR codes
  const [portalUrl, setPortalUrl] = useState('');
  const [portalUrlSaving, setPortalUrlSaving] = useState(false);
  const [portalUrlDialogOpen, setPortalUrlDialogOpen] = useState(false);

  // Fetch portal URL from AAA config
  useEffect(() => {
    const fetchPortalUrl = async () => {
      try {
        const res = await fetch('/api/wifi/aaa-config?field=voucherPortalUrl');
        const result = await res.json();
        if (result.success && result.data) {
          setPortalUrl(result.data);
        }
      } catch (e) {
        console.error('Failed to fetch portal URL:', e);
      }
    };
    fetchPortalUrl();
  }, []);

  // Save portal URL
  const savePortalUrl = async (url: string) => {
    setPortalUrlSaving(true);
    try {
      const res = await fetch('/api/wifi/aaa-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voucherPortalUrl: url, propertyId }),
      });
      const result = await res.json();
      if (result.success) {
        setPortalUrl(url);
        toast({ title: 'Saved', description: 'Portal URL updated successfully' });
        setPortalUrlDialogOpen(false);
      } else {
        toast({ title: 'Error', description: typeof result.error === 'string' ? result.error : result.error?.message || 'Failed to save', variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'Error', description: 'Failed to save portal URL', variant: 'destructive' });
    } finally {
      setPortalUrlSaving(false);
    }
  };

  // Generate QR code from voucher
  const generateQR = useCallback(async (voucher: WiFiVoucher) => {
    setQrLoading(true);
    setQrDataUrl(null);
    try {
      let qrPayload: string;
      if (portalUrl) {
        const separator = portalUrl.includes('?') ? '&' : '?';
        qrPayload = `${portalUrl}${separator}code=${encodeURIComponent(voucher.code)}`;
      } else {
        qrPayload = JSON.stringify({
          type: 'wifi-voucher',
          code: voucher.code,
          plan: voucher.plan.name,
          speed: `${voucher.plan.downloadSpeed}/${voucher.plan.uploadSpeed} Mbps`,
          validUntil: voucher.validUntil,
        });
      }
      const url = await QRCode.toDataURL(qrPayload, {
        width: 280,
        margin: 2,
        color: { dark: '#1e1e2e', light: '#ffffff' },
        errorCorrectionLevel: 'M',
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error('QR generation failed:', err);
    } finally {
      setQrLoading(false);
    }
  }, [portalUrl]);

  // Show QR code
  const showQRCode = (voucher: WiFiVoucher) => {
    setSelectedVoucher(voucher);
    setIsQROpen(true);
    generateQR(voucher);
  };

  const resetForm = () => {
    setFormData({
      planId: plans[0]?.id || '',
      quantity: 1,
      validityDays: plans[0]?.validityDays || 1,
      notes: '',
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
  const issuedVouchers = vouchers.filter(v => v.issuedTo).length;
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
          <Button variant="outline" size="sm" onClick={() => setPortalUrlDialogOpen(true)}>
            <Globe className="h-4 w-4 mr-2" />
            Portal URL
          </Button>
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
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <Ticket className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalVouchers}</div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{activeVouchers}</div>
              <div className="text-xs text-muted-foreground">Active</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <UserCheck className="h-4 w-4 text-blue-500 dark:text-blue-400" />
            </div>
            <div>
              <div className="text-2xl font-bold">{issuedVouchers}</div>
              <div className="text-xs text-muted-foreground">Issued</div>
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
              <Clock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
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
                    <TableHead>Issued To</TableHead>
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
                            className="h-7 w-7 rounded-md hover:bg-violet-100 hover:text-violet-600 dark:text-violet-400 dark:hover:bg-violet-900/30 transition-all"
                            onClick={() => copyToClipboard(voucher.code)}
                          >
                            {copiedCode === voucher.code ? (
                              <CheckCircle className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
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
                              voucher.plan.price === 0 && 'border-emerald-300 text-emerald-700 dark:text-emerald-300 bg-emerald-50',
                              voucher.plan.price > 0 && voucher.plan.price < 100 && 'border-blue-300 text-blue-700 dark:text-blue-300 bg-blue-50',
                              voucher.plan.price >= 100 && 'border-violet-300 text-violet-700 dark:text-violet-300 bg-violet-50'
                            )}>
                              {voucher.plan.price === 0 ? 'Free' : voucher.plan.price < 100 ? 'Paid' : 'Premium'}
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
                        {voucher.issuedTo ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="cursor-default">
                                <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                                  <UserCheck className="h-3 w-3" />
                                  <span className="text-sm font-medium">{voucher.issuedTo}</span>
                                </div>
                                {voucher.issuedAt && (
                                  <p className="text-xs text-muted-foreground">
                                    {formatDistanceToNow(new Date(voucher.issuedAt))} ago
                                  </p>
                                )}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[260px]">
                              {voucher.notes && (
                                <div className="space-y-1">
                                  <p className="font-medium text-xs">Notes:</p>
                                  <p className="text-xs whitespace-pre-wrap">{voucher.notes}</p>
                                </div>
                              )}
                            </TooltipContent>
                          </Tooltip>
                        ) : voucher.notes ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 text-muted-foreground cursor-default">
                                <FileText className="h-3 w-3" />
                                <span className="text-sm">See notes</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" className="max-w-[260px]">
                              <p className="text-xs whitespace-pre-wrap">{voucher.notes}</p>
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          <div className="flex items-center gap-1 text-muted-foreground/50">
                            <XCircle className="h-3 w-3" />
                            <span className="text-sm">Not issued</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {voucher.isUsed ? (
                          <div>
                            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
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
                          {voucher.status === 'active' && !voucher.issuedTo && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30"
                              onClick={() => openIssueDialog(voucher)}
                              title="Issue Voucher"
                            >
                              <UserCheck className="h-4 w-4" />
                            </Button>
                          )}
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
                              className="h-8 w-8 text-red-600 dark:text-red-400 hover:text-red-700"
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
            <div className="space-y-2">
              <Label htmlFor="notes">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="notes"
                placeholder="e.g. For front desk walk-in guests, Lobby promo, Room 201 guest..."
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={2}
                className="resize-none"
              />
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

      {/* Issue Voucher Dialog */}
      <Dialog open={isIssueOpen} onOpenChange={setIsIssueOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-500" />
              Issue Voucher
            </DialogTitle>
            <DialogDescription>
              Track when you give this voucher to someone
            </DialogDescription>
          </DialogHeader>
          {selectedVoucher && (
            <div className="space-y-4 py-4">
              <div className="rounded-lg bg-muted/50 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Voucher Code</span>
                  <code className="text-sm font-mono font-medium">{selectedVoucher.code}</code>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Plan</span>
                  <span className="text-sm font-medium">{selectedVoucher.plan.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Valid Until</span>
                  <span className="text-sm">{format(new Date(selectedVoucher.validUntil), 'MMM d, yyyy')}</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="issuedTo">
                  Given to <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="issuedTo"
                  placeholder="e.g. John Smith, Room 201, Front desk guest..."
                  value={issueForm.issuedTo}
                  onChange={(e) => setIssueForm(prev => ({ ...prev, issuedTo: e.target.value }))}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="issueNotes">
                  Note <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="issueNotes"
                  placeholder="e.g. Walk-in guest, Complimentary upgrade, Group booking..."
                  value={issueForm.notes}
                  onChange={(e) => setIssueForm(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                  className="resize-none"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsIssueOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleIssue}
              disabled={isIssuing || !issueForm.issuedTo.trim()}
              className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
            >
              {isIssuing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <UserCheck className="h-4 w-4 mr-2" />
              Issue Voucher
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
              {/* Issued info badge */}
              {selectedVoucher.issuedTo && (
                <div className="w-full mb-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-blue-500" />
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    Issued to <strong>{selectedVoucher.issuedTo}</strong>
                    {selectedVoucher.issuedAt && (
                      <span className="text-blue-500/70 ml-1">
                        ({formatDistanceToNow(new Date(selectedVoucher.issuedAt))} ago)
                      </span>
                    )}
                  </span>
                </div>
              )}
              <div className="w-48 h-48 bg-white rounded-lg flex items-center justify-center mb-4 border border-border shadow-sm">
                {qrLoading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Voucher QR Code"
                    className="w-full h-full object-contain rounded-lg p-1"
                  />
                ) : (
                  <QrCode className="h-12 w-12 text-muted-foreground" />
                )}
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
              <div className="flex gap-2 mt-4 w-full">
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => copyToClipboard(selectedVoucher.code)}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Code
                </Button>
                {qrDataUrl && (
                  <Button
                    className="flex-1 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 text-white"
                    onClick={() => {
                      const link = document.createElement('a');
                      link.download = `voucher-${selectedVoucher.code}.png`;
                      link.href = qrDataUrl;
                      link.click();
                    }}
                  >
                    <QrCode className="h-4 w-4 mr-2" />
                    Download QR
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Portal URL Settings Dialog */}
      <Dialog open={portalUrlDialogOpen} onOpenChange={setPortalUrlDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-teal-500" />
              Captive Portal URL Settings
            </DialogTitle>
            <DialogDescription>
              Configure the base URL that will be encoded in voucher QR codes. When a guest scans the QR, they will be directed to this URL with the voucher code pre-filled.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="portalUrl">Portal Base URL</Label>
              <Input
                id="portalUrl"
                placeholder="https://wifi.hotel.com/connect"
                value={portalUrl}
                onChange={(e) => setPortalUrl(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Example: https://wifi.hotel.com/connect
              </p>
            </div>
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">QR Code Preview</p>
              {portalUrl ? (
                <div className="text-sm font-mono break-all">
                  <span className="text-foreground">{portalUrl}</span>
                  <span className="text-teal-600 dark:text-teal-400">?code=<span className="text-muted-foreground">VOUCHER-CODE</span></span>
                </div>
              ) : (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  No URL set — QR will encode voucher data as JSON (fallback mode)
                </p>
              )}
            </div>
            <div className="rounded-lg border p-3 space-y-1">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <Settings className="h-3 w-3" />
                How It Works
              </p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Admin sets this URL to the hotel&apos;s captive portal address</li>
                <li>QR codes encode: portal-url + ?code=VOUCHER_CODE</li>
                <li>Guest scans QR → browser opens portal with code pre-filled</li>
                <li>Portal sends code to RADIUS for authentication</li>
                <li>FreeRADIUS validates against radcheck → guest is online</li>
              </ol>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPortalUrlDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => savePortalUrl(portalUrl)} disabled={portalUrlSaving}>
              {portalUrlSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save URL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
