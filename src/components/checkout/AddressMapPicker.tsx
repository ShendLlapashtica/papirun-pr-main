import { useEffect, useRef, useState, useCallback, memo, FormEvent } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

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

const searchAddress = async (query: string): Promise<{ lat: number; lng: number; display: string } | null> => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=xk&limit=1`
    );
    if (!response.ok) return null;
    const data = await response.json();
    if (data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), display: data[0].display_name };
  } catch {
    return null;
  }
};

const AddressMapPicker = memo(({ selectedPosition, onSelectAddress }: AddressMapPickerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const [position, setPosition] = useState<[number, number]>(selectedPosition ?? PRISHTINA_CENTER);
  const [streetInput, setStreetInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [resolvingAddress, setResolvingAddress] = useState(false);
  const [hasUserLocation, setHasUserLocation] = useState(false);
  const [autoTried, setAutoTried] = useState(false);

  // Sync external selectedPosition prop
  useEffect(() => {
    if (selectedPosition) setPosition(selectedPosition);
  }, [selectedPosition]);

  // Auto-detect location on mount (silent, no error toasts)
  useEffect(() => {
    if (autoTried || selectedPosition || !navigator.geolocation) return;
    setAutoTried(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setHasUserLocation(true);
        setPosition([pos.coords.latitude, pos.coords.longitude]);
        toast.success('Vendndodhja u gjet automatikisht ✓', { duration: 2000 });
      },
      () => { /* silent fallback to Prishtina center */ },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
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
      const latlng = marker.getLatLng();
      setPosition([latlng.lat, latlng.lng]);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
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
    let cancelled = false;
    setResolvingAddress(true);
    // Optimistically clear stale address by emitting a placeholder
    onSelectRef.current({ address: '', fullAddress: '', position });

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

  const handleSearch = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!streetInput.trim()) return;
    setSearching(true);
    const result = await searchAddress(streetInput.trim() + ' Prishtine');
    setSearching(false);
    if (result) {
      setPosition([result.lat, result.lng]);
    } else {
      toast.error('Adresa nuk u gjet');
    }
  }, [streetInput]);

  const handleCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      toast.error('Shfletuesi nuk e mbështet gjeolokacionin');
      return;
    }

    // Check permission state for clear feedback
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

      <div className="rounded-xl overflow-hidden border border-border bg-secondary/30 relative">
        <div ref={containerRef} className="h-56 w-full" style={{ zIndex: 0 }} />
        {resolvingAddress && (
          <div className="absolute top-2 right-2 bg-background/90 backdrop-blur px-2 py-1 rounded-full text-[10px] flex items-center gap-1 shadow">
            <Loader2 className="w-3 h-3 animate-spin" /> Adresa...
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground text-center">Ndrysho adresën</p>
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 flex items-center bg-secondary rounded-xl">
          <Search className="absolute left-3 w-4 h-4 text-muted-foreground pointer-events-none" />
          <span className="pl-9 pr-0.5 text-sm text-muted-foreground select-none whitespace-nowrap">Rruga:</span>
          <input
            type="text"
            value={streetInput}
            onChange={(e) => setStreetInput(e.target.value)}
            placeholder="p.sh. Isa Kastrati"
            className="flex-1 bg-transparent border-0 py-2 pr-3 pl-1 text-sm focus:ring-0 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
        >
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Kërko'}
        </button>
      </form>
    </div>
  );
});

AddressMapPicker.displayName = 'AddressMapPicker';

export default AddressMapPicker;
