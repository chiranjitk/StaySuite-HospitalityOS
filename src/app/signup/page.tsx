'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Building2, Check, ArrowRight, ArrowLeft, AlertCircle, Sparkles, Users, Database, Shield } from 'lucide-react';
import { toast } from 'sonner';

interface PlanDetails {
  name: string;
  price: number;
  properties: number;
  users: number;
  rooms: number;
  storage: number;
  features: string[];
}

const plans: Record<string, PlanDetails> = {
  trial: {
    name: 'Trial',
    price: 0,
    properties: 1,
    users: 3,
    rooms: 50,
    storage: 500,
    features: [
      'Full platform access',
      'All core features',
      'Email support',
      '14-day trial period',
    ],
  },
  starter: {
    name: 'Starter',
    price: 99,
    properties: 1,
    users: 5,
    rooms: 50,
    storage: 1000,
    features: [
      'Single property',
      'Basic PMS features',
      'Channel management',
      'Payment processing',
      'Email support',
    ],
  },
  professional: {
    name: 'Professional',
    price: 499,
    properties: 5,
    users: 25,
    rooms: 500,
    storage: 5000,
    features: [
      'Up to 5 properties',
      'Advanced PMS & RMS',
      'CRM & Marketing',
      'AI-powered insights',
      'Priority support',
      'Custom integrations',
    ],
  },
  enterprise: {
    name: 'Enterprise',
    price: 1999,
    properties: 20,
    users: 100,
    rooms: 2000,
    storage: 50000,
    features: [
      'Unlimited properties',
      'All features included',
      'Custom development',
      'Dedicated support',
      'SLA guarantee',
      'On-premise option',
    ],
  },
};

export default function TenantSignupPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessName: '',
    slug: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    plan: 'trial',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.businessName.trim()) {
      newErrors.businessName = 'Business name is required';
    } else if (formData.businessName.length < 2) {
      newErrors.businessName = 'Business name must be at least 2 characters';
    }
    
    if (!formData.slug.trim()) {
      newErrors.slug = 'Subdomain is required';
    } else if (formData.slug.length < 3) {
      newErrors.slug = 'Subdomain must be at least 3 characters';
    } else if (!/^[a-z0-9-]+$/.test(formData.slug)) {
      newErrors.slug = 'Subdomain can only contain lowercase letters, numbers, and hyphens';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateStep1()) {
      setStep(2);
    }
  };

  const handleSlugChange = (value: string) => {
    // Convert to lowercase and replace spaces with hyphens
    const sanitized = value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    setFormData({ ...formData, slug: sanitized });
  };

  const handleSubmit = async () => {
    setLoading(true);
    setErrors({});

    try {
      const response = await fetch('/api/tenants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.businessName,
          slug: formData.slug,
          email: formData.email,
          password: formData.password,
          phone: formData.phone || null,
          plan: formData.plan,
        }),
      });

      if (!response.ok) {
        let errorMsg = 'Registration failed';
        try {
          const data = await response.json();
          errorMsg = data.error || data.message || errorMsg;
          if (data.error === 'Slug already exists') {
            setErrors({ slug: 'This subdomain is already taken' });
            setStep(1);
          } else if (data.error === 'Email already exists') {
            setErrors({ email: 'An account with this email already exists' });
            setStep(1);
          } else {
            toast.error(errorMsg);
          }
        } catch {
          toast.error(`Server error (${response.status})`);
        }
        return;
      }

      const data = await response.json();

      if (data.success) {
        toast.success('Account created successfully! Redirecting to login...');
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        if (data.error === 'Slug already exists') {
          setErrors({ slug: 'This subdomain is already taken' });
          setStep(1);
        } else if (data.error === 'Email already exists') {
          setErrors({ email: 'An account with this email already exists' });
          setStep(1);
        } else {
          toast.error(data.error || 'Failed to create account');
        }
      }
    } catch (error) {
      console.error('Signup error:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectedPlan = plans[formData.plan];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-white" />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
              StaySuite
            </span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Create Your Hotel Account</h1>
          <p className="text-gray-500 mt-2">Get started with StaySuite in minutes</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 1 ? 'bg-violet-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              {step > 1 ? <Check className="h-4 w-4" /> : '1'}
            </div>
            <span className={step >= 1 ? 'text-gray-900 font-medium' : 'text-gray-500'}>Account Details</span>
          </div>
          <div className={`h-px w-16 ${step >= 2 ? 'bg-violet-500' : 'bg-gray-200'}`} />
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium ${
              step >= 2 ? 'bg-violet-500 text-white' : 'bg-gray-200 text-gray-500'
            }`}>
              2
            </div>
            <span className={step >= 2 ? 'text-gray-900 font-medium' : 'text-gray-500'}>Select Plan</span>
          </div>
        </div>

        <div className="max-w-5xl mx-auto">
          {step === 1 ? (
            <div className="grid md:grid-cols-2 gap-8">
              {/* Form */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <CardTitle>Account Information</CardTitle>
                  <CardDescription>Enter your business details to create your account</CardDescription>
                </CardHeader>
                <form onSubmit={(e) => { e.preventDefault(); handleNextStep(); }}>
                <CardContent className="space-y-4">
                  {/* Business Name */}
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business Name *</Label>
                    <Input
                      id="businessName"
                      placeholder="Grand Hotel & Resort"
                      value={formData.businessName}
                      onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                      className={errors.businessName ? 'border-red-500' : ''}
                    />
                    {errors.businessName && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.businessName}
                      </p>
                    )}
                  </div>

                  {/* Subdomain/Slug */}
                  <div className="space-y-2">
                    <Label htmlFor="slug">Subdomain *</Label>
                    <div className="flex">
                      <Input
                        id="slug"
                        placeholder="grand-hotel"
                        value={formData.slug}
                        onChange={(e) => handleSlugChange(e.target.value)}
                        className={`rounded-r-none ${errors.slug ? 'border-red-500' : ''}`}
                      />
                      <div className="flex items-center px-3 bg-gray-100 border border-l-0 rounded-r-md text-gray-500 text-sm">
                        .staysuite.com
                      </div>
                    </div>
                    {errors.slug && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.slug}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">Your hotel will be accessible at {formData.slug || 'your-hotel'}.staysuite.com</p>
                  </div>

                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Admin Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="admin@grandhotel.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value.toLowerCase() })}
                      className={errors.email ? 'border-red-500' : ''}
                    />
                    {errors.email && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.email}
                      </p>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number (Optional)</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <Label htmlFor="password">Password *</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Min 8 characters"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className={errors.password ? 'border-red-500' : ''}
                    />
                    {errors.password && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.password}
                      </p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password *</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="Confirm your password"
                      value={formData.confirmPassword}
                      onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                      className={errors.confirmPassword ? 'border-red-500' : ''}
                    />
                    {errors.confirmPassword && (
                      <p className="text-sm text-red-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.confirmPassword}
                      </p>
                    )}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit" className="w-full">
                    Continue to Plan Selection
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardFooter>
                </form>
              </Card>

              {/* Info */}
              <div className="space-y-6">
                <Card className="border-0 shadow-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
                  <CardContent className="pt-6">
                    <Sparkles className="h-10 w-10 mb-4" />
                    <h3 className="text-xl font-semibold mb-2">Start Your 14-Day Free Trial</h3>
                    <p className="text-violet-200">
                      Get full access to all features with no credit card required. 
                      See how StaySuite can transform your hotel operations.
                    </p>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-lg">
                  <CardContent className="pt-6">
                    <h4 className="font-semibold mb-4">What you will get:</h4>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-4 w-4 text-violet-600" />
                        </div>
                        <div>
                          <p className="font-medium">Property Management</p>
                          <p className="text-sm text-gray-500">Complete PMS with room management, bookings, and more</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                          <Users className="h-4 w-4 text-violet-600" />
                        </div>
                        <div>
                          <p className="font-medium">Guest Management</p>
                          <p className="text-sm text-gray-500">Guest profiles, preferences, and loyalty programs</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                          <Database className="h-4 w-4 text-violet-600" />
                        </div>
                        <div>
                          <p className="font-medium">Channel Management</p>
                          <p className="text-sm text-gray-500">OTA connections and inventory sync</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-lg bg-violet-100 flex items-center justify-center flex-shrink-0">
                          <Shield className="h-4 w-4 text-violet-600" />
                        </div>
                        <div>
                          <p className="font-medium">Secure & Reliable</p>
                          <p className="text-sm text-gray-500">Enterprise-grade security with 99.9% uptime</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Plan Selection */}
              <div className="grid md:grid-cols-4 gap-4">
                {Object.entries(plans).map(([key, plan]) => (
                  <Card
                    key={key}
                    className={`cursor-pointer transition-all border-2 ${
                      formData.plan === key
                        ? 'border-violet-500 shadow-lg scale-105'
                        : 'border-transparent hover:border-gray-200'
                    }`}
                    onClick={() => setFormData({ ...formData, plan: key })}
                  >
                    <CardHeader className="text-center pb-2">
                      <Badge className={`w-fit mx-auto mb-2 ${
                        key === 'enterprise' ? 'bg-violet-500' :
                        key === 'professional' ? 'bg-cyan-500' :
                        key === 'starter' ? 'bg-emerald-500' : 'bg-gray-500'
                      }`}>
                        {plan.name}
                      </Badge>
                      <CardTitle className="text-2xl">
                        ${plan.price}
                        <span className="text-sm font-normal text-gray-500">/mo</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-500 text-center">
                      <p>{plan.properties} {plan.properties === 1 ? 'Property' : 'Properties'}</p>
                      <p>{plan.users} Users</p>
                      <p>{plan.rooms} Rooms</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Selected Plan Details */}
              <Card className="border-0 shadow-lg">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        Selected Plan: <Badge className={`${
                          formData.plan === 'enterprise' ? 'bg-violet-500' :
                          formData.plan === 'professional' ? 'bg-cyan-500' :
                          formData.plan === 'starter' ? 'bg-emerald-500' : 'bg-gray-500'
                        }`}>{selectedPlan.name}</Badge>
                      </CardTitle>
                      <CardDescription>
                        {formData.plan === 'trial' 
                          ? 'Your 14-day trial starts now. No credit card required.'
                          : `You will be billed $${selectedPlan.price}/month after your trial ends.`}
                      </CardDescription>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold">${selectedPlan.price}</p>
                      <p className="text-sm text-gray-500">per month</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold mb-3">Limits</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Properties:</span>
                          <span className="font-medium">{selectedPlan.properties}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Users:</span>
                          <span className="font-medium">{selectedPlan.users}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Rooms:</span>
                          <span className="font-medium">{selectedPlan.rooms}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Storage:</span>
                          <span className="font-medium">{selectedPlan.storage} MB</span>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-semibold mb-3">Features</h4>
                      <ul className="space-y-2">
                        {selectedPlan.features.map((feature, i) => (
                          <li key={i} className="flex items-center gap-2 text-sm">
                            <Check className="h-4 w-4 text-violet-500" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">Account Summary</h4>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Business Name:</span>
                        <span className="ml-2 font-medium">{formData.businessName}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Subdomain:</span>
                        <span className="ml-2 font-medium">{formData.slug}.staysuite.com</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Admin Email:</span>
                        <span className="ml-2 font-medium">{formData.email}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Plan:</span>
                        <span className="ml-2 font-medium">{selectedPlan.name}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>
                  <Button className="flex-1" onClick={handleSubmit} disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      <>
                        Create Account
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>

              {/* Already have account */}
              <p className="text-center text-sm text-gray-500">
                Already have an account?{' '}
                <Link href="/login" className="text-violet-600 hover:underline font-medium">
                  Sign in instead
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
