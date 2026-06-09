import { MapPin, Phone, Clock, ArrowUp, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import logo from '@/assets/logo.png';
import InstagramIcon from '@/components/InstagramIcon';

const ORDER_NUMBER = '+38349644168';

const Footer = () => {
  const { t, language } = useLanguage();

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="relative bg-foreground text-background overflow-hidden">
      {/* Decorative sage gradient bar */}
      <div className="h-1 w-full bg-gradient-to-r from-primary via-sage-light to-primary" />
      
      <div className="container mx-auto px-4 py-10 sm:py-14">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl overflow-hidden">
                <img src={logo} alt="Papirun" className="w-full h-full object-cover" />
              </div>
              <span className="font-display font-bold text-xl text-background">
                Papirun<span className="text-primary">®</span>
              </span>
            </div>
            <p className="text-sm text-background/60 leading-relaxed max-w-xs">
              {t.hero.description}
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-display font-semibold text-sm uppercase tracking-wider mb-4 text-background/40">
              {language === 'sq' ? 'Navigimi' : 'Navigation'}
            </h4>
            <ul className="space-y-2.5">
              <li>
                <Link to="/" className="text-sm text-background/70 hover:text-primary transition-colors">
                  {t.header.menu}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-display font-semibold text-sm uppercase tracking-wider mb-4 text-background/40">
              {language === 'sq' ? 'Kontakti' : 'Contact'}
            </h4>
            <ul className="space-y-4">
              <li>
                <p className="text-xs font-semibold text-background/50 uppercase tracking-wider mb-1.5">Papirun Qendër</p>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm text-background/70">Johan V. Hahn, Nr.14<br />Prishtinë 10000</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-sm text-background/70">+383 45 262 323</span>
                  </div>
                </div>
              </li>
              <li>
                <p className="text-xs font-semibold text-background/50 uppercase tracking-wider mb-1.5">Papirun Çagllavicë</p>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm text-background/70">Çagllavicë<br />Prishtinë</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span className="text-sm text-background/70">+383 46 532 532</span>
                  </div>
                </div>
              </li>
              <li className="flex items-start gap-2.5">
                <Clock className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                <span className="text-sm text-background/70">
                  {t.header.hours}<br />{t.location.closed}
                </span>
              </li>
            </ul>
          </div>

          {/* Actions: IG, Call, Back to top */}
          <div className="flex flex-col items-start lg:items-end justify-between gap-3">
            <a
              href="https://www.instagram.com/papirun_pr/"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 px-4 py-2.5 rounded-full border border-background/20 hover:border-primary hover:bg-primary/10 transition-all text-sm text-background/70 hover:text-primary"
            >
              <InstagramIcon className="w-4 h-4" />
              Instagram
            </a>
            <a
              href={`tel:${ORDER_NUMBER}`}
              className="group flex items-center gap-2 px-4 py-2.5 rounded-full border border-background/20 hover:border-primary hover:bg-primary/10 transition-all text-sm text-background/70 hover:text-primary"
            >
              <Phone className="w-4 h-4" />
              {language === 'sq' ? 'Thirr Direkt' : 'Call Direct'}
            </a>
            <a
              href="https://search.google.com/local/writereview?placeid=ChIJIcfXheaeVBMRHkjfl6e6kf8"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 px-4 py-2.5 rounded-full border border-background/20 hover:border-yellow-400 hover:bg-yellow-400/10 transition-all text-sm text-background/70 hover:text-yellow-400"
            >
              <Star className="w-4 h-4" />
              {language === 'sq' ? 'Lër një koment' : 'Leave a Review'}
            </a>
            <button
              onClick={scrollToTop}
              className="group flex items-center gap-2 px-4 py-2.5 rounded-full border border-background/20 hover:border-primary hover:bg-primary/10 transition-all text-sm text-background/70 hover:text-primary"
            >
              <ArrowUp className="w-4 h-4 transition-transform group-hover:-translate-y-0.5" />
              {language === 'sq' ? 'Kthehu lart' : 'Back to top'}
            </button>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-background/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-background/40">
            © {new Date().getFullYear()} Papirun. {t.footer.rights}
          </p>
          <div className="flex items-center gap-4">
            <Link
              to="/privacy"
              className="text-xs text-background/40 hover:text-primary transition-colors"
            >
              {language === 'sq' ? 'Politika e Privatësisë' : 'Privacy Policy'}
            </Link>
            <span className="text-background/20">·</span>
            <Link
              to="/privacy"
              className="text-xs text-background/40 hover:text-primary transition-colors"
            >
              {language === 'sq' ? 'Të Drejtat e Përdoruesit' : 'User Rights'}
            </Link>
            <span className="text-background/20 hidden sm:inline">·</span>
            <p className="text-xs text-background/30 hidden sm:block">
              {language === 'sq' ? 'Ndërtuar me dashuri në Prishtinë' : 'Crafted with care in Pristina'}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
