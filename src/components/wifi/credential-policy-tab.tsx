'use client';

/**
 * Credential Policy Tab
 *
 * Configurable username and password generation rules for WiFi credentials.
 * Different hotels use different flows — this component gives full control
 * over how credentials are generated when guests check in or vouchers are created.
 *
 * Supported Username Formats:
 *   room_random, room_only, lastname_room, firstinitial_lastname,
 *   firstinitial_lastname_room, lastname_firstinitial_room, mobile,
 *   last4_mobile, mobile_random, email_prefix, booking_id, custom_prefix,
 *   passport, lastname_random
 *
 * Supported Password Formats:
 *   random_alphanumeric, random_numeric, room_number, last4_mobile,
 *   lastname, lastname_room, fixed, checkin_date, passport, firstinitial_lastname
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  UserCog,
  Eye,
  RefreshCw,
  Info,
  AlertTriangle,
  Copy,
  CheckCircle,
  ShieldCheck,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─── Format Catalogs ─────────────────────────────────────────────────

const USERNAME_FORMATS = [
  { value: 'room_random', label: 'Room + Random', desc: 'room101_a3f2', example: 'room101_x7k9', category: 'room' },
  { value: 'room_only', label: 'Room Number Only', desc: 'Just the room number', example: '101', category: 'room' },
  { value: 'lastname_room', label: 'Last Name + Room', desc: 'smith101', example: 'smith101', category: 'name' },
  { value: 'firstinitial_lastname', label: 'First Initial + Last Name', desc: 'jsmith', example: 'jsmith', category: 'name' },
  { value: 'firstinitial_lastname_room', label: 'Initial + Surname + Room', desc: 'jsmith101', example: 'jsmith101', category: 'name' },
  { value: 'lastname_firstinitial_room', label: 'Surname + Initial + Room', desc: 'smithj101', example: 'smithj101', category: 'name' },
  { value: 'lastname_random', label: 'Last Name + Random', desc: 'smith_a3f2', example: 'smith_a3f2', category: 'name' },
  { value: 'mobile', label: 'Mobile Number', desc: '9876543210', example: '9876543210', category: 'contact' },
  { value: 'last4_mobile', label: 'Last 4 Digits of Mobile', desc: '5432', example: '5432', category: 'contact' },
  { value: 'mobile_random', label: 'Last 4 Mobile + Random', desc: '5432_a3f2', example: '5432_a3f2', category: 'contact' },
  { value: 'email_prefix', label: 'Email Prefix', desc: 'john.doe', example: 'john.doe', category: 'contact' },
  { value: 'booking_id', label: 'Booking ID', desc: 'bk-x7k9m2', example: 'bk_x7k9m2p3', category: 'system' },
  { value: 'custom_prefix', label: 'Custom Prefix + Random', desc: 'hotel_a3f2', example: 'hotel_a3f2', category: 'system' },
  { value: 'passport', label: 'Passport / ID Number', desc: 'AB1234567', example: 'ab1234567', category: 'document' },
];

const PASSWORD_FORMATS = [
  { value: 'random_alphanumeric', label: 'Random Alphanumeric', desc: '8 random letters & numbers', example: 'Gx7nPq2k', category: 'random' },
  { value: 'random_numeric', label: 'Random PIN (OTP)', desc: 'Random digits, easy to type', example: '847293', category: 'random' },
  { value: 'room_number', label: 'Room Number', desc: 'Room as password', example: '101', category: 'room' },
  { value: 'last4_mobile', label: 'Last 4 of Mobile', desc: 'Last 4 phone digits', example: '5432', category: 'contact' },
  { value: 'lastname', label: 'Last Name', desc: 'Guest surname', example: 'smith', category: 'name' },
  { value: 'lastname_room', label: 'Last Name + Room', desc: 'smith101', example: 'smith101', category: 'name' },
  { value: 'firstinitial_lastname', label: 'Initial + Last Name', desc: 'jsmith', example: 'jsmith', category: 'name' },
  { value: 'fixed', label: 'Fixed Password', desc: 'Same for all guests', example: 'welcome123', category: 'system' },
  { value: 'checkin_date', label: 'Check-in Date', desc: 'DDMMYYYY format', example: '15012024', category: 'system' },
  { value: 'passport', label: 'Passport / ID', desc: 'Passport number', example: 'ab1234567', category: 'document' },
];

const CATEGORY_LABELS: Record<string, string> = {
  room: 'Room-based',
  name: 'Name-based',
  contact: 'Contact-based',
  system: 'System-based',
  document: 'Document-based',
  random: 'Random',
};

const CATEGORY_COLORS: Record<string, string> = {
  room: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  name: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  contact: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  system: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-300',
  document: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300',
  random: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300',
};

// ─── Types ───────────────────────────────────────────────────────────

export interface CredentialConfig {
  usernameFormat: string;
  usernamePrefix?: string | null;
  usernameCase: string;
  usernameMinLength: number;
  usernameMaxLength: number;
  passwordFormat: string;
  passwordFixedValue?: string | null;
  passwordLength: number;
  passwordIncludeUppercase: boolean;
  passwordIncludeNumbers: boolean;
  passwordIncludeSymbols: boolean;
  credentialSeparator: string;
  credentialPrintOnVoucher: boolean;
  credentialShowInPortal: boolean;
  duplicateUsernameAction: string;
}

interface CredentialPolicyTabProps {
  config: CredentialConfig;
  onChange: (config: CredentialConfig) => void;
  saving?: boolean;
  onSave?: () => void;
}

// ─── Simple client-side preview generator ────────────────────────────

function simplePreview(format: string, prefix?: string, separator?: string, length?: number): string {
  const sep = (separator === 'none' ? '' : separator) || '_';
  const guest = { first: 'john', last: 'smith', mobile: '9876543210', room: '101', booking: 'x7k9m2p3', passport: 'AB1234567' };
  const rand = () => Math.random().toString(36).substring(2, 6);

  switch (format) {
    case 'room_random': return `room${guest.room}${sep}${rand()}`;
    case 'room_only': return guest.room;
    case 'lastname_room': return `${guest.last}${sep}${guest.room}`;
    case 'firstinitial_lastname': return `${guest.first[0]}${guest.last}`;
    case 'firstinitial_lastname_room': return `${guest.first[0]}${guest.last}${sep}${guest.room}`;
    case 'lastname_firstinitial_room': return `${guest.last}${guest.first[0]}${sep}${guest.room}`;
    case 'lastname_random': return `${guest.last}${sep}${rand()}`;
    case 'mobile': return guest.mobile;
    case 'last4_mobile': return guest.mobile.slice(-4);
    case 'mobile_random': return `${guest.mobile.slice(-4)}${sep}${rand()}`;
    case 'email_prefix': return 'john.smith';
    case 'booking_id': return `bk${sep}${guest.booking}`;
    case 'custom_prefix': return `${prefix || 'guest'}${sep}${rand()}`;
    case 'passport': return guest.passport.toLowerCase();
    default: return `room${guest.room}${sep}${rand()}`;
  }
}

function simplePasswordPreview(format: string, fixedValue?: string, length?: number): string {
  const guest = { last: 'smith', mobile: '9876543210', room: '101', passport: 'AB1234567' };
  const rand = (n: number) => Array.from({ length: n }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[Math.floor(Math.random() * 54)]).join('');
  const randNum = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');

  switch (format) {
    case 'random_alphanumeric': return rand(length || 8);
    case 'random_numeric': return randNum(length || 6);
    case 'room_number': return guest.room;
    case 'last4_mobile': return guest.mobile.slice(-4);
    case 'lastname': return guest.last;
    case 'lastname_room': return `${guest.last}${guest.room}`;
    case 'firstinitial_lastname': return `j${guest.last}`;
    case 'fixed': return fixedValue || 'welcome';
    case 'checkin_date': return '15012024';
    case 'passport': return guest.passport;
    default: return rand(length || 8);
  }
}

// ─── Component ───────────────────────────────────────────────────────

export default function CredentialPolicyTab({ config, onChange, saving, onSave }: CredentialPolicyTabProps) {
  const { toast } = useToast();
  const [previewKey, setPreviewKey] = useState(0);

  const updateConfig = useCallback((partial: Partial<CredentialConfig>) => {
    onChange({ ...config, ...partial });
  }, [config, onChange]);

  // Computed preview
  const usernamePreview = useMemo(() =>
    simplePreview(config.usernameFormat, config.usernamePrefix, config.credentialSeparator, config.usernameMinLength),
    [config.usernameFormat, config.usernamePrefix, config.credentialSeparator, config.usernameMinLength, previewKey]
  );

  const passwordPreview = useMemo(() =>
    simplePasswordPreview(config.passwordFormat, config.passwordFixedValue, config.passwordLength),
    [config.passwordFormat, config.passwordFixedValue, config.passwordLength, previewKey]
  );

  const refreshPreview = () => setPreviewKey(prev => prev + 1);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: 'Copied', description: `${label} copied to clipboard` });
    }).catch(() => {
      toast({ title: 'Failed', description: 'Could not copy to clipboard', variant: 'destructive' });
    });
  };

  // Get selected format info
  const selectedUsernameFormat = USERNAME_FORMATS.find(f => f.value === config.usernameFormat);
  const selectedPasswordFormat = PASSWORD_FORMATS.find(f => f.value === config.passwordFormat);

  // Format requirements
  const usernameRequires = selectedUsernameFormat
    ? [
        selectedUsernameFormat.category === 'room' && 'Room number must be assigned before check-in',
        selectedUsernameFormat.category === 'name' && 'Guest first & last name required in booking',
        selectedUsernameFormat.category === 'contact' && selectedUsernameFormat.value === 'mobile' && 'Guest mobile number required',
        selectedUsernameFormat.category === 'contact' && selectedUsernameFormat.value === 'last4_mobile' && 'Guest mobile number required',
        selectedUsernameFormat.category === 'contact' && selectedUsernameFormat.value === 'email_prefix' && 'Guest email required',
        selectedUsernameFormat.category === 'document' && 'Guest passport/ID must be collected at check-in',
        selectedUsernameFormat.value === 'custom_prefix' && 'Set a custom prefix below',
      ].filter(Boolean)
    : [];

  return (
    <TooltipProvider delayDuration={300}>
      <div className="space-y-6">
        {/* Live Preview Card */}
        <Card className="border-dashed border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Live Preview
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={refreshPreview}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Regenerate
              </Button>
            </div>
            <CardDescription>
              Sample credentials for guest &quot;John Smith&quot;, Room 101, Mobile 9876543210
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Username</Label>
                <div className="flex items-center gap-2">
                  <code className="bg-muted px-3 py-2 rounded-md font-mono text-lg font-bold tracking-wide flex-1">
                    {usernamePreview}
                  </code>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(usernamePreview, 'Username')}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">Password</Label>
                <div className="flex items-center gap-2">
                  <code className="bg-muted px-3 py-2 rounded-md font-mono text-lg font-bold tracking-wide flex-1">
                    {passwordPreview}
                  </code>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(passwordPreview, 'Password')}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Username Format */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Username Format
            </CardTitle>
            <CardDescription>
              Choose how the WiFi username is generated for each guest during check-in
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Format Selector */}
            <div className="space-y-2">
              <Label>Username Pattern</Label>
              <Select
                value={config.usernameFormat}
                onValueChange={(value) => updateConfig({ usernameFormat: value })}
              >
                <SelectTrigger className="w-full max-w-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(
                    USERNAME_FORMATS.reduce<Record<string, typeof USERNAME_FORMATS>>((acc, fmt) => {
                      if (!acc[fmt.category]) acc[fmt.category] = [];
                      acc[fmt.category].push(fmt);
                      return acc;
                    }, {})
                  ).map(([category, formats]) => (
                    <div key={category}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {CATEGORY_LABELS[category] || category}
                      </div>
                      {formats.map((fmt) => (
                        <SelectItem key={fmt.value} value={fmt.value} className="py-2">
                          <div className="flex items-center gap-3">
                            <span className="font-medium">{fmt.label}</span>
                            <code className="text-xs text-muted-foreground">{fmt.example}</code>
                          </div>
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selected format description */}
            {selectedUsernameFormat && (
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Badge variant="outline" className={CATEGORY_COLORS[selectedUsernameFormat.category]}>
                  {CATEGORY_LABELS[selectedUsernameFormat.category]}
                </Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">{selectedUsernameFormat.desc}</p>
                  <p className="text-xs text-muted-foreground">Example: <code>{selectedUsernameFormat.example}</code></p>
                </div>
              </div>
            )}

            {/* Requirements warnings */}
            {usernameRequires.length > 0 && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">Requirements</p>
                  <ul className="mt-1 space-y-0.5 text-amber-700 dark:text-amber-300">
                    {usernameRequires.map((req, i) => (
                      <li key={i}>• {req}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Custom prefix (only for custom_prefix format) */}
            {config.usernameFormat === 'custom_prefix' && (
              <div className="space-y-2">
                <Label>Custom Prefix</Label>
                <Input
                  value={config.usernamePrefix || ''}
                  onChange={(e) => updateConfig({ usernamePrefix: e.target.value })}
                  placeholder="e.g., hotel, resort, wifi"
                  className="w-64"
                />
                <p className="text-xs text-muted-foreground">
                  This prefix will be combined with a random suffix
                </p>
              </div>
            )}

            <Separator />

            {/* Username Options */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Case</Label>
                <Select
                  value={config.usernameCase}
                  onValueChange={(value) => updateConfig({ usernameCase: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lowercase">lowercase (jsmith101)</SelectItem>
                    <SelectItem value="uppercase">UPPERCASE (JSMITH101)</SelectItem>
                    <SelectItem value="as_is">As Typed (jSmith101)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Min Length</Label>
                <Input
                  type="number"
                  min={2}
                  max={32}
                  value={config.usernameMinLength}
                  onChange={(e) => updateConfig({ usernameMinLength: parseInt(e.target.value) || 4 })}
                  className="w-24"
                />
                <p className="text-xs text-muted-foreground">Padded with random chars if shorter</p>
              </div>
              <div className="space-y-2">
                <Label>Max Length</Label>
                <Input
                  type="number"
                  min={4}
                  max={64}
                  value={config.usernameMaxLength}
                  onChange={(e) => updateConfig({ usernameMaxLength: parseInt(e.target.value) || 32 })}
                  className="w-24"
                />
                <p className="text-xs text-muted-foreground">Truncated if longer</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Password Format */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Password Format
            </CardTitle>
            <CardDescription>
              Choose how the WiFi password is generated. Consider security vs. ease of use.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Format Selector */}
            <div className="space-y-2">
              <Label>Password Pattern</Label>
              <Select
                value={config.passwordFormat}
                onValueChange={(value) => updateConfig({ passwordFormat: value })}
              >
                <SelectTrigger className="w-full max-w-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(
                    PASSWORD_FORMATS.reduce<Record<string, typeof PASSWORD_FORMATS>>((acc, fmt) => {
                      if (!acc[fmt.category]) acc[fmt.category] = [];
                      acc[fmt.category].push(fmt);
                      return acc;
                    }, {})
                  ).map(([category, formats]) => (
                    <div key={category}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {CATEGORY_LABELS[category] || category}
                      </div>
                      {formats.map((fmt) => (
                        <SelectItem key={fmt.value} value={fmt.value} className="py-2">
                          <div className="flex items-center gap-3">
                            <span className="font-medium">{fmt.label}</span>
                            <code className="text-xs text-muted-foreground">{fmt.example}</code>
                          </div>
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Selected format description */}
            {selectedPasswordFormat && (
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Badge variant="outline" className={CATEGORY_COLORS[selectedPasswordFormat.category]}>
                  {CATEGORY_LABELS[selectedPasswordFormat.category]}
                </Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">{selectedPasswordFormat.desc}</p>
                  <p className="text-xs text-muted-foreground">Example: <code>{selectedPasswordFormat.example}</code></p>
                </div>
              </div>
            )}

            {/* Security warning for weak passwords */}
            {['room_number', 'lastname', 'lastname_room', 'fixed'].includes(config.passwordFormat) && (
              <div className="flex items-start gap-2 p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-rose-800 dark:text-rose-200">Low Security</p>
                  <p className="text-rose-700 dark:text-rose-300">
                    This password format is easily guessable. Consider using random formats for better security.
                  </p>
                </div>
              </div>
            )}

            {/* Fixed password input */}
            {config.passwordFormat === 'fixed' && (
              <div className="space-y-2">
                <Label>Fixed Password Value</Label>
                <Input
                  value={config.passwordFixedValue || ''}
                  onChange={(e) => updateConfig({ passwordFixedValue: e.target.value })}
                  placeholder="e.g., welcome, hotel2024"
                  className="w-64"
                />
                <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Warning: Same password for all guests. Use only for open/public networks.
                </p>
              </div>
            )}

            {/* Random password options */}
            {['random_alphanumeric', 'random_numeric'].includes(config.passwordFormat) && (
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  Random Generation Options
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Password Length</Label>
                    <Input
                      type="number"
                      min={4}
                      max={32}
                      value={config.passwordLength}
                      onChange={(e) => updateConfig({ passwordLength: parseInt(e.target.value) || 8 })}
                      className="w-24"
                    />
                  </div>
                </div>
                {config.passwordFormat === 'random_alphanumeric' && (
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={config.passwordIncludeUppercase}
                        onCheckedChange={(checked) => updateConfig({ passwordIncludeUppercase: checked })}
                        id="pw-upper"
                      />
                      <Label htmlFor="pw-upper" className="text-sm">Uppercase (A-Z)</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={config.passwordIncludeNumbers}
                        onCheckedChange={(checked) => updateConfig({ passwordIncludeNumbers: checked })}
                        id="pw-numbers"
                      />
                      <Label htmlFor="pw-numbers" className="text-sm">Numbers (2-9)</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={config.passwordIncludeSymbols}
                        onCheckedChange={(checked) => updateConfig({ passwordIncludeSymbols: checked })}
                        id="pw-symbols"
                      />
                      <Label htmlFor="pw-symbols" className="text-sm">Symbols (@#$%&)</Label>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="h-3 w-3 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          Symbols may cause issues on some captive portal login pages
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Advanced Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Advanced Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Separator</Label>
                <Select
                  value={config.credentialSeparator}
                  onValueChange={(value) => updateConfig({ credentialSeparator: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_">Underscore _ (room101_a3f2)</SelectItem>
                    <SelectItem value="-">Hyphen - (room101-a3f2)</SelectItem>
                    <SelectItem value=".">Dot . (room101.a3f2)</SelectItem>
                    <SelectItem value="none">None (room101a3f2)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Character between parts of username/password
                </p>
              </div>

              <div className="space-y-2">
                <Label>Duplicate Username</Label>
                <Select
                  value={config.duplicateUsernameAction}
                  onValueChange={(value) => updateConfig({ duplicateUsernameAction: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="append_random">Append Random</SelectItem>
                    <SelectItem value="reject">Reject (Error)</SelectItem>
                    <SelectItem value="overwrite">Overwrite Old</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  What to do if username already exists
                </p>
              </div>
            </div>

            <Separator />

            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.credentialPrintOnVoucher}
                  onCheckedChange={(checked) => updateConfig({ credentialPrintOnVoucher: checked })}
                  id="print-voucher"
                />
                <Label htmlFor="print-voucher" className="text-sm">Show on printed voucher</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.credentialShowInPortal}
                  onCheckedChange={(checked) => updateConfig({ credentialShowInPortal: checked })}
                  id="show-portal"
                />
                <Label htmlFor="show-portal" className="text-sm">Show in captive portal</Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex items-center gap-3">
          {onSave && (
            <Button onClick={onSave} disabled={saving}>
              {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Save Credential Policy
            </Button>
          )}
          <p className="text-xs text-muted-foreground">
            Changes apply to new credentials only. Existing users keep their current username/password.
          </p>
        </div>
      </div>
    </TooltipProvider>
  );
}
