import { MapPin } from 'lucide-react';
import type { OrderLocation } from '@/lib/ordersApi';
import { useLanguage } from '@/contexts/LanguageContext';

interface LocationBannerProps {
  branch: OrderLocation;
  onChange: () => void;
}

const BRANCH_LABEL: Record<OrderLocation, string> = {
  qender: 'Papirun Qendër',
  cagllavice: 'Papirun Çagllavicë',
};

const LocationBanner = ({ branch, onChange }: LocationBannerProps) => {
  const { language } = useLanguage();

  return (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] right-3 sm:right-4 z-[90]">
      <button
        type="button"
        onClick={onChange}
        title={language === 'sq' ? 'Ndrysho pikën' : 'Change location'}
        className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 rounded-full bg-foreground/90 text-background text-[11px] sm:text-xs font-medium shadow-md backdrop-blur-sm active:scale-95 transition-transform"
      >
        <MapPin className="w-3 h-3 shrink-0" />
        {BRANCH_LABEL[branch]}
      </button>
    </div>
  );
};

export default LocationBanner;
