import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { fetchLocations, isLocationOpenNow, formatNextOpenStatus, subscribeLocationsRealtime, type StorefrontLocation } from '@/lib/locationsApi';

const OpenClosedBar = () => {
  const { language } = useLanguage();
  const [locations, setLocations] = useState<StorefrontLocation[]>([]);
  const [, setTick] = useState(0);

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
    const interval = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => { active = false; unsub(); clearInterval(interval); };
  }, []);

  if (locations.length === 0) return null;

  return (
    <div className="flex flex-col items-center gap-2 w-full">
      {locations.map((loc) => {
        const open = isLocationOpenNow(loc);
        const statusText = formatNextOpenStatus(loc, language);
        return (
          <div
            key={loc.id}
            className={cn(
              'flex items-center justify-center gap-2 py-2 px-4 rounded-full text-xs sm:text-sm font-semibold transition-all max-w-full',
              open
                ? 'bg-[hsl(var(--app-chip-bg))] text-[hsl(var(--app-muted-text))]'
                : 'bg-destructive/15 text-destructive'
            )}
          >
            <span className={cn('w-2 h-2 rounded-full animate-pulse shrink-0', open ? 'bg-primary' : 'bg-destructive')} />
            <Clock className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">
              {statusText}
              {' · '}
              <span className="font-bold">{language === 'sq' ? loc.nameSq : loc.nameEn}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
};

export default OpenClosedBar;
