import { useEffect, useState } from 'react';
import { Heart, MapPin, RotateCcw, LogOut, Loader2, Trash2, Star, Settings as SettingsIcon, Bell, ChevronRight, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useFavorites } from '@/contexts/FavoritesContext';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLiveMenuItems } from '@/hooks/useLiveStorefrontData';
import { fetchAddresses, deleteAddress, setDefaultAddress, type SavedAddress } from '@/lib/addressesApi';
import { fetchAllOrders, type OrderRecord } from '@/lib/ordersApi';
import logo from '@/assets/logo.png';
import { cn, getOptimizedImage } from '@/lib/utils';

type Tab = 'favorites' | 'addresses' | 'reorder' | 'settings';

const ProfileView = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { favorites, toggleFavorite } = useFavorites();
  const { addToCart } = useCart();
  const { language, setLanguage } = useLanguage();
  const { items: menuItems } = useLiveMenuItems();
  const [tab, setTab] = useState<Tab>('favorites');
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [pastOrders, setPastOrders] = useState<OrderRecord[]>([]);
  const [loadingAddr, setLoadingAddr] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoadingAddr(true);
    fetchAddresses(user.id).then(setAddresses).catch(() => {}).finally(() => setLoadingAddr(false));
  }, [user]);

  useEffect(() => {
    if (!user || tab !== 'reorder') return;
    setLoadingOrders(true);
    fetchAllOrders()
      .then((all) => setPastOrders(all.filter((o) => o.userId === user.id).slice(0, 20)))
      .catch(() => {})
      .finally(() => setLoadingOrders(false));
  }, [user, tab]);

  const favProducts = menuItems.filter((p) => favorites.has(p.id));
  const orderCount = pastOrders.length;

  const handleReorder = (order: OrderRecord) => {
    let added = 0;
    order.items.forEach((it: any) => {
      const product = menuItems.find((p) => p.id === it.id);
      if (product) {
        for (let i = 0; i < (it.quantity || 1); i++) {
          addToCart(product, it.removedIngredients || [], it.addedExtras || []);
          added++;
        }
      }
    });
    if (added > 0) toast.success(`U shtuan ${added} produkte në shportë`);
    else toast.error('Produktet nuk janë më në dispozicion');
  };

  const handleDeleteAddr = async (id: string) => {
    if (!window.confirm('Fshi këtë adresë?')) return;
    try {
      await deleteAddress(id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      toast.success('U fshi');
    } catch { toast.error('Gabim'); }
  };

  const handleSetDefault = async (id: string) => {
    if (!user) return;
    try {
      await setDefaultAddress(user.id, id);
      setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
      toast.success('Vendosur si default');
    } catch { toast.error('Gabim'); }
  };

  const handleSignOut = async () => {
    if (!window.confirm(language === 'sq' ? 'A doni të dilni nga llogaria?' : 'Sign out?')) return;
    await signOut();
    navigate('/login');
  };

  const TabBtn = ({ id, icon: Icon, label }: { id: Tab; icon: any; label: string }) => {
    const active = tab === id;
    return (
      <button
        onClick={() => setTab(id)}
        className={cn(
          'flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl text-[11px] font-semibold transition-all active:scale-95 border',
          active
            ? 'bg-[hsl(var(--app-action-bg))] text-white border-transparent shadow-md shadow-black/5'
            : 'app-glass text-[hsl(var(--app-foreground))] border-white/30'
        )}
      >
        <Icon className="w-4 h-4" strokeWidth={active ? 2.4 : 2} />
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className="px-4 py-4">
      {/* Hero glass header */}
      <div className="app-glass rounded-[28px] p-5 mb-4 relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="flex items-center gap-3 relative">
          <div className="w-16 h-16 rounded-full bg-white/60 backdrop-blur-md border border-white/40 flex items-center justify-center shrink-0 shadow-sm">
            <span className="text-xl font-bold text-[hsl(var(--app-action-bg))]">
              {user?.email?.charAt(0).toUpperCase() ?? 'P'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-[15px] text-[hsl(var(--app-foreground))] truncate">
              {user?.email?.split('@')[0] ?? 'Mysafir'}
            </p>
            <p className="text-[11px] text-[hsl(var(--app-muted-text))] truncate flex items-center gap-1">
              <Mail className="w-3 h-3" /> {user?.email}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mt-4 relative">
          <Stat label={language === 'sq' ? 'Favoritet' : 'Favorites'} value={favProducts.length} />
          <Stat label={language === 'sq' ? 'Adresat' : 'Addresses'} value={addresses.length} />
          <Stat label={language === 'sq' ? 'Porositë' : 'Orders'} value={orderCount} />
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-4 gap-1.5 mb-4">
        <TabBtn id="favorites" icon={Heart} label="Favorites" />
        <TabBtn id="addresses" icon={MapPin} label="Adresat" />
        <TabBtn id="reorder" icon={RotateCcw} label="Riporosit" />
        <TabBtn id="settings" icon={SettingsIcon} label="Cilësimet" />
      </div>

      {/* Content */}
      {tab === 'favorites' && (
        <div className="space-y-2.5">
          {favProducts.length === 0 ? (
            <EmptyState icon={Heart} title="Asnjë favorit ende" subtitle="Shtypni ❤️ në çdo produkt" />
          ) : (
            favProducts.map((p) => (
              <div key={p.id} className="app-glass flex items-center gap-3 rounded-2xl p-3">
                <img src={getOptimizedImage(p.image)} alt={p.name[language]} className="w-14 h-14 rounded-xl object-contain bg-white shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[hsl(var(--app-foreground))] truncate">{p.name[language]}</p>
                  <p className="text-xs font-bold text-[hsl(var(--app-action-bg))]">€{p.price.toFixed(2)}</p>
                </div>
                <button
                  onClick={() => addToCart(p)}
                  className="px-3.5 py-2 rounded-xl bg-[hsl(var(--app-action-bg))] text-white text-xs font-semibold active:scale-95 transition-all"
                >
                  Shto
                </button>
                <button
                  onClick={() => toggleFavorite(p.id)}
                  className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 active:scale-95 transition-all"
                  aria-label="Hiq favoritin"
                >
                  <Heart className="w-4 h-4" fill="currentColor" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'addresses' && (
        <div className="space-y-2.5">
          {loadingAddr ? (
            <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /></div>
          ) : addresses.length === 0 ? (
            <EmptyState icon={MapPin} title="Asnjë adresë e ruajtur" subtitle="Adresat ruhen automatikisht në checkout" />
          ) : (
            addresses.map((a) => (
              <div key={a.id} className={cn('app-glass rounded-2xl p-3.5', a.isDefault && 'ring-2 ring-primary/40')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-[hsl(var(--app-foreground))]">{a.label}</span>
                      {a.isDefault && (
                        <span className="text-[9px] uppercase tracking-wider font-bold bg-primary/20 text-[hsl(var(--app-action-bg))] px-1.5 py-0.5 rounded">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[hsl(var(--app-muted-text))] line-clamp-2">{a.address}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {!a.isDefault && (
                      <button
                        onClick={() => handleSetDefault(a.id)}
                        className="p-2 rounded-lg text-[hsl(var(--app-muted-text))] hover:text-amber-500 hover:bg-amber-500/10 active:scale-90 transition-all"
                        aria-label="Vendos default"
                      >
                        <Star className="w-3.5 h-3.5" strokeWidth={2.2} />
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteAddr(a.id)}
                      className="p-2 rounded-lg text-[hsl(var(--app-muted-text))] hover:text-destructive hover:bg-destructive/10 active:scale-90 transition-all"
                      aria-label="Fshi"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={2.2} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'reorder' && (
        <div className="space-y-2.5">
          {loadingOrders ? (
            <div className="text-center py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto text-primary" /></div>
          ) : pastOrders.length === 0 ? (
            <EmptyState icon={RotateCcw} title="Asnjë porosi e mëparshme" />
          ) : (
            pastOrders.map((o) => (
              <div key={o.id} className="app-glass rounded-2xl p-3.5">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-[hsl(var(--app-muted-text))] font-medium">
                      {new Date(o.createdAt).toLocaleDateString('sq-AL', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-[hsl(var(--app-foreground))]/80 line-clamp-1 mt-0.5">
                      {o.items.map((i: any) => `${i.quantity}× ${i.name?.sq || i.name?.en || ''}`).join(' · ')}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-[hsl(var(--app-foreground))] shrink-0">€{o.total.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => handleReorder(o)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[hsl(var(--app-action-bg))] text-white text-xs font-semibold active:scale-95 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" strokeWidth={2.4} /> Riporosit
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'settings' && (
        <div className="space-y-3">
          {/* Language */}
          <div className="app-glass rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-[hsl(var(--app-muted-text))] mb-3">
              {language === 'sq' ? 'Gjuha · Language' : 'Language · Gjuha'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setLanguage('sq')}
                className={cn(
                  'py-3 rounded-xl text-xs font-semibold active:scale-95 transition-all border',
                  language === 'sq'
                    ? 'bg-[hsl(var(--app-action-bg))] text-white border-transparent shadow-sm'
                    : 'bg-white/60 text-[hsl(var(--app-foreground))] border-white/40'
                )}
              >
                🇦🇱 Shqip
              </button>
              <button
                onClick={() => setLanguage('en')}
                className={cn(
                  'py-3 rounded-xl text-xs font-semibold active:scale-95 transition-all border',
                  language === 'en'
                    ? 'bg-[hsl(var(--app-action-bg))] text-white border-transparent shadow-sm'
                    : 'bg-white/60 text-[hsl(var(--app-foreground))] border-white/40'
                )}
              >
                🇬🇧 English
              </button>
            </div>
          </div>

          {/* Quick links */}
          <div className="app-glass rounded-2xl overflow-hidden">
            <SettingRow icon={Bell} label={language === 'sq' ? 'Njoftimet' : 'Notifications'} hint={language === 'sq' ? 'Aktive' : 'On'} />
            <div className="border-t border-white/30" />
            <SettingRow icon={MapPin} label={language === 'sq' ? 'Adresat e ruajtura' : 'Saved addresses'} hint={`${addresses.length}`} onClick={() => setTab('addresses')} />
            <div className="border-t border-white/30" />
            <SettingRow icon={Heart} label={language === 'sq' ? 'Favoritet' : 'Favorites'} hint={`${favProducts.length}`} onClick={() => setTab('favorites')} />
          </div>

          {/* Account */}
          <div className="app-glass rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-[hsl(var(--app-muted-text))] mb-2.5">
              {language === 'sq' ? 'Llogaria' : 'Account'}
            </p>
            <p className="text-xs text-[hsl(var(--app-foreground))] mb-3 break-all">{user?.email}</p>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-destructive/15 text-destructive text-xs font-semibold active:scale-95 hover:bg-destructive/25 transition-all border border-destructive/20"
            >
              <LogOut className="w-4 h-4" strokeWidth={2.2} /> {language === 'sq' ? 'Dil nga llogaria' : 'Sign out'}
            </button>
          </div>

          <div className="text-center pt-3 pb-1">
            <img src={logo} alt="Papirun" className="w-10 h-10 mx-auto rounded-xl mb-2 opacity-70" />
            <p className="text-[10px] text-[hsl(var(--app-muted-text))]">Papirun · House of Crunch · v1.0</p>
          </div>
        </div>
      )}
    </div>
  );
};

const Stat = ({ label, value }: { label: string; value: number }) => (
  <div className="bg-white/55 backdrop-blur-md border border-white/40 rounded-2xl py-2.5 px-2 text-center">
    <p className="text-[18px] font-bold text-[hsl(var(--app-foreground))] leading-none">{value}</p>
    <p className="text-[10px] text-[hsl(var(--app-muted-text))] font-medium mt-1">{label}</p>
  </div>
);

const SettingRow = ({ icon: Icon, label, hint, onClick }: { icon: any; label: string; hint?: string; onClick?: () => void }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-white/40 transition-colors text-left"
  >
    <div className="w-9 h-9 rounded-xl bg-white/60 border border-white/40 flex items-center justify-center shrink-0">
      <Icon className="w-4 h-4 text-[hsl(var(--app-action-bg))]" strokeWidth={2.2} />
    </div>
    <span className="flex-1 text-sm font-semibold text-[hsl(var(--app-foreground))]">{label}</span>
    {hint && <span className="text-xs text-[hsl(var(--app-muted-text))] font-medium">{hint}</span>}
    <ChevronRight className="w-4 h-4 text-[hsl(var(--app-muted-text))]" strokeWidth={2.2} />
  </button>
);

const EmptyState = ({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) => (
  <div className="text-center py-12 rounded-2xl app-glass">
    <Icon className="w-10 h-10 mx-auto text-[hsl(var(--app-muted-text))]/50 mb-2" />
    <p className="text-sm font-semibold text-[hsl(var(--app-foreground))]">{title}</p>
    {subtitle && <p className="text-[11px] text-[hsl(var(--app-muted-text))] mt-1">{subtitle}</p>}
  </div>
);

export default ProfileView;
