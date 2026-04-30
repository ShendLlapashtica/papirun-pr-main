import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import AppHome from '@/components/app/AppHome';
import ProfileView from '@/components/app/ProfileView';
import OrdersView from '@/components/app/OrdersView';
import CartView from '@/components/app/CartView';
import { useCart } from '@/contexts/CartContext';

const Home = () => {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<string>(params.get('tab') ?? 'home');
  const { setIsTrayOpen, setIsCheckoutOpen } = useCart();

  useEffect(() => {
    const next = params.get('tab') ?? 'home';
    setTab(next);
    // Strict separation: switching tabs ALWAYS closes any lingering overlays.
    setIsTrayOpen(false);
    if (next !== 'cart') setIsCheckoutOpen(false);
  }, [params, setIsTrayOpen, setIsCheckoutOpen]);

  return (
    <AppShell>
      {tab === 'cart' ? <CartView />
        : tab === 'orders' ? <OrdersView />
        : tab === 'profile' ? <ProfileView />
        : <AppHome />}
    </AppShell>
  );
};

export default Home;
