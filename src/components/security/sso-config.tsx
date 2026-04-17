'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2,
  Shield,
  Chrome,
  Building2,
  Server,
  Key,
  Save,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Info,
  Copy,
  Check,
  Plus,
  Trash2,
  TestTube,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { SectionGuard } from '@/components/common/section-guard';

interface SSOConnection {
  id: string;
  name: string;
  type: 'saml' | 'ldap' | 'oidc';
  status: string;
  samlEntityId?: string;
  samlSsoUrl?: string;
  ldapUrl?: string;
  ldapBaseDn?: string;
  oidcClientId?: string;
  oidcDiscoveryUrl?: string;
  emailAttribute: string;
  nameAttribute: string;
  roleAttribute?: string;
  autoProvision: boolean;
  autoProvisionRole?: string;
  syncRoles: boolean;
  allowedDomains?: string;
  lastSyncAt?: Date;
  lastSyncStatus?: string;
  testConnectionAt?: Date;
  testConnectionStatus?: string;
  sessionCount: number;
  createdAt: Date;
}

interface SSOConfigProps {
  tenantId?: string;
}

export function SSOConfig({ tenantId }: SSOConfigProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [connections, setConnections] = useState<SSOConnection[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<SSOConnection | null>(null);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [deleteConnectionId, setDeleteConnectionId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'saml' as 'saml' | 'ldap' | 'oidc',
    // SAML
    samlEntityId: '',
    samlSsoUrl: '',
    samlSloUrl: '',
    samlCertificate: '',
    samlPrivateKey: '',
    samlNameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    samlSignRequest: true,
    samlWantAssertionSigned: true,
    // LDAP
    ldapUrl: '',
    ldapBaseDn: '',
    ldapBindDn: '',
    ldapBindPassword: '',
    ldapSearchFilter: '(mail={email})',
    ldapUseSsl: true,
    ldapUseStartTls: false,
    ldapTimeout: 30,
    // OIDC
    oidcClientId: '',
    oidcClientSecret: '',
    oidcDiscoveryUrl: '',
    oidcScopes: 'openid profile email',
    oidcUsePkce: true,
    // Attributes
    emailAttribute: 'email',
    firstNameAttribute: 'givenName',
    lastNameAttribute: 'sn',
    nameAttribute: 'name',
    roleAttribute: '',
    departmentAttribute: '',
    phoneAttribute: 'telephoneNumber',
    // Provisioning
    autoProvision: true,
    autoProvisionRole: '',
    syncRoles: false,
    syncOnLogin: true,
    // Domains
    allowedDomains: '',
  });

  const [copiedText, setCopiedText] = useState<string | null>(null);

  useEffect(() => {
    fetchConnections();
  }, []);

  const fetchConnections = async () => {
    try {
      const response = await fetch('/api/auth/sso/connections');
      const data = await response.json();

      if (data.success) {
        setConnections(data.connections);
      }
    } catch (error) {
      console.error('Error fetching SSO connections:', error);
      toast.error('Failed to fetch SSO connections');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateConnection = async () => {
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: formData.name,
        type: formData.type,
        emailAttribute: formData.emailAttribute,
        firstNameAttribute: formData.firstNameAttribute,
        lastNameAttribute: formData.lastNameAttribute,
        nameAttribute: formData.nameAttribute,
        roleAttribute: formData.roleAttribute || null,
        departmentAttribute: formData.departmentAttribute || null,
        phoneAttribute: formData.phoneAttribute,
        autoProvision: formData.autoProvision,
        autoProvisionRole: formData.autoProvisionRole || null,
        syncRoles: formData.syncRoles,
        syncOnLogin: formData.syncOnLogin,
        allowedDomains: formData.allowedDomains
          ? formData.allowedDomains.split(',').map(d => d.trim())
          : null,
      };

      // Add type-specific fields
      if (formData.type === 'saml') {
        Object.assign(payload, {
          samlEntityId: formData.samlEntityId || null,
          samlSsoUrl: formData.samlSsoUrl,
          samlSloUrl: formData.samlSloUrl || null,
          samlCertificate: formData.samlCertificate || null,
          samlPrivateKey: formData.samlPrivateKey || null,
          samlNameIdFormat: formData.samlNameIdFormat,
          samlSignRequest: formData.samlSignRequest,
          samlWantAssertionSigned: formData.samlWantAssertionSigned,
        });
      } else if (formData.type === 'ldap') {
        Object.assign(payload, {
          ldapUrl: formData.ldapUrl,
          ldapBaseDn: formData.ldapBaseDn,
          ldapBindDn: formData.ldapBindDn || null,
          ldapBindPassword: formData.ldapBindPassword || null,
          ldapSearchFilter: formData.ldapSearchFilter,
          ldapUseSsl: formData.ldapUseSsl,
          ldapUseStartTls: formData.ldapUseStartTls,
          ldapTimeout: formData.ldapTimeout,
        });
      } else if (formData.type === 'oidc') {
        Object.assign(payload, {
          oidcClientId: formData.oidcClientId,
          oidcClientSecret: formData.oidcClientSecret || null,
          oidcDiscoveryUrl: formData.oidcDiscoveryUrl || null,
          oidcScopes: formData.oidcScopes,
          oidcUsePkce: formData.oidcUsePkce,
        });
      }

      const response = await fetch('/api/auth/sso/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('SSO connection created successfully');
        setShowCreateDialog(false);
        resetForm();
        fetchConnections();
      } else {
        toast.error(data.error || 'Failed to create SSO connection');
      }
    } catch (error) {
      console.error('Error creating SSO connection:', error);
      toast.error('Failed to create SSO connection');
    } finally {
      setIsSaving(false);
    }
  };

  const SECRET_PLACEHOLDER = '••••••••';

  const handleUpdateConnection = async () => {
    if (!selectedConnection) return;

    setIsSaving(true);
    try {
      // Build payload, omitting secret fields that still have the placeholder
      // (meaning the user didn't change them, so we preserve existing server values)
      const payload: Record<string, unknown> = {
        id: selectedConnection.id,
        name: formData.name,
        type: formData.type,
        emailAttribute: formData.emailAttribute,
        firstNameAttribute: formData.firstNameAttribute,
        lastNameAttribute: formData.lastNameAttribute,
        nameAttribute: formData.nameAttribute,
        roleAttribute: formData.roleAttribute || null,
        departmentAttribute: formData.departmentAttribute || null,
        phoneAttribute: formData.phoneAttribute,
        autoProvision: formData.autoProvision,
        autoProvisionRole: formData.autoProvisionRole || null,
        syncRoles: formData.syncRoles,
        syncOnLogin: formData.syncOnLogin,
        allowedDomains: formData.allowedDomains
          ? formData.allowedDomains.split(',').map(d => d.trim())
          : null,
      };

      // Only include secret fields if the user has changed them (no longer the placeholder)
      if (formData.type === 'saml') {
        Object.assign(payload, {
          samlEntityId: formData.samlEntityId || null,
          samlSsoUrl: formData.samlSsoUrl || null,
          samlSloUrl: formData.samlSloUrl || null,
          samlCertificate: formData.samlCertificate && formData.samlCertificate !== SECRET_PLACEHOLDER ? formData.samlCertificate : undefined,
          samlPrivateKey: formData.samlPrivateKey && formData.samlPrivateKey !== SECRET_PLACEHOLDER ? formData.samlPrivateKey : undefined,
          samlNameIdFormat: formData.samlNameIdFormat,
          samlSignRequest: formData.samlSignRequest,
          samlWantAssertionSigned: formData.samlWantAssertionSigned,
        });
      } else if (formData.type === 'ldap') {
        Object.assign(payload, {
          ldapUrl: formData.ldapUrl,
          ldapBaseDn: formData.ldapBaseDn,
          ldapBindDn: formData.ldapBindDn || null,
          ldapBindPassword: formData.ldapBindPassword && formData.ldapBindPassword !== SECRET_PLACEHOLDER ? formData.ldapBindPassword : undefined,
          ldapSearchFilter: formData.ldapSearchFilter,
          ldapUseSsl: formData.ldapUseSsl,
          ldapUseStartTls: formData.ldapUseStartTls,
          ldapTimeout: formData.ldapTimeout,
        });
      } else if (formData.type === 'oidc') {
        Object.assign(payload, {
          oidcClientId: formData.oidcClientId,
          oidcClientSecret: formData.oidcClientSecret && formData.oidcClientSecret !== SECRET_PLACEHOLDER ? formData.oidcClientSecret : undefined,
          oidcDiscoveryUrl: formData.oidcDiscoveryUrl || null,
          oidcScopes: formData.oidcScopes,
          oidcUsePkce: formData.oidcUsePkce,
        });
      }

      const response = await fetch('/api/auth/sso/connections', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('SSO connection updated successfully');
        setShowEditDialog(false);
        setSelectedConnection(null);
        resetForm();
        fetchConnections();
      } else {
        toast.error(data.error || 'Failed to update SSO connection');
      }
    } catch (error) {
      console.error('Error updating SSO connection:', error);
      toast.error('Failed to update SSO connection');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConnection = (id: string) => {
    setDeleteConnectionId(id);
  };

  const confirmDeleteConnection = async () => {
    if (!deleteConnectionId) return;

    try {
      const response = await fetch(`/api/auth/sso/connections?id=${deleteConnectionId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast.success('SSO connection deleted');
        fetchConnections();
      } else {
        toast.error(data.error || 'Failed to delete SSO connection');
      }
    } catch (error) {
      console.error('Error deleting SSO connection:', error);
      toast.error('Failed to delete SSO connection');
    } finally {
      setDeleteConnectionId(null);
    }
  };

  const handleTestConnection = async (connection: SSOConnection) => {
    setTestingConnection(connection.id);
    try {
      const endpoint = connection.type === 'saml'
        ? `/api/auth/sso/saml/${connection.id}`
        : connection.type === 'ldap'
          ? `/api/auth/sso/ldap/${connection.id}`
          : `/api/auth/sso/oidc/${connection.id}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message || 'Connection test successful');
        fetchConnections();
      } else {
        toast.error(data.message || 'Connection test failed');
      }
    } catch (error) {
      console.error('Error testing connection:', error);
      toast.error('Connection test failed');
    } finally {
      setTestingConnection(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'saml',
      samlEntityId: '',
      samlSsoUrl: '',
      samlSloUrl: '',
      samlCertificate: '',
      samlPrivateKey: '',
      samlNameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      samlSignRequest: true,
      samlWantAssertionSigned: true,
      ldapUrl: '',
      ldapBaseDn: '',
      ldapBindDn: '',
      ldapBindPassword: '',
      ldapSearchFilter: '(mail={email})',
      ldapUseSsl: true,
      ldapUseStartTls: false,
      ldapTimeout: 30,
      oidcClientId: '',
      oidcClientSecret: '',
      oidcDiscoveryUrl: '',
      oidcScopes: 'openid profile email',
      oidcUsePkce: true,
      emailAttribute: 'email',
      firstNameAttribute: 'givenName',
      lastNameAttribute: 'sn',
      nameAttribute: 'name',
      roleAttribute: '',
      departmentAttribute: '',
      phoneAttribute: 'telephoneNumber',
      autoProvision: true,
      autoProvisionRole: '',
      syncRoles: false,
      syncOnLogin: true,
      allowedDomains: '',
    });
  };

  const openEditDialog = (connection: SSOConnection) => {
    setSelectedConnection(connection);
    setFormData({
      name: connection.name,
      type: connection.type,
      samlEntityId: connection.samlEntityId || '',
      samlSsoUrl: connection.samlSsoUrl || '',
      samlSloUrl: '', // Not returned by API - left empty for user to fill if needed
      samlCertificate: '••••••••', // Placeholder indicates existing value on server
      samlPrivateKey: '••••••••', // Placeholder indicates existing value on server
      samlNameIdFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
      samlSignRequest: true,
      samlWantAssertionSigned: true,
      ldapUrl: connection.ldapUrl || '',
      ldapBaseDn: connection.ldapBaseDn || '',
      ldapBindDn: '', // Not returned by API for security
      ldapBindPassword: '••••••••', // Placeholder indicates existing value on server
      ldapSearchFilter: '(mail={email})',
      ldapUseSsl: true,
      ldapUseStartTls: false,
      ldapTimeout: 30,
      oidcClientId: connection.oidcClientId || '',
      oidcClientSecret: '••••••••', // Placeholder indicates existing value on server
      oidcDiscoveryUrl: connection.oidcDiscoveryUrl || '',
      oidcScopes: 'openid profile email',
      oidcUsePkce: true,
      emailAttribute: connection.emailAttribute,
      firstNameAttribute: 'givenName',
      lastNameAttribute: 'sn',
      nameAttribute: connection.nameAttribute,
      roleAttribute: connection.roleAttribute || '',
      departmentAttribute: '',
      phoneAttribute: 'telephoneNumber',
      autoProvision: connection.autoProvision,
      autoProvisionRole: connection.autoProvisionRole || '',
      syncRoles: connection.syncRoles,
      syncOnLogin: true,
      allowedDomains: connection.allowedDomains || '',
    });
    setShowEditDialog(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
    toast.success('Copied to clipboard');
  };

  const getAcsUrl = (connectionId: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/api/auth/sso/saml/${connectionId}/acs`;
  };

  const getMetadataUrl = (connectionId: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/api/auth/sso/saml/${connectionId}?action=metadata`;
  };

  const getOidcCallbackUrl = (connectionId: string) => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/api/auth/sso/oidc/${connectionId}/callback`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <SectionGuard permission="security.sso">
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-purple-100 dark:bg-purple-900/30 p-2">
                <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardTitle>Enterprise Single Sign-On (SSO)</CardTitle>
                <CardDescription>
                  Configure SAML, LDAP, and OIDC providers for your organization
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => { resetForm(); setShowCreateDialog(true); }} className="bg-teal-600 hover:bg-teal-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Connection
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {connections.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium">No SSO Connections</p>
              <p className="text-sm">Add an SSO connection to enable enterprise authentication</p>
            </div>
          ) : (
            <div className="space-y-4">
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex items-center gap-4">
                    <div className="rounded-full bg-muted p-2">
                      {connection.type === 'saml' && <Building2 className="h-5 w-5" />}
                      {connection.type === 'ldap' && <Server className="h-5 w-5" />}
                      {connection.type === 'oidc' && <Key className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="font-medium">{connection.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {connection.type.toUpperCase()} • {connection.sessionCount} sessions
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={connection.status === 'active' ? 'default' : 'secondary'}>
                      {connection.status}
                    </Badge>
                    {connection.testConnectionStatus && (
                      <Badge variant={connection.testConnectionStatus === 'success' ? 'default' : 'destructive'}>
                        {connection.testConnectionStatus === 'success' ? 'Connected' : 'Failed'}
                      </Badge>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTestConnection(connection)}
                      disabled={testingConnection === connection.id}
                    >
                      {testingConnection === connection.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <TestTube className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(connection)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteConnection(connection.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Connection Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create SSO Connection</DialogTitle>
            <DialogDescription>
              Configure a new SSO connection for your organization
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Connection Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Corporate SAML"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Connection Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: 'saml' | 'ldap' | 'oidc') => setFormData({ ...formData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saml">SAML 2.0</SelectItem>
                    <SelectItem value="ldap">LDAP / Active Directory</SelectItem>
                    <SelectItem value="oidc">OpenID Connect</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* SAML Configuration */}
            {formData.type === 'saml' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">SAML Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="samlSsoUrl">SSO URL *</Label>
                      <Input
                        id="samlSsoUrl"
                        placeholder="https://idp.example.com/sso"
                        value={formData.samlSsoUrl}
                        onChange={(e) => setFormData({ ...formData, samlSsoUrl: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="samlSloUrl">SLO URL (Optional)</Label>
                      <Input
                        id="samlSloUrl"
                        placeholder="https://idp.example.com/slo"
                        value={formData.samlSloUrl}
                        onChange={(e) => setFormData({ ...formData, samlSloUrl: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="samlEntityId">Entity ID (Optional)</Label>
                    <Input
                      id="samlEntityId"
                      placeholder="Leave blank to auto-generate"
                      value={formData.samlEntityId}
                      onChange={(e) => setFormData({ ...formData, samlEntityId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="samlCertificate">X.509 Certificate</Label>
                    <Textarea
                      id="samlCertificate"
                      placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                      value={formData.samlCertificate}
                      onChange={(e) => setFormData({ ...formData, samlCertificate: e.target.value })}
                      rows={4}
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="samlSignRequest"
                        checked={formData.samlSignRequest}
                        onCheckedChange={(checked) => setFormData({ ...formData, samlSignRequest: checked })}
                      />
                      <Label htmlFor="samlSignRequest">Sign Requests</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="samlWantAssertionSigned"
                        checked={formData.samlWantAssertionSigned}
                        onCheckedChange={(checked) => setFormData({ ...formData, samlWantAssertionSigned: checked })}
                      />
                      <Label htmlFor="samlWantAssertionSigned">Require Signed Assertions</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* LDAP Configuration */}
            {formData.type === 'ldap' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">LDAP Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ldapUrl">LDAP URL *</Label>
                      <Input
                        id="ldapUrl"
                        placeholder="ldap://dc.example.com:389"
                        value={formData.ldapUrl}
                        onChange={(e) => setFormData({ ...formData, ldapUrl: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ldapBaseDn">Base DN *</Label>
                      <Input
                        id="ldapBaseDn"
                        placeholder="dc=example,dc=com"
                        value={formData.ldapBaseDn}
                        onChange={(e) => setFormData({ ...formData, ldapBaseDn: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="ldapBindDn">Bind DN (Service Account)</Label>
                      <Input
                        id="ldapBindDn"
                        placeholder="cn=admin,dc=example,dc=com"
                        value={formData.ldapBindDn}
                        onChange={(e) => setFormData({ ...formData, ldapBindDn: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ldapBindPassword">Bind Password</Label>
                      <Input
                        id="ldapBindPassword"
                        type="password"
                        placeholder="••••••••"
                        value={formData.ldapBindPassword}
                        onChange={(e) => setFormData({ ...formData, ldapBindPassword: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="ldapSearchFilter">Search Filter</Label>
                    <Input
                      id="ldapSearchFilter"
                      placeholder="(mail={email})"
                      value={formData.ldapSearchFilter}
                      onChange={(e) => setFormData({ ...formData, ldapSearchFilter: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Use {'{email}'} as placeholder for the user&apos;s email
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="ldapUseSsl"
                        checked={formData.ldapUseSsl}
                        onCheckedChange={(checked) => setFormData({ ...formData, ldapUseSsl: checked })}
                      />
                      <Label htmlFor="ldapUseSsl">Use SSL (LDAPS)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="ldapUseStartTls"
                        checked={formData.ldapUseStartTls}
                        onCheckedChange={(checked) => setFormData({ ...formData, ldapUseStartTls: checked })}
                      />
                      <Label htmlFor="ldapUseStartTls">Use StartTLS</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* OIDC Configuration */}
            {formData.type === 'oidc' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">OIDC Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="oidcDiscoveryUrl">Discovery URL</Label>
                    <Input
                      id="oidcDiscoveryUrl"
                      placeholder="https://accounts.google.com/.well-known/openid-configuration"
                      value={formData.oidcDiscoveryUrl}
                      onChange={(e) => setFormData({ ...formData, oidcDiscoveryUrl: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Auto-configures endpoints from the discovery document
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="oidcClientId">Client ID *</Label>
                      <Input
                        id="oidcClientId"
                        placeholder="your-client-id"
                        value={formData.oidcClientId}
                        onChange={(e) => setFormData({ ...formData, oidcClientId: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="oidcClientSecret">Client Secret</Label>
                      <Input
                        id="oidcClientSecret"
                        type="password"
                        placeholder="••••••••"
                        value={formData.oidcClientSecret}
                        onChange={(e) => setFormData({ ...formData, oidcClientSecret: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="oidcScopes">Scopes</Label>
                      <Input
                        id="oidcScopes"
                        placeholder="openid profile email"
                        value={formData.oidcScopes}
                        onChange={(e) => setFormData({ ...formData, oidcScopes: e.target.value })}
                      />
                    </div>
                    <div className="flex items-center space-x-2 pt-6">
                      <Switch
                        id="oidcUsePkce"
                        checked={formData.oidcUsePkce}
                        onCheckedChange={(checked) => setFormData({ ...formData, oidcUsePkce: checked })}
                      />
                      <Label htmlFor="oidcUsePkce">Use PKCE</Label>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Attribute Mapping */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Attribute Mapping</CardTitle>
                <CardDescription>
                  Map SSO attributes to application user fields
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="emailAttribute">Email Attribute</Label>
                    <Input
                      id="emailAttribute"
                      value={formData.emailAttribute}
                      onChange={(e) => setFormData({ ...formData, emailAttribute: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="firstNameAttribute">First Name Attribute</Label>
                    <Input
                      id="firstNameAttribute"
                      value={formData.firstNameAttribute}
                      onChange={(e) => setFormData({ ...formData, firstNameAttribute: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastNameAttribute">Last Name Attribute</Label>
                    <Input
                      id="lastNameAttribute"
                      value={formData.lastNameAttribute}
                      onChange={(e) => setFormData({ ...formData, lastNameAttribute: e.target.value })}
                    />
                  </div>
                </div>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="nameAttribute">Full Name Attribute</Label>
                    <Input
                      id="nameAttribute"
                      value={formData.nameAttribute}
                      onChange={(e) => setFormData({ ...formData, nameAttribute: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="roleAttribute">Role Attribute (Optional)</Label>
                    <Input
                      id="roleAttribute"
                      placeholder="e.g., groups"
                      value={formData.roleAttribute}
                      onChange={(e) => setFormData({ ...formData, roleAttribute: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phoneAttribute">Phone Attribute</Label>
                    <Input
                      id="phoneAttribute"
                      value={formData.phoneAttribute}
                      onChange={(e) => setFormData({ ...formData, phoneAttribute: e.target.value })}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Provisioning Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">User Provisioning</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Auto-provision Users</div>
                    <div className="text-sm text-muted-foreground">
                      Automatically create user accounts on first login
                    </div>
                  </div>
                  <Switch
                    checked={formData.autoProvision}
                    onCheckedChange={(checked) => setFormData({ ...formData, autoProvision: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Sync on Login</div>
                    <div className="text-sm text-muted-foreground">
                      Update user attributes on each login
                    </div>
                  </div>
                  <Switch
                    checked={formData.syncOnLogin}
                    onCheckedChange={(checked) => setFormData({ ...formData, syncOnLogin: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Sync Roles from Groups</div>
                    <div className="text-sm text-muted-foreground">
                      Update user roles based on group membership
                    </div>
                  </div>
                  <Switch
                    checked={formData.syncRoles}
                    onCheckedChange={(checked) => setFormData({ ...formData, syncRoles: checked })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="allowedDomains">Allowed Domains (Optional)</Label>
                  <Input
                    id="allowedDomains"
                    placeholder="company.com, subsidiary.com"
                    value={formData.allowedDomains}
                    onChange={(e) => setFormData({ ...formData, allowedDomains: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Comma-separated list of allowed email domains
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateConnection} disabled={isSaving} className="bg-teal-600 hover:bg-teal-700">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Create Connection
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Connection Dialog - Similar structure */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit SSO Connection</DialogTitle>
            <DialogDescription>
              Update the SSO connection settings
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Connection URLs */}
            {selectedConnection?.type === 'saml' && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>ACS URL:</strong>{' '}
                  <code className="text-xs bg-muted px-1 rounded">{getAcsUrl(selectedConnection.id)}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2"
                    onClick={() => copyToClipboard(getAcsUrl(selectedConnection.id))}
                  >
                    {copiedText === getAcsUrl(selectedConnection.id) ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                  <br />
                  <strong>Metadata URL:</strong>{' '}
                  <code className="text-xs bg-muted px-1 rounded">{getMetadataUrl(selectedConnection.id)}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2"
                    onClick={() => copyToClipboard(getMetadataUrl(selectedConnection.id))}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {selectedConnection?.type === 'oidc' && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Callback URL:</strong>{' '}
                  <code className="text-xs bg-muted px-1 rounded">{getOidcCallbackUrl(selectedConnection.id)}</code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2"
                    onClick={() => copyToClipboard(getOidcCallbackUrl(selectedConnection.id))}
                  >
                    {copiedText === getOidcCallbackUrl(selectedConnection.id) ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* Same form fields as create dialog */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Connection Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.autoProvision ? 'active' : 'inactive'}
                  onValueChange={(value) => setFormData({ ...formData, autoProvision: value === 'active' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateConnection} disabled={isSaving} className="bg-teal-600 hover:bg-teal-700">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConnectionId} onOpenChange={(open) => !open && setDeleteConnectionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete SSO Connection</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this SSO connection? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteConnection} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </SectionGuard>
  );
}

export default SSOConfig;
