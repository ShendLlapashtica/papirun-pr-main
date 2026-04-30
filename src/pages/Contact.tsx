import { MapPin, Phone, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import ViberIcon from '@/components/ViberIcon';
import InstagramIcon from '@/components/InstagramIcon';

const ORDER_NUMBER = '+38349644168';

const Contact = () => {
  const { t, language } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    message: '',
  });
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowFallback(false);
    const message = `Emri: ${formData.name}\nTel: ${formData.phone}\nEmail: ${formData.email}\n\n${formData.message}`;
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

    setFormData({ name: '', email: '', phone: '', message: '' });
  };

  return (
    <div className="min-h-screen bg-background">
      <Header cartCount={0} onCartClick={() => {}} />

      <main className="py-12 sm:py-16 lg:py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10 sm:mb-14">
            <h1 className="font-display font-bold text-3xl sm:text-4xl lg:text-5xl mb-4">
              {t.header.contact}
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base max-w-xl mx-auto">
              {language === 'sq' 
                ? 'Na kontaktoni per çdo pyetje ose sugjerim. Jemi ketu per t\'ju ndihmuar!'
                : 'Contact us for any questions or suggestions. We are here to help!'}
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            <a
              href={`tel:${ORDER_NUMBER}`}
              className="flex items-center gap-2 px-5 py-3 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <Phone className="w-4 h-4" />
              {language === 'sq' ? 'Thirr Direkt' : 'Call Direct'}
            </a>
            <a
              href="https://www.instagram.com/papirun_pr/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-br from-[hsl(340,80%,55%)] via-[hsl(25,90%,55%)] to-[hsl(50,90%,55%)] text-white font-semibold text-sm hover:opacity-90 active:scale-[0.98] transition-all"
            >
              <InstagramIcon className="w-4 h-4" />
              Instagram
            </a>
          </div>

          <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 max-w-5xl mx-auto">
            {/* Contact Info */}
            <div className="space-y-6">
              <div className="bg-card rounded-2xl p-6 shadow-card">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <MapPin className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{t.location.visitUs}</h3>
                    <p className="text-sm text-muted-foreground">
                      Johan V. Hahn, Nr.14<br />
                      Prishtine 10000, Kosove
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-2xl p-6 shadow-card">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <Phone className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{t.location.callUs}</h3>
                    <p className="text-sm text-muted-foreground">
                      (045/048) 26 23 23
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-2xl p-6 shadow-card">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <Clock className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{t.location.openHours}</h3>
                    <p className="text-sm text-muted-foreground">
                      {t.header.hours}<br />
                      {t.location.closed}
                    </p>
                  </div>
                </div>
              </div>

              {/* Map */}
              <div className="rounded-2xl overflow-hidden h-64 shadow-card">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2934.4!2d21.1655!3d42.6629!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDLCsDM5JzQ2LjQiTiAyMcKwMDknNTYuMCJF!5e0!3m2!1sen!2s!4v1234567890"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Papirun Location"
                />
              </div>
            </div>

            {/* Contact Form */}
            <div className="bg-card rounded-2xl p-6 sm:p-8 shadow-card">
              <h2 className="font-display font-semibold text-xl sm:text-2xl mb-6">
                {language === 'sq' ? 'Na dergoni mesazh' : 'Send us a message'}
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    {t.checkout.name}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t.checkout.namePlaceholder}
                    className="w-full px-4 py-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    {t.checkout.phone}
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder={t.checkout.phonePlaceholder}
                    className="w-full px-4 py-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@example.com"
                    className="w-full px-4 py-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    {language === 'sq' ? 'Mesazhi' : 'Message'}
                  </label>
                  <textarea
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder={language === 'sq' ? 'Shkruani mesazhin tuaj...' : 'Write your message...'}
                    rows={5}
                    className="w-full px-4 py-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                  />
                </div>

                {showFallback && (
                  <div className="bg-destructive/10 text-destructive rounded-xl p-3 text-sm text-center">
                    {language === 'sq' 
                      ? 'Ju lutem instaloni Viber për të dërguar këtë mesazh.' 
                      : 'Please install Viber to send this message.'}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2.5 font-semibold py-3.5 px-6 rounded-2xl text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98]"
                  style={{ backgroundColor: '#7360F2' }}
                >
                  <ViberIcon className="w-5 h-5" />
                  {language === 'sq' ? 'Dërgo përmes Viber' : 'Send via Viber'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Contact;
