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
    <div className="fixed top-[calc(0.375rem+env(safe-area-inset-top,0px))] sm:top-20 inset-x-0 z-[90] flex justify-center">
      <button
        type="button"
        onClick={onChange}
        title={language === 'sq' ? 'Ndrysho pikën' : 'Change location'}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/90 text-background text-xs font-medium shadow-md backdrop-blur-sm active:scale-95 transition-transform"
      >
        <MapPin className="w-3 h-3 shrink-0" />
        {BRANCH_LABEL[branch]}
      </button>
    </div>
  );
};

export default LocationBanner;
