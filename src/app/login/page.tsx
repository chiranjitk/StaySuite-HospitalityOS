'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  Hotel,
  Eye,
  EyeOff,
  Shield,
  ArrowLeft,
  Mail,
  Lock,
  ChevronRight,
  Sparkles,
  Bed,
  Key,
  ConciergeBell,
  Wine,
  Bath,
  Star,
  Clock,
  Fingerprint,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

/* ─── Login keyframes are defined in globals.css ─── */

// Floating icon configuration
const floatingIcons = [
  { Icon: Bed, x: '8%', y: '15%', size: 22, delay: 0, duration: 18, rotate: -5 },
  { Icon: Key, x: '82%', y: '10%', size: 18, delay: 2.5, duration: 22, rotate: 15 },
  { Icon: ConciergeBell, x: '75%', y: '70%', size: 20, delay: 4, duration: 20, rotate: -10 },
  { Icon: Wine, x: '15%', y: '75%', size: 16, delay: 1.5, duration: 24, rotate: 8 },
  { Icon: Bath, x: '88%', y: '40%', size: 18, delay: 3, duration: 19, rotate: -12 },
  { Icon: Star, x: '5%', y: '50%', size: 14, delay: 5, duration: 21, rotate: 20 },
  { Icon: Clock, x: '70%', y: '25%', size: 15, delay: 1, duration: 23, rotate: -8 },
  { Icon: Fingerprint, x: '25%', y: '88%', size: 17, delay: 3.5, duration: 17, rotate: 5 },
];

// Framer-motion variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 200, damping: 24, mass: 0.8 },
  },
};

const headerVariants = {
  hidden: { opacity: 0, x: -16 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { type: 'spring', stiffness: 260, damping: 20 },
  },
};

const fieldVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 300, damping: 24, delay: 0.12 + i * 0.07 },
  }),
};

const badgeVariants = {
  hidden: { opacity: 0, scale: 0.85, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 400, damping: 22, delay: 0.5 + i * 0.08 },
  }),
};

const errorVariants = {
  hidden: { opacity: 0, scale: 0.9, y: -8 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 500, damping: 25 },
  },
  exit: { opacity: 0, scale: 0.9, y: -8, transition: { duration: 0.15 } },
};

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [requireTwoFactor, setRequireTwoFactor] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const { login, completeTwoFactorLogin, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Check for OAuth messages
  useEffect(() => {
    const oauthError = searchParams.get('error');
    const message = searchParams.get('message');

    if (oauthError) {
      setError(decodeURIComponent(oauthError));
    } else if (message === 'google_linked') {
      toast({
        title: 'Google Account Linked',
        description: 'Your Google account has been successfully linked.',
      });
    }
  }, [searchParams, toast]);

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await login(email, password, rememberMe);

      if (result.success) {
        if (result.requireTwoFactor) {
          setRequireTwoFactor(true);
          setTempToken(result.tempToken || '');
        }
      } else {
        setError(result.error || 'Invalid email or password');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTwoFactorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = await completeTwoFactorLogin(email, tempToken, twoFactorCode, rememberMe);

      if (!result.success) {
        setError(result.error || 'Invalid verification code');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setRequireTwoFactor(false);
    setTwoFactorCode('');
    setTempToken('');
    setError('');
  };

  // Memoize floating icons to avoid re-renders
  const memoizedFloatingIcons = useMemo(() => floatingIcons, []);

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <motion.div
          className="flex flex-col items-center gap-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Hotel className="h-6 w-6 text-white" />
          </div>
          <div className="h-4 w-24 bg-slate-800 rounded animate-pulse" />
        </motion.div>
      </div>
    );
  }

  // Demo credentials are only available in development mode
  const showDemoCredentials = process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.NODE_ENV !== 'production';
  const demoCredentials = showDemoCredentials ? [
    { role: 'Admin', email: 'admin@royalstay.in', password: 'admin123', color: 'bg-violet-500', ring: 'ring-violet-500/30', icon: Shield },
    { role: 'Front Desk', email: 'frontdesk@royalstay.in', password: 'staff123', color: 'bg-cyan-500', ring: 'ring-cyan-500/30', icon: ConciergeBell },
    { role: 'Housekeeping', email: 'housekeeping@royalstay.in', password: 'staff123', color: 'bg-emerald-500', ring: 'ring-emerald-500/30', icon: Bath },
  ] : [];

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* ═══════════════════════════════════════════
          LEFT SIDE - Brand with AI Image
          ═══════════════════════════════════════════ */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[540px] relative overflow-hidden">
        {/* AI Generated Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[20s] ease-linear hover:scale-105"
          style={{ backgroundImage: 'url(/images/login-hero.png)' }}
        />

        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/80 to-slate-950/60" />

        {/* Animated glow orbs */}
        <div
          className="absolute top-1/4 left-1/3 w-64 h-64 rounded-full bg-violet-400/10 blur-[100px]"
          style={{ animation: 'loginGlowPulse 6s ease-in-out infinite' }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-48 h-48 rounded-full bg-indigo-400/10 blur-[80px]"
          style={{ animation: 'loginGlowPulse 8s ease-in-out infinite 2s' }}
        />

        {/* Content */}
        <motion.div
          className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full"
          initial="hidden"
          animate="visible"
          variants={containerVariants}
        >
          {/* Logo */}
          <motion.div className="flex items-center gap-3" variants={headerVariants}>
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25 transition-transform hover:scale-110 duration-300">
              <Hotel className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-white via-violet-200 to-violet-300 bg-clip-text text-transparent">
                StaySuite
              </h1>
              <p className="text-muted-foreground text-xs">by Cryptsk Pvt Ltd</p>
            </div>
          </motion.div>

          {/* Tagline */}
          <motion.div className="space-y-6" variants={headerVariants}>
            <h2 className="text-2xl font-medium text-white leading-tight">
              Manage your property<br />
              <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-violet-300 bg-clip-text text-transparent">with intelligence.</span>
            </h2>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              {['WiFi AAA Ready', 'Gateway Integration'].map((label) => (
                <span
                  key={label}
                  className="px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/25 text-white font-medium hover:bg-white/20 hover:border-white/35 transition-all duration-300 cursor-default"
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-6 text-sm text-slate-200 font-medium">
              <span>2,500+ properties</span>
              <span className="w-1 h-1 rounded-full bg-slate-500" />
              <span>150 countries</span>
            </div>
          </motion.div>

          {/* Footer */}
          <motion.div
            className="flex items-center gap-4 text-xs text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <span>&copy; 2026 Cryptsk Pvt Ltd</span>
            <span>&middot;</span>
            <span className="hover:text-slate-300 transition-colors cursor-pointer">Privacy</span>
            <span>&middot;</span>
            <span className="hover:text-slate-300 transition-colors cursor-pointer">Terms</span>
          </motion.div>
        </motion.div>
      </div>

      {/* ═══════════════════════════════════════════
          RIGHT SIDE - Login Form
          ═══════════════════════════════════════════ */}

      {/* Animated mesh gradient background */}
      <div className="flex-1 relative">
        {/* Mesh gradient base layer */}
        <div
          className="absolute inset-0"
          style={{
            background: `
              linear-gradient(-45deg,
                #f8fafc, #ede9fe, #f0f9ff, #fdf2f8,
                #faf5ff, #fff7ed, #f0fdf4, #f8fafc)
            `,
            backgroundSize: '400% 400%',
            animation: 'loginGradientShift 20s ease infinite',
          }}
        />

        {/* Mesh gradient orbs - creates mesh effect */}
        <div
          className="absolute top-[10%] left-[20%] w-[500px] h-[500px] rounded-full opacity-30 blur-[120px]"
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.15) 0%, transparent 70%)',
            animation: 'loginGlowPulse 10s ease-in-out infinite',
          }}
        />
        <div
          className="absolute bottom-[10%] right-[15%] w-[400px] h-[400px] rounded-full opacity-25 blur-[100px]"
          style={{
            background: 'radial-gradient(circle, rgba(236,72,153,0.12) 0%, transparent 70%)',
            animation: 'loginGlowPulse 12s ease-in-out infinite 3s',
          }}
        />
        <div
          className="absolute top-[50%] left-[50%] -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-20 blur-[140px]"
          style={{
            background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 70%)',
            animation: 'loginGlowPulse 14s ease-in-out infinite 6s',
          }}
        />

        {/* Decorative grid pattern */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.035] pointer-events-none"
          aria-hidden="true"
        >
          <defs>
            <pattern id="loginGridPattern" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="currentColor" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#loginGridPattern)" style={{ color: '#6366f1' }} />
        </svg>

        {/* Dot pattern overlay */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.04] pointer-events-none"
          aria-hidden="true"
          style={{ animation: 'loginPatternDrift 30s linear infinite' }}
        >
          <defs>
            <pattern id="loginDotPattern" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#loginDotPattern)" style={{ color: '#8b5cf6' }} />
        </svg>

        {/* Floating hotel-themed icons */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          {memoizedFloatingIcons.map(({ Icon, x, y, size, delay, duration, rotate }, i) => (
            <motion.div
              key={i}
              className="absolute"
              style={{ left: x, top: y }}
              initial={{ opacity: 0, rotate: 0 }}
              animate={{
                opacity: [0, 0.12, 0.08, 0.12, 0],
                y: [0, -20, -10, -25, 0],
                x: [0, 8, -6, 4, 0],
                rotate: [0, rotate, -rotate, rotate * 0.5, 0],
              }}
              transition={{
                duration,
                delay,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            >
              <Icon
                className="text-violet-400 dark:text-violet-300/40"
                style={{ width: size, height: size }}
              />
            </motion.div>
          ))}
        </div>

        {/* Floating particle animation layer */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          {Array.from({ length: 16 }).map((_, i) => (
            <div
              key={`particle-${i}`}
              className="absolute rounded-full"
              style={{
                width: `${3 + (i % 4) * 1.5}px`,
                height: `${3 + (i % 4) * 1.5}px`,
                left: `${6 + (i * 6.5) % 88}%`,
                top: `${8 + (i * 12) % 80}%`,
                background: i % 4 === 0
                  ? 'rgba(139, 92, 246, 0.2)'
                  : i % 4 === 1
                    ? 'rgba(236, 72, 153, 0.15)'
                    : i % 4 === 2
                      ? 'rgba(99, 102, 241, 0.18)'
                      : 'rgba(245, 158, 11, 0.12)',
                animation: `loginParticle ${5 + (i % 5) * 1.5}s ease-out infinite`,
                animationDelay: `${i * 0.6}s`,
              }}
            />
          ))}
        </div>

        {/* Subtle radial glow behind form */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, rgba(236,72,153,0.03) 40%, transparent 70%)',
            animation: 'loginGlowPulse 8s ease-in-out infinite',
          }}
        />

        <div className="relative z-10 flex items-center justify-center min-h-screen p-6 sm:p-8">
          <div className="w-full max-w-sm">

            {/* Mobile Logo */}
            <motion.div
              className="lg:hidden flex items-center justify-center gap-3 mb-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            >
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                <Hotel className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-500 bg-clip-text text-transparent">
                  StaySuite
                </h1>
                <p className="text-muted-foreground text-[11px] tracking-wide">HospitalityOS</p>
              </div>
            </motion.div>

            {/* ── Glassmorphism Card ── */}
            <motion.div
              className="rounded-2xl border border-white/50 dark:border-white/[0.08] bg-white/60 dark:bg-slate-950/60 backdrop-blur-2xl shadow-[0_8px_40px_-12px_rgba(0,0,0,0.10),0_0_80px_-20px_rgba(139,92,246,0.06)] dark:shadow-[0_8px_40px_-12px_rgba(0,0,0,0.5),0_0_80px_-20px_rgba(139,92,246,0.08)] relative overflow-hidden"
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              whileHover={{
                boxShadow: '0_20px_60px_-12px_rgba(0,0,0,0.15),0_0_100px_-20px_rgba(139,92,246,0.10)',
                y: -2,
                transition: { duration: 0.4, ease: 'easeOut' },
              }}
            >
              {/* Animated gradient border on top edge */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 via-fuchsia-500 via-pink-400 to-amber-400 bg-[length:200%_100%]" style={{ animation: 'loginGradientShift 4s ease infinite' }} />
              {/* Subtle animated border glow on top edge */}
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-violet-400/30 to-transparent" style={{ animation: 'loginGlowPulse 4s ease-in-out infinite' }} />

              {/* Inner glass highlight */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/[0.08] to-transparent dark:from-white/[0.03] pointer-events-none" />

              <div className="p-6 sm:p-8 relative">

                {/* Header */}
                <div className="mb-7">
                  <motion.div
                    className="flex items-center gap-2 mb-2"
                    variants={headerVariants}
                    initial="hidden"
                    animate="visible"
                  >
                    <div className="h-8 w-1 rounded-full bg-gradient-to-b from-violet-500 via-fuchsia-500 to-indigo-600" />
                    <h2 className="text-xl font-bold text-foreground tracking-tight">
                      {requireTwoFactor ? 'Two-factor authentication' : 'Sign in'}
                    </h2>
                  </motion.div>
                  <motion.p
                    className="text-sm text-muted-foreground/80 font-medium pl-3"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.08 }}
                  >
                    {requireTwoFactor
                      ? 'Enter your verification code'
                      : 'Welcome back. Enter your credentials.'}
                  </motion.p>
                </div>

                {/* Form */}
                <div className="space-y-5">
                  {!requireTwoFactor ? (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <AnimatePresence mode="wait">
                        {error && (
                          <motion.div
                            key="login-error"
                            variants={errorVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                          >
                            <Alert variant="destructive" className="border-red-200/80 dark:border-red-800/80 bg-red-50/80 dark:bg-red-950/40 backdrop-blur-sm">
                              <AlertDescription className="text-red-700 dark:text-red-300 font-medium text-sm flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                                {error}
                              </AlertDescription>
                            </Alert>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <motion.div
                        className="space-y-2"
                        variants={fieldVariants}
                        initial="hidden"
                        animate="visible"
                        custom={0}
                      >
                        <Label htmlFor="email" className="text-sm font-semibold text-foreground/80">Email</Label>
                        <div className="relative group/input">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 transition-all duration-300 group-focus-within/input:text-violet-500 dark:text-violet-400 group-focus-within/input:scale-110" />
                          <div className="absolute inset-0 rounded-xl bg-violet-500/0 blur-sm transition-all duration-300 group-focus-within/input:bg-violet-500/5 group-focus-within/input:blur-md pointer-events-none" />
                          <Input
                            id="email"
                            type="email"
                            placeholder="you@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="relative pl-11 h-12 bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-700/50 rounded-xl transition-all duration-300 focus:bg-white/80 dark:focus:bg-slate-900/80 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15 hover:border-slate-300/70 dark:hover:border-slate-600/70 hover:shadow-sm text-[15px] placeholder:text-foreground/35"
                            required
                            disabled={isLoading}
                            autoComplete="email"
                          />
                        </div>
                      </motion.div>

                      <motion.div
                        className="space-y-2"
                        variants={fieldVariants}
                        initial="hidden"
                        animate="visible"
                        custom={1}
                      >
                        <div className="flex items-center">
                          <Label htmlFor="password" className="text-sm font-semibold text-foreground/80">Password</Label>
                          <button
                            type="button"
                            className="ml-auto text-xs text-muted-foreground hover:text-violet-600 dark:text-violet-400 dark:hover:text-violet-400 transition-colors duration-200 font-medium"
                            onClick={async () => {
                              if (!email) {
                                toast({
                                  title: 'Email Required',
                                  description: 'Please enter your email address first.',
                                  variant: 'destructive',
                                });
                                return;
                              }
                              try {
                                await fetch('/api/auth/forgot-password', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ email }),
                                });
                                toast({
                                  title: 'Reset Email Sent',
                                  description: 'Check your inbox for password reset instructions.',
                                });
                              } catch {
                                toast({
                                  title: 'Error',
                                  description: 'Failed to send reset email.',
                                  variant: 'destructive',
                                });
                              }
                            }}
                          >
                            Forgot password?
                          </button>
                        </div>
                        <div className="mt-1 relative group/input">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/30 transition-all duration-300 group-focus-within/input:text-violet-500 dark:text-violet-400 group-focus-within/input:scale-110" />
                          <div className="absolute inset-0 rounded-xl bg-violet-500/0 blur-sm transition-all duration-300 group-focus-within/input:bg-violet-500/5 group-focus-within/input:blur-md pointer-events-none" />
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="relative pl-11 pr-11 h-12 bg-white/50 dark:bg-slate-900/50 border-slate-200/50 dark:border-slate-700/50 rounded-xl transition-all duration-300 focus:bg-white/80 dark:focus:bg-slate-900/80 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15 hover:border-slate-300/70 dark:hover:border-slate-600/70 hover:shadow-sm text-[15px] placeholder:text-foreground/35"
                            required
                            disabled={isLoading}
                            autoComplete="current-password"
                          />
                          <button
                            type="button"
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8 flex items-center justify-center text-muted-foreground/30 hover:text-muted-foreground transition-all duration-200 hover:scale-110 active:scale-95"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                          </button>
                        </div>
                      </motion.div>

                      {/* Remember me - more elegant */}
                      <motion.div
                        className="flex items-center justify-between"
                        variants={fieldVariants}
                        initial="hidden"
                        animate="visible"
                        custom={2}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="relative flex items-center">
                            <Checkbox
                              id="remember"
                              checked={rememberMe}
                              onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                              className="h-[18px] w-[18px] rounded-md border-slate-300/80 data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-violet-500 data-[state=checked]:to-fuchsia-500 data-[state=checked]:border-violet-500 data-[state=checked]:text-white transition-all duration-300 focus-visible:ring-2 focus-visible:ring-violet-500/30 focus-visible:ring-offset-1 hover:border-violet-300/80"
                            />
                          </div>
                          <Label htmlFor="remember" className="text-sm text-muted-foreground/80 font-medium cursor-pointer select-none hover:text-muted-foreground transition-colors duration-200">
                            Remember for 30 days
                          </Label>
                        </div>
                      </motion.div>

                      <motion.div
                        variants={fieldVariants}
                        initial="hidden"
                        animate="visible"
                        custom={3}
                      >
                        <Button
                          type="submit"
                          className={cn(
                            "w-full h-12 rounded-xl font-semibold text-sm transition-all duration-300",
                            "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-violet-600 bg-[length:200%_100%]",
                            "hover:bg-right hover:shadow-[0_8px_30px_-8px_rgba(139,92,246,0.45)]",
                            "dark:from-violet-500 dark:via-fuchsia-500 dark:to-violet-500",
                            "text-white",
                            "hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]",
                            "disabled:opacity-70 disabled:hover:translate-y-0 disabled:shadow-lg disabled:active:scale-100",
                            "relative overflow-hidden group"
                          )}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <span className="relative z-10 flex items-center justify-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Signing in...
                            </span>
                          ) : (
                            <span className="relative z-10 flex items-center justify-center gap-1.5">
                              Sign in
                              <ChevronRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                            </span>
                          )}
                          {/* Shimmer overlay - always visible, more prominent on hover */}
                          <span
                            className="absolute inset-0 pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity duration-300"
                            style={{
                              background: 'linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.15) 45%, rgba(255,255,255,0.25) 50%, rgba(255,255,255,0.15) 55%, transparent 75%)',
                              backgroundSize: '250% 100%',
                              animation: 'loginShimmer 3s ease-in-out infinite',
                            }}
                          />
                          {/* Bottom glow */}
                          <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-3/4 h-6 bg-violet-500/30 blur-xl rounded-full pointer-events-none" />
                        </Button>
                      </motion.div>

                      {/* Secure connection indicator */}
                      <motion.div
                        className="flex items-center justify-center gap-1.5 mt-2 text-[11px] text-muted-foreground/60 font-medium"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.6, duration: 0.5 }}
                      >
                        <Shield className="h-3 w-3" />
                        <span>Secured with 256-bit encryption</span>
                      </motion.div>
                    </form>
                  ) : (
                    <form onSubmit={handleTwoFactorSubmit} className="space-y-4">
                      <AnimatePresence mode="wait">
                        {error && (
                          <motion.div
                            key="2fa-error"
                            variants={errorVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                          >
                            <Alert variant="destructive" className="border-red-200/80 dark:border-red-800/80 bg-red-50/80 dark:bg-red-950/40 backdrop-blur-sm">
                              <AlertDescription className="text-red-700 dark:text-red-300 font-medium text-sm flex items-center gap-2">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                                {error}
                              </AlertDescription>
                            </Alert>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <div className="flex justify-center py-4">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-100 to-fuchsia-100 dark:from-violet-900/40 dark:to-fuchsia-900/40 flex items-center justify-center shadow-md">
                          <Shield className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                        </div>
                      </div>

                      <p className="text-sm text-center text-muted-foreground">
                        Enter the 6-digit code from your authenticator app.
                      </p>

                      <div className="space-y-2">
                        <Label htmlFor="twoFactorCode">Code</Label>
                        <Input
                          id="twoFactorCode"
                          type="text"
                          placeholder="000000"
                          value={twoFactorCode}
                          onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="text-center text-xl tracking-[0.3em] font-mono h-12 rounded-xl bg-white/50 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-700/80 transition-all duration-300 focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
                          maxLength={6}
                          disabled={isLoading}
                          autoFocus
                        />
                      </div>

                      <Button
                        type="submit"
                        className="w-full h-11 rounded-xl font-semibold text-sm transition-all duration-300 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-500/25 hover:shadow-xl hover:shadow-violet-500/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-70 disabled:hover:translate-y-0 relative overflow-hidden"
                        disabled={isLoading || twoFactorCode.length < 6}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          'Verify'
                        )}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full rounded-xl transition-all duration-200"
                        onClick={handleBackToLogin}
                        disabled={isLoading}
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to login
                      </Button>
                    </form>
                  )}

                  {/* ── Demo Credentials ── */}
                  {!requireTwoFactor && showDemoCredentials && (
                    <motion.div
                      className="pt-5"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.55, duration: 0.4 }}
                    >
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <Separator className="bg-slate-200/40 dark:bg-slate-700/40" />
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-white/60 dark:bg-slate-950/60 backdrop-blur-xl px-3 text-xs text-muted-foreground/70 flex items-center gap-1.5 font-medium">
                            <Sparkles className="h-3 w-3 text-violet-400 dark:text-violet-300" />
                            Quick demo access
                          </span>
                        </div>
                      </div>

                      <div className="mt-4 space-y-2">
                        {demoCredentials.map((cred, index) => {
                          const CredIcon = cred.icon;
                          return (
                            <motion.button
                              key={index}
                              type="button"
                              onClick={() => {
                                setEmail(cred.email);
                                setPassword(cred.password);
                              }}
                              variants={badgeVariants}
                              initial="hidden"
                              animate="visible"
                              custom={index}
                              whileHover={{
                                scale: 1.02,
                                y: -2,
                                transition: { type: 'spring', stiffness: 400, damping: 20 },
                              }}
                              whileTap={{ scale: 0.99, y: 0 }}
                              className={cn(
                                "w-full flex items-center gap-3 p-3.5 rounded-xl border text-left",
                                "border-slate-200/50 dark:border-slate-700/50",
                                "bg-white/30 dark:bg-slate-900/30",
                                "backdrop-blur-sm",
                                "transition-all duration-300",
                                "hover:bg-white/60 dark:hover:bg-slate-900/60",
                                "hover:border-violet-200/60 dark:hover:border-violet-700/40",
                                "hover:shadow-[0_8px_24px_-8px_rgba(139,92,246,0.12)]",
                                "group"
                              )}
                            >
                              <motion.div
                                className={cn(
                                  "h-9 w-9 rounded-xl flex items-center justify-center shadow-md",
                                  cred.color
                                )}
                                whileHover={{ scale: 1.1, rotate: 3 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                              >
                                <CredIcon className="h-4 w-4 text-white" />
                              </motion.div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-foreground">{cred.role}</div>
                                <div className="text-xs text-muted-foreground/50 truncate">{cred.email}</div>
                              </div>
                              <motion.div
                                className="h-6 w-6 rounded-lg flex items-center justify-center bg-slate-100/80 dark:bg-slate-800/80"
                                whileHover={{ x: 2 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                              >
                                <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
                              </motion.div>
                            </motion.button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* ── Sign up link + Footer ── */}
            <motion.div
              className="mt-6 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7, duration: 0.5 }}
            >
              <p className="text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <button
                  className="text-violet-600 dark:text-violet-400 font-semibold hover:text-violet-700 dark:hover:text-violet-300 transition-colors duration-200 underline-offset-4 hover:underline inline-flex items-center gap-1"
                  onClick={() => router.push('/signup')}
                >
                  Start free trial
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
