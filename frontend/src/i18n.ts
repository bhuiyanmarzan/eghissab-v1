import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import bn from './locales/bn.json';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    showSupportNotice: false,
    fallbackLng: 'en',
    supportedLngs: ['en', 'bn'],
    load: 'languageOnly',
    nonExplicitSupportedLngs: true,
    keySeparator: false,
    nsSeparator: false,
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator', 'htmlTag'], caches: ['localStorage'] },
    resources: {
      en: { translation: Object.fromEntries(Object.keys(bn).map((key) => [key, key])) },
      bn: { translation: bn },
    },
  });
const syncLanguage = () => {
  document.documentElement.lang = i18n.resolvedLanguage || 'en';
};
i18n.on('languageChanged', syncLanguage);
syncLanguage();
export default i18n;
