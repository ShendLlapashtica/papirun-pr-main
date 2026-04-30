import { Home, ShoppingBag, ClipboardList, User, MessageCircle } from 'lucide-react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { cn } from '@/lib/utils';

/**
 * Floating glass BottomNav for the App.
 *
 * Strict section separation (per user feedback):
 *  - Kreu     → /home (no ?tab) → AppHome
 *  - Porositë → ?tab=orders     → OrdersView
 *  - Chat     → ?tab=orders     → OrdersView (centered elevated button)
 *  - Shporta  → ?tab=cart       → CartView (a REAL section, not a drawer)
 *  - Profili  → ?tab=profile    → ProfileView
 *
 * Cart NEVER opens from Kreu. The cart drawer (Tray) is no longer triggered
 * from the navbar; Home.tsx closes it on every tab change for safety.
 */
const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { cartCount } = useCart();

  const onHome = location.pathname === '/home';
  const currentTab = params.get('tab') ?? 'home';

  const goTab = (tab: 'home' | 'orders' | 'profile' | 'cart') => {
    if (onHome) {
      const next = new URLSearchParams(params);
      if (tab === 'home') next.delete('tab'); else next.set('tab', tab);
      next.delete('search'); // clear search noise across tab switches
      if (next.toString() === params.toString()) return;
      setParams(next, { replace: true });
    } else {
      navigate(tab === 'home' ? '/home' : `/home?tab=${tab}`);
    }
  };

  const items = [
    { key: 'home',    icon: Home,          label: 'Kreu',     onTap: () => goTab('home') },
    { key: 'orders',  icon: ClipboardList, label: 'Porositë', onTap: () => goTab('orders') },
    { key: 'chat',    icon: MessageCircle, label: 'Chat',     onTap: () => goTab('orders'), center: true },
    { key: 'cart',    icon: ShoppingBag,   label: 'Shporta',  onTap: () => goTab('cart'), badge: cartCount },
    { key: 'profile', icon: User,          label: 'Profili',  onTap: () => goTab('profile') },
  ];

  const isActive = (key: string) => {
    if (!onHome) return false;
    if (key === 'chat') return false; // chat shares 'orders' tab visually but isn't its own tab
    if (key === 'home') return currentTab === 'home';
    return currentTab === key;
  };

  return (
    <nav
      className="fixed left-1/2 -translate-x-1/2 z-50 w-full pointer-events-none"
      style={{
        maxWidth: '430px',
        bottom: 'calc(env(safe-area-inset-bottom) + 16px)',
      }}
    >
      <div className="mx-4 rounded-full pointer-events-none app-glass-strong app-card-shadow">
        <div className="grid grid-cols-5 items-end px-2 py-2 min-h-16">
          {items.map(({ key, icon: Icon, label, onTap, badge, center }) => {
            const active = isActive(key);
            return (
              <button
                key={key}
                onClick={onTap}
                type="button"
                className={cn(
                  center
                    ? 'pointer-events-auto relative -mt-8 mx-auto flex h-[64px] w-[64px] items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform active:scale-95'
                    : 'pointer-events-auto flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-2xl transition-colors relative active:scale-95',
                  !center && (active ? 'text-primary' : 'text-[hsl(var(--app-muted-text))] hover:text-foreground')
                )}
                style={{ touchAction: 'manipulation' }}
                aria-label={label}
              >
                <div className="relative">
                  <Icon
                    className={cn(center ? 'w-6 h-6' : 'w-[22px] h-[22px]')}
                    strokeWidth={active || center ? 2.6 : 2}
                  />
                  {key === 'cart' && typeof badge === 'number' && badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-md ring-2 ring-white/40">
                      {badge > 9 ? '9+' : badge}
                    </span>
                  )}
                </div>
                {!center && (
                  <span className={cn('text-[10px] leading-none mt-0.5', active ? 'font-bold text-primary' : 'font-semibold text-[hsl(var(--app-muted-text))]')}>
                    {label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
