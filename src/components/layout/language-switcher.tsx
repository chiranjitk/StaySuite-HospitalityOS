'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { locales, languages, indianLanguages, globalLanguages, type Locale } from '@/i18n/config';
import { Globe, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/contexts/I18nContext';

interface LanguageSwitcherProps {
  variant?: 'default' | 'compact' | 'grouped';
  showLabel?: boolean;
}

export function LanguageSwitcher({ 
  variant = 'default', 
  showLabel = true 
}: LanguageSwitcherProps) {
  const { locale, setLocale, isLoading } = useI18n();

  const handleLanguageChange = async (newLocale: Locale) => {
    if (newLocale === locale) return;
    
    try {
      await setLocale(newLocale);
      toast.success('Language changed successfully');
      
      // Full page reload to apply new translations from next-intl
      window.location.reload();
    } catch {
      toast.error('Failed to change language');
    }
  };

  // Compact variant - just a globe icon
  if (variant === 'compact') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-9 w-9"
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Globe className="h-4 w-4" />
            )}
            <span className="sr-only">Select language</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {languages.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className="flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{lang.flag}</span>
                <span>{lang.nativeName}</span>
              </span>
              {locale === lang.code && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Grouped variant - separates Indian and Global languages
  if (variant === 'grouped') {
    const currentLang = languages.find(l => l.code === locale);
    
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="ghost" 
            className={`gap-2 ${showLabel ? '' : 'px-2'}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Globe className="h-4 w-4" />
            )}
            {showLabel && currentLang && (
              <span className="hidden md:inline-flex items-center gap-1">
                <span>{currentLang.flag}</span>
                <span>{currentLang.nativeName}</span>
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {/* Indian Languages */}
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            🇮🇳 Indian Languages
          </DropdownMenuLabel>
          {indianLanguages.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className="flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{lang.flag}</span>
                <span>{lang.nativeName}</span>
              </span>
              {locale === lang.code && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
          
          <DropdownMenuSeparator />
          
          {/* Global Languages */}
          <DropdownMenuLabel className="text-xs text-muted-foreground">
            🌍 Global Languages
          </DropdownMenuLabel>
          {globalLanguages.map((lang) => (
            <DropdownMenuItem
              key={lang.code}
              onClick={() => handleLanguageChange(lang.code)}
              className="flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span>{lang.flag}</span>
                <span>{lang.nativeName}</span>
              </span>
              {locale === lang.code && (
                <Check className="h-4 w-4 text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Default variant - simple list
  const currentLang = languages.find(l => l.code === locale);
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className={`gap-2 ${showLabel ? '' : 'px-2'}`}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Globe className="h-4 w-4" />
          )}
          {showLabel && currentLang && (
            <span className="hidden md:inline-flex items-center gap-1">
              <span>{currentLang.flag}</span>
              <span>{currentLang.nativeName}</span>
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 max-h-80 overflow-y-auto">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className="flex items-center justify-between cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <span className="text-lg">{lang.flag}</span>
              <div className="flex flex-col">
                <span>{lang.nativeName}</span>
                <span className="text-xs text-muted-foreground">{lang.name}</span>
              </div>
            </span>
            {locale === lang.code && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
