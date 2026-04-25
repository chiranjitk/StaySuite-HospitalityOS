'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Shield } from 'lucide-react';

interface ConsentFormProps {
  tenantId: string;
  guestId?: string;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

interface ConsentOption {
  type: string;
  label: string;
  description: string;
  required?: boolean;
}

const consentOptions: ConsentOption[] = [
  {
    type: 'essential',
    label: 'Essential Cookies',
    description: 'Required for the website to function. Cannot be disabled.',
    required: true,
  },
  {
    type: 'marketing',
    label: 'Marketing Communications',
    description: 'Receive promotional emails, offers, and newsletters.',
  },
  {
    type: 'analytics',
    label: 'Analytics & Performance',
    description: 'Help us improve by allowing usage analytics.',
  },
  {
    type: 'third_party',
    label: 'Third-Party Sharing',
    description: 'Share data with trusted partners for enhanced services.',
  },
  {
    type: 'profiling',
    label: 'Personalization & Profiling',
    description: 'Allow us to personalize your experience based on preferences.',
  },
];

const consentVersion = '1.0.0';
const consentText = 'By providing consent, you agree to our Privacy Policy and Terms of Service.';

export function ConsentForm({ tenantId, guestId: initialGuestId, onSuccess, onError }: ConsentFormProps) {
  const [guestId, setGuestId] = useState(initialGuestId || '');
  const [consents, setConsents] = useState<Record<string, boolean>>({
    essential: true, // Always required
    marketing: false,
    analytics: false,
    third_party: false,
    profiling: false,
  });
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Handle consent toggle
  const toggleConsent = (type: string, value: boolean) => {
    if (type === 'essential') return; // Cannot toggle essential
    setConsents((prev) => ({ ...prev, [type]: value }));
  };

  // Submit consent
  const handleSubmit = async () => {
    if (!guestId) {
      onError?.('Please enter a Guest ID');
      return;
    }

    setLoading(true);

    try {
      // Submit each consent type
      const promises = Object.entries(consents).map(([type, granted]) =>
        fetch('/api/gdpr/consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            guestId,
            consentType: type,
            consentCategory: type === 'marketing' ? 'marketing' : 
                            type === 'analytics' ? 'analytics' : 
                            type === 'essential' ? 'essential' : 'preferences',
            granted,
            grantedVia: 'portal',
            consentText,
            consentVersion,
          }),
        })
      );

      const results = await Promise.all(promises);
      const failed = results.find((r) => !r.ok);

      if (failed) {
        const data = await failed.json();
        onError?.(data.error?.message || 'Failed to record consent');
      } else {
        onSuccess?.();
      }
    } catch (err) {
      onError?.('Failed to record consent');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Accept all consents
  const acceptAll = () => {
    setConsents({
      essential: true,
      marketing: true,
      analytics: true,
      third_party: true,
      profiling: true,
    });
  };

  // Reject optional consents
  const rejectOptional = () => {
    setConsents({
      essential: true,
      marketing: false,
      analytics: false,
      third_party: false,
      profiling: false,
    });
  };

  return (
    <div className="space-y-6">
      {/* Guest ID Input (if not provided) */}
      {!initialGuestId && (
        <div className="space-y-2">
          <Label htmlFor="guest-id">Guest ID</Label>
          <Input
            id="guest-id"
            placeholder="Enter guest ID"
            value={guestId}
            onChange={(e) => setGuestId(e.target.value)}
          />
        </div>
      )}

      {/* Consent Options */}
      <div className="space-y-4">
        {consentOptions.map((option) => (
          <div
            key={option.type}
            className={`flex items-start space-x-3 p-3 rounded-lg border ${
              option.required ? 'bg-muted/50' : ''
            }`}
          >
            <Checkbox
              id={option.type}
              checked={consents[option.type]}
              disabled={option.required}
              onCheckedChange={(checked) => toggleConsent(option.type, checked as boolean)}
            />
            <div className="flex-1">
              <Label
                htmlFor={option.type}
                className={`font-medium ${option.required ? 'cursor-default' : 'cursor-pointer'}`}
              >
                {option.label}
                {option.required && (
                  <span className="ml-2 text-xs text-muted-foreground">(Required)</span>
                )}
              </Label>
              <p className="text-sm text-muted-foreground">{option.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Privacy Notice */}
      <Card className="bg-muted/50">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-teal-600 dark:text-teal-400 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">Privacy Notice</p>
              <p className="text-sm text-muted-foreground">{consentText}</p>
              <p className="text-xs text-muted-foreground">Version: {consentVersion}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={acceptAll}
          disabled={loading}
        >
          Accept All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={rejectOptional}
          disabled={loading}
        >
          Reject Optional
        </Button>
      </div>

      {/* Submit Button */}
      <Button
        onClick={handleSubmit}
        disabled={loading || !guestId}
        className="w-full"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Shield className="h-4 w-4 mr-2" />
        )}
        Save Consent Preferences
      </Button>
    </div>
  );
}

// Compact inline consent banner for guest portal
export function ConsentBanner({
  tenantId,
  guestId,
  onConsent,
}: {
  tenantId: string;
  guestId: string;
  onConsent?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const handleQuickConsent = async (acceptAll: boolean) => {
    setLoading(true);

    try {
      const consents = acceptAll
        ? {
            essential: true,
            marketing: true,
            analytics: true,
            third_party: true,
            profiling: true,
          }
        : {
            essential: true,
            marketing: false,
            analytics: false,
            third_party: false,
            profiling: false,
          };

      const promises = Object.entries(consents).map(([type, granted]) =>
        fetch('/api/gdpr/consent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tenantId,
            guestId,
            consentType: type,
            granted,
            grantedVia: 'banner',
          }),
        })
      );

      await Promise.all(promises);
      onConsent?.();
    } catch (err) {
      console.error('Failed to record consent:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg p-4 z-50">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm">
              We use cookies and similar technologies to enhance your experience.
              By continuing, you agree to our{' '}
              <a href="#" className="underline hover:text-teal-600 dark:text-teal-400">
                Privacy Policy
              </a>{' '}
              and cookie usage.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
            >
              Manage
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickConsent(false)}
              disabled={loading}
            >
              Decline Optional
            </Button>
            <Button
              size="sm"
              onClick={() => handleQuickConsent(true)}
              disabled={loading}
            >
              Accept All
            </Button>
          </div>
        </div>

        {showDetails && (
          <div className="mt-4 pt-4 border-t">
            <ConsentForm
              tenantId={tenantId}
              guestId={guestId}
              onSuccess={() => {
                setShowDetails(false);
                onConsent?.();
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
