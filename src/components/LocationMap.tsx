import { useEffect, useState } from 'react';
import { MapPin, Phone, Clock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { fetchLocations, subscribeLocationsRealtime, type StorefrontLocation } from '@/lib/locationsApi';

const LocationMap = () => {
  const { language, t } = useLanguage();
  const [locations, setLocations] = useState<StorefrontLocation[]>([]);

  useEffect(() => {
    let active = true;
    const sync = async () => {
      try {
        const data = await fetchLocations();
        if (active) setLocations(data.filter((l) => l.isActive));
      } catch (e) { console.error(e); }
    };
    sync();
    const unsub = subscribeLocationsRealtime(sync);
    return () => { active = false; unsub(); };
  }, []);

  if (locations.length === 0) return null;

  return (
    <section className="py-12 sm:py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8 sm:mb-10">
          <h2 className="font-display font-bold text-2xl sm:text-3xl mb-2 sm:mb-3">{t.location.title}</h2>
          <p className="text-sm sm:text-base text-muted-foreground">{t.location.subtitle}</p>
        </div>

        <div className={`grid ${locations.length > 1 ? 'lg:grid-cols-2' : ''} gap-6 sm:gap-8`}>
          {locations.map((loc) => {
            const name = language === 'sq' ? loc.nameSq : loc.nameEn;
            const address = language === 'sq' ? loc.addressSq : loc.addressEn;
            const hours = language === 'sq' ? loc.hoursSq : loc.hoursEn;
            const mapsSrc = `https://www.google.com/maps?q=${loc.lat},${loc.lng}&hl=${language}&z=16&output=embed`;
            return (
              <div key={loc.id} className="space-y-4">
                <h3 className="font-display font-bold text-lg sm:text-xl text-center">{name}</h3>
                <div className="rounded-2xl overflow-hidden h-64 sm:h-72 shadow-card">
                  <iframe
                    src={mapsSrc}
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    title={name}
                  />
                </div>
                <div className="grid gap-3">
                  <div className="bg-card rounded-xl p-4 shadow-card flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10"><MapPin className="w-4 h-4 text-primary" /></div>
                    <div className="text-xs sm:text-sm">
                      <p className="font-semibold">{t.location.visitUs}</p>
                      <p className="text-muted-foreground">{address}</p>
                    </div>
                  </div>
                  <div className="bg-card rounded-xl p-4 shadow-card flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10"><Clock className="w-4 h-4 text-primary" /></div>
                    <div className="text-xs sm:text-sm">
                      <p className="font-semibold">{t.location.openHours}</p>
                      <p className="text-muted-foreground">{hours}</p>
                    </div>
                  </div>
                  {loc.whatsappPhone && (
                    <div className="bg-card rounded-xl p-4 shadow-card flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-primary/10"><Phone className="w-4 h-4 text-primary" /></div>
                      <div className="text-xs sm:text-sm">
                        <p className="font-semibold">{t.location.callUs}</p>
                        <p className="text-muted-foreground">+{loc.whatsappPhone}</p>
                      </div>
                    </div>
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

export default LocationMap;
