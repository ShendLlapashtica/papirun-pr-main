import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLiveVisibleOffers } from '@/hooks/useLiveStorefrontData';
import Header from '@/components/Header';
import ViberIcon from '@/components/ViberIcon';

interface OfferViewProps {
  cartCount: number;
  onCartClick: () => void;
}

const OfferView = ({ cartCount, onCartClick }: OfferViewProps) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { offers } = useLiveVisibleOffers();
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  const offer = offers.find((o) => o.id === id);

  if (!offer) {
    return (
      <div className="min-h-screen bg-background">
        <Header cartCount={cartCount} onCartClick={onCartClick} />
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-muted-foreground">
            {language === 'sq' ? 'Oferta nuk u gjet' : 'Offer not found'}
          </p>
        </div>
      </div>
    );
  }

  const handleOrder = () => {
    setShowFallback(false);
    const message = `Përshëndetje! Dëshiroj të porosis: ${offer.title} - €${offer.price.toFixed(2)}`;
    const viberUrl = `viber://chat?number=38349644168&draft=${encodeURIComponent(message)}`;
    
    const opened = window.open(viberUrl, '_blank');
    if (!opened) {
      setShowFallback(true);
      return;
    }

    const timer = setTimeout(() => {
      setShowFallback(true);
    }, 2500);
    window.addEventListener('blur', () => clearTimeout(timer), { once: true });
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

          <div className="grid lg:grid-cols-2 gap-6 sm:gap-10 lg:gap-16 items-start max-w-5xl mx-auto">
            {/* Offer Image */}
            <div className="rounded-3xl overflow-hidden">
              <img
                src={offer.image}
                alt={offer.title}
                className="w-full h-auto object-cover"
              />
            </div>

            {/* Offer Details */}
            <div className="space-y-5 sm:space-y-6">
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-3">
                  🌙 Oferta Ramazani
                </span>
                <h1 className="font-display font-bold text-2xl sm:text-3xl lg:text-4xl mb-2">
                  {offer.title}
                </h1>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-primary">
                  €{offer.price.toFixed(2)}
                </p>
              </div>

              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                {offer.description}
              </p>

              {/* What's included */}
              <div>
                <h3 className="text-sm font-semibold mb-3">
                  {language === 'sq' ? 'Çfarë përfshihet' : 'What\'s included'}
                </h3>
                <div className="space-y-2">
                  {offer.includes.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2.5">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary" />
                      </div>
                      <span className="text-sm">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {showFallback && (
                <div className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm text-center">
                  {language === 'sq' 
                    ? 'Ju lutem instaloni Viber për të dërguar këtë mesazh.' 
                    : 'Please install Viber to send this message.'}
                </div>
              )}

              <button
                onClick={handleOrder}
                className="w-full flex items-center justify-center gap-2.5 font-semibold py-3.5 px-6 rounded-2xl text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                style={{ backgroundColor: '#7360F2' }}
              >
                <ViberIcon className="w-5 h-5" />
                {language === 'sq' ? 'Porosit përmes Viber' : 'Order via Viber'} - €{offer.price.toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OfferView;
