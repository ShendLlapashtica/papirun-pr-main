import { useNavigate } from 'react-router-dom';
import { useLiveVisibleOffers, useOfferBadgeText } from '@/hooks/useLiveStorefrontData';
import { getOptimizedImage } from '@/lib/utils';
import type { StorefrontOffer } from '@/lib/productsApi';

// Extract time range from description field
function extractTime(description: string): string {
  const match = description.match(/(\d{2}:\d{2}\s*[-–]\s*\d{2}:\d{2})/);
  return match ? match[1] : '';
}

// Starburst price badge — SVG-based, matches the promo image style
function PriceBadge({ price }: { price: number }) {
  const whole = Math.floor(price);
  const cents = String(Math.round((price % 1) * 100)).padStart(2, '0');
  return (
    <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full drop-shadow-lg">
        <polygon
          points="50,2 59,28 85,14 73,39 99,42 78,60 89,85 63,74 56,100 40,77 14,91 23,65 0,50 25,40 16,15 40,28"
          fill="#dc2626"
        />
      </svg>
      <div className="relative z-10 text-white font-black text-center leading-none select-none">
        <span className="text-xl">{whole}.</span>
        <span className="text-sm">{cents}€</span>
      </div>
    </div>
  );
}

// Styled card shown when no image has been uploaded yet
function StyledOfferCard({ offer }: { offer: StorefrontOffer }) {
  const time = extractTime(offer.description);
  const bg = offer.id.includes('kafja') ? 'bg-[#f5f0e8]' : 'bg-[#5aa49a]';
  const textClass = offer.id.includes('kafja') ? 'text-[#5aa49a]' : 'text-white';
  const subTextClass = offer.id.includes('kafja') ? 'text-[#5aa49a]/70' : 'text-white/80';
  const timeClass = offer.id.includes('kafja') ? 'text-[#5aa49a]' : 'text-white';

  return (
    <div className={`relative h-full w-full ${bg} flex flex-col justify-between p-5`}>
      {/* Top: Title + items */}
      <div>
        <h3 className={`font-display font-black text-2xl sm:text-3xl uppercase leading-tight tracking-tight ${textClass}`}>
          {offer.title}
        </h3>
        <p className={`text-[11px] mt-1.5 leading-snug ${subTextClass}`}>
          {offer.includes.join(' · ')}
        </p>
      </div>

      {/* Center: Price starburst */}
      <PriceBadge price={offer.price} />

      {/* Bottom: Time */}
      {time && (
        <div className="text-center">
          <p className={`text-[10px] font-medium ${subTextClass}`}>Oferta vlen nga:</p>
          <p className={`font-black text-base leading-tight ${timeClass}`}>{time}</p>
        </div>
      )}
    </div>
  );
}

const OfertaRamazani = () => {
  const navigate = useNavigate();
  const { offers, isLoading } = useLiveVisibleOffers();
  const badgeText = useOfferBadgeText();

  if (isLoading || offers.length === 0) return null;

  return (
    <section className="py-8 sm:py-12 bg-primary/5">
      <div className="container mx-auto px-4">

        {/* Section header */}
        <div className="text-center mb-5 sm:mb-8 space-y-3">
          <h2 className="font-display font-bold text-2xl sm:text-3xl lg:text-4xl">
            Oferta
          </h2>
          {/* Outstanding location badge */}
          <div className="inline-flex items-center gap-2 bg-red-600 text-white px-5 py-2.5 rounded-2xl font-bold text-sm sm:text-base shadow-lg shadow-red-600/30 ring-2 ring-red-500/40">
            <span className="text-lg">📍</span>
            <span className="tracking-wide">{badgeText}</span>
          </div>
        </div>

        {/* Offer grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5 max-w-6xl mx-auto">
          {offers.map((offer) => {
            const hasImage = !!offer.image;
            return (
              <div
                key={offer.id}
                onClick={() => navigate(`/offer/${offer.id}`)}
                className="group cursor-pointer rounded-2xl overflow-hidden shadow-card transition-all duration-300 hover:shadow-hover hover:-translate-y-1"
              >
                <div className="relative aspect-[9/16] overflow-hidden">
                  {hasImage ? (
                    <>
                      <img
                        src={getOptimizedImage(offer.image)}
                        alt={offer.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <h3 className="font-display font-bold text-lg text-white">{offer.title}</h3>
                        <p className="text-xs text-white/80 mt-0.5">{offer.includes.join(' · ')}</p>
                        <span className="inline-block mt-1.5 text-base font-bold text-yellow-300">
                          €{offer.price.toFixed(2)}
                        </span>
                      </div>
                    </>
                  ) : (
                    <StyledOfferCard offer={offer} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default OfertaRamazani;
