'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// Captive Portal — Powerful Portal Designer with Templates, Layouts & Live Preview
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Palette,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Eye,
  Settings,
  Lock,
  Unlock,
  Smartphone,
  Ticket,
  Building,
  User,
  Zap,
  Monitor,
  CheckCircle2,
  XCircle,
  Save,
  RotateCcw,
  AlertTriangle,
  Printer,
  QrCode,
  UserRound,
  Wifi,
  Mail,
  Calendar,
  Clock,
  ScanLine,
  Layout,
  Type,
  Image,
  FormInput,
  Sparkles,
  Tablet,
  Star,
  MapPin,
  Phone,
  Globe,
  Instagram,
  Facebook,
  Twitter,
  Coffee,
  Waves,
  Dumbbell,
  UtensilsCrossed,
  Car,
  ArrowRight,
  Layers,
  Wand2,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { usePropertyId } from '@/hooks/use-property';
import dynamic from 'next/dynamic';

const PrintCard = dynamic(() => import('@/components/wifi/print-card').then(m => ({ default: m.PrintCard as any })), { ssr: false });
const PortalWhitelist = dynamic(() => import('@/components/wifi/portal-whitelist'), { ssr: false });

// ═══════════════════════════════════════════════════════════════════════════════
// Static Config — Credential Format Mapping
// ═══════════════════════════════════════════════════════════════════════════════

type CredentialCategory = 'room' | 'name' | 'contact' | 'email' | 'document' | 'booking' | 'custom';

const CREDENTIAL_FORMAT_MAP: Record<string, CredentialCategory> = {
  room_random: 'room', room_only: 'room', lastname_room: 'room',
  firstinitial_lastname_room: 'room', lastname_firstinitial_room: 'room',
  firstinitial_lastname: 'name', lastname_random: 'name',
  mobile: 'contact', last4_mobile: 'contact', mobile_random: 'contact',
  email_prefix: 'email', passport: 'document', booking_id: 'booking', custom_prefix: 'custom',
};

interface AutoFields {
  firstName: boolean; lastName: boolean; roomNumber: boolean;
  phone: boolean; email: boolean; passport: boolean; bookingId: boolean;
  username: boolean; password: boolean; terms: boolean;
}

function getAutoFields(category: CredentialCategory): AutoFields {
  const base: AutoFields = { firstName: false, lastName: false, roomNumber: false, phone: false, email: false, passport: false, bookingId: false, username: true, password: true, terms: true };
  switch (category) {
    case 'room': return { ...base, roomNumber: true };
    case 'name': return { ...base, firstName: true, lastName: true };
    case 'contact': return { ...base, phone: true };
    case 'email': return { ...base, email: true };
    case 'document': return { ...base, passport: true };
    case 'booking': return { ...base, bookingId: true };
    default: return base;
  }
}

const CREDENTIAL_CATEGORY_LABELS: Record<CredentialCategory, string> = {
  room: 'Room-Based', name: 'Name-Based', contact: 'Contact-Based',
  email: 'Email-Based', document: 'Document-Based', booking: 'Booking-Based', custom: 'Custom',
};

// ═══════════════════════════════════════════════════════════════════════════════
// Template System — 8 Pre-Built Hotel Themes
// ═══════════════════════════════════════════════════════════════════════════════

interface DesignSettings {
  layoutType: 'centered' | 'split_left' | 'split_right' | 'card' | 'full_bleed';
  backgroundType: 'solid' | 'gradient' | 'image';
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
  backgroundOverlay: number;
  fontFamily: string;
  headingFontFamily: string;
  formStyle: 'rounded' | 'square' | 'glass' | 'pill' | 'minimal';
  inputStyle: 'rounded' | 'square' | 'pill' | 'underline';
  buttonStyle: 'filled' | 'outlined' | 'gradient' | 'pill' | 'rounded';
  buttonSize: 'small' | 'medium' | 'large';
  cardShadow: 'none' | 'small' | 'medium' | 'large';
  animationType: 'none' | 'fade' | 'slide_up' | 'zoom';
  welcomeMessage: string;
  hotelName: string;
  hotelAddress: string;
  hotelPhone: string;
  hotelWebsite: string;
  showHotelInfo: boolean;
  amenities: string[];
  showAmenities: boolean;
  showSocialMedia: boolean;
  socialLinks: Array<{ platform: string; url: string }>;
  showClock: boolean;
  showWeather: boolean;
  promotionTitle: string;
  promotionDesc: string;
  showPromotion: boolean;
}

const DEFAULT_SETTINGS: DesignSettings = {
  layoutType: 'centered', backgroundType: 'solid',
  gradientFrom: '#0f766e', gradientTo: '#134e4a', gradientAngle: 135,
  backgroundOverlay: 40, fontFamily: 'Inter', headingFontFamily: 'Inter',
  formStyle: 'rounded', inputStyle: 'rounded', buttonStyle: 'filled',
  buttonSize: 'medium', cardShadow: 'medium', animationType: 'fade',
  welcomeMessage: 'Enjoy your stay with us',
  hotelName: 'StaySuite Hotel', hotelAddress: '123 Hospitality Ave', hotelPhone: '+1-555-0100', hotelWebsite: 'www.staysuite.com',
  showHotelInfo: false,
  amenities: ['Free WiFi', 'Swimming Pool', 'Spa & Wellness', 'Restaurant', 'Fitness Center', 'Room Service'],
  showAmenities: false, showSocialMedia: false,
  socialLinks: [{ platform: 'instagram', url: '' }, { platform: 'facebook', url: '' }, { platform: 'twitter', url: '' }],
  showClock: false, showWeather: false,
  promotionTitle: 'Special Offer', promotionDesc: 'Book 3 nights, get the 4th free!', showPromotion: false,
};

interface PortalTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  design: Partial<DesignSettings>;
  colors: { bg: string; text: string; accent: string; gradientFrom?: string; gradientTo?: string };
  preview: string; // CSS gradient for thumbnail
}

const PORTAL_TEMPLATES: PortalTemplate[] = [
  {
    id: 'luxury', name: 'Luxury Hotel', category: 'Premium', description: 'Dark elegance with gold accents and serif typography',
    design: { layoutType: 'split_left', backgroundType: 'solid', fontFamily: 'Inter', headingFontFamily: 'Playfair Display', formStyle: 'glass', inputStyle: 'underline', buttonStyle: 'pill', buttonSize: 'large', cardShadow: 'large', animationType: 'fade' },
    colors: { bg: '#1a1a2e', text: '#f5f5f5', accent: '#d4af37', gradientFrom: '#1a1a2e', gradientTo: '#16213e' },
    preview: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
  },
  {
    id: 'resort', name: 'Modern Resort', category: 'Premium', description: 'Vibrant tropical gradients with rounded playful elements',
    design: { layoutType: 'centered', backgroundType: 'gradient', gradientFrom: '#0ea5e9', gradientTo: '#8b5cf6', gradientAngle: 135, fontFamily: 'Poppins', headingFontFamily: 'Poppins', formStyle: 'pill', inputStyle: 'pill', buttonStyle: 'pill', buttonSize: 'large', cardShadow: 'large', animationType: 'zoom' },
    colors: { bg: '#0ea5e9', text: '#ffffff', accent: '#8b5cf6', gradientFrom: '#0ea5e9', gradientTo: '#8b5cf6' },
    preview: 'linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)',
  },
  {
    id: 'business', name: 'Business Hotel', category: 'Corporate', description: 'Clean, professional look with sharp lines',
    design: { layoutType: 'card', backgroundType: 'solid', fontFamily: 'Inter', headingFontFamily: 'Inter', formStyle: 'square', inputStyle: 'rounded', buttonStyle: 'rounded', buttonSize: 'medium', cardShadow: 'medium', animationType: 'fade' },
    colors: { bg: '#f8fafc', text: '#1e293b', accent: '#2563eb', gradientFrom: '#f8fafc', gradientTo: '#e2e8f0' },
    preview: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
  },
  {
    id: 'boutique', name: 'Boutique Hotel', category: 'Lifestyle', description: 'Warm earth tones with artistic, unique personality',
    design: { layoutType: 'split_right', backgroundType: 'gradient', gradientFrom: '#92400e', gradientTo: '#78350f', gradientAngle: 160, fontFamily: 'Lato', headingFontFamily: 'Merriweather', formStyle: 'rounded', inputStyle: 'rounded', buttonStyle: 'filled', buttonSize: 'medium', cardShadow: 'large', animationType: 'slide_up' },
    colors: { bg: '#92400e', text: '#fef3c7', accent: '#f59e0b', gradientFrom: '#92400e', gradientTo: '#78350f' },
    preview: 'linear-gradient(135deg, #92400e 0%, #78350f 100%)',
  },
  {
    id: 'beach', name: 'Beach Resort', category: 'Lifestyle', description: 'Ocean-inspired blues with sandy warm accents',
    design: { layoutType: 'full_bleed', backgroundType: 'gradient', gradientFrom: '#0369a1', gradientTo: '#065f46', gradientAngle: 180, fontFamily: 'Open Sans', headingFontFamily: 'Montserrat', formStyle: 'glass', inputStyle: 'rounded', buttonStyle: 'pill', buttonSize: 'large', cardShadow: 'none', animationType: 'fade' },
    colors: { bg: '#0369a1', text: '#ffffff', accent: '#22d3ee', gradientFrom: '#0369a1', gradientTo: '#065f46' },
    preview: 'linear-gradient(180deg, #0369a1 0%, #065f46 100%)',
  },
  {
    id: 'mountain', name: 'Mountain Lodge', category: 'Lifestyle', description: 'Forest greens with cozy warm wood tones',
    design: { layoutType: 'card', backgroundType: 'gradient', gradientFrom: '#14532d', gradientTo: '#1c1917', gradientAngle: 150, fontFamily: 'Lato', headingFontFamily: 'Merriweather', formStyle: 'rounded', inputStyle: 'rounded', buttonStyle: 'rounded', buttonSize: 'medium', cardShadow: 'large', animationType: 'fade' },
    colors: { bg: '#14532d', text: '#fefce8', accent: '#a3e635', gradientFrom: '#14532d', gradientTo: '#1c1917' },
    preview: 'linear-gradient(150deg, #14532d 0%, #1c1917 100%)',
  },
  {
    id: 'urban', name: 'City Hotel', category: 'Modern', description: 'Sleek dark theme with neon accent highlights',
    design: { layoutType: 'centered', backgroundType: 'solid', fontFamily: 'Inter', headingFontFamily: 'Inter', formStyle: 'minimal', inputStyle: 'underline', buttonStyle: 'filled', buttonSize: 'medium', cardShadow: 'none', animationType: 'slide_up' },
    colors: { bg: '#09090b', text: '#fafafa', accent: '#06b6d4', gradientFrom: '#09090b', gradientTo: '#18181b' },
    preview: 'linear-gradient(135deg, #09090b 0%, #18181b 100%)',
  },
  {
    id: 'minimal', name: 'Clean Minimal', category: 'Modern', description: 'Ultra-clean white design with subtle teal accents',
    design: { layoutType: 'centered', backgroundType: 'solid', fontFamily: 'Inter', headingFontFamily: 'Inter', formStyle: 'rounded', inputStyle: 'rounded', buttonStyle: 'filled', buttonSize: 'medium', cardShadow: 'small', animationType: 'none' },
    colors: { bg: '#ffffff', text: '#18181b', accent: '#0d9488', gradientFrom: '#ffffff', gradientTo: '#f0fdfa' },
    preview: 'linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%)',
  },
];

// ── Layout Options ────────────────────────────────────────────────────────────

const LAYOUT_OPTIONS = [
  { value: 'centered' as const, label: 'Centered', desc: 'Form centered on background' },
  { value: 'split_left' as const, label: 'Split Left', desc: 'Image left, form right' },
  { value: 'split_right' as const, label: 'Split Right', desc: 'Form left, image right' },
  { value: 'card' as const, label: 'Floating Card', desc: 'Card floating over background' },
  { value: 'full_bleed' as const, label: 'Full Bleed', desc: 'Full-screen image with overlay' },
];

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter', style: 'font-sans' },
  { value: 'Poppins', label: 'Poppins', style: 'font-sans' },
  { value: 'Montserrat', label: 'Montserrat', style: 'font-sans' },
  { value: 'Open Sans', label: 'Open Sans', style: 'font-sans' },
  { value: 'Lato', label: 'Lato', style: 'font-sans' },
  { value: 'Roboto', label: 'Roboto', style: 'font-sans' },
  { value: 'Playfair Display', label: 'Playfair Display', style: 'font-serif' },
  { value: 'Merriweather', label: 'Merriweather', style: 'font-serif' },
];

const FORM_STYLES = [
  { value: 'rounded' as const, label: 'Rounded' },
  { value: 'square' as const, label: 'Square' },
  { value: 'glass' as const, label: 'Glass' },
  { value: 'pill' as const, label: 'Pill' },
  { value: 'minimal' as const, label: 'Minimal' },
];

const INPUT_STYLES = [
  { value: 'rounded' as const, label: 'Rounded' },
  { value: 'square' as const, label: 'Square' },
  { value: 'pill' as const, label: 'Pill' },
  { value: 'underline' as const, label: 'Underline' },
];

const BUTTON_STYLES = [
  { value: 'filled' as const, label: 'Filled' },
  { value: 'outlined' as const, label: 'Outlined' },
  { value: 'gradient' as const, label: 'Gradient' },
  { value: 'pill' as const, label: 'Pill' },
  { value: 'rounded' as const, label: 'Rounded' },
];

const AMENITY_ICONS: Record<string, typeof Wifi> = {
  'Free WiFi': Wifi, 'Swimming Pool': Waves, 'Spa & Wellness': Sparkles,
  'Restaurant': UtensilsCrossed, 'Fitness Center': Dumbbell, 'Room Service': Coffee,
  'Parking': Car, 'Concierge': Star,
};

// ── Tab Definitions ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'portals', label: 'Portal Instances', icon: Monitor },
  { id: 'designer', label: 'Portal Designer', icon: Palette },
  { id: 'vouchers', label: 'Voucher Designer', icon: Ticket },
  { id: 'print-cards', label: 'Print Cards', icon: Printer },
  { id: 'whitelist', label: 'Walled Garden', icon: ShieldCheck },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ── Designer Sub-Tab Definitions ──────────────────────────────────────────────

const DESIGNER_SUBTABS = [
  { id: 'templates', label: 'Templates', icon: Sparkles },
  { id: 'layout', label: 'Layout', icon: Layout },
  { id: 'background', label: 'Background', icon: Image },
  { id: 'typography', label: 'Typography', icon: Type },
  { id: 'formstyle', label: 'Form & Button', icon: FormInput },
  { id: 'content', label: 'Content', icon: Layers },
  { id: 'fields', label: 'Fields', icon: Settings },
  { id: 'advanced', label: 'Advanced', icon: Wand2 },
] as const;

type DesignerSubTab = (typeof DESIGNER_SUBTABS)[number]['id'];

// ── Auth Flow Options ─────────────────────────────────────────────────────────

const AUTH_FLOW_OPTIONS = [
  { value: 'pms_credentials', label: 'PMS Credentials', icon: User, color: 'text-teal-500 dark:text-teal-400' },
  { value: 'room_number', label: 'Room Number', icon: Building, color: 'text-emerald-500 dark:text-emerald-400' },
  { value: 'voucher', label: 'Voucher', icon: Ticket, color: 'text-amber-500 dark:text-amber-400' },
  { value: 'sms_otp', label: 'SMS OTP', icon: Smartphone, color: 'text-rose-500 dark:text-rose-400' },
  { value: 'open_access', label: 'Open Access', icon: Unlock, color: 'text-gray-500' },
] as const;

const VOUCHER_TEMPLATES = [
  { value: 'default', label: 'Default', desc: 'Clean white card with teal accent' },
  { value: 'elegant', label: 'Elegant', desc: 'Subtle gradients with refined borders' },
  { value: 'minimal', label: 'Minimal', desc: 'Ultra-clean with minimal elements' },
  { value: 'luxury', label: 'Luxury', desc: 'Dark background with gold accents' },
] as const;

const FIELD_DEFINITIONS: Array<{ key: keyof AutoFields; label: string; icon: typeof User; group: string }> = [
  { key: 'firstName', label: 'First Name', icon: User, group: 'Guest Identity' },
  { key: 'lastName', label: 'Last Name', icon: User, group: 'Guest Identity' },
  { key: 'roomNumber', label: 'Room Number', icon: Building, group: 'Guest Identity' },
  { key: 'phone', label: 'Phone Number', icon: Smartphone, group: 'Guest Identity' },
  { key: 'email', label: 'Email Address', icon: Mail, group: 'Guest Identity' },
  { key: 'passport', label: 'Passport / ID', icon: ScanLine, group: 'Guest Identity' },
  { key: 'bookingId', label: 'Booking ID', icon: Calendar, group: 'Guest Identity' },
  { key: 'username', label: 'Username', icon: User, group: 'Credentials' },
  { key: 'password', label: 'Password', icon: Lock, group: 'Credentials' },
  { key: 'terms', label: 'Terms & Conditions', icon: Settings, group: 'Legal' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// API Helpers
// ═══════════════════════════════════════════════════════════════════════════════

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
    const result = await res.json();
    if (result.success) return result.data as T;
    return null;
  } catch (e) {
    console.error('API fetch error:', e);
    return null;
  }
}

async function apiMutate<T>(url: string, options?: RequestInit): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
    const result = await res.json();
    if (result.success) return { data: result.data as T, error: null };
    return { data: null, error: result.error?.message || 'Request failed' };
  } catch (e) {
    console.error('API mutate error:', e);
    return { data: null, error: (e as Error).message || 'Network error' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function PortalPage() {
  const [activeTab, setActiveTab] = useState<TabId>('portals');
  const [portalOptions, setPortalOptions] = useState<Array<{ id: string; name: string }>>([]);

  const fetchPortalOptions = useCallback(async () => {
    const data = await apiFetch<any[]>('/api/wifi/portal/instances');
    if (data) setPortalOptions(data.map((p: any) => ({ id: p.id, name: p.name })));
  }, []);

  useEffect(() => { void fetchPortalOptions(); }, [fetchPortalOptions]); // eslint-disable-line react-hooks/set-state-in-effect

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Captive Portal</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Design stunning guest login experiences, manage portal instances, and print WiFi vouchers
        </p>
      </div>
      <div className="border-b border-border">
        <ScrollArea className="w-full">
          <div className="flex gap-1 min-w-max px-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-150 whitespace-nowrap',
                    isActive ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  )}>
                  <Icon className="h-4 w-4" />{tab.label}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
      <div className="mt-4">
        {activeTab === 'portals' && <PortalListTab onPortalsChanged={fetchPortalOptions} />}
        {activeTab === 'designer' && <PortalDesignerTab portalOptions={portalOptions} />}
        {activeTab === 'vouchers' && <VoucherDesignerTab portalOptions={portalOptions} />}
        {activeTab === 'print-cards' && <PrintCardsTab />}
        {activeTab === 'whitelist' && <WhitelistTab />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 1: Portal Zones (Zone-Based Routing with Seamless Roaming)
// ═══════════════════════════════════════════════════════════════════════════════

interface PortalZone {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  authMethod: string;
  roamingMode: string;
  allowsRoamingFrom: string[];
  maxBandwidthDown: number;
  maxBandwidthUp: number;
  bandwidthPolicy: string;
  nasIdentifier: string;
  ssidList: string[];
  sessionTimeout: number;
  idleTimeout: number;
  maxConcurrent: number;
  _count: { portalMappings: number; authMethods: number; portalPages: number };
}

const EMPTY_ZONE = {
  name: '', slug: '', authMethod: 'voucher', roamingMode: 'auth_origin',
  allowsRoamingFrom: [] as string[], maxBandwidthDown: 5, maxBandwidthUp: 1,
  bandwidthPolicy: 'zone', nasIdentifier: '', ssidList: [] as string[],
  maxConcurrent: 200, sessionTimeout: 1440, idleTimeout: 30,
};

const AUTH_METHODS = [
  { value: 'voucher', label: 'Voucher Code', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  { value: 'room_number', label: 'Room Number', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  { value: 'pms_credentials', label: 'PMS Credentials', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' },
  { value: 'sms_otp', label: 'SMS OTP', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
  { value: 'open_access', label: 'Open Access', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  { value: 'social', label: 'Social Login', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  { value: 'mac_auth', label: 'MAC Auth', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
];

const ROAMING_MODES = [
  { value: 'auth_origin', label: 'Auth Origin', desc: 'Primary auth zone — guests start here', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  { value: 'seamless', label: 'Seamless', desc: 'Inherit sessions from allowed zones', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  { value: 'reauth', label: 'Re-Auth', desc: 'Must authenticate independently', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/30' },
];

function RoamingBadge({ mode }: { mode: string }) {
  const m = ROAMING_MODES.find(r => r.value === mode) || ROAMING_MODES[0];
  return <Badge variant="outline" className={cn('text-[10px] font-semibold gap-1', m.bg, m.color)}>{mode === 'auth_origin' ? '🔑' : mode === 'seamless' ? '🔗' : '🔒'} {m.label}</Badge>;
}

// ── Zone Form Content (shared between add/edit) ──────────────────────────────────
// Receives form state via props to avoid re-renders from component creation during render

function ZoneFormContent({ form, setForm, zones, editZone, ssidInput, setSsidInput }: {
  form: typeof EMPTY_ZONE; setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_ZONE>>;
  zones: PortalZone[]; editZone: PortalZone | null;
  ssidInput: string; setSsidInput: React.Dispatch<React.SetStateAction<string>>;
}) {
  const addSsid = () => {
    const s = ssidInput.trim();
    if (s && !form.ssidList.includes(s)) { setForm(f => ({ ...f, ssidList: [...f.ssidList, s] })); setSsidInput(''); }
  };
  const removeSsid = (s: string) => setForm(f => ({ ...f, ssidList: f.ssidList.filter(x => x !== s) }));
  const toggleRoamingFrom = (slug: string) => {
    setForm(f => ({ ...f, allowsRoamingFrom: f.allowsRoamingFrom.includes(slug) ? f.allowsRoamingFrom.filter(s => s !== slug) : [...f.allowsRoamingFrom, slug] }));
  };

  return (
    <div className="grid gap-4 py-4 pr-4">
      <div className="space-y-2"><Label>Zone Name *</Label><Input placeholder="Lobby WiFi" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
      <div className="space-y-2">
        <Label>URL Slug *</Label>
        <Input placeholder="lobby" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.replace(/[^a-z0-9_-]/gi, '').toLowerCase() }))} className="font-mono" />
        <p className="text-[10px] text-muted-foreground">Portal URL: connect.hotel.com/<span className="font-mono text-foreground">{form.slug || '...'}</span></p>
      </div>
      <Separator />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Auth Method</Label>
          <Select value={form.authMethod} onValueChange={v => setForm(f => ({ ...f, authMethod: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{AUTH_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Roaming Mode</Label>
          <Select value={form.roamingMode} onValueChange={v => setForm(f => ({ ...f, roamingMode: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ROAMING_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
          {form.roamingMode === 'seamless' && <p className="text-[10px] text-muted-foreground">Allow sessions from other zones to roam in</p>}
        </div>
      </div>
      {form.roamingMode === 'seamless' && (
        <div className="space-y-2">
          <Label>Allow Roaming From</Label>
          <p className="text-[10px] text-muted-foreground">Select which zones can seamlessly roam into this zone</p>
          <div className="flex flex-wrap gap-2">
            {zones.filter(z => z.roamingMode === 'auth_origin' && z.id !== editZone?.id).map(z => (
              <button key={z.id} onClick={() => toggleRoamingFrom(z.slug)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  form.allowsRoamingFrom.includes(z.slug) ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-300' : 'border-border text-muted-foreground hover:bg-muted'
                )}>
                {form.allowsRoamingFrom.includes(z.slug) && '✓ '}{z.name} (/{z.slug})
              </button>
            ))}
            {zones.filter(z => z.roamingMode === 'auth_origin' && z.id !== editZone?.id).length === 0 && (
              <p className="text-xs text-muted-foreground italic">No auth_origin zones available</p>
            )}
          </div>
        </div>
      )}
      <div className="space-y-2">
        <Label>Bandwidth Limits (Mbps)</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><p className="text-[10px] text-muted-foreground">Download</p><Input type="number" value={form.maxBandwidthDown} onChange={e => setForm(f => ({ ...f, maxBandwidthDown: parseInt(e.target.value) || 5 }))} /></div>
          <div className="space-y-1"><p className="text-[10px] text-muted-foreground">Upload</p><Input type="number" value={form.maxBandwidthUp} onChange={e => setForm(f => ({ ...f, maxBandwidthUp: parseInt(e.target.value) || 1 }))} /></div>
        </div>
        {form.roamingMode === 'seamless' && (
          <div className="space-y-1 mt-2">
            <Label className="text-xs">Roaming Bandwidth Policy</Label>
            <Select value={form.bandwidthPolicy} onValueChange={v => setForm(f => ({ ...f, bandwidthPolicy: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="zone">Use this zone&apos;s limits</SelectItem>
                <SelectItem value="origin">Keep origin zone limits</SelectItem>
                <SelectItem value="minimum">Use minimum of both</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <Separator />
      <div className="space-y-2">
        <Label>SSIDs</Label>
        <p className="text-[10px] text-muted-foreground">WiFi network names that map to this zone</p>
        <div className="flex gap-2">
          <Input placeholder="Hotel_Guest" value={ssidInput} onChange={e => setSsidInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSsid())} />
          <Button type="button" variant="outline" size="sm" onClick={addSsid}><Plus className="h-3.5 w-3.5" /></Button>
        </div>
        {form.ssidList.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {form.ssidList.map(s => (
              <Badge key={s} variant="secondary" className="gap-1 text-xs">
                <Wifi className="h-3 w-3" />{s}
                <button onClick={() => removeSsid(s)} className="ml-0.5 hover:text-destructive"><XCircle className="h-3 w-3" /></button>
              </Badge>
            ))}
          </div>
        )}
      </div>
      {form.roamingMode === 'auth_origin' && (
        <div className="space-y-2">
          <Label>NAS Identifier (optional)</Label>
          <Input placeholder="staysuite-lobby-v10" value={form.nasIdentifier} onChange={e => setForm(f => ({ ...f, nasIdentifier: e.target.value }))} className="font-mono" />
          <p className="text-[10px] text-muted-foreground">Auto-filled if blank: staysuite-{form.slug}-v&lt;vlan&gt;</p>
        </div>
      )}
      <Separator />
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2"><Label>Max Concurrent</Label><Input type="number" value={form.maxConcurrent} onChange={e => setForm(f => ({ ...f, maxConcurrent: parseInt(e.target.value) || 200 }))} /></div>
        <div className="space-y-2"><Label>Session (min)</Label><Input type="number" value={form.sessionTimeout} onChange={e => setForm(f => ({ ...f, sessionTimeout: parseInt(e.target.value) || 1440 }))} /></div>
        <div className="space-y-2"><Label>Idle (min)</Label><Input type="number" value={form.idleTimeout} onChange={e => setForm(f => ({ ...f, idleTimeout: parseInt(e.target.value) || 30 }))} /></div>
      </div>
    </div>
  );
}

function PortalListTab({ onPortalsChanged }: { onPortalsChanged?: () => void }) {
  const [zones, setZones] = useState<PortalZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editZone, setEditZone] = useState<PortalZone | null>(null);
  const [form, setForm] = useState({ ...EMPTY_ZONE });
  const [ssidInput, setSsidInput] = useState('');
  const { toast } = useToast();
  const { propertyId } = usePropertyId();

  const fetchPortals = useCallback(async () => {
    setLoading(true);
    const data = await apiFetch<any[]>('/api/wifi/portal/instances');
    if (data) {
      setZones(data.map((p: any) => ({
        id: p.id, name: p.name, slug: p.slug || '', enabled: p.enabled ?? true,
        authMethod: p.authMethod || 'voucher', roamingMode: p.roamingMode || 'auth_origin',
        allowsRoamingFrom: JSON.parse(p.allowsRoamingFrom || '[]'),
        maxBandwidthDown: Math.round((p.maxBandwidthDown || 5242880) / 1048576),
        maxBandwidthUp: Math.round((p.maxBandwidthUp || 1048576) / 1048576),
        bandwidthPolicy: p.bandwidthPolicy || 'zone',
        nasIdentifier: p.nasIdentifier || '',
        ssidList: JSON.parse(p.ssidList || '[]'),
        sessionTimeout: Math.round((p.sessionTimeout || 86400) / 60),
        idleTimeout: Math.round((p.idleTimeout || 3600) / 60),
        maxConcurrent: p.maxConcurrent || 1000,
        _count: p._count || { portalMappings: 0, authMethods: 0, portalPages: 0 },
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPortals(); }, [fetchPortals]); // eslint-disable-line react-hooks/set-state-in-effect

  const toggleEnabled = async (id: string) => {
    const zone = zones.find(z => z.id === id);
    if (!zone) return;
    const { error } = await apiMutate(`/api/wifi/portal/instances/${id}`, { method: 'PUT', body: JSON.stringify({ enabled: !zone.enabled }) });
    if (!error) {
      setZones(prev => prev.map(z => z.id === id ? { ...z, enabled: !z.enabled } : z));
      toast({ title: 'Zone updated', description: `${zone.name} ${!zone.enabled ? 'enabled' : 'disabled'}` });
      onPortalsChanged?.();
    } else { toast({ title: 'Error', description: error, variant: 'destructive' }); }
  };

  const deleteZone = async (id: string) => {
    const { error } = await apiMutate(`/api/wifi/portal/instances/${id}`, { method: 'DELETE' });
    if (!error) { toast({ title: 'Zone deleted' }); await fetchPortals(); onPortalsChanged?.(); }
    else { toast({ title: 'Error', description: error || 'Failed', variant: 'destructive' }); }
  };

  const openAdd = () => {
    setForm({ ...EMPTY_ZONE });
    setSsidInput('');
    setAddOpen(true);
  };

  const openEdit = (zone: PortalZone) => {
    setEditZone(zone);
    setForm({
      name: zone.name, slug: zone.slug, authMethod: zone.authMethod, roamingMode: zone.roamingMode,
      allowsRoamingFrom: [...zone.allowsRoamingFrom], maxBandwidthDown: zone.maxBandwidthDown,
      maxBandwidthUp: zone.maxBandwidthUp, bandwidthPolicy: zone.bandwidthPolicy,
      nasIdentifier: zone.nasIdentifier, ssidList: [...zone.ssidList],
      maxConcurrent: zone.maxConcurrent, sessionTimeout: zone.sessionTimeout, idleTimeout: zone.idleTimeout,
    });
    setSsidInput('');
    setEditOpen(true);
  };

  const createZone = async () => {
    if (!form.name || !form.slug) return;
    const { error } = await apiMutate('/api/wifi/portal/instances', {
      method: 'POST', body: JSON.stringify({
        propertyId: propertyId || 'default', name: form.name, slug: form.slug,
        authMethod: form.authMethod, roamingMode: form.roamingMode,
        allowsRoamingFrom: JSON.stringify(form.allowsRoamingFrom),
        maxBandwidthDown: form.maxBandwidthDown * 1048576,
        maxBandwidthUp: form.maxBandwidthUp * 1048576,
        bandwidthPolicy: form.bandwidthPolicy,
        nasIdentifier: form.nasIdentifier || undefined,
        ssidList: JSON.stringify(form.ssidList),
        maxConcurrent: form.maxConcurrent,
        sessionTimeout: form.sessionTimeout * 60,
        idleTimeout: form.idleTimeout * 60,
        enabled: true,
      }),
    });
    if (!error) { toast({ title: 'Zone created', description: `${form.name} — /${form.slug}` }); await fetchPortals(); onPortalsChanged?.(); setAddOpen(false); }
    else { toast({ title: 'Error', description: error || 'Failed', variant: 'destructive' }); }
  };

  const updateZone = async () => {
    if (!editZone || !form.name || !form.slug) return;
    const { error } = await apiMutate(`/api/wifi/portal/instances/${editZone.id}`, {
      method: 'PUT', body: JSON.stringify({
        name: form.name, slug: form.slug, authMethod: form.authMethod, roamingMode: form.roamingMode,
        allowsRoamingFrom: JSON.stringify(form.allowsRoamingFrom),
        maxBandwidthDown: form.maxBandwidthDown * 1048576,
        maxBandwidthUp: form.maxBandwidthUp * 1048576,
        bandwidthPolicy: form.bandwidthPolicy,
        nasIdentifier: form.nasIdentifier || undefined,
        ssidList: JSON.stringify(form.ssidList),
        maxConcurrent: form.maxConcurrent,
        sessionTimeout: form.sessionTimeout * 60,
        idleTimeout: form.idleTimeout * 60,
      }),
    });
    if (!error) { toast({ title: 'Zone updated', description: `${form.name} saved` }); await fetchPortals(); onPortalsChanged?.(); setEditOpen(false); }
    else { toast({ title: 'Error', description: error || 'Failed', variant: 'destructive' }); }
  };

  if (loading) {
    return (<div className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-10 w-48" /><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-52 w-full" /><Skeleton className="h-52 w-full" /><Skeleton className="h-52 w-full" /></div></div>);
  }

  const roamingZones = zones.filter(z => z.roamingMode === 'seamless');

  return (
    <div className="space-y-6">
      {/* Server Config Banner */}
      <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/40"><Zap className="h-5 w-5 text-teal-600 dark:text-teal-400" /></div>
          <div>
            <p className="font-medium text-sm">Portal Server Active</p>
            <p className="text-xs text-muted-foreground">Single server serves all zones via slug routing. Configure SSL & domain in <span className="font-mono text-foreground">Network → Portal Settings</span></p>
          </div>
        </div>
        <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:bg-emerald-950/30 gap-1">
          <CheckCircle2 className="h-3 w-3" /> Running
        </Badge>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{zones.length} zone{zones.length !== 1 ? 's' : ''} configured
            {roamingZones.length > 0 && <span className="ml-2 text-blue-600 dark:text-blue-400">· {roamingZones.length} seamless roaming</span>}
          </p>
        </div>
        <Button onClick={openAdd} className="bg-teal-600 hover:bg-teal-700"><Plus className="h-4 w-4 mr-2" />Add Zone</Button>
      </div>

      {/* Zone Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {zones.map(zone => {
          const authDef = AUTH_METHODS.find(a => a.value === zone.authMethod);
          const roamingDefs = zone.allowsRoamingFrom.map(slug => zones.find(z => z.slug === slug)).filter(Boolean) as PortalZone[];
          return (
            <Card key={zone.id} className={cn(!zone.enabled && 'opacity-50')}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', zone.enabled ? 'bg-teal-50 dark:bg-teal-900/30' : 'bg-gray-100 dark:bg-gray-800')}>
                      <Globe className={cn('h-5 w-5', zone.enabled ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400')} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{zone.name}</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono">/{zone.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RoamingBadge mode={zone.roamingMode} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Auth & Bandwidth Row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {authDef && <Badge variant="secondary" className={cn('text-[10px]', authDef.color)}>{authDef.label}</Badge>}
                  <Badge variant="outline" className="text-[10px]">↓ {zone.maxBandwidthDown} Mbps</Badge>
                  <Badge variant="outline" className="text-[10px]">↑ {zone.maxBandwidthUp} Mbps</Badge>
                </div>

                {/* SSIDs */}
                {zone.ssidList.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {zone.ssidList.slice(0, 3).map(s => (
                      <span key={s} className="text-[10px] bg-muted rounded px-1.5 py-0.5 font-mono">{s}</span>
                    ))}
                    {zone.ssidList.length > 3 && <span className="text-[10px] text-muted-foreground">+{zone.ssidList.length - 3} more</span>}
                  </div>
                )}

                {/* Roaming Connections */}
                {roamingDefs.length > 0 && (
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-2">
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mb-1">🔗 Seamless from:</p>
                    <div className="flex gap-1 flex-wrap">
                      {roamingDefs.map(rz => (
                        <span key={rz.id} className="text-[10px] bg-white dark:bg-blue-950/40 rounded px-1.5 py-0.5 border border-blue-200 dark:border-blue-800">{rz.name}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeouts */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/50 p-1.5"><div className="text-sm font-bold">{zone.sessionTimeout}m</div><div className="text-[10px] text-muted-foreground">Session</div></div>
                  <div className="rounded-lg bg-muted/50 p-1.5"><div className="text-sm font-bold">{zone.idleTimeout}m</div><div className="text-[10px] text-muted-foreground">Idle</div></div>
                  <div className="rounded-lg bg-muted/50 p-1.5"><div className="text-sm font-bold">{zone.maxConcurrent}</div><div className="text-[10px] text-muted-foreground">Max</div></div>
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Active</Label>
                    <Switch checked={zone.enabled} onCheckedChange={() => toggleEnabled(zone.id)} />
                  </div>
                  <div className="flex gap-1">
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(zone)}><Edit2 className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Edit</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 dark:text-red-400" onClick={() => deleteZone(zone.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {zones.length === 0 && (
        <Card className="border-dashed"><CardContent className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
          <Globe className="h-10 w-10 opacity-30" /><p className="text-sm font-medium">No portal zones yet</p>
          <p className="text-xs">Create zones for different areas — lobby, pool, gym, conference — each with unique branding and auth</p>
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Create First Zone</Button>
        </CardContent></Card>
      )}

      {/* Add Zone Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[85vh]">
          <DialogHeader><DialogTitle>Add Portal Zone</DialogTitle><DialogDescription>Create a new zone — each area gets its own portal design, auth method, and bandwidth limits</DialogDescription></DialogHeader>
          <ScrollArea className="max-h-[60vh]"><ZoneFormContent form={form} setForm={setForm} zones={zones} editZone={null} ssidInput={ssidInput} setSsidInput={setSsidInput} /></ScrollArea>
          <DialogFooter><Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button onClick={createZone} disabled={!form.name || !form.slug} className="bg-teal-600 hover:bg-teal-700">Create Zone</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Zone Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[85vh]">
          <DialogHeader><DialogTitle>Edit Zone — {editZone?.name}</DialogTitle><DialogDescription>Update zone configuration for /{editZone?.slug}</DialogDescription></DialogHeader>
          <ScrollArea className="max-h-[60vh]"><ZoneFormContent form={form} setForm={setForm} zones={zones} editZone={editZone} ssidInput={ssidInput} setSsidInput={setSsidInput} /></ScrollArea>
          <DialogFooter><Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={updateZone} disabled={!form.name || !form.slug} className="bg-teal-600 hover:bg-teal-700">Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 2: Powerful Portal Designer
// ═══════════════════════════════════════════════════════════════════════════════

interface PortalPageDesign {
  authFlow: string;
  title: string; subtitle: string; logoUrl: string;
  backgroundType: 'solid' | 'gradient' | 'image';
  backgroundColor: string; backgroundImageUrl: string;
  brandColor: string; textColor: string;
  fields: AutoFields;
  socialLogin: { google: boolean; facebook: boolean; apple: boolean };
  customCSS: string; customHTML: string;
  settings: DesignSettings;
}

interface AaaConfig { usernameFormat: string; passwordFormat: string; credentialPrintOnVoucher?: boolean; credentialShowInPortal?: boolean; }

const DEFAULT_DESIGN: PortalPageDesign = {
  authFlow: 'pms_credentials',
  title: 'Welcome to StaySuite', subtitle: 'Connect to our high-speed WiFi network',
  logoUrl: '', backgroundType: 'solid', backgroundColor: '#0f766e', backgroundImageUrl: '',
  brandColor: '#14b8a6', textColor: '#ffffff',
  fields: getAutoFields('custom'), socialLogin: { google: false, facebook: false, apple: false },
  customCSS: '/* Custom CSS */', customHTML: '<div class="legal-footer"><p>&copy; 2025 StaySuite Hospitality</p></div>',
  settings: { ...DEFAULT_SETTINGS },
};

function fieldsAreEqual(a: AutoFields, b: AutoFields): boolean {
  return Object.keys(a).every((k) => a[k as keyof AutoFields] === b[k as keyof AutoFields]);
}

function getBackgroundCSS(design: PortalPageDesign): string {
  const s = design.settings;
  if (s.backgroundType === 'gradient') {
    return `linear-gradient(${s.gradientAngle}deg, ${s.gradientFrom}, ${s.gradientTo})`;
  }
  if (s.backgroundType === 'image' && design.backgroundImageUrl) {
    return `url(${design.backgroundImageUrl}) center/cover`;
  }
  return design.backgroundColor;
}

function getFormClasses(s: DesignSettings): string {
  let cls = '';
  if (s.formStyle === 'glass') cls += 'bg-white/10 backdrop-blur-xl border border-white/20 ';
  else if (s.formStyle === 'card') cls += 'bg-white shadow-xl ';
  else if (s.formStyle === 'minimal') cls += 'bg-transparent ';
  else cls += 'bg-white/10 backdrop-blur-md ';
  if (s.cardShadow === 'large') cls += 'shadow-2xl ';
  else if (s.cardShadow === 'medium') cls += 'shadow-xl ';
  else if (s.cardShadow === 'small') cls += 'shadow-lg ';
  else cls += '';
  if (s.formStyle === 'pill') cls += 'rounded-3xl ';
  else if (s.formStyle === 'rounded') cls += 'rounded-2xl ';
  else if (s.formStyle === 'square') cls += 'rounded-none ';
  else cls += 'rounded-2xl ';
  return cls;
}

function getInputClasses(s: DesignSettings): string {
  const bg = s.formStyle === 'glass' || s.formStyle === 'minimal' ? 'bg-white/10 border-white/20' : 'bg-white/90 border-gray-200';
  if (s.inputStyle === 'pill') return `${bg} rounded-full px-4 py-2.5 text-xs`;
  if (s.inputStyle === 'square') return `${bg} rounded-none px-3 py-2.5 text-xs`;
  if (s.inputStyle === 'underline') return `${bg} border-0 border-b-2 px-1 py-2 text-xs bg-transparent border-white/30`;
  return `${bg} rounded-lg px-3 py-2.5 text-xs`;
}

function getButtonClasses(s: DesignSettings): string {
  const isGlass = s.formStyle === 'glass' || s.formStyle === 'minimal';
  let cls = 'font-semibold transition-all ';
  if (s.buttonSize === 'large') cls += 'px-6 py-3 text-sm ';
  else if (s.buttonSize === 'small') cls += 'px-4 py-2 text-xs ';
  else cls += 'px-5 py-2.5 text-sm ';

  if (s.buttonStyle === 'pill') cls += 'rounded-full ';
  else if (s.buttonStyle === 'rounded') cls += 'rounded-lg ';
  else cls += 'rounded-lg ';

  if (s.buttonStyle === 'gradient') cls += `bg-gradient-to-r from-[${s.gradientFrom}] to-[${s.gradientTo}] text-white `;
  else if (s.buttonStyle === 'outlined') cls += isGlass ? 'border-2 border-white/40 text-white hover:bg-white/10 ' : 'border-2 border-teal-500 text-teal-500 dark:text-teal-400 hover:bg-teal-50 ';
  else cls += 'text-white hover:opacity-90 ';
  return cls;
}

// ── Portal Designer Tab ───────────────────────────────────────────────────────

function PortalDesignerTab({ portalOptions }: { portalOptions: Array<{ id: string; name: string }> }) {
  const { toast } = useToast();
  const { propertyId } = usePropertyId();
  const [selectedPortalId, setSelectedPortalId] = useState<string>(portalOptions[0]?.id || '');
  const [aaaConfig, setAaaConfig] = useState<AaaConfig | null>(null);
  const [credentialCategory, setCredentialCategory] = useState<CredentialCategory>('custom');
  const [autoFields, setAutoFields] = useState<AutoFields>(getAutoFields('custom'));
  const [design, setDesign] = useState<PortalPageDesign>({ ...DEFAULT_DESIGN, settings: { ...DEFAULT_SETTINGS } });
  const [savedPageId, setSavedPageId] = useState<string | null>(null);
  const [isOverride, setIsOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subTab, setSubTab] = useState<DesignerSubTab>('templates');
  const [previewDevice, setPreviewDevice] = useState<'phone' | 'tablet' | 'desktop'>('phone');

  // ── Load data when portal changes ───────────────────────────────────────────
  useEffect(() => {
    if (!selectedPortalId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const config = await apiFetch<AaaConfig>('/api/wifi/aaa-config');
      if (!cancelled && config) {
        setAaaConfig(config);
        const cat = CREDENTIAL_FORMAT_MAP[config.usernameFormat] || 'custom';
        setCredentialCategory(cat);
        setAutoFields(getAutoFields(cat));
      }
      const pageData = await apiFetch<any>(`/api/wifi/portal/pages?portalId=${selectedPortalId}`);
      if (!cancelled && pageData && (Array.isArray(pageData) ? pageData.length > 0 : true)) {
        const pd = Array.isArray(pageData) ? pageData[0] : pageData;
        if (pd) {
          setSavedPageId(pd.id || null);
          const settings: DesignSettings = {
            ...DEFAULT_SETTINGS,
            ...(typeof pd.designSettings === 'string' ? JSON.parse(pd.designSettings || '{}') : pd.designSettings || {}),
          };
          setDesign({
            authFlow: pd.authFlow || 'pms_credentials',
            title: pd.title || DEFAULT_DESIGN.title, subtitle: pd.subtitle || DEFAULT_DESIGN.subtitle,
            logoUrl: pd.logoUrl || '', backgroundType: (typeof pd.designSettings === 'string' ? JSON.parse(pd.designSettings || '{}') : pd.designSettings || {}).backgroundType || 'solid',
            backgroundColor: pd.backgroundColor || '#0f766e', backgroundImageUrl: pd.backgroundImage || '',
            brandColor: pd.accentColor || '#14b8a6', textColor: pd.textColor || '#ffffff',
            fields: typeof pd.formFields === 'string' ? JSON.parse(pd.formFields) : (pd.formFields || getAutoFields('custom')),
            socialLogin: typeof pd.socialProviders === 'string' ? JSON.parse(pd.socialProviders) : { google: false, facebook: false, apple: false },
            customCSS: pd.customCss || '', customHTML: pd.customHtml || '', settings,
          });
          const newAuto = getAutoFields(CREDENTIAL_FORMAT_MAP[config?.usernameFormat || ''] || 'custom');
          setIsOverride(!fieldsAreEqual(typeof pd.formFields === 'string' ? JSON.parse(pd.formFields) : (pd.formFields || getAutoFields('custom')), newAuto));
        }
      } else if (!cancelled) {
        const cat = CREDENTIAL_FORMAT_MAP[config?.usernameFormat || ''] || 'custom';
        setDesign((prev) => ({ ...prev, fields: getAutoFields(cat), settings: { ...DEFAULT_SETTINGS } }));
        setSavedPageId(null);
        setIsOverride(false);
      }
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [selectedPortalId]);

  const updateDesign = useCallback((partial: Partial<PortalPageDesign>) => {
    setDesign((prev) => {
      const next = { ...prev, ...partial };
      if (partial.fields) setIsOverride(!fieldsAreEqual(partial.fields, autoFields));
      return next;
    });
  }, [autoFields]);

  const updateSettings = useCallback((partial: Partial<DesignSettings>) => {
    setDesign((prev) => ({ ...prev, settings: { ...prev.settings, ...partial } }));
  }, []);

  const applyTemplate = useCallback((template: PortalTemplate) => {
    setDesign((prev) => ({
      ...prev,
      backgroundColor: template.colors.bg,
      brandColor: template.colors.accent,
      textColor: template.colors.text,
      settings: { ...prev.settings, ...template.design, gradientFrom: template.colors.gradientFrom || prev.settings.gradientFrom, gradientTo: template.colors.gradientTo || prev.settings.gradientTo, backgroundType: template.design.backgroundType || 'solid' },
    }));
    toast({ title: 'Template applied', description: `${template.name} theme has been applied` });
  }, [toast]);

  const toggleField = useCallback((key: keyof AutoFields) => {
    setDesign((prev) => {
      const next = { ...prev, fields: { ...prev.fields, [key]: !prev.fields[key] } };
      setIsOverride(!fieldsAreEqual(next.fields, autoFields));
      return next;
    });
  }, [autoFields]);

  const toggleSocial = useCallback((provider: 'google' | 'facebook' | 'apple') => {
    setDesign((prev) => ({ ...prev, socialLogin: { ...prev.socialLogin, [provider]: !prev.socialLogin[provider] } }));
  }, []);

  const resetToPolicy = useCallback(() => {
    setDesign((prev) => ({ ...prev, fields: { ...autoFields } }));
    setIsOverride(false);
    toast({ title: 'Reset to policy', description: 'Form fields synced with credential policy' });
  }, [autoFields, toast]);

  const handleSave = useCallback(async () => {
    if (!selectedPortalId) return;
    setSaving(true);
    const payload = {
      portalId: selectedPortalId, propertyId: propertyId || 'default',
      title: design.title, subtitle: design.subtitle, logoUrl: design.logoUrl,
      backgroundImage: design.backgroundImageUrl, backgroundColor: design.backgroundColor,
      textColor: design.textColor, brandColor: design.brandColor,
      authFlow: design.authFlow,
      formFields: design.fields, socialLogin: design.socialLogin,
      customCSS: design.customCSS, customHTML: design.customHTML,
      designSettings: design.settings,
    };
    try {
      if (savedPageId) {
        const { error } = await apiMutate(`/api/wifi/portal/pages/${savedPageId}`, { method: 'PUT', body: JSON.stringify(payload) });
        if (error) toast({ title: 'Save failed', description: error, variant: 'destructive' });
        else toast({ title: 'Saved', description: 'Portal design updated successfully' });
      } else {
        const { data, error } = await apiMutate<any>('/api/wifi/portal/pages', { method: 'POST', body: JSON.stringify(payload) });
        if (error) toast({ title: 'Save failed', description: error, variant: 'destructive' });
        else if (data) { setSavedPageId(data.id || null); toast({ title: 'Saved', description: 'Portal design created successfully' }); }
      }
    } catch { toast({ title: 'Save failed', description: 'Unexpected error', variant: 'destructive' }); }
    setSaving(false);
  }, [selectedPortalId, propertyId, design, savedPageId, toast]);

  const visibleFields = useMemo(() => FIELD_DEFINITIONS.filter((f) => design.fields[f.key]), [design.fields]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (<div className="space-y-4"><Skeleton className="h-10 w-full max-w-md" /><div className="grid grid-cols-1 lg:grid-cols-5 gap-6"><Skeleton className="h-[700px] col-span-2" /><Skeleton className="h-[700px] col-span-3" /></div></div>);
  }

  if (!selectedPortalId || portalOptions.length === 0) {
    return (<Card className="border-dashed"><CardContent className="py-16 flex flex-col items-center gap-4 text-muted-foreground">
      <Layout className="h-12 w-12 opacity-30" /><p className="text-base font-medium">No portal instances available</p>
      <p className="text-sm">Create a portal instance first, then come back to design its login page</p>
    </CardContent></Card>);
  }

  return (
    <div className="space-y-4">
      {/* ── Top Bar ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={selectedPortalId} onValueChange={setSelectedPortalId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Select portal..." /></SelectTrigger>
            <SelectContent>{portalOptions.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
          </Select>
          {aaaConfig && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className={cn('gap-1.5 cursor-default', isOverride ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300')}>
                  {isOverride ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                  {isOverride ? 'Custom Override' : 'Synced with Policy'}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{isOverride ? 'Form fields differ from credential policy defaults' : `Auto-configured from ${CREDENTIAL_CATEGORY_LABELS[credentialCategory]} format`}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex gap-2">
          {isOverride && <Button variant="outline" size="sm" onClick={resetToPolicy}><RotateCcw className="h-4 w-4 mr-1.5" />Sync to Policy</Button>}
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-1.5" />{saving ? 'Saving...' : 'Save'}</Button>
        </div>
      </div>

      {/* ── Split Pane: Preview (left 2/5) + Controls (right 3/5) ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Left: Live Preview ──────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden lg:sticky lg:top-4">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2"><Eye className="h-4 w-4" />Live Preview</CardTitle>
                <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
                  {[{ v: 'phone' as const, icon: Smartphone }, { v: 'tablet' as const, icon: Tablet }, { v: 'desktop' as const, icon: Monitor }].map(({ v, icon: Ic }) => (
                    <button key={v} onClick={() => setPreviewDevice(v)} className={cn('p-1.5 rounded-md transition-colors', previewDevice === v ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                      <Ic className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 flex justify-center bg-muted/30 min-h-[400px] lg:min-h-[620px]">
              {/* Device Frame */}
              <div className={cn(
                'relative bg-gray-900 shadow-2xl overflow-hidden',
                previewDevice === 'phone' ? 'w-[240px] sm:w-[280px] h-[480px] sm:h-[560px] rounded-[36px] border-4 border-gray-800' : '',
                previewDevice === 'tablet' ? 'w-[320px] sm:w-[420px] h-[480px] sm:h-[580px] rounded-[20px] border-3 border-gray-800' : '',
                previewDevice === 'desktop' ? 'w-full h-[480px] sm:h-[580px] rounded-lg border-2 border-gray-700' : '',
              )}>
                {/* Notch (phone only) */}
                {previewDevice === 'phone' && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-gray-900 rounded-b-xl z-10" />}
                {/* Screen Content */}
                <div className="w-full h-full overflow-y-auto" style={{ background: getBackgroundCSS(design), color: design.textColor }}>
                  <PortalPreviewContent design={design} visibleFields={visibleFields} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right: Designer Controls ──────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-0">
          {/* Sub-Tab Navigation */}
          <div className="border rounded-lg bg-card">
            <div className="flex overflow-x-auto bg-muted/50 px-2 pt-2">
              {DESIGNER_SUBTABS.map((st) => {
                const Icon = st.icon;
                const isActive = subTab === st.id;
                return (
                  <button key={st.id} onClick={() => setSubTab(st.id)}
                    className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap transition-all border-b-2',
                      isActive ? 'bg-card text-foreground border-teal-500' : 'text-muted-foreground border-transparent hover:text-foreground'
                    )}>
                    <Icon className="h-3.5 w-3.5" />{st.label}
                  </button>
                );
              })}
            </div>

            <div className="overflow-y-auto max-h-[70vh] overscroll-contain">
              <div className="p-5 space-y-5">
                {/* ── Templates Sub-Tab ──────────────────────────────────────── */}
                {subTab === 'templates' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500 dark:text-amber-400" />Choose a Template</h3>
                      <p className="text-xs text-muted-foreground mt-1">Start with a professionally designed theme, then customize every detail</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {PORTAL_TEMPLATES.map((tmpl) => (
                        <button key={tmpl.id} onClick={() => applyTemplate(tmpl)}
                          className={cn('group relative rounded-xl overflow-hidden border-2 transition-all hover:shadow-lg text-left',
                            design.settings.layoutType === tmpl.design.layoutType && design.backgroundColor === tmpl.colors.bg
                              ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-border hover:border-teal-300'
                          )}>
                          {/* Thumbnail */}
                          <div className="h-28 relative" style={{ background: tmpl.preview }}>
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-white/90 p-3">
                              <Building className="h-6 w-6 opacity-60" />
                              <div className="text-[10px] font-semibold text-center">{tmpl.name}</div>
                            </div>
                            {design.settings.layoutType === tmpl.design.layoutType && design.backgroundColor === tmpl.colors.bg && (
                              <div className="absolute top-2 right-2 bg-teal-500 rounded-full p-0.5"><CheckCircle2 className="h-3 w-3 text-white" /></div>
                            )}
                          </div>
                          <div className="p-3 bg-card">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs font-semibold">{tmpl.name}</p>
                                <p className="text-[10px] text-muted-foreground">{tmpl.category}</p>
                              </div>
                              <div className="flex gap-1">
                                <div className="w-3 h-3 rounded-full border border-gray-300" style={{ background: tmpl.colors.bg }} />
                                <div className="w-3 h-3 rounded-full border border-gray-300" style={{ background: tmpl.colors.accent }} />
                              </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">{tmpl.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Layout Sub-Tab ─────────────────────────────────────────── */}
                {subTab === 'layout' && (
                  <div className="space-y-4">
                    <div><h3 className="text-sm font-semibold">Page Layout</h3><p className="text-xs text-muted-foreground mt-1">Choose how the login form is positioned on the page</p></div>
                    <div className="grid grid-cols-1 gap-2">
                      {LAYOUT_OPTIONS.map((lo) => (
                        <button key={lo.value} onClick={() => updateSettings({ layoutType: lo.value })}
                          className={cn('flex items-center gap-4 p-3 rounded-lg border-2 transition-all text-left',
                            design.settings.layoutType === lo.value ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:border-teal-300'
                          )}>
                          <LayoutMiniPreview layout={lo.value} />
                          <div><p className="text-sm font-medium">{lo.label}</p><p className="text-xs text-muted-foreground">{lo.desc}</p></div>
                        </button>
                      ))}
                    </div>
                    {/* Auth Flow */}
                    <Separator />
                    <div><h3 className="text-sm font-semibold">Authentication Flow</h3><p className="text-xs text-muted-foreground mt-1">How guests authenticate on the portal</p></div>
                    <div className="grid grid-cols-1 gap-2">
                      {AUTH_FLOW_OPTIONS.map((af) => {
                        const Icon = af.icon;
                        return (
                          <button key={af.value} onClick={() => updateDesign({ authFlow: af.value })}
                            className={cn('flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left',
                              design.authFlow === af.value ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:border-teal-300'
                            )}>
                            <Icon className={cn('h-5 w-5', af.color)} />
                            <div><p className="text-sm font-medium">{af.label}</p></div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Background Sub-Tab ─────────────────────────────────────── */}
                {subTab === 'background' && (
                  <div className="space-y-5">
                    <div><h3 className="text-sm font-semibold">Background Type</h3></div>
                    <div className="grid grid-cols-3 gap-2">
                      {[{ v: 'solid' as const, l: 'Solid Color' }, { v: 'gradient' as const, l: 'Gradient' }, { v: 'image' as const, l: 'Image URL' }].map((bt) => (
                        <button key={bt.v} onClick={() => updateSettings({ backgroundType: bt.v })}
                          className={cn('p-3 rounded-lg border-2 text-center text-xs font-medium transition-all',
                            design.settings.backgroundType === bt.v ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:border-teal-300'
                          )}>{bt.l}</button>
                      ))}
                    </div>
                    {design.settings.backgroundType === 'solid' && (
                      <div className="space-y-2"><Label className="text-xs">Background Color</Label>
                        <div className="flex items-center gap-3"><input type="color" value={design.backgroundColor} onChange={(e) => updateDesign({ backgroundColor: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer border-0" /><Input value={design.backgroundColor} onChange={(e) => updateDesign({ backgroundColor: e.target.value })} className="flex-1 font-mono text-xs" /></div>
                      </div>
                    )}
                    {design.settings.backgroundType === 'gradient' && (
                      <div className="space-y-4">
                        <div className="space-y-2"><Label className="text-xs">From Color</Label><div className="flex items-center gap-3"><input type="color" value={design.settings.gradientFrom} onChange={(e) => updateSettings({ gradientFrom: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer border-0" /><Input value={design.settings.gradientFrom} onChange={(e) => updateSettings({ gradientFrom: e.target.value })} className="flex-1 font-mono text-xs" /></div></div>
                        <div className="space-y-2"><Label className="text-xs">To Color</Label><div className="flex items-center gap-3"><input type="color" value={design.settings.gradientTo} onChange={(e) => updateSettings({ gradientTo: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer border-0" /><Input value={design.settings.gradientTo} onChange={(e) => updateSettings({ gradientTo: e.target.value })} className="flex-1 font-mono text-xs" /></div></div>
                        <div className="space-y-2"><Label className="text-xs">Angle: {design.settings.gradientAngle}&deg;</Label><input type="range" min="0" max="360" value={design.settings.gradientAngle} onChange={(e) => updateSettings({ gradientAngle: parseInt(e.target.value) })} className="w-full accent-teal-500" /></div>
                      </div>
                    )}
                    {design.settings.backgroundType === 'image' && (
                      <div className="space-y-3">
                        <div className="space-y-2"><Label className="text-xs">Image URL</Label><Input placeholder="https://example.com/hotel-bg.jpg" value={design.backgroundImageUrl} onChange={(e) => updateDesign({ backgroundImageUrl: e.target.value })} className="text-xs" /></div>
                        <div className="space-y-2"><Label className="text-xs">Overlay Opacity: {design.settings.backgroundOverlay}%</Label><input type="range" min="0" max="90" value={design.settings.backgroundOverlay} onChange={(e) => updateSettings({ backgroundOverlay: parseInt(e.target.value) })} className="w-full accent-teal-500" /></div>
                      </div>
                    )}
                    <Separator />
                    {/* Brand & Text Colors */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label className="text-xs">Brand / Accent Color</Label><div className="flex items-center gap-3"><input type="color" value={design.brandColor} onChange={(e) => updateDesign({ brandColor: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer border-0" /><Input value={design.brandColor} onChange={(e) => updateDesign({ brandColor: e.target.value })} className="flex-1 font-mono text-xs" /></div></div>
                      <div className="space-y-2"><Label className="text-xs">Text Color</Label><div className="flex items-center gap-3"><input type="color" value={design.textColor} onChange={(e) => updateDesign({ textColor: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer border-0" /><Input value={design.textColor} onChange={(e) => updateDesign({ textColor: e.target.value })} className="flex-1 font-mono text-xs" /></div></div>
                    </div>
                  </div>
                )}

                {/* ── Typography Sub-Tab ─────────────────────────────────────── */}
                {subTab === 'typography' && (
                  <div className="space-y-5">
                    <div><h3 className="text-sm font-semibold flex items-center gap-2"><Type className="h-4 w-4" />Typography</h3><p className="text-xs text-muted-foreground mt-1">Choose fonts that match your hotel brand</p></div>
                    <div className="space-y-2"><Label className="text-xs">Body Font</Label>
                      <Select value={design.settings.fontFamily} onValueChange={(v) => updateSettings({ fontFamily: v })}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{FONT_OPTIONS.map((f) => (<SelectItem key={f.value} value={f.value} className={f.style}>{f.label}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label className="text-xs">Heading Font</Label>
                      <Select value={design.settings.headingFontFamily} onValueChange={(v) => updateSettings({ headingFontFamily: v })}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{FONT_OPTIONS.map((f) => (<SelectItem key={f.value} value={f.value} className={f.style}>{f.label}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* ── Form & Button Style Sub-Tab ────────────────────────────── */}
                {subTab === 'formstyle' && (
                  <div className="space-y-5">
                    <div><h3 className="text-sm font-semibold flex items-center gap-2"><FormInput className="h-4 w-4" />Form Style</h3></div>
                    <div className="grid grid-cols-2 gap-2">
                      {FORM_STYLES.map((fs) => (
                        <button key={fs.value} onClick={() => updateSettings({ formStyle: fs.value })}
                          className={cn('p-3 rounded-lg border-2 text-xs font-medium transition-all',
                            design.settings.formStyle === fs.value ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:border-teal-300'
                          )}>{fs.label}</button>
                      ))}
                    </div>
                    <Separator />
                    <div><h3 className="text-sm font-semibold">Input Style</h3></div>
                    <div className="grid grid-cols-2 gap-2">
                      {INPUT_STYLES.map((is) => (
                        <button key={is.value} onClick={() => updateSettings({ inputStyle: is.value })}
                          className={cn('p-3 rounded-lg border-2 text-xs font-medium transition-all',
                            design.settings.inputStyle === is.value ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:border-teal-300'
                          )}>{is.label}</button>
                      ))}
                    </div>
                    <Separator />
                    <div><h3 className="text-sm font-semibold">Button Style</h3></div>
                    <div className="grid grid-cols-2 gap-2">
                      {BUTTON_STYLES.map((bs) => (
                        <button key={bs.value} onClick={() => updateSettings({ buttonStyle: bs.value })}
                          className={cn('p-3 rounded-lg border-2 text-xs font-medium transition-all',
                            design.settings.buttonStyle === bs.value ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:border-teal-300'
                          )}>{bs.label}</button>
                      ))}
                    </div>
                    <div><h3 className="text-sm font-semibold mt-2">Button Size</h3></div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['small', 'medium', 'large'] as const).map((sz) => (
                        <button key={sz} onClick={() => updateSettings({ buttonSize: sz })}
                          className={cn('p-3 rounded-lg border-2 text-xs font-medium transition-all capitalize',
                            design.settings.buttonSize === sz ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:border-teal-300'
                          )}>{sz}</button>
                      ))}
                    </div>
                    <Separator />
                    <div><h3 className="text-sm font-semibold">Animation</h3></div>
                    <div className="grid grid-cols-2 gap-2">
                      {([['none', 'None'], ['fade', 'Fade In'], ['slide_up', 'Slide Up'], ['zoom', 'Zoom']] as const).map(([v, l]) => (
                        <button key={v} onClick={() => updateSettings({ animationType: v })}
                          className={cn('p-3 rounded-lg border-2 text-xs font-medium transition-all',
                            design.settings.animationType === v ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:border-teal-300'
                          )}>{l}</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Content Sub-Tab ────────────────────────────────────────── */}
                {subTab === 'content' && (
                  <div className="space-y-5">
                    <div><h3 className="text-sm font-semibold flex items-center gap-2"><Layers className="h-4 w-4" />Content Sections</h3><p className="text-xs text-muted-foreground mt-1">Add rich content to engage guests</p></div>
                    {/* Branding Content */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between"><Label className="text-xs font-semibold">Branding</Label></div>
                      <div className="space-y-2"><Label className="text-xs">Portal Title</Label><Input value={design.title} onChange={(e) => updateDesign({ title: e.target.value })} className="text-xs" /></div>
                      <div className="space-y-2"><Label className="text-xs">Subtitle</Label><Input value={design.subtitle} onChange={(e) => updateDesign({ subtitle: e.target.value })} className="text-xs" /></div>
                      <div className="space-y-2"><Label className="text-xs">Logo URL</Label><Input placeholder="https://example.com/logo.png" value={design.logoUrl} onChange={(e) => updateDesign({ logoUrl: e.target.value })} className="text-xs" /></div>
                      <div className="space-y-2"><Label className="text-xs">Welcome Message</Label><Textarea value={design.settings.welcomeMessage} onChange={(e) => updateSettings({ welcomeMessage: e.target.value })} className="text-xs" rows={2} /></div>
                    </div>
                    <Separator />
                    {/* Hotel Info */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between"><Label className="text-xs font-semibold">Hotel Information</Label><Switch checked={design.settings.showHotelInfo} onCheckedChange={(v) => updateSettings({ showHotelInfo: v })} /></div>
                      {design.settings.showHotelInfo && (<>
                        <div className="space-y-2"><Label className="text-xs">Hotel Name</Label><Input value={design.settings.hotelName} onChange={(e) => updateSettings({ hotelName: e.target.value })} className="text-xs" /></div>
                        <div className="space-y-2"><Label className="text-xs">Address</Label><Input value={design.settings.hotelAddress} onChange={(e) => updateSettings({ hotelAddress: e.target.value })} className="text-xs" /></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2"><Label className="text-xs">Phone</Label><Input value={design.settings.hotelPhone} onChange={(e) => updateSettings({ hotelPhone: e.target.value })} className="text-xs" /></div>
                          <div className="space-y-2"><Label className="text-xs">Website</Label><Input value={design.settings.hotelWebsite} onChange={(e) => updateSettings({ hotelWebsite: e.target.value })} className="text-xs" /></div>
                        </div>
                      </>)}
                    </div>
                    <Separator />
                    {/* Amenities */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between"><Label className="text-xs font-semibold">Amenities</Label><Switch checked={design.settings.showAmenities} onCheckedChange={(v) => updateSettings({ showAmenities: v })} /></div>
                      {design.settings.showAmenities && (
                        <div className="grid grid-cols-2 gap-2">
                          {Object.keys(AMENITY_ICONS).map((am) => (
                            <div key={am} className={cn('flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all',
                              design.settings.amenities.includes(am) ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:border-teal-300'
                            )} onClick={() => {
                              const curr = design.settings.amenities;
                              updateSettings({ amenities: curr.includes(am) ? curr.filter((a) => a !== am) : [...curr, am] });
                            }}>
                              {React.createElement(AMENITY_ICONS[am], { className: 'h-3.5 w-3.5 text-teal-500 dark:text-teal-400 flex-shrink-0' })}
                              <span className="truncate">{am}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <Separator />
                    {/* Promotion */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between"><Label className="text-xs font-semibold">Promotion Banner</Label><Switch checked={design.settings.showPromotion} onCheckedChange={(v) => updateSettings({ showPromotion: v })} /></div>
                      {design.settings.showPromotion && (<>
                        <div className="space-y-2"><Label className="text-xs">Promotion Title</Label><Input value={design.settings.promotionTitle} onChange={(e) => updateSettings({ promotionTitle: e.target.value })} className="text-xs" /></div>
                        <div className="space-y-2"><Label className="text-xs">Description</Label><Textarea value={design.settings.promotionDesc} onChange={(e) => updateSettings({ promotionDesc: e.target.value })} className="text-xs" rows={2} /></div>
                      </>)}
                    </div>
                    <Separator />
                    {/* Social Links */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between"><Label className="text-xs font-semibold">Social Media</Label><Switch checked={design.settings.showSocialMedia} onCheckedChange={(v) => updateSettings({ showSocialMedia: v })} /></div>
                      {design.settings.showSocialMedia && (
                        <div className="space-y-2">
                          {['instagram', 'facebook', 'twitter'].map((platform) => (
                            <div key={platform} className="flex items-center gap-2">
                              {platform === 'instagram' && <Instagram className="h-4 w-4 text-pink-500 dark:text-pink-400" />}
                              {platform === 'facebook' && <Facebook className="h-4 w-4 text-blue-500 dark:text-blue-400" />}
                              {platform === 'twitter' && <Twitter className="h-4 w-4 text-sky-500 dark:text-sky-400" />}
                              <Input placeholder={`${platform}.com/yourhotel`} value={design.settings.socialLinks.find((s) => s.platform === platform)?.url || ''} onChange={(e) => {
                                const links = design.settings.socialLinks.filter((s) => s.platform !== platform);
                                links.push({ platform, url: e.target.value });
                                updateSettings({ socialLinks: links });
                              }} className="text-xs" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── Fields Sub-Tab ─────────────────────────────────────────── */}
                {subTab === 'fields' && (
                  <div className="space-y-5">
                    <div><h3 className="text-sm font-semibold flex items-center gap-2"><Settings className="h-4 w-4" />Form Fields</h3><p className="text-xs text-muted-foreground mt-1">Toggle fields shown on the guest login form</p></div>
                    {isOverride && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span>Fields differ from credential policy defaults. <button onClick={resetToPolicy} className="underline font-semibold">Reset to policy</button></span>
                      </div>
                    )}
                    {['Guest Identity', 'Credentials', 'Legal'].map((group) => (
                      <div key={group}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group}</p>
                        <div className="space-y-1">
                          {FIELD_DEFINITIONS.filter((f) => f.group === group).map((f) => {
                            const Icon = f.icon;
                            const isOn = design.fields[f.key];
                            return (
                              <div key={f.key} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-2.5">
                                  <Icon className={cn('h-4 w-4', isOn ? 'text-teal-500 dark:text-teal-400' : 'text-muted-foreground/50')} />
                                  <span className={cn('text-xs font-medium', isOn ? 'text-foreground' : 'text-muted-foreground')}>{f.label}</span>
                                </div>
                                <Switch checked={isOn} onCheckedChange={() => toggleField(f.key)} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <Separator />
                    <div><h3 className="text-sm font-semibold">Social Login</h3></div>
                    <div className="space-y-1">
                      {([['google', 'Google'], ['facebook', 'Facebook'], ['apple', 'Apple']] as const).map(([k, l]) => (
                        <div key={k} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                          <span className="text-xs font-medium">{l}</span>
                          <Switch checked={design.socialLogin[k]} onCheckedChange={() => toggleSocial(k)} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Advanced Sub-Tab ───────────────────────────────────────── */}
                {subTab === 'advanced' && (
                  <div className="space-y-5">
                    <div><h3 className="text-sm font-semibold flex items-center gap-2"><Wand2 className="h-4 w-4" />Advanced Settings</h3><p className="text-xs text-muted-foreground mt-1">For developers and advanced customization</p></div>
                    <div className="space-y-2"><Label className="text-xs">Custom CSS</Label><Textarea value={design.customCSS} onChange={(e) => updateDesign({ customCSS: e.target.value })} className="font-mono text-xs min-h-[120px]" placeholder="/* Custom CSS */" /></div>
                    <div className="space-y-2"><Label className="text-xs">Custom HTML Injection</Label><Textarea value={design.customHTML} onChange={(e) => updateDesign({ customHTML: e.target.value })} className="font-mono text-xs min-h-[100px]" placeholder="<div>Custom HTML</div>" /></div>
                    <Separator />
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div><p className="text-xs font-medium">Show Clock</p><p className="text-[10px] text-muted-foreground">Display current local time</p></div>
                      <Switch checked={design.settings.showClock} onCheckedChange={(v) => updateSettings({ showClock: v })} />
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div><p className="text-xs font-medium">Show Hotel Branding</p><p className="text-[10px] text-muted-foreground">Powered by branding at bottom</p></div>
                      <Switch checked={true} disabled />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Live Preview Content — Renders inside the device frame
// ═══════════════════════════════════════════════════════════════════════════════

function PortalPreviewContent({ design, visibleFields }: { design: PortalPageDesign; visibleFields: typeof FIELD_DEFINITIONS }) {
  const s = design.settings;
  const isDark = s.backgroundType === 'solid' && design.backgroundColor.match(/^#[0-3]/);
  const isGlass = s.formStyle === 'glass' || s.formStyle === 'minimal';
  const inputCls = getInputClasses(s);
  const btnCls = getButtonClasses(s);
  const formCls = getFormClasses(s);

  return (
    <div className="flex flex-col items-center px-4 py-8 gap-4" style={{ fontFamily: s.fontFamily }}>
      {/* Promotion Banner */}
      {s.showPromotion && (
        <div className={cn('w-full max-w-[240px] rounded-lg p-2.5 text-center', isGlass ? 'bg-amber-500/20 border border-amber-400/30' : 'bg-amber-500/90')}>
          <p className="text-[10px] font-bold text-amber-100">{s.promotionTitle}</p>
          <p className="text-[9px] text-amber-200/80 mt-0.5">{s.promotionDesc}</p>
        </div>
      )}

      {/* Logo */}
      {design.logoUrl ? (
        <img src={design.logoUrl} alt="Logo" className="w-12 h-12 rounded-xl object-cover bg-white/20 shadow-lg" />
      ) : (
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', isGlass ? 'bg-white/10' : 'bg-white/20')}>
          <Building className="h-5 w-5 opacity-70" />
        </div>
      )}

      {/* Title & Subtitle */}
      <div className="text-center">
        <h1 className="text-base font-bold" style={{ fontFamily: s.headingFontFamily }}>{design.title}</h1>
        <p className="text-[11px] opacity-80 mt-1">{design.subtitle}</p>
        {s.welcomeMessage && <p className="text-[10px] opacity-60 mt-1 italic">{s.welcomeMessage}</p>}
      </div>

      {/* Hotel Info */}
      {s.showHotelInfo && (
        <div className="w-full max-w-[240px] space-y-1 text-center">
          <p className="text-[10px] font-semibold">{s.hotelName}</p>
          <div className="flex items-center justify-center gap-1 text-[9px] opacity-70"><MapPin className="h-2.5 w-2.5" />{s.hotelAddress}</div>
          <div className="flex items-center justify-center gap-3 text-[9px] opacity-70">
            <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{s.hotelPhone}</span>
            <span className="flex items-center gap-0.5"><Globe className="h-2.5 w-2.5" />{s.hotelWebsite}</span>
          </div>
        </div>
      )}

      {/* Form */}
      <div className={cn('w-full max-w-[240px] p-4 space-y-3', formCls)}>
        {/* Auth Flow Indicator */}
        <div className="flex items-center gap-1.5">
          <Wifi className={cn('h-3.5 w-3.5', isGlass ? 'text-white/60' : 'text-gray-400')} />
          <span className="text-[10px] font-semibold opacity-70 uppercase tracking-wider">
            {design.authFlow === 'room_number' ? 'Enter Room' : design.authFlow === 'voucher' ? 'Enter Voucher' : design.authFlow === 'sms_otp' ? 'OTP Login' : design.authFlow === 'open_access' ? 'Free Access' : 'Sign In'}
          </span>
        </div>

        {/* Fields */}
        {visibleFields.map((f) => {
          const Icon = f.icon;
          const isCredential = f.key === 'username' || f.key === 'password';
          const placeholder = isCredential
            ? f.key === 'username' ? 'Username' : 'Password'
            : f.key === 'roomNumber' ? 'Room Number'
            : f.key === 'phone' ? 'Phone Number'
            : f.key === 'email' ? 'Email Address'
            : f.key === 'terms' ? '' : f.label;
          if (f.key === 'terms') {
            return (
              <label key={f.key} className="flex items-start gap-2 text-[9px] opacity-70 cursor-pointer">
                <div className={cn('w-3.5 h-3.5 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center', isGlass ? 'border-white/30' : 'border-gray-300')}>
                  <CheckCircle2 className="h-2.5 w-2.5 text-teal-500 dark:text-teal-400" />
                </div>
                <span>I agree to the <span className="underline">Terms & Conditions</span></span>
              </label>
            );
          }
          return (
            <div key={f.key} className="relative">
              {f.key !== 'username' && f.key !== 'password' && <Icon className={cn('absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 opacity-40', isGlass ? 'text-white/50' : 'text-gray-400')} />}
              <div className={cn(isCredential ? '' : f.key !== 'username' && f.key !== 'password' ? 'pl-7' : '', inputCls, isGlass ? 'text-white placeholder:text-white/40' : 'text-gray-800 placeholder:text-gray-400', 'w-full outline-none flex items-center')}>
                <span className="text-[10px] opacity-50">{placeholder}</span>
              </div>
            </div>
          );
        })}

        {/* Social Login */}
        {(design.socialLogin.google || design.socialLogin.facebook || design.socialLogin.apple) && (
          <div className="flex gap-2 pt-1">
            {design.socialLogin.google && <div className={cn('flex-1 py-1.5 rounded text-center text-[9px] font-medium', isGlass ? 'bg-white/10 border border-white/20' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400')}>Google</div>}
            {design.socialLogin.facebook && <div className={cn('flex-1 py-1.5 rounded text-center text-[9px] font-medium', isGlass ? 'bg-white/10 border border-white/20' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400')}>Facebook</div>}
            {design.socialLogin.apple && <div className={cn('flex-1 py-1.5 rounded text-center text-[9px] font-medium', isGlass ? 'bg-white/10 border border-white/20' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400')}>Apple</div>}
          </div>
        )}

        {/* Connect Button */}
        <div className={cn(btnCls, 'w-full text-center cursor-pointer')} style={{ background: design.brandColor }}>
          <span className="flex items-center justify-center gap-1.5">
            <Wifi className="h-3.5 w-3.5" />Connect
            <ArrowRight className="h-3 w-3 ml-1" />
          </span>
        </div>
      </div>

      {/* Amenities */}
      {s.showAmenities && s.amenities.length > 0 && (
        <div className="w-full max-w-[240px]">
          <div className="grid grid-cols-3 gap-1.5">
            {s.amenities.slice(0, 6).map((am) => {
              const AmIcon = AMENITY_ICONS[am] || Star;
              return (
                <div key={am} className={cn('flex flex-col items-center gap-0.5 p-1.5 rounded', isGlass ? 'bg-white/5' : 'bg-black/5')}>
                  <AmIcon className={cn('h-3 w-3', isGlass ? 'text-white/60' : 'text-gray-500')} />
                  <span className="text-[7px] text-center leading-tight opacity-70">{am}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Social Links */}
      {s.showSocialMedia && (
        <div className="flex items-center gap-3">
          {s.socialLinks.filter((l) => l.url).map((l) => {
            const SIcon = l.platform === 'instagram' ? Instagram : l.platform === 'facebook' ? Facebook : Twitter;
            return <SIcon key={l.platform} className="h-3.5 w-3.5 opacity-50 hover:opacity-100 cursor-pointer transition-opacity" />;
          })}
        </div>
      )}

      {/* Clock */}
      {s.showClock && (
        <div className="flex items-center gap-1 text-[10px] opacity-50">
          <Clock className="h-3 w-3" />
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-[8px] opacity-30 mt-2">
        <p>Powered by StaySuite Hospitality OS</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mini Layout Preview — Visual thumbnail for layout selection
// ═══════════════════════════════════════════════════════════════════════════════

function LayoutMiniPreview({ layout }: { layout: string }) {
  const outerCls = 'w-12 h-8 rounded border border-gray-300 relative overflow-hidden';
  const formCls = 'absolute bg-teal-500/30 border border-teal-400/50 rounded-sm';

  switch (layout) {
    case 'centered':
      return (
        <div className={outerCls} style={{ background: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)' }}>
          <div className={cn(formCls, 'w-6 h-4 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded')} />
        </div>
      );
    case 'split_left':
      return (
        <div className={outerCls}>
          <div className="absolute left-0 top-0 w-5 h-full bg-gradient-to-br from-teal-400/30 to-emerald-400/30" />
          <div className={cn(formCls, 'right-1 top-1/2 -translate-y-1/2 w-5 h-5')} />
        </div>
      );
    case 'split_right':
      return (
        <div className={outerCls}>
          <div className={cn(formCls, 'left-1 top-1/2 -translate-y-1/2 w-5 h-5')} />
          <div className="absolute right-0 top-0 w-5 h-full bg-gradient-to-br from-teal-400/30 to-emerald-400/30" />
        </div>
      );
    case 'card':
      return (
        <div className={outerCls} style={{ background: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)' }}>
          <div className={cn(formCls, 'w-7 h-5 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-md')} />
        </div>
      );
    case 'full_bleed':
      return (
        <div className={outerCls}>
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/30 to-blue-500/30" />
          <div className={cn(formCls, 'w-7 h-4 left-1/2 bottom-1.5 -translate-x-1/2 backdrop-blur bg-white/20')} />
        </div>
      );
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 3: Voucher Designer
// ═══════════════════════════════════════════════════════════════════════════════

interface VoucherGuest {
  id: string; guestName: string; roomNumber: string; status: string;
  username?: string; password?: string; ssid?: string; validUntil?: string;
}

function VoucherDesignerTab({ portalOptions }: { portalOptions: Array<{ id: string; name: string }> }) {
  const [template, setTemplate] = useState('default');
  const [guests, setGuests] = useState<VoucherGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGuest, setSelectedGuest] = useState<VoucherGuest | null>(null);
  const { propertyId } = usePropertyId();
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await apiFetch<any>(`/api/wifi/portal/vouchers?propertyId=${propertyId || 'default'}`);
      if (data && Array.isArray(data)) {
        setGuests(data.map((g: any) => ({
          id: g.id || g.bookingId || '', guestName: g.guestName || 'Guest', roomNumber: g.roomNumber || '---',
          status: g.status || 'pending', username: g.username || '', password: g.password || '',
          ssid: g.ssid || 'Guest-WiFi', validUntil: g.validUntil || g.checkOut || '',
        })));
      } else {
        setGuests([]);
      }
      setLoading(false);
    }
    void load();
  }, [propertyId]);

  const handlePrint = (guest: VoucherGuest) => {
    setSelectedGuest(guest);
    toast({ title: 'Printing voucher', description: `Voucher for ${guest.guestName} sent to printer` });
    setTimeout(() => window.print(), 500);
  };

  const handlePrintAll = () => {
    toast({ title: 'Printing all vouchers', description: `${guests.length} vouchers sent to printer` });
    setTimeout(() => window.print(), 500);
  };

  const voucherStyle = useMemo(() => {
    switch (template) {
      case 'luxury': return { bg: 'bg-gray-900', text: 'text-amber-50', accent: 'text-amber-400 dark:text-amber-300', border: 'border-amber-600/30', cardBg: 'bg-gray-800' };
      case 'elegant': return { bg: 'bg-gradient-to-br from-slate-50 to-slate-100', text: 'text-slate-800', accent: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200', cardBg: 'bg-white' };
      case 'minimal': return { bg: 'bg-white', text: 'text-gray-800', accent: 'text-teal-500 dark:text-teal-400', border: 'border-gray-200', cardBg: 'bg-white' };
      default: return { bg: 'bg-white', text: 'text-gray-800', accent: 'text-teal-600 dark:text-teal-400', border: 'border-teal-100', cardBg: 'bg-white' };
    }
  }, [template]);

  return (
    <div className="space-y-4">
      {/* Template Selector */}
      <div className="flex items-center gap-3">
        <Label className="text-sm font-medium">Voucher Template:</Label>
        <div className="flex gap-2">
          {VOUCHER_TEMPLATES.map((vt) => (
            <Tooltip key={vt.value}>
              <TooltipTrigger asChild>
                <button onClick={() => setTemplate(vt.value)}
                  className={cn('px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-all',
                    template === vt.value ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:border-teal-300'
                  )}>
                  {vt.label}
                </button>
              </TooltipTrigger>
              <TooltipContent>{vt.desc}</TooltipContent>
            </Tooltip>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={handlePrintAll} className="ml-auto"><Printer className="h-4 w-4 mr-1.5" />Print All</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Guests Table */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Today&apos;s Check-ins</CardTitle></CardHeader>
          <CardContent>
            {loading ? (<div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>) : (
              <Table>
                <TableHeader><TableRow><TableHead className="text-xs">Guest</TableHead><TableHead className="text-xs">Room</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs w-16"></TableHead></TableRow></TableHeader>
                <TableBody>
                  {guests.map((g) => (
                    <TableRow key={g.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedGuest(g)}>
                      <TableCell className="text-xs font-medium py-2">{g.guestName}</TableCell>
                      <TableCell className="text-xs py-2 font-mono">{g.roomNumber}</TableCell>
                      <TableCell className="text-xs py-2">
                        <Badge variant={g.status === 'printed' ? 'secondary' : 'outline'} className={cn('text-[10px]', g.status === 'printed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300')}>
                          {g.status === 'printed' ? 'Printed' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handlePrint(g); }}>
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Voucher Preview */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Eye className="h-4 w-4" />Voucher Preview</CardTitle></CardHeader>
          <CardContent className="flex justify-center p-6">
            {selectedGuest ? (
            <div className={cn('w-[300px] rounded-xl border p-6 space-y-4 shadow-lg', voucherStyle.bg, voucherStyle.border)}>
              {/* Header */}
              <div className="text-center space-y-1">
                <Building className={cn('h-8 w-8 mx-auto', voucherStyle.accent)} />
                <h3 className={cn('text-lg font-bold', voucherStyle.text)}>StaySuite Hotel</h3>
                <p className={cn('text-xs opacity-60', voucherStyle.text)}>WiFi Access Credentials</p>
              </div>
              <Separator />
              {/* Guest Info */}
              <div className="space-y-2">
                <div className={cn('grid grid-cols-2 gap-3 text-xs', voucherStyle.text)}>
                  <div><p className="opacity-50 text-[10px] uppercase">Guest</p><p className="font-semibold">{selectedGuest.guestName}</p></div>
                  <div><p className="opacity-50 text-[10px] uppercase">Room</p><p className="font-semibold font-mono">{selectedGuest.roomNumber}</p></div>
                  <div><p className="opacity-50 text-[10px] uppercase">Network</p><p className="font-semibold">{selectedGuest.ssid}</p></div>
                  <div><p className="opacity-50 text-[10px] uppercase">Valid Until</p><p className="font-semibold">{selectedGuest.validUntil}</p></div>
                </div>
              </div>
              <Separator />
              {/* Credentials */}
              <div className={cn('rounded-lg p-4 text-center space-y-2', template === 'luxury' ? 'bg-gray-700' : 'bg-muted/50')}>
                <p className={cn('text-[10px] font-semibold uppercase tracking-wider opacity-50', voucherStyle.text)}>WiFi Credentials</p>
                <div className="space-y-1.5">
                  <div><p className={cn('text-[10px] opacity-50', voucherStyle.text)}>Username</p><p className={cn('text-sm font-mono font-bold', voucherStyle.text)}>{selectedGuest.username}</p></div>
                  <div><p className={cn('text-[10px] opacity-50', voucherStyle.text)}>Password</p><p className={cn('text-sm font-mono font-bold tracking-wider', voucherStyle.accent)}>{selectedGuest.password}</p></div>
                </div>
              </div>
              {/* QR Code Placeholder */}
              <div className="flex justify-center">
                <div className={cn('w-20 h-20 rounded-lg flex items-center justify-center', template === 'luxury' ? 'bg-gray-700' : 'bg-muted/30')}>
                  <QrCode className={cn('h-10 w-10', voucherStyle.accent)} />
                </div>
              </div>
              <p className={cn('text-center text-[9px] opacity-40', voucherStyle.text)}>Scan QR code or enter credentials manually</p>
            </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <UserRound className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm font-medium">Select a guest to preview voucher</p>
                <p className="text-xs mt-1 opacity-60">Click a row from the check-ins table</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 5: Walled Garden / Portal Whitelist
// ═══════════════════════════════════════════════════════════════════════════════

function WhitelistTab() {
  return <PortalWhitelist />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 4: Print WiFi Cards
// ═══════════════════════════════════════════════════════════════════════════════

function PrintCardsTab() {
  const [hotelName, setHotelName] = useState('StaySuite Hotel');
  const [guestName, setGuestName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [ssid, setSsid] = useState('HotelWiFi');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Printer className="h-4 w-4" />Card Configuration</CardTitle>
          <p className="text-xs text-muted-foreground">Fill in the details to generate a printable WiFi login card</p>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Hotel Name</Label><Input value={hotelName} onChange={e => setHotelName(e.target.value)} placeholder="StaySuite Hotel" /></div>
            <div className="space-y-2"><Label>Network (SSID)</Label><Input value={ssid} onChange={e => setSsid(e.target.value)} placeholder="HotelWiFi" /></div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Guest Name</Label><Input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="John Smith" /></div>
            <div className="space-y-2"><Label>Room Number</Label><Input value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="301" /></div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Username *</Label><Input value={username} onChange={e => setUsername(e.target.value)} placeholder="guest301" /></div>
            <div className="space-y-2"><Label>Password *</Label><Input value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type="password" /></div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Valid From</Label><Input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} /></div>
            <div className="space-y-2"><Label>Valid Until</Label><Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Live Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" />Card Preview</CardTitle>
          <p className="text-xs text-muted-foreground">Preview the card before printing</p>
        </CardHeader>
        <CardContent>
          {username && password ? (
            <PrintCard
              hotelName={hotelName}
              guestName={guestName || undefined}
              roomNumber={roomNumber || undefined}
              ssid={ssid}
              username={username}
              password={password}
              validFrom={validFrom || undefined}
              validUntil={validUntil || undefined}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-full bg-muted/50 mb-4"><QrCode className="h-10 w-10 text-muted-foreground" /></div>
              <p className="text-sm text-muted-foreground">Enter username and password to preview the card</p>
              <p className="text-xs text-muted-foreground mt-1">The card includes a QR code for easy WiFi connection</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
