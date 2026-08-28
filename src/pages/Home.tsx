import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import AppHome from '@/components/app/AppHome';
import ProfileView from '@/components/app/ProfileView';
import OrdersView from '@/components/app/OrdersView';
import CartView from '@/components/app/CartView';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';

const Home = () => {
  const [params] = useSearchParams();
  const [tab, setTab] = useState<string>(params.get('tab') ?? 'home');
  const { setIsTrayOpen, setIsCheckoutOpen } = useCart();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // The app channel requires an account — no guest access.
    if (!loading && !user) navigate('/login2', { replace: true });
  }, [loading, user, navigate]);

  useEffect(() => {
    const next = params.get('tab') ?? 'home';
    setTab(next);
    // Strict separation: switching tabs ALWAYS closes any lingering overlays.
    setIsTrayOpen(false);
    if (next !== 'cart') setIsCheckoutOpen(false);
  }, [params, setIsTrayOpen, setIsCheckoutOpen]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

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
