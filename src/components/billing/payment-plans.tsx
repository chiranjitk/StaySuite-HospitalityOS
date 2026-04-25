'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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
  CreditCard,
  Plus,
  Search,
  Loader2,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  DollarSign,
  RefreshCw,
  Percent,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format, addDays, addWeeks, addMonths, differenceInDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';

interface Folio {
  id: string;
  folioNumber: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  currency: string;
  status: string;
  booking: {
    id: string;
    confirmationCode: string;
    checkIn: string;
    checkOut: string;
    primaryGuest: { id: string; firstName: string; lastName: string };
  };
}

interface Installment {
  amount: number;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  paymentId: string | null;
  paidAt: string | null;
}

interface PaymentSchedule {
  id: string;
  folioId: string;
  scheduleName: string;
  totalAmount: number;
  depositAmount: number;
  depositDueDate: string | null;
  installments: Installment[];
  currency: string;
  status: string;
  paidAmount: number;
  remainingAmount: number;
  createdAt: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  active: { label: 'Active', color: 'bg-blue-500', icon: Clock },
  completed: { label: 'Completed', color: 'bg-emerald-500', icon: CheckCircle2 },
  overdue: { label: 'Overdue', color: 'bg-red-500', icon: AlertTriangle },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500', icon: Clock },
};

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'custom', label: 'Custom Dates' },
];

export default function PaymentPlans() {
  const { toast } = useToast();

  const [folios, setFolios] = useState<Folio[]>([]);
  const [schedules, setSchedules] = useState<PaymentSchedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFolioId, setSelectedFolioId] = useState('');
  const [selectedInstallment, setSelectedInstallment] = useState<{ scheduleId: string; index: number } | null>(null);

  // Create form state
  const [scheduleName, setScheduleName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [depositPercent, setDepositPercent] = useState('20');
  const [installmentCount, setInstallmentCount] = useState('3');
  const [frequency, setFrequency] = useState('monthly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customDates, setCustomDates] = useState<Array<{ amount: number; dueDate: string }>>([]);

  const fetchFolios = useCallback(async () => {
    try {
      const res = await fetch('/api/folios?limit=200');
      const json = await res.json();
      if (json.success) setFolios(json.data);
    } catch { /* ignore */ }
  }, []);

  const fetchSchedules = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/folio/payment-schedule?folioId=' + selectedFolioId);
      const json = await res.json();
      if (json.success) setSchedules(json.data);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, [selectedFolioId]);

  useEffect(() => { fetchFolios(); }, [fetchFolios]);

  useEffect(() => {
    if (selectedFolioId) fetchSchedules();
    else setSchedules([]);
  }, [selectedFolioId, fetchSchedules]);

  // Auto-generate installments
  useEffect(() => {
    if (!startDate || !endDate || !installmentCount || !totalAmount || frequency === 'custom') return;

    const total = parseFloat(totalAmount);
    if (!total || total <= 0) return;

    const deposit = total * (parseFloat(depositPercent) / 100);
    const remaining = total - deposit;
    const count = parseInt(installmentCount);
    const perInstallment = remaining / count;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const days = differenceInDays(end, start);

    const generated: Array<{ amount: number; dueDate: string }> = [];
    for (let i = 0; i < count; i++) {
      let dueDate: Date;
      if (frequency === 'weekly') dueDate = addWeeks(start, i + 1);
      else if (frequency === 'biweekly') dueDate = addWeeks(start, (i + 1) * 2);
      else if (frequency === 'monthly') dueDate = addMonths(start, i + 1);
      else dueDate = addDays(start, Math.floor((days / count) * (i + 1)));

      generated.push({
        amount: Math.round(perInstallment * 100) / 100,
        dueDate: format(dueDate, 'yyyy-MM-dd'),
      });
    }

    setCustomDates(generated);
  }, [startDate, endDate, installmentCount, totalAmount, depositPercent, frequency]);

  const handleFolioChange = (folioId: string) => {
    setSelectedFolioId(folioId);
    const folio = folios.find(f => f.id === folioId);
    if (folio) {
      setTotalAmount(String(folio.balance || folio.totalAmount));
      setScheduleName(`${folio.booking?.primaryGuest?.firstName || 'Guest'} Payment Plan`);
      if (folio.booking?.checkIn && folio.booking?.checkOut) {
        setStartDate(format(new Date(folio.booking.checkIn), 'yyyy-MM-dd'));
        setEndDate(format(new Date(folio.booking.checkOut), 'yyyy-MM-dd'));
      }
    }
  };

  const handleCreateSchedule = async () => {
    if (!selectedFolioId || !totalAmount || !scheduleName) {
      toast({ title: 'Error', description: 'Fill all required fields', variant: 'destructive' });
      return;
    }

    const folio = folios.find(f => f.id === selectedFolioId);
    if (!folio) return;

    const total = parseFloat(totalAmount);
    const deposit = total * (parseFloat(depositPercent) / 100);
    const count = parseInt(installmentCount);

    let installments: Array<{ amount: number; dueDate: string }>;

    if (frequency === 'custom' && customDates.length > 0) {
      installments = customDates;
    } else {
      const remaining = total - deposit;
      const perInstallment = remaining / count;
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = differenceInDays(end, start);

      installments = [];
      for (let i = 0; i < count; i++) {
        let dueDate: Date;
        if (frequency === 'weekly') dueDate = addWeeks(start, i + 1);
        else if (frequency === 'biweekly') dueDate = addWeeks(start, (i + 1) * 2);
        else if (frequency === 'monthly') dueDate = addMonths(start, i + 1);
        else dueDate = addDays(start, Math.floor((days / count) * (i + 1)));

        installments.push({
          amount: Math.round(perInstallment * 100) / 100,
          dueDate: format(dueDate, 'yyyy-MM-dd'),
        });
      }
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/folio/payment-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folioId: selectedFolioId,
          bookingId: folio.booking.id,
          guestId: folio.booking.primaryGuest?.id,
          scheduleName,
          totalAmount: total,
          depositAmount: deposit > 0 ? deposit : undefined,
          depositDueDate: deposit > 0 ? startDate : undefined,
          installments,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Success', description: 'Payment plan created' });
        setShowCreateDialog(false);
        fetchSchedules();
        fetchFolios();
      } else {
        toast({ title: 'Error', description: json.error?.message || 'Failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create plan', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!selectedInstallment) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/folio/payment-schedule/${selectedInstallment.scheduleId}/mark-paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installmentIndex: selectedInstallment.index, method: 'cash' }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Success', description: 'Installment marked as paid' });
        setShowPayDialog(false);
        fetchSchedules();
      } else {
        toast({ title: 'Error', description: json.error?.message || 'Failed', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to mark paid', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const getInstallmentStatus = (installment: Installment): 'pending' | 'paid' | 'overdue' => {
    if (installment.status === 'paid') return 'paid';
    if (new Date(installment.dueDate) < new Date()) return 'overdue';
    return 'pending';
  };

  const selectedFolio = folios.find(f => f.id === selectedFolioId);
  const totalScheduled = schedules.reduce((s, sch) => s + sch.totalAmount, 0);
  const totalPaid = schedules.reduce((s, sch) => s + sch.paidAmount, 0);
  const totalRemaining = schedules.reduce((s, sch) => s + sch.remainingAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Payment Plans
          </h2>
          <p className="text-sm text-muted-foreground">Create and manage installment payment schedules</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { fetchFolios(); fetchSchedules(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Plan
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <Card className="p-4 hover:shadow-lg transition-all hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <CreditCard className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-violet-400 bg-clip-text text-transparent">{schedules.length}</div>
              <div className="text-xs text-muted-foreground">Plans</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg transition-all hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <DollarSign className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-blue-400 bg-clip-text text-transparent">${totalScheduled.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">Total Scheduled</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg transition-all hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-teal-400 bg-clip-text text-transparent">${totalPaid.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">Total Paid</div>
            </div>
          </div>
        </Card>
        <Card className="p-4 hover:shadow-lg transition-all hover:-translate-y-0.5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold bg-gradient-to-r from-amber-600 to-red-400 bg-clip-text text-transparent">${totalRemaining.toFixed(2)}</div>
              <div className="text-xs text-muted-foreground">Remaining</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Folio Selector */}
      <Card>
        <CardContent className="p-4">
          <Label className="text-sm font-medium">Select Folio</Label>
          <Select value={selectedFolioId} onValueChange={handleFolioChange}>
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Choose a folio to view payment plans" />
            </SelectTrigger>
            <SelectContent>
              {folios.map(f => (
                <SelectItem key={f.id} value={f.id}>
                  {f.folioNumber} - {f.booking?.primaryGuest?.firstName} {f.booking?.primaryGuest?.lastName} (${f.balance.toFixed(2)})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Schedules */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : schedules.length === 0 && selectedFolioId ? (
        <Card className="py-12">
          <div className="text-center text-muted-foreground">
            <CreditCard className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No payment plans for this folio</p>
            <p className="text-sm mt-1">Create one to set up installments</p>
          </div>
        </Card>
      ) : !selectedFolioId ? (
        <Card className="py-12">
          <div className="text-center text-muted-foreground">
            <Search className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Select a folio to view payment plans</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {schedules.map((schedule) => {
            const statusCfg = STATUS_CONFIG[schedule.status] || STATUS_CONFIG.active;
            const progress = schedule.totalAmount > 0 ? (schedule.paidAmount / schedule.totalAmount) * 100 : 0;
            const StatusIcon = statusCfg.icon;

            return (
              <motion.div
                key={schedule.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-col sm:flex-row justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">{schedule.scheduleName}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">Created {format(new Date(schedule.createdAt), 'MMM d, yyyy')}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={cn("text-white text-xs", statusCfg.color)}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusCfg.label}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Progress bar */}
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">${schedule.paidAmount.toFixed(2)} paid</span>
                        <span className="font-medium">{progress.toFixed(0)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>of ${schedule.totalAmount.toFixed(2)}</span>
                        <span>${schedule.remainingAmount.toFixed(2)} remaining</span>
                      </div>
                    </div>

                    {/* Deposit */}
                    {schedule.depositAmount > 0 && (
                      <div className="flex items-center gap-2 text-sm bg-muted/50 p-2 rounded">
                        <Percent className="h-4 w-4 text-muted-foreground" />
                        <span>Deposit: <span className="font-medium">${schedule.depositAmount.toFixed(2)}</span></span>
                        {schedule.depositDueDate && (
                          <span className="text-muted-foreground ml-2">
                            Due: {format(new Date(schedule.depositDueDate), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Installment Timeline */}
                    <div>
                      <h4 className="text-sm font-medium mb-3">Installment Timeline</h4>
                      <div className="space-y-2">
                        {schedule.installments.map((inst, idx) => {
                          const status = getInstallmentStatus(inst);
                          return (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.05 }}
                              className={cn(
                                "flex items-center justify-between p-3 rounded-lg border transition-colors",
                                status === 'paid' && "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800",
                                status === 'overdue' && "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
                                status === 'pending' && "bg-white dark:bg-muted/30"
                              )}
                            >
                              <div className="flex items-center gap-3">
                                <div className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                                  status === 'paid' && "bg-emerald-500 text-white",
                                  status === 'overdue' && "bg-red-500 text-white",
                                  status === 'pending' && "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                                )}>
                                  {idx + 1}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">${inst.amount.toFixed(2)}</p>
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {format(new Date(inst.dueDate), 'MMM d, yyyy')}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {status === 'paid' && (
                                  <Badge className="bg-emerald-500 text-white text-xs">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    Paid
                                  </Badge>
                                )}
                                {status === 'overdue' && (
                                  <Badge className="bg-red-500 text-white text-xs">
                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                    Overdue
                                  </Badge>
                                )}
                                {status === 'pending' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs"
                                    onClick={() => {
                                      setSelectedInstallment({ scheduleId: schedule.id, index: idx });
                                      setShowPayDialog(true);
                                    }}
                                  >
                                    <DollarSign className="h-3 w-3 mr-1" />
                                    Mark Paid
                                  </Button>
                                )}
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Plan Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Payment Plan</DialogTitle>
            <DialogDescription>Set up installment payments for a guest folio</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Folio *</Label>
              <Select value={selectedFolioId} onValueChange={handleFolioChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select folio" />
                </SelectTrigger>
                <SelectContent>
                  {folios.filter(f => f.status === 'open').map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.folioNumber} - {f.booking?.primaryGuest?.firstName} {f.booking?.primaryGuest?.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Plan Name *</Label>
              <Input value={scheduleName} onChange={e => setScheduleName(e.target.value)} placeholder="e.g., Guest Payment Plan" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Total Amount *</Label>
                <Input type="number" min="0.01" step="0.01" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Deposit %</Label>
                <Input type="number" min="0" max="100" value={depositPercent} onChange={e => setDepositPercent(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Number of Installments</Label>
                <Input type="number" min="1" max="24" value={installmentCount} onChange={e => setInstallmentCount(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select value={frequency} onValueChange={setFrequency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>

            {/* Preview */}
            {totalAmount && startDate && endDate && installmentCount && (
              <div className="border rounded-lg p-3 bg-muted/30">
                <h4 className="text-sm font-medium mb-2">Schedule Preview</h4>
                {parseFloat(depositPercent) > 0 && (
                  <div className="flex justify-between text-sm mb-1">
                    <span>Deposit ({depositPercent}%):</span>
                    <span className="font-medium">${(parseFloat(totalAmount) * parseFloat(depositPercent) / 100).toFixed(2)}</span>
                  </div>
                )}
                <Separator className="my-2" />
                <div className="space-y-1">
                  {(frequency === 'custom' ? customDates : null)?.map((d, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>#{i + 1} - {format(new Date(d.dueDate), 'MMM d, yyyy')}</span>
                      <span>${d.amount.toFixed(2)}</span>
                    </div>
                  ))}
                  {frequency !== 'custom' && customDates.map((d, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>#{i + 1} - {format(new Date(d.dueDate), 'MMM d, yyyy')}</span>
                      <span>${d.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateSchedule} disabled={isSaving || !selectedFolioId || !totalAmount || !scheduleName}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Plan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Paid Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark Installment as Paid</DialogTitle>
            <DialogDescription>Confirm that this installment has been received</DialogDescription>
          </DialogHeader>
          {selectedInstallment && schedules.length > 0 && (() => {
            const schedule = schedules.find(s => s.id === selectedInstallment.scheduleId);
            if (!schedule) return null;
            const inst = schedule.installments[selectedInstallment.index];
            return (
              <div className="bg-muted/50 p-3 rounded text-sm space-y-1">
                <p>Installment #{selectedInstallment.index + 1}: <span className="font-bold">${inst.amount.toFixed(2)}</span></p>
                <p className="text-muted-foreground">Due: {format(new Date(inst.dueDate), 'MMM d, yyyy')}</p>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayDialog(false)}>Cancel</Button>
            <Button onClick={handleMarkPaid} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
