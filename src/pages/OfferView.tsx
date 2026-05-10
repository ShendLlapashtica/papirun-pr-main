import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Clock, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useLiveVisibleOffers, useOfferBadgeText } from '@/hooks/useLiveStorefrontData';
import Header from '@/components/Header';
import { getOptimizedImage } from '@/lib/utils';

interface OfferViewProps {
  cartCount: number;
  onCartClick: () => void;
}

function extractTime(description: string): string {
  const match = description.match(/(\d{2}:\d{2}\s*[-–]\s*\d{2}:\d{2})/);
  return match ? match[1] : '';
}

const OfferView = ({ cartCount, onCartClick }: OfferViewProps) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { offers } = useLiveVisibleOffers();
  const badgeText = useOfferBadgeText();
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setImgIdx(0);
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

  const images = offer.images?.length ? offer.images : (offer.image ? [offer.image] : []);
  const hasImages = images.length > 0;
  const time = extractTime(offer.description);
  const safeIdx = Math.min(imgIdx, images.length - 1);

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
            {language === 'sq' ? 'Kthehu në menu' : 'Back to menu'}
          </button>

          <div className="grid lg:grid-cols-2 gap-6 sm:gap-10 lg:gap-16 items-start max-w-5xl mx-auto">
            {/* Offer Image carousel or styled card */}
            <div className="rounded-3xl overflow-hidden shadow-card">
              {hasImages ? (
                <div className="relative">
                  <img
                    src={getOptimizedImage(images[safeIdx])}
                    alt={`${offer.title} — foto ${safeIdx + 1}`}
                    className="w-full h-auto object-contain bg-white"
                  />
                  {images.length > 1 && (
                    <>
                      <button
                        onClick={() => setImgIdx((i) => (i - 1 + images.length) % images.length)}
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                        aria-label="Foto e mëparshme"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => setImgIdx((i) => (i + 1) % images.length)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                        aria-label="Foto tjetër"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      {/* Dot indicators */}
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {images.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setImgIdx(i)}
                            className={`w-2 h-2 rounded-full transition-all ${i === safeIdx ? 'bg-white scale-125' : 'bg-white/50'}`}
                            aria-label={`Foto ${i + 1}`}
                          />
                        ))}
                      </div>
                      {/* Thumbnail strip */}
                      <div className="flex gap-1.5 p-2 bg-black/10 overflow-x-auto">
                        {images.map((url, i) => (
                          <button
                            key={url}
                            onClick={() => setImgIdx(i)}
                            className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${i === safeIdx ? 'border-white' : 'border-transparent opacity-60 hover:opacity-100'}`}
                          >
                            <img src={getOptimizedImage(url)} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div
                  className={`aspect-[9/16] flex flex-col justify-between p-8 ${
                    offer.id.includes('kafja') ? 'bg-[#f5f0e8]' : 'bg-[#5aa49a]'
                  }`}
                >
                  <div>
                    <h2
                      className={`font-display font-black text-4xl uppercase leading-tight ${
                        offer.id.includes('kafja') ? 'text-[#5aa49a]' : 'text-white'
                      }`}
                    >
                      {offer.title}
                    </h2>
                    <p
                      className={`text-sm mt-2 leading-relaxed ${
                        offer.id.includes('kafja') ? 'text-[#5aa49a]/70' : 'text-white/80'
                      }`}
                    >
                      {offer.includes.join(' · ')}
                    </p>
                  </div>
                  {/* Price starburst */}
                  <div className="flex justify-center">
                    <div className="relative w-40 h-40 flex items-center justify-center">
                      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full drop-shadow-xl">
                        <polygon
                          points="50,2 59,28 85,14 73,39 99,42 78,60 89,85 63,74 56,100 40,77 14,91 23,65 0,50 25,40 16,15 40,28"
                          fill="#dc2626"
                        />
                      </svg>
                      <div className="relative z-10 text-white font-black text-center leading-none">
                        <span className="text-3xl">{Math.floor(offer.price)}.</span>
                        <span className="text-lg">
                          {String(Math.round((offer.price % 1) * 100)).padStart(2, '0')}€
                        </span>
                      </div>
                    </div>
                  </div>
                  {time && (
                    <div className="text-center">
                      <p
                        className={`text-sm font-medium ${
                          offer.id.includes('kafja') ? 'text-[#5aa49a]/70' : 'text-white/70'
                        }`}
                      >
                        Oferta vlen nga:
                      </p>
                      <p
                        className={`font-black text-2xl ${
                          offer.id.includes('kafja') ? 'text-[#5aa49a]' : 'text-white'
                        }`}
                      >
                        {time}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Offer Details */}
            <div className="space-y-5 sm:space-y-6">
              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-600 text-white text-xs font-bold shadow-sm">
                  <MapPin className="w-3 h-3" />
                  {badgeText}
                </span>
                {time && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary text-xs font-semibold text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {time}
                  </span>
                )}
              </div>

              <div>
                <h1 className="font-display font-bold text-2xl sm:text-3xl lg:text-4xl mb-3">
                  {offer.title}
                </h1>
                <p className="text-2xl sm:text-3xl font-black text-primary">
                  €{offer.price.toFixed(2)}
                </p>
              </div>

              {/* What's included */}
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                  {language === 'sq' ? 'Çfarë përfshihet' : "What's included"}
                </h3>
                <div className="space-y-2.5">
                  {offer.includes.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3 text-primary" />
                      </div>
                      <span className="text-sm font-medium">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default OfferView;
