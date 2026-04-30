import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLiveVisibleOffers } from '@/hooks/useLiveStorefrontData';

const OfertaRamazani = () => {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { offers, isLoading } = useLiveVisibleOffers();

  // Render nothing until DB resolves — prevents flash of removed/hidden offers
  if (isLoading || offers.length === 0) return null;

  return (
    <section className="py-8 sm:py-12 bg-primary/5">
      <div className="container mx-auto px-4">
        <div className="text-center mb-6 sm:mb-8">
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-semibold mb-3">
            🌙 Ramazan
          </span>
          <h2 className="font-display font-bold text-2xl sm:text-3xl lg:text-4xl">
            {language === 'sq' ? 'Oferta Ramazani' : 'Ramadan Offers'}
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            {language === 'sq' ? 'Oferta speciale për muajin e Ramazanit' : 'Special offers for the month of Ramadan'}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
          {offers.map((offer) => (
            <div
              key={offer.id}
              onClick={() => navigate(`/offer/${offer.id}`)}
              className="group cursor-pointer bg-card rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-hover hover:-translate-y-1"
              style={{ boxShadow: 'var(--shadow-card)' }}
            >
              <div className="relative aspect-[3/4] overflow-hidden">
                <img
                  src={offer.image}
                  alt={offer.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                  <h3 className="font-display font-bold text-xl sm:text-2xl text-background mb-1">
                    {offer.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-background/80 mb-2">
                    {offer.description}
                  </p>
                  <span className="inline-block text-lg sm:text-xl font-bold text-primary">
                    €{offer.price.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default OfertaRamazani;
