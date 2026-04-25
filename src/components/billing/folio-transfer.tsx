'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
  ArrowRightLeft,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Send,
  History,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface Folio {
  id: string;
  folioNumber: string;
  subtotal: number;
  taxes: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  currency: string;
  status: string;
  booking: {
    id: string;
    confirmationCode: string;
    primaryGuest: { id: string; firstName: string; lastName: string };
  };
}

interface LineItem {
  id: string;
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  taxAmount: number;
}

interface TransferRecord {
  id: string;
  fromFolioId: string;
  toFolioId: string;
  folioLineItemId: string | null;
  amount: number;
  currency: string;
  reason: string;
  description: string | null;
  status: string;
  createdAt: string;
  fromFolio: {
    folioNumber: string;
    booking: { confirmationCode: string; primaryGuest: { firstName: string; lastName: string } };
  };
  toFolio: {
    folioNumber: string;
    booking: { confirmationCode: string; primaryGuest: { firstName: string; lastName: string } };
  };
  transferredByUser?: { firstName: string; lastName: string };
}

const REASONS = [
  { value: 'split_bill', label: 'Split Bill', color: 'bg-blue-500' },
  { value: 'room_move', label: 'Room Move', color: 'bg-purple-500' },
  { value: 'correction', label: 'Correction', color: 'bg-amber-500' },
  { value: 'group_transfer', label: 'Group Transfer', color: 'bg-teal-500' },
];

export default function FolioTransfer() {
  const { toast } = useToast();

  const [folios, setFolios] = useState<Folio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTransferring, setIsTransferring] = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);

  const [sourceFolioId, setSourceFolioId] = useState('');
  const [targetFolioId, setTargetFolioId] = useState('');
  const [transferMode, setTransferMode] = useState<'items' | 'amount'>('items');
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [transferAmount, setTransferAmount] = useState('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');

  const [sourceLineItems, setSourceLineItems] = useState<LineItem[]>([]);
  const [previewBeforeFrom, setPreviewBeforeFrom] = useState(0);
  const [previewBeforeTo, setPreviewBeforeTo] = useState(0);
  const [transferHistory, setTransferHistory] = useState<TransferRecord[]>([]);
  const [historyFolioId, setHistoryFolioId] = useState('');
  const [searchTarget, setSearchTarget] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);

  const fetchFolios = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/folios?limit=200');
      const json = await res.json();
      if (json.success) setFolios(json.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch folios', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchFolios(); }, [fetchFolios]);

  useEffect(() => {
    if (!sourceFolioId) return;
    const fetchItems = async () => {
      try {
        const res = await fetch(`/api/folios/${sourceFolioId}/line-items`);
        const json = await res.json();
        if (json.success) {
          setSourceLineItems(json.data.filter((i: LineItem) => i.totalAmount > 0));
          const folio = folios.find(f => f.id === sourceFolioId);
          if (folio) setPreviewBeforeFrom(folio.totalAmount);
        }
      } catch { /* ignore */ }
    };
    fetchItems();
  }, [sourceFolioId, folios]);

  useEffect(() => {
    const targetFolio = folios.find(f => f.id === targetFolioId);
    if (targetFolio) setPreviewBeforeTo(targetFolio.totalAmount);
  }, [targetFolioId, folios]);

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const getSelectedTotal = () => {
    return sourceLineItems
      .filter(i => selectedItems.includes(i.id))
      .reduce((sum, i) => sum + i.totalAmount + i.taxAmount, 0);
  };

  const getActualTransferAmount = () => {
    if (transferMode === 'items') return getSelectedTotal();
    return parseFloat(transferAmount) || 0;
  };

  const filteredTargetFolios = folios.filter(f => {
    if (f.id === sourceFolioId) return false;
    if (!searchTarget) return true;
    const guest = f.booking?.primaryGuest;
    const name = `${guest?.firstName || ''} ${guest?.lastName || ''}`.toLowerCase();
    const code = f.booking?.confirmationCode?.toLowerCase() || '';
    const num = f.folioNumber.toLowerCase();
    return name.includes(searchTarget.toLowerCase()) || code.includes(searchTarget.toLowerCase()) || num.includes(searchTarget.toLowerCase());
  });

  const handleTransfer = async () => {
    if (!sourceFolioId || !targetFolioId || !reason) {
      toast({ title: 'Validation Error', description: 'Please fill all required fields', variant: 'destructive' });
      return;
    }

    const amt = getActualTransferAmount();
    if (amt <= 0) {
      toast({ title: 'Validation Error', description: 'Transfer amount must be greater than 0', variant: 'destructive' });
      return;
    }

    const body: Record<string, unknown> = {
      fromFolioId: sourceFolioId,
      toFolioId: targetFolioId,
      reason,
      description: description || undefined,
    };

    if (transferMode === 'items') {
      if (selectedItems.length === 0) {
        toast({ title: 'Validation Error', description: 'Select at least one line item', variant: 'destructive' });
        return;
      }
      body.folioLineItemIds = selectedItems;
    } else {
      body.amount = amt;
    }

    setShowConfirmation(false);
    setIsTransferring(true);

    try {
      const res = await fetch('/api/folio/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (json.success) {
        toast({ title: 'Transfer Complete', description: `Successfully transferred $${json.data.totalTransferred.toFixed(2)}` });
        resetForm();
        setShowTransferDialog(false);
        fetchFolios();
      } else {
        toast({ title: 'Transfer Failed', description: json.error?.message || 'Unknown error', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to process transfer', variant: 'destructive' });
    } finally {
      setIsTransferring(false);
    }
  };

  const fetchHistory = async (folioId: string) => {
    setHistoryFolioId(folioId);
    setShowHistoryDialog(true);
    try {
      const res = await fetch(`/api/folio/transfer/history?folioId=${folioId}`);
      const json = await res.json();
      if (json.success) setTransferHistory(json.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch transfer history', variant: 'destructive' });
    }
  };

  const resetForm = () => {
    setSourceFolioId('');
    setTargetFolioId('');
    setTransferMode('items');
    setSelectedItems([]);
    setTransferAmount('');
    setReason('');
    setDescription('');
    setSourceLineItems([]);
    setSearchTarget('');
    setShowConfirmation(false);
  };

  const sourceFolio = folios.find(f => f.id === sourceFolioId);
  const targetFolio = folios.find(f => f.id === targetFolioId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Folio Transfer
          </h2>
          <p className="text-sm text-muted-foreground">Transfer charges between guest folios</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchFolios}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowTransferDialog(true)}>
            <ArrowRightLeft className="h-4 w-4 mr-2" />
            New Transfer
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
        <Card className="p-4 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <ArrowRightLeft className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">{folios.length}</div>
              <div className="text-xs text-muted-foreground">Active Folios</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-400 bg-clip-text text-transparent">
                {folios.filter(f => f.balance === 0).length}
              </div>
              <div className="text-xs text-muted-foreground">Settled Folios</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <AlertCircle className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-red-400 bg-clip-text text-transparent">
                ${folios.reduce((s, f) => s + f.balance, 0).toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground">Outstanding</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Folios list with history button */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Folios</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : (
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Folio</TableHead>
                    <TableHead>Guest</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {folios.map((folio) => (
                    <TableRow key={folio.id} className="hover:bg-muted/50">
                      <TableCell>
                        <p className="font-mono text-sm font-medium">{folio.folioNumber}</p>
                        <p className="text-xs text-muted-foreground">{folio.booking?.confirmationCode}</p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm">{folio.booking?.primaryGuest?.firstName} {folio.booking?.primaryGuest?.lastName}</p>
                      </TableCell>
                      <TableCell className="text-right font-medium">${folio.totalAmount.toFixed(2)}</TableCell>
                      <TableCell className={cn("text-right font-medium", folio.balance > 0 ? "text-amber-600" : "text-emerald-600")}>
                        ${folio.balance.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn(
                          "text-white text-xs",
                          folio.status === 'open' ? "bg-blue-500" :
                          folio.status === 'paid' ? "bg-emerald-500" : "bg-gray-500"
                        )}>
                          {folio.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => fetchHistory(folio.id)}>
                          <History className="h-3 w-3 mr-1" />
                          History
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Transfer Dialog */}
      <Dialog open={showTransferDialog} onOpenChange={(open) => { if (!open) resetForm(); setShowTransferDialog(open); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              New Folio Transfer
            </DialogTitle>
            <DialogDescription>Transfer charges from one folio to another</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Source Folio */}
            <div className="space-y-2">
              <Label>Source Folio *</Label>
              <Select value={sourceFolioId} onValueChange={(v) => { setSourceFolioId(v); setSelectedItems([]); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source folio" />
                </SelectTrigger>
                <SelectContent>
                  {folios.filter(f => f.status === 'open').map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.folioNumber} - {f.booking?.primaryGuest?.firstName} {f.booking?.primaryGuest?.lastName} (${f.balance.toFixed(2)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sourceFolio && (
                <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  Balance: <span className="font-medium text-amber-600">${sourceFolio.balance.toFixed(2)}</span> | Total: ${sourceFolio.totalAmount.toFixed(2)}
                </div>
              )}
            </div>

            {/* Target Folio */}
            <div className="space-y-2">
              <Label>Target Folio *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by guest name, booking code..."
                  value={searchTarget}
                  onChange={(e) => setSearchTarget(e.target.value)}
                  className="pl-9 mb-2"
                />
              </div>
              <Select value={targetFolioId} onValueChange={setTargetFolioId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target folio" />
                </SelectTrigger>
                <SelectContent>
                  {filteredTargetFolios.filter(f => f.status === 'open').map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.folioNumber} - {f.booking?.primaryGuest?.firstName} {f.booking?.primaryGuest?.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Transfer Mode */}
            {sourceFolioId && targetFolioId && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <Label>Transfer Mode</Label>
                <div className="flex gap-2">
                  <Button
                    variant={transferMode === 'items' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTransferMode('items')}
                  >
                    Transfer Specific Items
                  </Button>
                  <Button
                    variant={transferMode === 'amount' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setTransferMode('amount')}
                  >
                    Transfer Amount
                  </Button>
                </div>

                {transferMode === 'items' && sourceLineItems.length > 0 && (
                  <Card className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            <Checkbox
                              checked={selectedItems.length === sourceLineItems.length && sourceLineItems.length > 0}
                              onCheckedChange={(checked) => {
                                setSelectedItems(checked ? sourceLineItems.map(i => i.id) : []);
                              }}
                            />
                          </TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <AnimatePresence>
                          {sourceLineItems.map((item) => (
                            <motion.tr
                              key={item.id}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className={cn("border-b cursor-pointer hover:bg-muted/50", selectedItems.includes(item.id) && "bg-primary/5")}
                              onClick={() => toggleItem(item.id)}
                            >
                              <TableCell>
                                <Checkbox checked={selectedItems.includes(item.id)} />
                              </TableCell>
                              <TableCell className="text-sm">{item.description}</TableCell>
                              <TableCell className="text-right text-sm font-medium">
                                ${(item.totalAmount + item.taxAmount).toFixed(2)}
                              </TableCell>
                            </motion.tr>
                          ))}
                        </AnimatePresence>
                      </TableBody>
                    </Table>
                    {selectedItems.length > 0 && (
                      <div className="p-3 bg-muted/50 text-sm font-medium text-right">
                        Selected Total: <span className="text-primary">${getSelectedTotal().toFixed(2)}</span>
                      </div>
                    )}
                  </Card>
                )}

                {transferMode === 'amount' && (
                  <div className="space-y-2">
                    <Label>Transfer Amount</Label>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      value={transferAmount}
                      onChange={(e) => setTransferAmount(e.target.value)}
                    />
                  </div>
                )}

                {/* Reason */}
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
                  <Textarea
                    placeholder="Additional notes about this transfer..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Preview */}
                {getActualTransferAmount() > 0 && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="border rounded-lg p-4 bg-muted/30">
                    <h4 className="text-sm font-medium mb-3">Transfer Preview</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Source: {sourceFolio?.folioNumber}</p>
                        <div className="text-sm">
                          <span className="line-through text-muted-foreground">${previewBeforeFrom.toFixed(2)}</span>
                          <span className="mx-2">&rarr;</span>
                          <span className="font-medium">${(previewBeforeFrom - getActualTransferAmount()).toFixed(2)}</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Target: {targetFolio?.folioNumber}</p>
                        <div className="text-sm">
                          <span className="line-through text-muted-foreground">${previewBeforeTo.toFixed(2)}</span>
                          <span className="mx-2">&rarr;</span>
                          <span className="font-medium">${(previewBeforeTo + getActualTransferAmount()).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                    <Separator className="my-3" />
                    <div className="flex justify-between text-sm font-bold">
                      <span>Transfer Amount:</span>
                      <span className="text-primary">${getActualTransferAmount().toFixed(2)}</span>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setShowTransferDialog(false); }}>
              Cancel
            </Button>
            <Button
              onClick={() => setShowConfirmation(true)}
              disabled={!sourceFolioId || !targetFolioId || !reason || getActualTransferAmount() <= 0}
            >
              {isTransferring ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Confirm Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmation} onOpenChange={setShowConfirmation}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Transfer</DialogTitle>
            <DialogDescription>
              You are transferring <span className="font-bold text-foreground">${getActualTransferAmount().toFixed(2)}</span>
              {' '}from <span className="font-bold text-foreground">{sourceFolio?.folioNumber}</span>
              {' '}to <span className="font-bold text-foreground">{targetFolio?.folioNumber}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm space-y-1 bg-muted/50 p-3 rounded">
            <p>Reason: <span className="capitalize font-medium">{reason.replace('_', ' ')}</span></p>
            {transferMode === 'items' && <p>Items: {selectedItems.length} selected</p>}
            {description && <p>Note: {description}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmation(false)}>Back</Button>
            <Button onClick={handleTransfer} disabled={isTransferring}>
              {isTransferring ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Execute Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Transfer History
            </DialogTitle>
            <DialogDescription>Transfers for {historyFolioId ? folios.find(f => f.id === historyFolioId)?.folioNumber : 'folio'}</DialogDescription>
          </DialogHeader>
          {transferHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No transfers found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transferHistory.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">{format(new Date(t.createdAt), 'MMM d, yyyy HH:mm')}</TableCell>
                    <TableCell>
                      <Badge variant={t.fromFolioId === historyFolioId ? "destructive" : "default"} className="text-xs">
                        {t.fromFolioId === historyFolioId ? 'OUT' : 'IN'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{t.fromFolio.folioNumber}</TableCell>
                    <TableCell className="text-xs font-mono">{t.toFolio.folioNumber}</TableCell>
                    <TableCell className="text-right font-medium">${t.amount.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {t.reason.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
