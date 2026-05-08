import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2 } from 'lucide-react';
import { playKrring } from '@/lib/sounds';
import { RESTAURANT_COORDS, haversineKm, type DeliveryDriver } from '@/lib/driversApi';

interface Props {
  drivers: DeliveryDriver[];
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  height?: string;
  allowFullscreen?: boolean;
  /** Draw dashed lines + restaurant marker from base to each driver */
  showRestaurant?: boolean;
}

function injectPulseCSS() {
  if (document.getElementById('dlm-pulse')) return;
  const s = document.createElement('style');
  s.id = 'dlm-pulse';
  s.textContent =
    '@keyframes dlmPulse{0%{transform:scale(1);opacity:.45}70%{transform:scale(2.5);opacity:0}100%{transform:scale(2.5);opacity:0}}';
  document.head.appendChild(s);
}

function makeDriverIcon(color: string, name: string, isOnline = false) {
  const initials = name.slice(0, 2).toUpperCase();
  const pulse = isOnline
    ? `<div style="position:absolute;width:52px;height:52px;border-radius:50%;top:-8px;left:-8px;background:${color};opacity:0.35;animation:dlmPulse 2s ease-out infinite;pointer-events:none"></div>`
    : '';
  return L.divIcon({
    html: `
      <div style="position:relative;width:36px;height:36px;">
        ${pulse}
        <div style="
          background:${color};width:36px;height:36px;border-radius:50%;
          border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.35);
          display:flex;align-items:center;justify-content:center;
          font-size:11px;font-weight:700;color:white;font-family:sans-serif;
          position:relative;z-index:1;
        ">${initials}</div>
      </div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -20],
    className: '',
  });
}

function makeDestIcon() {
  return L.divIcon({
    html: `<div style="font-size:28px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">📍</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
    className: '',
  });
}

function makeRestaurantIcon() {
  return L.divIcon({
    html: `<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">🏪</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -14],
    className: '',
  });
}

export default function DriverLocationMap({
  drivers,
  deliveryLat,
  deliveryLng,
  height = '320px',
  allowFullscreen = false,
  showRestaurant = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const restaurantMarkerRef = useRef<L.Marker | null>(null);
  const routeLinesRef = useRef<L.Polyline[]>([]);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    injectPulseCSS();
    const map = L.map(containerRef.current, {
      center: [RESTAURANT_COORDS.lat, RESTAURANT_COORDS.lng],
      zoom: 13,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    // Fix Leaflet tile rendering after fullscreen toggle
    const onFsChange = () => setTimeout(() => map.invalidateSize(), 200);
    document.addEventListener('fullscreenchange', onFsChange);

    return () => {
      document.removeEventListener('fullscreenchange', onFsChange);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers + lines whenever data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    routeLinesRef.current.forEach((l) => l.remove());
    routeLinesRef.current = [];

    const bounds: [number, number][] = [];

    // Restaurant base marker
    if (restaurantMarkerRef.current) {
      restaurantMarkerRef.current.remove();
      restaurantMarkerRef.current = null;
    }
    if (showRestaurant) {
      const rm = L.marker([RESTAURANT_COORDS.lat, RESTAURANT_COORDS.lng], {
        icon: makeRestaurantIcon(),
      });
      rm.bindPopup('<div style="font-weight:700;font-size:13px">🏪 Restoranti</div>');
      rm.addTo(map);
      restaurantMarkerRef.current = rm;
      bounds.push([RESTAURANT_COORDS.lat, RESTAURANT_COORDS.lng]);
    }

    // Driver markers + route lines
    for (const driver of drivers) {
      if (driver.lat == null || driver.lng == null) continue;
      const color = driver.color || '#6b7280';
      const dist = haversineKm(RESTAURANT_COORDS.lat, RESTAURANT_COORDS.lng, driver.lat, driver.lng);
      const distText = dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`;

      const marker = L.marker([driver.lat, driver.lng], {
        icon: makeDriverIcon(color, driver.name, true),
      });
      marker.bindPopup(
        `<div style="font-weight:700;font-size:13px">${driver.name}</div>
         <div style="font-size:11px;color:#888">${driver.isActive ? 'Aktiv' : 'Jo aktiv'}</div>
         <div style="font-size:11px;color:#555;margin-top:3px">📍 ${distText} nga restoranti</div>`
      );
      marker.addTo(map);
      markersRef.current.push(marker);
      bounds.push([driver.lat, driver.lng]);

      // Dashed line from restaurant to driver
      if (showRestaurant) {
        const line = L.polyline(
          [[RESTAURANT_COORDS.lat, RESTAURANT_COORDS.lng], [driver.lat, driver.lng]],
          { color, weight: 2, opacity: 0.55, dashArray: '7 5' }
        ).addTo(map);
        routeLinesRef.current.push(line);
      }
    }

    // Delivery destination marker
    if (destMarkerRef.current) {
      destMarkerRef.current.remove();
      destMarkerRef.current = null;
    }
    if (deliveryLat != null && deliveryLng != null) {
      const dest = L.marker([deliveryLat, deliveryLng], { icon: makeDestIcon() });
      dest.bindPopup('<div style="font-weight:700;font-size:13px">Destinacioni</div>');
      dest.addTo(map);
      destMarkerRef.current = dest;
      bounds.push([deliveryLat, deliveryLng]);
    }

    if (bounds.length >= 2) {
      map.fitBounds(bounds as L.LatLngBoundsLiteral, { padding: [40, 40], maxZoom: 16 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    }
  }, [drivers, deliveryLat, deliveryLng, showRestaurant]);

  const handleFullscreen = () => {
    playKrring();
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen().catch(() => {});
    }
  };

  const driversWithLocation = drivers.filter((d) => d.lat != null && d.lng != null);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border/40 shadow-sm" style={{ height }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {allowFullscreen && (
        <button
          onClick={handleFullscreen}
          className="absolute top-2 right-2 z-[1000] bg-background/90 hover:bg-background border border-border/50 shadow-md rounded-xl p-2 transition-all"
          title="Ekran i plotë"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      )}

      {driversWithLocation.length === 0 && (
        <div className="absolute inset-0 z-[999] flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-none">
          <div className="text-center text-sm text-muted-foreground">
            <div className="text-2xl mb-2">📍</div>
            <p className="font-medium">Asnjë shofer nuk ka GPS aktiv</p>
            <p className="text-xs mt-1">GPS aktivizohet automatikisht kur shoferi hyn</p>
          </div>
        </div>
      )}

      {drivers.length > 1 && (
        <div className="absolute bottom-2 left-2 right-2 z-[1000] flex flex-wrap gap-1.5">
          {drivers.map((d) => {
            const dist =
              d.lat != null && d.lng != null
                ? haversineKm(RESTAURANT_COORDS.lat, RESTAURANT_COORDS.lng, d.lat, d.lng)
                : null;
            return (
              <div
                key={d.id}
                className="flex items-center gap-1 bg-background/90 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm border border-border/30"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                  style={{ background: d.color || '#6b7280' }}
                />
                {d.name}
                {dist != null ? (
                  <span className="text-muted-foreground ml-0.5">
                    {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}
                  </span>
                ) : (
                  <span className="text-muted-foreground">(offline)</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
