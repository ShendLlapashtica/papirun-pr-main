import { useNavigate } from 'react-router-dom';
import AppShell from '@/components/AppShell';
import OfferView from './OfferView';
import { useCart } from '@/contexts/CartContext';

/**
 * AppOfferPage — offer view inside the AppShell, mirroring AppProductPage.
 * Keeps the app channel fully isolated: no web Header, BottomNav stays,
 * back returns to /home. Web users keep /offer/:id untouched.
 */
const AppOfferPage = () => {
  const navigate = useNavigate();
  const { cartCount } = useCart();
  return (
    <AppShell>
      <OfferView inApp cartCount={cartCount} onCartClick={() => navigate('/home?tab=cart')} />
    </AppShell>
  );
};

export default AppOfferPage;
