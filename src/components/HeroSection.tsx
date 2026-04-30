import { useLanguage } from '@/contexts/LanguageContext';
import heroBg from '@/assets/hero-bg-new.png';

interface HeroSectionProps {
  onViewMenu: () => void;
}

const HeroSection = ({ onViewMenu }: HeroSectionProps) => {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden">
      <div className="relative w-full lg:flex lg:items-center lg:min-h-[520px] xl:min-h-[600px]">
        {/* Desktop: side-by-side layout */}
        <div className="hidden lg:flex lg:flex-1 lg:items-center lg:justify-center lg:px-16 xl:px-24 lg:py-16 relative z-10 bg-gradient-to-r from-background via-background to-transparent">
          <div className="max-w-lg">
            <h1 className="font-display font-bold text-6xl xl:text-8xl mb-4 tracking-tight">
              Papirun<span className="text-primary">®</span>
            </h1>
            <p className="text-base xl:text-lg text-muted-foreground max-w-md mb-6">
              {t.hero.description}
            </p>
            <button onClick={onViewMenu} className="btn-sage text-base">
              {t.hero.ctaButton}
            </button>
          </div>
        </div>

        {/* Image */}
        <div className="relative lg:flex-1">
          <img
            src={heroBg}
            alt="Papirun - House of Crunch"
            className="w-full h-auto block lg:h-[520px] xl:h-[600px] lg:object-cover"
          />

          {/* Mobile overlay */}
          <div className="lg:hidden absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent" />
          <div className="lg:hidden absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          {/* Mobile content */}
          <div className="lg:hidden absolute inset-0 flex items-end">
            <div className="container mx-auto px-6 pb-12">
              <h1 className="font-display font-bold text-5xl sm:text-6xl text-white mb-3 tracking-tight max-w-lg drop-shadow-lg">
                Papirun<span className="text-primary">®</span>
              </h1>
              <p className="text-sm sm:text-base text-white/80 max-w-md mb-5 drop-shadow-md">
                {t.hero.description}
              </p>
              <button onClick={onViewMenu} className="btn-sage text-sm sm:text-base">
                {t.hero.ctaButton}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
