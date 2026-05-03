import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, Plus, Minus, ShoppingBag, Check, ChevronDown } from 'lucide-react';
import { getIngredientName } from '@/data/ingredientTranslations';
import type { MenuItem } from '@/types/menu';
import type { SelectedExtra } from '@/types/menuExtra';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLiveMenuExtras, useLiveMenuItems } from '@/hooks/useLiveStorefrontData';
import MenuCard from '@/components/MenuCard';
import SearchBar from '@/components/SearchBar';
import Header from '@/components/Header';
import { cn, getOptimizedImage } from '@/lib/utils';

interface ProductViewProps {
  cart: { id: string; quantity: number }[];
  cartCount: number;
  onAddToCart: (item: MenuItem, removedIngredients: string[], addedExtras: SelectedExtra[]) => void;
  onCartClick: () => void;
}

const ITEMS_PER_PAGE = 8;

const ProductView = ({ cart, cartCount, onAddToCart, onCartClick }: ProductViewProps) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [quantity, setQuantity] = useState(1);
  const [showExtras, setShowExtras] = useState(true);
  const [discoverSearch, setDiscoverSearch] = useState('');
  const [discoverCategory, setDiscoverCategory] = useState('all');
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const { items: menuItems } = useLiveMenuItems();
  const menuExtras = useLiveMenuExtras();

  const item = menuItems.find((m) => m.id === id);

  const [checkedIngredients, setCheckedIngredients] = useState<Record<string, boolean>>({});
  const [checkedExtras, setCheckedExtras] = useState<Record<string, boolean>>({});

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    setDiscoverSearch('');
    setDiscoverCategory('all');
    setVisibleCount(ITEMS_PER_PAGE);
  }, [id]);

  const availableExtras = useMemo(
    () =>
      item?.category === 'sides'
        ? []
        : menuExtras.filter((extra) => extra.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [item?.category, menuExtras]
  );

  useEffect(() => {
    if (item) {
      
      const ingState: Record<string, boolean> = {};
      item.ingredients.forEach((ing) => (ingState[ing] = true));
      setCheckedIngredients(ingState);
      const extState: Record<string, boolean> = {};
      availableExtras.forEach((ext) => (extState[ext.id] = false));
      setCheckedExtras(extState);
      setQuantity(1);
      setShowExtras(true);
    }
  }, [item?.id, availableExtras]);

  const isLoading = menuItems.length === 0;

  // Must be before early return for hooks rules
  const allOtherItems = useMemo(
    () => menuItems.filter((m) => m.id !== id && m.category !== 'sides'),
    [menuItems, id]
  );

  const filteredDiscoverItems = useMemo(() => {
    let items = allOtherItems;
    if (discoverCategory !== 'all') {
      items = items.filter((m) => m.category === discoverCategory);
    }
    if (discoverSearch.trim()) {
      const q = discoverSearch.toLowerCase();
      items = items.filter(
        (m) => m.name[language].toLowerCase().includes(q) || m.ingredients.some((ing) => ing.toLowerCase().includes(q))
      );
    }
    return items;
  }, [allOtherItems, discoverCategory, discoverSearch, language]);

  const visibleDiscoverItems = filteredDiscoverItems.slice(0, visibleCount);
  const hasMore = visibleCount < filteredDiscoverItems.length;

  const categories = [
    { id: 'all', label: t.categories.all },
    { id: 'salad', label: t.categories.salads },
    { id: 'fajita', label: t.categories.fajitas },
    { id: 'sandwich', label: t.categories.sandwiches },
  ];

  if (!item) {
    return (
      <div className="min-h-screen bg-background">
        <Header cartCount={cartCount} onCartClick={onCartClick} />
        <div className="flex items-center justify-center h-[60vh]">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-muted-foreground text-sm">
                {language === 'sq' ? 'Duke u ngarkuar...' : 'Loading...'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              <p className="text-muted-foreground text-sm">
                {language === 'sq' ? 'Duke u ngarkuar...' : 'Loading...'}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }


  const toggleIngredient = (ing: string) => {
    setCheckedIngredients((prev) => ({ ...prev, [ing]: !prev[ing] }));
  };

  const toggleExtra = (extId: string) => {
    setCheckedExtras((prev) => ({ ...prev, [extId]: !prev[extId] }));
  };

  const selectedExtras = availableExtras.filter((extra) => checkedExtras[extra.id]).map((extra) => ({
    id: extra.id,
    name: extra.name,
    price: extra.price,
  }));

  const extrasPerUnitPrice = selectedExtras.reduce((sum, extra) => sum + extra.price, 0);

  const handleAddToCart = () => {
    const removedIngredients = Object.entries(checkedIngredients)
      .filter(([, checked]) => !checked)
      .map(([ing]) => ing);

    for (let i = 0; i < quantity; i++) {
      onAddToCart(item, removedIngredients, selectedExtras);
    }
    setQuantity(1);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header cartCount={cartCount} onCartClick={onCartClick} />

      <main>
        <div className="container mx-auto px-4 pt-4 sm:pt-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 sm:mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            {language === 'sq' ? 'Kthehu ne menu' : 'Back to menu'}
          </button>

          <div className="grid lg:grid-cols-2 gap-6 sm:gap-10 lg:gap-16 items-start">
            <div className="relative group">
              <div className="aspect-square rounded-3xl overflow-hidden bg-white">
                <img
                  src={getOptimizedImage(item.image)}
                  alt={item.name[language]}
                  className="w-full h-full object-contain bg-white p-6 sm:p-10 transition-transform duration-700 group-hover:scale-105"
                />
              </div>
            </div>

            <div className="space-y-5 sm:space-y-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium capitalize">
                    {item.category}
                  </span>
                  {!item.isAvailable && (
                    <span className="px-3 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
                      {t.menu.soldOut}
                    </span>
                  )}
                </div>
                <h1 className="font-display font-bold text-2xl sm:text-3xl lg:text-4xl mb-2">{item.name[language]}</h1>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-primary">€{item.price.toFixed(2)}</p>
              </div>

              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{item.description[language]}</p>

              <div>
                <h3 className="text-sm font-semibold mb-3">{language === 'sq' ? 'Përberësit' : 'Ingredients'}</h3>
                <div className="flex flex-wrap gap-2">
                  {item.ingredients.map((ing) => {
                    const isChecked = checkedIngredients[ing] !== false;
                    return (
                      <button
                        key={ing}
                        onClick={() => toggleIngredient(ing)}
                        className={cn(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border',
                          isChecked
                            ? 'bg-primary/10 border-primary/30 text-foreground'
                            : 'bg-secondary/50 border-border text-muted-foreground line-through opacity-60'
                        )}
                      >
                        <div
                          className={cn(
                            'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all',
                            isChecked ? 'border-primary bg-primary' : 'border-muted-foreground/40 bg-transparent'
                          )}
                        >
                          {isChecked && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                        </div>
                        {getIngredientName(ing, language)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Extras - hidden behind toggle */}
              {availableExtras.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowExtras(!showExtras)}
                    className="flex items-center gap-2 text-sm font-semibold text-primary hover:underline transition-all"
                  >
                    <ChevronDown className={cn('w-4 h-4 transition-transform', showExtras && 'rotate-180')} />
                    {showExtras
                      ? (language === 'sq' ? 'Fshih Ekstrat' : 'Hide Extras')
                      : (language === 'sq' ? 'Shfaq Ekstrat' : 'Show Extras')
                    }
                    {selectedExtras.length > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground text-[10px]">
                        {selectedExtras.length}
                      </span>
                    )}
                  </button>
                  {showExtras && (
                    <div className="flex flex-wrap gap-2 mt-3 animate-slide-up">
                      {availableExtras.map((extra) => {
                        const isChecked = checkedExtras[extra.id] === true;
                        return (
                          <button
                            key={extra.id}
                            onClick={() => toggleExtra(extra.id)}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border',
                              isChecked ? 'bg-accent border-accent text-accent-foreground' : 'bg-secondary/50 border-dashed border-border text-muted-foreground'
                            )}
                          >
                            <div
                              className={cn(
                                'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all',
                                isChecked ? 'border-accent-foreground bg-accent-foreground' : 'border-muted-foreground/40 bg-transparent'
                              )}
                            >
                              {isChecked && <Check className="w-2.5 h-2.5 text-accent" />}
                            </div>
                            + {extra.name[language]} (€{extra.price.toFixed(2)})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <div className="flex items-center gap-2 bg-secondary rounded-full p-1.5">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="p-2 rounded-full hover:bg-muted transition-colors">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-semibold">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} className="p-2 rounded-full hover:bg-muted transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={handleAddToCart}
                  disabled={!item.isAvailable}
                  className="btn-sage flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ShoppingBag className="w-5 h-5" />
                  {language === 'sq' ? 'Shto ne Shporte' : 'Add to Cart'} - €{((item.price + extrasPerUnitPrice) * quantity).toFixed(2)}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Discover More - with search, filters, endless scroll */}
        {allOtherItems.length > 0 && (
          <section className="py-10 sm:py-14 bg-secondary/30">
            <div className="container mx-auto px-4">
              <h2 className="font-display font-bold text-xl sm:text-2xl mb-6">{language === 'sq' ? 'Zbulo me shume' : 'Discover More'}</h2>

              <div className="mb-4">
                <SearchBar value={discoverSearch} onChange={setDiscoverSearch} />
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-4 scrollbar-hide mb-6">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => { setDiscoverCategory(cat.id); setVisibleCount(ITEMS_PER_PAGE); }}
                    className={cn(
                      'px-4 py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all',
                      discoverCategory === cat.id ? 'bg-primary text-primary-foreground shadow-glow' : 'bg-background hover:bg-background/80'
                    )}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {filteredDiscoverItems.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    {language === 'sq' ? 'Asnje produkt nuk u gjet' : 'No items found'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
                    {filteredDiscoverItems.map((m) => (
                      <MenuCard key={m.id} item={m} onAddToCart={(nextItem) => onAddToCart(nextItem, [], [])} />
                    ))}
                  </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default ProductView;
