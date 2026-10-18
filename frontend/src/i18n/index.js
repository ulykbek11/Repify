import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { en, ru } from './strings';

const STORAGE_KEY = 'repify.language';
const dictionaries = { en, ru };
export const LANGUAGES = ['en', 'ru'];

export function translate(language, key, params) {
  const text = dictionaries[language]?.[key] ?? en[key] ?? key;
  if (!params) return text;
  return text.replace(/\{\{(\w+)\}\}/g, (_, name) => String(params[name] ?? ''));
}

const LanguageContext = createContext({
  language: 'en',
  setLanguage: () => {},
  t: (key, params) => translate('en', key, params),
});

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState('en');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (LANGUAGES.includes(saved)) setLanguageState(saved);
    });
  }, []);

  const setLanguage = useCallback((next) => {
    if (!LANGUAGES.includes(next)) return;
    setLanguageState(next);
    AsyncStorage.setItem(STORAGE_KEY, next);
  }, []);

  const value = useMemo(
    () => ({ language, setLanguage, t: (key, params) => translate(language, key, params) }),
    [language, setLanguage]
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useLanguage = () => useContext(LanguageContext);
