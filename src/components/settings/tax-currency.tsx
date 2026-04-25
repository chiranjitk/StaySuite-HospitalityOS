'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Loader2,
  DollarSign,
  Percent,
  Save,
  Plus,
  Trash2,
  Edit,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
  Globe,
  Building,
  Calculator,
  Settings2,
  Info,
  ArrowRightLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useTax, type Tax, type TaxGroup } from '@/contexts/TaxContext';
import { cn } from '@/lib/utils';

interface CurrencySettings {
  default: string;
  symbol: string;
  position: string;
  decimalPlaces: number;
  thousandSeparator: string;
  decimalSeparator: string;
}

interface SupportedCurrency {
  code: string;
  name: string;
  symbol: string;
  rate: number;
}

interface TaxCurrencySettings {
  currency: CurrencySettings;
  supportedCurrencies: SupportedCurrency[];
  exchangeRatesLastUpdated: string | null;
  isRealTimeRates: boolean;
  taxes: Tax[];
  taxGroups: TaxGroup[];
  rounding: { method: string; precision: number };
  taxSettings: {
    taxIdNumber: string;
    taxInclusivePricing: boolean;
    displayTaxInPrices: boolean;
    taxRoundingMethod: 'up' | 'down' | 'nearest';
    taxCalculationBasis: 'line_item' | 'invoice_total';
  };
}

const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR - Indian Rupee (₹)' },
  { value: 'USD', label: 'USD - US Dollar ($)' },
  { value: 'EUR', label: 'EUR - Euro (€)' },
  { value: 'GBP', label: 'GBP - British Pound (£)' },
  { value: 'CAD', label: 'CAD - Canadian Dollar (C$)' },
  { value: 'AUD', label: 'AUD - Australian Dollar (A$)' },
  { value: 'AED', label: 'AED - UAE Dirham (د.إ)' },
  { value: 'SGD', label: 'SGD - Singapore Dollar (S$)' },
  { value: 'JPY', label: 'JPY - Japanese Yen (¥)' },
  { value: 'CNY', label: 'CNY - Chinese Yuan (¥)' },
  { value: 'CHF', label: 'CHF - Swiss Franc' },
  { value: 'THB', label: 'THB - Thai Baht (฿)' },
  { value: 'MYR', label: 'MYR - Malaysian Ringgit (RM)' },
  { value: 'ZAR', label: 'ZAR - South African Rand (R)' },
];

const TAX_APPLIES_TO_OPTIONS = [
  { value: 'all', label: 'All Transactions' },
  { value: 'room', label: 'Room Charges' },
  { value: 'food', label: 'Food & Dining' },
  { value: 'beverage', label: 'Beverages' },
  { value: 'services', label: 'Services' },
  { value: 'amenities', label: 'Amenities' },
  { value: 'spa', label: 'Spa & Wellness' },
  { value: 'events', label: 'Events & Conferences' },
  { value: 'other', label: 'Other' },
];

const TAX_TYPE_OPTIONS = [
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'fixed', label: 'Fixed Amount' },
];

export default function TaxCurrencySettings() {
  const [settings, setSettings] = useState<TaxCurrencySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('currency');
  const { refreshCurrency, formatCurrency } = useCurrency();
  const { refreshTaxes } = useTax();

  // Tax dialog states
  const [isTaxDialogOpen, setIsTaxDialogOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<Tax | null>(null);
  const [deleteTaxId, setDeleteTaxId] = useState<string | null>(null);
  const [taxFormData, setTaxFormData] = useState({
    name: '',
    rate: '',
    type: 'percentage',
    appliesTo: 'all',
    included: false,
    enabled: true,
    priority: 0,
    compound: false,
  });

  // Currency converter state
  const [converterAmount, setConverterAmount] = useState('100');
  const [converterFrom, setConverterFrom] = useState('USD');
  const [converterTo, setConverterTo] = useState('INR');
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (converterAmount && converterFrom && converterTo) {
      convertCurrency();
    }
  }, [converterAmount, converterFrom, converterTo, settings?.supportedCurrencies]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/tax-currency');
      const data = await response.json();
      if (data.success) {
        setSettings(data.data);
      }
    } catch {
      toast.error('Failed to fetch tax/currency settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/settings/tax-currency', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        await refreshCurrency();
        await refreshTaxes();
        toast.success('Settings saved successfully');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const convertCurrency = () => {
    if (!settings?.supportedCurrencies) return;
    
    const fromRate = settings.supportedCurrencies.find(c => c.code === converterFrom)?.rate || 1;
    const toRate = settings.supportedCurrencies.find(c => c.code === converterTo)?.rate || 1;
    const amount = parseFloat(converterAmount) || 0;
    
    // Rates are relative to default currency
    const result = (amount / fromRate) * toRate;
    setConvertedAmount(result);
  };

  // Tax CRUD Operations
  const handleAddTax = () => {
    setEditingTax(null);
    setTaxFormData({
      name: '',
      rate: '',
      type: 'percentage',
      appliesTo: 'all',
      included: false,
      enabled: true,
      priority: settings?.taxes?.length || 0,
      compound: false,
    });
    setIsTaxDialogOpen(true);
  };

  const handleEditTax = (tax: Tax) => {
    setEditingTax(tax);
    setTaxFormData({
      name: tax.name,
      rate: tax.rate.toString(),
      type: tax.type,
      appliesTo: tax.appliesTo,
      included: tax.included,
      enabled: tax.enabled,
      priority: tax.priority || 0,
      compound: tax.compound || false,
    });
    setIsTaxDialogOpen(true);
  };

  const handleSaveTax = async () => {
    if (!taxFormData.name || !taxFormData.rate) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      if (editingTax) {
        // Update existing tax
        const response = await fetch('/api/settings/tax-currency', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taxId: editingTax.id,
            updates: {
              name: taxFormData.name,
              rate: parseFloat(taxFormData.rate),
              type: taxFormData.type,
              appliesTo: taxFormData.appliesTo,
              included: taxFormData.included,
              enabled: taxFormData.enabled,
              priority: taxFormData.priority,
              compound: taxFormData.compound,
            },
          }),
        });

        if (response.ok) {
          toast.success('Tax updated successfully');
          await fetchSettings();
          await refreshTaxes();
        }
      } else {
        // Create new tax
        const response = await fetch('/api/settings/tax-currency', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tax: taxFormData }),
        });

        if (response.ok) {
          toast.success('Tax created successfully');
          await fetchSettings();
          await refreshTaxes();
        }
      }
      setIsTaxDialogOpen(false);
    } catch {
      toast.error('Failed to save tax');
    }
  };

  const handleDeleteTax = (taxId: string) => {
    setDeleteTaxId(taxId);
  };

  const confirmDeleteTax = async () => {
    if (!deleteTaxId) return;

    try {
      const response = await fetch(`/api/settings/tax-currency?taxId=${deleteTaxId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Tax deleted successfully');
        await fetchSettings();
        await refreshTaxes();
      }
    } catch {
      toast.error('Failed to delete tax');
    } finally {
      setDeleteTaxId(null);
    }
  };

  const toggleTax = (id: string) => {
    if (!settings) return;
    setSettings({
      ...settings,
      taxes: settings.taxes.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t),
    });
  };

  const refreshExchangeRates = async () => {
    try {
      const response = await fetch('/api/exchange-rates');
      if (response.ok) {
        await fetchSettings();
        toast.success('Exchange rates refreshed');
      }
    } catch {
      toast.error('Failed to refresh exchange rates');
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Tax & Currency Settings</h2>
          <p className="text-muted-foreground">Configure currencies, exchange rates, and tax rates</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="currency" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Currency
          </TabsTrigger>
          <TabsTrigger value="exchange" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Exchange Rates
          </TabsTrigger>
          <TabsTrigger value="taxes" className="flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Taxes
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Settings
          </TabsTrigger>
        </TabsList>

        {/* Currency Tab */}
        <TabsContent value="currency" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Default Currency
              </CardTitle>
              <CardDescription>Set your default currency and formatting preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Default Currency</Label>
                  <Select 
                    value={settings.currency.default} 
                    onValueChange={(v) => setSettings({ 
                      ...settings, 
                      currency: { ...settings.currency, default: v, symbol: CURRENCY_OPTIONS.find(c => c.value === v)?.label.split('(')[1]?.replace(')', '') || v } 
                    })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CURRENCY_OPTIONS.map(option => (
                        <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Symbol Position</Label>
                  <Select 
                    value={settings.currency.position} 
                    onValueChange={(v) => setSettings({ ...settings, currency: { ...settings.currency, position: v } })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="before">Before amount ({settings.currency.symbol}100)</SelectItem>
                      <SelectItem value="after">After amount (100{settings.currency.symbol})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Decimal Places</Label>
                  <Select 
                    value={settings.currency.decimalPlaces.toString()} 
                    onValueChange={(v) => setSettings({ ...settings, currency: { ...settings.currency, decimalPlaces: parseInt(v) } })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0</SelectItem>
                      <SelectItem value="2">2</SelectItem>
                      <SelectItem value="3">3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Thousand Separator</Label>
                  <Select 
                    value={settings.currency.thousandSeparator} 
                    onValueChange={(v) => setSettings({ ...settings, currency: { ...settings.currency, thousandSeparator: v } })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value=",">Comma (,)</SelectItem>
                      <SelectItem value=".">Dot (.)</SelectItem>
                      <SelectItem value=" ">Space ( )</SelectItem>
                      <SelectItem value="none">None</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Decimal Separator</Label>
                  <Select 
                    value={settings.currency.decimalSeparator} 
                    onValueChange={(v) => setSettings({ ...settings, currency: { ...settings.currency, decimalSeparator: v } })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value=".">Dot (.)</SelectItem>
                      <SelectItem value=",">Comma (,)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Card className="p-4 bg-muted/50">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Preview</p>
                    <p className="text-2xl font-bold">
                      {settings.currency.position === 'before' ? settings.currency.symbol : ''}
                      {Number(12345.67).toLocaleString('en-US', {
                        minimumFractionDigits: settings.currency.decimalPlaces,
                        maximumFractionDigits: settings.currency.decimalPlaces,
                      }).replace(/,/g, settings.currency.thousandSeparator === 'none' ? '' : settings.currency.thousandSeparator).replace(/\./g, settings.currency.decimalSeparator)}
                      {settings.currency.position === 'after' ? settings.currency.symbol : ''}
                    </p>
                  </div>
                </div>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exchange Rates Tab */}
        <TabsContent value="exchange" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="h-5 w-5" />
                    Exchange Rates
                    {settings.isRealTimeRates ? (
                      <Badge variant="default" className="ml-2 bg-emerald-500">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Live
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="ml-2">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Fallback
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    Real-time exchange rates from ExchangeRate-API
                    {settings.exchangeRatesLastUpdated && (
                      <span className="ml-2 text-xs">
                        Last updated: {new Date(settings.exchangeRatesLastUpdated).toLocaleString()}
                      </span>
                    )}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={refreshExchangeRates}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Currency Converter */}
              <Card className="p-4 mb-6 bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                <div className="flex items-center gap-2 mb-4">
                  <ArrowRightLeft className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Currency Converter</h3>
                </div>
                <div className="grid gap-4 md:grid-cols-5 items-end">
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input
                      type="number"
                      value={converterAmount}
                      onChange={(e) => setConverterAmount(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>From</Label>
                    <Select value={converterFrom} onValueChange={setConverterFrom}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {settings.supportedCurrencies.map(c => (
                          <SelectItem key={c.code} value={c.code}>{c.code} - {c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const temp = converterFrom;
                        setConverterFrom(converterTo);
                        setConverterTo(temp);
                      }}
                    >
                      <ArrowRightLeft className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2">
                    <Label>To</Label>
                    <Select value={converterTo} onValueChange={setConverterTo}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {settings.supportedCurrencies.map(c => (
                          <SelectItem key={c.code} value={c.code}>{c.code} - {c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Result</Label>
                    <div className="text-2xl font-bold text-primary">
                      {convertedAmount !== null ? convertedAmount.toFixed(2) : '—'} {converterTo}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Exchange Rates Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Currency Name</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead className="text-right">Rate (vs {settings.currency.default})</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settings.supportedCurrencies.slice(0, 20).map((currency) => (
                      <TableRow key={currency.code}>
                        <TableCell className="font-medium">{currency.code}</TableCell>
                        <TableCell>{currency.name}</TableCell>
                        <TableCell>{currency.symbol}</TableCell>
                        <TableCell className="text-right font-mono">{currency.rate.toFixed(4)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {settings.supportedCurrencies.length > 20 && (
                <p className="text-sm text-muted-foreground mt-2">
                  Showing 20 of {settings.supportedCurrencies.length} currencies
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Taxes Tab */}
        <TabsContent value="taxes" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Percent className="h-5 w-5" />
                    Tax Configuration
                  </CardTitle>
                  <CardDescription>
                    Manage tax rates for different transaction types. Taxes are applied globally based on category.
                  </CardDescription>
                </div>
                <Button onClick={handleAddTax}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Tax
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tax Name</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Applies To</TableHead>
                      <TableHead>Included in Price</TableHead>
                      <TableHead>Compound</TableHead>
                      <TableHead className="text-center">Enabled</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settings.taxes.map((tax) => (
                      <TableRow key={tax.id} className={!tax.enabled ? 'opacity-50' : ''}>
                        <TableCell className="font-medium">{tax.name}</TableCell>
                        <TableCell>
                          {tax.type === 'percentage' ? `${tax.rate}%` : formatCurrency(tax.rate)}
                        </TableCell>
                        <TableCell className="capitalize">{tax.type}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {TAX_APPLIES_TO_OPTIONS.find(o => o.value === tax.appliesTo)?.label || tax.appliesTo}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className={tax.included ? 'text-emerald-500 dark:text-emerald-400' : 'text-muted-foreground'}>
                            {tax.included ? 'Yes' : 'No'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={tax.compound ? 'text-amber-500 dark:text-amber-400' : 'text-muted-foreground'}>
                            {tax.compound ? 'Yes' : 'No'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch checked={tax.enabled} onCheckedChange={() => toggleTax(tax.id)} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEditTax(tax)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-red-600 dark:text-red-400 hover:text-red-700"
                              onClick={() => handleDeleteTax(tax.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {settings.taxes.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          No taxes configured. Click "Add Tax" to create one.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Tax Groups */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Tax Groups
              </CardTitle>
              <CardDescription>
                Group taxes for easier management. Assign multiple taxes to specific categories.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {settings.taxGroups.map((group) => (
                  <Card key={group.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium">{group.name}</h4>
                      {group.isDefault && <Badge>Default</Badge>}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {group.taxes.length > 0 ? (
                        group.taxes.map(taxId => {
                          const tax = settings.taxes.find(t => t.id === taxId);
                          return tax ? (
                            <Badge key={taxId} variant="secondary">{tax.name}</Badge>
                          ) : null;
                        })
                      ) : (
                        <span className="text-sm text-muted-foreground">No taxes assigned</span>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Tax Calculation Settings
              </CardTitle>
              <CardDescription>Configure how taxes are calculated and displayed</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tax ID / GST Number</Label>
                  <Input
                    value={settings.taxSettings?.taxIdNumber || ''}
                    onChange={(e) => setSettings({
                      ...settings,
                      taxSettings: { ...settings.taxSettings, taxIdNumber: e.target.value }
                    })}
                    placeholder="e.g., 29ABCDE1234F1Z5"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tax Calculation Basis</Label>
                  <Select
                    value={settings.taxSettings?.taxCalculationBasis || 'line_item'}
                    onValueChange={(v) => setSettings({
                      ...settings,
                      taxSettings: { ...settings.taxSettings, taxCalculationBasis: v as 'line_item' | 'invoice_total' }
                    })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="line_item">Line Item Level</SelectItem>
                      <SelectItem value="invoice_total">Invoice Total Level</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Tax-Inclusive Pricing</Label>
                    <p className="text-sm text-muted-foreground">Prices include taxes by default</p>
                  </div>
                  <Switch
                    checked={settings.taxSettings?.taxInclusivePricing || false}
                    onCheckedChange={(v) => setSettings({
                      ...settings,
                      taxSettings: { ...settings.taxSettings, taxInclusivePricing: v }
                    })}
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Display Tax in Prices</Label>
                    <p className="text-sm text-muted-foreground">Show tax breakdown on invoices</p>
                  </div>
                  <Switch
                    checked={settings.taxSettings?.displayTaxInPrices ?? true}
                    onCheckedChange={(v) => setSettings({
                      ...settings,
                      taxSettings: { ...settings.taxSettings, displayTaxInPrices: v }
                    })}
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tax Rounding Method</Label>
                  <Select
                    value={settings.taxSettings?.taxRoundingMethod || 'nearest'}
                    onValueChange={(v) => setSettings({
                      ...settings,
                      taxSettings: { ...settings.taxSettings, taxRoundingMethod: v as 'up' | 'down' | 'nearest' }
                    })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nearest">Round to Nearest</SelectItem>
                      <SelectItem value="up">Always Round Up</SelectItem>
                      <SelectItem value="down">Always Round Down</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Rounding Precision</Label>
                  <Select
                    value={settings.rounding?.precision?.toString() || '0.01'}
                    onValueChange={(v) => setSettings({
                      ...settings,
                      rounding: { ...settings.rounding, precision: parseFloat(v) }
                    })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0.01">0.01 (2 decimals)</SelectItem>
                      <SelectItem value="0.1">0.1 (1 decimal)</SelectItem>
                      <SelectItem value="1">1 (Whole number)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Card className="p-4 bg-muted/50">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 text-blue-500 dark:text-blue-400 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium">Tax Application Order</p>
                    <p className="text-sm text-muted-foreground">
                      Taxes are applied in order of priority. Compound taxes are calculated on the amount 
                      including previous taxes. Non-compound taxes are always calculated on the base amount.
                    </p>
                  </div>
                </div>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTaxId} onOpenChange={(open) => !open && setDeleteTaxId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tax</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this tax? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteTax} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tax Dialog */}
      <Dialog open={isTaxDialogOpen} onOpenChange={setIsTaxDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTax ? 'Edit Tax' : 'Add New Tax'}</DialogTitle>
            <DialogDescription>
              {editingTax ? 'Modify the tax configuration' : 'Create a new tax rate for transactions'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="taxName">Tax Name *</Label>
              <Input
                id="taxName"
                value={taxFormData.name}
                onChange={(e) => setTaxFormData({ ...taxFormData, name: e.target.value })}
                placeholder="e.g., GST, VAT, Service Charge"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taxRate">Rate *</Label>
                <Input
                  id="taxRate"
                  type="number"
                  step="0.01"
                  value={taxFormData.rate}
                  onChange={(e) => setTaxFormData({ ...taxFormData, rate: e.target.value })}
                  placeholder={taxFormData.type === 'percentage' ? '18' : '500'}
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={taxFormData.type}
                  onValueChange={(v) => setTaxFormData({ ...taxFormData, type: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TAX_TYPE_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Applies To</Label>
              <Select
                value={taxFormData.appliesTo}
                onValueChange={(v) => setTaxFormData({ ...taxFormData, appliesTo: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TAX_APPLIES_TO_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Input
                  type="number"
                  value={taxFormData.priority}
                  onChange={(e) => setTaxFormData({ ...taxFormData, priority: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Included in Price</Label>
                  <p className="text-xs text-muted-foreground">Tax is already included in displayed prices</p>
                </div>
                <Switch
                  checked={taxFormData.included}
                  onCheckedChange={(v) => setTaxFormData({ ...taxFormData, included: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Compound Tax</Label>
                  <p className="text-xs text-muted-foreground">Calculate on amount including previous taxes</p>
                </div>
                <Switch
                  checked={taxFormData.compound}
                  onCheckedChange={(v) => setTaxFormData({ ...taxFormData, compound: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enabled</Label>
                  <p className="text-xs text-muted-foreground">Tax is active and will be applied</p>
                </div>
                <Switch
                  checked={taxFormData.enabled}
                  onCheckedChange={(v) => setTaxFormData({ ...taxFormData, enabled: v })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTaxDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveTax}>
              {editingTax ? 'Update Tax' : 'Create Tax'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
