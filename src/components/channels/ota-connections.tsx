'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import {
  Globe,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  Check,
  X,
  AlertTriangle,
  Clock,
  Wifi,
  WifiOff,
  Power,
  PowerOff,
  MoreVertical,
  Zap,
  Search,
  Star,
  AlertCircle,
  CheckCircle2,
  Info,
  ExternalLink,
  Link2,
  Key,
  Lock,
  User,
  Building,
  Eye,
  EyeOff,
  Loader2,
  Edit,
  Save,
  TestTube,
  ChevronRight,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

// ============================================
// TYPES
// ============================================

interface OTAAuthConfig {
  type: 'api_key' | 'oauth2' | 'basic' | 'bearer' | 'signature' | 'certificate';
  fields: OTAField[];
}

interface OTAField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'url' | 'number' | 'textarea';
  placeholder: string;
  required: boolean;
  description?: string;
  default?: string;
}

interface OTAChannelMeta {
  id: string;
  name: string;
  displayName: string;
  logo: string;
  color: string;
  region: string;
  type: string;
  priority: string;
  features: string[];
  commission: {
    min: number;
    max: number;
    type: string;
  };
  apiConfig: {
    type: string;
    authType: string;
    baseUrl: string;
    sandboxUrl?: string;
    rateLimit: { requests: number; period: string };
    timeout: number;
    retryAttempts: number;
    requiresApproval: boolean;
    webhookSupport: boolean;
    realTimeSync: boolean;
  };
  supportedLanguages: string[];
  supportedCurrencies: string[];
  website: string;
  documentation: string;
  marketShare?: number;
  monthlyVisitors?: number;
  authFields?: OTAField[];
}

interface ChannelConnection {
  id: string;
  tenantId: string;
  channel: string;
  displayName: string | null;
  apiKey: string | null;
  apiSecret: string | null;
  username?: string | null;
  password?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  hotelId: string | null;
  propertyId?: string | null;
  endpointUrl?: string | null;
  status: string;
  lastSyncAt: Date | null;
  lastError: string | null;
  autoSync: boolean;
  syncInterval: number;
  createdAt: Date;
  updatedAt: Date;
  channelMeta?: OTAChannelMeta;
  mappingCount?: number;
  syncCount?: number;
  successfulSyncs?: number;
  failedSyncs?: number;
}

interface ApiResponse {
  success: boolean;
  data: ChannelConnection[];
  availableChannels: OTAChannelMeta[];
  allChannels: OTAChannelMeta[];
  stats: {
    totalConnections: number;
    activeConnections: number;
    pendingConnections: number;
    errorConnections: number;
  };
  otaStats: {
    total: number;
    byRegion: Record<string, number>;
    byPriority: Record<string, number>;
    criticalCount: number;
    highCount: number;
  };
}

// ============================================
// OTA AUTH FIELD CONFIGURATIONS
// ============================================

const OTA_AUTH_FIELDS: Record<string, OTAField[]> = {
  // Booking.com - Basic Auth with XML API
  booking_com: [
    { name: 'username', label: 'Username', type: 'text', placeholder: 'your-username', required: true, description: 'Booking.com Partner Center username' },
    { name: 'password', label: 'Password', type: 'password', placeholder: '••••••••', required: true, description: 'Booking.com Partner Center password' },
    { name: 'hotelId', label: 'Hotel ID', type: 'text', placeholder: '123456', required: true, description: 'Your Booking.com hotel ID' },
  ],
  
  // Expedia - OAuth2
  expedia: [
    { name: 'clientId', label: 'Client ID', type: 'text', placeholder: 'your-client-id', required: true, description: 'Expedia Partner Central API Client ID' },
    { name: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: '••••••••', required: true, description: 'Expedia Partner Central API Client Secret' },
    { name: 'hotelId', label: 'Property ID', type: 'text', placeholder: '12345', required: true, description: 'Expedia property/venue ID' },
  ],
  
  // Airbnb - OAuth2
  airbnb: [
    { name: 'clientId', label: 'Client ID', type: 'text', placeholder: 'your-client-id', required: true, description: 'Airbnb API Client ID' },
    { name: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: '••••••••', required: true, description: 'Airbnb API Client Secret' },
    { name: 'listingId', label: 'Listing ID', type: 'text', placeholder: '1234567890', required: true, description: 'Your Airbnb listing ID' },
  ],
  
  // Agoda - API Key
  agoda: [
    { name: 'apiKey', label: 'API Key', type: 'text', placeholder: 'your-api-key', required: true, description: 'Agoda Partner API Key' },
    { name: 'apiSecret', label: 'API Secret', type: 'password', placeholder: '••••••••', required: true, description: 'Agoda Partner API Secret' },
    { name: 'hotelId', label: 'Hotel ID', type: 'text', placeholder: '123456', required: true, description: 'Your Agoda hotel ID' },
  ],
  
  // Hotels.com (Expedia Group)
  hotels_com: [
    { name: 'clientId', label: 'Client ID', type: 'text', placeholder: 'your-client-id', required: true, description: 'Hotels.com API Client ID' },
    { name: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: '••••••••', required: true, description: 'Hotels.com API Client Secret' },
    { name: 'hotelId', label: 'Property ID', type: 'text', placeholder: '12345', required: true, description: 'Your property ID' },
  ],
  
  // TripAdvisor - API Key
  tripadvisor: [
    { name: 'apiKey', label: 'API Key', type: 'text', placeholder: 'your-api-key', required: true, description: 'TripAdvisor API Key' },
    { name: 'hotelId', label: 'Location ID', type: 'text', placeholder: '123456', required: true, description: 'TripAdvisor location ID' },
  ],
  
  // Vrbo - OAuth2
  vrbo: [
    { name: 'clientId', label: 'Client ID', type: 'text', placeholder: 'your-client-id', required: true, description: 'Vrbo API Client ID' },
    { name: 'clientSecret', label: 'Client Secret', type: 'password', placeholder: '••••••••', required: true, description: 'Vrbo API Client Secret' },
    { name: 'listingId', label: 'Listing ID', type: 'text', placeholder: '123456789', required: true, description: 'Your Vrbo listing ID' },
  ],
  
  // Google Hotels - XML
  google_hotels: [
    { name: 'partnerId', label: 'Partner ID', type: 'text', placeholder: 'your-partner-id', required: true, description: 'Google Hotel Ads Partner ID' },
    { name: 'apiKey', label: 'API Key', type: 'text', placeholder: 'your-api-key', required: true, description: 'Google API Key' },
    { name: 'hotelId', label: 'Hotel ID', type: 'text', placeholder: 'hotel_123', required: true, description: 'Google Hotel Center Hotel ID' },
  ],
  
  // MakeMyTrip - API Key
  makemytrip: [
    { name: 'apiKey', label: 'API Key', type: 'text', placeholder: 'your-api-key', required: true, description: 'MakeMyTrip Partner API Key' },
    { name: 'apiSecret', label: 'API Secret', type: 'password', placeholder: '••••••••', required: true, description: 'MakeMyTrip API Secret' },
    { name: 'hotelId', label: 'Hotel ID', type: 'text', placeholder: 'HOTEL123', required: true, description: 'MakeMyTrip Hotel ID' },
  ],
  
  // Goibibo - API Key
  goibibo: [
    { name: 'apiKey', label: 'API Key', type: 'text', placeholder: 'your-api-key', required: true, description: 'Goibibo Partner API Key' },
    { name: 'apiSecret', label: 'API Secret', type: 'password', placeholder: '••••••••', required: true, description: 'Goibibo API Secret' },
    { name: 'hotelId', label: 'Hotel ID', type: 'text', placeholder: 'HOTEL123', required: true, description: 'Goibibo Hotel ID' },
  ],
  
  // Yatra - API Key
  yatra: [
    { name: 'apiKey', label: 'API Key', type: 'text', placeholder: 'your-api-key', required: true, description: 'Yatra Partner API Key' },
    { name: 'apiSecret', label: 'API Secret', type: 'password', placeholder: '••••••••', required: true, description: 'Yatra API Secret' },
    { name: 'hotelId', label: 'Hotel ID', type: 'text', placeholder: 'HOTEL123', required: true, description: 'Yatra Hotel ID' },
  ],
  
  // Cleartrip - API Key
  cleartrip: [
    { name: 'apiKey', label: 'API Key', type: 'text', placeholder: 'your-api-key', required: true, description: 'Cleartrip Partner API Key' },
    { name: 'apiSecret', label: 'API Secret', type: 'password', placeholder: '••••••••', required: true, description: 'Cleartrip API Secret' },
    { name: 'hotelId', label: 'Hotel ID', type: 'text', placeholder: 'HOTEL123', required: true, description: 'Cleartrip Hotel ID' },
  ],
  
  // OYO - Bearer Token
  oyo: [
    { name: 'apiKey', label: 'Partner ID', type: 'text', placeholder: 'your-partner-id', required: true, description: 'OYO Partner ID' },
    { name: 'apiSecret', label: 'API Token', type: 'password', placeholder: '••••••••', required: true, description: 'OYO API Bearer Token' },
    { name: 'hotelId', label: 'Property ID', type: 'text', placeholder: 'OYO12345', required: true, description: 'OYO Property ID' },
  ],
  
  // EaseMyTrip - API Key
  easemytrip: [
    { name: 'apiKey', label: 'API Key', type: 'text', placeholder: 'your-api-key', required: true, description: 'EaseMyTrip API Key' },
    { name: 'hotelId', label: 'Hotel ID', type: 'text', placeholder: 'HOTEL123', required: true, description: 'EaseMyTrip Hotel ID' },
  ],
  
  // Ixigo - API Key
  ixigo: [
    { name: 'apiKey', label: 'API Key', type: 'text', placeholder: 'your-api-key', required: true, description: 'Ixigo Partner API Key' },
    { name: 'hotelId', label: 'Hotel ID', type: 'text', placeholder: 'HOTEL123', required: true, description: 'Ixigo Hotel ID' },
  ],
  
  // Travelguru - API Key
  travelguru: [
    { name: 'apiKey', label: 'API Key', type: 'text', placeholder: 'your-api-key', required: true, description: 'Travelguru API Key' },
    { name: 'apiSecret', label: 'API Secret', type: 'password', placeholder: '••••••••', required: true, description: 'Travelguru API Secret' },
    { name: 'hotelId', label: 'Hotel ID', type: 'text', placeholder: 'HOTEL123', required: true, description: 'Travelguru Hotel ID' },
  ],
  
  // FabHotels - Bearer Token
  fabhotels: [
    { name: 'apiKey', label: 'Partner ID', type: 'text', placeholder: 'your-partner-id', required: true, description: 'FabHotels Partner ID' },
    { name: 'apiSecret', label: 'API Token', type: 'password', placeholder: '••••••••', required: true, description: 'FabHotels API Token' },
    { name: 'hotelId', label: 'Property ID', type: 'text', placeholder: 'FAB12345', required: true, description: 'FabHotels Property ID' },
  ],
  
  // Treebo - Bearer Token
  treebo: [
    { name: 'apiKey', label: 'Partner ID', type: 'text', placeholder: 'your-partner-id', required: true, description: 'Treebo Partner ID' },
    { name: 'apiSecret', label: 'API Token', type: 'password', placeholder: '••••••••', required: true, description: 'Treebo API Token' },
    { name: 'hotelId', label: 'Property ID', type: 'text', placeholder: 'TREEBO12345', required: true, description: 'Treebo Property ID' },
  ],
  
  // Trip.com - API Key
  trip_com: [
    { name: 'apiKey', label: 'API Key', type: 'text', placeholder: 'your-api-key', required: true, description: 'Trip.com Open Platform API Key' },
    { name: 'apiSecret', label: 'API Secret', type: 'password', placeholder: '••••••••', required: true, description: 'Trip.com API Secret' },
    { name: 'hotelId', label: 'Hotel ID', type: 'text', placeholder: '123456', required: true, description: 'Trip.com Hotel ID' },
  ],
  
  // Traveloka - API Key
  traveloka: [
    { name: 'apiKey', label: 'API Key', type: 'text', placeholder: 'your-api-key', required: true, description: 'Traveloka Partner API Key' },
    { name: 'apiSecret', label: 'API Secret', type: 'password', placeholder: '••••••••', required: true, description: 'Traveloka API Secret' },
    { name: 'hotelId', label: 'Hotel ID', type: 'text', placeholder: 'HOTEL123', required: true, description: 'Traveloka Hotel ID' },
  ],
  
  // Hostelworld - API Key
  hostelworld: [
    { name: 'apiKey', label: 'API Key', type: 'text', placeholder: 'your-api-key', required: true, description: 'Hostelworld API Key' },
    { name: 'hotelId', label: 'Property ID', type: 'text', placeholder: '12345', required: true, description: 'Hostelworld Property ID' },
  ],
  
  // Generic REST API (default)
  default: [
    { name: 'apiKey', label: 'API Key', type: 'text', placeholder: 'your-api-key', required: true, description: 'Your API key' },
    { name: 'apiSecret', label: 'API Secret', type: 'password', placeholder: '••••••••', required: false, description: 'API secret (if required)' },
    { name: 'hotelId', label: 'Hotel/Property ID', type: 'text', placeholder: '12345', required: true, description: 'Your hotel or property ID' },
    { name: 'endpointUrl', label: 'Custom API Endpoint', type: 'url', placeholder: 'https://api.example.com', required: false, description: 'Custom API endpoint (optional)' },
  ],
};

// ============================================
// HELPER FUNCTIONS
// ============================================

const getStatusBadge = (status: string) => {
  const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
    active: { variant: 'default', className: 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white' },
    pending: { variant: 'secondary', className: 'bg-gradient-to-r from-amber-400 to-amber-500 text-white' },
    connecting: { variant: 'secondary', className: 'bg-gradient-to-r from-blue-400 to-blue-500 text-white' },
    error: { variant: 'destructive', className: 'bg-gradient-to-r from-red-500 to-red-600 text-white' },
    disconnected: { variant: 'outline', className: 'text-gray-500' },
    suspended: { variant: 'outline', className: 'bg-gray-100 text-gray-600' },
  };
  return variants[status] || { variant: 'outline', className: '' };
};

const getPriorityBadge = (priority: string) => {
  const variants: Record<string, { className: string; label: string }> = {
    critical: { className: 'bg-red-100 text-red-700 border-red-200', label: 'Critical' },
    high: { className: 'bg-orange-100 text-orange-700 border-orange-200', label: 'High' },
    medium: { className: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Medium' },
    low: { className: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Low' },
  };
  return variants[priority] || { className: '', label: priority };
};

const getRegionLabel = (region: string) => {
  const labels: Record<string, string> = {
    global: 'Global',
    india: 'India',
    asia_pacific: 'Asia Pacific',
    europe: 'Europe',
    middle_east: 'Middle East',
    africa: 'Africa',
    americas: 'Americas',
  };
  return labels[region] || region;
};

const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    ota: 'OTA',
    vacation_rental: 'Vacation Rental',
    metasearch: 'Metasearch',
    gds: 'GDS',
    wholesale: 'Wholesale',
  };
  return labels[type] || type;
};

const formatRelativeTime = (date: Date | null) => {
  if (!date) return 'Never synced';
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'Just now';
};

// ============================================
// MAIN COMPONENT
// ============================================

export default function OTAConnections() {
  const isMobile = useIsMobile();
  
  // State
  const [connections, setConnections] = useState<ChannelConnection[]>([]);
  const [availableChannels, setAvailableChannels] = useState<OTAChannelMeta[]>([]);
  const [allChannels, setAllChannels] = useState<OTAChannelMeta[]>([]);
  const [stats, setStats] = useState({
    totalConnections: 0,
    activeConnections: 0,
    pendingConnections: 0,
    errorConnections: 0,
  });
  const [otaStats, setOtaStats] = useState({
    total: 0,
    byRegion: {} as Record<string, number>,
    byPriority: {} as Record<string, number>,
    criticalCount: 0,
    highCount: 0,
  });
  
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<OTAChannelMeta | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<ChannelConnection | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [activeTab, setActiveTab] = useState('connected');
  
  const [formData, setFormData] = useState<Record<string, string>>({
    displayName: '',
    autoSync: 'true',
    syncInterval: '60',
  });
  
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/channels/connections');
      const data: ApiResponse = await response.json();
      if (data.success) {
        setConnections(data.data);
        setAvailableChannels(data.availableChannels);
        setAllChannels(data.allChannels);
        setStats(data.stats);
        setOtaStats(data.otaStats);
      }
    } catch (error) {
      console.error('Error fetching connections:', error);
      toast.error('Failed to load channel connections');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Get auth fields for channel
  const getAuthFields = useCallback((channelId: string): OTAField[] => {
    return OTA_AUTH_FIELDS[channelId] || OTA_AUTH_FIELDS.default;
  }, []);

  // Filter available channels
  const filteredChannels = useMemo(() => {
    return availableChannels.filter(channel => {
      const matchesSearch = searchQuery === '' || 
        channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        channel.displayName.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesRegion = filterRegion === 'all' || channel.region === filterRegion;
      const matchesPriority = filterPriority === 'all' || channel.priority === filterPriority;

      return matchesSearch && matchesRegion && matchesPriority;
    });
  }, [availableChannels, searchQuery, filterRegion, filterPriority]);

  // Group available channels by region
  const channelsByRegion = useMemo(() => {
    const grouped: Record<string, OTAChannelMeta[]> = {};
    filteredChannels.forEach(channel => {
      if (!grouped[channel.region]) {
        grouped[channel.region] = [];
      }
      grouped[channel.region].push(channel);
    });
    return grouped;
  }, [filteredChannels]);

  // Reset form when channel changes
  useEffect(() => {
    if (selectedChannel) {
      const fields = getAuthFields(selectedChannel.id);
      const initialData: Record<string, string> = {
        displayName: selectedChannel.displayName,
        autoSync: 'true',
        syncInterval: '60',
      };
      fields.forEach(field => {
        initialData[field.name] = field.default || '';
      });
      setFormData(initialData);
      setTestResult(null);
    }
  }, [selectedChannel, getAuthFields]);

  // Test connection
  const handleTestConnection = async () => {
    if (!selectedChannel) return;
    
    setIsTesting(true);
    setTestResult(null);
    
    try {
      const response = await fetch('/api/channels/connections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          channel: selectedChannel.id,
          credentials: formData,
        }),
      });
      
      const result = await response.json();
      setTestResult({
        success: result.success,
        message: result.message || (result.success ? 'Connection successful!' : 'Connection failed'),
      });
      
      if (result.success) {
        toast.success('Connection test successful!');
      } else {
        toast.error(result.message || 'Connection test failed');
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
      });
      toast.error('Connection test failed');
    } finally {
      setIsTesting(false);
    }
  };

  // Add connection
  const handleAddConnection = async () => {
    if (!selectedChannel) {
      toast.error('Please select a channel');
      return;
    }
    
    const fields = getAuthFields(selectedChannel.id);
    const requiredFields = fields.filter(f => f.required);
    const missingFields = requiredFields.filter(f => !formData[f.name]);
    
    if (missingFields.length > 0) {
      toast.error(`Please fill in: ${missingFields.map(f => f.label).join(', ')}`);
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/channels/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: selectedChannel.id,
          ...formData,
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Channel connection created successfully!');
        setShowAddDialog(false);
        setSelectedChannel(null);
        setFormData({
          displayName: '',
          autoSync: 'true',
          syncInterval: '60',
        });
        setTestResult(null);
        fetchData();
      } else {
        toast.error(result.error?.message || 'Failed to create connection');
      }
    } catch {
      toast.error('Failed to create connection');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle action (connect, disconnect, sync, test)
  const handleAction = async (connectionId: string, action: string) => {
    setActionInProgress(connectionId);
    
    try {
      const response = await fetch('/api/channels/connections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: connectionId, action }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success(result.message || `Action "${action}" completed successfully`);
        fetchData();
      } else {
        toast.error(result.error?.message || `Action "${action}" failed`);
      }
    } catch {
      toast.error(`Action "${action}" failed`);
    } finally {
      setActionInProgress(null);
    }
  };

  // Delete connection
  const handleDelete = (connectionId: string) => {
    setDeleteItemId(connectionId);
  };

  const confirmDelete = async () => {
    if (!deleteItemId) return;

    try {
      const response = await fetch(`/api/channels/connections?id=${deleteItemId}`, {
        method: 'DELETE',
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Connection deleted successfully');
        fetchData();
      } else {
        toast.error(result.error?.message || 'Failed to delete connection');
      }
    } catch {
      toast.error('Failed to delete connection');
    } finally {
      setDeleteItemId(null);
    }
  };

  // Update settings
  const handleUpdateSettings = async () => {
    if (!selectedConnection) return;
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/channels/connections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedConnection.id,
          ...formData,
        }),
      });

      const result = await response.json();
      if (result.success) {
        toast.success('Settings updated successfully');
        setShowSettingsDialog(false);
        fetchData();
      } else {
        toast.error(result.error?.message || 'Failed to update settings');
      }
    } catch {
      toast.error('Failed to update settings');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render credential fields
  const renderCredentialFields = (channel: OTAChannelMeta, isEdit: boolean = false) => {
    const fields = getAuthFields(channel.id);
    
    return fields.map((field) => (
      <div key={field.name} className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={field.name} className="flex items-center gap-2">
            {field.label}
            {field.required && <span className="text-red-500">*</span>}
          </Label>
          {field.type === 'password' && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2"
              onClick={() => setShowPasswords(prev => ({ ...prev, [field.name]: !prev[field.name] }))}
            >
              {showPasswords[field.name] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            </Button>
          )}
        </div>
        <Input
          id={field.name}
          type={field.type === 'password' && !showPasswords[field.name] ? 'password' : 'text'}
          placeholder={field.placeholder}
          value={formData[field.name] || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, [field.name]: e.target.value }))}
          disabled={isEdit && ['apiKey', 'apiSecret', 'password'].includes(field.name)}
        />
        {field.description && (
          <p className="text-xs text-muted-foreground">{field.description}</p>
        )}
      </div>
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Mobile Add Dialog (Sheet)
  const AddChannelSheet = () => (
    <Sheet open={showAddDialog} onOpenChange={setShowAddDialog}>
      <SheetContent side="bottom" className="h-[95vh] px-0 flex flex-col">
        <SheetHeader className="px-4 flex-shrink-0">
          <SheetTitle>Add Channel Connection</SheetTitle>
          <SheetDescription>
            Connect to {selectedChannel ? selectedChannel.displayName : 'an Online Travel Agency'}
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="flex-1 px-4 overflow-y-auto" style={{ height: 'calc(95vh - 180px)' }}>
          {!selectedChannel ? (
            // Channel Selection
            <div className="space-y-4 py-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search channels..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <div className="flex gap-2">
                <Select value={filterRegion} onValueChange={setFilterRegion}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="india">India</SelectItem>
                    <SelectItem value="asia_pacific">Asia Pacific</SelectItem>
                    <SelectItem value="europe">Europe</SelectItem>
                    <SelectItem value="middle_east">Middle East</SelectItem>
                    <SelectItem value="africa">Africa</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {Object.entries(channelsByRegion).map(([region, channels]) => (
                <div key={region} className="space-y-2">
                  <Badge variant="outline" className="text-xs">
                    {getRegionLabel(region)} ({channels.length})
                  </Badge>
                  <div className="space-y-2">
                    {channels.map((channel) => (
                      <button
                        key={channel.id}
                        onClick={() => setSelectedChannel(channel)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 text-left transition-colors"
                      >
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                          style={{ backgroundColor: channel.color }}
                        >
                          {channel.logo}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{channel.displayName}</span>
                            {channel.priority === 'critical' && (
                              <Star className="h-3 w-3 text-amber-500 flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{getTypeLabel(channel.type)}</span>
                            <span>•</span>
                            <span>{channel.commission.min}-{channel.commission.max}%</span>
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Channel Configuration Form
            <div className="space-y-4 py-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedChannel(null);
                  setTestResult(null);
                }}
                className="mb-2"
              >
                ← Back to channels
              </Button>
              
              {/* Channel Info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: selectedChannel.color }}
                >
                  {selectedChannel.logo}
                </div>
                <div>
                  <h3 className="font-semibold">{selectedChannel.displayName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedChannel.apiConfig.authType.toUpperCase()} Authentication
                    {selectedChannel.apiConfig.webhookSupport && ' • Webhooks'}
                    {selectedChannel.apiConfig.realTimeSync && ' • Real-time Sync'}
                  </p>
                </div>
              </div>
              
              {/* Test Result */}
              {testResult && (
                <Alert variant={testResult.success ? 'default' : 'destructive'} className={testResult.success ? 'border-emerald-500 bg-emerald-50' : ''}>
                  {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  <AlertTitle>{testResult.success ? 'Success' : 'Error'}</AlertTitle>
                  <AlertDescription>{testResult.message}</AlertDescription>
                </Alert>
              )}
              
              {/* Credential Fields */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Key className="h-4 w-4" />
                  API Credentials
                </div>
                {renderCredentialFields(selectedChannel)}
              </div>
              
              <Separator />
              
              {/* Sync Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Settings className="h-4 w-4" />
                  Sync Settings
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    placeholder={selectedChannel.displayName}
                    value={formData.displayName || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                  />
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <Label>Auto Sync</Label>
                    <p className="text-xs text-muted-foreground">Automatically sync inventory and rates</p>
                  </div>
                  <Switch
                    checked={formData.autoSync === 'true'}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, autoSync: checked ? 'true' : 'false' }))}
                  />
                </div>
                
                {formData.autoSync === 'true' && (
                  <div className="space-y-2">
                    <Label>Sync Interval</Label>
                    <Select
                      value={formData.syncInterval || '60'}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, syncInterval: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">Every 15 minutes</SelectItem>
                        <SelectItem value="30">Every 30 minutes</SelectItem>
                        <SelectItem value="60">Every hour</SelectItem>
                        <SelectItem value="120">Every 2 hours</SelectItem>
                        <SelectItem value="360">Every 6 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              
              {/* Documentation Link */}
              <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
                <Info className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <p className="text-sm text-blue-700">
                  Need API credentials?{' '}
                  <a
                    href={selectedChannel.documentation}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline font-medium"
                  >
                    View {selectedChannel.displayName} documentation
                  </a>
                </p>
              </div>
            </div>
          )}
        </ScrollArea>
        
        {selectedChannel && (
          <SheetFooter className="px-4 py-4 border-t bg-background flex-shrink-0 sticky bottom-0">
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleTestConnection}
                disabled={isTesting || isSubmitting}
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                Test
              </Button>
              <Button
                className="flex-1"
                onClick={handleAddConnection}
                disabled={isSubmitting || isTesting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add Connection
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );

  // Desktop Add Dialog
  const AddChannelDialog = () => (
    <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Channel Connection</DialogTitle>
          <DialogDescription>
            Connect to {selectedChannel ? selectedChannel.displayName : 'an Online Travel Agency'}
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 -mx-6 px-6">
          {!selectedChannel ? (
            // Channel Selection
            <div className="space-y-4 py-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search channels..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={filterRegion} onValueChange={setFilterRegion}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    <SelectItem value="global">Global</SelectItem>
                    <SelectItem value="india">India</SelectItem>
                    <SelectItem value="asia_pacific">Asia Pacific</SelectItem>
                    <SelectItem value="europe">Europe</SelectItem>
                    <SelectItem value="middle_east">Middle East</SelectItem>
                    <SelectItem value="africa">Africa</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {Object.entries(channelsByRegion).map(([region, channels]) => (
                <div key={region}>
                  <Badge variant="outline" className="mb-2">
                    {getRegionLabel(region)} ({channels.length})
                  </Badge>
                  <div className="grid grid-cols-2 gap-2">
                    {channels.map((channel) => (
                      <button
                        key={channel.id}
                        onClick={() => setSelectedChannel(channel)}
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                          formData.channel === channel.id
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                        )}
                      >
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                          style={{ backgroundColor: channel.color }}
                        >
                          {channel.logo}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate text-sm">{channel.displayName}</span>
                            {channel.priority === 'critical' && (
                              <Star className="h-3 w-3 text-amber-500 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {channel.commission.min}-{channel.commission.max}% • {getTypeLabel(channel.type)}
                          </p>
                        </div>
                        {formData.channel === channel.id && (
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Channel Configuration Form
            <div className="space-y-4 py-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedChannel(null);
                  setTestResult(null);
                }}
              >
                ← Back to channels
              </Button>
              
              {/* Channel Info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                <div
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: selectedChannel.color }}
                >
                  {selectedChannel.logo}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{selectedChannel.displayName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedChannel.apiConfig.authType.toUpperCase()} Authentication
                    {selectedChannel.apiConfig.webhookSupport && ' • Webhooks'}
                    {selectedChannel.apiConfig.realTimeSync && ' • Real-time Sync'}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                >
                  <a href={selectedChannel.documentation} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Docs
                  </a>
                </Button>
              </div>
              
              {/* Test Result */}
              {testResult && (
                <Alert variant={testResult.success ? 'default' : 'destructive'} className={testResult.success ? 'border-emerald-500 bg-emerald-50' : ''}>
                  {testResult.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                  <AlertTitle>{testResult.success ? 'Success' : 'Error'}</AlertTitle>
                  <AlertDescription>{testResult.message}</AlertDescription>
                </Alert>
              )}
              
              <Separator />
              
              {/* Credential Fields */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Key className="h-4 w-4" />
                  API Credentials
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {renderCredentialFields(selectedChannel)}
                </div>
              </div>
              
              <Separator />
              
              {/* Sync Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Settings className="h-4 w-4" />
                  Sync Settings
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Display Name</Label>
                    <Input
                      id="displayName"
                      placeholder={selectedChannel.displayName}
                      value={formData.displayName || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Sync Interval</Label>
                    <Select
                      value={formData.syncInterval || '60'}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, syncInterval: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">Every 15 minutes</SelectItem>
                        <SelectItem value="30">Every 30 minutes</SelectItem>
                        <SelectItem value="60">Every hour</SelectItem>
                        <SelectItem value="120">Every 2 hours</SelectItem>
                        <SelectItem value="360">Every 6 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <Label>Auto Sync</Label>
                    <p className="text-xs text-muted-foreground">Automatically sync inventory and rates</p>
                  </div>
                  <Switch
                    checked={formData.autoSync === 'true'}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, autoSync: checked ? 'true' : 'false' }))}
                  />
                </div>
              </div>
            </div>
          )}
        </ScrollArea>
        
        {selectedChannel && (
          <DialogFooter className="pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleTestConnection}
              disabled={isTesting || isSubmitting}
            >
              {isTesting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <TestTube className="h-4 w-4 mr-2" />
              )}
              Test Connection
            </Button>
            <Button
              onClick={handleAddConnection}
              disabled={isSubmitting || isTesting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Add Connection
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">OTA Connections</h1>
          <p className="text-muted-foreground">
            Manage connections to {otaStats.total} Online Travel Agencies
          </p>
        </div>
        <Button className="gap-2 w-full sm:w-auto bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-md hover:shadow-lg hover:shadow-blue-500/25 transition-all duration-200" onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4" />
          Add Channel
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-600/5 border-emerald-500/20 hover:shadow-lg hover:shadow-emerald-500/10 transition-all duration-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Globe className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalConnections}</p>
                <p className="text-xs text-muted-foreground">Connected</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border-cyan-500/20 hover:shadow-lg hover:shadow-cyan-500/10 transition-all duration-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/20">
                <Wifi className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeConnections}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 border-amber-500/20 hover:shadow-lg hover:shadow-amber-500/10 transition-all duration-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pendingConnections}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-600/5 border-red-500/20 hover:shadow-lg hover:shadow-red-500/10 transition-all duration-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/20">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.errorConnections}</p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Integration Progress</span>
            <span className="text-sm text-muted-foreground">
              {stats.activeConnections} of {otaStats.total} channels
            </span>
          </div>
          <Progress value={(stats.activeConnections / otaStats.total) * 100} className="h-2 [&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-teal-500" />
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="connected">
            Connected ({connections.length})
          </TabsTrigger>
          <TabsTrigger value="marketplace">
            Marketplace ({availableChannels.length})
          </TabsTrigger>
        </TabsList>

        {/* Connected Tab */}
        <TabsContent value="connected" className="space-y-4">
          {connections.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Globe className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Channel Connections</h3>
                <p className="text-muted-foreground text-center max-w-md mb-4">
                  Connect to OTAs like Booking.com, MakeMyTrip, Airbnb, and 45+ more channels.
                </p>
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Channel
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {connections.map((connection) => {
                const statusInfo = getStatusBadge(connection.status);
                const priorityInfo = getPriorityBadge(connection.channelMeta?.priority || 'medium');
                const isLoading = actionInProgress === connection.id;
                
                return (
                  <Card key={connection.id} className="overflow-hidden hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
                            style={{ backgroundColor: connection.channelMeta?.color || '#6B7280' }}
                          >
                            {connection.channelMeta?.logo || connection.channel.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <CardTitle className="text-base">
                              {connection.displayName || connection.channelMeta?.displayName}
                            </CardTitle>
                            <CardDescription className="text-xs flex items-center gap-2">
                              <Badge className={priorityInfo.className} variant="outline">
                                {priorityInfo.label}
                              </Badge>
                            </CardDescription>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => {
                                setSelectedConnection(connection);
                                const fields = getAuthFields(connection.channel);
                                const initialData: Record<string, string> = {
                                  displayName: connection.displayName || '',
                                  autoSync: connection.autoSync ? 'true' : 'false',
                                  syncInterval: connection.syncInterval.toString(),
                                  apiKey: connection.apiKey || '',
                                  apiSecret: connection.apiSecret || '',
                                  hotelId: connection.hotelId || '',
                                };
                                fields.forEach(f => {
                                  if (!initialData[f.name]) initialData[f.name] = '';
                                });
                                setFormData(initialData);
                                setShowSettingsDialog(true);
                              }}
                            >
                              <Settings className="h-4 w-4 mr-2" />
                              Settings
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleAction(connection.id, 'test')}>
                              <TestTube className="h-4 w-4 mr-2" />
                              Test Connection
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleAction(connection.id, 'sync')}>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Sync Now
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {connection.status === 'active' ? (
                              <DropdownMenuItem onClick={() => handleAction(connection.id, 'disconnect')}>
                                <PowerOff className="h-4 w-4 mr-2" />
                                Disconnect
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleAction(connection.id, 'connect')}>
                                <Power className="h-4 w-4 mr-2" />
                                Connect
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDelete(connection.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Status */}
                      <div className="flex items-center justify-between">
                        <Badge className={statusInfo.className} variant={statusInfo.variant}>
                          {connection.status === 'active' && <Check className="h-3 w-3 mr-1" />}
                          {connection.status === 'error' && <X className="h-3 w-3 mr-1" />}
                          {connection.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                          {connection.status === 'disconnected' && <WifiOff className="h-3 w-3 mr-1" />}
                          {connection.status.charAt(0).toUpperCase() + connection.status.slice(1)}
                        </Badge>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatRelativeTime(connection.lastSyncAt)}
                        </div>
                      </div>

                      {/* Error Message */}
                      {connection.lastError && (
                        <div className="p-2 rounded-md bg-red-50 border border-red-200">
                          <p className="text-xs text-red-600 truncate">{connection.lastError}</p>
                        </div>
                      )}

                      {/* Sync Stats */}
                      <div className="grid grid-cols-2 gap-2 text-center">
                        <div className="p-2 rounded-md bg-emerald-50 dark:bg-emerald-950/20">
                          <p className="text-lg font-semibold text-emerald-600">{connection.successfulSyncs || 0}</p>
                          <p className="text-xs text-muted-foreground">Successful</p>
                        </div>
                        <div className="p-2 rounded-md bg-red-50 dark:bg-red-950/20">
                          <p className="text-lg font-semibold text-red-600">{connection.failedSyncs || 0}</p>
                          <p className="text-xs text-muted-foreground">Failed</p>
                        </div>
                      </div>

                      {/* Auto Sync Toggle */}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="flex items-center gap-2">
                          <Zap className={`h-4 w-4 ${connection.autoSync ? 'text-amber-500' : 'text-muted-foreground'}`} />
                          <span className="text-sm">Auto-sync</span>
                        </div>
                        <Switch
                          checked={connection.autoSync}
                          onCheckedChange={(checked) => handleAction(connection.id, checked ? 'enable_sync' : 'disable_sync')}
                        />
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1"
                          onClick={() => handleAction(connection.id, 'sync')}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3 w-3 mr-1" />
                          )}
                          Sync
                        </Button>
                        <Button
                          variant={connection.status === 'active' ? 'destructive' : 'default'}
                          size="sm"
                          className="flex-1"
                          onClick={() => handleAction(connection.id, connection.status === 'active' ? 'disconnect' : 'connect')}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : connection.status === 'active' ? (
                            <>
                              <WifiOff className="h-3 w-3 mr-1" />
                              Disconnect
                            </>
                          ) : (
                            <>
                              <Wifi className="h-3 w-3 mr-1" />
                              Connect
                            </>
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Marketplace Tab */}
        <TabsContent value="marketplace" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1 focus-within:ring-2 focus-within:ring-primary/20 rounded-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search channels..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterRegion} onValueChange={setFilterRegion}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Regions</SelectItem>
                <SelectItem value="global">Global</SelectItem>
                <SelectItem value="india">India</SelectItem>
                <SelectItem value="asia_pacific">Asia Pacific</SelectItem>
                <SelectItem value="europe">Europe</SelectItem>
                <SelectItem value="middle_east">Middle East</SelectItem>
                <SelectItem value="africa">Africa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-full sm:w-[120px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {Object.entries(channelsByRegion).map(([region, channels]) => (
            <div key={region}>
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Badge variant="outline">{getRegionLabel(region)}</Badge>
                <span className="text-sm font-normal text-muted-foreground">
                  {channels.length} channels
                </span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {channels.map((channel) => (
                  <Card key={channel.id} className="hover:shadow-lg hover:shadow-primary/5 transition-all duration-200">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div
                          className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
                          style={{ backgroundColor: channel.color }}
                        >
                          {channel.logo}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="font-semibold truncate">{channel.displayName}</h4>
                            {channel.priority === 'critical' && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <Star className="h-4 w-4 text-amber-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>Critical Priority</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {getTypeLabel(channel.type)} • {channel.commission.min}-{channel.commission.max}%
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-3">
                        <Badge className={getPriorityBadge(channel.priority).className} variant="outline">
                          {channel.priority}
                        </Badge>
                        {channel.apiConfig.realTimeSync && (
                          <Badge variant="outline" className="text-xs">
                            <Zap className="h-3 w-3 mr-1" />
                            Real-time
                          </Badge>
                        )}
                      </div>

                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => {
                            setSelectedChannel(channel);
                            setShowAddDialog(true);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Connect
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                        >
                          <a href={channel.documentation} target="_blank" rel="noopener noreferrer">
                            <Info className="h-4 w-4" />
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {/* Add Dialog - Mobile or Desktop */}
      {isMobile ? <AddChannelSheet /> : <AddChannelDialog />}

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Connection Settings</DialogTitle>
            <DialogDescription>
              {selectedConnection?.displayName || selectedConnection?.channelMeta?.displayName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Display Name</Label>
              <Input
                value={formData.displayName || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, displayName: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Sync Interval</Label>
              <Select
                value={formData.syncInterval || '60'}
                onValueChange={(value) => setFormData(prev => ({ ...prev, syncInterval: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">Every 15 minutes</SelectItem>
                  <SelectItem value="30">Every 30 minutes</SelectItem>
                  <SelectItem value="60">Every hour</SelectItem>
                  <SelectItem value="120">Every 2 hours</SelectItem>
                  <SelectItem value="360">Every 6 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label>Auto Sync</Label>
                <p className="text-xs text-muted-foreground">Automatically sync inventory and rates</p>
              </div>
              <Switch
                checked={formData.autoSync === 'true'}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, autoSync: checked ? 'true' : 'false' }))}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateSettings} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteItemId} onOpenChange={(open) => !open && setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Connection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this connection? All mappings and sync logs will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
