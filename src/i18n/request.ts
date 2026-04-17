import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import { locales, type Locale, defaultLocale, isValidLocale } from './config';

export default getRequestConfig(async () => {
  // Get locale from cookie or use default
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('locale')?.value;
  
  let locale: Locale = defaultLocale;
  
  if (cookieLocale && isValidLocale(cookieLocale)) {
    locale = cookieLocale as Locale;
  }
  
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
