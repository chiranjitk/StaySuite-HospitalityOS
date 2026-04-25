'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUIStore } from '@/store';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { ErrorBoundary } from '@/components/common/error-boundary';
import { AnimatePresence, motion } from 'framer-motion';

function SectionContent({ section }: { section: string }) {
  const [Comp, setComp] = useState<React.ComponentType<any> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setComp(null);

    const timeout = setTimeout(() => {
      if (!cancelled) setError(`Loading timed out for: ${section}`);
    }, 30000);

    import('@/components/sections/loaders/master-loader')
      .then(async (masterModule) => {
        if (cancelled) return;
        try {
          const mod = await masterModule.default(section);
          if (cancelled) return;
          clearTimeout(timeout);
          const Component = mod?.default || Object.values(mod || {}).find(
            (v: any) => typeof v === 'function' && v.toString().length > 0
          ) as React.ComponentType<any>;
          if (Component) {
            setComp(() => Component);
          } else {
            setError(`No component found for: ${section}`);
          }
        } catch (err: any) {
          if (cancelled) return;
          clearTimeout(timeout);
          setError(`Failed to load ${section}: ${err?.message || 'Unknown error'}`);
        }
      })
      .catch((err: any) => {
        if (cancelled) return;
        clearTimeout(timeout);
        setError(`Failed to load section loader: ${err?.message || 'Unknown error'}`);
        console.error('SectionContent failed:', section, err);
      });

    return () => { cancelled = true; clearTimeout(timeout); };
  }, [section]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-red-500 dark:text-red-400 font-medium">{error}</p>
        <button className="px-4 py-2 border rounded-md text-sm hover:bg-accent" onClick={() => window.location.reload()}>Refresh Page</button>
      </div>
    );
  }

  if (!Comp) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ErrorBoundary section={section}>
        <Comp />
      </ErrorBoundary>
    </div>
  );
}

export default function Home() {
  const { activeSection } = useUIStore();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400" />
          <p className="text-muted-foreground text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <AppLayout>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{
            duration: 0.18,
            ease: [0.25, 0.46, 0.45, 0.94],
          }}
        >
          <SectionContent key={activeSection} section={activeSection} />
        </motion.div>
      </AnimatePresence>
    </AppLayout>
  );
}
