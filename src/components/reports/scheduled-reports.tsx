'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Download,
  Plus,
  Calendar,
  Clock,
  FileText,
  Mail,
  Send,
  MoreHorizontal,
  Play,
  Pause,
  Trash2,
  Edit,
  Eye,
  CheckCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { useUIStore } from '@/store';
import { useTimezone } from '@/contexts/TimezoneContext';
import { exportToCSV } from '@/lib/export-utils';

interface ScheduledReport {
  id: string;
  name: string;
  type: 'revenue' | 'occupancy' | 'guest' | 'staff' | 'custom';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  time: string;
  recipients: string[];
  format: 'pdf' | 'excel' | 'csv';
  isActive: boolean;
  lastRun?: string;
  nextRun: string;
  deliveryMethod: 'email' | 'download' | 'both';
}

interface ReportHistory {
  id: string;
  reportId: string;
  reportName: string;
  generatedAt: string;
  status: 'success' | 'failed' | 'pending';
  size?: string;
  downloadUrl?: string;
}

const reportTypeLabels: Record<string, string> = {
  revenue: 'Revenue Report',
  occupancy: 'Occupancy Report',
  guest: 'Guest Analytics',
  staff: 'Staff Performance',
  custom: 'Custom Report',
};

const frequencyLabels: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

const statusColors: Record<string, string> = {
  success: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
};

export default function ScheduledReports() {
  const { formatDate, formatDateTime } = useTimezone();
  const [scheduledReports, setScheduledReports] = useState<ScheduledReport[]>([]);
  const [reportHistory, setReportHistory] = useState<ReportHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);
  const [newReport, setNewReport] = useState<Partial<ScheduledReport>>({
    name: '',
    type: 'revenue',
    frequency: 'daily',
    time: '09:00',
    format: 'pdf',
    deliveryMethod: 'email',
    recipients: [],
    isActive: true,
  });

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/reports/scheduled');
        const result = await response.json();
        if (result.success) {
          setScheduledReports(result.data);
          setReportHistory(result.history || []);
        } else {
          setError('Failed to load scheduled reports');
        }
      } catch (err) {
        console.error('Failed to fetch scheduled reports:', err);
        setError('Failed to load scheduled reports');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const toggleReportActive = async (id: string) => {
    try {
      const report = scheduledReports.find(r => r.id === id);
      if (!report) return;

      const response = await fetch('/api/reports/scheduled', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !report.isActive }),
      });

      if (response.ok) {
        setScheduledReports(prev =>
          prev.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r)
        );
        toast.success('Report status updated');
      } else {
        toast.error('Failed to update report status');
      }
    } catch (err) {
      console.error('Failed to toggle report:', err);
      toast.error('Failed to update report status');
    }
  };

  const deleteReport = async (id: string) => {
    try {
      const response = await fetch(`/api/reports/scheduled?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setScheduledReports(prev => prev.filter(r => r.id !== id));
        toast.success('Report deleted');
      } else {
        toast.error('Failed to delete report');
      }
    } catch (err) {
      console.error('Failed to delete report:', err);
      toast.error('Failed to delete report');
    }
  };

  const runReportNow = async (report: ScheduledReport) => {
    try {
      toast.success(`Running "${report.name}" now...`);
      const response = await fetch('/api/reports/scheduled', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: report.id, action: 'run-now' }),
      });

      const result = await response.json();
      if (result.success) {
        // Refresh history to show the new run
        const historyRes = await fetch('/api/reports/scheduled');
        const historyResult = await historyRes.json();
        if (historyResult.success && historyResult.history) {
          setReportHistory(historyResult.history);
        }
        toast.success(`Report "${report.name}" generated successfully`);
      } else {
        toast.error(result.error?.message || 'Failed to generate report');
      }
    } catch (err) {
      console.error('Failed to run report:', err);
      toast.error('Failed to generate report');
    }
  };

  const createReport = async () => {
    if (!newReport.name?.trim()) {
      toast.error('Report name is required');
      return;
    }

    if (!newReport.recipients || newReport.recipients.length === 0 || newReport.recipients.every(r => !r.trim())) {
      toast.error('At least one recipient email is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = (newReport.recipients || []).filter(r => r.trim() && !emailRegex.test(r.trim()));
    if (invalidEmails.length > 0) {
      toast.error(`Invalid email(s): ${invalidEmails.join(', ')}`);
      return;
    }

    try {
      if (editingReportId) {
        // Update existing report
        const response = await fetch('/api/reports/scheduled', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingReportId, ...newReport }),
        });

        const result = await response.json();
        if (result.success) {
          setScheduledReports(prev => prev.map(r => r.id === editingReportId ? result.data : r));
          setIsCreateOpen(false);
          setEditingReportId(null);
          setNewReport({
            name: '',
            type: 'revenue',
            frequency: 'daily',
            time: '09:00',
            format: 'pdf',
            deliveryMethod: 'email',
            recipients: [],
            isActive: true,
          });
          toast.success('Scheduled report updated');
        } else {
          toast.error(result.error?.message || 'Failed to update report');
        }
      } else {
        // Create new report
        const response = await fetch('/api/reports/scheduled', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newReport),
        });

        const result = await response.json();
        if (result.success) {
          setScheduledReports(prev => [...prev, result.data]);
          setIsCreateOpen(false);
          setNewReport({
            name: '',
            type: 'revenue',
            frequency: 'daily',
            time: '09:00',
            format: 'pdf',
            deliveryMethod: 'email',
            recipients: [],
            isActive: true,
          });
          toast.success('Scheduled report created');
        } else {
          toast.error(result.error?.message || 'Failed to create report');
        }
      }
    } catch (err) {
      console.error('Failed to create report:', err);
      toast.error('Failed to create report');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" className="mt-4" onClick={() => window.location.reload()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Scheduled Reports</h2>
          <p className="text-muted-foreground">Automate report generation and delivery</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) {
            setEditingReportId(null);
            setNewReport({
              name: '',
              type: 'revenue',
              frequency: 'daily',
              time: '09:00',
              format: 'pdf',
              deliveryMethod: 'email',
              recipients: [],
              isActive: true,
            });
          }
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700" onClick={() => {
              setEditingReportId(null);
              setNewReport({
                name: '',
                type: 'revenue',
                frequency: 'daily',
                time: '09:00',
                format: 'pdf',
                deliveryMethod: 'email',
                recipients: [],
                isActive: true,
              });
            }}>
              <Plus className="h-4 w-4" />
              Schedule Report
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingReportId ? 'Edit Scheduled Report' : 'Create Scheduled Report'}</DialogTitle>
              <DialogDescription>
                {editingReportId ? 'Update the scheduled report settings' : 'Set up an automated report to run on a schedule'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Report Name</label>
                <Input
                  placeholder="Enter report name"
                  value={newReport.name}
                  onChange={(e) => setNewReport(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Report Type</label>
                  <Select
                    value={newReport.type}
                    onValueChange={(value) => setNewReport(prev => ({ ...prev, type: value as ScheduledReport['type'] }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="revenue">Revenue Report</SelectItem>
                      <SelectItem value="occupancy">Occupancy Report</SelectItem>
                      <SelectItem value="guest">Guest Analytics</SelectItem>
                      <SelectItem value="staff">Staff Performance</SelectItem>
                      <SelectItem value="custom">Custom Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Frequency</label>
                  <Select
                    value={newReport.frequency}
                    onValueChange={(value) => setNewReport(prev => ({ ...prev, frequency: value as ScheduledReport['frequency'] }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Time</label>
                  <Input
                    type="time"
                    value={newReport.time}
                    onChange={(e) => setNewReport(prev => ({ ...prev, time: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Format</label>
                  <Select
                    value={newReport.format}
                    onValueChange={(value) => setNewReport(prev => ({ ...prev, format: value as ScheduledReport['format'] }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="excel">Excel</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Recipients (comma-separated emails)</label>
                <Input
                  placeholder="email1@hotel.com, email2@hotel.com"
                  onChange={(e) => setNewReport(prev => ({ ...prev, recipients: e.target.value.split(',').map(e => e.trim()) }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button onClick={createReport} className="bg-emerald-600 hover:bg-emerald-700">
                {editingReportId ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="scheduled">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="scheduled">Scheduled</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="scheduled" className="space-y-4 mt-4">
          {scheduledReports.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">No scheduled reports</h3>
                <p className="text-muted-foreground text-sm">
                  Create your first scheduled report to automate report delivery
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {scheduledReports.map((report) => (
                <Card key={report.id} className={`border-0 shadow-sm ${!report.isActive ? 'opacity-60' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900">
                          <FileText className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <h3 className="font-medium">{report.name}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Badge variant="outline" className="text-xs">
                              {reportTypeLabels[report.type]}
                            </Badge>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {frequencyLabels[report.frequency]} at {report.time}
                            </span>
                            <span>•</span>
                            <span className="uppercase">{report.format}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-sm font-medium">Next run</p>
                          <p className="text-xs text-muted-foreground">
                            {report.nextRun ? formatDate(new Date(report.nextRun)) : 'Not scheduled'} {report.time}
                          </p>
                        </div>

                        <Switch
                          checked={report.isActive}
                          onCheckedChange={() => toggleReportActive(report.id)}
                        />

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => runReportNow(report)}>
                              <Play className="h-4 w-4 mr-2" />
                              Run Now
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setNewReport({
                                id: report.id,
                                name: report.name,
                                type: report.type,
                                frequency: report.frequency,
                                time: report.time,
                                format: report.format,
                                deliveryMethod: report.deliveryMethod,
                                recipients: report.recipients || [],
                                isActive: report.isActive,
                              });
                              setEditingReportId(report.id);
                              setIsCreateOpen(true);
                            }}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 dark:text-red-400"
                              onClick={() => deleteReport(report.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Recipients */}
                    {report.recipients && report.recipients.length > 0 && (
                      <div className="mt-4 pt-4 border-t">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Recipients:</span>
                          <div className="flex gap-1">
                            {report.recipients.map((email, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {email}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {reportHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Report</TableHead>
                      <TableHead>Generated At</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reportHistory.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{item.reportName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {formatDateTime(new Date(item.generatedAt))}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[item.status]}>
                            {item.status === 'success' && <CheckCircle className="h-3 w-3 mr-1" />}
                            {item.status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
                            {item.status === 'pending' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.size || '-'}</TableCell>
                        <TableCell className="text-right">
                          {item.downloadUrl && (
                            <Button variant="ghost" size="sm" className="gap-2" onClick={() => {
                              exportToCSV(
                                [{ reportName: item.reportName, generatedAt: item.generatedAt, status: item.status, size: item.size || 'N/A' }],
                                `report-${item.reportId}-${new Date(item.generatedAt).toISOString().slice(0, 10)}`,
                                [
                                  { key: 'reportName', label: 'Report' },
                                  { key: 'generatedAt', label: 'Generated At' },
                                  { key: 'status', label: 'Status' },
                                  { key: 'size', label: 'Size' },
                                ]
                              );
                            }}>
                              <Download className="h-4 w-4" />
                              Download
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="py-12 text-center text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No report history yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
