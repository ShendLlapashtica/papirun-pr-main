import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, Car } from 'lucide-react';
import { fetchLocations, type StorefrontLocation } from '@/lib/locationsApi';

interface Props {
  customerLat: number;
  customerLng: number;
  customerLabel?: string;
}

interface RouteResult {
  loc: StorefrontLocation;
  durationMin: number;
  distanceKm: number;
  geometry: [number, number][]; // [lat, lng]
}

const COLORS = ['hsl(210 80% 55%)', 'hsl(280 70% 60%)', 'hsl(30 90% 55%)']; // first base = primary blue tone

const fetchOSRMRoute = async (
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): Promise<{ durationMin: number; distanceKm: number; geometry: [number, number][] } | null> => {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const route = data.routes?.[0];
    if (!route) return null;
    const coords: [number, number][] = (route.geometry?.coordinates ?? []).map((c: [number, number]) => [c[1], c[0]]);
    return {
      durationMin: Math.max(1, Math.round(route.duration / 60)),
      distanceKm: Math.round((route.distance / 1000) * 10) / 10,
      geometry: coords,
    };
  } catch {
    return null;
  }
};

const DeliveryRouteMap = ({ customerLat, customerLng, customerLabel }: Props) => {
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const [bases, setBases] = useState<StorefrontLocation[]>([]);
  const [routes, setRoutes] = useState<RouteResult[]>([]);
  const [loading, setLoading] = useState(true);

  // load bases
  useEffect(() => {
    fetchLocations()
      .then((all) => setBases(all.filter((l) => l.isActive && l.lat && l.lng)))
      .catch(() => setBases([]));
  }, []);

  // init map
  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;
    const map = L.map(mapElRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView([customerLat, customerLng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // compute routes when bases/customer change
  useEffect(() => {
    if (!bases.length || !customerLat || !customerLng) return;
    let active = true;
    setLoading(true);
    setRoutes([]);
    Promise.all(
      bases.map(async (loc) => {
        const r = await fetchOSRMRoute({ lat: loc.lat, lng: loc.lng }, { lat: customerLat, lng: customerLng });
        if (!r) return null;
        return { loc, ...r } as RouteResult;
      })
    ).then((results) => {
      if (!active) return;
      const valid = results.filter((r): r is RouteResult => !!r);
      setRoutes(valid);
      setLoading(false);
    });
    return () => { active = false; };
  }, [bases, customerLat, customerLng]);

  // sorted by duration (fastest first)
  const sortedRoutes = useMemo(
    () => [...routes].sort((a, b) => a.durationMin - b.durationMin),
    [routes]
  );
  const fastestId = sortedRoutes[0]?.loc.id;

  // draw markers + polylines
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();

    // customer marker
    const customerIcon = L.divIcon({
      className: '',
      html: `<div style="width:32px;height:32px;border-radius:50%;background:hsl(0 65% 55%);border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:white;font-size:14px;font-weight:bold;">📍</div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
    L.marker([customerLat, customerLng], { icon: customerIcon })
      .bindTooltip(customerLabel || 'Klienti', { permanent: false, direction: 'top' })
      .addTo(layer);

    // bases + routes
    routes.forEach((r, idx) => {
      const isFastest = r.loc.id === fastestId;
      const color = isFastest ? 'hsl(var(--primary))' : COLORS[idx % COLORS.length];

      const baseIcon = L.divIcon({
        className: '',
        html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;color:white;font-size:12px;font-weight:bold;">P</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      L.marker([r.loc.lat, r.loc.lng], { icon: baseIcon })
        .bindTooltip(r.loc.nameSq, { permanent: false, direction: 'top' })
        .addTo(layer);

      L.polyline(r.geometry, {
        color,
        weight: isFastest ? 6 : 3,
        opacity: isFastest ? 0.95 : 0.55,
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(layer);
    });

    // fitBounds
    const points: [number, number][] = [
      [customerLat, customerLng],
      ...routes.map((r) => [r.loc.lat, r.loc.lng] as [number, number]),
    ];
    if (points.length >= 2) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
    }
  }, [routes, fastestId, customerLat, customerLng, customerLabel]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border/40 bg-secondary/30">
      <div ref={mapElRef} className="w-full h-64" style={{ background: 'hsl(var(--secondary))' }} />

      {/* Badges overlay */}
      <div className="absolute top-2 left-2 right-2 flex flex-wrap gap-1.5 pointer-events-none z-[400]">
        {loading && (
          <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-full bg-background/80 backdrop-blur-md text-muted-foreground shadow-sm">
            <Loader2 className="w-3 h-3 animate-spin" />
            Po llogaritet rruga...
          </div>
        )}
        {!loading && sortedRoutes.map((r, idx) => {
          const isFastest = idx === 0;
          return (
            <div
              key={r.loc.id}
              className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-full backdrop-blur-md shadow-sm font-medium ${
                isFastest
                  ? 'bg-primary text-primary-foreground ring-1 ring-primary/40'
                  : 'bg-background/80 text-muted-foreground opacity-80'
              }`}
            >
              <Car className="w-3 h-3" />
              <span>{r.durationMin} min · {r.loc.nameSq}</span>
              {isFastest && <span className="text-[9px] uppercase tracking-wider opacity-90">· Sugjerohet</span>}
            </div>
          );
        })}
        {!loading && sortedRoutes.length === 0 && (
          <div className="text-[11px] px-2.5 py-1.5 rounded-full bg-background/80 backdrop-blur-md text-muted-foreground">
            Routing nuk u arrit
          </div>
        )}
      </div>
    </div>
  );
};

export default DeliveryRouteMap;
