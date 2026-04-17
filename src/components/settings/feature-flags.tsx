'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from '@/components/ui/accordion';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { 
  Loader2, 
  Save,  
  RefreshCw,
  CheckCircle2,
  XCircle,
  Menu,
  ChevronDown,
  Lock,
  Sparkles,
  Building,
  Wifi,
  TrendingUp,
  Megaphone,
  BarChart3,
  Calendar,
  Users,
  Shield,
  Plug,
  Crown,
  Settings,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  FEATURES, 
  FEATURE_CATEGORIES, 
  ADDON_SUBCATEGORIES,
  getBaseFeatures,
  getAddonFeatures,
  type FeatureConfig 
} from '@/lib/feature-flags';
import { navigationConfig } from '@/config/navigation';
import { SectionGuard } from '@/components/common/section-guard';

interface FeatureData {
  id: string;
  name: string;
  key: string;
  enabled: boolean;
  description: string;
  category: string;
  subcategory?: string;
  menuItems: string[];
  alwaysEnabled?: boolean;
}

// Icon mapping for subcategories
const subcategoryIcons: Record<string, React.ReactNode> = {
  'Guest Experience': <Sparkles className="h-4 w-4" />,
  'Facility Management': <Building className="h-4 w-4" />,
  'Connectivity': <Wifi className="h-4 w-4" />,
  'Revenue & Channels': <TrendingUp className="h-4 w-4" />,
  'Marketing & CRM': <Megaphone className="h-4 w-4" />,
  'Analytics': <BarChart3 className="h-4 w-4" />,
  'Events': <Calendar className="h-4 w-4" />,
  'Staff Management': <Users className="h-4 w-4" />,
  'Security': <Shield className="h-4 w-4" />,
  'Integrations & Automation': <Plug className="h-4 w-4" />,
  'Enterprise': <Crown className="h-4 w-4" />,
  'System': <Settings className="h-4 w-4" />,
};

export default function FeatureFlags() {
  const [features, setFeatures] = useState<FeatureData[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  useEffect(() => {
    fetchFeatureFlags();
  }, []);

  const fetchFeatureFlags = async () => {
    try {
      const response = await fetch('/api/settings/feature-flags');
      const data = await response.json();
      if (data.success) {
        // Convert stored features to our format
        const storedFeatures = data.data.features || [];
        const featureMap = new Map(storedFeatures.map((f: { key: string }) => [f.key, f]));
        
        // Build complete features list from FEATURES config
        const completeFeatures: FeatureData[] = Object.values(FEATURES).map(config => ({
          id: config.id,
          name: config.name,
          key: config.id,
          enabled: featureMap.has(config.id) ? (featureMap.get(config.id) as { enabled: boolean }).enabled : config.alwaysEnabled || false,
          description: config.description,
          category: config.category,
          subcategory: config.subcategory,
          menuItems: config.menuItems,
          alwaysEnabled: config.alwaysEnabled,
        }));
        
        setFeatures(completeFeatures);
      }
    } catch {
      toast.error('Failed to fetch feature flags');
      // Set all features with defaults
      const defaultFeatures: FeatureData[] = Object.values(FEATURES).map(config => ({
        id: config.id,
        name: config.name,
        key: config.id,
        enabled: config.alwaysEnabled || false,
        description: config.description,
        category: config.category,
        subcategory: config.subcategory,
        menuItems: config.menuItems,
        alwaysEnabled: config.alwaysEnabled,
      }));
      setFeatures(defaultFeatures);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings/feature-flags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          features: features.map(f => ({ key: f.key, enabled: f.enabled }))
        }),
      });

      if (response.ok) {
        toast.success('Feature flags saved successfully');
        // Refresh to get latest state
        fetchFeatureFlags();
      } else {
        throw new Error('Failed to save');
      }
    } catch {
      toast.error('Failed to save feature flags');
    } finally {
      setSaving(false);
    }
  };

  const toggleFeature = (key: string) => {
    const feature = features.find(f => f.key === key);
    if (feature?.alwaysEnabled) {
      toast.info('Base modules cannot be disabled');
      return;
    }
    setFeatures(prev => prev.map(f => 
      f.key === key ? { ...f, enabled: !f.enabled } : f
    ));
  };

  const toggleExpanded = (key: string) => {
    setExpandedItems(prev => 
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const enableAllAddons = () => {
    setFeatures(prev => prev.map(f => 
      f.category === 'addons' ? { ...f, enabled: true } : f
    ));
  };

  const disableAllAddons = () => {
    setFeatures(prev => prev.map(f => 
      f.category === 'addons' ? { ...f, enabled: false } : f
    ));
  };

  const enableAllInSubcategory = (subcategory: string) => {
    setFeatures(prev => prev.map(f => 
      f.subcategory === subcategory ? { ...f, enabled: true } : f
    ));
  };

  const disableAllInSubcategory = (subcategory: string) => {
    setFeatures(prev => prev.map(f => 
      f.subcategory === subcategory ? { ...f, enabled: false } : f
    ));
  };

  // Get menu item name for display
  const getMenuItemName = (menuItemId: string): string => {
    for (const section of navigationConfig) {
      const item = section.items.find(i => i.href.replace('#', '') === menuItemId);
      if (item) return item.title;
    }
    return menuItemId;
  };

  // Filter features based on tab and search
  const filteredFeatures = features.filter(f => {
    const matchesSearch = searchQuery === '' || 
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'all') return matchesSearch;
    if (activeTab === 'enabled') return f.enabled && matchesSearch;
    if (activeTab === 'disabled') return !f.enabled && matchesSearch;
    return f.category === activeTab && matchesSearch;
  });

  // Separate base and addon features
  const baseFeatures = filteredFeatures.filter(f => f.category === 'base');
  const addonFeatures = filteredFeatures.filter(f => f.category === 'addons');

  // Group addons by subcategory
  const groupedAddons = Object.entries(ADDON_SUBCATEGORIES).map(([key, info]) => ({
    key,
    ...info,
    features: addonFeatures.filter(f => f.subcategory === key)
  })).filter(g => g.features.length > 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const enabledCount = features.filter(f => f.enabled).length;
  const disabledCount = features.filter(f => !f.enabled).length;
  const baseCount = features.filter(f => f.category === 'base').length;
  const addonCount = features.filter(f => f.category === 'addons').length;

  return (
    <SectionGuard permission="settings.features">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Feature Flags</h2>
          <p className="text-muted-foreground">Enable or disable platform modules for your property</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchFeatureFlags}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader className="pb-2">
            <CardDescription>Base Modules</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              {baseCount}
              <Lock className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-violet-500">
          <CardHeader className="pb-2">
            <CardDescription>Addon Modules</CardDescription>
            <CardTitle className="text-2xl">{addonCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-cyan-500">
          <CardHeader className="pb-2">
            <CardDescription>Enabled</CardDescription>
            <CardTitle className="text-2xl text-emerald-600">{enabledCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardDescription>Disabled</CardDescription>
            <CardTitle className="text-2xl text-amber-600">{disabledCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="base">Base</TabsTrigger>
            <TabsTrigger value="addons">Addons</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="w-full sm:w-64">
          <input
            type="text"
            placeholder="Search features..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* Feature List */}
      <ScrollArea className="h-[calc(100vh-400px)]">
        <div className="space-y-6 pr-4">
          {/* Base Modules Section */}
          {(activeTab === 'all' || activeTab === 'base') && baseFeatures.length > 0 && (
            <Card className="border-l-4 border-l-emerald-500">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" variant="outline">
                        {FEATURE_CATEGORIES.base.name}
                      </Badge>
                      <Lock className="h-4 w-4 text-emerald-600" />
                    </CardTitle>
                    <CardDescription className="mt-1">{FEATURE_CATEGORIES.base.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {baseFeatures.map((feature) => (
                    <div 
                      key={feature.key}
                      className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/30"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <div>
                          <p className="font-medium text-sm">{feature.name}</p>
                          <p className="text-xs text-muted-foreground">{feature.menuItems.length} menu items</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs border-emerald-300 text-emerald-700 dark:border-emerald-700 dark:text-emerald-400">
                        Always On
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Addon Modules Section */}
          {(activeTab === 'all' || activeTab === 'addons') && (
            <>
              {/* Addon Actions */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Zap className="h-5 w-5 text-violet-500" />
                  Addon Modules
                </h3>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={enableAllAddons}>
                    Enable All
                  </Button>
                  <Button variant="outline" size="sm" onClick={disableAllAddons}>
                    Disable All
                  </Button>
                </div>
              </div>

              {/* Grouped Addons by Subcategory */}
              {groupedAddons.map((subcategory) => (
                <Card key={subcategory.key} className="border-l-4 border-l-violet-500">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                          {subcategoryIcons[subcategory.key]}
                          {subcategory.name}
                          <span className="text-sm font-normal text-muted-foreground">
                            ({subcategory.features.filter(f => f.enabled).length}/{subcategory.features.length} enabled)
                          </span>
                        </CardTitle>
                        <CardDescription className="mt-1">{subcategory.description}</CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => enableAllInSubcategory(subcategory.key)}
                        >
                          Enable
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => disableAllInSubcategory(subcategory.key)}
                        >
                          Disable
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="multiple" className="w-full" value={expandedItems} onValueChange={setExpandedItems}>
                      {subcategory.features.map((feature) => (
                        <AccordionItem key={feature.key} value={feature.key}>
                          <div 
                            className="flex items-center justify-between w-full py-3 font-medium transition-all hover:bg-muted/50 rounded-lg px-2 cursor-pointer"
                            onClick={() => toggleExpanded(feature.key)}
                          >
                            <div className="flex items-center gap-3">
                              {feature.enabled ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground/50" />
                              )}
                              <span className={feature.enabled ? '' : 'text-muted-foreground'}>
                                {feature.name}
                              </span>
                              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
                            </div>
                            <div onClick={(e) => e.stopPropagation()}>
                              <Switch
                                checked={feature.enabled}
                                onCheckedChange={() => toggleFeature(feature.key)}
                              />
                            </div>
                          </div>
                          <AccordionContent>
                            <div className="space-y-3 pt-2 px-2">
                              <p className="text-sm text-muted-foreground">{feature.description}</p>
                              
                              {/* Menu Items Mapping */}
                              {feature.menuItems.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                    <Menu className="h-3 w-3" />
                                    Controls Menu Items:
                                  </p>
                                  <div className="flex flex-wrap gap-1.5">
                                    {feature.menuItems.map(menuItem => (
                                      <Badge 
                                        key={menuItem} 
                                        variant="outline" 
                                        className="text-xs"
                                      >
                                        {getMenuItemName(menuItem)}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              
                              <Separator className="my-2" />
                              
                              <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="font-mono text-xs">
                                  {feature.key}
                                </Badge>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      </ScrollArea>
    </div>
    </SectionGuard>
  );
}
