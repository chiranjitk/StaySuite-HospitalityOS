'use client';

import React, { lazy, useState, Suspense } from 'react';
import { Server, Shield, ScrollText, HeartPulse } from 'lucide-react';
import { cn } from '@/lib/utils';

// Lazy imports for tab content
const GatewayIntegration = lazy(() => import('@/components/wifi/gateway-integration'));
const AAAConfig = lazy(() => import('@/components/wifi/aaa-config'));
const ProvisioningLogs = lazy(() => import('@/components/wifi/provisioning-logs'));
const NasHealth = lazy(() => import('@/components/wifi/nas-health'));

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function TabSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-muted rounded" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2].map(i => (
          <div key={i} className="h-40 bg-muted/50 rounded-xl border border-border/50" />
        ))}
      </div>
      <div className="h-64 bg-muted/50 rounded-xl border border-border/50" />
    </div>
  );
}

// ─── Tab Config ──────────────────────────────────────────────────────────────

type TabId = 'aaa' | 'gateway' | 'provisioning' | 'nas-health';

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'aaa', label: 'AAA Configuration', icon: <Shield className="h-4 w-4" /> },
  { id: 'gateway', label: 'Gateway Integration', icon: <Server className="h-4 w-4" /> },
  { id: 'provisioning', label: 'Provisioning Logs', icon: <ScrollText className="h-4 w-4" /> },
  { id: 'nas-health', label: 'NAS Health', icon: <HeartPulse className="h-4 w-4" /> },
];

// ─── Main Component ─────────────────────────────────────────────────────────

export function GatewayRadiusPage() {
  const [activeTab, setActiveTab] = useState<TabId>('aaa');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            RADIUS &amp; Gateway
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure RADIUS AAA server settings and external gateway integration
          </p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="relative">
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200',
                activeTab === tab.id
                  ? 'bg-teal-600 text-white shadow-lg shadow-teal-600/25'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-2">
        <Suspense fallback={<TabSkeleton />}>
          {activeTab === 'gateway' && <GatewayIntegration />}
          {activeTab === 'aaa' && <AAAConfig />}
          {activeTab === 'provisioning' && <ProvisioningLogs />}
          {activeTab === 'nas-health' && <NasHealth />}
        </Suspense>
      </div>
    </div>
  );
}

export default GatewayRadiusPage;
