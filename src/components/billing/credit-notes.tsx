'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  FileText,
  Plus,
  Loader2,
  RefreshCw,
  Download,
  CheckCircle2,
  XCircle,
  DollarSign,
  AlertCircle,
  Trash2,
  Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface Folio {
  id: string;
  folioNumber: string;
  totalAmount: number;
  balance: number;
  currency: string;
  booking: {
    id: string;
    confirmationCode: string;
    primaryGuest: { id: string; firstName: string; lastName: string };
  };
}

interface CreditNoteItem {
  description: string;
  amount: number;
  folioLineItemId?: string;
}

interface CreditNote {
  id: string;
  creditNoteNumber: string;
  reason: string;
  description: string | null;
  items: CreditNoteItem[];
  subtotal: number;
  totalAmount: number;
  currency: string;
  status: string;
  appliedAmount: number;
  remainingAmount: number;
  issuedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

const REASONS = [
  { value: 'refund', label: 'Refund', color: 'bg-blue-500' },
  { value: 'discount', label: 'Discount', color: 'bg-emerald-500' },
  { value: 'correction', label: 'Correction', color: 'bg-amber-500' },
  { value: 'service_recovery', label: 'Service Recovery', color: 'bg-purple-500' },
];

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  issued: { label: 'Issued', variant: 'default', className: 'bg-blue-500 text-white' },
  applied: { label: 'Applied', variant: 'default', className: 'bg-emerald-500 text-white' },
  partially_applied: { label: 'Partially Applied', variant: 'default', className: 'bg-amber-500 text-white' },
  cancelled: { label: 'Cancelled', variant: 'destructive', className: 'bg-red-500 text-white' },
  expired: { label: 'Expired', variant: 'secondary', className: 'bg-gray-500 text-white' },
};

export default function CreditNotes() {
  const { toast } = useToast();

  const [folios, setFolios] = useState<Folio[]>([]);
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [selectedFolioId, setSelectedFolioId] = useState('');
  const [cancelTarget, setCancelTarget] = useState<CreditNote | null>(null);

  // Create form
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<CreditNoteItem[]>([{ description: '', amount: 0 }]);

  const fetchFolios = useCallback(async () => {
    try {
      const res = await fetch('/api/folios?limit=200');
      const json = await res.json();
      if (json.success) setFolios(json.data);
    } catch { /* ignore */ }
  }, []);

  const fetchCreditNotes = useCallback(async () => {
    if (!selectedFolioId) { setCreditNotes([]); return; }
    setIsLoading(true);
    try {
      const res = await fetch(`/api/folio/credit-notes?folioId=${selectedFolioId}`);
      const json = await res.json();
      if (json.success) setCreditNotes(json.data);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [selectedFolioId]);

  useEffect(() => { fetchFolios(); }, [fetchFolios]);
  useEffect(() => { fetchCreditNotes(); }, [fetchCreditNotes]);

  const addItem = () => setItems(prev => [...prev, { description: '', amount: 0 }]);
  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(prev => prev.filter((_, i) => i !== idx));
  };
  const updateItem = (idx: number, field: keyof CreditNoteItem, value: string | number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const totalAmount = items.reduce((sum, item) => sum + (parseFloat(String(item.amount)) || 0), 0);

  const handleCreate = async () => {
    if (!selectedFolioId || !reason || items.length === 0) {
      toast({ title: 'Error', description: 'Fill all required fields', variant: 'destructive' });
      return;
    }

    const validItems = items.filter(i => i.description && parseFloat(String(i.amount)) > 0);
    if (validItems.length === 0) {
      toast({ title: 'Error', description: 'Add at least one item with description and amount', variant: 'destructive' });
      return;
    }

    const folio = folios.find(f => f.id === selectedFolioId);
    if (!folio) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/folio/credit-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folioId: selectedFolioId,
          guestId: folio.booking?.primaryGuest?.id,
          bookingId: folio.booking?.id,
          reason,
          description: description || undefined,
          items: validItems.map(i => ({ description: i.description, amount: parseFloat(String(i.amount)) })),
          currency: folio.currency,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Success', description: `Credit note ${json.data.creditNoteNumber} created` });
        setShowCreateDialog(false);
        resetForm();
        fetchCreditNotes();
        fetchFolios();
      } else {
        toast({ title: 'Error', description: json.error?.message || 'Failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create credit note', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleApply = async (noteId: string) => {
    try {
      const res = await fetch(`/api/folio/credit-notes/${noteId}/apply`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Success', description: 'Credit note applied to folio' });
        fetchCreditNotes();
        fetchFolios();
      } else {
        toast({ title: 'Error', description: json.error?.message || 'Failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to apply credit note', variant: 'destructive' });
    }
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/folio/credit-notes/${cancelTarget.id}/cancel`, { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Success', description: 'Credit note cancelled' });
        setShowCancelDialog(false);
        setCancelTarget(null);
        fetchCreditNotes();
        fetchFolios();
      } else {
        toast({ title: 'Error', description: json.error?.message || 'Failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to cancel credit note', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPDF = async (noteId: string) => {
    try {
      const res = await fetch(`/api/folio/credit-notes/${noteId}/pdf`);
      const html = await res.text();
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
        win.print();
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to generate PDF', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setReason('');
    setDescription('');
    setItems([{ description: '', amount: 0 }]);
  };

  // Summary stats
  const totalIssued = creditNotes.filter(n => n.status !== 'cancelled').reduce((s, n) => s + n.totalAmount, 0);
  const totalApplied = creditNotes.reduce((s, n) => s + n.appliedAmount, 0);
  const totalRemaining = creditNotes.filter(n => n.status !== 'cancelled' && n.status !== 'expired').reduce((s, n) => s + n.remainingAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Credit Notes
          </h2>
          <p className="text-sm text-muted-foreground">Issue and manage billing adjustments</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchFolios(); fetchCreditNotes(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => { setShowCreateDialog(true); resetForm(); }} disabled={!selectedFolioId}>
            <Plus className="h-4 w-4 mr-2" />
            New Credit Note
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4 hover:shadow-lg transition-all hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <FileText className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">
                ${totalIssued.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">Total Issued</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg transition-all hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-400 bg-clip-text text-transparent">
                ${totalApplied.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">Applied</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg transition-all hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <DollarSign className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-red-400 bg-clip-text text-transparent">
                ${totalRemaining.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">Remaining</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg transition-all hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <FileText className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-violet-400 bg-clip-text text-transparent">
                {creditNotes.length}
              </div>
              <div className="text-xs text-muted-foreground">Notes</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Folio Selector */}
      <Card>
        <CardContent className="p-4">
          <Label className="text-sm font-medium">Select Folio</Label>
          <Select value={selectedFolioId} onValueChange={setSelectedFolioId}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Choose a folio" />
            </SelectTrigger>
            <SelectContent>
              {folios.map(f => (
                <SelectItem key={f.id} value={f.id}>
                  {f.folioNumber} - {f.booking?.primaryGuest?.firstName} {f.booking?.primaryGuest?.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Credit Notes Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : !selectedFolioId ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>Select a folio to view credit notes</p>
            </div>
          ) : creditNotes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No credit notes for this folio</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Note #</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Applied</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <AnimatePresence>
                    {creditNotes.map((note) => {
                      const statusCfg = STATUS_CONFIG[note.status] || STATUS_CONFIG.issued;
                      return (
                        <motion.tr
                          key={note.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="hover:bg-muted/50 border-b"
                        >
                          <TableCell>
                            <p className="font-mono text-sm font-medium">{note.creditNoteNumber}</p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize text-xs">
                              {note.reason.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">${note.totalAmount.toFixed(2)}</TableCell>
                          <TableCell className="text-right">
                            <span className={note.appliedAmount > 0 ? 'text-emerald-600' : 'text-muted-foreground'}>
                              ${note.appliedAmount.toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("text-white text-xs", statusCfg.className)}>
                              {statusCfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(note.createdAt), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              {note.status === 'issued' && (
                                <Button size="sm" variant="outline" onClick={() => handleApply(note.id)} className="text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Apply
                                </Button>
                              )}
                              {(note.status === 'issued' || note.status === 'applied') && (
                                <Button size="sm" variant="ghost" onClick={() => handleDownloadPDF(note.id)} className="text-xs">
                                  <Download className="h-3 w-3 mr-1" />
                                  PDF
                                </Button>
                              )}
                              {note.status !== 'cancelled' && (
                                <Button size="sm" variant="ghost" className="text-xs text-red-600" onClick={() => { setCancelTarget(note); setShowCancelDialog(true); }}>
                                  <XCircle className="h-3 w-3 mr-1" />
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create Credit Note Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={(open) => { if (!open) resetForm(); setShowCreateDialog(open); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Credit Note</DialogTitle>
            <DialogDescription>Issue a credit note for billing adjustments</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Reason *</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reason" />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Input
                placeholder="Additional details..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>

            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Items *</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addItem}>
                  <Plus className="h-3 w-3 mr-1" />
                  Add Item
                </Button>
              </div>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-2 items-center"
                  >
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateItem(idx, 'description', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="0.00"
                      min="0.01"
                      step="0.01"
                      value={item.amount || ''}
                      onChange={(e) => updateItem(idx, 'amount', e.target.value)}
                      className="w-28"
                    />
                    {items.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)} className="shrink-0 text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </motion.div>
                ))}
              </div>
              <div className="mt-2 text-right text-sm font-bold">
                Total: ${totalAmount.toFixed(2)}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowCreateDialog(false); }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isSaving || !reason || totalAmount <= 0}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Issue Credit Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancel Credit Note</DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel credit note <span className="font-bold">{cancelTarget?.creditNoteNumber}</span>?
              {cancelTarget && cancelTarget.appliedAmount > 0 && (
                <span className="block mt-2 text-red-600 font-medium">
                  This will reverse the applied credit of ${cancelTarget.appliedAmount.toFixed(2)} on the folio.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCancelDialog(false); setCancelTarget(null); }}>Keep</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cancel Credit Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
