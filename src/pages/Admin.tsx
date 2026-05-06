import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Lock, LogOut, Save, Eye, EyeOff, Upload, Package, Plus, Trash2, Image, ToggleLeft, ToggleRight, X, ChevronUp, ChevronDown, Type, Phone, Edit2, HardDrive, RefreshCw, AlertTriangle, Map } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchDrivers, createDriver, updateDriver, deleteDriver, seedDefaultDrivers, subscribeAllDriverLocations, type DeliveryDriver } from '@/lib/driversApi';
import DriverLocationMap from '@/components/DriverLocationMap';
import { menuItems as initialMenuItems, ofertaRamazani as initialOffers } from '@/data/menuData';
import { defaultMenuExtras } from '@/data/menuExtras';
import { getIngredientName } from '@/data/ingredientTranslations';
import type { MenuItem } from '@/types/menu';
import type { MenuExtra } from '@/types/menuExtra';
import {
  OFFERS_SECTION_ENABLED_KEY,
  SITE_TEXTS_SETTING_KEY,
  type StorefrontOffer,
  deleteStorefrontOffer,
  deleteMenuExtra,
  deleteProduct,
  ensureSeedMenuExtras,
  ensureSeedStorefrontOffers,
  ensureStorefrontSetting,
  fetchMenuExtras,
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
  uploadStorefrontOfferImage,
  updateProductSortOrder,
} from '@/lib/productsApi';
import { getOptimizedImage } from '@/lib/utils';
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
                <label className="text-xs text-muted-foreground flex items-center gap-1.5">
                  {textLabels[key]}
                  {isOverridden && <span className="text-[10px] text-primary font-medium">(ndryshuar)</span>}
                </label>
                <input
                  value={getValue(key)}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className={`w-full px-3 py-2 rounded-lg border-0 text-sm focus:ring-2 focus:ring-primary/20 transition-all ${
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

const ADMIN_PASSWORD = 'Pass123.';
const ADMIN_AUTH_KEY = 'papirun_admin_authed';

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
    seedDefaultDrivers().catch(() => {}).finally(reload);
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
      {/* Live colored driver map */}
      <DriverLocationMap drivers={drivers} height="340px" allowFullscreen />

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
            <input value={newForm.name} onChange={(e) => setNewForm((p) => ({ ...p, name: e.target.value }))} placeholder="Emri (Delivery4)" className="px-3 py-2 rounded-lg bg-secondary text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none" />
            <input value={newForm.phone} onChange={(e) => setNewForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Telefon (opsional)" className="px-3 py-2 rounded-lg bg-secondary text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none" />
            <input value={newForm.pin} onChange={(e) => setNewForm((p) => ({ ...p, pin: e.target.value }))} placeholder="Fjalëkalimi" className="px-3 py-2 rounded-lg bg-secondary text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none" />
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
          {drivers.map((d) => (
            <div key={d.id} className={`bg-card rounded-2xl p-4 shadow-card border border-border/40 transition-opacity ${!d.isActive ? 'opacity-60' : ''}`}>
              {editingId === d.id ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-2">
                    <input value={editForm.name} onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))} placeholder="Emri" className="px-3 py-2 rounded-lg bg-secondary text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none" />
                    <input value={editForm.phone} onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Telefon" className="px-3 py-2 rounded-lg bg-secondary text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none" />
                    <input value={editForm.pin} onChange={(e) => setEditForm((p) => ({ ...p, pin: e.target.value }))} placeholder="Fjalëkalimi" className="px-3 py-2 rounded-lg bg-secondary text-sm focus:ring-2 focus:ring-primary/20 focus:outline-none" />
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
                      <p className="font-semibold text-sm">{d.name}</p>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${d.isActive ? 'bg-emerald-500/15 text-emerald-600' : 'bg-secondary text-muted-foreground'}`}>
                        {d.isActive ? 'Aktiv' : 'Jo aktiv'}
                      </span>
                    </div>
                    {d.phone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3" /> {d.phone}
                      </p>
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

const Admin = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    try { return localStorage.getItem(ADMIN_AUTH_KEY) === '1'; } catch { return false; }
  });
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [items, setItems] = useState<MenuItem[]>(initialMenuItems);
  const [menuExtras, setMenuExtras] = useState<MenuExtra[]>(defaultMenuExtras);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'menu' | 'extras' | 'content' | 'offers' | 'users' | 'drivers' | 'harta' | 'databaze'>('orders');
  const [contentSubTab, setContentSubTab] = useState<'texts' | 'locations' | 'replies'>('texts');
  const [ofertaEnabled, setOfertaEnabled] = useState(true);
  const [offers, setOffers] = useState<StorefrontOffer[]>(() =>
    initialOffers.map((offer, index) => ({ ...offer, isActive: true, sortOrder: index }))
  );
  const [editingOffer, setEditingOffer] = useState<string | null>(null);
  const [newIngredient, setNewIngredient] = useState('');
  const [newExtra, setNewExtra] = useState('');
  const [editingExtraId, setEditingExtraId] = useState<string | null>(null);
  const offerFileRef = useRef<HTMLInputElement>(null);
  const [uploadingOfferId, setUploadingOfferId] = useState<string | null>(null);
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<string | null>(null);
  const [confirmDeleteOfferId, setConfirmDeleteOfferId] = useState<string | null>(null);

  // Harta tab — live driver list
  const [hartaDrivers, setHartaDrivers] = useState<DeliveryDriver[]>([]);
  useEffect(() => {
    if (activeTab !== 'harta') return;
    fetchDrivers().then(setHartaDrivers).catch(console.error);
    const unsub = subscribeAllDriverLocations(() => fetchDrivers().then(setHartaDrivers).catch(console.error));
    return unsub;
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

  const { items: liveItems } = useLiveMenuItems();

  useEffect(() => {
    setItems(liveItems);
  }, [liveItems]);

  useEffect(() => {
    let isMounted = true;

    const syncOffers = async () => {
      try {
        await ensureSeedStorefrontOffers(initialOffers);
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

    syncOffers();
    syncOfertaEnabled();
    // Seed all 6 default drivers on every admin mount so they exist before the Shoferët tab is opened
    seedDefaultDrivers().catch(() => {});

    const unsubscribeOffers = subscribeStorefrontOffersRealtime(syncOffers);
    const unsubscribeSettings = subscribeStorefrontSettingsRealtime(syncOfertaEnabled);

    return () => {
      isMounted = false;
      unsubscribeOffers();
      unsubscribeSettings();
    };
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setIsAuthenticated(true);
      try { localStorage.setItem(ADMIN_AUTH_KEY, '1'); } catch {}
      setError('');
    } else {
      setError(language === 'sq' ? 'Fjalekalimi i gabuar' : 'Wrong password');
    }
  };

  const updateItem = (id: string, updates: Partial<MenuItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  };

  const handleUpdate = async (id: string, updates: Partial<MenuItem>) => {
    try {
      await handleUpdateProduct(id, updates);
    } catch (updateError) {
      console.error('Failed to update product:', updateError);
    }
  };

  const handleSaveItem = async (item: MenuItem) => {
    try {
      await upsertProduct(item);
      setEditingItem(null);
    } catch (saveError) {
      console.error('Failed to save product:', saveError);
    }
  };

  const toggleAvailability = (id: string) => {
    const target = items.find((item) => item.id === id);
    if (!target) return;
    const nextAvailability = !target.isAvailable;
    updateItem(id, { isAvailable: nextAvailability });
    handleUpdate(id, { isAvailable: nextAvailability });
  };

  const addNewItem = () => {
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
    };
    setItems((prev) => [newItem, ...prev]);
    setEditingItem(newItem.id);
  };

  const deleteItem = async (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
    try {
      await deleteProduct(id);
    } catch (deleteError) {
      console.error('Failed to delete product:', deleteError);
    }
  };

  const handleImageUpload = (id: string) => {
    setUploadingItemId(id);
    fileInputRef.current?.click();
  };

  const handlePasteImage = async (e: React.ClipboardEvent, itemId: string) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          try {
            const publicUrl = await uploadProductImage(file, itemId);
            updateItem(itemId, { image: publicUrl });
            await handleUpdate(itemId, { image: publicUrl });
          } catch (uploadError) {
            console.error('Image paste upload failed:', uploadError);
          }
        }
        break;
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && uploadingItemId) {
      try {
        const publicUrl = await uploadProductImage(file, uploadingItemId);
        updateItem(uploadingItemId, { image: publicUrl });
        await handleUpdate(uploadingItemId, { image: publicUrl });
      } catch (uploadError) {
        console.error('Image upload failed:', uploadError);
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

  const handleSaveOffer = async (offer: StorefrontOffer) => {
    try {
      await upsertStorefrontOffer(offer, offer.sortOrder);
      setEditingOffer(null);
    } catch (error) {
      console.error('Failed to save offer:', error);
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
    const { error } = await client.storage.from('product-images').upload(replacingPath, file, { upsert: true });
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
    } catch (error) {
      console.error('Failed to delete offer:', error);
      setOffers(previousOffers);
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
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={language === 'sq' ? 'Fjalekalimi' : 'Password'}
                className="w-full px-4 py-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
              />
              {error && <p className="text-destructive text-xs mt-2">{error}</p>}
            </div>
            <button type="submit" className="btn-sage w-full">
              {language === 'sq' ? 'Hyr' : 'Login'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  

  return (
    <div className="min-h-screen bg-background">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
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
              <h1 className="font-display font-bold text-lg">Papirun Admin</h1>
              <p className="text-xs text-muted-foreground">Dashboard</p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsAuthenticated(false);
              try { localStorage.removeItem(ADMIN_AUTH_KEY); } catch {}
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-secondary hover:bg-secondary/80 transition-colors text-sm"
          >
            <LogOut className="w-4 h-4" />
            {language === 'sq' ? 'Dil' : 'Logout'}
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {/* Main tabs (big navbar) */}
        <div className="flex gap-2 mb-4 overflow-x-auto -mx-1 px-1">
          {(['orders', 'users', 'drivers', 'harta', 'menu', 'offers', 'content', 'databaze'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-6 py-3 rounded-2xl text-sm font-semibold transition-all whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-primary text-primary-foreground shadow-glow'
                  : 'bg-secondary hover:bg-secondary/80'
              }`}
            >
              {tab === 'orders' ? (language === 'sq' ? 'Porositë' : 'Orders')
                : tab === 'users' ? (language === 'sq' ? 'Përdoruesit' : 'Users')
                : tab === 'drivers' ? (language === 'sq' ? 'Shoferët' : 'Drivers')
                : tab === 'harta' ? '🗺 Harta'
                : tab === 'menu' ? (language === 'sq' ? 'Menuja' : 'Menu')
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

        {activeTab === 'orders' && <OrdersReview />}
        {activeTab === 'users' && <SubscribersList />}
        {activeTab === 'drivers' && (
          <div className="space-y-8">
            <DriversManager />
            <DriversKPI />
          </div>
        )}
        {activeTab === 'harta' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Map className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="font-display font-bold text-lg">Harta Live e Shoferëve</h2>
                <p className="text-xs text-muted-foreground">
                  {hartaDrivers.filter((d) => d.lat != null).length} / {hartaDrivers.length} shoferë me pozicion aktiv
                </p>
              </div>
            </div>
            <DriverLocationMap drivers={hartaDrivers} height="600px" allowFullscreen />
            {/* Legend */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {hartaDrivers.map((d) => (
                <div key={d.id} className="bg-card rounded-xl p-3 flex items-center gap-2.5 shadow-sm border border-border/40">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
                    style={{ background: d.color || '#6b7280' }}
                  >
                    {d.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{d.name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {d.lat != null ? '📍 Online' : 'Offline'}
                      {!d.isActive && ' · Jo aktiv'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {activeTab === 'content' && contentSubTab === 'locations' && <LocationsEditor />}
        {activeTab === 'content' && contentSubTab === 'replies' && <QuickRepliesEditor />}
        {activeTab === 'content' && contentSubTab === 'texts' && <SiteTextsEditor language={language} />}

        {/* Menu Manager */}
        {activeTab === 'menu' && (
          <div className="space-y-3">
            {/* Add New Button */}
            <button
              onClick={addNewItem}
              className="w-full py-4 rounded-2xl border-2 border-dashed border-primary/30 text-primary hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Plus className="w-5 h-5" />
              {language === 'sq' ? 'Shto Produkt te Ri' : 'Add New Product'}
            </button>

            {(['sandwich', 'salad', 'fajita', 'sides'] as const).map((cat) => {
              const catItems = items.filter((i) => i.category === cat);
              if (catItems.length === 0) return null;
              const catLabel = cat === 'sandwich' ? (language === 'sq' ? 'Sanduiçe' : 'Sandwiches')
                : cat === 'salad' ? (language === 'sq' ? 'Sallata' : 'Salads')
                : cat === 'fajita' ? (language === 'sq' ? 'Fajita' : 'Fajitas')
                : (language === 'sq' ? 'Supë & Ekstra' : 'Soup & Extras');

              const moveItem = async (itemId: string, direction: 'up' | 'down') => {
                const idx = catItems.findIndex(i => i.id === itemId);
                if (idx < 0) return;
                const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
                if (swapIdx < 0 || swapIdx >= catItems.length) return;
                
                const allItems = [...items];
                const aIdx = allItems.findIndex(i => i.id === catItems[idx].id);
                const bIdx = allItems.findIndex(i => i.id === catItems[swapIdx].id);
                
                // swap sort orders
                const newSortA = swapIdx;
                const newSortB = idx;
                
                // swap in local state
                [allItems[aIdx], allItems[bIdx]] = [allItems[bIdx], allItems[aIdx]];
                setItems(allItems);
                
                // persist to DB
                try {
                  await updateProductSortOrder(catItems[idx].id, newSortA);
                  await updateProductSortOrder(catItems[swapIdx].id, newSortB);
                } catch (err) {
                  console.error('Failed to update sort order:', err);
                }
              };

              return (
                <div key={cat} className="space-y-3">
                  <h2 className="text-lg font-display font-bold text-primary mt-4 mb-1">{catLabel}</h2>
                  {catItems.map((item, catIdx) => (
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
                      disabled={catIdx === 0}
                      className="p-1 rounded hover:bg-secondary disabled:opacity-20 transition-colors"
                      title={language === 'sq' ? 'Lart' : 'Move up'}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => moveItem(item.id, 'down')}
                      disabled={catIdx === catItems.length - 1}
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
                        className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm"
                      >
                        <Upload className="w-3.5 h-3.5" />
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
                            </select>
                          </div>
                        </div>

                        {/* Ingredients Management */}
                        <div>
                          <label className="text-xs text-muted-foreground font-medium">
                            {language === 'sq' ? 'Përberësit' : 'Ingredients'}
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
                              value={editingItem === item.id ? newIngredient : ''}
                              onChange={(e) => setNewIngredient(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newIngredient.trim()) {
                                  updateItem(item.id, { ingredients: [...item.ingredients, newIngredient.trim().toLowerCase()] });
                                  setNewIngredient('');
                                }
                              }}
                              placeholder={language === 'sq' ? 'Shto përbërës...' : 'Add ingredient...'}
                              className="flex-1 px-3 py-1.5 rounded-lg bg-secondary border-0 text-xs focus:ring-2 focus:ring-primary/20"
                            />
                            <button
                              onClick={() => {
                                if (newIngredient.trim()) {
                                  updateItem(item.id, { ingredients: [...item.ingredients, newIngredient.trim().toLowerCase()] });
                                  setNewIngredient('');
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
                            {(item.extras || []).map((ext, idx) => (
                              <span key={idx} className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium">
                                + {getIngredientName(ext, language)} <span className="text-muted-foreground/60 text-[10px]">({ext})</span>
                                <button
                                  onClick={() => updateItem(item.id, { extras: (item.extras || []).filter((_, i) => i !== idx) })}
                                  className="hover:text-destructive"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-2 mt-2">
                            <input
                              value={editingItem === item.id ? newExtra : ''}
                              onChange={(e) => setNewExtra(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newExtra.trim()) {
                                  updateItem(item.id, { extras: [...(item.extras || []), newExtra.trim().toLowerCase()] });
                                  setNewExtra('');
                                }
                              }}
                              placeholder={language === 'sq' ? 'Shto ekstra...' : 'Add extra...'}
                              className="flex-1 px-3 py-1.5 rounded-lg bg-secondary border-0 text-xs focus:ring-2 focus:ring-primary/20"
                            />
                            <button
                              onClick={() => {
                                if (newExtra.trim()) {
                                  updateItem(item.id, { extras: [...(item.extras || []), newExtra.trim().toLowerCase()] });
                                  setNewExtra('');
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
                            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium"
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
                          <span className="text-primary font-bold text-sm shrink-0">
                            €{item.price.toFixed(2)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {item.description[language]}
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <button
                            onClick={() => setEditingItem(item.id)}
                            className="px-3 py-1.5 rounded-full bg-secondary text-xs font-medium hover:bg-secondary/80 transition-colors"
                          >
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
            })}
          </div>
        )}

        {/* Offers Manager */}
        {activeTab === 'offers' && (
          <div className="space-y-6">
            <input
              ref={offerFileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && uploadingOfferId) {
                  uploadStorefrontOfferImage(file, uploadingOfferId)
                    .then(async (publicUrl) => {
                      setOffers((prev) => prev.map((o) => (o.id === uploadingOfferId ? { ...o, image: publicUrl } : o)));
                      await handleUpdateStorefrontOffer(uploadingOfferId, { image: publicUrl });
                    })
                    .catch((error) => {
                      console.error('Offer image upload failed:', error);
                    })
                    .finally(() => {
                      setUploadingOfferId(null);
                    });
                }
                e.target.value = '';
              }}
            />

            {/* Master toggle */}
            <div className="bg-card rounded-2xl p-5 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-semibold text-lg">
                    🌙 {language === 'sq' ? 'Seksioni i Ofertave' : 'Offers Section'}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
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
                return (
                  <div key={offer.id} className={`bg-card rounded-2xl p-4 shadow-card transition-all ${!isOn ? 'opacity-60' : ''}`}>
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0">
                        {offer.image ? (
                          <img src={getOptimizedImage(offer.image)} alt={offer.title} className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-contain" />
                        ) : (
                          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-secondary flex items-center justify-center">
                            <Image className="w-6 h-6 text-muted-foreground" />
                          </div>
                        )}
                        {editingOffer === offer.id && (
                          <button
                            onClick={() => { setUploadingOfferId(offer.id); offerFileRef.current?.click(); }}
                            className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm"
                          >
                            <Upload className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {editingOffer === offer.id ? (
                          <div className="space-y-3">
                            <input
                              value={offer.title}
                              onChange={(e) => setOffers(prev => prev.map(o => o.id === offer.id ? { ...o, title: e.target.value } : o))}
                              placeholder="Title"
                              className="w-full px-3 py-2 rounded-lg bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20"
                            />
                            <textarea
                              value={offer.description}
                              onChange={(e) => setOffers(prev => prev.map(o => o.id === offer.id ? { ...o, description: e.target.value } : o))}
                              rows={2}
                              className="w-full px-3 py-2 rounded-lg bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20 resize-none"
                            />
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
