import { useState, useRef, useEffect, useCallback, Component, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Lock, LogOut, Save, Eye, EyeOff, Upload, Package, Plus, Trash2, Image, ToggleLeft, ToggleRight, X, Check, ChevronUp, ChevronDown, Type, Phone, Edit2, HardDrive, RefreshCw, AlertTriangle, Map, KeyRound, Bell, Moon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchDrivers, createDriver, updateDriver, deleteDriver, ensureRealDrivers, subscribeAllDriverLocations, haversineKm, RESTAURANT_COORDS, type DeliveryDriver } from '@/lib/driversApi';
import DriverLocationMap from '@/components/DriverLocationMap';
import { menuItems as initialMenuItems, ofertaRamazani as initialOffers } from '@/data/menuData';
import { defaultMenuExtras } from '@/data/menuExtras';
import { getIngredientName } from '@/data/ingredientTranslations';
import type { MenuItem } from '@/types/menu';
import type { MenuExtra } from '@/types/menuExtra';
import {
  OFFERS_SECTION_ENABLED_KEY,
  OFFER_BADGE_TEXT_KEY,
  DEFAULT_OFFER_BADGE_TEXT,
  SITE_TEXTS_SETTING_KEY,
  WHATSAPP_FALLBACK_KEY,
  CATEGORY_ORDER_KEY,
  DEFAULT_CATEGORY_ORDER,
  CAGLLAVICE_UNAVAILABLE_KEY,
  DEFAULT_CAGLLAVICE_UNAVAILABLE,
  type StorefrontOffer,
  deleteStorefrontOffer,
  deleteMenuExtra,
  deleteProduct,
  diffMenuItem,
  ensureStorefrontSetting,
  fetchMenuExtras,
  fetchProductById,
  fetchStorefrontOffers,
  fetchStorefrontSetting,
  handleUpdateProduct,
  handleUpdateStorefrontOffer,
  subscribeMenuExtrasRealtime,
  subscribeStorefrontOffersRealtime,
  subscribeStorefrontSettingsRealtime,
  upsertMenuExtra,
  upsertProduct,
  upsertStorefrontOffer,
  upsertStorefrontSetting,
  uploadProductImage,
  addStorefrontOfferImage,
  removeStorefrontOfferImage,
  updateProductSortOrder,
} from '@/lib/productsApi';
import { getOptimizedImage } from '@/lib/utils';
import { compressImage } from '@/lib/imageUtils';
import { useLanguage, translations } from '@/contexts/LanguageContext';

import type { Language } from '@/contexts/LanguageContext';
import Header from '@/components/Header';
import { useLiveMenuItems } from '@/hooks/useLiveStorefrontData';
import type { SiteTextOverrides } from '@/lib/siteTexts';
import { loadSiteTexts, saveSiteTexts, flattenTexts, textLabels } from '@/lib/siteTexts';
import OrdersReview from '@/components/admin/OrdersReview';
import LocationsEditor from '@/components/admin/LocationsEditor';
import QuickRepliesEditor from '@/components/admin/QuickRepliesEditor';
import SubscribersList from '@/components/admin/SubscribersList';
import DriversKPI from '@/components/admin/DriversKPI';

const SiteTextsEditor = ({ language }: { language: Language }) => {
  const { refreshTexts } = useLanguage();
  const [editLang, setEditLang] = useState<Language>('sq');
  const [overrides, setOverrides] = useState(() => loadSiteTexts());
  const baseTexts = flattenTexts(translations[editLang]);

  useEffect(() => {
    let isMounted = true;

    const syncOverrides = async () => {
      try {
        const cached = loadSiteTexts();
        await ensureStorefrontSetting(SITE_TEXTS_SETTING_KEY, cached);
        const latest = await fetchStorefrontSetting<SiteTextOverrides>(SITE_TEXTS_SETTING_KEY, cached);

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

  const getValue = (key: string) => {
    const fullKey = `${editLang}.${key}`;
    return overrides[fullKey] ?? baseTexts[key] ?? '';
  };

  const handleChange = (key: string, value: string) => {
    const fullKey = `${editLang}.${key}`;
    const updated = { ...overrides, [fullKey]: value };
    // If value matches default, remove override
    if (value === baseTexts[key]) {
      delete updated[fullKey];
    }
    setOverrides(updated);
  };

  const handleSave = async () => {
    saveSiteTexts(overrides);
    await upsertStorefrontSetting(SITE_TEXTS_SETTING_KEY, overrides);
    refreshTexts();
  };

  // Group keys by section
  const sections: Record<string, string[]> = {};
  for (const key of Object.keys(textLabels)) {
    const section = key.split('.')[0];
    if (!sections[section]) sections[section] = [];
    sections[section].push(key);
  }

  const sectionNames: Record<string, string> = {
    header: 'Header',
    hero: 'Hero',
    categories: 'Kategoritë',
    menu: 'Menu',
    tray: 'Shporta',
    reviews: 'Recensionet',
    location: 'Lokacioni',
    footer: 'Footer',
    checkout: 'Porosia / Checkout',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['sq', 'en'] as const).map((l) => (
            <button
              key={l}
              onClick={() => setEditLang(l)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                editLang === l ? 'bg-primary text-primary-foreground' : 'bg-secondary'
              }`}
            >
              {l === 'sq' ? 'Shqip' : 'English'}
            </button>
          ))}
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-medium"
        >
          <Save className="w-4 h-4" />
          {language === 'sq' ? 'Ruaj Tekstet' : 'Save Texts'}
        </button>
      </div>

      {Object.entries(sections).map(([section, keys]) => (
        <div key={section} className="bg-card rounded-2xl p-4 shadow-card space-y-3">
          <h3 className="font-display font-bold text-sm text-primary">
            {sectionNames[section] || section}
          </h3>
          {keys.map((key) => {
            const isOverridden = `${editLang}.${key}` in overrides;
            return (
              <div key={key}>
                <label className="text-xs text-muted-foreground dark:text-slate-400 flex items-center gap-1.5">
                  {textLabels[key]}
                  {isOverridden && <span className="text-[10px] text-primary font-medium">(ndryshuar)</span>}
                </label>
                <input
                  value={getValue(key)}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border-0 text-sm focus:ring-2 focus:ring-primary/20 transition-all dark:text-white dark:placeholder:text-slate-500 ${
                    isOverridden ? 'bg-primary/5 ring-1 ring-primary/20' : 'bg-secondary'
                  }`}
                />
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

type AdminProfile = 'qendra' | 'cagllavice';

const profileFromEmail = (email: string): AdminProfile => {
  const username = email.split('@')[0].toLowerCase();
  return username === 'cagllavice' ? 'cagllavice' : 'qendra';
};

// ---- Drivers Manager ----
const DriversManager = () => {
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showPinFor, setShowPinFor] = useState<Set<string>>(new Set());
  const [editForm, setEditForm] = useState<{ name: string; phone: string; pin: string }>({ name: '', phone: '', pin: '' });
  const [addMode, setAddMode] = useState(false);
  const [newForm, setNewForm] = useState({ name: '', phone: '', pin: 'Pass123.' });
  const [confirmDeleteDriverId, setConfirmDeleteDriverId] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    fetchDrivers().then((d) => { setDrivers(d); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => {
    ensureRealDrivers().catch(() => {}).finally(reload);
    // Real-time: refresh drivers when any location update comes in
    const unsub = subscribeAllDriverLocations(reload);
    return unsub;
  }, []);

  const togglePin = (id: string) => {
    setShowPinFor((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const startEdit = (d: DeliveryDriver) => {
    setEditingId(d.id);
    setEditForm({ name: d.name, phone: d.phone, pin: d.pin });
  };

  const saveEdit = async (id: string) => {
    try {
      await updateDriver(id, { name: editForm.name, phone: editForm.phone, pin: editForm.pin });
      setEditingId(null);
      reload();
    } catch (err: any) { toast.error('Gabim: ' + (err?.message ?? 'Nuk u ruajt')); }
  };

  const toggleActive = async (d: DeliveryDriver) => {
    try { await updateDriver(d.id, { isActive: !d.isActive }); reload(); } catch {}
  };

  const handleDelete = async (id: string) => {
    try { await deleteDriver(id); reload(); } catch {}
    setConfirmDeleteDriverId(null);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.name.trim()) return;
    try {
      await createDriver(newForm.name.trim(), newForm.phone.trim(), newForm.pin.trim() || 'Pass123.');
      setNewForm({ name: '', phone: '', pin: 'Pass123.' });
      setAddMode(false);
      reload();
      toast.success('Shoferi u shtua');
    } catch (err: any) {
      toast.error('Gabim: ' + (err?.message ?? 'Shoferi nuk u shtua'));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-lg">Menaxhimi i Shoferëve</h3>
        <button
          onClick={() => setAddMode((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Shto Shofer
        </button>
      </div>

      {addMode && (
        <form onSubmit={handleAdd} className="bg-card rounded-2xl p-4 shadow-card space-y-3 border border-blue-500/20">
          <p className="text-sm font-semibold text-blue-600">Shofer i Ri</p>
          <div className="grid grid-cols-3 gap-2">
            <input value={newForm.name} onChange={(e) => setNewForm((p) => ({ ...p, name: e.target.value }))} placeholder="Emri (Delivery4)" className="px-3 py-2 rounded-lg bg-secondary text-foreground text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none" />
            <input value={newForm.phone} onChange={(e) => setNewForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Telefon (opsional)" className="px-3 py-2 rounded-lg bg-secondary text-foreground text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none" />
            <input value={newForm.pin} onChange={(e) => setNewForm((p) => ({ ...p, pin: e.target.value }))} placeholder="Fjalëkalimi" className="px-3 py-2 rounded-lg bg-secondary text-foreground text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">Shto</button>
            <button type="button" onClick={() => setAddMode(false)} className="px-4 py-2 rounded-full bg-secondary text-sm font-semibold">Anulo</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Duke ngarkuar…</p>
      ) : drivers.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Nuk ka shoferë. Shto njërin me butonin lart.</p>
      ) : (
        <div className="space-y-2">
          {drivers.filter((d) => d.isActive).map((d) => (
            <div key={d.id} className={`bg-card rounded-2xl p-4 shadow-card border border-border/40 transition-opacity ${!d.isActive ? 'opacity-60' : ''}`}>
              {editingId === d.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} placeholder="Emri" className="px-3 py-2 rounded-lg bg-secondary text-foreground text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none" />
                    <input value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Telefon" className="px-3 py-2 rounded-lg bg-secondary text-foreground text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none" />
                    <input value={editForm.pin} onChange={(e) => setEditForm((p) => ({ ...p, pin: e.target.value }))} placeholder="Fjalëkalimi" className="px-3 py-2 rounded-lg bg-secondary text-foreground text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20 focus:outline-none" />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveEdit(d.id)} className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold flex items-center gap-1"><Save className="w-3.5 h-3.5" /> Ruaj</button>
                    <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded-full bg-secondary text-sm font-semibold">Anulo</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm text-white"
                    style={{ background: d.color || '#3b82f6' }}
                  >
                    {d.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-foreground">{d.name}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${d.isActive ? 'bg-emerald-500/15 text-emerald-600' : 'bg-secondary text-muted-foreground'}`}>
                        {d.isActive ? 'Aktiv' : 'Jo aktiv'}
                      </span>
                    </div>
                    {d.phone && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground font-mono">{d.phone}</span>
                        <a
                          href={`tel:${d.phone}`}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold hover:bg-emerald-600 active:scale-95 transition-all shadow-sm shadow-emerald-500/30"
                          title={`Thirr ${d.name}`}
                        >
                          <Phone className="w-3 h-3" strokeWidth={2.5} />
                          Thirr
                        </a>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] text-muted-foreground font-medium">PIN:</span>
                      <span className="text-xs font-mono bg-secondary/60 px-2 py-0.5 rounded-md">
                        {showPinFor.has(d.id) ? d.pin : '••••••'}
                      </span>
                      <button onClick={() => togglePin(d.id)} className="p-1 rounded hover:bg-secondary transition-colors">
                        {showPinFor.has(d.id) ? <EyeOff className="w-3 h-3 text-muted-foreground" /> : <Eye className="w-3 h-3 text-muted-foreground" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => toggleActive(d)} className={`text-[10px] font-bold px-2.5 py-1.5 rounded-full transition-all ${d.isActive ? 'bg-secondary hover:bg-red-500/10 hover:text-red-600' : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'}`}>
                      {d.isActive ? 'Çaktivizo' : 'Aktivizo'}
                    </button>
                    <button onClick={() => startEdit(d)} className="p-2 rounded-full hover:bg-secondary transition-colors text-muted-foreground" title="Ndrysho">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    {confirmDeleteDriverId === d.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(d.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-destructive text-white text-[10px] font-bold animate-pulse"
                        >
                          <AlertTriangle className="w-3 h-3" /> Konfirmo fshirjen
                        </button>
                        <button onClick={() => setConfirmDeleteDriverId(null)} className="p-1.5 rounded-full bg-secondary">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteDriverId(d.id)} className="p-2 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground/60" title="Fshij">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Map at bottom */}
      <DriverLocationMap drivers={drivers} height="340px" allowFullscreen />
    </div>
  );
};

const LOCAL_ASSETS = [
  // Reviews → JPEG
  { path: 'src/assets/reviews/review-marigona-2.jpg', size: 114317, category: 'reviews' as const, usedIn: 'ReviewsSection', thumb: new URL('../assets/reviews/review-marigona-2.jpg', import.meta.url).href },
  { path: 'src/assets/reviews/review-marigona-1.jpg', size:  81478, category: 'reviews' as const, usedIn: 'ReviewsSection', thumb: new URL('../assets/reviews/review-marigona-1.jpg', import.meta.url).href },
  { path: 'src/assets/reviews/review-sara.jpg',       size: 129563, category: 'reviews' as const, usedIn: 'ReviewsSection', thumb: new URL('../assets/reviews/review-sara.jpg', import.meta.url).href },
  { path: 'src/assets/reviews/review-photo-1.jpg',    size: 132915, category: 'reviews' as const, usedIn: 'ReviewsSection', thumb: new URL('../assets/reviews/review-photo-1.jpg', import.meta.url).href },
  // Hero → JPEG
  { path: 'src/assets/hero-bg-new.jpg',               size:  72210, category: 'branding' as const, usedIn: 'HeroSection',   thumb: new URL('../assets/hero-bg-new.jpg', import.meta.url).href },
  // Menu PNGs
  { path: 'src/assets/menu/grill-chicken-salad.png',  size: 152492, category: 'menu' as const, usedIn: 'Të gjitha', thumb: new URL('../assets/menu/grill-chicken-salad.png', import.meta.url).href },
  { path: 'src/assets/menu/falafel.png',              size: 155220, category: 'menu' as const, usedIn: 'Të gjitha', thumb: new URL('../assets/menu/falafel.png', import.meta.url).href },
  { path: 'src/assets/menu/cold-chicken-salad.png',   size: 141270, category: 'menu' as const, usedIn: 'Të gjitha', thumb: new URL('../assets/menu/cold-chicken-salad.png', import.meta.url).href },
  { path: 'src/assets/menu/grill-chicken-fajita.png', size: 132184, category: 'menu' as const, usedIn: 'Të gjitha', thumb: new URL('../assets/menu/grill-chicken-fajita.png', import.meta.url).href },
  { path: 'src/assets/menu/falafel-fajita.png',       size: 132492, category: 'menu' as const, usedIn: 'Të gjitha', thumb: new URL('../assets/menu/falafel-fajita.png', import.meta.url).href },
  { path: 'src/assets/menu/beef-salad.png',           size: 127464, category: 'menu' as const, usedIn: 'Të gjitha', thumb: new URL('../assets/menu/beef-salad.png', import.meta.url).href },
  { path: 'src/assets/menu/crunchy-sticks.png',       size:  89837, category: 'menu' as const, usedIn: 'Të gjitha', thumb: new URL('../assets/menu/crunchy-sticks.png', import.meta.url).href },
  { path: 'src/assets/menu/super-mix-salad.png',      size:  89747, category: 'menu' as const, usedIn: 'Të gjitha', thumb: new URL('../assets/menu/super-mix-salad.png', import.meta.url).href },
  { path: 'src/assets/menu/salad-mix.png',            size:  86687, category: 'menu' as const, usedIn: 'Të gjitha', thumb: new URL('../assets/menu/salad-mix.png', import.meta.url).href },
  { path: 'src/assets/menu/chicken-pesto.png',        size:  51752, category: 'menu' as const, usedIn: 'Të gjitha', thumb: new URL('../assets/menu/chicken-pesto.png', import.meta.url).href },
  { path: 'src/assets/menu/tuna.png',                 size:  49065, category: 'menu' as const, usedIn: 'Të gjitha', thumb: new URL('../assets/menu/tuna.png', import.meta.url).href },
  { path: 'src/assets/menu/roast-beef.png',           size:  48695, category: 'menu' as const, usedIn: 'Të gjitha', thumb: new URL('../assets/menu/roast-beef.png', import.meta.url).href },
  { path: 'src/assets/menu/veggie.png',               size:  48679, category: 'menu' as const, usedIn: 'Të gjitha', thumb: new URL('../assets/menu/veggie.png', import.meta.url).href },
  { path: 'src/assets/menu/mozzarella.png',           size:  47619, category: 'menu' as const, usedIn: 'Të gjitha', thumb: new URL('../assets/menu/mozzarella.png', import.meta.url).href },
  { path: 'src/assets/menu/cold-chicken.png',         size:  47996, category: 'menu' as const, usedIn: 'Të gjitha', thumb: new URL('../assets/menu/cold-chicken.png', import.meta.url).href },
  // Branding
  { path: 'src/assets/logo.png', size: 2767, category: 'branding' as const, usedIn: 'Header', thumb: new URL('../assets/logo.png', import.meta.url).href },
  // Public (no thumb — not Vite-bundled)
  { path: 'public/favicon.ico',    size: 46850, category: 'public' as const, usedIn: 'Browser tab',    thumb: null },
  { path: 'public/placeholder.svg',size:  3253, category: 'public' as const, usedIn: 'Fallback images', thumb: null },
];

const LOCAL_ASSETS_TOTAL = LOCAL_ASSETS.reduce((s, f) => s + f.size, 0);

const CAT_STYLES = {
  reviews: { card: 'bg-rose-50 border border-rose-200',     label: 'text-rose-700',    badge: 'bg-rose-100 text-rose-700' },
  menu:    { card: 'bg-emerald-50 border border-emerald-200', label: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
  branding:{ card: 'bg-violet-50 border border-violet-200',  label: 'text-violet-700',  badge: 'bg-violet-100 text-violet-700' },
  public:  { card: 'bg-slate-50 border border-slate-200',    label: 'text-slate-700',   badge: 'bg-slate-100 text-slate-700' },
} as const;

class TabErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean; err: string }> {
  constructor(props: any) { super(props); this.state = { crashed: false, err: '' }; }
  static getDerivedStateFromError(e: Error) { return { crashed: true, err: e?.message ?? 'Gabim i panjohur' }; }
  render() {
    if (this.state.crashed) {
      return (
        <div className="rounded-2xl bg-destructive/10 border border-destructive/30 p-6 text-center space-y-3">
          <p className="font-bold text-destructive text-sm">Gabim gjatë ngarkimit</p>
          <p className="text-xs text-muted-foreground font-mono">{this.state.err}</p>
          <button
            onClick={() => this.setState({ crashed: false, err: '' })}
            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
          >
            Provo Përsëri
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const Admin = () => {
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const isAuthenticated = profile !== null;
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [error, setError] = useState('');
  const [loginChecking, setLoginChecking] = useState(false);
  const [items, setItems] = useState<MenuItem[]>(initialMenuItems);
  const [menuExtras, setMenuExtras] = useState<MenuExtra[]>(defaultMenuExtras);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [editSnapshot, setEditSnapshot] = useState<MenuItem | null>(null);
  const [editLoadingId, setEditLoadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'cagmenu' | 'extras' | 'content' | 'offers' | 'users' | 'drivers' | 'harta' | 'databaze'>('orders');
  const [typingCount, setTypingCount] = useState(0);
  const [unreadOrders, setUnreadOrders] = useState<Array<{ id: string; name: string; count: number; urgent: boolean }>>([]);
  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [adminTheme, setAdminTheme] = useState<'light' | 'dim' | 'dark'>(() => {
    try { return (localStorage.getItem('papirun_admin_theme') as 'light' | 'dim' | 'dark') || 'light'; } catch { return 'light'; }
  });
  const [contentSubTab, setContentSubTab] = useState<'texts' | 'locations' | 'replies'>('texts');
  const [ofertaEnabled, setOfertaEnabled] = useState(true);
  const [whatsappFallbackEnabled, setWhatsappFallbackEnabled] = useState(true);
  const [offerBadgeText, setOfferBadgeText] = useState(DEFAULT_OFFER_BADGE_TEXT);
  const [offerBadgeSaving, setOfferBadgeSaving] = useState(false);
  const [offers, setOffers] = useState<StorefrontOffer[]>(() =>
    initialOffers.map((offer, index) => ({ ...offer, isActive: true, sortOrder: index }))
  );
  const [editingOffer, setEditingOffer] = useState<string | null>(null);
  const [newIngredients, setNewIngredients] = useState<Record<string, string>>({});
  const [newExtras, setNewExtras] = useState<Record<string, string>>({});
  const [newExtraPrices, setNewExtraPrices] = useState<Record<string, string>>({});
  const [editingExtraId, setEditingExtraId] = useState<string | null>(null);
  const [newCatalogExtraNameSq, setNewCatalogExtraNameSq] = useState('');
  const [newCatalogExtraPrice, setNewCatalogExtraPrice] = useState('');
  // Category order
  const [catOrder, setCatOrder] = useState<string[]>(DEFAULT_CATEGORY_ORDER);
  useEffect(() => {
    fetchStorefrontSetting<string[]>(CATEGORY_ORDER_KEY, DEFAULT_CATEGORY_ORDER).then(setCatOrder).catch(() => {});
  }, []);

  // Product order counts — computed from order history, used to sort menu products by popularity
  const [productOrderCounts, setProductOrderCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (activeTab !== 'menu') return;
    if (items.length === 0) return;
    let cancelled = false;
    import('@/lib/ordersApi').then(({ fetchAllOrders }) => {
      fetchAllOrders().then((allOrders) => {
        if (cancelled) return;
        const counts: Record<string, number> = {};
        for (const order of allOrders) {
          for (const it of (order.items as any[])) {
            if (it.id) counts[it.id] = (counts[it.id] || 0) + (it.quantity ?? 1);
          }
        }
        setProductOrderCounts(counts);
      }).catch(() => {});
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const moveCat = async (idx: number, dir: 'up' | 'down') => {
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= catOrder.length) return;
    const next = [...catOrder];
    [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
    setCatOrder(next);
    await upsertStorefrontSetting(CATEGORY_ORDER_KEY, next);
  };

  // Exports the menu exactly as currently loaded in this admin session (live products,
  // extras, category order) to a CSV the user can download and keep as a manual backup.
  const csvCell = (value: unknown): string => {
    const s = Array.isArray(value) ? value.join(';') : String(value ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const handleExportMenuCsv = () => {
    const productColumns = ['id', 'name_sq', 'name_en', 'description_sq', 'description_en', 'price', 'image', 'category', 'ingredients', 'extras', 'crunchLevel', 'likes', 'rating', 'reviewCount', 'isAvailable'];
    const productRows = items.map((it) => [
      it.id, it.name.sq, it.name.en, it.description.sq, it.description.en, it.price,
      it.image, it.category, it.ingredients, it.extras, it.crunchLevel, it.likes,
      it.rating, it.reviewCount, it.isAvailable,
    ]);
    const productsCsv = [productColumns.join(','), ...productRows.map((row) => row.map(csvCell).join(','))].join('\n');

    const extraColumns = ['id', 'name_sq', 'name_en', 'price', 'isActive', 'sortOrder'];
    const extraRows = menuExtras.map((ex) => [ex.id, ex.name.sq, ex.name.en, ex.price, ex.isActive, ex.sortOrder]);
    const extrasCsv = [extraColumns.join(','), ...extraRows.map((row) => row.map(csvCell).join(','))].join('\n');

    const categoryOrderCsv = ['position,category', ...catOrder.map((cat, idx) => `${idx},${csvCell(cat)}`)].join('\n');

    const csv = [
      `# Menu export — ${new Date().toISOString()}`,
      '',
      '## products',
      productsCsv,
      '',
      '## menu_extras',
      extrasCsv,
      '',
      '## category_order',
      categoryOrderCsv,
      '',
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `menu-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Wizard state for adding new products
  const [showAddWizard, setShowAddWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [wizardCategory, setWizardCategory] = useState<MenuItem['category']>('sandwich');
  const [wizardNameSq, setWizardNameSq] = useState('');
  const [wizardNameEn, setWizardNameEn] = useState('');
  const [wizardPrice, setWizardPrice] = useState('');
  const offerFileRef = useRef<HTMLInputElement>(null);
  const [uploadingOfferId, setUploadingOfferId] = useState<string | null>(null);
  const [dragOverOfferId, setDragOverOfferId] = useState<string | null>(null);
  const [deletingOfferImageKey, setDeletingOfferImageKey] = useState<string | null>(null);
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<string | null>(null);
  const [confirmDeleteOfferId, setConfirmDeleteOfferId] = useState<string | null>(null);

  // Change-password modal
  const [showChangePw, setShowChangePw] = useState(false);
  const [changePwCurrent, setChangePwCurrent] = useState('');
  const [changePwNew, setChangePwNew] = useState('');
  const [changePwConfirm, setChangePwConfirm] = useState('');
  const [changePwError, setChangePwError] = useState('');
  const [changePwLoading, setChangePwLoading] = useState(false);

  // Harta tab — live driver list
  const [hartaDrivers, setHartaDrivers] = useState<DeliveryDriver[]>([]);
  useEffect(() => {
    if (activeTab !== 'harta') return;
    const refresh = () => fetchDrivers().then(setHartaDrivers).catch(console.error);
    refresh();
    const unsub = subscribeAllDriverLocations(refresh);
    const poll = setInterval(refresh, 5000);
    return () => { unsub(); clearInterval(poll); };
  }, [activeTab]);

  // Databaze tab state
  type StorageFile = { name: string; path: string; size: number; publicUrl: string };
  const [dbImages, setDbImages] = useState<StorageFile[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [confirmDeleteStoragePath, setConfirmDeleteStoragePath] = useState<string | null>(null);
  const [replacingPath, setReplacingPath] = useState<string | null>(null);
  const [dbSubTab, setDbSubTab] = useState<'storage' | 'local' | 'content'>('storage');
  const dbReplaceRef = useRef<HTMLInputElement>(null);
  const { language } = useLanguage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);

  // Sync profile from Supabase Auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) setProfile(profileFromEmail(session.user.email));
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.email) {
        setProfile(profileFromEmail(session.user.email));
      } else {
        setProfile(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const { items: liveItems } = useLiveMenuItems();

  useEffect(() => {
    setItems(prev =>
      liveItems.map(live =>
        live.id === editingItem
          ? (prev.find(p => p.id === live.id) ?? live)
          : live
      )
    );
  }, [liveItems, editingItem]);

  // Sync menuExtras from DB
  useEffect(() => {
    let isMounted = true;
    const syncExtras = async () => {
      try {
        const liveExtras = await fetchMenuExtras();
        if (isMounted) setMenuExtras(liveExtras);
      } catch { /* keep defaults */ }
    };
    syncExtras();
    const unsub = subscribeMenuExtrasRealtime(syncExtras);
    return () => { isMounted = false; unsub(); };
  }, []);

  useEffect(() => {
    let isMounted = true;

    const syncOffers = async () => {
      try {
        const nextOffers = await fetchStorefrontOffers();
        if (isMounted) setOffers(nextOffers);
      } catch (error) {
        console.error('Failed to sync offers:', error);
      }
    };

    const syncOfertaEnabled = async () => {
      try {
        await ensureStorefrontSetting(OFFERS_SECTION_ENABLED_KEY, true);
        const nextValue = await fetchStorefrontSetting<boolean>(OFFERS_SECTION_ENABLED_KEY, true);
        if (isMounted) setOfertaEnabled(nextValue);
      } catch (error) {
        console.error('Failed to sync offer section setting:', error);
      }
    };

    const syncOfferBadgeText = async () => {
      try {
        const val = await fetchStorefrontSetting<string>(OFFER_BADGE_TEXT_KEY, DEFAULT_OFFER_BADGE_TEXT);
        if (isMounted) setOfferBadgeText(val);
      } catch (error) {
        console.error('Failed to sync offer badge text:', error);
      }
    };

    const syncWhatsappFallback = async () => {
      try {
        await ensureStorefrontSetting(WHATSAPP_FALLBACK_KEY, true);
        const val = await fetchStorefrontSetting<boolean>(WHATSAPP_FALLBACK_KEY, true);
        if (isMounted) setWhatsappFallbackEnabled(val);
      } catch {}
    };

    syncOffers();
    syncOfertaEnabled();
    syncOfferBadgeText();
    syncWhatsappFallback();
    ensureRealDrivers().catch(() => {});

    const unsubscribeOffers = subscribeStorefrontOffersRealtime(syncOffers);
    const unsubscribeSettings = subscribeStorefrontSettingsRealtime(syncOfertaEnabled);

    return () => {
      isMounted = false;
      unsubscribeOffers();
      unsubscribeSettings();
    };
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const username = adminUsername.trim().toLowerCase();
    if (!username || !adminPassword) { setError('Plotëso të gjitha fushat'); return; }
    setLoginChecking(true);
    setError('');
    try {
      const email = `${username}@papirun.net`;
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password: adminPassword });
      if (authError) setError('Username ose fjalëkalim i gabuar');
    } catch {
      setError('Gabim gjatë kyçjes, provo përsëri');
    } finally {
      setLoginChecking(false);
    }
  };

  const handleChangePassword = async () => {
    if (!changePwNew || changePwNew.length < 6) {
      setChangePwError('Fjalëkalimi duhet të jetë të paktën 6 karaktere');
      return;
    }
    if (changePwNew !== changePwConfirm) {
      setChangePwError('Fjalëkalimet e reja nuk përputhen');
      return;
    }
    setChangePwLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) { setChangePwError('Sesioni ka skaduar'); return; }
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: session.user.email, password: changePwCurrent });
      if (verifyError) { setChangePwError('Fjalëkalimi aktual është i gabuar'); return; }
      const { error: updateError } = await supabase.auth.updateUser({ password: changePwNew });
      if (updateError) throw updateError;
      setShowChangePw(false);
      setChangePwCurrent(''); setChangePwNew(''); setChangePwConfirm(''); setChangePwError('');
      toast.success('Fjalëkalimi u ndryshua');
    } catch {
      setChangePwError('Gabim gjatë ruajtjes, provo përsëri');
    } finally {
      setChangePwLoading(false);
    }
  };

  const updateItem = (id: string, updates: Partial<MenuItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const handleUpdate = async (id: string, updates: Partial<MenuItem>) => {
    const previous = items.find((item) => item.id === id);
    updateItem(id, updates);
    try {
      await handleUpdateProduct(id, updates);
    } catch (updateError) {
      console.error('Failed to update product:', updateError);
      if (previous) updateItem(id, previous);
      throw updateError;
    }
  };

  // Always fetches the real DB row before opening the edit form, so a slow/uncompleted
  // background sync can never leave stale fallback data (e.g. a hardcoded "all extras"
  // list) frozen for the duration of the edit session.
  const beginEditItem = async (id: string) => {
    setEditLoadingId(id);
    try {
      const fresh = await fetchProductById(id);
      if (!fresh) {
        toast.error(language === 'sq' ? 'Produkti nuk u gjet' : 'Product not found');
        return;
      }
      setItems((prev) => prev.map((p) => (p.id === id ? fresh : p)));
      setEditSnapshot(fresh);
      setEditingItem(id);
    } catch (err) {
      console.error('Failed to load fresh product data before editing:', err);
      toast.error(language === 'sq' ? 'Nuk u ngarkuan të dhënat — provo përsëri' : 'Could not load latest data — try again');
    } finally {
      setEditLoadingId(null);
    }
  };

  const handleSaveItem = async (item: MenuItem) => {
    // Only write back fields that actually changed since the edit form opened — a field
    // the admin never touched can never be pushed to the DB, even if local state were
    // ever stale for some other reason.
    const patch = editSnapshot ? diffMenuItem(editSnapshot, item) : item;
    if (editSnapshot && Object.keys(patch).length === 0) {
      setEditingItem(null);
      setEditSnapshot(null);
      return;
    }
    try {
      if (editSnapshot) {
        await handleUpdateProduct(item.id, patch);
      } else {
        await upsertProduct(item);
      }
      setEditingItem(null);
      setEditSnapshot(null);
      toast.success(language === 'sq' ? 'U ruajt' : 'Saved');
    } catch (saveError) {
      console.error('Failed to save product:', saveError);
      toast.error(language === 'sq' ? 'Ruajtja dështoi — provo përsëri' : 'Save failed — try again');
    }
  };

  const toggleAvailability = async (id: string) => {
    const target = items.find((item) => item.id === id);
    if (!target) return;
    try {
      await handleUpdate(id, { isAvailable: !target.isAvailable });
    } catch {
      toast.error(language === 'sq' ? 'Ruajtja dështoi' : 'Save failed');
    }
  };

  const toggleCagllaviceAvailability = async (id: string) => {
    const target = items.find((item) => item.id === id);
    if (!target) return;
    const nextAvailable = !target.isAvailableOnCagllavice;
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, isAvailableOnCagllavice: nextAvailable } : it)));
    try {
      const current = await fetchStorefrontSetting<string[]>(CAGLLAVICE_UNAVAILABLE_KEY, DEFAULT_CAGLLAVICE_UNAVAILABLE);
      const next = nextAvailable ? current.filter((x) => x !== id) : [...current, id];
      await upsertStorefrontSetting(CAGLLAVICE_UNAVAILABLE_KEY, next);
    } catch {
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, isAvailableOnCagllavice: !nextAvailable } : it)));
      toast.error(language === 'sq' ? 'Ruajtja dështoi' : 'Save failed');
    }
  };

  const addNewItem = async (overrides?: Partial<MenuItem>) => {
    const newItem: MenuItem = {
      id: `new-${Date.now()}`,
      name: { sq: 'Produkt i Ri', en: 'New Product' },
      description: { sq: 'Pershkrimi...', en: 'Description...' },
      price: 0,
      image: '',
      category: 'salad',
      ingredients: [],
      extras: [],
      crunchLevel: 3,
      likes: 0,
      rating: 0,
      reviewCount: 0,
      isAvailable: true,
      isAvailableOnCagllavice: true,
      ...overrides,
    };
    setItems((prev) => [newItem, ...prev]);
    setEditSnapshot(newItem);
    setEditingItem(newItem.id);
    setEditLoadingId(newItem.id);
    try {
      await upsertProduct(newItem);
    } catch (err) {
      console.error('Failed to create new product in DB:', err);
      setItems((prev) => prev.filter((item) => item.id !== newItem.id));
      setEditingItem(null);
      setEditSnapshot(null);
      toast.error(language === 'sq' ? 'Krijimi dështoi' : 'Create failed');
    } finally {
      setEditLoadingId(null);
    }
  };

  const handleWizardSubmit = async () => {
    const nameSq = wizardNameSq.trim();
    const nameEn = wizardNameEn.trim() || nameSq;
    const price = parseFloat(wizardPrice) || 0;
    if (!nameSq) return;
    setShowAddWizard(false);
    setWizardStep(1);
    setWizardNameSq('');
    setWizardNameEn('');
    setWizardPrice('');
    await addNewItem({
      name: { sq: nameSq, en: nameEn },
      category: wizardCategory,
      price,
    });
  };

  const deleteItem = async (id: string) => {
    const removed = items.find((item) => item.id === id);
    setItems((prev) => prev.filter((item) => item.id !== id));
    try {
      await deleteProduct(id);
      toast.success(language === 'sq' ? 'U fshi' : 'Deleted');
    } catch (deleteError) {
      console.error('Failed to delete product:', deleteError);
      if (removed) setItems((prev) => [...prev, removed]);
      toast.error(language === 'sq' ? 'Fshirja dështoi' : 'Delete failed');
    }
  };

  const handleImageUpload = (id: string) => {
    setUploadingItemId(id);
    fileInputRef.current?.click();
  };

  const handlePasteImage = async (e: React.ClipboardEvent, itemId: string) => {
    const clipItems = e.clipboardData?.items;
    if (!clipItems) return;
    for (const item of Array.from(clipItems)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          try {
            const oldUrl = items.find((i) => i.id === itemId)?.image || '';
            const publicUrl = await uploadProductImage(file, itemId, oldUrl);
            await handleUpdate(itemId, { image: publicUrl });
            toast.success(language === 'sq' ? 'Foto u ngarkua' : 'Image uploaded');
          } catch (uploadError) {
            console.error('Image paste upload failed:', uploadError);
            toast.error(language === 'sq' ? 'Ngarkimi i fotos dështoi' : 'Image upload failed');
          }
        }
        break;
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadingItemId) {
      const targetId = uploadingItemId;
      try {
        const oldUrl = items.find((i) => i.id === targetId)?.image || '';
        const publicUrl = await uploadProductImage(file, targetId, oldUrl);
        await handleUpdate(targetId, { image: publicUrl });
        toast.success(language === 'sq' ? 'Foto u ngarkua' : 'Image uploaded');
      } catch (uploadError) {
        console.error('Image upload failed:', uploadError);
        toast.error(language === 'sq' ? 'Ngarkimi i fotos dështoi' : 'Image upload failed');
      }
      setUploadingItemId(null);
    }
    e.target.value = '';
  };

  const toggleOferta = async () => {
    const nextValue = !ofertaEnabled;
    setOfertaEnabled(nextValue);

    try {
      await upsertStorefrontSetting(OFFERS_SECTION_ENABLED_KEY, nextValue);
    } catch (error) {
      console.error('Failed to update offers section setting:', error);
      setOfertaEnabled(!nextValue);
    }
  };

  const toggleWhatsappFallback = async () => {
    const nextValue = !whatsappFallbackEnabled;
    setWhatsappFallbackEnabled(nextValue);
    try {
      await upsertStorefrontSetting(WHATSAPP_FALLBACK_KEY, nextValue);
    } catch {
      setWhatsappFallbackEnabled(!nextValue);
    }
  };

  const handleSaveOffer = async (offer: StorefrontOffer) => {
    try {
      const cleaned = {
        ...offer,
        includes: (offer.includes ?? []).map(s => s.trim()).filter(s => s.length > 0),
      };
      await upsertStorefrontOffer(cleaned, cleaned.sortOrder);
      setEditingOffer(null);
      toast.success(language === 'sq' ? 'U ruajt' : 'Saved');
    } catch (error) {
      console.error('Failed to save offer:', error);
      toast.error(language === 'sq' ? 'Ruajtja dështoi — provo përsëri' : 'Save failed — try again');
    }
  };

  const loadDbImages = useCallback(async () => {
    setDbLoading(true);
    try {
      const bucket = 'product-images';
      const client = supabase as any;
      const allFiles: StorageFile[] = [];

      const getUrl = (path: string) =>
        client.storage.from(bucket).getPublicUrl(path).data?.publicUrl ?? '';

      const listRecursive = async (path: string = '') => {
        const { data, error } = await client.storage.from(bucket).list(path, {
          limit: 500,
          sortBy: { column: 'name', order: 'asc' }
        });
        
        if (error) throw error;
        if (!data) return;

        for (const item of data) {
          const itemPath = path ? `${path}/${item.name}` : item.name;
          if (item.id) {
            // It's a file
            allFiles.push({
              name: item.name,
              path: itemPath,
              size: item.metadata?.size ?? 0,
              publicUrl: getUrl(itemPath)
            });
          } else {
            // It's a folder
            await listRecursive(itemPath);
          }
        }
      };

      await listRecursive();
      allFiles.sort((a, b) => b.size - a.size);
      setDbImages(allFiles);
    } catch (e) {
      console.error(e);
      toast.error('Gabim duke ngarkuar imazhet');
    } finally {
      setDbLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'databaze') loadDbImages();
  }, [activeTab, loadDbImages]);

  const handleDbDelete = async (path: string) => {
    const client = supabase as any;
    const { error } = await client.storage.from('product-images').remove([path]);
    if (error) { toast.error('Fshirja dështoi'); return; }
    toast.success('Imazhi u fshi');
    setConfirmDeleteStoragePath(null);
    setDbImages((prev) => prev.filter((f) => f.path !== path));
  };

  const handleDbReplace = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!replacingPath || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    const client = supabase as any;
    let processed: File;
    try {
      processed = await compressImage(file);
    } catch {
      toast.error(language === 'sq' ? 'Formati i fotos nuk mbështetet' : 'Unsupported image format');
      e.target.value = '';
      return;
    }
    const { error } = await client.storage.from('product-images').upload(replacingPath, processed, { upsert: true, contentType: 'image/jpeg' });
    if (error) { toast.error('Zëvendësimi dështoi'); return; }
    toast.success('Imazhi u zëvendësua');
    setReplacingPath(null);
    loadDbImages();
    e.target.value = '';
  };

  const handleDeleteOffer = async (offerId: string) => {
    const previousOffers = offers;
    setOffers((prev) => prev.filter((offer) => offer.id !== offerId));

    try {
      await deleteStorefrontOffer(offerId);
      toast.success(language === 'sq' ? 'U fshi' : 'Deleted');
    } catch (error) {
      console.error('Failed to delete offer:', error);
      setOffers(previousOffers);
      toast.error(language === 'sq' ? 'Fshirja dështoi' : 'Delete failed');
    }
  };

  const handleAddOfferImages = async (targetOfferId: string, files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!fileArray.length) return;
    setUploadingOfferId(targetOfferId);
    try {
      const newUrls: string[] = [];
      for (const file of fileArray) {
        const url = await addStorefrontOfferImage(file, targetOfferId);
        newUrls.push(url);
      }
      const currentOffer = offers.find((o) => o.id === targetOfferId);
      if (!currentOffer) return;
      const existing = currentOffer.images?.length ? currentOffer.images : (currentOffer.image ? [currentOffer.image] : []);
      const imgs = [...existing, ...newUrls];
      await handleUpdateStorefrontOffer(targetOfferId, { image: imgs[0], images: imgs });
      setOffers((prev) => prev.map((o) => (o.id === targetOfferId ? { ...o, image: imgs[0], images: imgs } : o)));
    } catch (err) {
      console.error('Image upload failed:', err);
      toast.error('Ngarkimi i fotos dështoi');
    } finally {
      setUploadingOfferId(null);
    }
  };

  const handleDeleteOfferImage = async (targetOfferId: string, imgUrl: string) => {
    setDeletingOfferImageKey(`${targetOfferId}:${imgUrl}`);
    try {
      await removeStorefrontOfferImage(imgUrl);
      const currentOffer = offers.find((o) => o.id === targetOfferId);
      if (!currentOffer) return;
      const existing = currentOffer.images?.length ? currentOffer.images : (currentOffer.image ? [currentOffer.image] : []);
      const imgs = existing.filter((u) => u !== imgUrl);
      await handleUpdateStorefrontOffer(targetOfferId, { image: imgs[0] ?? '', images: imgs });
      setOffers((prev) => prev.map((o) => (o.id === targetOfferId ? { ...o, image: imgs[0] ?? '', images: imgs } : o)));
      toast.success('Foto u fshi');
    } catch (err) {
      console.error('Image delete failed:', err);
      toast.error('Fshirja dështoi');
    } finally {
      setDeletingOfferImageKey(null);
    }
  };

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h1 className="font-display font-bold text-2xl">Admin Panel</h1>
            <p className="text-sm text-muted-foreground mt-1">Papirun Dashboard</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
            <div className="space-y-3">
              <input
                type="text"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                placeholder="Username"
                autoComplete="off"
                name="papirun-admin-user"
                className="w-full px-4 py-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder={language === 'sq' ? 'Fjalëkalimi' : 'Password'}
                autoComplete="new-password"
                name="papirun-admin-pass"
                className="w-full px-4 py-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
              />
              {error && <p className="text-destructive text-xs mt-1">{error}</p>}
            </div>
            <button type="submit" disabled={loginChecking} className="btn-sage w-full disabled:opacity-50">
              {loginChecking ? 'Duke u kyçur...' : (language === 'sq' ? 'Hyr' : 'Login')}
            </button>
          </form>
        </div>
      </div>
    );
  }

  

  const ADMIN_THEMES = {
    light: {},
    dim: {
      '--background': '220 14% 15%', '--foreground': '220 10% 91%',
      '--card': '220 14% 19%', '--card-foreground': '220 10% 91%',
      '--popover': '220 14% 17%', '--popover-foreground': '220 10% 91%',
      '--secondary': '220 14% 24%', '--secondary-foreground': '220 10% 80%',
      '--muted': '220 14% 22%', '--muted-foreground': '220 10% 54%',
      '--border': '220 14% 27%', '--input': '220 14% 27%',
      '--primary': '124 22% 58%', '--primary-foreground': '0 0% 100%',
    },
    dark: {
      '--background': '222 20% 9%', '--foreground': '220 10% 88%',
      '--card': '222 20% 12%', '--card-foreground': '220 10% 88%',
      '--popover': '222 20% 11%', '--popover-foreground': '220 10% 88%',
      '--secondary': '222 20% 17%', '--secondary-foreground': '220 10% 75%',
      '--muted': '222 20% 14%', '--muted-foreground': '220 10% 58%',
      '--border': '222 20% 19%', '--input': '222 20% 19%',
      '--primary': '124 22% 52%', '--primary-foreground': '0 0% 100%',
    },
  } as const;

  const themeVars = ADMIN_THEMES[adminTheme] as Record<string, string>;
  const applyTheme = (t: 'light' | 'dim' | 'dark') => {
    setAdminTheme(t);
    try { localStorage.setItem('papirun_admin_theme', t); } catch {}
  };

  return (
    <div
      className={`min-h-screen bg-background overflow-x-hidden text-foreground${adminTheme !== 'light' ? ' dark' : ''}`}
      style={themeVars as React.CSSProperties}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Admin Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-lg border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Package className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-foreground">
                {profile === 'cagllavice' ? 'Cagllavice Admin' : 'Papirun Admin'}
              </h1>
              <p className="text-xs text-muted-foreground capitalize">{profile ?? 'Dashboard'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 3-moon theme switcher */}
            <div className="flex items-center gap-0.5 bg-secondary rounded-full p-1">
              {(['light', 'dim', 'dark'] as const).map((t, idx) => (
                <button
                  key={t}
                  onClick={() => applyTheme(t)}
                  title={t === 'light' ? 'Ndriçim' : t === 'dim' ? 'Errët (i butë)' : 'Errët (i thellë)'}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                    adminTheme === t ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Moon
                    className="w-3.5 h-3.5"
                    fill={idx === 0 ? 'none' : idx === 1 ? 'currentColor' : 'currentColor'}
                    style={{ opacity: idx === 0 ? 0.5 : idx === 1 ? 0.75 : 1 }}
                    strokeWidth={2}
                  />
                </button>
              ))}
            </div>
            <div className="relative">
              <button
                onClick={() => { setShowNotifPanel((v) => !v); setActiveTab('orders'); }}
                className="relative flex items-center justify-center w-9 h-9 rounded-full bg-secondary hover:bg-secondary/80 transition-colors"
                title="Njoftime"
              >
                <Bell className="w-4 h-4" />
                {typingCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-violet-500 text-white text-[9px] font-bold flex items-center justify-center leading-none">
                    {typingCount}
                  </span>
                )}
              </button>
              {showNotifPanel && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifPanel(false)} />
                  <div className="absolute right-0 top-11 z-50 w-72 bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden">
                    <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground dark:text-muted-foreground">
                        Pa përgjigje
                      </span>
                      {unreadOrders.length === 0 && (
                        <span className="text-[11px] text-muted-foreground dark:text-muted-foreground">Asnjë</span>
                      )}
                    </div>
                    {unreadOrders.length > 0 ? (
                      <div className="max-h-80 overflow-y-auto">
                        {unreadOrders.map((o) => (
                          <button
                            key={o.id}
                            onClick={() => {
                              setHighlightId(o.id);
                              setActiveTab('orders');
                              setShowNotifPanel(false);
                              setTimeout(() => setHighlightId(null), 500);
                            }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-secondary/60 transition-colors text-left border-b border-border/20 last:border-0 ${
                              o.urgent ? 'bg-red-500/5' : ''
                            }`}
                          >
                            <span className={`w-2 h-2 rounded-full shrink-0 ${o.urgent ? 'bg-red-500 animate-pulse' : 'bg-violet-500'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold truncate dark:text-white">{o.name}</p>
                              <p className={`text-[11px] ${o.urgent ? 'text-red-500 font-bold' : 'text-muted-foreground dark:text-muted-foreground'}`}>
                                {o.count} mesazh{o.count !== 1 ? 'e' : ''} {o.urgent ? '— pa përgjigje !!!' : 'i ri'}
                              </p>
                            </div>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${o.urgent ? 'bg-red-500/15 text-red-600' : 'bg-violet-500/15 text-violet-600 dark:text-violet-300'}`}>
                              {o.count}
                            </span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="px-3 py-6 text-center text-sm text-muted-foreground dark:text-muted-foreground">
                        Të gjithë janë përgjigjur ✓
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => { setShowChangePw(true); setChangePwError(''); }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors text-sm"
              title="Ndrysho Fjalëkalimin"
            >
              <KeyRound className="w-4 h-4" />
            </button>
            <button
              onClick={() => supabase.auth.signOut()}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors text-sm"
            >
              <LogOut className="w-4 h-4" />
              {language === 'sq' ? 'Dil' : 'Logout'}
            </button>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showChangePw && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-background rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-lg">Ndrysho Fjalëkalimin</h2>
              <button onClick={() => { setShowChangePw(false); setChangePwCurrent(''); setChangePwNew(''); setChangePwConfirm(''); setChangePwError(''); }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <input
                type="password"
                value={changePwCurrent}
                onChange={(e) => setChangePwCurrent(e.target.value)}
                placeholder="Fjalëkalimi aktual"
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <input
                type="password"
                value={changePwNew}
                onChange={(e) => setChangePwNew(e.target.value)}
                placeholder="Fjalëkalimi i ri (min. 6 karaktere)"
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
              />
              <input
                type="password"
                value={changePwConfirm}
                onChange={(e) => setChangePwConfirm(e.target.value)}
                placeholder="Konfirmo fjalëkalimin e ri"
                autoComplete="new-password"
                className="w-full px-4 py-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
              />
              {changePwError && <p className="text-destructive text-xs">{changePwError}</p>}
            </div>
            <button
              onClick={handleChangePassword}
              disabled={changePwLoading}
              className="btn-sage w-full disabled:opacity-50"
            >
              {changePwLoading ? 'Duke ruajtur...' : 'Ruaj Fjalëkalimin'}
            </button>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-6">
        {/* Main tabs (big navbar) */}
        <div className="flex gap-2 mb-4 overflow-x-auto -mx-1 px-1">
          {(profile === 'cagllavice'
            ? ['orders', 'drivers', 'harta', 'cagmenu'] as const
            : ['orders', 'drivers', 'harta', 'menu', 'offers', 'content', 'databaze', 'users'] as const
          ).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-6 py-3 rounded-2xl text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-primary text-primary-foreground shadow-glow'
                  : 'bg-secondary hover:bg-secondary/80 text-foreground dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              {tab === 'orders' ? (language === 'sq' ? 'Porositë' : 'Orders')
                : tab === 'users' ? (language === 'sq' ? 'Përdoruesit' : 'Users')
                : tab === 'drivers' ? (language === 'sq' ? 'Shoferët' : 'Drivers')
                : tab === 'harta' ? '🗺 Harta'
                : tab === 'menu' ? (language === 'sq' ? 'Menuja' : 'Menu')
                : tab === 'cagmenu' ? (language === 'sq' ? 'Menuja' : 'Menu')
                : tab === 'offers' ? (language === 'sq' ? 'Ofertat' : 'Offers')
                : tab === 'databaze' ? 'Databaze'
                : (language === 'sq' ? 'Tekstet' : 'Content')}
            </button>
          ))}
        </div>

        {/* Sub-tabs for "Tekstet" */}
        {activeTab === 'content' && (
          <div className="flex gap-2 mb-6 overflow-x-auto -mx-1 px-1">
            {(['texts', 'locations', 'replies'] as const).map((sub) => (
              <button
                key={sub}
                onClick={() => setContentSubTab(sub)}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                  contentSubTab === sub
                    ? 'bg-foreground text-background'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {sub === 'texts' ? (language === 'sq' ? 'Tekstet' : 'Texts')
                  : sub === 'locations' ? (language === 'sq' ? 'Lokacionet' : 'Locations')
                  : (language === 'sq' ? 'Përgjigjet e shpejta' : 'Quick Replies')}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'orders' && <TabErrorBoundary><OrdersReview onTypingCount={setTypingCount} onUnreadChange={setUnreadOrders} highlightId={highlightId} caglOnly={profile === 'cagllavice'} /></TabErrorBoundary>}
        {activeTab === 'users' && <SubscribersList />}
        {activeTab === 'drivers' && (
          <div className="space-y-8">
            <DriversKPI />
            <DriversManager />
          </div>
        )}
        {activeTab === 'harta' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Map className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-lg">Harta Live e Shoferëve</h2>
                  <p className="text-xs text-muted-foreground">
                    {hartaDrivers.filter((d) => d.lat != null).length} / {hartaDrivers.length} shoferë aktiv · rifresohet çdo 5s
                  </p>
                </div>
              </div>
              <button
                onClick={() => fetchDrivers().then(setHartaDrivers).catch(console.error)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-xs font-medium transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Rifresko
              </button>
            </div>
            <DriverLocationMap drivers={hartaDrivers} height="600px" allowFullscreen showRestaurant />
            {/* Driver legend with distances */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {hartaDrivers.map((d) => {
                const dist = d.lat != null && d.lng != null
                  ? haversineKm(RESTAURANT_COORDS.lat, RESTAURANT_COORDS.lng, d.lat, d.lng)
                  : null;
                return (
                  <div key={d.id} className="bg-card rounded-xl p-3 flex items-center gap-2.5 shadow-sm border border-border/40">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 relative"
                      style={{ background: d.color || '#6b7280' }}
                    >
                      {d.name.slice(0, 2).toUpperCase()}
                      {d.lat != null && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-background" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{d.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {dist != null
                          ? `📍 ${dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`} larg`
                          : 'Offline · pa GPS'}
                        {!d.isActive && ' · Jo aktiv'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {activeTab === 'content' && contentSubTab === 'locations' && <LocationsEditor />}
        {activeTab === 'content' && contentSubTab === 'replies' && <QuickRepliesEditor />}
        {activeTab === 'content' && contentSubTab === 'texts' && <SiteTextsEditor language={language} />}

          {/* Menu Manager */}
        {activeTab === 'menu' && (
          <div className="space-y-3">

            {/* Add New Product Wizard Modal */}
            {showAddWizard && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={(e) => { if (e.target === e.currentTarget) { setShowAddWizard(false); setWizardStep(1); } }}>
                <div className="w-full max-w-lg bg-background rounded-3xl shadow-2xl overflow-hidden">
                  {/* Wizard header */}
                  <div className="bg-primary/10 px-6 py-4 flex items-center justify-between border-b border-border/40">
                    <div>
                      <h2 className="font-display font-bold text-lg">{language === 'sq' ? 'Produkt i Ri' : 'New Product'}</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">{wizardStep === 1 ? (language === 'sq' ? 'Hapi 1 nga 2 — Zgjidh kategorinë' : 'Step 1 of 2 — Choose category') : (language === 'sq' ? 'Hapi 2 nga 2 — Emri & çmimi' : 'Step 2 of 2 — Name & price')}</p>
                    </div>
                    <button onClick={() => { setShowAddWizard(false); setWizardStep(1); }} className="p-2 rounded-full hover:bg-secondary transition-colors"><X className="w-5 h-5" /></button>
                  </div>

                  {wizardStep === 1 ? (
                    <div className="p-6 space-y-4">
                      <p className="text-sm text-muted-foreground">{language === 'sq' ? 'Çfarë lloji produkti po shton?' : 'What type of product are you adding?'}</p>
                      <div className="grid grid-cols-2 gap-3">
                        {([
                          { value: 'sandwich', emoji: '🥪', label: language === 'sq' ? 'Sanduiç' : 'Sandwich' },
                          { value: 'fajita',   emoji: '🌯', label: 'Fajita' },
                          { value: 'salad',    emoji: '🥗', label: language === 'sq' ? 'Sallatë' : 'Salad' },
                          { value: 'sides',    emoji: '🍲', label: language === 'sq' ? 'Supë / Ekstra' : 'Soup / Extra' },
                          { value: 'drink',    emoji: '🥤', label: language === 'sq' ? 'Pije' : 'Drink' },
                        ] as const).map(({ value, emoji, label }) => (
                          <button
                            key={value}
                            onClick={() => { setWizardCategory(value); setWizardStep(2); }}
                            className={`flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 transition-all hover:scale-[1.02] ${
                              wizardCategory === value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40 bg-card'
                            }`}
                          >
                            <span className="text-4xl">{emoji}</span>
                            <span className="font-semibold text-sm">{label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <button onClick={() => setWizardStep(1)} className="text-xs text-primary hover:underline flex items-center gap-1">
                          ← {language === 'sq' ? 'Ndrysho kategorinë' : 'Change category'}
                        </button>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                          {wizardCategory === 'sandwich' ? '🥪 Sanduiç' : wizardCategory === 'fajita' ? '🌯 Fajita' : wizardCategory === 'salad' ? '🥗 Sallatë' : wizardCategory === 'drink' ? '🥤 Pije' : '🍲 Supë/Ekstra'}
                        </span>
                      </div>
                      <div className="space-y-3">
                        <div>
                          <label className="text-xs text-muted-foreground font-medium">{language === 'sq' ? 'Emri shqip *' : 'Albanian name *'}</label>
                          <input
                            autoFocus
                            value={wizardNameSq}
                            onChange={(e) => setWizardNameSq(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && wizardNameSq.trim()) handleWizardSubmit(); }}
                            placeholder={language === 'sq' ? 'p.sh. Supë Pule' : 'e.g. Chicken Soup'}
                            className="w-full mt-1 px-4 py-2.5 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground font-medium">{language === 'sq' ? 'Emri anglisht (opsional)' : 'English name (optional)'}</label>
                          <input
                            value={wizardNameEn}
                            onChange={(e) => setWizardNameEn(e.target.value)}
                            placeholder={language === 'sq' ? 'Plotësohet automatikisht' : 'Auto-filled if empty'}
                            className="w-full mt-1 px-4 py-2.5 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground font-medium">{language === 'sq' ? 'Çmimi (€)' : 'Price (€)'}</label>
                          <div className="relative mt-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">€</span>
                            <input
                              type="number"
                              step="0.10"
                              min="0"
                              value={wizardPrice}
                              onChange={(e) => setWizardPrice(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter' && wizardNameSq.trim()) handleWizardSubmit(); }}
                              placeholder="0.00"
                              className="w-full pl-7 pr-4 py-2.5 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={handleWizardSubmit}
                          disabled={!wizardNameSq.trim()}
                          className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-40 hover:opacity-90 transition-all"
                        >
                          {language === 'sq' ? 'Krijo Produktin' : 'Create Product'} →
                        </button>
                        <button onClick={() => { setShowAddWizard(false); setWizardStep(1); }} className="px-4 py-3 rounded-xl bg-secondary text-sm font-medium">
                          {language === 'sq' ? 'Anulo' : 'Cancel'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Extras Catalog Manager */}
            <div className="bg-card rounded-2xl p-4 shadow-card">
              <h2 className="text-sm font-display font-bold mb-3 flex items-center gap-2">
                <span className="text-base">🧂</span>
                {language === 'sq' ? 'Katalogu i Ekstrave' : 'Extras Catalog'}
                <span className="text-[10px] text-muted-foreground font-normal">{language === 'sq' ? '— çmimet e ekstrave' : '— extra prices'}</span>
              </h2>

              {/* Existing extras list */}
              <div className="flex flex-wrap gap-2 mb-3">
                {menuExtras.length === 0 && (
                  <p className="text-xs text-muted-foreground">{language === 'sq' ? 'Nuk ka ekstra ende.' : 'No extras yet.'}</p>
                )}
                {menuExtras.map((extra) => (
                  <div key={extra.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${extra.isActive ? 'bg-accent border-accent-foreground/10' : 'bg-secondary border-border/40 opacity-60'}`}>
                    <span className="text-xs font-medium">{extra.name[language]}</span>
                    <span className="text-xs font-bold text-primary">€{extra.price.toFixed(2)}</span>
                    <button
                      title={extra.isActive ? 'Çaktivizo' : 'Aktivizo'}
                      onClick={async () => {
                        const updated = { ...extra, isActive: !extra.isActive };
                        setMenuExtras(prev => prev.map(e => e.id === extra.id ? updated : e));
                        try { await upsertMenuExtra(updated); } catch { setMenuExtras(prev => prev.map(e => e.id === extra.id ? extra : e)); toast.error(language === 'sq' ? 'Ruajtja dështoi' : 'Save failed'); }
                      }}
                      className={`w-3.5 h-3.5 rounded-full border transition-colors shrink-0 ${extra.isActive ? 'bg-emerald-500 border-emerald-500' : 'bg-muted border-border'}`}
                    />
                    <button
                      onClick={async () => {
                        setMenuExtras(prev => prev.filter(e => e.id !== extra.id));
                        try { await deleteMenuExtra(extra.id); } catch { const syncExtras = async () => { try { const liveExtras = await fetchMenuExtras(); setMenuExtras(liveExtras); } catch {} }; syncExtras(); toast.error(language === 'sq' ? 'Fshirja dështoi' : 'Delete failed'); }
                      }}
                      className="hover:text-destructive transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add new extra form */}
              <div className="flex gap-2 items-center">
                <input
                  value={newCatalogExtraNameSq}
                  onChange={(e) => setNewCatalogExtraNameSq(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') (e.currentTarget.nextElementSibling?.querySelector('input') as HTMLInputElement)?.focus(); }}
                  placeholder={language === 'sq' ? 'Emri (p.sh. Mish Extra)' : 'Name (e.g. Extra Meat)'}
                  className="flex-1 px-3 py-2 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20"
                />
                <div className="relative shrink-0">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">€</span>
                  <input
                    type="number"
                    step="0.10"
                    min="0"
                    value={newCatalogExtraPrice}
                    onChange={(e) => setNewCatalogExtraPrice(e.target.value)}
                    onKeyDown={async (e) => {
                      if (e.key !== 'Enter') return;
                      const name = newCatalogExtraNameSq.trim();
                      if (!name) return;
                      const price = parseFloat(newCatalogExtraPrice) || 0;
                      const newExtra: MenuExtra = { id: `extra-${Date.now()}`, name: { sq: name, en: name }, price, isActive: true, sortOrder: menuExtras.length };
                      setMenuExtras(prev => [...prev, newExtra]);
                      setNewCatalogExtraNameSq('');
                      setNewCatalogExtraPrice('');
                      try { await upsertMenuExtra(newExtra); toast.success(language === 'sq' ? 'Ekstra u shtua' : 'Extra added'); }
                      catch { toast.error('Dështoi'); setMenuExtras(prev => prev.filter(ex => ex.id !== newExtra.id)); }
                    }}
                    placeholder="0.50"
                    className="w-24 pl-7 pr-3 py-2 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <button
                  disabled={!newCatalogExtraNameSq.trim()}
                  onClick={async () => {
                    const name = newCatalogExtraNameSq.trim();
                    if (!name) return;
                    const price = parseFloat(newCatalogExtraPrice) || 0;
                    const newExtra: MenuExtra = { id: `extra-${Date.now()}`, name: { sq: name, en: name }, price, isActive: true, sortOrder: menuExtras.length };
                    setMenuExtras(prev => [...prev, newExtra]);
                    setNewCatalogExtraNameSq('');
                    setNewCatalogExtraPrice('');
                    try { await upsertMenuExtra(newExtra); toast.success(language === 'sq' ? 'Ekstra u shtua' : 'Extra added'); }
                    catch { toast.error('Dështoi'); setMenuExtras(prev => prev.filter(ex => ex.id !== newExtra.id)); }
                  }}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 flex items-center gap-1 shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Category Order Panel */}
            <div className="rounded-2xl border border-border bg-card p-4 mb-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                {language === 'sq' ? 'Renditja e Kategorive' : 'Category Order'}
              </p>
              <div className="space-y-1.5">
                {(() => {
                  const CAT_META: Record<string, { emoji: string; sq: string; en: string }> = {
                    salad:    { emoji: '🥗', sq: 'Sallata',       en: 'Salads' },
                    fajita:   { emoji: '🌯', sq: 'Fajita',        en: 'Fajitas' },
                    sandwich: { emoji: '🥪', sq: 'Sanduiçe',      en: 'Sandwiches' },
                    sides:    { emoji: '🍲', sq: 'Supë & Ekstra', en: 'Soup & Extras' },
                    drink:    { emoji: '🥤', sq: 'Pijet',         en: 'Drinks' },
                  };
                  return catOrder.map((cat, idx) => {
                    const meta = CAT_META[cat];
                    return (
                      <div key={cat} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50">
                        <span className="text-base">{meta?.emoji ?? '•'}</span>
                        <span className="flex-1 text-sm font-medium">{meta?.[language] ?? cat}</span>
                        <button
                          onClick={() => moveCat(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 rounded-lg hover:bg-background disabled:opacity-20 transition-colors"
                          aria-label="Move up"
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => moveCat(idx, 'down')}
                          disabled={idx === catOrder.length - 1}
                          className="p-1 rounded-lg hover:bg-background disabled:opacity-20 transition-colors"
                          aria-label="Move down"
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Add New Button */}
            <button
              onClick={() => { setShowAddWizard(true); setWizardStep(1); }}
              className="w-full py-4 rounded-2xl border-2 border-dashed border-primary/30 text-primary hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Plus className="w-5 h-5" />
              {language === 'sq' ? 'Shto Produkt te Ri' : 'Add New Product'}
            </button>

            {/* Export CSV Button — manual local backup of the menu exactly as currently loaded */}
            <button
              onClick={handleExportMenuCsv}
              className="w-full py-3 rounded-2xl border border-border text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2 text-sm font-medium"
            >
              <HardDrive className="w-4 h-4" />
              {language === 'sq' ? 'Eksporto CSV (Backup)' : 'Export CSV (Backup)'}
            </button>

            {(() => {
              // Single global ranking across ALL categories (products.sort_order),
              // so any product can be moved above/below any other regardless of
              // category. Matches menu-baseline-2026-07-18 display data exactly;
              // only the ranking mechanism changed.
              const flatItems = items;
              const CAT_BADGE: Record<string, { emoji: string; sq: string; en: string }> = {
                salad:    { emoji: '🥗', sq: 'Sallata',       en: 'Salads' },
                fajita:   { emoji: '🌯', sq: 'Fajita',        en: 'Fajitas' },
                sandwich: { emoji: '🥪', sq: 'Sanduiçe',      en: 'Sandwiches' },
                sides:    { emoji: '🍲', sq: 'Supë & Ekstra', en: 'Soup & Extras' },
                drink:    { emoji: '🥤', sq: 'Pijet',         en: 'Drinks' },
              };

              const moveItem = async (itemId: string, direction: 'up' | 'down') => {
                const idx = flatItems.findIndex(i => i.id === itemId);
                if (idx < 0) return;
                const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
                if (swapIdx < 0 || swapIdx >= flatItems.length) return;

                const reordered = [...flatItems];
                [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
                setItems(reordered);

                // Renumber every item's sort_order to its new global position.
                // Keeps ranks unique and collision-free from here on — the old
                // per-category logic reset ranks to 0,1,2... inside each category,
                // which is what caused categories to silently stomp on each
                // other's numbers and made cross-category ordering impossible.
                try {
                  await Promise.all(reordered.map((it, i) => updateProductSortOrder(it.id, i)));
                } catch (err) {
                  console.error('Failed to update sort order:', err);
                }
              };

              return (
                <div className="space-y-3">
                  {flatItems.map((item, idx) => (
              <div
                key={item.id}
                className={`bg-card rounded-2xl p-4 shadow-card transition-all ${
                  !item.isAvailable ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  {/* Sort order buttons */}
                  <div className="flex flex-col gap-0.5 shrink-0 pt-2">
                    <button
                      onClick={() => moveItem(item.id, 'up')}
                      disabled={idx === 0}
                      className="p-1 rounded hover:bg-secondary disabled:opacity-20 transition-colors"
                      title={language === 'sq' ? 'Lart' : 'Move up'}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveItem(item.id, 'down')}
                      disabled={idx === flatItems.length - 1}
                      className="p-1 rounded hover:bg-secondary disabled:opacity-20 transition-colors"
                      title={language === 'sq' ? 'Poshtë' : 'Move down'}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  <div
                    className="relative shrink-0"
                    tabIndex={0}
                    onPaste={(e) => editingItem === item.id && handlePasteImage(e, item.id)}
                    title={editingItem === item.id ? (language === 'sq' ? 'Ctrl+V për të ngjitur foto' : 'Ctrl+V to paste image') : ''}
                  >
                    {item.image ? (
                      <img
                        src={getOptimizedImage(item.image)}
                        alt={item.name[language]}
                        className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-contain ${editingItem === item.id ? 'ring-2 ring-primary/30 ring-dashed' : ''}`}
                      />
                    ) : (
                      <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-secondary flex items-center justify-center ${editingItem === item.id ? 'ring-2 ring-primary/30 ring-dashed' : ''}`}>
                        <Image className="w-6 h-6 text-muted-foreground" />
                      </div>
                    )}
                    {editingItem === item.id && (
                      <button
                        onClick={() => handleImageUpload(item.id)}
                        disabled={uploadingItemId === item.id}
                        className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm disabled:opacity-60"
                      >
                        {uploadingItemId === item.id
                          ? <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          : <Upload className="w-3.5 h-3.5" />
                        }
                      </button>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    {editingItem === item.id ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground">
                              {language === 'sq' ? 'Emri (SQ)' : 'Name (SQ)'}
                            </label>
                            <input
                              value={item.name.sq}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  name: { ...item.name, sq: e.target.value },
                                })
                              }
                              className="w-full px-3 py-2 rounded-lg bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">
                              {language === 'sq' ? 'Emri (EN)' : 'Name (EN)'}
                            </label>
                            <input
                              value={item.name.en}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  name: { ...item.name, en: e.target.value },
                                })
                              }
                              className="w-full px-3 py-2 rounded-lg bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground">
                              {language === 'sq' ? 'Pershkrimi (SQ)' : 'Description (SQ)'}
                            </label>
                            <textarea
                              value={item.description.sq}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  description: { ...item.description, sq: e.target.value },
                                })
                              }
                              rows={2}
                              className="w-full px-3 py-2 rounded-lg bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20 resize-none"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">
                              {language === 'sq' ? 'Pershkrimi (EN)' : 'Description (EN)'}
                            </label>
                            <textarea
                              value={item.description.en}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  description: { ...item.description, en: e.target.value },
                                })
                              }
                              rows={2}
                              className="w-full px-3 py-2 rounded-lg bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20 resize-none"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <div>
                            <label className="text-xs text-muted-foreground">
                              {language === 'sq' ? 'Cmimi' : 'Price'}
                            </label>
                            <input
                              type="number"
                              step="0.10"
                              value={item.price}
                              onChange={(e) =>
                                updateItem(item.id, { price: parseFloat(e.target.value) || 0 })
                              }
                              className="w-24 px-3 py-2 rounded-lg bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground">
                              {language === 'sq' ? 'Kategoria' : 'Category'}
                            </label>
                            <select
                              value={item.category}
                              onChange={(e) =>
                                updateItem(item.id, { category: e.target.value as MenuItem['category'] })
                              }
                              className="px-3 py-2 rounded-lg bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20"
                            >
                              <option value="salad">Salad</option>
                              <option value="fajita">Fajita</option>
                              <option value="sandwich">Sandwich</option>
                              <option value="sides">Sides</option>
                              <option value="drink">Drink (Pije)</option>
                            </select>
                          </div>
                        </div>

                        {/* Ingredients Management */}
                        <div>
                          <label className="text-xs text-muted-foreground font-medium">
                            {language === 'sq' ? 'Përbërësit' : 'Ingredients'}
                          </label>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {item.ingredients.map((ing, idx) => (
                              <span key={idx} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-xs font-medium">
                                {getIngredientName(ing, language)} <span className="text-muted-foreground/60 text-[10px]">({ing})</span>
                                <button
                                  onClick={() => updateItem(item.id, { ingredients: item.ingredients.filter((_, i) => i !== idx) })}
                                  className="hover:text-destructive"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2 mt-2">
                            <input
                              value={newIngredients[item.id] ?? ''}
                              onChange={(e) => setNewIngredients(prev => ({ ...prev, [item.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                const val = newIngredients[item.id]?.trim();
                                if (e.key === 'Enter' && val) {
                                  updateItem(item.id, { ingredients: [...item.ingredients, val.toLowerCase()] });
                                  setNewIngredients(prev => ({ ...prev, [item.id]: '' }));
                                }
                              }}
                              placeholder={language === 'sq' ? 'Shto përbërës...' : 'Add ingredient...'}
                              className="flex-1 px-3 py-1.5 rounded-lg bg-secondary border-0 text-xs focus:ring-2 focus:ring-primary/20"
                            />
                            <button
                              onClick={() => {
                                const val = newIngredients[item.id]?.trim();
                                if (val) {
                                  updateItem(item.id, { ingredients: [...item.ingredients, val.toLowerCase()] });
                                  setNewIngredients(prev => ({ ...prev, [item.id]: '' }));
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Extras Management */}
                        <div>
                          <label className="text-xs text-muted-foreground font-medium">
                            {language === 'sq' ? 'Ekstra (opsionale)' : 'Extras (optional)'}
                          </label>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {(item.extras || []).map((ext, idx) => {
                              const catalogExtra = menuExtras.find(e => e.id === ext || e.name.sq.toLowerCase() === ext);
                              return (
                                <span key={idx} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium">
                                  + {getIngredientName(ext, language)}
                                  {catalogExtra && <span className="text-muted-foreground/70 text-[10px] font-semibold">€{catalogExtra.price.toFixed(2)}</span>}
                                  <button
                                    onClick={() => updateItem(item.id, { extras: (item.extras || []).filter((_, i) => i !== idx) })}
                                    className="hover:text-destructive"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                          {/* Catalog picker */}
                          {menuExtras.filter(e => e.isActive).length > 0 && (
                            <div className="mt-2">
                              <p className="text-[10px] text-muted-foreground mb-1">{language === 'sq' ? 'Zgjidh nga katallogu:' : 'Pick from catalog:'}</p>
                              <div className="flex flex-wrap gap-1.5">
                                {menuExtras.filter(e => e.isActive && !(item.extras || []).includes(e.id)).map(extra => (
                                  <button
                                    key={extra.id}
                                    onClick={() => updateItem(item.id, { extras: [...(item.extras || []), extra.id] })}
                                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary hover:bg-primary/10 border border-border/40 hover:border-primary/30 text-xs transition-all"
                                  >
                                    <Plus className="w-3 h-3 text-primary" />
                                    <span>{extra.name[language]}</span>
                                    <span className="text-primary font-semibold">€{extra.price.toFixed(2)}</span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                          {/* Manual entry */}
                          <div className="flex gap-2 mt-2">
                            <input
                              value={newExtras[item.id] ?? ''}
                              onChange={(e) => setNewExtras(prev => ({ ...prev, [item.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                const val = newExtras[item.id]?.trim();
                                if (e.key === 'Enter' && val) {
                                  updateItem(item.id, { extras: [...(item.extras || []), val.toLowerCase()] });
                                  setNewExtras(prev => ({ ...prev, [item.id]: '' }));
                                }
                              }}
                              placeholder={language === 'sq' ? 'Ose shto manual...' : 'Or add manually...'}
                              className="flex-1 px-3 py-1.5 rounded-lg bg-secondary border-0 text-xs focus:ring-2 focus:ring-primary/20"
                            />
                            <button
                              onClick={() => {
                                const val = newExtras[item.id]?.trim();
                                if (val) {
                                  updateItem(item.id, { extras: [...(item.extras || []), val.toLowerCase()] });
                                  setNewExtras(prev => ({ ...prev, [item.id]: '' }));
                                }
                              }}
                              className="px-3 py-1.5 rounded-lg bg-accent text-accent-foreground text-xs font-medium"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveItem(item)}
                            disabled={editLoadingId === item.id}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium disabled:opacity-60"
                          >
                            <Save className="w-4 h-4" />
                            {language === 'sq' ? 'Ruaj' : 'Save'}
                          </button>
                          {confirmDeleteItemId === item.id ? (
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => { deleteItem(item.id); setConfirmDeleteItemId(null); }}
                                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-destructive text-white text-sm font-bold animate-pulse"
                              >
                                <AlertTriangle className="w-4 h-4" />
                                Konfirmo fshirjen
                              </button>
                              <button
                                onClick={() => setConfirmDeleteItemId(null)}
                                className="px-3 py-2 rounded-full bg-secondary text-sm"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteItemId(item.id)}
                              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              {language === 'sq' ? 'Fshij' : 'Delete'}
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-semibold text-sm sm:text-base truncate">
                            {item.name[language]}
                          </h3>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                              {CAT_BADGE[item.category]?.emoji} {CAT_BADGE[item.category]?.[language] ?? item.category}
                            </span>
                            {(productOrderCounts[item.id] ?? 0) > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                                📦 {(productOrderCounts[item.id] || 0).toLocaleString()}
                              </span>
                            )}
                            <span className="text-primary font-bold text-sm">
                              €{item.price.toFixed(2)}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {item.description[language]}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <button
                            onClick={() => beginEditItem(item.id)}
                            disabled={editLoadingId === item.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-xs font-medium hover:bg-secondary/80 transition-colors disabled:opacity-60"
                          >
                            {editLoadingId === item.id && (
                              <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            )}
                            {language === 'sq' ? 'Ndrysho' : 'Edit'}
                          </button>
                          <button
                            onClick={() => toggleAvailability(item.id)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                              item.isAvailable
                                ? 'bg-accent text-accent-foreground'
                                : 'bg-destructive/10 text-destructive'
                            }`}
                          >
                            {item.isAvailable ? (
                              <Eye className="w-3 h-3" />
                            ) : (
                              <EyeOff className="w-3 h-3" />
                            )}
                            {item.isAvailable
                              ? language === 'sq' ? 'Aktiv' : 'Active'
                              : language === 'sq' ? 'Jo aktiv' : 'Hidden'}
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {item.likes} {language === 'sq' ? 'pelqime' : 'likes'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
                  ))}
                </div>
              );
            })()}
          </div>
        )}

        {/* Cagllavicë-only minimal menu view: single toggle per product, no edit/price/delete access */}
        {activeTab === 'cagmenu' && (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border"
              >
                {item.image && (
                  <img
                    src={item.image}
                    alt={item.name[language]}
                    className="w-12 h-12 object-contain rounded-xl bg-white flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{item.name[language]}</p>
                  <p className="text-xs text-muted-foreground capitalize">{item.category}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs font-medium text-muted-foreground">
                    {language === 'sq' ? 'Në Çagllavicë' : 'At Cagllavicë'}
                  </span>
                  <button
                    onClick={() => toggleCagllaviceAvailability(item.id)}
                    aria-label={language === 'sq' ? 'Në Çagllavicë' : 'At Cagllavicë'}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                      item.isAvailableOnCagllavice
                        ? 'bg-accent text-accent-foreground'
                        : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {item.isAvailableOnCagllavice ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Offers Manager */}
        {activeTab === 'offers' && (
          <div className="space-y-6">
            <input
              ref={offerFileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files?.length && uploadingOfferId) {
                  handleAddOfferImages(uploadingOfferId, files);
                }
                e.target.value = '';
              }}
            />

            {/* Master toggle */}
            <div className="bg-card rounded-2xl p-5 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-semibold text-lg dark:text-white">
                    🌙 {language === 'sq' ? 'Seksioni i Ofertave' : 'Offers Section'}
                  </h3>
                  <p className="text-xs text-muted-foreground dark:text-slate-400 mt-1">
                    {language === 'sq' ? 'Aktivizo ose çaktivizo të gjithë seksionin' : 'Toggle entire offers section'}
                  </p>
                </div>
                <button
                  onClick={toggleOferta}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                    ofertaEnabled ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {ofertaEnabled ? <><ToggleRight className="w-5 h-5" /> ON</> : <><ToggleLeft className="w-5 h-5" /> OFF</>}
                </button>
              </div>
            </div>

            {/* WhatsApp fallback button toggle */}
            <div className="bg-card rounded-2xl p-5 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-semibold text-lg dark:text-white">
                    💬 Butoni "Backup WhatsApp"
                  </h3>
                  <p className="text-xs text-muted-foreground dark:text-slate-400 mt-1">
                    Shfaq ose fsheh butonin "Backup: dërgo në WhatsApp" te checkout
                  </p>
                </div>
                <button
                  onClick={toggleWhatsappFallback}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                    whatsappFallbackEnabled ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {whatsappFallbackEnabled ? <><ToggleRight className="w-5 h-5" /> ON</> : <><ToggleLeft className="w-5 h-5" /> OFF</>}
                </button>
              </div>
            </div>

            {/* Location badge text editor */}
            <div className="bg-card rounded-2xl p-5 shadow-card">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                <span className="text-lg">📍</span>
                Teksti i Badgit të Lokacionit
              </h3>
              <div className="flex gap-2">
                <input
                  value={offerBadgeText}
                  onChange={(e) => setOfferBadgeText(e.target.value)}
                  placeholder={DEFAULT_OFFER_BADGE_TEXT}
                  className="flex-1 px-3 py-2 rounded-lg bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none"
                />
                <button
                  disabled={offerBadgeSaving}
                  onClick={async () => {
                    setOfferBadgeSaving(true);
                    try {
                      await upsertStorefrontSetting(OFFER_BADGE_TEXT_KEY, offerBadgeText);
                      toast.success('Teksti u ruajt');
                    } catch {
                      toast.error('Dështoi ruajtja');
                    } finally {
                      setOfferBadgeSaving(false);
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Shfaqet si badge i kuq në seksionin e ofertave dhe në faqen e detajeve.</p>
            </div>

            {/* Add New Offer */}
            <button
              onClick={async () => {
                const newOffer: StorefrontOffer = {
                  id: `offer-${Date.now()}`,
                  title: 'Ofertë e Re',
                  description: 'Përshkrim...',
                  price: 0,
                  image: '',
                  includes: [],
                  isActive: true,
                  sortOrder: offers.length,
                };
                setOffers((prev) => [...prev, newOffer]);
                setEditingOffer(newOffer.id);

                try {
                  await upsertStorefrontOffer(newOffer, newOffer.sortOrder);
                } catch (error) {
                  console.error('Failed to create offer:', error);
                }
              }}
              className="w-full py-4 rounded-2xl border-2 border-dashed border-primary/30 text-primary hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Plus className="w-5 h-5" />
              {language === 'sq' ? 'Shto Ofertë te Re' : 'Add New Offer'}
            </button>

            {/* Individual Offers */}
            <div className="space-y-3">
              {offers.map((offer) => {
                const isOn = offer.isActive;
                const isUploading = uploadingOfferId === offer.id;
                const isDragOver = dragOverOfferId === offer.id;

                const currentImages = offer.images?.length ? offer.images : (offer.image ? [offer.image] : []);

                return (
                  <div
                    key={offer.id}
                    tabIndex={0}
                    className={`bg-card rounded-2xl shadow-card transition-all overflow-hidden outline-none ${!isOn ? 'opacity-60' : ''}`}
                    onPaste={(e) => {
                      const items = e.clipboardData?.items;
                      if (!items) return;
                      for (const item of Array.from(items)) {
                        if (item.type.startsWith('image/')) {
                          e.preventDefault();
                          const file = item.getAsFile();
                          if (file) handleAddOfferImages(offer.id, [file]);
                          break;
                        }
                      }
                    }}
                  >
                    {/* Multi-image gallery strip */}
                    <div className="flex gap-2 overflow-x-auto p-3 bg-secondary/40 scrollbar-thin">
                      {currentImages.map((imgUrl, idx) => {
                        const isDeleting = deletingOfferImageKey === `${offer.id}:${imgUrl}`;
                        return (
                          <div key={imgUrl} className="relative shrink-0 w-24 h-24 rounded-xl overflow-hidden group border border-border">
                            <img
                              src={getOptimizedImage(imgUrl)}
                              alt={`${offer.title} foto ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                            <button
                              type="button"
                              onClick={() => handleDeleteOfferImage(offer.id, imgUrl)}
                              disabled={isDeleting}
                              className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                              title="Fshi foton"
                            >
                              {isDeleting
                                ? <span className="w-3.5 h-3.5 block border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <X className="w-3.5 h-3.5" />
                              }
                            </button>
                            {idx === 0 && currentImages.length > 1 && (
                              <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[9px] font-bold px-1 rounded">kryesore</span>
                            )}
                          </div>
                        );
                      })}

                      {/* Add photo button */}
                      <button
                        type="button"
                        onClick={() => { setUploadingOfferId(offer.id); offerFileRef.current?.click(); }}
                        onDragOver={(e) => { e.preventDefault(); setDragOverOfferId(offer.id); }}
                        onDragEnter={(e) => { e.preventDefault(); setDragOverOfferId(offer.id); }}
                        onDragLeave={() => setDragOverOfferId(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverOfferId(null);
                          if (e.dataTransfer.files?.length) handleAddOfferImages(offer.id, e.dataTransfer.files);
                        }}
                        className={`shrink-0 w-24 h-24 rounded-xl flex flex-col items-center justify-center gap-1 transition-all border-2 border-dashed ${
                          isDragOver
                            ? 'border-primary bg-primary/10'
                            : 'border-muted-foreground/30 bg-secondary hover:border-primary hover:bg-primary/5'
                        }`}
                        title="Shto foto — kliko, drag-drop ose Ctrl+V"
                      >
                        {isUploading ? (
                          <span className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        ) : isDragOver ? (
                          <>
                            <Upload className="w-5 h-5 text-primary" />
                            <span className="text-[10px] text-primary font-medium">Lësho</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-5 h-5 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">Shto foto</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Card body */}
                    <div className="p-4">
                      {editingOffer === offer.id ? (
                        <div className="space-y-3">
                          <input
                            value={offer.title}
                            onChange={(e) => setOffers(prev => prev.map(o => o.id === offer.id ? { ...o, title: e.target.value } : o))}
                            placeholder="Title"
                            className="w-full px-3 py-2 rounded-lg bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20"
                          />
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">Përshkrimi</p>
                            <textarea
                              value={offer.description}
                              onChange={(e) => setOffers(prev => prev.map(o => o.id === offer.id ? { ...o, description: e.target.value } : o))}
                              rows={2}
                              placeholder="p.sh. Crunch Sandwich - Coca Cola - Tart"
                              className="w-full px-3 py-2 rounded-lg bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20 resize-none"
                            />
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-1">Artikujt në kombo (çdo rresht = 1 artikull)</p>
                            <textarea
                              value={(offer.includes ?? []).join('\n')}
                              onChange={(e) => {
                                const lines = e.target.value.split('\n').map(l => l.trimStart()).filter(l => l.length > 0);
                                setOffers(prev => prev.map(o => o.id === offer.id ? { ...o, includes: e.target.value.split('\n').map(l => l.trimStart()) } : o));
                              }}
                              rows={3}
                              placeholder={"1x Crunch Sandwich\n1x Coca Cola\n1x Tart"}
                              className="w-full px-3 py-2 rounded-lg bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20 resize-none font-mono"
                            />
                          </div>
                          <input
                            type="number"
                            step="0.10"
                            value={offer.price}
                            onChange={(e) => setOffers(prev => prev.map(o => o.id === offer.id ? { ...o, price: parseFloat(e.target.value) || 0 } : o))}
                            className="w-32 px-3 py-2 rounded-lg bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20"
                          />
                          <div className="flex gap-2">
                            <button onClick={() => handleSaveOffer(offer)} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                              <Save className="w-4 h-4" /> {language === 'sq' ? 'Ruaj' : 'Save'}
                            </button>
                            {confirmDeleteOfferId === offer.id ? (
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => { handleDeleteOffer(offer.id); setConfirmDeleteOfferId(null); }}
                                  className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-destructive text-white text-sm font-bold animate-pulse"
                                >
                                  <AlertTriangle className="w-4 h-4" /> Konfirmo fshirjen
                                </button>
                                <button onClick={() => setConfirmDeleteOfferId(null)} className="px-3 py-2 rounded-full bg-secondary text-sm">
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <button onClick={() => setConfirmDeleteOfferId(offer.id)} className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 transition-colors">
                                <Trash2 className="w-4 h-4" /> {language === 'sq' ? 'Fshij' : 'Delete'}
                              </button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-semibold text-sm sm:text-base">{offer.title}</h3>
                            <span className="text-primary font-bold text-sm shrink-0">€{offer.price.toFixed(2)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{offer.description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <button onClick={() => setEditingOffer(offer.id)} className="px-3 py-1.5 rounded-full bg-secondary text-xs font-medium hover:bg-secondary/80 transition-colors">
                              {language === 'sq' ? 'Ndrysho' : 'Edit'}
                            </button>
                            <button
                              onClick={async () => {
                                const nextValue = !isOn;
                                setOffers((prev) => prev.map((item) => (item.id === offer.id ? { ...item, isActive: nextValue } : item)));
                                try {
                                  await handleUpdateStorefrontOffer(offer.id, { isActive: nextValue });
                                } catch (error) {
                                  console.error('Failed to toggle offer visibility:', error);
                                  setOffers((prev) => prev.map((item) => (item.id === offer.id ? { ...item, isActive: isOn } : item)));
                                }
                              }}
                              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                isOn ? 'bg-accent text-accent-foreground' : 'bg-destructive/10 text-destructive'
                              }`}
                            >
                              {isOn ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                              {isOn ? 'ON' : 'OFF'}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Databaze tab — Supabase Storage image manager */}
        {activeTab === 'databaze' && (
          <div className="space-y-4">
            {/* Header & Sub-tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <HardDrive className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-lg">Databaze & Storage</h2>
                  <p className="text-xs text-muted-foreground">
                    Supabase: {dbImages.length} foto · {(dbImages.reduce((s, f) => s + f.size, 0) / 1024 / 1024).toFixed(2)} MB
                    {' · '}Lokale: {(LOCAL_ASSETS_TOTAL / 1024 / 1024).toFixed(2)} MB · Total: {((dbImages.reduce((s, f) => s + f.size, 0) + LOCAL_ASSETS_TOTAL) / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex bg-secondary p-1 rounded-full">
                  <button
                    onClick={() => setDbSubTab('storage')}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      dbSubTab === 'storage' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                    }`}
                  >
                    Supabase
                  </button>
                  <button
                    onClick={() => setDbSubTab('local')}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      dbSubTab === 'local' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                    }`}
                  >
                    Lokale
                  </button>
                  <button
                    onClick={() => setDbSubTab('content')}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      dbSubTab === 'content' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                    }`}
                  >
                    Përmbajtja
                  </button>
                </div>
                <button
                  onClick={loadDbImages}
                  disabled={dbLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-sm font-medium hover:bg-secondary/80 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${dbLoading ? 'animate-spin' : ''}`} />
                  Rifresko
                </button>
              </div>
            </div>

            {/* Replace file input (hidden) */}
            <input ref={dbReplaceRef} type="file" accept="image/*" className="hidden" onChange={handleDbReplace} />

            {dbSubTab === 'storage' && (
              <div className="space-y-4">
                {dbLoading && (
                  <div className="text-center py-12 text-muted-foreground text-sm">Duke ngarkuar imazhet...</div>
                )}

                {!dbLoading && dbImages.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground text-sm">
                    Nuk u gjetën imazhe në bucket-in product-images
                  </div>
                )}

                {!dbLoading && dbImages.length > 0 && (
                  <div className="grid gap-3">
                    {dbImages.map((img) => {
                      // Check if this image is being used
                      const isUsedInProducts = items.some(i => i.image && i.image.includes(img.path));
                      const isUsedInOffers = offers.some(o => o.image && o.image.includes(img.path));
                      const isUsed = isUsedInProducts || isUsedInOffers;

                      return (
                        <div key={img.path} className={`bg-card rounded-2xl shadow-card p-3 flex items-center gap-3 border-2 transition-all ${isUsed ? 'border-transparent' : 'border-dashed border-amber-500/30 bg-amber-500/5'}`}>
                          {/* Thumbnail */}
                          <div className="w-16 h-16 rounded-xl overflow-hidden bg-secondary shrink-0">
                            <img
                              src={img.publicUrl}
                              alt={img.name}
                              className="w-full h-full object-cover"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-xs font-bold truncate text-foreground">{img.path}</p>
                              {!isUsed && (
                                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold uppercase">Pa përdorur</span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {img.size > 0 ? `${(img.size / 1024 / 1024).toFixed(2)} MB` : '— MB'}
                            </p>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => { setReplacingPath(img.path); dbReplaceRef.current?.click(); }}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-xs font-medium hover:bg-secondary/80 transition-colors"
                            >
                              <Upload className="w-3.5 h-3.5" /> Zëvendëso
                            </button>

                            {confirmDeleteStoragePath === img.path ? (
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => handleDbDelete(img.path)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive text-white text-xs font-bold animate-pulse"
                                >
                                  <AlertTriangle className="w-3.5 h-3.5" /> Konfirmo fshirjen
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteStoragePath(null)}
                                  className="px-2 py-1.5 rounded-full bg-secondary text-xs"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteStoragePath(img.path)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Fshij
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {dbSubTab === 'local' && (
              <div className="space-y-4">
                {/* Category summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(
                    [
                      { cat: 'reviews' as const,  label: 'Reviews',  files: LOCAL_ASSETS.filter(a => a.category === 'reviews')  },
                      { cat: 'menu' as const,      label: 'Menu',     files: LOCAL_ASSETS.filter(a => a.category === 'menu')     },
                      { cat: 'branding' as const,  label: 'Branding', files: LOCAL_ASSETS.filter(a => a.category === 'branding') },
                      { cat: 'public' as const,    label: 'Public',   files: LOCAL_ASSETS.filter(a => a.category === 'public')   },
                    ]
                  ).map(({ cat, label, files }) => {
                    const total = files.reduce((s, f) => s + f.size, 0);
                    return (
                      <div key={cat} className={`rounded-2xl p-4 ${CAT_STYLES[cat].card}`}>
                        <p className={`text-[10px] font-bold uppercase tracking-wide ${CAT_STYLES[cat].label}`}>{label}</p>
                        <p className="text-xl font-display font-bold mt-1">
                          {(total / 1024 / 1024).toFixed(2)}{' '}
                          <span className="text-sm font-normal text-muted-foreground">MB</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{files.length} foto</p>
                      </div>
                    );
                  })}
                </div>

                {/* Total bar */}
                <div className="bg-card rounded-2xl p-4 shadow-card flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-foreground">Total lokale</p>
                    <p className="text-[10px] text-muted-foreground">{LOCAL_ASSETS.length} foto · bundled me app</p>
                  </div>
                  <p className="text-2xl font-display font-bold tabular-nums">
                    {(LOCAL_ASSETS_TOTAL / 1024 / 1024).toFixed(2)}{' '}
                    <span className="text-sm font-normal text-muted-foreground">MB</span>
                  </p>
                </div>

                {/* Files list — sorted biggest first */}
                <div className="grid gap-2">
                  {[...LOCAL_ASSETS].sort((a, b) => b.size - a.size).map((asset) => {
                    const filename = asset.path.split('/').pop() ?? asset.path;
                    const dir = asset.path.split('/').slice(0, -1).join('/');
                    return (
                      <div key={asset.path} className="bg-card rounded-2xl shadow-card p-3 flex items-center gap-3">
                        <div className="w-16 h-16 rounded-xl overflow-hidden bg-secondary shrink-0">
                          {asset.thumb
                            ? <img src={asset.thumb} alt={filename} className="w-full h-full object-cover" />
                            : <div className="w-full h-full flex items-center justify-center"><Image className="w-5 h-5 text-muted-foreground" /></div>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs font-bold text-foreground truncate max-w-[180px]">{filename}</p>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${CAT_STYLES[asset.category].badge}`}>
                              {asset.category}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{dir}</p>
                          <p className="text-[10px] text-muted-foreground">Perdoret: <span className="font-medium">{asset.usedIn}</span></p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-bold tabular-nums">
                            {asset.size >= 1024 * 1024
                              ? `${(asset.size / 1024 / 1024).toFixed(2)} MB`
                              : `${(asset.size / 1024).toFixed(0)} KB`}
                          </p>
                          <p className="text-[10px] text-muted-foreground">bundled</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[10px] text-muted-foreground text-center pt-2">
                  Këto foto janë të ngulitura në bundle. Për t'i zëvendësuar, ndrysho skedarin lokal dhe bëj rebuild.
                </p>
              </div>
            )}

            {dbSubTab === 'content' && (
              <div className="space-y-6">
                {/* Products Summary */}
                <div className="bg-card rounded-2xl p-5 shadow-card space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-primary">Produkte ({items.length})</h3>
                    <Package className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items.map(product => (
                      <div key={product.id} className="p-3 bg-secondary/50 rounded-xl flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-secondary overflow-hidden shrink-0">
                          {product.image && <img src={product.image} className="w-full h-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{product.name.sq}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{product.image ? 'Me foto' : 'Pa foto'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Offers Summary */}
                <div className="bg-card rounded-2xl p-5 shadow-card space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-primary">Ofertat ({offers.length})</h3>
                    <Plus className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {offers.map(offer => (
                      <div key={offer.id} className="p-3 bg-secondary/50 rounded-xl flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-secondary overflow-hidden shrink-0">
                          {offer.image && <img src={offer.image} className="w-full h-full object-cover" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{offer.title}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{offer.image ? 'Me foto' : 'Pa foto'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* (Texts moved into 'content' tab above) */}
      </div>
    </div>
  );
};

export default Admin;
