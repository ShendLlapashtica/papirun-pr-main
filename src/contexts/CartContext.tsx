import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';
import type { MenuItem, CartItem } from '@/types/menu';
import type { SelectedExtra } from '@/types/menuExtra';
import { useLanguage } from '@/contexts/LanguageContext';
import { getCartItemKey } from '@/lib/cartItemKey';

const CART_STORAGE_KEY = 'papirun_cart_v2';

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveCart(cart: CartItem[]) {
  try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart)); } catch {}
}

interface CartContextType {
  cart: CartItem[];
  cartCount: number;
  isTrayOpen: boolean;
  isCheckoutOpen: boolean;
  setIsTrayOpen: (v: boolean) => void;
  setIsCheckoutOpen: (v: boolean) => void;
  addToCart: (item: MenuItem, removedIngredients?: string[], addedExtras?: SelectedExtra[]) => void;
  updateQuantity: (itemKey: string, quantity: number) => void;
  updateNote: (itemKey: string, note: string) => void;
  removeFromCart: (itemKey: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | null>(null);

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be inside CartProvider');
  return ctx;
};

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [cart, setCart] = useState<CartItem[]>(loadCart);
  const [isTrayOpen, setIsTrayOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const { language } = useLanguage();

  useEffect(() => { saveCart(cart); }, [cart]);

  // Cross-tab sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === CART_STORAGE_KEY && e.newValue) {
        try { setCart(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const addToCart = useCallback((item: MenuItem, removedIngredients: string[] = [], addedExtras: SelectedExtra[] = []) => {
    const normalizedRemovedIngredients = [...removedIngredients].sort();
    const normalizedAddedExtras = [...addedExtras].sort((a, b) => a.id.localeCompare(b.id));

    setCart((prev) => {
      const nextCartItem: CartItem = {
        ...item,
        quantity: 1,
        removedIngredients: normalizedRemovedIngredients,
        addedExtras: normalizedAddedExtras,
      };

      const nextItemKey = getCartItemKey(nextCartItem);
      const existing = prev.find((cartItem) => getCartItemKey(cartItem) === nextItemKey);

      if (existing) {
        return prev.map((cartItem) =>
          getCartItemKey(cartItem) === nextItemKey
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }

      return [...prev, nextCartItem];
    });

    toast.success(language === 'sq' ? 'U shtua në shportë' : 'Added to cart', { duration: 1200 });
  }, [language]);

  const updateQuantity = useCallback((itemKey: string, quantity: number) => {
    if (quantity <= 0) {
      setCart((prev) => prev.filter((item) => getCartItemKey(item) !== itemKey));
    } else {
      setCart((prev) => prev.map((item) => (getCartItemKey(item) === itemKey ? { ...item, quantity } : item)));
    }
  }, []);

  const updateNote = useCallback((itemKey: string, note: string) => {
    setCart((prev) => prev.map((item) => (getCartItemKey(item) === itemKey ? { ...item, customerNote: note } : item)));
  }, []);

  const removeFromCart = useCallback((itemKey: string) => setCart((prev) => prev.filter((item) => getCartItemKey(item) !== itemKey)), []);
  const clearCart = useCallback(() => setCart([]), []);

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{ cart, cartCount, isTrayOpen, isCheckoutOpen, setIsTrayOpen, setIsCheckoutOpen, addToCart, updateQuantity, updateNote, removeFromCart, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};
