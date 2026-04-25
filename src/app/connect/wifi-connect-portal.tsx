'use client';

/**
 * Public WiFi Captive Portal — Voucher Code Login
 *
 * This is the guest-facing page that opens when a voucher QR code is scanned.
 * URL format: /connect?code=VOUCHER-CODE
 *
 * Flow:
 * 1. Guest scans QR code → browser opens this page with ?code= pre-filled
 * 2. Guest connects to hotel WiFi SSID
 * 3. Captive portal auto-redirects to this page
 * 4. Guest clicks "Connect" → voucher code is sent to RADIUS for auth
 * 5. FreeRADIUS validates → Access-Accept → guest is online
 */

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { Wifi, Loader2, CheckCircle, XCircle, Shield, Clock, Zap, QrCode } from 'lucide-react';

function PortalContent() {
  const searchParams = useSearchParams();
  const codeParam = searchParams.get('code') || '';

  const [voucherCode, setVoucherCode] = useState(() => codeParam || '');
  const [status, setStatus] = useState<'idle' | 'connecting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleConnect = async () => {
    if (!voucherCode.trim()) {
      setErrorMessage('Please enter a voucher code');
      return;
    }

    setStatus('connecting');
    setErrorMessage('');

    try {
      // Call the voucher redeem API
      const res = await fetch('/api/wifi/vouchers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: voucherCode.trim(),
          action: 'use',
        }),
      });

      const result = await res.json();

      if (result.success) {
        setStatus('success');
      } else {
        setStatus('error');
        const msg = result.error?.message || result.error || 'Authentication failed';
        setErrorMessage(msg);

        // Map common errors to friendly messages
        if (msg.includes('expired') || msg.includes('valid')) {
          setErrorMessage('This voucher has expired. Please contact front desk for a new one.');
        } else if (msg.includes('already been used')) {
          setErrorMessage('This voucher has already been used. Each code can only be used once.');
        } else if (msg.includes('not valid') || msg.includes('Invalid')) {
          setErrorMessage('Invalid voucher code. Please check and try again.');
        }
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage('Network error. Please ensure you are connected to the hotel WiFi and try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Hotel Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm mb-4">
            <Wifi className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">StaySuite WiFi</h1>
          <p className="text-teal-100/80 text-sm mt-1">Connect to hotel WiFi</p>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-6">
          {status === 'success' ? (
            /* ── Success State ── */
            <div className="text-center space-y-4 py-4">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-100">
                <CheckCircle className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Connected!</h2>
                <p className="text-gray-500 text-sm mt-1">
                  You are now connected to hotel WiFi. Enjoy your stay!
                </p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 text-sm text-emerald-700">
                <p className="font-medium">Your WiFi credentials:</p>
                <code className="block mt-1 text-xs bg-white px-2 py-1 rounded border">
                  {voucherCode}
                </code>
              </div>
              <button
                onClick={() => window.location.reload()}
                className="text-sm text-teal-600 hover:text-teal-700 underline"
              >
                Connect another device
              </button>
            </div>
          ) : (
            /* ── Login Form ── */
            <>
              {codeParam ? (
                <div className="flex items-center gap-2 bg-teal-50 rounded-lg p-3">
                  <QrCode className="w-4 h-4 text-teal-600 flex-shrink-0" />
                  <p className="text-sm text-teal-700">
                    <span className="font-medium">QR Code scanned</span> — your voucher code has been pre-filled
                  </p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-sm text-gray-500">
                    Enter the voucher code from your room card or front desk
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="code" className="text-sm font-medium text-gray-700">
                  Voucher Code
                </label>
                <input
                  id="code"
                  type="text"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                  placeholder="XXXXX-XXXXX"
                  disabled={status === 'connecting'}
                  className="w-full px-4 py-3 text-center text-lg font-mono font-bold tracking-wider border-2 border-gray-200 rounded-xl focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase"
                  autoFocus={!codeParam}
                  onKeyDown={(e) => e.key === 'Enter' && handleConnect()}
                />
              </div>

              {status === 'error' && errorMessage && (
                <div className="flex items-start gap-2 bg-red-50 rounded-lg p-3">
                  <XCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{errorMessage}</p>
                </div>
              )}

              <button
                onClick={handleConnect}
                disabled={status === 'connecting' || !voucherCode.trim()}
                className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-semibold py-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl active:scale-[0.98]"
              >
                {status === 'connecting' ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Connecting...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Wifi className="w-5 h-5" />
                    Connect to WiFi
                  </span>
                )}
              </button>

              {/* Info Section */}
              <div className="border-t pt-4 space-y-3">
                <div className="flex items-start gap-3 text-xs text-gray-500">
                  <Shield className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />
                  <p>Secure connection — your voucher code is your WiFi password</p>
                </div>
                <div className="flex items-start gap-3 text-xs text-gray-500">
                  <Clock className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />
                  <p>Voucher validity is based on your purchased plan duration</p>
                </div>
                <div className="flex items-start gap-3 text-xs text-gray-500">
                  <Zap className="w-4 h-4 flex-shrink-0 mt-0.5 text-gray-400" />
                  <p>Speed and data limits are automatically enforced by your plan</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-teal-200/60 mt-6">
          Powered by StaySuite Hospitality OS
        </p>
      </div>
    </div>
  );
}

export function WifiConnectPortal() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-teal-600 via-teal-700 to-emerald-800 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        </div>
      }
    >
      <PortalContent />
    </Suspense>
  );
}
