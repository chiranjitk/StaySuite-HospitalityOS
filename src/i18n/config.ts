// Available locales configuration for StaySuite HospitalityOS
// 15 Languages: 8 Indian + 7 Global (India-first approach)

export const locales = [
  // Indian Languages (8)
  'en', 'hi', 'bn', 'ta', 'te', 'mr', 'gu', 'ml',
  // Global Languages (7)
  'es', 'fr', 'ar', 'pt', 'de', 'zh', 'ja'
] as const;

export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

// Language metadata with native names and groups
export interface LanguageInfo {
  code: Locale;
  name: string;
  nativeName: string;
  flag: string;
  group: 'indian' | 'global';
}

export const languages: LanguageInfo[] = [
  // Indian Languages
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇮🇳', group: 'indian' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', group: 'indian' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇮🇳', group: 'indian' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', flag: '🇮🇳', group: 'indian' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', flag: '🇮🇳', group: 'indian' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳', group: 'indian' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', flag: '🇮🇳', group: 'indian' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', flag: '🇮🇳', group: 'indian' },
  // Global Languages
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', group: 'global' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', group: 'global' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', group: 'global' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇧🇷', group: 'global' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', group: 'global' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', group: 'global' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', group: 'global' },
];

// Legacy exports for backward compatibility
export const localeNames: Record<Locale, string> = Object.fromEntries(
  languages.map(l => [l.code, l.nativeName])
) as Record<Locale, string>;

export const localeFlags: Record<Locale, string> = Object.fromEntries(
  languages.map(l => [l.code, l.flag])
) as Record<Locale, string>;

// Grouped languages for UI
export const indianLanguages = languages.filter(l => l.group === 'indian');
export const globalLanguages = languages.filter(l => l.group === 'global');

// RTL languages
export const rtlLocales: Locale[] = ['ar']; // Arabic is RTL

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}

export function getLanguageInfo(locale: Locale): LanguageInfo | undefined {
  return languages.find(l => l.code === locale);
}

export function isRTL(locale: Locale): boolean {
  return rtlLocales.includes(locale);
}
