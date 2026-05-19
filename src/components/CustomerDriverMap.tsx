import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation } from 'lucide-react';

interface Props {
  driverLat: number;
  driverLng: number;
  customerLat: number;
  customerLng: number;
  etaMinutes: number | null;
  driverName?: string;
  driverColor?: string;
  onRouteLoaded?: (durationSec: number) => void;
}

function injectPulseCSS() {
  if (document.getElementById('cdm-pulse')) return;
  const s = document.createElement('style');
  s.id = 'cdm-pulse';
  s.textContent =
    '@keyframes cdmPulse{0%{transform:scale(1);opacity:.45}70%{transform:scale(2.5);opacity:0}100%{transform:scale(2.5);opacity:0}}';
  document.head.appendChild(s);
}

function makeDriverMarkerIcon(color: string, name: string) {
  const initials = name.slice(0, 2).toUpperCase();
  return L.divIcon({
    html: `
      <div style="position:relative;width:36px;height:36px;">
        <div style="position:absolute;width:52px;height:52px;border-radius:50%;top:-8px;left:-8px;background:${color};opacity:0.35;animation:cdmPulse 2s ease-out infinite;pointer-events:none"></div>
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

async function fetchOsrmRoute(
  dLat: number, dLng: number,
  cLat: number, cLng: number
): Promise<{ geometry: [number, number][]; durationSec: number }> {
  const url = `https://router.project-osrm.org/route/v1/driving/${dLng},${dLat};${cLng},${cLat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('OSRM error');
  const data = await res.json();
  const route = data.routes[0];
  return {
    // OSRM returns [lng, lat]; Leaflet needs [lat, lng]
    geometry: route.geometry.coordinates.map(
      ([lng, lat]: [number, number]) => [lat, lng] as [number, number]
    ),
    durationSec: route.duration,
  };
}

export default function CustomerDriverMap({
  driverLat,
  driverLng,
  customerLat,
  customerLng,
  etaMinutes,
  driverName = 'SH',
  driverColor = '#3b82f6',
  onRouteLoaded,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const driverMarkerRef = useRef<L.Marker | null>(null);
  const destMarkerRef = useRef<L.Marker | null>(null);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const routeFetchRef = useRef<AbortController | null>(null);
  // Keep latest onRouteLoaded without re-running effects
  const onRouteLoadedRef = useRef(onRouteLoaded);
  onRouteLoadedRef.current = onRouteLoaded;

  const updateRoute = async (dLat: number, dLng: number, cLat: number, cLng: number) => {
    if (routeFetchRef.current) routeFetchRef.current.abort();
    const ctrl = new AbortController();
    routeFetchRef.current = ctrl;
    try {
      const result = await fetchOsrmRoute(dLat, dLng, cLat, cLng);
      if (ctrl.signal.aborted) return;
      routeLineRef.current?.setLatLngs(result.geometry);
      onRouteLoadedRef.current?.(result.durationSec);
    } catch {
      if (ctrl.signal.aborted) return;
      // Fallback to straight line — don't update ETA so stale value stays
      routeLineRef.current?.setLatLngs([[dLat, dLng], [cLat, cLng]]);
    }
  };

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    injectPulseCSS();

    const midLat = (driverLat + customerLat) / 2;
    const midLng = (driverLng + customerLng) / 2;

    const map = L.map(containerRef.current, {
      center: [midLat, midLng],
      zoom: 14,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    const driverMarker = L.marker([driverLat, driverLng], {
      icon: makeDriverMarkerIcon(driverColor, driverName),
    }).addTo(map);

    const destMarker = L.marker([customerLat, customerLng], {
      icon: makeDestIcon(),
    }).addTo(map);

    // Start with straight line; OSRM route replaces it once loaded
    const routeLine = L.polyline(
      [[driverLat, driverLng], [customerLat, customerLng]],
      { color: driverColor, weight: 4, opacity: 0.85, dashArray: '10, 6' }
    ).addTo(map);

    map.fitBounds(
      L.latLngBounds([driverLat, driverLng], [customerLat, customerLng]),
      { padding: [40, 40] }
    );

    mapRef.current = map;
    driverMarkerRef.current = driverMarker;
    destMarkerRef.current = destMarker;
    routeLineRef.current = routeLine;

    setTimeout(() => map.invalidateSize(), 200);

    updateRoute(driverLat, driverLng, customerLat, customerLng);

    return () => {
      routeFetchRef.current?.abort();
      map.remove();
      mapRef.current = null;
      driverMarkerRef.current = null;
      destMarkerRef.current = null;
      routeLineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move driver marker and refresh road route whenever driver position changes
  useEffect(() => {
    if (!mapRef.current || !driverMarkerRef.current || !routeLineRef.current) return;
    driverMarkerRef.current.setLatLng([driverLat, driverLng]);
    mapRef.current.fitBounds(
      L.latLngBounds([driverLat, driverLng], [customerLat, customerLng]),
      { padding: [40, 40], animate: true, duration: 0.6 }
    );
    updateRoute(driverLat, driverLng, customerLat, customerLng);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverLat, driverLng, customerLat, customerLng]);

  return (
    <div className="relative overflow-hidden rounded-xl border border-border/40">
      {/* ETA badge — left-1 keeps it tight to the left edge */}
      <div className="absolute top-2 left-1 z-[400] flex items-center gap-1.5 bg-background/90 backdrop-blur-md rounded-full px-3 py-1.5 shadow-md border border-border/40 text-xs font-semibold">
        <Navigation className="w-3 h-3 text-primary" />
        {etaMinutes !== null
          ? `~${etaMinutes} min deri tek ju`
          : 'Duke llogaritur...'}
      </div>
      <div ref={containerRef} style={{ height: '200px', width: '100%' }} />
    </div>
  );
}
