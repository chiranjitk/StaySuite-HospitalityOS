'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Shield,
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Loader2,
  CheckCircle2,
  XCircle,
  Lock,
  Unlock,
  Copy,
  ArrowRight,
  GitCompare,
  ClipboardCheck,
  AlertTriangle,
  Info,
  Users,
  ChevronDown,
  ChevronRight,
  Save,
  RotateCcw,
  Zap,
  FileText,
  Ban,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { SectionGuard } from '@/components/common/section-guard';

// ============================================================
// TYPES
// ============================================================

interface Role {
  id: string;
  name: string;
  displayName: string;
  description?: string | null;
  permissions: string;
  isSystem: boolean;
  _count?: { users: number };
}

interface AuditEntry {
  id: string;
  module: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt: string;
}

interface PermissionModule {
  group: string;
  modules: {
    name: string;
    actions: string[];
  }[];
}

// ============================================================
// PERMISSION CATALOG
// ============================================================

const PERMISSION_CATALOG: PermissionModule[] = [
  {
    group: 'Core',
    modules: [
      { name: 'dashboard', actions: ['view', 'full', 'operations', 'housekeeping', 'command', 'alerts'] },
      { name: 'settings', actions: ['view', 'manage', 'features'] },
    ],
  },
  {
    group: 'PMS',
    modules: [
      { name: 'properties', actions: ['view', 'manage'] },
      { name: 'rooms', actions: ['view', 'manage', 'update', 'update_status'] },
      { name: 'inventory', actions: ['view', 'manage', 'lock'] },
      { name: 'pricing', actions: ['view', 'manage'] },
    ],
  },
  {
    group: 'Bookings',
    modules: [
      { name: 'bookings', actions: ['view', 'create', 'update', 'manage', 'audit'] },
    ],
  },
  {
    group: 'Front Desk',
    modules: [
      { name: 'frontdesk', actions: ['view', 'checkin', 'checkout', 'walkin', 'assign'] },
    ],
  },
  {
    group: 'Guests',
    modules: [
      { name: 'guests', actions: ['view', 'create', 'update', 'manage', 'kyc', 'loyalty'] },
    ],
  },
  {
    group: 'Operations',
    modules: [
      { name: 'housekeeping', actions: ['view', 'maintenance'] },
      { name: 'tasks', actions: ['view', 'update', 'assign'] },
      { name: 'maintenance', actions: ['view', 'create', 'manage'] },
      { name: 'assets', actions: ['view', 'manage', 'update'] },
    ],
  },
  {
    group: 'Billing',
    modules: [
      { name: 'billing', actions: ['view', 'create', 'manage', 'invoices', 'payments', 'refunds', 'discounts'] },
    ],
  },
  {
    group: 'Guest Experience',
    modules: [
      { name: 'experience', actions: ['view', 'manage', 'portal', 'keys'] },
      { name: 'communication', actions: ['view', 'chat', 'manage'] },
      { name: 'service_requests', actions: ['view'] },
      { name: 'digital_keys', actions: ['manage'] },
    ],
  },
  {
    group: 'POS',
    modules: [
      { name: 'pos', actions: ['view', 'orders', 'tables', 'kitchen', 'manage', 'billing'] },
    ],
  },
  {
    group: 'Facilities',
    modules: [
      { name: 'parking', actions: ['view', 'manage', 'billing'] },
      { name: 'surveillance', actions: ['view', 'playback', 'alerts', 'incidents'] },
      { name: 'wifi', actions: ['view', 'manage', 'vouchers'] },
      { name: 'iot', actions: ['view', 'manage', 'control'] },
    ],
  },
  {
    group: 'Revenue',
    modules: [
      { name: 'revenue', actions: ['view', 'manage'] },
      { name: 'channels', actions: ['view', 'manage', 'sync'] },
      { name: 'pricing', actions: ['view', 'manage'] },
    ],
  },
  {
    group: 'CRM & Marketing',
    modules: [
      { name: 'crm', actions: ['view', 'manage', 'campaigns', 'loyalty', 'feedback'] },
      { name: 'marketing', actions: ['view', 'manage', 'booking_engine'] },
    ],
  },
  {
    group: 'Reports',
    modules: [
      { name: 'reports', actions: ['view', 'manage', 'revenue', 'occupancy', 'guests', 'staff'] },
    ],
  },
  {
    group: 'Events',
    modules: [
      { name: 'events', actions: ['view', 'manage', 'book'] },
    ],
  },
  {
    group: 'Staff',
    modules: [
      { name: 'staff', actions: ['view', 'scheduling', 'attendance', 'tasks', 'communicate', 'performance'] },
    ],
  },
  {
    group: 'Security',
    modules: [
      { name: 'security', actions: ['view', '2fa', 'sessions', 'sso'] },
      { name: 'audit', actions: ['view'] },
    ],
  },
  {
    group: 'Integrations',
    modules: [
      { name: 'integrations', actions: ['manage'] },
      { name: 'automation', actions: ['view', 'manage'] },
      { name: 'webhooks', actions: ['view', 'manage'] },
      { name: 'notifications', actions: ['view', 'manage'] },
    ],
  },
  {
    group: 'AI',
    modules: [
      { name: 'ai', actions: ['view', 'use', 'manage'] },
    ],
  },
  {
    group: 'Admin',
    modules: [
      { name: 'admin', actions: ['tenants', 'users', 'usage', 'revenue', 'health'] },
      { name: 'chain', actions: ['view', 'manage'] },
      { name: 'saas', actions: ['view', 'manage'] },
    ],
  },
  {
    group: 'Help',
    modules: [
      { name: 'help', actions: ['view'] },
    ],
  },
];

// Build flat list of all permission strings
const ALL_PERMISSIONS: string[] = [];
PERMISSION_CATALOG.forEach((group) => {
  group.modules.forEach((mod) => {
    mod.actions.forEach((action) => {
      ALL_PERMISSIONS.push(`${mod.name}.${action}`);
    });
  });
});
ALL_PERMISSIONS.push('*');

// ============================================================
// PERMISSION RESOLVER
// ============================================================

function checkPermission(permList: string[], permission: string): {
  granted: boolean;
  method: 'exact' | 'module_wildcard' | 'global_wildcard' | 'none';
  explanation: string;
} {
  if (permList.includes('*')) {
    return { granted: true, method: 'global_wildcard', explanation: `Granted via global wildcard "*"` };
  }
  if (permList.includes(permission)) {
    return { granted: true, method: 'exact', explanation: `Exact match found: "${permission}"` };
  }
  const [mod] = permission.split('.');
  if (permList.includes(`${mod}.*`)) {
    return { granted: true, method: 'module_wildcard', explanation: `Granted via module wildcard "${mod}.*"` };
  }
  return { granted: false, method: 'none', explanation: `No matching permission found. Checked: exact "${permission}", module wildcard "${mod}.*", global wildcard "*"` };
}

function parsePermissions(permStr: string): string[] {
  try {
    return JSON.parse(permStr || '[]');
  } catch {
    return [];
  }
}

function effectivePermissions(rolePerms: string[]): Set<string> {
  const result = new Set<string>();
  const hasGlobalWildcard = rolePerms.includes('*');

  if (hasGlobalWildcard) {
    ALL_PERMISSIONS.forEach(p => result.add(p));
    return result;
  }

  const moduleWildcards: string[] = [];
  rolePerms.forEach(p => {
    if (p.endsWith('.*')) {
      moduleWildcards.push(p);
    } else {
      result.add(p);
    }
  });

  ALL_PERMISSIONS.forEach(p => {
    const [mod] = p.split('.');
    if (moduleWildcards.includes(`${mod}.*`)) {
      result.add(p);
    }
  });

  return result;
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function RolePermissions() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Dialog states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isViewPermissionsDialogOpen, setIsViewPermissionsDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    displayName: '',
    description: '',
  });
  const [editForm, setEditForm] = useState({
    displayName: '',
    description: '',
    permissions: [] as string[],
  });

  // Matrix tab states
  const [matrixRoleId, setMatrixRoleId] = useState<string>('');
  const [matrixPermissions, setMatrixPermissions] = useState<string[]>([]);
  const [isMatrixSaving, setIsMatrixSaving] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Tester tab states
  const [testerRoleId, setTesterRoleId] = useState<string>('');
  const [testPermission, setTestPermission] = useState('');

  // Comparison tab states
  const [compareRoleIds, setCompareRoleIds] = useState<string[]>(['', '']);
  const [comparePermissions, setComparePermissions] = useState<{ role: Role; perms: Set<string> }[]>([]);

  // Audit log tab states
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Platform Admin / Tenant state
  const { user: authUser } = useAuth();
  const isPlatformAdmin = authUser?.isPlatformAdmin || false;
  const [tenants, setTenants] = useState<Array<{id: string; name: string; slug: string; plan: string; status: string}>>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string>('');
  const [tenantsLoading, setTenantsLoading] = useState(false);

  // ============================================================
  // DATA FETCHING
  // ============================================================

  const fetchRoles = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/roles' + (isPlatformAdmin && selectedTenantId ? '?tenantId=' + selectedTenantId : ''));
      if (!response.ok) throw new Error('Failed to fetch roles');
      const data = await response.json();
      const rolesList = data.roles || [];
      setRoles(rolesList);
      // Set default matrix role
      if (rolesList.length > 0 && !matrixRoleId) {
        const nonAdmin = rolesList.find((r: { name: string }) => r.name !== 'admin') || rolesList[0];
        setMatrixRoleId(nonAdmin.id);
        setMatrixPermissions(parsePermissions(nonAdmin.permissions));
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
      toast.error('Failed to load roles');
    } finally {
      setIsLoading(false);
    }
  }, [matrixRoleId]);

  const fetchAuditLogs = useCallback(async () => {
    try {
      setAuditLoading(true);
      // Fetch real audit logs for role-related changes from the audit log API
      const queryParams = isPlatformAdmin && selectedTenantId 
        ? `?tenantId=${selectedTenantId}&entityType=Role&limit=50` 
        : '?entityType=Role&limit=50';
      const response = await fetch('/api/admin/audit-logs' + queryParams);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          setAuditLogs(data.data.map((log: { id: string; module: string; action: string; entityType: string; entityId: string; oldValue?: string | null; newValue?: string | null; createdAt: string }) => ({
            id: log.id,
            module: log.module,
            action: log.action,
            entityType: log.entityType,
            entityId: log.entityId,
            oldValue: log.oldValue,
            newValue: log.newValue,
            createdAt: log.createdAt,
          })));
        } else {
          setAuditLogs([]);
        }
      } else {
        // Audit log API may not exist yet - return empty rather than fabricating data
        setAuditLogs([]);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      setAuditLogs([]);
    } finally {
      setAuditLoading(false);
    }
  }, [isPlatformAdmin, selectedTenantId]);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  useEffect(() => {
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab, fetchAuditLogs]);

  // Fetch tenants for platform admin
  const fetchTenants = useCallback(async () => {
    try {
      setTenantsLoading(true);
      const response = await fetch('/api/admin/tenants');
      if (response.ok) {
        const data = await response.json();
        const list = data.data?.tenants || data.tenants || [];
        setTenants(list);
        if (list.length > 0 && !selectedTenantId) {
          setSelectedTenantId(list[0].id);
        }
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
    } finally {
      setTenantsLoading(false);
    }
  }, [selectedTenantId]);

  useEffect(() => {
    if (isPlatformAdmin) {
      fetchTenants();
    }
  }, [isPlatformAdmin, fetchTenants]);

  useEffect(() => {
    if (isPlatformAdmin && selectedTenantId) {
      fetchRoles();
    }
  }, [selectedTenantId]);

  // ============================================================
  // ROLE CRUD
  // ============================================================

  const handleCreateRole = async () => {
    if (!createForm.name || !createForm.displayName) {
      toast.error('Name and display name are required');
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(createForm.name)) {
      toast.error('Role name must start with lowercase letter and contain only lowercase letters, numbers, and underscores');
      return;
    }

    try {
      setIsSaving(true);
      const response = await fetch('/api/roles' + (isPlatformAdmin && selectedTenantId ? '?tenantId=' + selectedTenantId : ''), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name,
          displayName: createForm.displayName,
          description: createForm.description || undefined,
          permissions: [],
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create role');
      }

      toast.success('Role created successfully');
      setIsCreateDialogOpen(false);
      setCreateForm({ name: '', displayName: '', description: '' });
      fetchRoles();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create role');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedRole) return;
    try {
      setIsSaving(true);
      const response = await fetch('/api/roles' + (isPlatformAdmin && selectedTenantId ? '?tenantId=' + selectedTenantId : ''), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRole.id,
          displayName: editForm.displayName,
          description: editForm.description,
          permissions: editForm.permissions,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update role');
      }

      toast.success('Role updated successfully');
      setIsEditDialogOpen(false);
      setSelectedRole(null);
      fetchRoles();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update role');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRole = async () => {
    if (!selectedRole) return;
    try {
      setIsSaving(true);
      const response = await fetch(`/api/roles?id=${selectedRole.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete role');
      }

      toast.success('Role deleted successfully');
      setIsDeleteDialogOpen(false);
      setSelectedRole(null);
      fetchRoles();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete role');
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================================
  // MATRIX HELPERS
  // ============================================================

  const handleMatrixRoleChange = (roleId: string) => {
    setMatrixRoleId(roleId);
    const role = roles.find(r => r.id === roleId);
    if (role) {
      if (role.name === 'admin') {
        setMatrixPermissions(['*']);
      } else {
        setMatrixPermissions(parsePermissions(role.permissions));
      }
    }
  };

  const toggleMatrixPermission = (perm: string) => {
    setMatrixPermissions(prev => {
      const hasWildcard = prev.includes('*');
      if (hasWildcard) {
        // Remove global wildcard and set individual perms
        const newPerms = ALL_PERMISSIONS.filter(p => p !== '*' && p !== perm);
        return newPerms;
      }
      if (prev.includes(perm)) {
        return prev.filter(p => p !== perm);
      }
      return [...prev, perm];
    });
  };

  const toggleModuleAll = (moduleName: string, actions: string[]) => {
    const allPresent = actions.every(action => matrixPermissions.includes(`${moduleName}.${action}`));
    if (allPresent) {
      // Remove all actions for this module
      const modulePerms = actions.map(a => `${moduleName}.${a}`);
      setMatrixPermissions(prev => prev.filter(p => !modulePerms.includes(p)));
    } else {
      // Add all actions for this module
      const modulePerms = actions.map(a => `${moduleName}.${a}`);
      const newPerms = [...matrixPermissions];
      modulePerms.forEach(p => {
        if (!newPerms.includes(p)) newPerms.push(p);
      });
      setMatrixPermissions(newPerms);
    }
  };

  const handleSaveMatrix = async () => {
    if (!matrixRoleId) return;
    const role = roles.find(r => r.id === matrixRoleId);
    if (!role) return;

    if (role.name === 'admin') {
      toast.error('Cannot modify admin role permissions');
      return;
    }

    try {
      setIsMatrixSaving(true);
      const response = await fetch('/api/roles' + (isPlatformAdmin && selectedTenantId ? '?tenantId=' + selectedTenantId : ''), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: role.id,
          permissions: matrixPermissions,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save permissions');
      }

      toast.success(`Permissions saved for ${role.displayName}`);
      fetchRoles();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save permissions');
    } finally {
      setIsMatrixSaving(false);
    }
  };

  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  };

  // ============================================================
  // COMPUTED VALUES
  // ============================================================

  const filteredRoles = useMemo(() => {
    if (!searchQuery) return roles;
    const q = searchQuery.toLowerCase();
    return roles.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.displayName.toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q)
    );
  }, [roles, searchQuery]);

  const totalPermissions = ALL_PERMISSIONS.length;
  const totalModules = PERMISSION_CATALOG.reduce((sum, g) => sum + g.modules.length, 0);

  // Stats
  const stats = useMemo(() => ({
    totalRoles: roles.length,
    systemRoles: roles.filter(r => r.isSystem).length,
    customRoles: roles.filter(r => !r.isSystem).length,
    totalUsers: roles.reduce((sum, r) => sum + (r._count?.users || 0), 0),
  }), [roles]);

  // ============================================================
  // LOADING STATE
  // ============================================================

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400" />
      </div>
    );
  }

  // ============================================================
  // SUB-COMPONENTS
  // ============================================================

  const RolesOverview = () => (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRoles}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Roles</CardTitle>
            <Lock className="h-4 w-4 text-amber-500 dark:text-amber-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats.systemRoles}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Custom Roles</CardTitle>
            <Unlock className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{stats.customRoles}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-blue-500 dark:text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalUsers}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search roles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button
              onClick={() => {
                setCreateForm({ name: '', displayName: '', description: '' });
                setIsCreateDialogOpen(true);
              }}
              className="bg-gradient-to-r from-teal-500 to-emerald-600"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Role
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Roles Table */}
      <Card>
        <CardHeader>
          <CardTitle>Roles ({filteredRoles.length})</CardTitle>
          <CardDescription>
            Manage roles and their permission assignments across {totalModules} modules and {totalPermissions} permissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <div className="flex flex-col items-center gap-2">
                        <Shield className="h-8 w-8 text-muted-foreground" />
                        <p className="text-muted-foreground">No roles found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRoles.map(role => {
                    const perms = parsePermissions(role.permissions);
                    const permCount = perms.includes('*') ? totalPermissions : effectivePermissions(perms).size;
                    return (
                      <TableRow key={role.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell onClick={() => {
                          setSelectedRole(role);
                          setIsViewPermissionsDialogOpen(true);
                        }}>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white">
                              <Shield className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium">{role.displayName}</p>
                              <p className="text-sm text-muted-foreground font-mono">{role.name}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{role._count?.users || 0}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge variant={perms.includes('*') ? 'default' : 'secondary'} className={
                              perms.includes('*') ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : ''
                            }>
                              {permCount}
                            </Badge>
                            <span className="text-xs text-muted-foreground">/ {totalPermissions}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {role.isSystem ? (
                            <Badge variant="outline" className="border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400">
                              <Lock className="mr-1 h-3 w-3" />
                              System
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400">
                              <Unlock className="mr-1 h-3 w-3" />
                              Custom
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedRole(role);
                                      setIsViewPermissionsDialogOpen(true);
                                    }}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>View Permissions</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedRole(role);
                                      const perms = role.name === 'admin' ? ['*'] : parsePermissions(role.permissions);
                                      setEditForm({
                                        displayName: role.displayName,
                                        description: role.description || '',
                                        permissions: perms,
                                      });
                                      setIsEditDialogOpen(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit Role</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setTesterRoleId(role.id);
                                      setActiveTab('tester');
                                    }}
                                  >
                                    <ClipboardCheck className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Test Permissions</TooltipContent>
                              </Tooltip>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={role.isSystem}
                                    onClick={() => {
                                      setSelectedRole(role);
                                      setIsDeleteDialogOpen(true);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 text-red-500 dark:text-red-400" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {role.isSystem ? 'System roles cannot be deleted' : 'Delete Role'}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );

  const PermissionMatrix = () => {
    const matrixRole = roles.find(r => r.id === matrixRoleId);
    const isAdminRole = matrixRole?.name === 'admin';
    const effectivePerms = effectivePermissions(matrixPermissions);

    return (
      <div className="space-y-4">
        {/* Controls */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1 w-full">
                <Label className="mb-2 block text-sm font-medium">Select Role to Edit</Label>
                <Select value={matrixRoleId} onValueChange={handleMatrixRoleChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map(role => (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex items-center gap-2">
                          {role.isSystem && <Lock className="h-3 w-3 text-amber-500 dark:text-amber-400" />}
                          {role.displayName}
                          <span className="text-muted-foreground text-xs">({role.name})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Granted</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{effectivePerms.size}</p>
                </div>
                <Separator orientation="vertical" className="h-12" />
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Denied</p>
                  <p className="text-2xl font-bold text-red-500 dark:text-red-400">{totalPermissions - effectivePerms.size}</p>
                </div>
              </div>
              <Button
                onClick={handleSaveMatrix}
                disabled={isMatrixSaving || isAdminRole}
                className="bg-gradient-to-r from-teal-500 to-emerald-600"
              >
                {isMatrixSaving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Permissions
              </Button>
            </div>
          </CardContent>
        </Card>

        {isAdminRole && (
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertTitle>Admin Role Protected</AlertTitle>
            <AlertDescription>
              The admin role has global wildcard (&quot;*&quot;) access which grants all permissions. This cannot be modified.
            </AlertDescription>
          </Alert>
        )}

        {/* Permission Matrix */}
        <Card>
          <CardContent className="pt-6">
            <ScrollArea className="max-h-[600px]">
              <div className="space-y-1">
                {PERMISSION_CATALOG.map((group) => {
                  const isCollapsed = collapsedGroups.has(group.group);
                  const groupPermsCount = group.modules.reduce(
                    (sum, mod) => sum + mod.actions.filter(a => effectivePerms.has(`${mod.name}.${a}`)).length,
                    0
                  );
                  const groupTotalCount = group.modules.reduce((sum, mod) => sum + mod.actions.length, 0);

                  return (
                    <div key={group.group}>
                      {/* Group Header */}
                      <button
                        onClick={() => toggleGroupCollapse(group.group)}
                        className="w-full flex items-center gap-2 py-2 px-3 hover:bg-muted/50 rounded-md transition-colors"
                      >
                        {isCollapsed ? (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="font-semibold text-sm">{group.group}</span>
                        <Badge variant="outline" className="ml-2 text-xs">
                          {groupPermsCount}/{groupTotalCount}
                        </Badge>
                        {groupPermsCount === groupTotalCount && groupTotalCount > 0 && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 ml-1" />
                        )}
                      </button>

                      {/* Module Rows */}
                      {!isCollapsed && (
                        <div className="ml-6 mb-3 space-y-1">
                          {group.modules.map((mod) => {
                            const modulePerms = mod.actions.map(a => `${mod.name}.${a}`);
                            const allGranted = modulePerms.every(p => effectivePerms.has(p));
                            const someGranted = modulePerms.some(p => effectivePerms.has(p));

                            return (
                              <div key={mod.name} className="border rounded-md p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <code className="text-xs font-mono bg-muted px-2 py-0.5 rounded">{mod.name}</code>
                                    <span className="text-xs text-muted-foreground">
                                      ({mod.actions.filter(a => effectivePerms.has(`${mod.name}.${a}`)).length}/{mod.actions.length} granted)
                                    </span>
                                  </div>
                                  {!isAdminRole && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs"
                                      onClick={() => toggleModuleAll(mod.name, mod.actions)}
                                    >
                                      {allGranted ? 'Clear All' : 'Select All'}
                                    </Button>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {mod.actions.map((action) => {
                                    const permStr = `${mod.name}.${action}`;
                                    const isGranted = effectivePerms.has(permStr);
                                    return (
                                      <TooltipProvider key={permStr}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <button
                                              disabled={isAdminRole}
                                              onClick={() => toggleMatrixPermission(permStr)}
                                              className={`
                                                flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all border
                                                ${isGranted
                                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300'
                                                  : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                                                }
                                                ${isAdminRole ? 'cursor-not-allowed opacity-80' : 'cursor-pointer hover:shadow-sm'}
                                              `}
                                            >
                                              {isGranted ? (
                                                <CheckCircle2 className="h-3.5 w-3.5" />
                                              ) : (
                                                <XCircle className="h-3.5 w-3.5" />
                                              )}
                                              {action}
                                            </button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            {permStr} — {isGranted ? 'Granted' : 'Denied'}
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  };

  const PermissionTester = () => {
    const testerRole = roles.find(r => r.id === testerRoleId);
    const testerPerms = testerRole ? parsePermissions(testerRole.permissions) : [];
    const effectivePerms = effectivePermissions(testerPerms);

    const testResult = testPermission.trim()
      ? checkPermission(testerPerms, testPermission.trim())
      : null;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              Permission Tester
            </CardTitle>
            <CardDescription>
              Test which permissions a specific role has. Enter a permission string to check if it&apos;s granted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Select Role</Label>
                <Select value={testerRoleId} onValueChange={setTesterRoleId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map(role => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.displayName} <span className="text-muted-foreground text-xs">({role.name})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Permission to Test</Label>
                <Input
                  placeholder="e.g. bookings.view, guests.create"
                  value={testPermission}
                  onChange={(e) => setTestPermission(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && testPermission.trim()) {
                      // Trigger re-render by keeping state
                    }
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {testerRole && (
          <>
            {/* Result */}
            {testResult && (
              <Card className={testResult.granted ? 'border-emerald-300 bg-emerald-50/50 dark:bg-emerald-900/10' : 'border-red-300 bg-red-50/50 dark:bg-red-900/10'}>
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <div className={`flex-shrink-0 h-12 w-12 rounded-full flex items-center justify-center ${testResult.granted ? 'bg-emerald-100 dark:bg-emerald-900/40' : 'bg-red-100 dark:bg-red-900/40'}`}>
                      {testResult.granted ? (
                        <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <XCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className={`text-lg font-bold ${testResult.granted ? 'text-emerald-800 dark:text-emerald-300' : 'text-red-800 dark:text-red-300'}`}>
                        {testResult.granted ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Permission: <code className="font-mono bg-muted px-1.5 py-0.5 rounded">{testPermission.trim()}</code>
                      </p>
                      <p className="text-sm mt-2">{testResult.explanation}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          Method: {testResult.method.replace('_', ' ')}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Role: {testerRole.displayName}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Role Permissions List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  All Permissions for {testerRole.displayName}
                </CardTitle>
                <CardDescription>
                  {effectivePerms.size} effective permissions (including wildcards)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 mb-4">
                  <div className="text-sm">
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">{effectivePerms.size}</span> granted
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="text-sm">
                    <span className="text-red-500 dark:text-red-400 font-medium">{totalPermissions - effectivePerms.size}</span> denied
                  </div>
                  <Separator orientation="vertical" className="h-4" />
                  <div className="text-sm">
                    <span className="text-blue-600 dark:text-blue-400 font-medium">{testerPerms.length}</span> raw entries
                  </div>
                </div>

                {/* Raw permissions stored on the role */}
                <div className="mb-4">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Raw Permission Entries ({testerPerms.length})
                  </h4>
                  <ScrollArea className="max-h-32">
                    <div className="flex flex-wrap gap-1.5">
                      {testerPerms.map(p => (
                        <Badge key={p} variant="secondary" className="font-mono text-xs">
                          {p}
                        </Badge>
                      ))}
                      {testerPerms.length === 0 && (
                        <p className="text-sm text-muted-foreground">No permissions assigned</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>

                <Separator className="my-4" />

                {/* Effective permissions grouped by module */}
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Effective Permissions by Module
                </h4>
                <ScrollArea className="max-h-64">
                  <div className="space-y-2">
                    {PERMISSION_CATALOG.map(group => (
                      <div key={group.group}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{group.group}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1 ml-2">
                          {group.modules.map(mod => (
                            <div key={mod.name} className="flex items-center gap-1.5">
                              <code className="text-xs font-mono">{mod.name}</code>
                              <span className="text-xs text-muted-foreground">:</span>
                              {mod.actions.map(action => {
                                const permStr = `${mod.name}.${action}`;
                                const has = effectivePerms.has(permStr);
                                return (
                                  <Badge
                                    key={permStr}
                                    variant={has ? 'default' : 'outline'}
                                    className={`text-[10px] px-1.5 py-0 ${has ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'text-muted-foreground'}`}
                                  >
                                    {action}
                                  </Badge>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  };

  const RoleComparison = () => {
    const compareRoles = compareRoleIds.map(id => roles.find(r => r.id === id)).filter(Boolean) as Role[];
    const comparePerms = compareRoles.map(r => ({
      role: r,
      perms: effectivePermissions(parsePermissions(r.permissions)),
    }));

    // Compute intersection and differences
    const intersection = useMemo(() => {
      if (comparePerms.length < 2) return new Set<string>();
      const [first, ...rest] = comparePerms;
      const result = new Set<string>();
      first.perms.forEach(p => {
        if (rest.every(rp => rp.perms.has(p))) result.add(p);
      });
      return result;
    }, [comparePerms]);

    const union = useMemo(() => {
      const result = new Set<string>();
      comparePerms.forEach(rp => rp.perms.forEach(p => result.add(p)));
      return result;
    }, [comparePerms]);

    // All unique permission strings for comparison
    const allComparePerms = useMemo(() => {
      const result = new Set<string>();
      ALL_PERMISSIONS.forEach(p => result.add(p));
      return [...result].sort();
    }, []);

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              Role Comparison
            </CardTitle>
            <CardDescription>
              Compare permissions between 2 roles side by side
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Role 1</Label>
                <Select value={compareRoleIds[0]} onValueChange={(v) => setCompareRoleIds([v, compareRoleIds[1]])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map(role => (
                      <SelectItem key={role.id} value={role.id}>{role.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Role 2</Label>
                <Select value={compareRoleIds[1]} onValueChange={(v) => setCompareRoleIds([compareRoleIds[0], v])}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map(role => (
                      <SelectItem key={role.id} value={role.id}>{role.displayName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {compareRoles.length === 2 && (
          <>
            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="border-emerald-200 dark:border-emerald-800">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <p className="text-xs text-muted-foreground">Common Permissions</p>
                      <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{intersection.size}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-blue-200 dark:border-blue-800">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <div>
                      <p className="text-xs text-muted-foreground">Unique to {compareRoles[0].displayName}</p>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                        {comparePerms[0].perms.size - intersection.size}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-purple-200 dark:border-purple-800">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-2">
                    <ArrowRight className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    <div>
                      <p className="text-xs text-muted-foreground">Unique to {compareRoles[1].displayName}</p>
                      <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                        {comparePerms[1].perms.size - intersection.size}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Comparison Matrix */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Permission Comparison Matrix</CardTitle>
                <CardDescription>
                  Green = granted, Red = denied, for each role
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-[500px]">
                  <div className="space-y-3">
                    {PERMISSION_CATALOG.map(group => (
                      <div key={group.group}>
                        <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                          {group.group}
                          <Separator className="flex-1" />
                        </p>
                        <div className="ml-2 space-y-1">
                          {group.modules.map(mod => (
                            <div key={mod.name} className="flex flex-wrap items-center gap-1.5 py-1">
                              <code className="text-xs font-mono w-28 flex-shrink-0">{mod.name}</code>
                              <div className="flex flex-wrap gap-1">
                                {mod.actions.map(action => {
                                  const permStr = `${mod.name}.${action}`;
                                  const r0 = comparePerms[0].perms.has(permStr);
                                  const r1 = comparePerms[1].perms.has(permStr);
                                  const isCommon = r0 && r1;
                                  const isDiff = r0 !== r1;

                                  return (
                                    <div
                                      key={permStr}
                                      className={`
                                        flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium border
                                        ${isCommon
                                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300'
                                          : isDiff
                                            ? r0
                                              ? 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-300'
                                              : 'bg-purple-50 border-purple-200 text-purple-800 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-300'
                                            : 'bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                                        }
                                      `}
                                    >
                                      {isCommon ? (
                                        <CheckCircle2 className="h-3 w-3" />
                                      ) : isDiff ? (
                                        r0 ? (
                                          <><span className="text-blue-600 dark:text-blue-400">R1</span><Ban className="h-3 w-3 text-red-400 dark:text-red-300" /></>
                                        ) : (
                                          <><Ban className="h-3 w-3 text-red-400 dark:text-red-300" /><span className="text-purple-600 dark:text-purple-400">R2</span></>
                                        )
                                      ) : (
                                        <><Ban className="h-3 w-3" /><Ban className="h-3 w-3" /></>
                                      )}
                                      {action}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Legend */}
            <div className="flex flex-wrap gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-8 rounded bg-emerald-100 border border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-800" />
                <span>Both Granted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-8 rounded bg-blue-50 border border-blue-200 dark:bg-blue-900/30 dark:border-blue-800" />
                <span>Only {compareRoles[0].displayName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-8 rounded bg-purple-50 border border-purple-200 dark:bg-purple-900/30 dark:border-purple-800" />
                <span>Only {compareRoles[1].displayName}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-4 w-8 rounded bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800" />
                <span>Neither</span>
              </div>
            </div>
          </>
        )}

        {compareRoles.length < 2 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <GitCompare className="h-12 w-12 text-muted-foreground" />
                <p className="text-muted-foreground text-center">
                  Select 2 roles to compare their permissions
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const AuditLogTab = () => (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Role & Permission Audit Log
          </CardTitle>
          <CardDescription>
            Recent changes to roles and permission assignments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {auditLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-3">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No audit log entries found</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Entity</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => {
                    const detail = log.newValue ? (() => {
                      try { return JSON.parse(log.newValue); } catch { return log.newValue; }
                    })() : null;

                    return (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {new Date(log.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={log.action === 'create' ? 'default' : log.action === 'delete' ? 'destructive' : 'secondary'}
                            className={log.action === 'create' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : log.action === 'delete' ? '' : ''}
                          >
                            {log.action === 'create' && <Plus className="mr-1 h-3 w-3" />}
                            {log.action === 'update' && <Edit className="mr-1 h-3 w-3" />}
                            {log.action === 'delete' && <Trash2 className="mr-1 h-3 w-3" />}
                            {log.action === 'system_init' && <Lock className="mr-1 h-3 w-3" />}
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {log.entityType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {detail && typeof detail === 'object' ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                {detail.name && (
                                  <span className="font-medium">{detail.displayName || detail.name}</span>
                                )}
                                {detail.permissions && (
                                  <span className="text-muted-foreground text-xs">
                                    {typeof detail.permissions === 'string' ? detail.permissions : `${detail.permissions} permissions`}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs truncate max-w-[200px] block">
                                {String(log.newValue || 'N/A')}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Audit Trail</AlertTitle>
        <AlertDescription>
          All role creation, updates, deletions, and permission changes are logged. Contact your system administrator for detailed audit reports.
        </AlertDescription>
      </Alert>
    </div>
  );

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <SectionGuard permission="admin.users">
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Roles & Permissions</h2>
            <p className="text-muted-foreground">
              Manage access control, roles, and permission assignments
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {totalModules} modules
            </Badge>
            <Badge variant="outline" className="font-mono">
              {totalPermissions} permissions
            </Badge>
            <Badge variant="outline" className="font-mono">
              {roles.length} roles
            </Badge>
          </div>
        </div>

        {/* Platform Admin Tenant Selector */}
        {isPlatformAdmin && (
          <Alert className="mb-4 border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-950/30">
            <Zap className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <AlertTitle className="text-teal-800 dark:text-teal-200">Platform Admin — Cross-Tenant Access</AlertTitle>
            <AlertDescription>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mt-2">
                <Label className="text-sm font-medium whitespace-nowrap">Manage roles for:</Label>
                <Select value={selectedTenantId} onValueChange={setSelectedTenantId}>
                  <SelectTrigger className="w-full sm:w-[300px]">
                    <SelectValue placeholder="Select tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <span>{t.name}</span>
                          <Badge variant="outline" className="text-xs">{t.plan}</Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {tenantsLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                <Badge className="bg-teal-600 text-white">{tenants.length} tenants</Badge>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" className="flex items-center gap-1.5">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Roles Overview</span>
              <span className="sm:hidden">Roles</span>
            </TabsTrigger>
            <TabsTrigger value="matrix" className="flex items-center gap-1.5">
              <Copy className="h-4 w-4" />
              <span className="hidden sm:inline">Permission Matrix</span>
              <span className="sm:hidden">Matrix</span>
            </TabsTrigger>
            <TabsTrigger value="tester" className="flex items-center gap-1.5">
              <ClipboardCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Permission Tester</span>
              <span className="sm:hidden">Test</span>
            </TabsTrigger>
            <TabsTrigger value="comparison" className="flex items-center gap-1.5">
              <GitCompare className="h-4 w-4" />
              <span className="hidden sm:inline">Role Comparison</span>
              <span className="sm:hidden">Compare</span>
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Audit Log</span>
              <span className="sm:hidden">Audit</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <RolesOverview />
          </TabsContent>

          <TabsContent value="matrix" className="mt-4">
            <PermissionMatrix />
          </TabsContent>

          <TabsContent value="tester" className="mt-4">
            <PermissionTester />
          </TabsContent>

          <TabsContent value="comparison" className="mt-4">
            <RoleComparison />
          </TabsContent>

          <TabsContent value="audit" className="mt-4">
            <AuditLogTab />
          </TabsContent>
        </Tabs>

        {/* ============================================================ */}
        {/* DIALOGS */}
        {/* ============================================================ */}

        {/* Create Role Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
              <DialogDescription>
                Create a new custom role with specific permissions. Use the Permission Matrix to assign permissions after creation.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="create-name">Role Name *</Label>
                <Input
                  id="create-name"
                  value={createForm.name}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') }))}
                  placeholder="e.g. front_desk_lead"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and underscores only</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-displayName">Display Name *</Label>
                <Input
                  id="create-displayName"
                  value={createForm.displayName}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, displayName: e.target.value }))}
                  placeholder="e.g. Front Desk Lead"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-description">Description</Label>
                <Input
                  id="create-description"
                  value={createForm.description}
                  onChange={(e) => setCreateForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateRole} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Role Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Role: {selectedRole?.displayName}</DialogTitle>
              <DialogDescription>
                Update role details. Use the Permission Matrix tab for granular permission editing.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-displayName">Display Name</Label>
                <Input
                  id="edit-displayName"
                  value={editForm.displayName}
                  onChange={(e) => setEditForm(prev => ({ ...prev, displayName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Quick Permissions</Label>
                  <span className="text-xs text-muted-foreground">
                    {editForm.permissions.length} permissions assigned
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setEditForm(prev => ({ ...prev, permissions: ['*'] }))}
                    disabled={selectedRole?.name === 'admin'}
                  >
                    <Zap className="mr-1 h-3 w-3" />
                    Full Access (*)
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setEditForm(prev => ({ ...prev, permissions: [] }))}
                    disabled={selectedRole?.name === 'admin'}
                  >
                    <Ban className="mr-1 h-3 w-3" />
                    No Access
                  </Button>
                </div>

                {selectedRole?.name === 'admin' && (
                  <Alert className="py-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-xs">Admin permissions cannot be modified</AlertTitle>
                  </Alert>
                )}

                <ScrollArea className="max-h-48">
                  <div className="space-y-1">
                    {PERMISSION_CATALOG.map(group => (
                      <div key={group.group}>
                        <p className="text-xs font-semibold text-muted-foreground mt-1">{group.group}</p>
                        <div className="flex flex-wrap gap-1 ml-1">
                          {group.modules.map(mod => (
                            <div key={mod.name}>
                              {mod.actions.map(action => {
                                const permStr = `${mod.name}.${action}`;
                                const has = editForm.permissions.includes('*') || editForm.permissions.includes(permStr);
                                return (
                                  <button
                                    key={permStr}
                                    type="button"
                                    disabled={selectedRole?.name === 'admin'}
                                    onClick={() => {
                                      if (editForm.permissions.includes('*')) {
                                        setEditForm(prev => ({
                                          ...prev,
                                          permissions: ALL_PERMISSIONS.filter(p => p !== '*' && p !== permStr),
                                        }));
                                      } else if (editForm.permissions.includes(permStr)) {
                                        setEditForm(prev => ({
                                          ...prev,
                                          permissions: prev.permissions.filter(p => p !== permStr),
                                        }));
                                      } else {
                                        setEditForm(prev => ({
                                          ...prev,
                                          permissions: [...prev.permissions, permStr],
                                        }));
                                      }
                                    }}
                                    className={`
                                      inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono border transition-colors
                                      ${has
                                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300'
                                        : 'bg-muted border-transparent text-muted-foreground hover:border-gray-300'
                                      }
                                      ${selectedRole?.name === 'admin' ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                                    `}
                                  >
                                    {permStr}
                                  </button>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateRole} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* View Permissions Dialog */}
        <Dialog open={isViewPermissionsDialogOpen} onOpenChange={setIsViewPermissionsDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {selectedRole?.isSystem && <Lock className="h-4 w-4 text-amber-500 dark:text-amber-400" />}
                Permissions: {selectedRole?.displayName}
              </DialogTitle>
              <DialogDescription>
                {selectedRole?.name && <code className="font-mono text-xs">{selectedRole.name}</code>}
                {' — '}{selectedRole?._count?.users || 0} users assigned
              </DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh] pr-4">
              <div className="space-y-4">
                {selectedRole && (() => {
                  const perms = parsePermissions(selectedRole.permissions);
                  const effective = effectivePermissions(perms);
                  return (
                    <>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                          <span><strong>{effective.size}</strong> permissions granted</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <XCircle className="h-4 w-4 text-red-500 dark:text-red-400" />
                          <span><strong>{totalPermissions - effective.size}</strong> permissions denied</span>
                        </div>
                      </div>

                      {perms.includes('*') && (
                        <Alert className="border-emerald-200 bg-emerald-50 dark:bg-emerald-900/10">
                          <Zap className="h-4 w-4" />
                          <AlertTitle>Full Access</AlertTitle>
                          <AlertDescription>
                            This role has global wildcard (&quot;*&quot;) — all {totalPermissions} permissions are granted.
                          </AlertDescription>
                        </Alert>
                      )}

                      {selectedRole.description && (
                        <p className="text-sm text-muted-foreground">{selectedRole.description}</p>
                      )}

                      <div className="space-y-2">
                        {PERMISSION_CATALOG.map(group => {
                          const groupGranted = group.modules.reduce(
                            (sum, mod) => sum + mod.actions.filter(a => effective.has(`${mod.name}.${a}`)).length,
                            0
                          );
                          const groupTotal = group.modules.reduce((sum, mod) => sum + mod.actions.length, 0);

                          return (
                            <div key={group.group} className="border rounded-lg p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="font-semibold text-sm">{group.group}</span>
                                <Badge variant={groupGranted === groupTotal ? 'default' : 'outline'} className={
                                  groupGranted === groupTotal
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                    : ''
                                }>
                                  {groupGranted}/{groupTotal}
                                </Badge>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                                {group.modules.map(mod => (
                                  <div key={mod.name} className="flex items-center gap-1">
                                    <code className="text-[11px] font-mono w-24 truncate">{mod.name}</code>
                                    <div className="flex flex-wrap gap-0.5">
                                      {mod.actions.map(action => {
                                        const permStr = `${mod.name}.${action}`;
                                        const has = effective.has(permStr);
                                        return (
                                          <span
                                            key={permStr}
                                            className={`text-[10px] px-1 py-0.5 rounded ${has ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}
                                          >
                                            {action}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsViewPermissionsDialogOpen(false)}>Close</Button>
              <Button
                onClick={() => {
                  if (selectedRole) {
                    setMatrixRoleId(selectedRole.id);
                    handleMatrixRoleChange(selectedRole.id);
                    setActiveTab('matrix');
                    setIsViewPermissionsDialogOpen(false);
                  }
                }}
              >
                <Copy className="mr-2 h-4 w-4" />
                Open in Matrix
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Role: {selectedRole?.displayName}</AlertDialogTitle>
              <AlertDialogDescription>
                {selectedRole?._count?.users && selectedRole._count.users > 0 ? (
                  <span className="text-red-600 dark:text-red-400 font-medium">
                    Cannot delete: {selectedRole._count.users} user(s) are assigned to this role. Reassign them first.
                  </span>
                ) : (
                  'Are you sure you want to delete this role? This action cannot be undone.'
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteRole}
                className="bg-red-600 hover:bg-red-700"
                disabled={isSaving || (selectedRole?._count?.users || 0) > 0}
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete Role
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
    </SectionGuard>
  );
}

export default RolePermissions;
