import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../store/authStore';
import { supabase } from '../../lib/supabase';
import i18n from '../../i18n';

const languages = [
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'sw', name: 'Kiswahili', flag: '🇰🇪' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' }
];

export const LanguageSelector: React.FC = () => {
  const { profile } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const currentLang = languages.find(l => l.code === i18n.language) || languages[0];

  const handleLanguageChange = async (langCode: string) => {
    // Update local i18n
    i18n.changeLanguage(langCode);
    document.documentElement.dir = langCode === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = langCode;
    
    setIsOpen(false);

    // Persist to profile if logged in
    if (profile?.id) {
      await supabase
        .from('users')
        .update({ preferred_language: langCode })
        .eq('id', profile.id);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          background: 'hsla(var(--text-muted), 0.1)',
          border: 'none',
          borderRadius: '50%',
          width: '38px',
          height: '38px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          fontSize: '1.2rem'
        }}
        className="hover-scale"
        title="Changer de langue"
      >
        {currentLang.flag}
      </button>

      {isOpen && (
        <>
          <div 
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} 
            onClick={() => setIsOpen(false)} 
          />
          <div className="glass-card animate-fade-in" style={{
            position: 'absolute',
            top: '120%',
            right: 0,
            minWidth: '160px',
            zIndex: 1000,
            padding: '0.5rem',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3)',
            border: '1px solid hsla(var(--text-muted), 0.2)'
          }}>
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: 'none',
                  background: i18n.language === lang.code ? 'hsla(var(--primary), 0.1)' : 'transparent',
                  color: i18n.language === lang.code ? 'hsl(var(--primary))' : 'hsl(var(--text-main))',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  textAlign: 'left',
                  fontSize: '0.9rem',
                  fontWeight: i18n.language === lang.code ? 600 : 400
                }}
                className="nav-item"
              >
                <span style={{ fontSize: '1.2rem' }}>{lang.flag}</span>
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
