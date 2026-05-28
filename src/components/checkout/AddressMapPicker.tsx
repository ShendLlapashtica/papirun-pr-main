import { useEffect, useRef, useState, useCallback, memo, FormEvent } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { subscribeGeo } from '@/lib/geoCache';

const PRISHTINA_CENTER: [number, number] = [42.6629, 21.1655];

const iconDefault = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface AddressMapPickerProps {
  selectedPosition: [number, number] | null;
  onSelectAddress: (payload: { address: string; fullAddress: string; position: [number, number] }) => void;
}

interface Suggestion {
  lat: number;
  lng: number;
  display: string;
  short: string;
}

const reverseGeocode = async (lat: number, lng: number): Promise<string> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
    );
    if (!response.ok) return '';
    const data = await response.json();
    return data?.display_name || '';
  } catch {
    return '';
  }
};

const fetchSuggestions = async (query: string): Promise<Suggestion[]> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ' Prishtine')}&countrycodes=xk&limit=4`
    );
    if (!response.ok) return [];
    const data = await response.json();
    return data.map((r: any) => ({
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      display: r.display_name,
      short: r.display_name.split(',')[0]?.trim() ?? r.display_name,
    }));
  } catch {
    return [];
  }
};

const AddressMapPicker = memo(({ selectedPosition, onSelectAddress }: AddressMapPickerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [position, setPosition] = useState<[number, number]>(selectedPosition ?? PRISHTINA_CENTER);
  const [streetInput, setStreetInput] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [hasUserLocation, setHasUserLocation] = useState(false);
  const [autoTried, setAutoTried] = useState(false);
  const userInteractedRef = useRef(false);
  const [locationBanner, setLocationBanner] = useState(false);

  // Sync external selectedPosition prop
  useEffect(() => {
    if (selectedPosition) {
      userInteractedRef.current = true;
      setLocationBanner(false);
      setPosition(selectedPosition);
    }
  }, [selectedPosition]);

  // Auto-detect location on mount — reads from the app-level singleton (prewarmGeo fires
  // before any component mounts, so this is usually instant by the time checkout opens).
  useEffect(() => {
    if (autoTried || selectedPosition) return;
    setAutoTried(true);
    const unsub = subscribeGeo((result) => {
      if (result) {
        userInteractedRef.current = true;
        setLocationBanner(false);
        setHasUserLocation(true);
        setPosition([result.lat, result.lng]);
        toast.success('Vendndodhja u gjet automatikisht ✓', { duration: 2000 });
      } else {
        setLocationBanner(true);
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initialize map ONCE
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, { center: position, zoom: 14 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    const marker = L.marker(position, { icon: iconDefault, draggable: true }).addTo(map);

    marker.on('dragend', () => {
      userInteractedRef.current = true;
      setLocationBanner(false);
      const latlng = marker.getLatLng();
      setPosition([latlng.lat, latlng.lng]);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      userInteractedRef.current = true;
      setLocationBanner(false);
      setPosition([e.latlng.lat, e.latlng.lng]);
    });

    mapRef.current = map;
    markerRef.current = marker;
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker + map view when position changes
  useEffect(() => {
    if (markerRef.current) markerRef.current.setLatLng(position);
    if (mapRef.current) {
      const z = mapRef.current.getZoom();
      mapRef.current.flyTo(position, z < 15 ? 17 : z, { duration: 0.8 });
    }
  }, [position]);

  // Reverse geocode (clear stale address until new one resolves)
  const onSelectRef = useRef(onSelectAddress);
  onSelectRef.current = onSelectAddress;

  useEffect(() => {
    if (!userInteractedRef.current) return;
    let cancelled = false;
    setResolvingAddress(true);

    const timer = setTimeout(async () => {
      const fullAddress = await reverseGeocode(position[0], position[1]);
      if (cancelled) return;
      const coordFallback = `${position[0].toFixed(5)}, ${position[1].toFixed(5)}`;
      const addressText = fullAddress || coordFallback;
      const streetName = fullAddress ? (fullAddress.split(',')[0]?.trim() || addressText) : coordFallback;
      onSelectRef.current({ address: streetName, fullAddress: addressText, position });
      setResolvingAddress(false);
    }, 400);

    return () => { cancelled = true; clearTimeout(timer); setResolvingAddress(false); };
  }, [position]);

  // Debounced autocomplete as user types
  useEffect(() => {
    if (streetInput.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    setSuggestionLoading(true);
    const timer = setTimeout(async () => {
      const results = await fetchSuggestions(streetInput.trim());
      setSuggestions(results);
      setSuggestionLoading(false);
    }, 450);
    return () => { clearTimeout(timer); setSuggestionLoading(false); };
  }, [streetInput]);

  const applySuggestion = useCallback((s: Suggestion) => {
    userInteractedRef.current = true;
    setLocationBanner(false);
    setPosition([s.lat, s.lng]);
    setStreetInput(s.short);
    setSuggestions([]);
  }, []);

  // Fall back to first suggestion if user submits manually
  const handleSearch = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (suggestions.length > 0) {
      applySuggestion(suggestions[0]);
      return;
    }
    if (!streetInput.trim()) return;
    setSuggestionLoading(true);
    const results = await fetchSuggestions(streetInput.trim());
    setSuggestionLoading(false);
    if (results.length > 0) {
      applySuggestion(results[0]);
    } else {
      toast.error('Adresa nuk u gjet');
    }
  }, [streetInput, suggestions, applySuggestion]);

  const handleCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      toast.error('Shfletuesi nuk e mbështet gjeolokacionin');
      return;
    }

    try {
      const perms = (navigator as any).permissions;
      if (perms?.query) {
        const status = await perms.query({ name: 'geolocation' as PermissionName });
        if (status.state === 'denied') {
          toast.error('Lejo lokacionin nga shfletuesi (cilësimet e faqes)', { duration: 5000 });
          return;
        }
      }
    } catch { /* ignore */ }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newPos: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        userInteractedRef.current = true;
        setLocationBanner(false);
        setHasUserLocation(true);
        setPosition(newPos);
        setLocating(false);
        toast.success('Lokacioni u përditësua');
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast.error('Leja u refuzua. Aktivizoje në cilësimet e shfletuesit.');
        } else if (err.code === err.TIMEOUT) {
          toast.error('Lokacioni nuk u gjet (timeout). Provo përsëri jashtë.');
        } else {
          toast.error('Nuk mund të merret lokacioni');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }, []);

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleCurrentLocation}
        disabled={locating}
        className="w-full flex items-center justify-center gap-2 text-xs font-semibold py-2.5 rounded-xl bg-primary text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
      >
        {locating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
        {hasUserLocation ? '📍 Përditëso lokacionin' : '📍 Vendos lokacionin aktual'}
      </button>

      {locationBanner && (
        <div className="flex items-center justify-between gap-3 bg-amber-500/15 border border-amber-500/30 rounded-xl px-3 py-2.5">
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
            Adresa juaj nuk është aktualizuar.
          </p>
          <button
            type="button"
            onClick={handleCurrentLocation}
            disabled={locating}
            className="text-xs font-semibold text-amber-800 dark:text-amber-200 underline underline-offset-2 whitespace-nowrap disabled:opacity-50"
          >
            {locating ? <Loader2 className="w-3 h-3 animate-spin inline" /> : 'aktualizo'}
          </button>
        </div>
      )}

      <div className="rounded-xl overflow-hidden border border-border bg-secondary/30 relative">
        <div ref={containerRef} className="h-56 w-full" style={{ zIndex: 0 }} />
        {resolvingAddress && (
          <div className="absolute top-2 right-2 bg-background/90 backdrop-blur px-2 py-1 rounded-full text-[10px] flex items-center gap-1 shadow">
            <Loader2 className="w-3 h-3 animate-spin" /> Adresa...
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">Ndrysho adresën</p>
      <div className="relative">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1 flex items-center bg-secondary rounded-xl">
            <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
            <span className="pl-9 pr-0.5 text-sm text-muted-foreground select-none whitespace-nowrap">Rruga:</span>
            <input
              type="text"
              value={streetInput}
              onChange={(e) => setStreetInput(e.target.value)}
              onBlur={() => setTimeout(() => setSuggestions([]), 150)}
              placeholder="p.sh. Isa Kastrati"
              className="flex-1 bg-transparent border-0 py-2 pr-3 pl-1 text-sm focus:ring-0 focus:outline-none"
              autoComplete="off"
            />
            {suggestionLoading && (
              <Loader2 className="absolute right-3 w-3.5 h-3.5 animate-spin text-muted-foreground" />
            )}
          </div>
          <button
            type="submit"
            disabled={suggestionLoading}
            className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
          >
            <Search className="w-4 h-4" />
          </button>
        </form>

        {suggestions.length > 0 && (
          <ul className="absolute z-50 left-0 right-0 mt-1 bg-background border border-border rounded-xl shadow-lg overflow-hidden">
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onMouseDown={() => applySuggestion(s)}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-secondary transition-colors flex items-center gap-2 ${i === 0 ? 'font-semibold bg-secondary/60' : ''}`}
                >
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-primary" />
                  <span className="truncate">{s.short}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
});

AddressMapPicker.displayName = 'AddressMapPicker';

export default AddressMapPicker;
