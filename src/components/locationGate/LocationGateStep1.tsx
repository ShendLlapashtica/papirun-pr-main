import type { OrderLocation } from '@/lib/ordersApi';
import { useLanguage } from '@/contexts/LanguageContext';
import logo from '@/assets/logo.png';

interface LocationGateStep1Props {
  onPick: (branch: OrderLocation) => void;
}

const LocationGateStep1 = ({ onPick }: LocationGateStep1Props) => {
  const { language } = useLanguage();

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center px-6 transition-opacity duration-300">
      <div className="w-20 h-20 rounded-2xl overflow-hidden bg-primary shadow-card flex items-center justify-center mb-6">
        <img src={logo} alt="Papirun" className="w-full h-full object-cover" />
      </div>
      <h1 className="font-display font-bold text-xl sm:text-2xl text-foreground mb-1 text-center">
        {language === 'sq' ? 'Zgjedhni Pikën' : 'Choose Your Location'}
      </h1>
      <p className="text-sm text-muted-foreground mb-8 text-center">
        {language === 'sq' ? 'Nga cila pikë dëshironi të porositni?' : 'Which location would you like to order from?'}
      </p>
      <div className="w-full max-w-xs flex flex-col gap-3">
        <button
          type="button"
          onClick={() => onPick('qender')}
          className="w-full py-4 px-5 rounded-2xl bg-primary text-primary-foreground font-semibold text-base shadow-soft transition-all active:scale-95 hover:opacity-90"
        >
          Papirun Qendër
        </button>
        <button
          type="button"
          onClick={() => onPick('cagllavice')}
          className="w-full py-4 px-5 rounded-2xl bg-secondary text-foreground font-semibold text-base shadow-soft transition-all active:scale-95 hover:bg-secondary/80"
        >
          Papirun Çagllavicë
        </button>
      </div>
    </div>
  );
};

export default LocationGateStep1;
