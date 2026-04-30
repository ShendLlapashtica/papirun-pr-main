import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { loadSiteTexts, saveSiteTexts, setNestedValue } from '@/lib/siteTexts';
import {
  SITE_TEXTS_SETTING_KEY,
  ensureStorefrontSetting,
  fetchStorefrontSetting,
  subscribeStorefrontSettingsRealtime,
} from '@/lib/storefrontApi';

type Language = 'sq' | 'en';

interface Translations {
  header: {
    slogan: string;
    phone: string;
    hours: string;
    address: string;
    menu: string;
    contact: string;
    order: string;
  };
  hero: {
    badge: string;
    title1: string;
    title2: string;
    description: string;
    searchPlaceholder: string;
    ctaButton: string;
  };
  categories: {
    all: string;
    salads: string;
    fajitas: string;
    sandwiches: string;
    sides: string;
  };
  menu: {
    likes: string;
    reviews: string;
    soldOut: string;
    addToTray: string;
  };
  tray: {
    title: string;
    items: string;
    empty: string;
    emptySubtext: string;
    total: string;
    checkout: string;
  };
  reviews: {
    title: string;
    subtitle: string;
  };
  location: {
    title: string;
    subtitle: string;
    visitUs: string;
    callUs: string;
    openHours: string;
    closed: string;
  };
  footer: {
    rights: string;
  };
  checkout: {
    title: string;
    orderSummary: string;
    yourInfo: string;
    name: string;
    namePlaceholder: string;
    phone: string;
    phonePlaceholder: string;
    address: string;
    addressPlaceholder: string;
    notes: string;
    notesPlaceholder: string;
    orderViaWhatsapp: string;
    orderViaViber: string;
    orderViaSms: string;
    total: string;
  };
}

const translations: Record<Language, Translations> = {
  sq: {
    header: {
      slogan: 'House of Crunch!',
      phone: '(045/048) 26 23 23',
      hours: 'E Hene - E Shtune: 07:00-19:00',
      address: 'Johan V. Hahn, Nr.14',
      menu: 'Menu',
      contact: 'Kontakt',
      order: 'Porosi',
    },
    hero: {
      badge: 'Ushqimi i Shendetshëm me i Mirë ne Prishtinë',
      title1: 'Shtepia e',
      title2: 'Papirun!',
      description: 'I fresket, krokant dhe i shijshëm. Porositni sallatat, fajitat dhe ushqimet tuaja te preferuara krokante ne pak sekonda.',
      searchPlaceholder: 'Kerko produktet...',
      ctaButton: 'Shiko Menunë',
    },
    categories: {
      all: 'Te Gjitha',
      salads: 'Sallata',
      fajitas: 'Fajita',
      sandwiches: 'Sanduiçe',
      sides: 'Supë & Ekstra',
    },
    menu: {
      likes: 'pelqime',
      reviews: 'recensione',
      soldOut: 'Mbaroi',
      addToTray: 'Shto ne Shporte',
    },
    tray: {
      title: 'Shporta Ime',
      items: 'artikuj',
      empty: 'Shporta juaj eshte bosh',
      emptySubtext: 'Shtoni dicka te shijshme!',
      total: 'Totali',
      checkout: 'Porosit',
    },
    reviews: {
      title: 'Çfare thonë klientet tanë',
      subtitle: 'Recensione nga dashamirësit e Papirun',
    },
    location: {
      title: 'Gjeni Papirun',
      subtitle: 'Na vizitoni ne Prishtine',
      visitUs: 'Na Vizitoni',
      callUs: 'Na Telefononi',
      openHours: 'Orari i Punes',
      closed: 'E Diel: Mbyllur',
    },
    footer: {
      rights: 'Te gjitha te drejtat e rezervuara.',
    },
    checkout: {
      title: 'Perfundoni Porosine',
      orderSummary: 'Permbledhja e Porosise',
      yourInfo: 'Informacionet Tuaja',
      name: 'Emri dhe Mbiemri',
      namePlaceholder: 'Shkruani emrin dhe mbiemrin tuaj',
      phone: 'Numri i Telefonit',
      phonePlaceholder: '+383 4X XXX XXX',
      address: 'Adresa e Dergeses',
      addressPlaceholder: 'Rruga, Numri, Qyteti',
      notes: 'Shenime (opsionale)',
      notesPlaceholder: 'Instruksione speciale...',
      orderViaWhatsapp: 'WhatsApp',
      orderViaViber: 'Viber',
      orderViaSms: 'SMS',
      total: 'Totali',
    },
  },
  en: {
    header: {
      slogan: 'House of Crunch!',
      phone: '(045/048) 26 23 23',
      hours: 'Mon - Sat: 07:00-19:00',
      address: 'Johan V. Hahn, Nr.14',
      menu: 'Menu',
      contact: 'Contact',
      order: 'Order',
    },
    hero: {
      badge: 'Best Healthy Fast Food in Pristina',
      title1: 'House of',
      title2: 'Papirun!',
      description: 'Fresh, crunchy, and delicious. Order your favorite salads, fajitas, and crispy treats in seconds.',
      searchPlaceholder: 'Search products...',
      ctaButton: 'View Menu',
    },
    categories: {
      all: 'All Items',
      salads: 'Salads',
      fajitas: 'Fajitas',
      sandwiches: 'Sandwiches',
      sides: 'Soup & Extras',
    },
    menu: {
      likes: 'likes',
      reviews: 'reviews',
      soldOut: 'Sold Out',
      addToTray: 'Add to Cart',
    },
    tray: {
      title: 'My Cart',
      items: 'items',
      empty: 'Your cart is empty',
      emptySubtext: 'Add some crunchy goodness!',
      total: 'Total',
      checkout: 'Checkout',
    },
    reviews: {
      title: 'What Our Customers Say',
      subtitle: 'Real reviews from Papirun lovers',
    },
    location: {
      title: 'Find Papirun',
      subtitle: 'Visit us in Pristina',
      visitUs: 'Visit Us',
      callUs: 'Call Us',
      openHours: 'Opening Hours',
      closed: 'Sunday: Closed',
    },
    footer: {
      rights: 'All rights reserved.',
    },
    checkout: {
      title: 'Complete Your Order',
      orderSummary: 'Order Summary',
      yourInfo: 'Your Information',
      name: 'Name and Surname',
      namePlaceholder: 'Enter your name and surname',
      phone: 'Phone Number',
      phonePlaceholder: '+383 4X XXX XXX',
      address: 'Delivery Address',
      addressPlaceholder: 'Street, Number, City',
      notes: 'Notes (optional)',
      notesPlaceholder: 'Special instructions...',
      orderViaWhatsapp: 'WhatsApp',
      orderViaViber: 'Viber',
      orderViaSms: 'SMS',
      total: 'Total',
    },
  },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
  refreshTexts: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const applyOverrides = (
  base: Translations,
  lang: Language,
  overrides: Record<string, string>,
): Translations => {
  const result = JSON.parse(JSON.stringify(base)) as Translations;
  for (const [path, value] of Object.entries(overrides)) {
    if (path.startsWith(`${lang}.`)) {
      setNestedValue(result, path.slice(lang.length + 1), value);
    }
  }
  return result;
};

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguage] = useState<Language>('sq');
  const [version, setVersion] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, string>>(() => loadSiteTexts());

  const refreshTexts = useCallback(() => {
    setOverrides(loadSiteTexts());
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const syncOverrides = async () => {
      try {
        const cached = loadSiteTexts();
        await ensureStorefrontSetting(SITE_TEXTS_SETTING_KEY, cached);
        const latest = await fetchStorefrontSetting<Record<string, string>>(SITE_TEXTS_SETTING_KEY, cached);

        if (!isMounted) return;

        saveSiteTexts(latest);
        setOverrides(latest);
      } catch {
        if (isMounted) {
          setOverrides(loadSiteTexts());
        }
      }
    };

    syncOverrides();
    const unsubscribe = subscribeStorefrontSettingsRealtime(syncOverrides);

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const t = React.useMemo(
    () => applyOverrides(translations[language], language, overrides),
    [language, overrides, version]
  );

  const value = { language, setLanguage, t, refreshTexts };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export { translations };
export type { Translations, Language };
