import { useState, useEffect } from 'react';
import { MapPin } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLiveMenuItems } from '@/hooks/useLiveStorefrontData';
import type { MenuItem } from '@/types/menu';

const SocialProofToast = () => {
  const [visible, setVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState<MenuItem | null>(null);
  const { language } = useLanguage();
  const { items: menuItems } = useLiveMenuItems();

  const names = ['Arta', 'Blend', 'Dren', 'Elira', 'Fjolla', 'Gent', 'Hana', 'Ilir', 'Jeta', 'Kushtrim'];

  useEffect(() => {
    if (!menuItems.length) return;

    const showToast = () => {
      const randomItem = menuItems[Math.floor(Math.random() * menuItems.length)];
      if (!randomItem) return;
      setCurrentItem(randomItem);
      setVisible(true);

      setTimeout(() => {
        setVisible(false);
      }, 4000);
    };

    const initialTimeout = setTimeout(showToast, 10000);
    const interval = setInterval(() => {
      showToast();
    }, 30000 + Math.random() * 30000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [menuItems]);

  if (!visible || !currentItem) return null;

  const randomName = names[Math.floor(Math.random() * names.length)];

  return (
    <div className="toast-notification flex items-center gap-3">
      <img
        src={currentItem.image}
        alt={currentItem.name[language]}
        className="w-12 h-12 rounded-lg object-contain bg-cream"
      />
      <div>
        <p className="text-xs sm:text-sm font-medium">
          {randomName} {language === 'sq' ? 'sapo porositi' : 'just ordered'} {currentItem.name[language]}
        </p>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="w-3 h-3" />
          Prishtine
        </p>
      </div>
    </div>
  );
};

export default SocialProofToast;
