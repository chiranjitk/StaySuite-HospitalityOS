'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle, Loader2, Mail, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

type VerificationStatus = 'loading' | 'success' | 'error' | 'already_verified';

interface VerifyStarterProps {
  token: string;
  onResult: (status: VerificationStatus, errorMessage?: string) => void;
}

function VerifyStarter({ token, onResult }: VerifyStarterProps) {
  // Immediately invoke the API call on mount (before paint)
  // This is intentional: we want to start verification as soon as the component mounts
  fetch('/api/auth/verify-email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.success) {
        onResult(data.alreadyVerified ? 'already_verified' : 'success');
      } else {
        const err = data.error;
        onResult('error', typeof err === 'object' ? err.message : err || 'Verification failed. Please try again.');
      }
    })
    .catch(() => {
      onResult('error', 'Network error. Please check your connection and try again.');
    });

  return null;
}

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const noTokenMessage = 'No verification token provided. Please check your email for the correct link.';
  const [status, setStatus] = useState<VerificationStatus>(token ? 'loading' : 'error');
  const [errorMessage, setErrorMessage] = useState(token ? '' : noTokenMessage);
  const [resendEmail, setResendEmail] = useState('');
  const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [started, setStarted] = useState(false);

  function handleVerifyResult(newStatus: VerificationStatus, msg?: string) {
    setStatus(newStatus);
    if (msg) setErrorMessage(msg);
  }

  // Start verification once on mount when token exists
  if (token && !started && status === 'loading') {
    // This pattern intentionally mutates on render to trigger exactly once
    setStarted(true);
  }

  async function handleResend() {
    if (!resendEmail.trim()) return;

    setResendStatus('loading');
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resendEmail.trim().toLowerCase() }),
      });

      const data = await res.json();
      setResendStatus(data.success ? 'success' : 'error');
    } catch {
      setResendStatus('error');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            StaySuite
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Hotel Management System</p>
        </div>

        <Card className="shadow-lg border-slate-200 dark:border-slate-800">
          <CardHeader className="text-center pb-2">
            {status === 'loading' && (
              <>
                <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-teal-50 dark:bg-teal-950/50 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 text-teal-600 animate-spin" />
                </div>
                <CardTitle className="text-xl">Verifying Your Email</CardTitle>
                <CardDescription>Please wait while we verify your email address...</CardDescription>
              </>
            )}
            {status === 'success' && (
              <>
                <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-50 dark:bg-green-950/50 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="text-xl text-green-700 dark:text-green-400">Email Verified!</CardTitle>
                <CardDescription>
                  Your email has been successfully verified. You can now sign in to your account.
                </CardDescription>
              </>
            )}
            {status === 'already_verified' && (
              <>
                <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-xl text-blue-700 dark:text-blue-400">Already Verified</CardTitle>
                <CardDescription>
                  Your email is already verified. You can sign in to your account.
                </CardDescription>
              </>
            )}
            {status === 'error' && (
              <>
                <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-50 dark:bg-red-950/50 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-red-600" />
                </div>
                <CardTitle className="text-xl text-red-700 dark:text-red-400">Verification Failed</CardTitle>
                <CardDescription>{errorMessage}</CardDescription>
              </>
            )}
          </CardHeader>

          <CardContent>
            {(status === 'success' || status === 'already_verified') && (
              <Button asChild className="w-full" size="lg">
                <Link href="/">
                  Sign In to Your Account
                </Link>
              </Button>
            )}

            {status === 'error' && (
              <div className="space-y-4">
                <div className="border-t pt-4">
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    Enter your email to request a new verification link:
                  </p>
                  <div className="flex gap-2">
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      value={resendEmail}
                      onChange={(e) => setResendEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleResend()}
                      disabled={resendStatus === 'loading'}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleResend}
                      disabled={resendStatus === 'loading' || !resendEmail.trim()}
                      variant="outline"
                      size="default"
                    >
                      {resendStatus === 'loading' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4 mr-1" />
                      )}
                      Resend
                    </Button>
                  </div>
                  {resendStatus === 'success' && (
                    <p className="text-sm text-green-600 dark:text-green-400 mt-2">
                      If an account exists with that email, a new verification link has been sent.
                    </p>
                  )}
                  {resendStatus === 'error' && (
                    <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                      Failed to send. Please try again.
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="justify-center border-t pt-4">
            <Link
              href="/"
              className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Back to Sign In
            </Link>
          </CardFooter>
        </Card>

        {/* Hidden component that triggers the API call */}
        {token && started && status === 'loading' && (
          <VerifyStarter token={token} onResult={handleVerifyResult} />
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
          <div className="text-center">
            <Loader2 className="h-8 w-8 text-teal-600 animate-spin mx-auto" />
            <p className="text-slate-500 mt-3">Loading...</p>
          </div>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
