import OfferView from './OfferView';
import Tray from '@/components/Tray';
import CheckoutModal from '@/components/CheckoutModal';
import { useCart } from '@/contexts/CartContext';
import { getCartTotal } from '@/lib/cartPricing';

const OfferViewWrapper = () => {
  const {
    cart,
    cartCount,
    isTrayOpen,
    isCheckoutOpen,
    setIsTrayOpen,
    setIsCheckoutOpen,
    updateQuantity,
    updateNote,
    removeFromCart,
    clearCart,
  } = useCart();

  const cartTotal = getCartTotal(cart);

  return (
    <>
      <OfferView
        cartCount={cartCount}
        onCartClick={() => setIsTrayOpen(true)}
      />

      <Tray
        items={cart}
        isOpen={isTrayOpen}
        onClose={() => setIsTrayOpen(false)}
        onUpdateQuantity={updateQuantity}
        onRemove={removeFromCart}
        onCheckout={() => setIsCheckoutOpen(true)}
        onUpdateNote={updateNote}
      />

      <CheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        items={cart}
        total={cartTotal}
        onSuccess={clearCart}
      />
    </>
  );
};

export default OfferViewWrapper;
