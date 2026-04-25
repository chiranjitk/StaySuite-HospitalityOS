import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================
// App State Types
// ============================================

interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  plan: string;
  status: string;
  currency: string;
  language: string;
  timezone: string;
}

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  role: string;
  permissions: string[];
  isPlatformAdmin?: boolean;
  roleId?: string;
  tenantId?: string;
}

interface Property {
  id: string;
  name: string;
  slug: string;
  logo?: string;
  totalRooms: number;
  status: string;
}

// ============================================
// Auth Store
// ============================================

interface AuthState {
  user: User | null;
  tenant: Tenant | null;
  currentProperty: Property | null;
  properties: Property[];
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setTenant: (tenant: Tenant | null) => void;
  setCurrentProperty: (property: Property | null) => void;
  setProperties: (properties: Property[]) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tenant: null,
      currentProperty: null,
      properties: [],
      isAuthenticated: false,
      isLoading: true,
      
      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setTenant: (tenant) => set({ tenant }),
      setCurrentProperty: (property) => set({ currentProperty: property }),
      setProperties: (properties) => set({ properties }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ 
        user: null, 
        tenant: null, 
        currentProperty: null, 
        properties: [],
        isAuthenticated: false 
      }),
    }),
    {
      name: 'staysuite-auth',
      partialize: (state) => ({
        user: state.user,
        tenant: state.tenant,
        currentProperty: state.currentProperty,
        properties: state.properties,
        // Don't persist isAuthenticated - derived from user presence by AuthContext
      }),
    }
  )
);

// ============================================
// UI Store
// ============================================

interface UIState {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  activeSection: string;
  commandPaletteOpen: boolean;
  notificationsPanelOpen: boolean;
  
  // Actions
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setActiveSection: (section: string) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setNotificationsPanelOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>()(
  (set) => ({
    sidebarOpen: true,
    sidebarCollapsed: false,
    activeSection: 'overview',
    commandPaletteOpen: false,
    notificationsPanelOpen: false,
    
    toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
    setActiveSection: (activeSection) => {
      // Sync to URL hash for bookmarkability and browser back/forward
      if (typeof window !== 'undefined') {
        const hash = `#${activeSection}`;
        if (window.location.hash !== hash) {
          window.history.replaceState(null, '', hash);
        }
      }
      set({ activeSection });
    },
    setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
    setNotificationsPanelOpen: (notificationsPanelOpen) => set({ notificationsPanelOpen }),
  })
);

// ============================================
// Dashboard Store
// ============================================

interface DashboardStats {
  revenue: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    change: number;
  };
  occupancy: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    change: number;
  };
  bookings: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    pending: number;
  };
  guests: {
    checkedIn: number;
    arriving: number;
    departing: number;
    total: number;
  };
}

interface DashboardState {
  stats: DashboardStats | null;
  recentActivities: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    timestamp: string;
    status?: string;
  }>;
  isLoading: boolean;
  
  // Actions
  setStats: (stats: DashboardStats) => void;
  setRecentActivities: (activities: DashboardState['recentActivities']) => void;
  setLoading: (loading: boolean) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  stats: null,
  recentActivities: [],
  isLoading: false,
  
  setStats: (stats) => set({ stats }),
  setRecentActivities: (recentActivities) => set({ recentActivities }),
  setLoading: (isLoading) => set({ isLoading }),
}));

// ============================================
// Notifications Store
// ============================================

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface NotificationsState {
  notifications: Notification[];
  unreadCount: number;
  
  // Actions
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationsStore = create<NotificationsState>((set) => ({
  notifications: [],
  unreadCount: 0,
  
  addNotification: (notification) => set((state) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    return {
      notifications: [newNotification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    };
  }),
  
  markAsRead: (id) => set((state) => {
    const notification = state.notifications.find(n => n.id === id);
    if (notification && !notification.read) {
      return {
        notifications: state.notifications.map(n => 
          n.id === id ? { ...n, read: true } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      };
    }
    return state;
  }),
  
  markAllAsRead: () => set((state) => ({
    notifications: state.notifications.map(n => ({ ...n, read: true })),
    unreadCount: 0,
  })),
  
  removeNotification: (id) => set((state) => {
    const notification = state.notifications.find(n => n.id === id);
    return {
      notifications: state.notifications.filter(n => n.id !== id),
      unreadCount: notification && !notification.read 
        ? Math.max(0, state.unreadCount - 1) 
        : state.unreadCount,
    };
  }),
  
  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}));

// ============================================
// Active Tenant Store (Platform Admin Tenant Switcher)
// ============================================

interface ActiveTenantState {
  activeTenantId: string | null;
  setActiveTenantId: (tenantId: string | null) => void;
}

export const useActiveTenantStore = create<ActiveTenantState>()(
  persist(
    (set) => ({
      activeTenantId: null,
      setActiveTenantId: (activeTenantId) => set({ activeTenantId }),
    }),
    {
      name: 'staysuite-active-tenant',
    }
  )
);
