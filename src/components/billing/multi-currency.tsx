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
import {
  ArrowLeftRight,
  Plus,
  Loader2,
  RefreshCw,
  DollarSign,
  Trash2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

const CURRENCIES = [
  'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'CNY', 'INR',
  'MXN', 'BRL', 'KRW', 'SGD', 'HKD', 'NOK', 'SEK', 'DKK', 'NZD',
  'ZAR', 'AED', 'SAR', 'THB', 'MYR', 'IDR', 'PHP', 'TRY', 'PLN',
];

interface ExchangeRate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  source: string;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function MultiCurrency() {
  const { toast } = useToast();

  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Converter state
  const [convertAmount, setConvertAmount] = useState('100');
  const [convertFrom, setConvertFrom] = useState('EUR');
  const [convertTo, setConvertTo] = useState('USD');
  const [convertResult, setConvertResult] = useState<{ convertedAmount: number; rate: number } | null>(null);
  const [isConverting, setIsConverting] = useState(false);

  // Create form
  const [fromCurrency, setFromCurrency] = useState('USD');
  const [toCurrency, setToCurrency] = useState('EUR');
  const [rate, setRate] = useState('');
  const [source, setSource] = useState('manual');
  const [validUntil, setValidUntil] = useState('');

  const fetchRates = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/billing/exchange-rates?active=true');
      const json = await res.json();
      if (json.success) setRates(json.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch rates', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  const handleConvert = useCallback(async () => {
    const amt = parseFloat(convertAmount);
    if (!amt || amt <= 0) return;
    setIsConverting(true);
    try {
      const res = await fetch(`/api/billing/exchange-rates/convert?amount=${amt}&from=${convertFrom}&to=${convertTo}`);
      const json = await res.json();
      if (json.success) {
        setConvertResult({ convertedAmount: json.data.convertedAmount, rate: json.data.rate });
      } else {
        setConvertResult(null);
        toast({ title: 'Error', description: json.error?.message || 'Conversion failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Conversion failed', variant: 'destructive' });
    } finally {
      setIsConverting(false);
    }
  }, [convertAmount, convertFrom, convertTo, toast]);

  // Auto-convert when inputs change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (convertAmount && convertFrom && convertTo) {
        handleConvert();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [convertAmount, convertFrom, convertTo, handleConvert]);

  const handleCreate = async () => {
    if (!fromCurrency || !toCurrency || !rate) {
      toast({ title: 'Error', description: 'Fill all required fields', variant: 'destructive' });
      return;
    }

    if (fromCurrency === toCurrency) {
      toast({ title: 'Error', description: 'Currencies must be different', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/billing/exchange-rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromCurrency,
          toCurrency,
          rate: parseFloat(rate),
          source,
          validUntil: validUntil || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Success', description: `Rate created: ${fromCurrency}/${toCurrency} = ${rate}` });
        setShowCreateDialog(false);
        setRate('');
        setValidUntil('');
        fetchRates();
      } else {
        toast({ title: 'Error', description: json.error?.message || 'Failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create rate', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const activeRates = rates.filter(r => r.isActive);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            Multi-Currency Billing
          </h2>
          <p className="text-sm text-muted-foreground">Manage exchange rates and multi-currency charges</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchRates}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Rate
          </Button>
        </div>
      </div>

      {/* Currency Converter Widget */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardContent className="p-6">
            <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-primary" />
              Currency Converter
            </h3>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="flex-1 w-full">
                <Label className="text-xs text-muted-foreground">Amount</Label>
                <Input
                  type="number"
                  value={convertAmount}
                  onChange={(e) => setConvertAmount(e.target.value)}
                  className="mt-1"
                  placeholder="0.00"
                />
              </div>
              <div className="flex-1 w-full">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Select value={convertFrom} onValueChange={setConvertFrom}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="pt-5">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { const tmp = convertFrom; setConvertFrom(convertTo); setConvertTo(tmp); }}
                  className="rounded-full"
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 w-full">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Select value={convertTo} onValueChange={setConvertTo}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 w-full pt-5">
                {isConverting ? (
                  <div className="flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
                ) : convertResult ? (
                  <div className="text-right">
                    <p className="text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                      {convertResult.convertedAmount.toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Rate: 1 {convertFrom} = {convertResult.rate.toFixed(4)} {convertTo}
                    </p>
                  </div>
                ) : (
                  <div className="text-right text-muted-foreground">
                    <p className="text-sm">Enter an amount to convert</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Exchange Rates Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Active Exchange Rates</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : activeRates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ArrowLeftRight className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p>No exchange rates configured</p>
              <p className="text-sm mt-1">Add a rate to enable multi-currency billing</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>From</TableHead>
                  <TableHead></TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Valid From</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeRates.map((rate) => (
                  <TableRow key={rate.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono font-medium">{rate.fromCurrency}</TableCell>
                    <TableCell>
                      <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell className="font-mono font-medium">{rate.toCurrency}</TableCell>
                    <TableCell className="text-right font-mono font-bold">{rate.rate.toFixed(4)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{rate.source}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(rate.validFrom), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {rate.validUntil ? format(new Date(rate.validUntil), 'MMM d, yyyy') : 'No expiry'}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", rate.isActive ? "bg-emerald-500 text-white" : "bg-gray-400 text-white")}>
                        {rate.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* All Rates History */}
      {rates.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Rate History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pair</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rates.map((r) => (
                  <TableRow key={r.id} className={cn(!r.isActive && 'opacity-50')}>
                    <TableCell className="font-mono text-sm">{r.fromCurrency}/{r.toCurrency}</TableCell>
                    <TableCell className="text-right font-mono">{r.rate.toFixed(4)}</TableCell>
                    <TableCell className="text-xs capitalize">{r.source}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(r.createdAt), 'MMM d, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-xs", r.isActive ? "bg-emerald-500 text-white" : "bg-gray-400 text-white")}>
                        {r.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create Rate Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Exchange Rate</DialogTitle>
            <DialogDescription>Set up a currency conversion rate</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From Currency *</Label>
                <Select value={fromCurrency} onValueChange={setFromCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To Currency *</Label>
                <Select value={toCurrency} onValueChange={setToCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Exchange Rate * <span className="text-muted-foreground font-normal">(1 {fromCurrency} = ? {toCurrency})</span></Label>
              <Input
                type="number"
                min="0.0001"
                step="0.0001"
                placeholder="0.0000"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Source</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="auto">Auto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Valid Until (optional)</Label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isSaving || !rate || fromCurrency === toCurrency}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Rate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
