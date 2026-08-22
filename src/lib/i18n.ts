'use client'
import { create } from 'zustand'

type Locale = 'fr' | 'en' | 'es' | 'sw' | 'ar' | 'it' | 'de'

export type { Locale }

export const LOCALE_NAMES: Record<Locale, string> = {
  fr: 'Français', en: 'English', es: 'Español', sw: 'Kiswahili', ar: 'العربية', it: 'Italiano', de: 'Deutsch',
}

export const LOCALE_FLAGS: Record<Locale, string> = {
  fr: '🇫🇷', en: '🇬🇧', es: '🇪🇸', sw: '🇹🇿', ar: '🇸🇦', it: '🇮🇹', de: '🇩🇪',
}

export const RTL_LOCALES = new Set<Locale>(['ar'])
export const SUPPORTED_LOCALES: Locale[] = ['fr', 'en', 'es', 'sw', 'ar', 'it', 'de']

import frDict from './translations/fr'
import enDict from './translations/en'
import esDict from './translations/es'
import swDict from './translations/sw'
import arDict from './translations/ar'
import itDict from './translations/it'
import deDict from './translations/de'

const TRANSLATIONS: Record<Locale, Record<string, string>> = {
  fr: frDict, en: enDict, es: esDict, sw: swDict, ar: arDict, it: itDict, de: deDict,
}

function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'fr'
  try {
    const stored = localStorage.getItem('jurislink_locale')
    if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) return stored as Locale
  } catch { /* ignore */ }
  try {
    const nav = navigator.language.slice(0, 2)
    if (SUPPORTED_LOCALES.includes(nav as Locale)) return nav as Locale
  } catch { /* ignore */ }
  return 'fr'
}

export function t(key: string): string {
  const locale = useLocaleStore.getState().locale
  return TRANSLATIONS[locale]?.[key] ?? TRANSLATIONS.fr[key] ?? key
}

interface LocaleState { locale: Locale; setLocale: (l: Locale) => void }

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: detectLocale(),
  setLocale: (l) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('jurislink_locale', l)
      document.documentElement.dir = RTL_LOCALES.has(l) ? 'rtl' : 'ltr'
      document.documentElement.lang = l
    }
    set({ locale: l })
  },
}))

export const useLocale = () => useLocaleStore((s) => ({ locale: s.locale, setLocale: s.setLocale }))

if (typeof window !== 'undefined') {
  const initLocale = detectLocale()
  document.documentElement.dir = RTL_LOCALES.has(initLocale) ? 'rtl' : 'ltr'
  document.documentElement.lang = initLocale
}
