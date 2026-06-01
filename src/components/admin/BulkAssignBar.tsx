import { useState } from 'react';
import { toast } from 'sonner';
import { assignDriverToOrder, type DeliveryDriver } from '@/lib/driversApi';
import { type OrderRecord } from '@/lib/ordersApi';
import { Loader2, Trash2 } from 'lucide-react';

interface Props {
  selectedIds: Set<string>;
  orders: OrderRecord[];
  drivers: DeliveryDriver[];
  onDone: () => void;
  onSoftDelete?: () => void;
}

export default function BulkAssignBar({ selectedIds, orders, drivers, onDone, onSoftDelete }: Props) {
  const [assigning, setAssigning] = useState(false);

  if (selectedIds.size === 0) return null;

  const handleAssign = async (driver: DeliveryDriver) => {
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
      } catch { /* continue with others */ }
    }
    setAssigning(false);
    toast.success(`${driver.name} u caktua për ${ok} porosi`);
    onDone();
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-lg">
      <div className="bg-card/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-border/40 p-3">
        <div className="flex items-center gap-2 mb-2.5">
          <span className="text-xs font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
            {selectedIds.size} zgjedhur
          </span>
          <span className="text-xs text-muted-foreground flex-1">Cakto të gjitha tek shoferi:</span>
          {assigning && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {drivers.filter((d) => d.isActive).map((d) => {
            const emoji = d.isReturning ? '🏁' : d.isPaused ? '☕' : '✅';
            return (
              <button
                key={d.id}
                disabled={assigning}
                onClick={() => handleAssign(d)}
                className="flex items-center gap-1 text-xs px-3 py-2 rounded-xl font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                {emoji} {d.name}
              </button>
            );
          })}
          {onSoftDelete && (
            <button
              disabled={assigning}
              onClick={onSoftDelete}
              className="flex items-center gap-1 text-xs px-3 py-2 rounded-xl font-bold bg-destructive/15 text-destructive hover:bg-destructive/25 disabled:opacity-50 transition-colors shadow-sm ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" /> Fshi → Histori
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
