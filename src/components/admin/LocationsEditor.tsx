import { useEffect, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchLocations,
  upsertLocation,
  updateLocation,
  deleteLocation,
  subscribeLocationsRealtime,
  type StorefrontLocation,
} from '@/lib/locationsApi';

const minutesToTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const timeToMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const LocationsEditor = () => {
  const [locations, setLocations] = useState<StorefrontLocation[]>([]);
  const [editing, setEditing] = useState<Record<string, StorefrontLocation>>({});

  useEffect(() => {
    let active = true;
    const sync = async () => {
      try {
        const data = await fetchLocations();
        if (active) setLocations(data);
      } catch (e) { console.error(e); }
    };
    sync();
    const unsub = subscribeLocationsRealtime(sync);
    return () => { active = false; unsub(); };
  }, []);

  const get = (loc: StorefrontLocation) => editing[loc.id] ?? loc;
  const setField = (id: string, patch: Partial<StorefrontLocation>) => {
    const base = editing[id] ?? locations.find((l) => l.id === id);
    if (!base) return;
    setEditing({ ...editing, [id]: { ...base, ...patch } });
  };

  const handleSave = async (id: string) => {
    const next = editing[id];
    if (!next) return;
    try {
      await upsertLocation(next);
      const fresh = { ...editing };
      delete fresh[id];
      setEditing(fresh);
      toast.success('Lokacioni u ruajt');
    } catch (e) { toast.error('Gabim gjatë ruajtjes'); console.error(e); }
  };

  const handleAddNew = async () => {
    const id = `loc-${Date.now()}`;
    const newLoc: StorefrontLocation = {
      id,
      nameSq: 'Lokacion i Ri',
      nameEn: 'New Location',
      hoursSq: 'E Hënë - E Shtunë: 09:00-21:00',
      hoursEn: 'Mon - Sat: 09:00-21:00',
      openDays: [1, 2, 3, 4, 5, 6],
      openMinute: 540,
      closeMinute: 1260,
      lat: 42.6629,
      lng: 21.1655,
      addressSq: '',
      addressEn: '',
      whatsappPhone: '38345262323',
      isActive: true,
      sortOrder: locations.length,
    };
    try { await upsertLocation(newLoc); toast.success('U shtua'); } catch (e) { console.error(e); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Të fshihet ky lokacion?')) return;
    try { await deleteLocation(id); toast.success('U fshi'); } catch (e) { console.error(e); }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handleAddNew}
        className="w-full py-4 rounded-2xl border-2 border-dashed border-primary/30 text-primary hover:border-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-2 text-sm font-medium"
      >
        <Plus className="w-5 h-5" /> Shto Lokacion
      </button>

      {locations.map((loc) => {
        const v = get(loc);
        const hasChanges = !!editing[loc.id];
        return (
          <div key={loc.id} className="bg-card rounded-2xl p-4 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-bold text-base">{v.nameSq}</h3>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={v.isActive}
                  onChange={(e) => {
                    setField(loc.id, { isActive: e.target.checked });
                    updateLocation(loc.id, { isActive: e.target.checked }).catch(console.error);
                  }}
                />
                Aktiv
              </label>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input value={v.nameSq} onChange={(e) => setField(loc.id, { nameSq: e.target.value })} placeholder="Emri (SQ)" className="px-3 py-2 rounded-lg bg-secondary text-sm" />
              <input value={v.nameEn} onChange={(e) => setField(loc.id, { nameEn: e.target.value })} placeholder="Name (EN)" className="px-3 py-2 rounded-lg bg-secondary text-sm" />
              <input value={v.hoursSq} onChange={(e) => setField(loc.id, { hoursSq: e.target.value })} placeholder="Orari (SQ)" className="px-3 py-2 rounded-lg bg-secondary text-sm" />
              <input value={v.hoursEn} onChange={(e) => setField(loc.id, { hoursEn: e.target.value })} placeholder="Hours (EN)" className="px-3 py-2 rounded-lg bg-secondary text-sm" />
              <div>
                <label className="text-xs text-muted-foreground">Hapet</label>
                <input type="time" value={minutesToTime(v.openMinute)} onChange={(e) => setField(loc.id, { openMinute: timeToMinutes(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-secondary text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Mbyllet</label>
                <input type="time" value={minutesToTime(v.closeMinute)} onChange={(e) => setField(loc.id, { closeMinute: timeToMinutes(e.target.value) })} className="w-full px-3 py-2 rounded-lg bg-secondary text-sm" />
              </div>
              <input type="number" step="0.0001" value={v.lat} onChange={(e) => setField(loc.id, { lat: parseFloat(e.target.value) || 0 })} placeholder="Latitude" className="px-3 py-2 rounded-lg bg-secondary text-sm" />
              <input type="number" step="0.0001" value={v.lng} onChange={(e) => setField(loc.id, { lng: parseFloat(e.target.value) || 0 })} placeholder="Longitude" className="px-3 py-2 rounded-lg bg-secondary text-sm" />
              <input value={v.addressSq} onChange={(e) => setField(loc.id, { addressSq: e.target.value })} placeholder="Adresa (SQ)" className="px-3 py-2 rounded-lg bg-secondary text-sm" />
              <input value={v.addressEn} onChange={(e) => setField(loc.id, { addressEn: e.target.value })} placeholder="Address (EN)" className="px-3 py-2 rounded-lg bg-secondary text-sm" />
              <input value={v.whatsappPhone} onChange={(e) => setField(loc.id, { whatsappPhone: e.target.value })} placeholder="WhatsApp p.sh. 38345262323" className="px-3 py-2 rounded-lg bg-secondary text-sm sm:col-span-2" />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handleSave(loc.id)}
                disabled={!hasChanges}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40"
              >
                <Save className="w-4 h-4" /> Ruaj
              </button>
              <button
                onClick={() => handleDelete(loc.id)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-destructive/10 text-destructive text-sm font-medium"
              >
                <Trash2 className="w-4 h-4" /> Fshij
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LocationsEditor;
