'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
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
  FileText,
  Upload,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  FileImage,
  File,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

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

interface KYCDocumentsProps {
  guestId: string;
}

const documentTypes = [
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
  { value: 'driver_license', label: 'Driver License' },
  { value: 'visa', label: 'Visa' },
  { value: 'residence_permit', label: 'Residence Permit' },
  { value: 'other', label: 'Other' },
];

const statusConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  pending: { icon: Clock, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  verified: { icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', bgColor: 'bg-emerald-100 dark:bg-emerald-900/30' },
  rejected: { icon: XCircle, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
};

export function KYCDocuments({ guestId }: KYCDocumentsProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Form state
  const [formData, setFormData] = useState({
    type: '',
    name: '',
    expiryDate: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    fetchDocuments();
  }, [guestId]);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/guests/${guestId}/documents`);
      const result = await response.json();
      
      if (result.success) {
        setDocuments(result.data);
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch documents',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!formData.type || !formData.name) {
      toast({
        title: 'Validation Error',
        description: 'Document type and name are required',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    setUploadProgress(0);

    // Simulate upload progress with cleanup ref
    let uploadInterval: NodeJS.Timeout | null = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          if (uploadInterval) clearInterval(uploadInterval);
          uploadInterval = null;
          return prev;
        }
        return prev + 10;
      });
    }, 200);

    try {
      // Mock the file upload - in real implementation, you'd upload to storage
      const mockFileUrl = `https://storage.example.com/documents/${Date.now()}_${selectedFile?.name || 'document.pdf'}`;
      
      const response = await fetch(`/api/guests/${guestId}/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.type,
          name: formData.name,
          fileUrl: mockFileUrl,
          expiryDate: formData.expiryDate || null,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setUploadProgress(100);
        toast({
          title: 'Success',
          description: 'Document uploaded successfully',
        });
        setIsUploadOpen(false);
        resetForm();
        fetchDocuments();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to upload document',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload document',
        variant: 'destructive',
      });
    } finally {
      clearInterval(interval);
      setIsSaving(false);
      setUploadProgress(0);
    }
  };

  const handleVerify = async (status: 'verified' | 'rejected', rejectionReason?: string) => {
    if (!selectedDocument) return;

    setIsSaving(true);
    try {
      const response = await fetch(`/api/guests/${guestId}/documents`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: selectedDocument.id,
          status,
          rejectionReason,
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
        fetchDocuments();
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

  const handleDelete = async () => {
    if (!selectedDocument) return;

    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/guests/${guestId}/documents?documentId=${selectedDocument.id}`,
        { method: 'DELETE' }
      );

      const result = await response.json();
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Document deleted successfully',
        });
        setIsDeleteOpen(false);
        setSelectedDocument(null);
        fetchDocuments();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to delete document',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete document',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({ type: '', name: '', expiryDate: '' });
    setSelectedFile(null);
    setUploadProgress(0);
  };

  const getDocumentIcon = (type: string) => {
    if (['passport', 'national_id', 'driver_license'].includes(type)) {
      return <FileImage className="h-8 w-8 text-muted-foreground" />;
    }
    return <File className="h-8 w-8 text-muted-foreground" />;
  };

  // Stats
  const stats = {
    total: documents.length,
    verified: documents.filter(d => d.status === 'verified').length,
    pending: documents.filter(d => d.status === 'pending').length,
    rejected: documents.filter(d => d.status === 'rejected').length,
  };

  if (isLoading) {
    return (
      <Card className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 grid-cols-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">Total Documents</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-emerald-500 dark:text-emerald-400">{stats.verified}</div>
          <div className="text-xs text-muted-foreground">Verified</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-amber-500 dark:text-amber-400">{stats.pending}</div>
          <div className="text-xs text-muted-foreground">Pending</div>
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold text-red-500 dark:text-red-400">{stats.rejected}</div>
          <div className="text-xs text-muted-foreground">Rejected</div>
        </Card>
      </div>

      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Documents</h3>
        <Button onClick={() => { resetForm(); setIsUploadOpen(true); }}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Document
        </Button>
      </div>

      {/* Documents List */}
      {documents.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No documents uploaded</p>
          <Button variant="outline" className="mt-4" onClick={() => setIsUploadOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Upload First Document
          </Button>
        </Card>
      ) : (
        <ScrollArea className="h-[400px]">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            {documents.map((doc) => {
              const config = statusConfig[doc.status] || statusConfig.pending;
              const StatusIcon = config.icon;
              
              return (
                <Card key={doc.id} className="overflow-hidden">
                  <div className="flex">
                    {/* Document Preview */}
                    <div className="w-24 h-24 bg-muted flex items-center justify-center">
                      {getDocumentIcon(doc.type)}
                    </div>
                    
                    {/* Document Info */}
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <Badge variant="outline" className="mb-1">
                            {documentTypes.find(t => t.value === doc.type)?.label || doc.type}
                          </Badge>
                          <h4 className="font-medium">{doc.name}</h4>
                        </div>
                        <Badge className={cn(config.bgColor, config.color)}>
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
                          <p className="text-red-600 dark:text-red-400 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {doc.rejectionReason}
                          </p>
                        )}
                      </div>
                      
                      {/* Actions */}
                      <div className="flex gap-2 mt-3">
                        {doc.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedDocument(doc);
                              setIsVerifyOpen(true);
                            }}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Verify
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(doc.fileUrl, '_blank')}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            setSelectedDocument(doc);
                            setIsDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {/* Upload Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a KYC document for verification
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="docType">Document Type *</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="docName">Document Name *</Label>
              <Input
                id="docName"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Passport - John Smith"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiryDate">Expiry Date (Optional)</Label>
              <Input
                id="expiryDate"
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file">Document File</Label>
              <Input
                id="file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  if (file && file.size > 10 * 1024 * 1024) {
                    toast({
                      title: 'File Too Large',
                      description: 'Please select a file under 10MB.',
                      variant: 'destructive',
                    });
                    e.target.value = '';
                    setSelectedFile(null);
                    return;
                  }
                  setSelectedFile(file);
                }}
              />
              <p className="text-xs text-muted-foreground">
                Accepted formats: PDF, JPG, PNG (Max 10MB)
              </p>
            </div>

            {isSaving && uploadProgress > 0 && (
              <div className="space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-sm text-muted-foreground text-center">
                  Uploading... {uploadProgress}%
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpload} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verify Dialog */}
      <Dialog open={isVerifyOpen} onOpenChange={setIsVerifyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Document</DialogTitle>
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
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => handleVerify('verified')}
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
                  onClick={() => handleVerify('rejected', 'Document verification failed')}
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

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedDocument?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
