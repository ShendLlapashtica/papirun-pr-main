/**
 * Site-wide editable texts cached locally.
 * The source of truth is synced through the backend settings table.
 */

const STORAGE_KEY = 'papirun_site_texts';

const isBrowser = () => typeof window !== 'undefined';

export interface SiteTextOverrides {
  [path: string]: string; // e.g. "sq.hero.title1" → "Shtepia e"
}

export const loadSiteTexts = (): SiteTextOverrides => {
  if (!isBrowser()) return {};

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const saveSiteTexts = (texts: SiteTextOverrides) => {
  if (!isBrowser()) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(texts));
};

/** Flattens a nested translations object into dot-separated keys */
export const flattenTexts = (
  obj: Record<string, any>,
  prefix = ''
): Record<string, string> => {
  const result: Record<string, string> = {};
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      Object.assign(result, flattenTexts(obj[key], fullKey));
    } else {
      result[fullKey] = String(obj[key]);
    }
  }
  return result;
};

/** Sets a nested value in an object by dot-path */
export const setNestedValue = (obj: any, path: string, value: string) => {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
};

/** Human-readable labels for text keys (Albanian) */
export const textLabels: Record<string, string> = {
  'header.slogan': 'Header — Slogani',
  'header.phone': 'Header — Telefoni',
  'header.hours': 'Header — Orari',
  'header.address': 'Header — Adresa',
  'header.menu': 'Header — Menu (buton)',
  'header.order': 'Header — Porosi (buton)',
  'hero.badge': 'Hero — Badge',
  'hero.title1': 'Hero — Titulli 1',
  'hero.title2': 'Hero — Titulli 2',
  'hero.description': 'Hero — Pershkrimi',
  'hero.searchPlaceholder': 'Hero — Placeholder kerkimi',
  'hero.ctaButton': 'Hero — Butoni CTA',
  'categories.all': 'Kategoritë — Të Gjitha',
  'categories.salads': 'Kategoritë — Sallata',
  'categories.fajitas': 'Kategoritë — Fajita',
  'categories.sandwiches': 'Kategoritë — Sanduiçe',
  'categories.sides': 'Kategoritë — Supë & Ekstra',
  'menu.likes': 'Menu — Pelqime',
  'menu.reviews': 'Menu — Recensione',
  'menu.soldOut': 'Menu — Mbaroi',
  'menu.addToTray': 'Menu — Shto ne Shporte',
  'tray.title': 'Shporta — Titulli',
  'tray.items': 'Shporta — Artikuj',
  'tray.empty': 'Shporta — Bosh',
  'tray.emptySubtext': 'Shporta — Nenteksti bosh',
  'tray.total': 'Shporta — Totali',
  'tray.checkout': 'Shporta — Porosit',
  'reviews.title': 'Recensione — Titulli',
  'reviews.subtitle': 'Recensione — Nentitulli',
  'location.title': 'Lokacioni — Titulli',
  'location.subtitle': 'Lokacioni — Nentitulli',
  'location.visitUs': 'Lokacioni — Na Vizitoni',
  'location.callUs': 'Lokacioni — Na Telefononi',
  'location.openHours': 'Lokacioni — Orari',
  'location.closed': 'Lokacioni — Mbyllur',
  'footer.rights': 'Footer — Të drejtat',
  'checkout.title': 'Porosia — Titulli',
  'checkout.orderSummary': 'Porosia — Permbledhja',
  'checkout.yourInfo': 'Porosia — Info juaja',
  'checkout.name': 'Porosia — Emri label',
  'checkout.namePlaceholder': 'Porosia — Emri placeholder',
  'checkout.phone': 'Porosia — Telefoni label',
  'checkout.phonePlaceholder': 'Porosia — Telefoni placeholder',
  'checkout.address': 'Porosia — Adresa label',
  'checkout.addressPlaceholder': 'Porosia — Adresa placeholder',
  'checkout.notes': 'Porosia — Shenime label',
  'checkout.notesPlaceholder': 'Porosia — Shenime placeholder',
  'checkout.orderViaWhatsapp': 'Porosia — WhatsApp buton',
  'checkout.total': 'Porosia — Totali',
};
