'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  Search,
  Loader2,
  Upload,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  FileImage,
  File,
  AlertCircle,
  Shield,
  User,
  Filter,
  RefreshCw,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

interface Document {
  id: string;
  type: string;
  name: string;
  fileUrl: string;
  status: string;
  verifiedAt?: Date | null;
  verifiedBy?: string;
  rejectionReason?: string;
  expiryDate?: Date | null;
  createdAt: string;
}

interface Guest {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  kycStatus: 'pending' | 'verified' | 'rejected' | 'incomplete';
  documents: Document[];
  avatarUrl?: string;
}

const documentTypes = [
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
  { value: 'driver_license', label: 'Driver License' },
  { value: 'visa', label: 'Visa' },
  { value: 'residence_permit', label: 'Residence Permit' },
  { value: 'other', label: 'Other' },
];

const kycStatusConfig = {
  verified: { label: 'Verified', color: 'bg-gradient-to-r from-emerald-500 to-green-500', textColor: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  pending: { label: 'Pending', color: 'bg-gradient-to-r from-amber-400 to-yellow-500', textColor: 'text-amber-600', bgColor: 'bg-amber-100' },
  rejected: { label: 'Rejected', color: 'bg-gradient-to-r from-red-400 to-rose-500', textColor: 'text-red-600', bgColor: 'bg-red-100' },
  incomplete: { label: 'Incomplete', color: 'bg-gradient-to-r from-gray-400 to-gray-500', textColor: 'text-gray-600', bgColor: 'bg-gray-100' },
};

const documentStatusConfig = {
  verified: { icon: CheckCircle, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  pending: { icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-100' },
  rejected: { icon: XCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
};

export default function KYCManagement() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    verified: 0,
    pending: 0,
    rejected: 0,
    incomplete: 0,
  });

  useEffect(() => {
    fetchGuests();
  }, []);

  const fetchGuests = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/guests?includeDocuments=true');
      const result = await response.json();

      if (result.success) {
        // Transform guests with KYC status calculation
        const guestsData = result.data.map((guest: any) => {
          const documents = guest.documents || [];
          let kycStatus: 'pending' | 'verified' | 'rejected' | 'incomplete' = 'incomplete';

          if (documents.length > 0) {
            const allVerified = documents.every((d: Document) => d.status === 'verified');
            const anyRejected = documents.some((d: Document) => d.status === 'rejected');
            const anyPending = documents.some((d: Document) => d.status === 'pending');

            if (allVerified) {
              kycStatus = 'verified';
            } else if (anyRejected && !anyPending) {
              kycStatus = 'rejected';
            } else if (anyPending) {
              kycStatus = 'pending';
            }
          }

          return {
            ...guest,
            documents,
            kycStatus,
          };
        });

        setGuests(guestsData);

        // Calculate stats
        const newStats = {
          total: guestsData.length,
          verified: guestsData.filter((g: Guest) => g.kycStatus === 'verified').length,
          pending: guestsData.filter((g: Guest) => g.kycStatus === 'pending').length,
          rejected: guestsData.filter((g: Guest) => g.kycStatus === 'rejected').length,
          incomplete: guestsData.filter((g: Guest) => g.kycStatus === 'incomplete').length,
        };
        setStats(newStats);
      }
    } catch (error) {
      console.error('Error fetching guests:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch guests',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyDocument = async (status: 'verified' | 'rejected') => {
    if (!selectedGuest || !selectedDocument) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/guests/${selectedGuest.id}/documents`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocument.id,
          status,
          rejectionReason: status === 'rejected' ? rejectionReason : undefined,
          verifiedBy: user?.id || '',
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: `Document ${status === 'verified' ? 'verified' : 'rejected'} successfully`,
        });
        setIsVerifyOpen(false);
        setSelectedDocument(null);
        setRejectionReason('');
        fetchGuests();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to update document',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error updating document:', error);
      toast({
        title: 'Error',
        description: 'Failed to update document',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const getDocumentIcon = (type: string) => {
    if (['passport', 'national_id', 'driver_license'].includes(type)) {
      return <FileImage className="h-5 w-5 text-muted-foreground" />;
    }
    return <File className="h-5 w-5 text-muted-foreground" />;
  };

  const filteredGuests = guests.filter(guest => {
    const matchesSearch =
      guest.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guest.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guest.email?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || guest.kycStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getCompletionPercentage = (guest: Guest) => {
    if (guest.documents.length === 0) return 0;
    const verified = guest.documents.filter(d => d.status === 'verified').length;
    return Math.round((verified / guest.documents.length) * 100);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5" />
            KYC & Documents Management
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage guest identity verification and documents
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchGuests}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-5">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-violet-500/10">
              <User className="h-4 w-4 text-violet-500" />
            </div>
            <div>
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Total Guests</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <CheckCircle className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-600">{stats.verified}</div>
              <div className="text-xs text-muted-foreground">Verified</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500/10">
              <Clock className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-600">{stats.pending}</div>
              <div className="text-xs text-muted-foreground">Pending</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-red-500/10">
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{stats.rejected}</div>
              <div className="text-xs text-muted-foreground">Rejected</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-gray-500/10">
              <AlertCircle className="h-4 w-4 text-gray-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-600">{stats.incomplete}</div>
              <div className="text-xs text-muted-foreground">Incomplete</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="KYC Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="incomplete">Incomplete</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Guests Table */}
      <Card>
        <CardContent className="p-0">
          {filteredGuests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Shield className="h-12 w-12 mb-4" />
              <p>No guests found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead>Documents</TableHead>
                    <TableHead>Completion</TableHead>
                    <TableHead>KYC Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGuests.map((guest) => {
                    const statusInfo = kycStatusConfig[guest.kycStatus];
                    const completion = getCompletionPercentage(guest);

                    return (
                      <TableRow key={guest.id} className="transition-colors hover:bg-muted/60 cursor-pointer group">
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10 ring-2 ring-offset-1 ring-offset-background transition-all group-hover:ring-primary/30">
                              <AvatarImage src={guest.avatarUrl} />
                              <AvatarFallback className={cn(
                                'text-sm font-medium',
                                guest.kycStatus === 'verified' && 'bg-emerald-100 text-emerald-700',
                                guest.kycStatus === 'pending' && 'bg-amber-100 text-amber-700',
                                guest.kycStatus === 'rejected' && 'bg-red-100 text-red-700',
                                guest.kycStatus === 'incomplete' && 'bg-gray-100 text-gray-700'
                              )}>
                                {guest.firstName[0]}{guest.lastName[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{guest.firstName} {guest.lastName}</p>
                              <p className="text-xs text-muted-foreground">{guest.email || guest.phone}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <FileText className="h-4 w-4 text-muted-foreground mr-1" />
                            <span>{guest.documents.length} documents</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Progress value={completion} className={cn('h-2 flex-1',
                              completion === 100 && '[&>div]:bg-gradient-to-r [&>div]:from-emerald-500 [&>div]:to-green-500',
                              completion > 0 && completion < 100 && '[&>div]:bg-gradient-to-r [&>div]:from-amber-400 [&>div]:to-yellow-500',
                              completion === 0 && '[&>div]:bg-gray-300'
                            )} />
                            <span className={cn('text-sm font-medium w-10',
                              completion === 100 && 'text-emerald-600',
                              completion > 0 && completion < 100 && 'text-amber-600'
                            )}>{completion}%</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn('text-white', statusInfo.color)}>
                            {statusInfo.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedGuest(guest)}
                          >
                            View Documents
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
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

      {/* Guest Documents Dialog */}
      <Dialog open={!!selectedGuest} onOpenChange={() => setSelectedGuest(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Documents - {selectedGuest?.firstName} {selectedGuest?.lastName}
            </DialogTitle>
            <DialogDescription>
              Review and verify guest identity documents
            </DialogDescription>
          </DialogHeader>

          {selectedGuest && (
            <div className="space-y-4 py-4">
              {/* Guest Summary */}
              <Card className="p-4 bg-muted/50">
                <div className="flex items-center gap-4">
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={selectedGuest.avatarUrl} />
                    <AvatarFallback>
                      {selectedGuest.firstName[0]}{selectedGuest.lastName[0]}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-semibold text-lg">{selectedGuest.firstName} {selectedGuest.lastName}</p>
                    <p className="text-sm text-muted-foreground">{selectedGuest.email || selectedGuest.phone}</p>
                  </div>
                  <Badge className={cn(
                    'text-white',
                    kycStatusConfig[selectedGuest.kycStatus].color
                  )}>
                    {kycStatusConfig[selectedGuest.kycStatus].label}
                  </Badge>
                </div>
              </Card>

              {/* Documents List */}
              {selectedGuest.documents.length === 0 ? (
                <Card className="flex flex-col items-center justify-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No documents uploaded</p>
                </Card>
              ) : (
                <div className="grid gap-4">
                  {selectedGuest.documents.map((doc) => {
                    const docStatus = documentStatusConfig[doc.status as keyof typeof documentStatusConfig] || documentStatusConfig.pending;
                    const StatusIcon = docStatus.icon;

                    return (
                      <Card key={doc.id} className="overflow-hidden">
                        <div className="flex">
                          {/* Document Preview */}
                          <div className="w-28 h-28 bg-muted flex items-center justify-center border-r">
                            {getDocumentIcon(doc.type)}
                          </div>

                          {/* Document Info */}
                          <div className="flex-1 p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <Badge variant="outline" className="mb-2">
                                  {documentTypes.find(t => t.value === doc.type)?.label || doc.type}
                                </Badge>
                                <h4 className="font-medium">{doc.name}</h4>
                              </div>
                              <Badge className={cn(docStatus.bgColor, docStatus.color)}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {doc.status}
                              </Badge>
                            </div>

                            <div className="mt-2 text-sm text-muted-foreground space-y-1">
                              <p>Uploaded: {format(new Date(doc.createdAt), 'MMM dd, yyyy')}</p>
                              {doc.expiryDate && (
                                <p>Expires: {format(new Date(doc.expiryDate), 'MMM dd, yyyy')}</p>
                              )}
                              {doc.verifiedAt && (
                                <p>Verified: {format(new Date(doc.verifiedAt), 'MMM dd, yyyy')}</p>
                              )}
                              {doc.rejectionReason && (
                                <p className="text-red-600 flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  {doc.rejectionReason}
                                </p>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 mt-3">
                              {doc.status === 'pending' && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setSelectedDocument(doc);
                                      setIsVerifyOpen(true);
                                    }}
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Verify
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedDocument(doc);
                                      setRejectionReason('');
                                      setIsVerifyOpen(true);
                                    }}
                                  >
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Reject
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => window.open(doc.fileUrl, '_blank')}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Verify/Reject Dialog */}
      <Dialog open={isVerifyOpen} onOpenChange={setIsVerifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Document Verification</DialogTitle>
            <DialogDescription>
              Review and verify or reject this document
            </DialogDescription>
          </DialogHeader>

          {selectedDocument && (
            <div className="py-4 space-y-4">
              <Card className="p-4 bg-muted/50">
                <div className="flex items-center gap-3">
                  {getDocumentIcon(selectedDocument.type)}
                  <div>
                    <p className="font-medium">{selectedDocument.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {documentTypes.find(t => t.value === selectedDocument.type)?.label}
                    </p>
                  </div>
                </div>
              </Card>

              <div className="space-y-2">
                <Label htmlFor="rejectionReason">Rejection Reason (if rejecting)</Label>
                <Textarea
                  id="rejectionReason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Enter reason for rejection..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => handleVerifyDocument('verified')}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Verify
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => handleVerifyDocument('rejected')}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
