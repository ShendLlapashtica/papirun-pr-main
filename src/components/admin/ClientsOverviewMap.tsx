import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';
import { assignDriverToOrder, RESTAURANT_COORDS, type DeliveryDriver } from '@/lib/driversApi';
import { type OrderRecord } from '@/lib/ordersApi';
import { X } from 'lucide-react';

interface Props {
  orders: OrderRecord[];
  drivers: DeliveryDriver[];
  onClose: () => void;
}

const STATUS_COLOR: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#22c55e',
};

export default function ClientsOverviewMap({ orders, drivers, onClose }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  const geo = orders.filter((o) => o.deliveryLat && o.deliveryLng && ['pending', 'approved'].includes(o.status));

  useEffect(() => {
    if (!mapRef.current || leafletRef.current) return;
    const map = L.map(mapRef.current, {
      center: [RESTAURANT_COORDS.lat, RESTAURANT_COORDS.lng],
      zoom: 13,
      attributionControl: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    leafletRef.current = map;

    // Restaurant marker
    L.circleMarker([RESTAURANT_COORDS.lat, RESTAURANT_COORDS.lng], {
      radius: 10, color: '#6366f1', fillColor: '#6366f1', fillOpacity: 0.9, weight: 2,
    }).addTo(map).bindTooltip('🍕 Baza', { permanent: false });

    return () => { map.remove(); leafletRef.current = null; };
  }, []);

  // Sync markers when orders or selection changes
  useEffect(() => {
    const map = leafletRef.current;
    if (!map) return;

    // Remove markers for orders no longer in geo list
    for (const [id, marker] of Array.from(markersRef.current.entries())) {
      if (!geo.find((o) => o.id === id)) {
        map.removeLayer(marker);
        markersRef.current.delete(id);
      }
    }

    for (const o of geo) {
      const isSelected = selectedIds.has(o.id);
      const color = isSelected ? '#6366f1' : (STATUS_COLOR[o.status] ?? '#6b7280');
      const existing = markersRef.current.get(o.id);

      if (existing) {
        existing.setStyle({ color, fillColor: color, radius: isSelected ? 12 : 9, weight: isSelected ? 3 : 2 });
      } else {
        const marker = L.circleMarker([o.deliveryLat!, o.deliveryLng!], {
          radius: 9, color, fillColor: color, fillOpacity: 0.75, weight: 2,
        }).addTo(map);
        marker.bindTooltip(
          `<strong>${o.customerName}</strong><br/>${o.deliveryAddress}<br/>€${o.total.toFixed(2)}`,
          { sticky: true }
        );
        marker.on('click', () => {
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(o.id) ? next.delete(o.id) : next.add(o.id);
            return next;
          });
        });
        markersRef.current.set(o.id, marker);
      }
    }

    if (geo.length > 0) {
      const bounds = L.latLngBounds(geo.map((o) => [o.deliveryLat!, o.deliveryLng!] as [number, number]));
      map.fitBounds(bounds.pad(0.15));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo.length, selectedIds]);

  const handleAssign = async (driver: DeliveryDriver) => {
    if (selectedIds.size === 0) return;
    setAssigning(true);
    let ok = 0;
    for (const id of Array.from(selectedIds)) {
      const order = orders.find((o) => o.id === id);
      if (!order) continue;
      try {
        await assignDriverToOrder(id, driver.id, {
          customerName: order.customerName,
          address: order.deliveryAddress,
          total: order.total,
        });
        ok++;
      } catch { /* skip */ }
    }
    setAssigning(false);
    toast.success(`${driver.name} u caktua për ${ok} porosi`);
    setSelectedIds(new Set());
  };

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden border border-border/40 shadow-md">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-card border-b border-border/40 shrink-0">
        <span className="text-sm font-bold flex-1">🗺️ Harta e Klientëve · {geo.length} porosi</span>
        {selectedIds.size > 0 && (
          <span className="text-xs font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
            {selectedIds.size} zgjedhur
          </span>
        )}
        <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-secondary transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div ref={mapRef} className="flex-1 min-h-0" style={{ minHeight: 320 }} />

      {selectedIds.size > 0 && (
        <div className="px-3 py-2.5 bg-card border-t border-border/40 shrink-0">
          <p className="text-[11px] text-muted-foreground mb-1.5">Cakto {selectedIds.size} porosi tek shoferi:</p>
          <div className="flex flex-wrap gap-1.5">
            {drivers.filter((d) => d.isActive).map((d) => {
              const emoji = d.isReturning ? '🏁' : d.isPaused ? '☕' : '✅';
              return (
                <button
                  key={d.id}
                  disabled={assigning}
                  onClick={() => handleAssign(d)}
                  className="text-xs px-3 py-1.5 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {emoji} {d.name}
                </button>
              );
            })}
            <button
              onClick={() => setSelectedIds(new Set())}
              className="text-xs px-3 py-1.5 rounded-xl font-medium bg-secondary text-muted-foreground hover:bg-secondary/80 transition-colors"
            >
              Pastro
            </button>
          </div>
        </div>
      )}

      {selectedIds.size === 0 && (
        <div className="px-4 py-2 bg-card border-t border-border/40 shrink-0">
          <p className="text-[11px] text-muted-foreground">Kliko mbi një marker për ta zgjedhur · <span className="text-amber-600">●</span> Në pritje &nbsp;<span className="text-emerald-600">●</span> Konfirmuar</p>
        </div>
      )}
    </div>
  );
}
