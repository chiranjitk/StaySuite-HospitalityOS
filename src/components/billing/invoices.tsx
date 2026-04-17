'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTimezone } from '@/contexts/TimezoneContext';
import { Card, CardContent } from '@/components/ui/card';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  Search,
  Loader2,
  DollarSign,
  Download,
  Eye,
  Printer,
  Mail,
  RefreshCw,
  Send,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  Trash2,
  MoreVertical,
  Ban,
  Copy,
  X,
  CreditCard,
  TrendingUp,
  Receipt,
  FileMinus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// --- Types ---
interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  taxRate: number;
  taxAmount: number;
}

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail?: string | null;
  customerAddress?: string | null;
  customerPhone?: string | null;
  subtotal: number;
  taxes: number;
  discount: number;
  totalAmount: number;
  currency: string;
  issuedAt: string;
  dueAt?: string | null;
  paidAt?: string | null;
  status: string;
  pdfUrl?: string | null;
  notes?: string | null;
  lineItems: LineItem[];
  folioId?: string | null;
  createdAt: string;
}

interface InvoiceStats {
  total: number;
  draft: number;
  issued: number;
  paid: number;
  overdue: number;
  cancelled: number;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  totalTax: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bgColor: string; gradient: string; icon: typeof Clock }> = {
  draft: { label: 'Draft', color: 'text-gray-600 dark:text-gray-300', bgColor: 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700', gradient: '', icon: FileText },
  issued: { label: 'Issued', color: 'text-cyan-700 dark:text-cyan-300', bgColor: 'bg-cyan-50 dark:bg-cyan-900 border-cyan-200 dark:border-cyan-700', gradient: '', icon: Send },
  sent: { label: 'Sent', color: 'text-blue-700 dark:text-blue-300', bgColor: 'bg-blue-50 dark:bg-blue-900 border-blue-200 dark:border-blue-700', gradient: '', icon: Mail },
  paid: { label: 'Paid', color: 'text-emerald-700 dark:text-emerald-300', bgColor: 'bg-emerald-50 dark:bg-emerald-900 border-emerald-200 dark:border-emerald-700', gradient: 'bg-gradient-to-r from-emerald-500 to-green-500 text-white border-0', icon: CheckCircle },
  overdue: { label: 'Overdue', color: 'text-red-700 dark:text-red-300', bgColor: 'bg-red-50 dark:bg-red-900 border-red-200 dark:border-red-700', gradient: 'bg-gradient-to-r from-red-500 to-rose-500 text-white border-0', icon: AlertCircle },
  cancelled: { label: 'Cancelled', color: 'text-gray-500 dark:text-gray-400', bgColor: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700', gradient: '', icon: Ban },
};

const CURRENCIES = [
  { value: 'USD', label: 'USD ($)', symbol: '$' },
  { value: 'EUR', label: 'EUR (\u20AC)', symbol: '\u20AC' },
  { value: 'GBP', label: 'GBP (\u00A3)', symbol: '\u00A3' },
  { value: 'INR', label: 'INR (\u20B9)', symbol: '\u20B9' },
  { value: 'AUD', label: 'AUD (A$)', symbol: 'A$' },
  { value: 'JPY', label: 'JPY (\u00A5)', symbol: '\u00A5' },
];

let itemIdCounter = 0;
function newBlankLineItem(): LineItem {
  return {
    id: `new-${++itemIdCounter}`,
    description: '',
    quantity: 1,
    unitPrice: 0,
    totalAmount: 0,
    taxRate: 0,
    taxAmount: 0,
  };
}

export default function Invoices() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const { formatDate, formatDateTime } = useTimezone();

  // Data state
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [stats, setStats] = useState<InvoiceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Create form
  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
    customerAddress: '',
    customerPhone: '',
    currency: 'USD',
    dueDate: '',
    notes: '',
    status: 'draft',
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([newBlankLineItem()]);

  // --- Fetch ---
  const fetchInvoices = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
      if (searchQuery) params.set('search', searchQuery);
      params.set('limit', '100');

      const response = await fetch(`/api/invoices?${params}`);
      const result = await response.json();
      if (result.success) {
        setInvoices(result.data || []);
        setStats(result.stats || null);
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast({ title: 'Error', description: 'Failed to fetch invoices', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchQuery, toast]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2 || searchQuery.length === 0) {
        setIsLoading(true);
        fetchInvoices();
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery, fetchInvoices]);

  // --- Line Items Helpers ---
  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (['quantity', 'unitPrice', 'taxRate'].includes(field)) {
        const qty = Number(updated.quantity) || 0;
        const price = Number(updated.unitPrice) || 0;
        const rate = Number(updated.taxRate) || 0;
        updated.totalAmount = qty * price;
        updated.taxAmount = qty * price * (rate / 100);
      }
      return updated;
    }));
  };

  const addLineItem = () => setLineItems(prev => [...prev, newBlankLineItem()]);
  const removeLineItem = (id: string) => setLineItems(prev => prev.length > 1 ? prev.filter(i => i.id !== id) : prev);

  const calcSubtotal = () => lineItems.reduce((s, i) => s + (Number(i.totalAmount) || 0), 0);
  const calcTaxes = () => lineItems.reduce((s, i) => s + (Number(i.taxAmount) || 0), 0);

  // --- Create Invoice ---
  const handleCreate = async () => {
    const validItems = lineItems.filter(i => i.description.trim() && i.totalAmount > 0);
    if (!formData.customerName.trim()) {
      toast({ title: 'Required', description: 'Customer name is required', variant: 'destructive' });
      return;
    }
    if (validItems.length === 0) {
      toast({ title: 'Required', description: 'Add at least one line item with a description and amount', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const subtotal = calcSubtotal();
      const taxes = calcTaxes();
      const totalAmount = subtotal + taxes;

      const response = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          dueAt: formData.dueDate || undefined,
          subtotal,
          taxes,
          totalAmount,
          lineItems: validItems.map(i => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            totalAmount: i.totalAmount,
            taxRate: i.taxRate,
            taxAmount: i.taxAmount,
          })),
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast({ title: 'Invoice Created', description: `${result.data.invoiceNumber} has been created` });
        setIsCreateOpen(false);
        resetForm();
        fetchInvoices();
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Failed to create invoice', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast({ title: 'Error', description: 'Failed to create invoice', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({ customerName: '', customerEmail: '', customerAddress: '', customerPhone: '', currency: 'USD', dueDate: '', notes: '', status: 'draft' });
    setLineItems([newBlankLineItem()]);
  };

  // --- Actions ---
  const downloadPDF = async (invoice: InvoiceData) => {
    setActionLoading(`pdf-${invoice.id}`);
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/pdf`);
      if (!response.ok) throw new Error('PDF generation failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoice.invoiceNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: 'Downloaded', description: `Invoice ${invoice.invoiceNumber} PDF downloaded` });
    } catch (error) {
      console.error('PDF error:', error);
      toast({ title: 'Error', description: 'Failed to generate PDF', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const sendInvoiceEmail = async (invoice: InvoiceData) => {
    if (!invoice.customerEmail) {
      toast({ title: 'No Email', description: 'This invoice has no customer email address', variant: 'destructive' });
      return;
    }
    setActionLoading(`email-${invoice.id}`);
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/send`, { method: 'POST' });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Email Sent', description: `Invoice sent to ${invoice.customerEmail}` });
        fetchInvoices();
      } else {
        toast({ title: 'Email Failed', description: result.error?.message || 'Failed to send', variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to send email', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const printInvoice = async (invoice: InvoiceData) => {
    setActionLoading(`print-${invoice.id}`);
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/pdf`);
      if (!response.ok) throw new Error('PDF generation failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, '_blank');
      if (printWindow) {
        printWindow.addEventListener('load', () => {
          printWindow.print();
        });
      }
      toast({ title: 'Printing', description: `Invoice ${invoice.invoiceNumber} sent to printer` });
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to print', variant: 'destructive' });
    } finally {
      setActionLoading(null);
    }
  };

  const markAsPaid = async (invoice: InvoiceData) => {
    setActionLoading(`status-${invoice.id}`);
    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid' }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Updated', description: `${invoice.invoiceNumber} marked as paid` });
        fetchInvoices();
        if (selectedInvoice?.id === invoice.id) setSelectedInvoice({ ...invoice, ...result.data });
      }
    } catch { /* silent */ }
    finally { setActionLoading(null); }
  };

  const markAsSent = async (invoice: InvoiceData) => {
    setActionLoading(`status-${invoice.id}`);
    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'sent' }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Updated', description: `${invoice.invoiceNumber} marked as sent` });
        fetchInvoices();
      }
    } catch { /* silent */ }
    finally { setActionLoading(null); }
  };

  const cancelInvoice = async (invoice: InvoiceData) => {
    setActionLoading(`status-${invoice.id}`);
    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled' }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Cancelled', description: `${invoice.invoiceNumber} has been cancelled` });
        fetchInvoices();
        setIsDetailOpen(false);
      }
    } catch { /* silent */ }
    finally { setActionLoading(null); }
  };

  const deleteInvoice = async (invoice: InvoiceData) => {
    setActionLoading(`delete-${invoice.id}`);
    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, { method: 'DELETE' });
      const result = await response.json();
      if (result.success) {
        toast({ title: 'Deleted', description: `Invoice ${invoice.invoiceNumber} deleted` });
        fetchInvoices();
        setIsDetailOpen(false);
      } else {
        toast({ title: 'Error', description: result.error?.message || 'Cannot delete', variant: 'destructive' });
      }
    } catch { toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' }); }
    finally { setActionLoading(null); }
  };

  const viewInvoice = (invoice: InvoiceData) => {
    setSelectedInvoice(invoice);
    setIsDetailOpen(true);
  };

  // --- Status Badge ---
  const StatusBadge = ({ status }: { status: string }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
    const Icon = cfg.icon;
    return (
      <Badge variant="outline" className={cn('gap-1 font-medium border shadow-sm', cfg.gradient || cfg.bgColor, cfg.gradient ? cfg.color : cfg.color)}>
        <Icon className="h-3 w-3" />
        {cfg.label}
      </Badge>
    );
  };

  // --- Render ---
  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Receipt className="h-5 w-5 text-emerald-600" />
            Invoices
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Create, manage, and send invoices
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setIsLoading(true); fetchInvoices(); }} className="min-w-[44px]">
            <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
            <span className="hidden sm:inline ml-2">Refresh</span>
          </Button>
          <Button onClick={() => { resetForm(); setIsCreateOpen(true); }} className="bg-gradient-to-r from-emerald-600 to-emerald-500 hover:shadow-lg hover:shadow-emerald-500/20 transition-all duration-300">
            <Plus className="h-4 w-4 mr-1.5" />
            <span className="hidden xs:inline">New Invoice</span>
            <span className="xs:hidden">New</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
                <FileText className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <div className="text-lg sm:text-2xl font-bold truncate">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total</div>
              </div>
            </div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10 shrink-0">
                <Send className="h-4 w-4 text-cyan-600" />
              </div>
              <div className="min-w-0">
                <div className="text-lg sm:text-2xl font-bold truncate">{stats.issued + stats.draft}</div>
                <div className="text-xs text-muted-foreground">Open</div>
              </div>
            </div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 shrink-0">
                <DollarSign className="h-4 w-4 text-amber-600" />
              </div>
              <div className="min-w-0">
                <div className="text-lg sm:text-2xl font-bold truncate">{formatCurrency(stats.outstandingAmount)}</div>
                <div className="text-xs text-muted-foreground">Outstanding</div>
              </div>
            </div>
          </Card>
          <Card className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 shrink-0">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <div className="text-lg sm:text-2xl font-bold truncate bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">{formatCurrency(stats.paidAmount)}</div>
                <div className="text-xs text-muted-foreground">Collected</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search invoices..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setIsLoading(true); }}>
              <SelectTrigger className="w-full sm:w-40 h-10">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Invoice List */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground px-4">
              <FileText className="h-12 w-12 mb-3 opacity-30" />
              <p className="font-medium">No invoices found</p>
              <p className="text-sm mt-1">Create your first invoice to get started</p>
              <Button className="mt-4" onClick={() => { resetForm(); setIsCreateOpen(true); }}>
                <Plus className="h-4 w-4 mr-1.5" />Create Invoice
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <ScrollArea className="max-h-[500px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[180px]">Invoice</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead className="w-[110px]">Issued</TableHead>
                        <TableHead className="text-right w-[130px]">Amount</TableHead>
                        <TableHead className="w-[100px]">Status</TableHead>
                        <TableHead className="text-right w-[140px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/50 transition-colors duration-150" onClick={() => viewInvoice(invoice)}>
                          <TableCell>
                            <p className="font-mono font-medium text-sm">{invoice.invoiceNumber}</p>
                            <p className="text-xs text-muted-foreground">{invoice.lineItems?.length || 0} items</p>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{invoice.customerName}</p>
                            <p className="text-xs text-muted-foreground truncate max-w-[180px]">{invoice.customerEmail || '\u2014'}</p>
                          </TableCell>
                          <TableCell className="text-sm">{formatDate(invoice.issuedAt || invoice.createdAt)}</TableCell>
                          <TableCell className="text-right">
                            <p className="font-semibold text-sm">{formatCurrency(invoice.totalAmount)}</p>
                            {(invoice.taxes || 0) > 0 && (
                              <p className="text-xs text-muted-foreground">+{formatCurrency(invoice.taxes)} tax</p>
                            )}
                          </TableCell>
                          <TableCell><StatusBadge status={invoice.status} /></TableCell>
                          <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => viewInvoice(invoice)}>
                                  <Eye className="h-4 w-4 mr-2" />View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => downloadPDF(invoice)} disabled={!!actionLoading?.startsWith(`pdf-`)}>
                                  <Download className="h-4 w-4 mr-2" />Download PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => sendInvoiceEmail(invoice)} disabled={!invoice.customerEmail || !!actionLoading?.startsWith(`email-`)}>
                                  <Mail className="h-4 w-4 mr-2" />Send via Email
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => printInvoice(invoice)} disabled={!!actionLoading?.startsWith(`print-`)}>
                                  <Printer className="h-4 w-4 mr-2" />Print
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {!['paid', 'cancelled'].includes(invoice.status) && (
                                  <>
                                    <DropdownMenuItem onClick={() => markAsSent(invoice)}>
                                      <Send className="h-4 w-4 mr-2" />Mark as Sent
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => markAsPaid(invoice)}>
                                      <CreditCard className="h-4 w-4 mr-2" />Mark as Paid
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                {!['paid', 'cancelled'].includes(invoice.status) && (
                                  <DropdownMenuItem onClick={() => cancelInvoice(invoice)} className="text-red-600">
                                    <Ban className="h-4 w-4 mr-2" />Cancel Invoice
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => deleteInvoice(invoice)} className="text-red-600">
                                  <Trash2 className="h-4 w-4 mr-2" />Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden">
                <ScrollArea className="max-h-[calc(100vh-380px)]">
                  <div className="divide-y divide-border">
                    {invoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className="p-4 active:bg-muted/50 cursor-pointer"
                        onClick={() => viewInvoice(invoice)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono font-semibold text-sm">{invoice.invoiceNumber}</span>
                              <StatusBadge status={invoice.status} />
                            </div>
                            <p className="font-medium text-sm truncate">{invoice.customerName}</p>
                            {invoice.customerEmail && (
                              <p className="text-xs text-muted-foreground truncate">{invoice.customerEmail}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-base">{formatCurrency(invoice.totalAmount)}</p>
                            <p className="text-xs text-muted-foreground">{formatDate(invoice.issuedAt || invoice.createdAt)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="sm" className="flex-1 h-9 text-xs" onClick={() => downloadPDF(invoice)} disabled={!!actionLoading?.startsWith(`pdf-`)}>
                            {actionLoading === `pdf-${invoice.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Download className="h-3 w-3 mr-1" />}
                            PDF
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1 h-9 text-xs" onClick={() => sendInvoiceEmail(invoice)} disabled={!invoice.customerEmail || !!actionLoading?.startsWith(`email-`)}>
                            {actionLoading === `email-${invoice.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Mail className="h-3 w-3 mr-1" />}
                            Email
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1 h-9 text-xs" onClick={() => printInvoice(invoice)} disabled={!!actionLoading?.startsWith(`print-`)}>
                            {actionLoading === `print-${invoice.id}` ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Printer className="h-3 w-3 mr-1" />}
                            Print
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                                <MoreVertical className="h-3.5 w-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!['paid', 'cancelled'].includes(invoice.status) && (
                                <>
                                  <DropdownMenuItem onClick={() => markAsSent(invoice)}><Send className="h-4 w-4 mr-2" />Mark Sent</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => markAsPaid(invoice)}><CreditCard className="h-4 w-4 mr-2" />Mark Paid</DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem onClick={() => deleteInvoice(invoice)} className="text-red-600">
                                <Trash2 className="h-4 w-4 mr-2" />Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ============ CREATE INVOICE DIALOG ============ */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { if (!open) resetForm(); setIsCreateOpen(open); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">Create Invoice</DialogTitle>
            <DialogDescription>Fill in the details below to create a new invoice</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            {/* Customer Info */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Customer Details</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="customerName">Name *</Label>
                  <Input id="customerName" placeholder="Customer name" value={formData.customerName} onChange={(e) => setFormData(p => ({ ...p, customerName: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="customerEmail">Email</Label>
                  <Input id="customerEmail" type="email" placeholder="customer@email.com" value={formData.customerEmail} onChange={(e) => setFormData(p => ({ ...p, customerEmail: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="customerPhone">Phone</Label>
                  <Input id="customerPhone" placeholder="+1 (555) 000-0000" value={formData.customerPhone} onChange={(e) => setFormData(p => ({ ...p, customerPhone: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="customerAddress">Address</Label>
                  <Input id="customerAddress" placeholder="Street, City, Country" value={formData.customerAddress} onChange={(e) => setFormData(p => ({ ...p, customerAddress: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Line Items</h4>
                <Button variant="ghost" size="sm" onClick={addLineItem} className="h-8 text-xs">
                  <Plus className="h-3 w-3 mr-1" />Add Item
                </Button>
              </div>
              <div className="space-y-2">
                {lineItems.map((item, idx) => (
                  <Card key={item.id} className="p-3">
                    <div className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-12 sm:col-span-5">
                        <Label className="text-xs text-muted-foreground">Description</Label>
                        <Input
                          placeholder="Item description"
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                          className="h-9 text-sm mt-0.5"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Label className="text-xs text-muted-foreground">Qty</Label>
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, 'quantity', Number(e.target.value))}
                          className="h-9 text-sm mt-0.5"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <Label className="text-xs text-muted-foreground">Price</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice || ''}
                          onChange={(e) => updateLineItem(item.id, 'unitPrice', Number(e.target.value))}
                          className="h-9 text-sm mt-0.5"
                        />
                      </div>
                      <div className="col-span-3 sm:col-span-2">
                        <Label className="text-xs text-muted-foreground">Tax %</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={item.taxRate || ''}
                          onChange={(e) => updateLineItem(item.id, 'taxRate', Number(e.target.value))}
                          className="h-9 text-sm mt-0.5"
                        />
                      </div>
                      <div className="col-span-1 flex items-end justify-center">
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-red-500" onClick={() => removeLineItem(item.id)} disabled={lineItems.length === 1}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {item.totalAmount > 0 && (
                      <div className="flex justify-end mt-1.5">
                        <span className="text-xs text-muted-foreground">
                          = {item.quantity} x {formatCurrency(item.unitPrice)}
                          {item.taxAmount > 0 && <> + {formatCurrency(item.taxAmount)} tax</>}
                          {` = ${formatCurrency(item.totalAmount + item.taxAmount)}`}
                        </span>
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </div>

            {/* Totals */}
            <Card className="p-4 bg-muted/30">
              <div className="max-w-[220px] ml-auto space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(calcSubtotal())}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax</span>
                  <span>{formatCurrency(calcTaxes())}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span className="text-emerald-700">{formatCurrency(calcSubtotal() + calcTaxes())}</span>
                </div>
              </div>
            </Card>

            {/* Invoice Settings */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Invoice Settings</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={formData.currency} onValueChange={(v) => setFormData(p => ({ ...p, currency: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(c => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dueDate">Due Date</Label>
                  <Input id="dueDate" type="date" value={formData.dueDate} onChange={(e) => setFormData(p => ({ ...p, dueDate: e.target.value }))} className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="status">Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData(p => ({ ...p, status: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="issued">Issued</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" placeholder="Additional notes or payment instructions..." value={formData.notes} onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))} rows={2} className="text-sm" />
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
            <Button variant="outline" onClick={() => { resetForm(); setIsCreateOpen(false); }} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={handleCreate} disabled={isSaving} className="w-full sm:w-auto">
              {isSaving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : <><FileText className="h-4 w-4 mr-2" />Create Invoice</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ INVOICE DETAIL DIALOG ============ */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-600" />
              {selectedInvoice?.invoiceNumber}
            </DialogTitle>
          </DialogHeader>

          {selectedInvoice && (
            <div className="space-y-5">
              {/* Top Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Bill To */}
                <Card className="p-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Bill To</h4>
                  <p className="font-semibold">{selectedInvoice.customerName}</p>
                  {selectedInvoice.customerEmail && <p className="text-sm text-muted-foreground">{selectedInvoice.customerEmail}</p>}
                  {selectedInvoice.customerPhone && <p className="text-sm text-muted-foreground">{selectedInvoice.customerPhone}</p>}
                  {selectedInvoice.customerAddress && <p className="text-sm text-muted-foreground whitespace-pre-line">{selectedInvoice.customerAddress}</p>}
                </Card>
                {/* Invoice Info */}
                <Card className="p-4">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Invoice Details</h4>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Invoice #</span>
                      <span className="font-mono font-medium">{selectedInvoice.invoiceNumber}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Issued</span>
                      <span>{formatDate(selectedInvoice.issuedAt || selectedInvoice.createdAt)}</span>
                    </div>
                    {selectedInvoice.dueAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Due</span>
                        <span className={new Date(selectedInvoice.dueAt) < new Date() && selectedInvoice.status !== 'paid' ? 'text-red-600 font-medium' : ''}>
                          {formatDate(selectedInvoice.dueAt)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Status</span>
                      <StatusBadge status={selectedInvoice.status} />
                    </div>
                  </div>
                </Card>
              </div>

              {/* Line Items */}
              <Card className="overflow-hidden">
                <div className="px-4 py-3 bg-muted/30 border-b">
                  <h4 className="text-sm font-semibold">Line Items</h4>
                </div>
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-center w-[60px]">Qty</TableHead>
                        <TableHead className="text-right w-[100px]">Unit Price</TableHead>
                        <TableHead className="text-right w-[80px]">Tax</TableHead>
                        <TableHead className="text-right w-[100px]">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selectedInvoice.lineItems || []).map((item, idx) => (
                        <TableRow key={item.id || idx}>
                          <TableCell className="font-medium text-sm">{item.description}</TableCell>
                          <TableCell className="text-center text-sm">{item.quantity}</TableCell>
                          <TableCell className="text-right text-sm">{formatCurrency(item.unitPrice)}</TableCell>
                          <TableCell className="text-right text-sm">{item.taxAmount > 0 ? formatCurrency(item.taxAmount) : '\u2014'}</TableCell>
                          <TableCell className="text-right font-medium text-sm">{formatCurrency(item.totalAmount + item.taxAmount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {/* Mobile line items */}
                <div className="sm:hidden divide-y divide-border">
                  {(selectedInvoice.lineItems || []).map((item, idx) => (
                    <div key={item.id || idx} className="px-4 py-3">
                      <p className="font-medium text-sm">{item.description}</p>
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>{item.quantity} x {formatCurrency(item.unitPrice)}</span>
                        <span className="font-medium text-foreground">{formatCurrency(item.totalAmount + item.taxAmount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Totals */}
              <Card className="p-4">
                <div className="max-w-[260px] ml-auto space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(selectedInvoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax</span>
                    <span>{formatCurrency(selectedInvoice.taxes || 0)}</span>
                  </div>
                  {selectedInvoice.discount > 0 && (
                    <div className="flex justify-between text-sm text-red-600">
                      <span>Discount</span>
                      <span>-{formatCurrency(selectedInvoice.discount)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total</span>
                    <span className="text-emerald-700">{formatCurrency(selectedInvoice.totalAmount)}</span>
                  </div>
                  {selectedInvoice.status === 'paid' && selectedInvoice.paidAt && (
                    <p className="text-xs text-emerald-600 text-right flex items-center justify-end gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Paid on {formatDate(selectedInvoice.paidAt)}
                    </p>
                  )}
                </div>
              </Card>

              {/* Notes */}
              {selectedInvoice.notes && (
                <Card className="p-4 bg-muted/20">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Notes</h4>
                  <p className="text-sm whitespace-pre-line">{selectedInvoice.notes}</p>
                </Card>
              )}

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => selectedInvoice && downloadPDF(selectedInvoice)} disabled={!!actionLoading?.startsWith(`pdf-`)}>
                  {actionLoading === `pdf-${selectedInvoice.id}` ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                  Download PDF
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => selectedInvoice && sendInvoiceEmail(selectedInvoice)} disabled={!selectedInvoice.customerEmail || !!actionLoading?.startsWith(`email-`)}>
                  {actionLoading === `email-${selectedInvoice.id}` ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                  Send Email
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => selectedInvoice && printInvoice(selectedInvoice)} disabled={!!actionLoading?.startsWith(`print-`)}>
                  {actionLoading === `print-${selectedInvoice.id}` ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Printer className="h-4 w-4 mr-2" />}
                  Print
                </Button>
                {!['paid', 'cancelled'].includes(selectedInvoice.status) && (
                  <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => selectedInvoice && markAsPaid(selectedInvoice)} disabled={!!actionLoading?.startsWith(`status-`)}>
                    {actionLoading === `status-${selectedInvoice.id}` ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CreditCard className="h-4 w-4 mr-2" />}
                    Mark as Paid
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
