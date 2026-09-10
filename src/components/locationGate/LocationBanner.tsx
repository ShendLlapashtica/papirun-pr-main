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
    // pointer-events-none on the full-width wrapper: only the pill itself may catch
    // taps — the invisible strip used to swallow clicks meant for elements under it
    // (e.g. the X of the order sheet on phones with tall status bars). z kept below
    // every modal/sheet (z-60+) so overlays always win visually too.
    <div className="fixed top-[calc(1.5rem+env(safe-area-inset-top,0px))] sm:top-20 inset-x-0 z-[45] flex justify-center pointer-events-none">
      <button
        type="button"
        onClick={onChange}
        title={language === 'sq' ? 'Ndrysho pikën' : 'Change location'}
        className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/90 text-background text-xs font-medium shadow-md backdrop-blur-sm active:scale-95 transition-transform"
      >
        <MapPin className="w-3 h-3 shrink-0" />
        {BRANCH_LABEL[branch]}
      </button>
    </div>
  );
};

export default LocationBanner;
