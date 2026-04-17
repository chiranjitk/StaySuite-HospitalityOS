'use client';

import React, { useEffect, useState } from 'react';
import { Sidebar } from './sidebar';
import { Header } from './header';
import { Breadcrumb } from './breadcrumb';
import { useUIStore, useAuthStore } from '@/store';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { sidebarCollapsed } = useUIStore();
  const { setLoading, setProperties, setCurrentProperty } = useAuthStore();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Load properties from API and set currentProperty
  useEffect(() => {
    const { currentProperty, properties } = useAuthStore.getState();

    // Already have properties loaded
    if (currentProperty || properties.length > 0) {
      if (properties.length > 0 && !currentProperty) {
        setCurrentProperty(properties[0]);
      }
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetch('/api/properties')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          setProperties(data.data);
          setCurrentProperty(data.data[0]);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch properties:', err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [setLoading, setProperties, setCurrentProperty]);

  // Sync browser back/forward with Zustand activeSection
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && hash !== useUIStore.getState().activeSection) {
        useUIStore.getState().setActiveSection(hash);
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Prevent body scroll when mobile sidebar is open
  useEffect(() => {
    if (mobileSidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileSidebarOpen]);

  return (
    <div className="min-h-screen bg-background relative app-background overflow-x-hidden">
      {/* Decorative background elements - theme-specific */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-gradient-start/5 rounded-full blur-3xl" />
        <div className="absolute top-1/4 -right-20 w-60 h-60 bg-gradient-end/5 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-1/3 w-72 h-72 bg-gradient-start/5 rounded-full blur-3xl" />
      </div>
      
      {/* Sidebar - handles both mobile and desktop */}
      <Sidebar 
        mobileOpen={mobileSidebarOpen} 
        onMobileClose={() => setMobileSidebarOpen(false)} 
      />
      
      {/* Header */}
      <Header onMenuClick={() => setMobileSidebarOpen(true)} />
      
      {/* Main Content */}
      <main className={cn(
        "relative z-10 transition-all duration-300 pt-14 sm:pt-16 pb-2 px-2 sm:px-3 lg:px-4", // pt-14 to offset sticky header, minimal padding
        "ml-0 lg:ml-[260px]", // No margin on mobile, 260px on desktop
        sidebarCollapsed && "lg:ml-[68px]" // Collapsed width only on desktop
      )}>
        {/* Breadcrumb Navigation */}
        <Breadcrumb />

        {children}
      </main>
    </div>
  );
}
