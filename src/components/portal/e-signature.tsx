'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  FileSignature,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ZoomIn,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface TermsSection {
  title: string;
  content: string;
}

interface Terms {
  version: string;
  lastUpdated: string;
  property: {
    name: string;
    address: string;
    city: string;
  };
  sections: TermsSection[];
  signatureStatus: {
    hasSigned: boolean;
    signedAt?: string;
  };
}

interface ESignatureProps {
  token: string;
  hasSigned: boolean;
  signedAt?: string;
  onComplete: () => void;
}

export function ESignature({ token, hasSigned, signedAt, onComplete }: ESignatureProps) {
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [terms, setTerms] = useState<Terms | null>(null);
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [isLoadingTerms, setIsLoadingTerms] = useState(false);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    // Set initial style
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasSignature(true);

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in e) {
      e.preventDefault();
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const fetchTerms = async () => {
    setIsLoadingTerms(true);
    try {
      const response = await fetch(`/api/portal/e-sign?token=${token}`);
      const result = await response.json();
      
      if (result.success) {
        setTerms(result.data);
      }
    } catch (error) {
      console.error('Error fetching terms:', error);
    } finally {
      setIsLoadingTerms(false);
    }
  };

  const handleSign = async () => {
    if (!hasSignature) {
      toast({
        title: 'Signature Required',
        description: 'Please provide your signature',
        variant: 'destructive',
      });
      return;
    }

    if (!agreedToTerms) {
      toast({
        title: 'Agreement Required',
        description: 'Please agree to the terms and conditions',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const canvas = canvasRef.current;
      const signatureData = canvas?.toDataURL('image/png') || '';

      const response = await fetch('/api/portal/e-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          signature: signatureData,
          agreedToTerms: true,
          termsVersion: terms?.version || '1.0',
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Your signature has been recorded',
        });
        onComplete();
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to save signature',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving signature:', error);
      toast({
        title: 'Error',
        description: 'Failed to save signature',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600">
              <FileSignature className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">Terms & Signature</CardTitle>
              <CardDescription>Sign terms and conditions</CardDescription>
            </div>
          </div>
          {hasSigned ? (
            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Signed
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              <AlertCircle className="h-3 w-3 mr-1" />
              Required
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasSigned ? (
          <div className="text-center py-6">
            <div className="rounded-full bg-emerald-100 w-12 h-12 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="font-medium">Terms Accepted</p>
            {signedAt && (
              <p className="text-sm text-muted-foreground">
                Signed on {format(new Date(signedAt), 'MMM dd, yyyy \'at\' h:mm a')}
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Terms Summary */}
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              <p className="font-medium mb-1">{terms?.property?.name || 'Our Hotel'}</p>
              <p className="text-muted-foreground text-xs">
                By signing below, you agree to the property&apos;s terms and conditions, 
                cancellation policy, and house rules.
              </p>
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto mt-1 text-xs"
                onClick={() => { fetchTerms(); setShowTermsDialog(true); }}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                View Full Terms & Conditions
              </Button>
            </div>

            {/* Signature Pad */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Your Signature</Label>
                {hasSignature && (
                  <Button variant="ghost" size="sm" onClick={clearSignature}>
                    <RotateCcw className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
              <div className="border-2 border-dashed rounded-lg overflow-hidden bg-white">
                <canvas
                  ref={canvasRef}
                  className="w-full h-32 cursor-crosshair touch-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Draw your signature above using mouse or touch
              </p>
            </div>

            {/* Agreement Checkbox */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
              <Checkbox
                id="agree"
                checked={agreedToTerms}
                onCheckedChange={(checked) => setAgreedToTerms(checked as boolean)}
              />
              <Label htmlFor="agree" className="text-sm cursor-pointer">
                I have read and agree to the{' '}
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => { fetchTerms(); setShowTermsDialog(true); }}
                >
                  terms and conditions
                </button>
                , cancellation policy, and house rules.
              </Label>
            </div>

            <Button
              className="w-full"
              onClick={handleSign}
              disabled={isLoading || !hasSignature || !agreedToTerms}
            >
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <FileSignature className="h-4 w-4 mr-2" />
              Sign & Accept Terms
            </Button>
          </>
        )}

        {/* Terms Dialog */}
        <Dialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Terms and Conditions</DialogTitle>
              <DialogDescription>
                Version {terms?.version} • Last updated: {terms?.lastUpdated}
              </DialogDescription>
            </DialogHeader>
            {isLoadingTerms ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : terms ? (
              <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="font-medium">{terms.property.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {terms.property.address}, {terms.property.city}
                    </p>
                  </div>
                  {terms.sections.map((section, index) => (
                    <div key={index} className="prose prose-sm max-w-none">
                      <h4 className="font-semibold text-base">{section.title}</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {section.content}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <p className="text-muted-foreground text-center py-12">
                Unable to load terms
              </p>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
