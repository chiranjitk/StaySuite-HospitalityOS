'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Shield,
  Download,
  Trash2,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  FileText,
  Users,
  BarChart3,
  Loader2,
  RefreshCw,
  UserX,
} from 'lucide-react';
import { ConsentForm } from './consent-form';
import { SectionGuard } from '@/components/common/section-guard';

interface GDPRRequest {
  id: string;
  guestId: string | null;
  requestType: string;
  status: string;
  requestSource: string;
  requesterEmail: string | null;
  requesterName: string | null;
  priority: string;
  notes: string | null;
  rejectionReason: string | null;
  completedAt: Date | null;
  completedBy: string | null;
  downloadUrl: string | null;
  createdAt: Date;
  expiresAt: Date | null;
}

interface ConsentRecord {
  id: string;
  guestId: string | null;
  userId: string | null;
  consentType: string;
  consentCategory: string;
  granted: boolean;
  grantedAt: Date | null;
  grantedVia: string | null;
  revoked: boolean;
  revokedAt: Date | null;
  createdAt: Date;
}

interface GDPRStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  rejected: number;
  failed: number;
  byType: {
    export: number;
    delete: number;
    anonymize: number;
  };
}

interface ConsentStats {
  total: number;
  byType: Record<string, { granted: number; revoked: number }>;
  byCategory: Record<string, number>;
  recentGrants: number;
  recentRevocations: number;
}

interface GDPRManagerProps {
  tenantId?: string;
}

export function GDPRManager({ tenantId }: GDPRManagerProps) {
  const [requests, setRequests] = useState<GDPRRequest[]>([]);
  const [consentRecords, setConsentRecords] = useState<ConsentRecord[]>([]);
  const [gdprStats, setGdprStats] = useState<GDPRStats | null>(null);
  const [consentStats, setConsentStats] = useState<ConsentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedGuestId, setSelectedGuestId] = useState('');
  const [exportFormat, setExportFormat] = useState('json');
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch GDPR data
  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch requests
      const requestsRes = await fetch('/api/gdpr/status');
      if (requestsRes.ok) {
        const requestsData = await requestsRes.json();
        setRequests(requestsData.data?.requests || []);
        setGdprStats(requestsData.data?.stats || null);
      }

      // Fetch consent records
      const consentRes = await fetch('/api/gdpr/consent?includeStats=true');
      if (consentRes.ok) {
        const consentData = await consentRes.json();
        setConsentRecords(consentData.data?.records || []);
        setConsentStats(consentData.data?.stats || null);
      }
    } catch (err) {
      setError('Failed to fetch GDPR data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle export request
  const handleExport = async () => {
    if (!selectedGuestId) {
      setError('Please enter a Guest ID');
      return;
    }

    setProcessing('export');
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/gdpr/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: selectedGuestId,
          format: exportFormat,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess('Data export completed successfully');
        // Trigger download
        if (data.data?.exportData) {
          const blob = new Blob([JSON.stringify(data.data.exportData, null, 2)], {
            type: 'application/json',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `gdpr-export-${selectedGuestId}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }
        fetchData();
      } else {
        setError(data.error?.message || 'Export failed');
      }
    } catch (err) {
      setError('Failed to export data');
      console.error(err);
    } finally {
      setProcessing(null);
    }
  };

  // Handle delete request
  const handleDelete = async (hardDelete: boolean = false) => {
    if (!selectedGuestId) {
      setError('Please enter a Guest ID');
      return;
    }

    setProcessing('delete');
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/gdpr/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: selectedGuestId,
          hardDelete,
          preserveFinancialRecords: true,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`Data deletion completed: ${data.data?.deletedRecords?.join(', ')}`);
        fetchData();
      } else {
        setError(data.error?.message || 'Deletion failed');
      }
    } catch (err) {
      setError('Failed to delete data');
      console.error(err);
    } finally {
      setProcessing(null);
    }
  };

  // Handle anonymize request
  const handleAnonymize = async () => {
    if (!selectedGuestId) {
      setError('Please enter a Guest ID');
      return;
    }

    setProcessing('anonymize');
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/gdpr/anonymize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: selectedGuestId,
          preserveAnalytics: true,
          preserveFinancialRecords: true,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`Data anonymization completed. Fields anonymized: ${data.data?.anonymizedFields?.join(', ')}`);
        fetchData();
      } else {
        setError(data.error?.message || 'Anonymization failed');
      }
    } catch (err) {
      setError('Failed to anonymize data');
      console.error(err);
    } finally {
      setProcessing(null);
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
      pending: { variant: 'secondary', icon: <Clock className="h-3 w-3 mr-1" /> },
      processing: { variant: 'default', icon: <Loader2 className="h-3 w-3 mr-1 animate-spin" /> },
      completed: { variant: 'default', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      rejected: { variant: 'destructive', icon: <XCircle className="h-3 w-3 mr-1" /> },
      failed: { variant: 'destructive', icon: <AlertTriangle className="h-3 w-3 mr-1" /> },
    };

    const config = statusConfig[status] || statusConfig.pending;

    return (
      <Badge variant={config.variant} className="flex items-center">
        {config.icon}
        {status}
      </Badge>
    );
  };

  // Get request type badge
  const getTypeBadge = (type: string) => {
    const typeConfig: Record<string, { color: string; icon: React.ReactNode }> = {
      export: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', icon: <Download className="h-3 w-3 mr-1" /> },
      delete: { color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200', icon: <Trash2 className="h-3 w-3 mr-1" /> },
      anonymize: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200', icon: <UserX className="h-3 w-3 mr-1" /> },
    };

    const config = typeConfig[type] || typeConfig.export;

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${config.color}`}>
        {config.icon}
        {type}
      </span>
    );
  };

  // Format date
  const formatDate = (date: Date | string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <SectionGuard permission="gdpr.manage">
      <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">GDPR Compliance</h2>
          <p className="text-muted-foreground">
            Manage data subject requests, consent, and compliance
          </p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gdprStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {gdprStats?.pending || 0} pending, {gdprStats?.processing || 0} processing
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{gdprStats?.completed || 0}</div>
            <p className="text-xs text-muted-foreground">
              Export: {gdprStats?.byType?.export || 0}, Delete: {gdprStats?.byType?.delete || 0}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consent Records</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{consentStats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {consentStats?.recentGrants || 0} new grants in 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revocations</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{consentStats?.recentRevocations || 0}</div>
            <p className="text-xs text-muted-foreground">
              In the last 30 days
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="consent">Consent</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Request Types</CardTitle>
                <CardDescription>Distribution of GDPR request types</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Download className="h-4 w-4 mr-2 text-blue-500" />
                      <span>Export</span>
                    </div>
                    <Badge variant="secondary">{gdprStats?.byType?.export || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Trash2 className="h-4 w-4 mr-2 text-red-500" />
                      <span>Delete</span>
                    </div>
                    <Badge variant="secondary">{gdprStats?.byType?.delete || 0}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <UserX className="h-4 w-4 mr-2 text-purple-500" />
                      <span>Anonymize</span>
                    </div>
                    <Badge variant="secondary">{gdprStats?.byType?.anonymize || 0}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Consent by Type</CardTitle>
                <CardDescription>Current consent status breakdown</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {consentStats?.byType && Object.entries(consentStats.byType).map(([type, data]) => (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <Shield className="h-4 w-4 mr-2 text-teal-500" />
                        <span className="capitalize">{type}</span>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="default" className="bg-green-500">
                          {data.granted} granted
                        </Badge>
                        <Badge variant="destructive">
                          {data.revoked} revoked
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>GDPR Requests</CardTitle>
              <CardDescription>Track and manage data subject requests</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                {requests.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No GDPR requests found
                  </div>
                ) : (
                  <div className="space-y-4">
                    {requests.map((request) => (
                      <div
                        key={request.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {getTypeBadge(request.requestType)}
                            {getStatusBadge(request.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Guest: {request.guestId || 'N/A'} • {formatDate(request.createdAt)}
                          </p>
                          {request.requesterEmail && (
                            <p className="text-sm text-muted-foreground">
                              Requester: {request.requesterEmail}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <Badge variant="outline">{request.priority}</Badge>
                          {request.completedAt && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Completed: {formatDate(request.completedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Consent Tab */}
        <TabsContent value="consent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Consent Records</CardTitle>
              <CardDescription>View and manage consent records</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto">
                {consentRecords.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No consent records found
                  </div>
                ) : (
                  <div className="space-y-4">
                    {consentRecords.map((consent) => (
                      <div
                        key={consent.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={consent.granted && !consent.revoked ? 'default' : 'destructive'}>
                              {consent.granted && !consent.revoked ? 'Granted' : 'Revoked'}
                            </Badge>
                            <Badge variant="outline" className="capitalize">
                              {consent.consentType}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Guest: {consent.guestId || 'N/A'} • {formatDate(consent.createdAt)}
                          </p>
                          {consent.grantedVia && (
                            <p className="text-xs text-muted-foreground">
                              Via: {consent.grantedVia}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          {consent.revoked && (
                            <p className="text-xs text-red-500">
                              Revoked: {formatDate(consent.revokedAt)}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Actions Tab */}
        <TabsContent value="actions" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Export Data */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  Export Data
                </CardTitle>
                <CardDescription>
                  Export all guest data for GDPR compliance (data portability)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="export-guest-id">Guest ID</Label>
                  <Input
                    id="export-guest-id"
                    placeholder="Enter guest ID"
                    value={selectedGuestId}
                    onChange={(e) => setSelectedGuestId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select value={exportFormat} onValueChange={setExportFormat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={processing === 'export'}
                      className="w-full"
                    >
                      {processing === 'export' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Export Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Export Guest Data?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will export all personal data for guest &quot;{selectedGuestId}&quot; including
                        profile, bookings, payments, and preferences. The export will be downloaded
                        as a {exportFormat.toUpperCase()} file.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleExport}>
                        Confirm Export
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>

            {/* Anonymize Data */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserX className="h-5 w-5" />
                  Anonymize Data
                </CardTitle>
                <CardDescription>
                  Anonymize guest data while preserving analytics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="anonymize-guest-id">Guest ID</Label>
                  <Input
                    id="anonymize-guest-id"
                    placeholder="Enter guest ID"
                    value={selectedGuestId}
                    onChange={(e) => setSelectedGuestId(e.target.value)}
                  />
                </div>
                <div className="rounded-md bg-amber-50 dark:bg-amber-950 p-3">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    This action will anonymize personal data while keeping aggregated analytics intact.
                    Financial records will be preserved for compliance.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={processing === 'anonymize'}
                      className="w-full"
                    >
                      {processing === 'anonymize' ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <UserX className="h-4 w-4 mr-2" />
                      )}
                      Anonymize Data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Anonymize Guest Data?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently anonymize personal data for guest &quot;{selectedGuestId}&quot;.
                        Financial records will be preserved for compliance, but all PII (names,
                        emails, phone numbers, addresses, etc.) will be replaced with anonymous values.
                        Analytics aggregates will be retained.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleAnonymize}>
                        Confirm Anonymization
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>

            {/* Delete Data */}
            <Card className="md:col-span-2 border-red-200 dark:border-red-900">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-600">
                  <Trash2 className="h-5 w-5" />
                  Delete Data (Right to Erasure)
                </CardTitle>
                <CardDescription>
                  Permanently delete guest data in compliance with GDPR Article 17
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="delete-guest-id">Guest ID</Label>
                  <Input
                    id="delete-guest-id"
                    placeholder="Enter guest ID"
                    value={selectedGuestId}
                    onChange={(e) => setSelectedGuestId(e.target.value)}
                  />
                </div>

                <div className="rounded-md bg-red-50 dark:bg-red-950 p-4">
                  <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">
                    Warning: This action is irreversible
                  </h4>
                  <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                    <li>• Guest profile will be permanently deleted</li>
                    <li>• All related documents will be removed</li>
                    <li>• Reviews and feedback will be anonymized</li>
                    <li>• Financial records will be preserved for accounting compliance</li>
                    <li>• This action cannot be undone</li>
                  </ul>
                </div>

                <div className="flex gap-4">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="flex-1">
                        <Eye className="h-4 w-4 mr-2" />
                        Soft Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Soft Delete Guest Data?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will mark the guest record as deleted but preserve the data.
                          The guest will no longer appear in searches or reports.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(false)}>
                          Confirm Soft Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="flex-1">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Hard Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Permanently Delete Guest Data?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone. All guest data will be permanently
                          removed from the system except for financial records required for
                          accounting compliance.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(true)}
                          className="bg-red-600 hover:bg-red-700"
                        >
                          Confirm Permanent Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Consent Form */}
          <Card>
            <CardHeader>
              <CardTitle>Record Consent</CardTitle>
              <CardDescription>Manually record consent for a guest</CardDescription>
            </CardHeader>
            <CardContent>
              <ConsentForm
                tenantId={tenantId}
                onSuccess={() => {
                  fetchData();
                  setSuccess('Consent recorded successfully');
                }}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Error/Success Messages */}
      {error && (
        <div className="fixed bottom-4 right-4 bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 px-4 py-3 rounded-md shadow-lg">
          {error}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setError(null)}
            className="ml-2"
          >
            ×
          </Button>
        </div>
      )}

      {success && (
        <div className="fixed bottom-4 right-4 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-4 py-3 rounded-md shadow-lg">
          {success}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSuccess(null)}
            className="ml-2"
          >
            ×
          </Button>
        </div>
      )}
    </div>
    </SectionGuard>
  );
}

// Default export for the section loader system
export default GDPRManager;
