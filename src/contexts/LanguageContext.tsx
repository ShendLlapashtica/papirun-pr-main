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
  offers: {
    title: string;
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
  auth: {
    signUp: string;
    logIn: string;
    stepNameTitle: string;
    stepNameHint: string;
    firstNamePlaceholder: string;
    lastNamePlaceholder: string;
    stepContactTitle: string;
    stepContactHint: string;
    phonePlaceholder: string;
    addressPlaceholder: string;
    stepEmailTitle: string;
    stepEmailHint: string;
    emailPlaceholder: string;
    sendCode: string;
    stepOtpTitle: string;
    sentTo: string;
    changeEmail: string;
    resend: string;
    verifying: string;
    back: string;
    next: string;
    nameRequired: string;
    phoneRequired: string;
    locationRequired: string;
    locationRequiredHint: string;
    invalidEmail: string;
    codeSent: string;
    invalidCode: string;
    maxSendsReached: string;
    codesUsed: string;
    welcome: string;
    haveAccount: string;
    noAccount: string;
    codeExpires: string;
    codeExpired: string;
    emailNotConfigured: string;
    sendFailed: string;
    greeting: string;
    logOut: string;
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
    offers: {
      title: 'Oferta',
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
      notes: 'Shenime Shtese per Adrese ose Faturim',
      notesPlaceholder: 'p.sh. Kati 3, dera djathtas...',
      orderViaWhatsapp: 'WhatsApp',
      orderViaViber: 'Viber',
      orderViaSms: 'SMS',
      total: 'Totali',
    },
    auth: {
      signUp: 'Regjistrohu',
      logIn: 'Kyçu',
      stepNameTitle: 'Cili është emri dhe mbiemri juaj?',
      stepNameHint: 'Do të shfaqet te porositë tuaja',
      firstNamePlaceholder: 'Emri',
      lastNamePlaceholder: 'Mbiemri',
      stepContactTitle: "Ku jetoni dhe si mund t'ju kontaktojmë?",
      stepContactHint: 'Klikoni hartën ose tërhiqni shënuesin',
      phonePlaceholder: '+383 4X XXX XXX',
      addressPlaceholder: 'Zgjidhni vendndodhjen në hartë',
      stepEmailTitle: 'Cila është adresa juaj e email-it?',
      stepEmailHint: "Do t'ju dërgojmë një kod 6-shifror",
      emailPlaceholder: 'emri@shembull.com',
      sendCode: 'Dërgo Kodin',
      stepOtpTitle: 'Shkruani kodin me 6 shifra që ju dërguam në Email:',
      sentTo: 'Dërguar te',
      changeEmail: 'Ndrysho emailin',
      resend: 'Rikërko Kodin',
      verifying: 'Po verifikohet…',
      back: 'Kthehu',
      next: 'Vazhdo',
      nameRequired: 'Shkruani emrin dhe mbiemrin',
      phoneRequired: 'Shkruani numrin e telefonit',
      locationRequired: 'Lokacioni i kërkuar',
      locationRequiredHint: 'Aktivizoni lokacionin GPS ose vendosni pinin në hartë.',
      invalidEmail: 'Shkruani një email të vlefshëm',
      codeSent: 'Kodi u dërgua në email',
      invalidCode: 'Kod i pasaktë. Provo përsëri.',
      maxSendsReached: 'Keni arritur limitin e kodeve. Provoni më vonë.',
      codesUsed: 'kode të dërguara',
      welcome: 'Mirë se erdhe!',
      haveAccount: 'Keni llogari?',
      noAccount: 'Nuk keni llogari?',
      codeExpires: 'Kodi skadon për 5 minuta',
      codeExpired: 'Kodi ka skaduar. Kërkoni një kod të ri.',
      emailNotConfigured: 'Shërbimi i email-it nuk është konfiguruar ende. Provoni më vonë.',
      sendFailed: 'Dërgimi i kodit dështoi. Provoni përsëri.',
      greeting: 'Përshëndetje',
      logOut: 'Dil',
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
    offers: {
      title: 'Offers',
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
    auth: {
      signUp: 'Sign Up',
      logIn: 'Log In',
      stepNameTitle: "What's your name and surname?",
      stepNameHint: 'Shown on your orders',
      firstNamePlaceholder: 'First name',
      lastNamePlaceholder: 'Last name',
      stepContactTitle: 'Where do you live & how can we reach you?',
      stepContactHint: 'Tap the map or drag the pin',
      phonePlaceholder: '+383 4X XXX XXX',
      addressPlaceholder: 'Select location on map',
      stepEmailTitle: "What's your email address?",
      stepEmailHint: "We'll send you a 6-digit code",
      emailPlaceholder: 'name@example.com',
      sendCode: 'Send Code',
      stepOtpTitle: 'Enter the 6-digit code we sent to your email:',
      sentTo: 'Sent to',
      changeEmail: 'Change email',
      resend: 'Resend Code',
      verifying: 'Verifying…',
      back: 'Back',
      next: 'Continue',
      nameRequired: 'Enter your first and last name',
      phoneRequired: 'Enter your phone number',
      locationRequired: 'Location required',
      locationRequiredHint: 'Enable GPS or place a pin on the map.',
      invalidEmail: 'Enter a valid email',
      codeSent: 'Code sent to your email',
      invalidCode: 'Invalid code. Try again.',
      maxSendsReached: 'You have reached the code limit. Try again later.',
      codesUsed: 'codes sent',
      welcome: 'Welcome!',
      haveAccount: 'Have an account?',
      noAccount: "Don't have an account?",
      codeExpires: 'Code expires in 5 minutes',
      codeExpired: 'Code expired. Request a new one.',
      emailNotConfigured: 'Email service is not configured yet. Try again later.',
      sendFailed: 'Sending the code failed. Try again.',
      greeting: 'Hi',
      logOut: 'Log out',
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
