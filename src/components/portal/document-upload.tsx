'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
  FileText,
  Upload,
  FileImage,
  File,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Trash2,
  Eye,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Document {
  id: string;
  type: string;
  name: string;
  status: string;
  expiryDate?: string;
  createdAt: string;
}

interface DocumentUploadProps {
  token: string;
  documents: Document[];
  kycComplete: boolean;
  onUpdate: () => void;
}

const documentTypes = [
  { value: 'passport', label: 'Passport', description: 'Valid passport with photo page' },
  { value: 'national_id', label: 'National ID', description: 'Government-issued ID card' },
  { value: 'driver_license', label: 'Driver License', description: 'Valid driving license' },
  { value: 'visa', label: 'Visa', description: 'Valid visa document' },
  { value: 'residence_permit', label: 'Residence Permit', description: 'Residence permit card' },
];

const statusConfig: Record<string, { icon: React.ElementType; color: string; bgColor: string }> = {
  pending: { icon: Clock, color: 'text-amber-600', bgColor: 'bg-amber-100' },
  verified: { icon: CheckCircle2, color: 'text-emerald-600', bgColor: 'bg-emerald-100' },
  rejected: { icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-100' },
};

export function DocumentUpload({ token, documents, kycComplete, onUpdate }: DocumentUploadProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    type: '',
    name: '',
    expiryDate: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const stats = {
    total: documents.length,
    verified: documents.filter(d => d.status === 'verified').length,
    pending: documents.filter(d => d.status === 'pending').length,
    rejected: documents.filter(d => d.status === 'rejected').length,
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Maximum file size is 10MB',
          variant: 'destructive',
        });
        return;
      }
      setSelectedFile(file);
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setPreviewUrl(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setPreviewUrl(null);
      }
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

    setIsUploading(true);
    setUploadProgress(0);

    // Simulate upload progress
    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 90) {
          clearInterval(progressInterval);
          return prev;
        }
        return prev + 10;
      });
    }, 200);

    try {
      // Convert file to base64 or use placeholder URL
      let fileUrl = '';
      if (selectedFile) {
        // In a real implementation, you'd upload to cloud storage
        // For now, we'll create a mock URL
        fileUrl = `https://storage.example.com/kyc/${Date.now()}_${selectedFile.name}`;
      } else {
        toast({
          title: 'Error',
          description: 'Please select a file to upload',
          variant: 'destructive',
        });
        clearInterval(progressInterval);
        setIsUploading(false);
        return;
      }

      const response = await fetch('/api/portal/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          type: formData.type,
          name: formData.name,
          fileUrl,
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
        setIsDialogOpen(false);
        resetForm();
        onUpdate();
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
      clearInterval(progressInterval);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const resetForm = () => {
    setFormData({ type: '', name: '', expiryDate: '' });
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getDocumentIcon = (type: string) => {
    if (['passport', 'national_id', 'driver_license'].includes(type)) {
      return <FileImage className="h-8 w-8 text-muted-foreground" />;
    }
    return <File className="h-8 w-8 text-muted-foreground" />;
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">KYC Documents</CardTitle>
              <CardDescription>Upload identification documents</CardDescription>
            </div>
          </div>
          {kycComplete ? (
            <Badge className="bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Verified
            </Badge>
          ) : stats.verified > 0 ? (
            <Badge variant="secondary" className="bg-cyan-100 text-cyan-700">
              In Progress
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700">
              <AlertCircle className="h-3 w-3 mr-1" />
              Required
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-lg font-bold">{stats.total}</div>
            <div className="text-[10px] text-muted-foreground">Total</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-lg font-bold text-emerald-600">{stats.verified}</div>
            <div className="text-[10px] text-muted-foreground">Verified</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-lg font-bold text-amber-600">{stats.pending}</div>
            <div className="text-[10px] text-muted-foreground">Pending</div>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="text-lg font-bold text-red-600">{stats.rejected}</div>
            <div className="text-[10px] text-muted-foreground">Rejected</div>
          </div>
        </div>

        {/* Documents List */}
        {documents.length === 0 ? (
          <div className="text-center py-8">
            <div className="rounded-full bg-muted w-12 h-12 flex items-center justify-center mx-auto mb-3">
              <Upload className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground mb-3">No documents uploaded yet</p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload First Document
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {documents.map((doc) => {
                const config = statusConfig[doc.status] || statusConfig.pending;
                const StatusIcon = config.icon;
                
                return (
                  <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <div className="w-10 h-10 rounded-lg bg-background flex items-center justify-center">
                      {getDocumentIcon(doc.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <Badge variant="outline" className="text-[10px] h-4 px-1">
                          {documentTypes.find(t => t.value === doc.type)?.label || doc.type}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Uploaded {format(new Date(doc.createdAt), 'MMM dd, yyyy')}
                        {doc.expiryDate && ` • Expires ${format(new Date(doc.expiryDate), 'MMM dd, yyyy')}`}
                      </p>
                    </div>
                    <Badge className={cn(config.bgColor, config.color, 'text-xs')}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {doc.status}
                    </Badge>
                  </div>
                );
              })}
            </div>
            
            <Button variant="outline" className="w-full" onClick={() => setIsDialogOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Another Document
            </Button>
          </>
        )}

        {/* Upload Dialog */}
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>
                Upload a valid identification document for verification
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
                        <div>
                          <span>{type.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.type && (
                  <p className="text-xs text-muted-foreground">
                    {documentTypes.find(t => t.value === formData.type)?.description}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="docName">Document Name *</Label>
                <Input
                  id="docName"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Passport - John Doe"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiryDate">Expiry Date (if applicable)</Label>
                <Input
                  id="expiryDate"
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, expiryDate: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Document File *</Label>
                <Input
                  ref={fileInputRef}
                  id="file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={handleFileChange}
                />
                <p className="text-xs text-muted-foreground">
                  Accepted formats: PDF, JPG, PNG (Max 10MB)
                </p>
              </div>

              {/* Preview */}
              {previewUrl && (
                <div className="relative rounded-lg overflow-hidden border">
                  <img src={previewUrl} alt="Preview" className="w-full h-40 object-cover" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-2 right-2 h-6 w-6 p-0 bg-black/50 hover:bg-black/70 text-white"
                    onClick={() => { setPreviewUrl(null); setSelectedFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {isUploading && uploadProgress > 0 && (
                <div className="space-y-2">
                  <Progress value={uploadProgress} className="h-2" />
                  <p className="text-sm text-muted-foreground text-center">
                    Uploading... {uploadProgress}%
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }}>
                Cancel
              </Button>
              <Button onClick={handleUpload} disabled={isUploading}>
                {isUploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Upload
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
