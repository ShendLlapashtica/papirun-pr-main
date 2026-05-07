import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2 } from 'lucide-react';
import { playKrring } from '@/lib/sounds';
import type { DeliveryDriver } from '@/lib/driversApi';

interface Props {
  drivers: DeliveryDriver[];
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  height?: string;
  allowFullscreen?: boolean;
}

const PRISHTINA = { lat: 42.6629, lng: 21.1655 };

function makeDriverIcon(color: string, name: string) {
  const initials = name.slice(0, 2).toUpperCase();
  return L.divIcon({
    html: `
      <div style="
        background:${color};
        width:36px;height:36px;border-radius:50%;
        border:3px solid white;
        box-shadow:0 2px 8px rgba(0,0,0,0.35);
        display:flex;align-items:center;justify-content:center;
        font-size:11px;font-weight:700;color:white;
        font-family:sans-serif;
      ">${initials}</div>
    `,
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

export default function DriverLocationMap({
  drivers,
  deliveryLat,
  deliveryLng,
  height = '320px',
  allowFullscreen = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const destMarkerRef = useRef<L.Marker | null>(null);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [PRISHTINA.lat, PRISHTINA.lng],
      zoom: 13,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update driver markers whenever drivers list changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove old driver markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const bounds: [number, number][] = [];

    // Add/refresh driver markers
    for (const driver of drivers) {
      if (driver.lat == null || driver.lng == null) continue;
      const color = driver.color || '#6b7280';
      const marker = L.marker([driver.lat, driver.lng], {
        icon: makeDriverIcon(color, driver.name),
      });
      marker.bindPopup(
        `<div style="font-weight:700;font-size:13px">${driver.name}</div>
         <div style="font-size:11px;color:#888">${driver.isActive ? 'Aktiv' : 'Jo aktiv'}</div>`
      );
      marker.addTo(map);
      markersRef.current.push(marker);
      bounds.push([driver.lat, driver.lng]);
    }

    // Destination marker
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

    // Fit map to show all markers
    if (bounds.length >= 2) {
      map.fitBounds(bounds as L.LatLngBoundsLiteral, { padding: [40, 40], maxZoom: 16 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 15);
    }
  }, [drivers, deliveryLat, deliveryLng]);

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
      {/* Map container */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* Fullscreen button */}
      {allowFullscreen && (
        <button
          onClick={handleFullscreen}
          className="absolute top-2 right-2 z-[1000] bg-background/90 hover:bg-background border border-border/50 shadow-md rounded-xl p-2 transition-all"
          title="Fullscreen + Krring"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      )}

      {/* No-location placeholder overlay */}
      {driversWithLocation.length === 0 && (
        <div className="absolute inset-0 z-[999] flex items-center justify-center bg-background/80 backdrop-blur-sm pointer-events-none">
          <div className="text-center text-sm text-muted-foreground">
            <div className="text-2xl mb-2">📍</div>
            <p className="font-medium">Asnjë shofer nuk ka ndarë pozicionin</p>
            <p className="text-xs mt-1">Shoferi duhet të shtypë "Përditëso vendndodhjen!"</p>
          </div>
        </div>
      )}

      {/* Driver legend strip (only when multiple drivers shown) */}
      {drivers.length > 1 && (
        <div className="absolute bottom-2 left-2 right-2 z-[1000] flex flex-wrap gap-1.5">
          {drivers.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-1 bg-background/90 rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm border border-border/30"
            >
              <span
                className="w-2.5 h-2.5 rounded-full inline-block shrink-0"
                style={{ background: d.color || '#6b7280' }}
              />
              {d.name}
              {d.lat == null && <span className="text-muted-foreground">(offline)</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
