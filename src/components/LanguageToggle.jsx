import { useTranslation } from '@/i18n/I18nContext';

export default function LanguageToggle() {
  const { locale, setLocale } = useTranslation();
  const isAmharic = locale === 'am';

  return (
    <button
      onClick={() => setLocale(isAmharic ? 'en' : 'am')}
      className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-game-border text-xs font-bold text-game-muted hover:text-white hover:border-blue-500/40 transition-all"
      title={isAmharic ? 'Switch to English' : 'ወደ አማርኛ ቀይር'}
      aria-label="Toggle language"
    >
      <span className={!isAmharic ? 'text-white' : ''}>EN</span>
      <span className="text-game-border">|</span>
      <span className={isAmharic ? 'text-white' : ''}>አማ</span>
    </button>
  );
}
