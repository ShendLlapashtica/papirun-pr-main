import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  driverLat: number;
  driverLng: number;
  destLat: number;
  destLng: number;
  height?: string;
}

const OSRM = 'https://router.project-osrm.org/route/v1/driving';

function makeMotorcycleIcon() {
  return L.divIcon({
    className: '',
    html: '<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">🏍️</div>',
    iconAnchor: [13, 13],
  });
}

function makeFlagIcon() {
  return L.divIcon({
    className: '',
    html: '<div style="font-size:26px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))">🏁</div>',
    iconAnchor: [8, 26],
  });
}

export default function GtaDriverMap({ driverLat, driverLng, destLat, destLng, height = '260px' }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const bikeMarkerRef = useRef<L.Marker | null>(null);
  const flagMarkerRef = useRef<L.Marker | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);
  const lastFetchCoordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const [routeError, setRouteError] = useState(false);

  // Init map once
  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;
    const map = L.map(mapRef.current, {
      center: [driverLat, driverLng],
      zoom: 15,
      attributionControl: false,
      zoomControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    bikeMarkerRef.current = L.marker([driverLat, driverLng], { icon: makeMotorcycleIcon(), zIndexOffset: 100 }).addTo(map);
    flagMarkerRef.current = L.marker([destLat, destLng], { icon: makeFlagIcon() }).addTo(map);

    leafletRef.current = map;
    return () => { map.remove(); leafletRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch OSRM route when driver moves >30m from last fetch
  useEffect(() => {
    const last = lastFetchCoordsRef.current;
    const movedEnough = !last || Math.abs(last.lat - driverLat) > 0.0003 || Math.abs(last.lng - driverLng) > 0.0003;

    if (!movedEnough) {
      // Still update bike marker position without re-fetching route
      bikeMarkerRef.current?.setLatLng([driverLat, driverLng]);
      leafletRef.current?.panTo([driverLat, driverLng], { animate: true, duration: 0.5 });
      return;
    }

    lastFetchCoordsRef.current = { lat: driverLat, lng: driverLng };
    bikeMarkerRef.current?.setLatLng([driverLat, driverLng]);
    flagMarkerRef.current?.setLatLng([destLat, destLng]);

    const url = `${OSRM}/${driverLng},${driverLat};${destLng},${destLat}?geometries=geojson&overview=full`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        const coords: [number, number][] | undefined = data.routes?.[0]?.geometry?.coordinates;
        if (!coords) { setRouteError(true); return; }
        setRouteError(false);
        const latLngs = coords.map(([lng, lat]) => [lat, lng] as [number, number]);
        const map = leafletRef.current;
        if (!map) return;
        if (routeRef.current) map.removeLayer(routeRef.current);
        routeRef.current = L.polyline(latLngs, { color: '#ef4444', weight: 5, opacity: 0.85 }).addTo(map);
        map.fitBounds(routeRef.current.getBounds().pad(0.15));
      })
      .catch(() => setRouteError(true));
  }, [driverLat, driverLng, destLat, destLng]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-border/40 shadow-md" style={{ height }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
      {routeError && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/90 text-xs text-muted-foreground px-3 py-1 rounded-full border border-border/40">
          Rruga nuk mund të ngarkohet
        </div>
      )}
    </div>
  );
}
