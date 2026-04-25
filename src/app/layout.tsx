import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { FeatureFlagsProvider } from "@/contexts/FeatureFlagsContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { PermissionProvider } from "@/contexts/PermissionContext";
import { UIStyleProvider } from "@/components/theme/ui-style-provider";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { TaxProvider } from "@/contexts/TaxContext";
import { TimezoneProvider } from "@/contexts/TimezoneContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { cookies } from 'next/headers';
import { locales, type Locale, defaultLocale, isValidLocale } from '@/i18n/config';
import { I18nProvider } from '@/contexts/I18nContext';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StaySuite HospitalityOS - Multi-Tenant SaaS Platform",
  description: "Complete hospitality management system with 24 modules for hotels, resorts, and property management.",
  keywords: ["Hospitality", "Hotel Management", "PMS", "Booking", "SaaS", "Multi-tenant"],
  authors: [{ name: "StaySuite Team" }],
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "StaySuite HospitalityOS",
    description: "Complete hospitality management platform",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get locale from cookie
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('locale')?.value;
  
  let locale: Locale = defaultLocale;
  
  if (cookieLocale && isValidLocale(cookieLocale)) {
    locale = cookieLocale as Locale;
  }
  
  // Load messages for the locale
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <UIStyleProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <I18nProvider>
              <AuthProvider>
                <PermissionProvider>
                  <FeatureFlagsProvider>
                    <CurrencyProvider>
                      <TimezoneProvider>
                        <SettingsProvider>
                          <TaxProvider>
                            {children}
                          </TaxProvider>
                        </SettingsProvider>
                      </TimezoneProvider>
                    </CurrencyProvider>
                  </FeatureFlagsProvider>
                </PermissionProvider>
                <Toaster />
              </AuthProvider>
            </I18nProvider>
          </NextIntlClientProvider>
        </UIStyleProvider>
      </body>
    </html>
  );
}
