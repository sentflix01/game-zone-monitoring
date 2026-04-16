import React, { createContext, useContext, useState } from 'react';
import en from './locales/en';
import am from './locales/am';

const dictionaries = { en, am };
const VALID_LOCALES = ['en', 'am'];
const STORAGE_KEY = 'gamezone_locale';

function readStoredLocale() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return VALID_LOCALES.includes(stored) ? stored : 'en';
  } catch {
    return 'en';
  }
}

export const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  // Read synchronously so there's no flash on first render
  const [locale, setLocaleState] = useState(() => readStoredLocale());

  const setLocale = (newLocale) => {
    if (!VALID_LOCALES.includes(newLocale)) return;
    try { localStorage.setItem(STORAGE_KEY, newLocale); } catch { /* private browsing */ }
    setLocaleState(newLocale);
  };

  const t = (key) => {
    const dict = dictionaries[locale];
    if (dict && key in dict) return dict[key];
    if (en && key in en) return en[key];
    return key;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useTranslation must be used within I18nProvider');
  return ctx;
}
