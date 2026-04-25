'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Wifi,
  Plus,
  Search,
  MoreVertical,
  UserCheck,
  UserX,
  RefreshCw,
  Copy,
  Clock,
  Activity,
  Download,
  Upload,
  AlertTriangle,
  Check,
  Key,
  Monitor,
  Smartphone,
  Laptop,
  Tablet,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';

interface WiFiUser {
  id: string;
  username: string;
  status: string;
  userType: string;
  validFrom: string;
  validUntil: string;
  totalBytesIn: number;
  totalBytesOut: number;
  sessionCount: number;
  radiusSynced: boolean;
  createdAt: string;
  radCheck?: { attribute: string; value: string }[];
  radReply?: { attribute: string; value: string }[];
}

export function WiFiUsersManagement() {
  const [users, setUsers] = useState<WiFiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<WiFiUser | null>(null);
  const [showProvisionDialog, setShowProvisionDialog] = useState(false);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    downloadSpeed: 10,
    uploadSpeed: 10,
    sessionLimit: 0,
    validFrom: new Date().toISOString().slice(0, 16),
    validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    userType: 'guest',
  });

  useEffect(() => {
    fetchUsers();
  }, [statusFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }

      const response = await fetch(`/api/wifi/users?${params}`);
      const data = await response.json();

      if (data.success) {
        setUsers(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch WiFi users');
    } finally {
      setLoading(false);
    }
  };

  const handleProvision = async () => {
    try {
      const response = await fetch('/api/wifi/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          downloadSpeed: formData.downloadSpeed * 1000000,
          uploadSpeed: formData.uploadSpeed * 1000000,
          validFrom: new Date(formData.validFrom),
          validUntil: new Date(formData.validUntil),
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('WiFi user provisioned successfully');
        setShowProvisionDialog(false);
        fetchUsers();
        // Show credentials
        if (data.data?.credentials) {
          toast.info(
            `Username: ${data.data.credentials.username}\nPassword: ${data.data.credentials.password}`,
            { duration: 10000 }
          );
        }
      } else {
        toast.error(data.error || 'Failed to provision user');
      }
    } catch (error) {
      console.error('Error provisioning user:', error);
      toast.error('Failed to provision WiFi user');
    }
  };

  const handleSuspend = async (userId: string) => {
    try {
      const response = await fetch(`/api/wifi/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'suspended' }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('WiFi user suspended');
        fetchUsers();
      } else {
        toast.error(data.error || 'Failed to suspend user');
      }
    } catch (error) {
      toast.error('Failed to suspend user');
    }
  };

  const handleReactivate = async (userId: string) => {
    try {
      const response = await fetch(`/api/wifi/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'active' }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('WiFi user reactivated');
        fetchUsers();
      } else {
        toast.error(data.error || 'Failed to reactivate user');
      }
    } catch (error) {
      toast.error('Failed to reactivate user');
    }
  };

  const handleDelete = (userId: string) => {
    setDeleteUserId(userId);
  };

  const confirmDelete = async () => {
    if (!deleteUserId) return;

    try {
      const response = await fetch(`/api/wifi/users/${deleteUserId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('WiFi user deprovisioned');
        fetchUsers();
      } else {
        toast.error(data.error || 'Failed to deprovision user');
      }
    } catch (error) {
      toast.error('Failed to deprovision user');
    } finally {
      setDeleteUserId(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
      active: { variant: 'default', className: 'bg-emerald-600' },
      suspended: { variant: 'secondary', className: 'bg-amber-500 text-white' },
      expired: { variant: 'outline', className: 'border-gray-400 text-gray-500' },
      revoked: { variant: 'destructive', className: '' },
    };
    const style = styles[status] || styles.active;
    return (
      <Badge variant={style.variant} className={style.className}>
        {status}
      </Badge>
    );
  };

  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div>
          <h2 className="text-2xl font-bold">WiFi Users</h2>
          <p className="text-muted-foreground">
            Manage RADIUS authentication for guests
          </p>
        </div>
        <Dialog open={showProvisionDialog} onOpenChange={setShowProvisionDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Provision User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Provision WiFi User</DialogTitle>
              <DialogDescription>
                Create new WiFi credentials for guest access
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username (optional)</Label>
                  <Input
                    id="username"
                    placeholder="Auto-generate"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password (optional)</Label>
                  <Input
                    id="password"
                    placeholder="Auto-generate"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="download">Download (Mbps)</Label>
                  <Input
                    id="download"
                    type="number"
                    value={formData.downloadSpeed}
                    onChange={(e) => setFormData({ ...formData, downloadSpeed: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="upload">Upload (Mbps)</Label>
                  <Input
                    id="upload"
                    type="number"
                    value={formData.uploadSpeed}
                    onChange={(e) => setFormData({ ...formData, uploadSpeed: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="validFrom">Valid From</Label>
                  <Input
                    id="validFrom"
                    type="datetime-local"
                    value={formData.validFrom}
                    onChange={(e) => setFormData({ ...formData, validFrom: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="validUntil">Valid Until</Label>
                  <Input
                    id="validUntil"
                    type="datetime-local"
                    value={formData.validUntil}
                    onChange={(e) => setFormData({ ...formData, validUntil: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="userType">User Type</Label>
                <Select
                  value={formData.userType}
                  onValueChange={(value) => setFormData({ ...formData, userType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="guest">Guest</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="service">Service Account</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowProvisionDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleProvision}>
                <Wifi className="h-4 w-4 mr-2" />
                Provision
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />
              <div>
                <p className="text-2xl font-bold">{users.filter(u => u.status === 'active').length}</p>
                <p className="text-sm text-muted-foreground">Active Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-500 dark:text-blue-400" />
              <div>
                <p className="text-2xl font-bold">{users.length}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Download className="h-5 w-5 text-purple-500 dark:text-purple-400" />
              <div>
                <p className="text-2xl font-bold">
                  {formatBytes(users.reduce((sum, u) => sum + u.totalBytesIn, 0))}
                </p>
                <p className="text-sm text-muted-foreground">Total Download</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              <div>
                <p className="text-2xl font-bold">
                  {formatBytes(users.reduce((sum, u) => sum + u.totalBytesOut, 0))}
                </p>
                <p className="text-sm text-muted-foreground">Total Upload</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by username..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="revoked">Revoked</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={fetchUsers}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Valid Until</TableHead>
                <TableHead>Data Used</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead>Synced</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    No WiFi users found
                  </TableCell>
                </TableRow>
              ) : (
                filteredUsers.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono">{user.username}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(user.username)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{user.userType}</Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(user.status)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(user.validUntil), 'MMM d, HH:mm')}
                      </div>
                    </TableCell>
                    <TableCell>
                      {formatBytes(user.totalBytesIn + user.totalBytesOut)}
                    </TableCell>
                    <TableCell>{user.sessionCount}</TableCell>
                    <TableCell>
                      {user.radiusSynced ? (
                        <Check className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                      ) : (
                        <RefreshCw className="h-4 w-4 text-amber-500 dark:text-amber-400 animate-spin" />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {user.status === 'active' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSuspend(user.id)}
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                        ) : user.status === 'suspended' ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReactivate(user.id)}
                          >
                            <UserCheck className="h-4 w-4 text-emerald-500 dark:text-emerald-400" />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowDetailsDialog(true);
                          }}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* User Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>User Details</DialogTitle>
          </DialogHeader>
          {selectedUser && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Username</Label>
                  <p className="font-mono">{selectedUser.username}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Status</Label>
                  <p>{getStatusBadge(selectedUser.status)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Valid From</Label>
                  <p>{format(new Date(selectedUser.validFrom), 'PPP p')}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Valid Until</Label>
                  <p>{format(new Date(selectedUser.validUntil), 'PPP p')}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total Download</Label>
                  <p>{formatBytes(selectedUser.totalBytesIn)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total Upload</Label>
                  <p>{formatBytes(selectedUser.totalBytesOut)}</p>
                </div>
              </div>

              {selectedUser.radReply && selectedUser.radReply.length > 0 && (
                <div>
                  <Label className="text-muted-foreground">RADIUS Attributes</Label>
                  <div className="mt-2 space-y-1">
                    {selectedUser.radReply.map((reply, i) => (
                      <div key={i} className="flex justify-between text-sm bg-muted/50 px-2 py-1 rounded">
                        <span className="font-medium">{reply.attribute}</span>
                        <span className="font-mono">{reply.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
                  Close
                </Button>
                {selectedUser.status !== 'revoked' && (
                  <Button variant="destructive" onClick={() => {
                    handleDelete(selectedUser.id);
                    setShowDetailsDialog(false);
                  }}>
                    Deprovision
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteUserId} onOpenChange={(open) => !open && setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deprovision WiFi User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to deprovision this WiFi user? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Deprovision
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
