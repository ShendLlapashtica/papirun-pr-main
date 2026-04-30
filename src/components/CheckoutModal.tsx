import { useCallback, useEffect, useState } from 'react';
import { MessageCircle, X, Send, Loader2, MapPin, AlertTriangle, Bookmark } from 'lucide-react';
import { toast } from 'sonner';
import type { CartItem } from '@/types/menu';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { getIngredientName } from '@/data/ingredientTranslations';
import AddressMapPicker from '@/components/checkout/AddressMapPicker';
// OrderStatusModal handled globally via OrderTrackingPill
import { getCartLineTotal } from '@/lib/cartPricing';
import { createOrder, detectOrderSource } from '@/lib/ordersApi';
import { setActiveOrderId } from '@/components/OrderTrackingPill';
import { fetchAddresses, saveAddress, deleteAddress, type SavedAddress } from '@/lib/addressesApi';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  total: number;
  onSuccess: () => void;
}

const WHATSAPP_FALLBACK = '38345262323';
const ORDER_STORAGE_KEY = 'papirun_last_order_id';

const CheckoutModal = ({ isOpen, onClose, items, total, onSuccess }: CheckoutModalProps) => {
  const { language, t } = useLanguage();
  const { user } = useAuth();
  const [formData, setFormData] = useState({ name: '', phone: '', address: '', notes: '' });
  const [selectedPosition, setSelectedPosition] = useState<[number, number] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [trackingOrderId] = useState<string | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  // Default OFF — user must explicitly check the box to save.
  // Empty label by default so the user types a meaningful name (no auto-"Shtëpia").
  const [saveAddrFlag, setSaveAddrFlag] = useState(false);
  const [saveAddrLabel, setSaveAddrLabel] = useState('');

  // Load saved addresses for logged-in users; auto-prefill default
  useEffect(() => {
    if (!user || !isOpen) return;
    fetchAddresses(user.id)
      .then((addrs) => {
        setSavedAddresses(addrs);
        const def = addrs.find((a) => a.isDefault) ?? addrs[0];
        if (def && !formData.address) {
          setFormData((prev) => ({ ...prev, address: def.address }));
          if (def.lat !== null && def.lng !== null) setSelectedPosition([def.lat, def.lng]);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isOpen]);

  const handleMapSelect = useCallback(({ fullAddress, position }: { fullAddress: string; position: [number, number] }) => {
    setSelectedPosition(position);
    setFormData((prev) => ({ ...prev, address: fullAddress }));
  }, []);

  const pickSavedAddress = (a: SavedAddress) => {
    setFormData((prev) => ({ ...prev, address: a.address }));
    if (a.lat !== null && a.lng !== null) setSelectedPosition([a.lat, a.lng]);
    toast.success(`${a.label} u zgjodh`);
  };

  // Inline delete from saved-address chips row — useful when the address is
  // wrong/outdated and the user wants to clean it up without leaving checkout.
  const removeSavedAddress = async (e: React.MouseEvent, a: SavedAddress) => {
    e.stopPropagation();
    try {
      await deleteAddress(a.id);
      setSavedAddresses((prev) => prev.filter((x) => x.id !== a.id));
      if (formData.address.trim() === a.address.trim()) {
        setFormData((prev) => ({ ...prev, address: '' }));
        setSelectedPosition(null);
      }
      toast.success(language === 'sq' ? 'Adresa u fshi' : 'Address deleted');
    } catch {
      toast.error(language === 'sq' ? 'Gabim' : 'Failed');
    }
  };

  // Force location: must have BOTH a pin on map AND an address string
  const hasLocation = selectedPosition !== null && formData.address.trim().length > 0;
  const isFormValid = formData.name.trim() && formData.phone.trim() && hasLocation;

  const resetForm = () => {
    setFormData({ name: '', phone: '', address: '', notes: '' });
    setSelectedPosition(null);
  };

  const handleSubmit = async () => {
    if (!hasLocation) {
      toast.error(language === 'sq'
        ? '📍 Aktivizo lokacionin ose vendos pinin në hartë para se të porosisësh'
        : '📍 Enable location or set pin on map before ordering', { duration: 4000 });
      return;
    }
    if (!isFormValid) return;
    setSubmitting(true);
    try {
      const order = await createOrder({
        userId: user?.id ?? null,
        customerName: formData.name.trim(),
        customerPhone: formData.phone.trim(),
        deliveryAddress: formData.address.trim(),
        deliveryLat: selectedPosition?.[0] ?? null,
        deliveryLng: selectedPosition?.[1] ?? null,
        items,
        subtotal: total,
        deliveryFee: 0,
        total,
        notes: formData.notes.trim(),
        source: detectOrderSource(),
      });
      try { localStorage.setItem(ORDER_STORAGE_KEY, order.id); } catch {}
      // Save address for logged-in users (if requested and not already saved)
      // Save address ONLY when user explicitly opted in AND provided a label.
      if (user && saveAddrFlag && selectedPosition && saveAddrLabel.trim()) {
        const exists = savedAddresses.some((a) => a.address.trim() === formData.address.trim());
        if (!exists) {
          saveAddress({
            userId: user.id,
            label: saveAddrLabel.trim(),
            address: formData.address.trim(),
            lat: selectedPosition[0],
            lng: selectedPosition[1],
            isDefault: savedAddresses.length === 0,
          }).catch(() => {});
        }
      }
      // Trigger global pending overlay (full-screen, unskippable) — do NOT open OrderStatusModal here.
      setActiveOrderId(order.id);
      onSuccess();
      resetForm();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Gabim gjatë dërgimit të porosisë');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWhatsAppFallback = () => {
    const foodSummary = items
      .map((item) => {
        let line = `${item.quantity}x ${item.name[language]}`;
        const mods: string[] = [];
        if (item.removedIngredients?.length) mods.push(...item.removedIngredients.map((ing) => `Pa ${getIngredientName(ing, language)}`));
        if (item.addedExtras?.length) mods.push(...item.addedExtras.map((ext) => `Me ${ext.name[language]} (+€${ext.price.toFixed(2)})`));
        if (mods.length > 0) line += ` (${mods.join(', ')})`;
        if (item.customerNote?.trim()) line += `\n   📝 ${item.customerNote.trim()}`;
        return `${line} = €${getCartLineTotal(item).toFixed(2)}`;
      })
      .join('\n');
    const [lat, lng] = selectedPosition ?? [null, null];
    const mapsLink = lat !== null && lng !== null
      ? `https://www.google.com/maps?q=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formData.address)}`;
    const msg = `🍔 *Porosi e Re*\nKlienti: ${formData.name}\nTel: ${formData.phone}\n\n${foodSummary}\n\nTotali: €${total.toFixed(2)}\nAdresa: ${formData.address}\nLokacioni: ${mapsLink}\nShenime: ${formData.notes.trim() || '-'}`;
    window.open(`https://wa.me/${WHATSAPP_FALLBACK}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
  };

  if (!isOpen && !trackingOrderId) return null;

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm" onClick={onClose} />
          <div
            className="relative w-full max-w-lg bg-background rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-background flex items-center justify-between p-4 sm:p-6 border-b border-border z-10 shrink-0">
              <h2 className="font-display font-bold text-lg sm:text-xl">{t.checkout.title}</h2>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-6" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="bg-secondary/50 rounded-xl p-3 sm:p-4">
                <h3 className="font-semibold text-sm mb-2 sm:mb-3">{t.checkout.orderSummary}</h3>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={`${item.id}-${idx}`}>
                      <div className="flex justify-between text-xs sm:text-sm">
                        <span>{item.quantity}x {item.name[language]}</span>
                        <span className="text-primary font-medium">€{getCartLineTotal(item).toFixed(2)}</span>
                      </div>
                      {((item.removedIngredients?.length ?? 0) > 0 || (item.addedExtras?.length ?? 0) > 0) && (
                        <div className="flex flex-wrap gap-1 mt-0.5 ml-4">
                          {item.removedIngredients?.map((ing) => (
                            <span key={ing} className="text-[10px] text-destructive">Pa {getIngredientName(ing, language)}</span>
                          ))}
                          {item.addedExtras?.map((ext) => (
                            <span key={ext.id} className="text-[10px] text-accent-foreground">Me {ext.name[language]} (+€{ext.price.toFixed(2)})</span>
                          ))}
                        </div>
                      )}
                      {item.customerNote?.trim() && (
                        <p className="text-[10px] text-muted-foreground ml-4 mt-0.5 italic">📝 {item.customerNote}</p>
                      )}
                    </div>
                  ))}
                  <div className="border-t border-border pt-2 mt-2 flex justify-between font-semibold text-sm sm:text-base">
                    <span>{t.checkout.total}</span>
                    <span className="text-primary">€{total.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <h3 className="font-semibold text-sm">{t.checkout.yourInfo}</h3>

                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-1.5">{t.checkout.name}</label>
                  <input
                    type="text" required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder={t.checkout.namePlaceholder}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-1.5">{t.checkout.phone}</label>
                  <input
                    type="tel" required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder={t.checkout.phonePlaceholder}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-1.5">
                    {language === 'sq' ? 'Adresa e Dergeses' : 'Delivery Address'}
                  </label>

                  {/* Saved addresses chips for logged-in users */}
                  {user && savedAddresses.length > 0 && (
                    <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1 -mx-1 px-1">
                      {savedAddresses.map((a) => {
                        const selected = formData.address === a.address;
                        return (
                          <div
                            key={a.id}
                            className={`shrink-0 inline-flex items-center rounded-full text-xs font-medium transition-all overflow-hidden ${
                              selected
                                ? 'bg-primary text-primary-foreground shadow-sm'
                                : 'bg-secondary text-muted-foreground'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => pickSavedAddress(a)}
                              className="flex items-center gap-1 pl-3 pr-1.5 py-1.5 active:scale-95 transition-transform"
                            >
                              <Bookmark className="w-3 h-3" /> {a.label}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => removeSavedAddress(e, a)}
                              aria-label={language === 'sq' ? 'Fshi adresën e ruajtur' : 'Delete saved address'}
                              className="pr-2 pl-1 py-1.5 active:scale-90 transition-all opacity-70 hover:opacity-100 hover:text-destructive"
                            >
                              <X className="w-3 h-3" strokeWidth={2.6} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <input
                    type="text" readOnly
                    value={formData.address}
                    placeholder={language === 'sq' ? 'Zgjidhni vendndodhjen në hartë' : 'Select location on map'}
                    className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border-0 text-sm transition-all mb-2 ${
                      formData.address ? 'bg-primary/10 ring-2 ring-primary/30 text-foreground' : 'bg-secondary text-muted-foreground'
                    }`}
                  />
                  <AddressMapPicker selectedPosition={selectedPosition} onSelectAddress={handleMapSelect} />

                  {/* Save address option for logged-in users */}
                  {user && hasLocation && !savedAddresses.some((a) => a.address.trim() === formData.address.trim()) && (
                    <div className="mt-2 flex items-center gap-2 bg-secondary/40 rounded-xl p-2.5">
                      <input
                        type="checkbox"
                        id="saveAddr"
                        checked={saveAddrFlag}
                        onChange={(e) => setSaveAddrFlag(e.target.checked)}
                        className="w-4 h-4 rounded accent-primary"
                      />
                      <label htmlFor="saveAddr" className="text-xs font-medium cursor-pointer flex-1">
                        {language === 'sq' ? 'Ruaj me emër:' : 'Save as:'}
                      </label>
                      <input
                        type="text"
                        value={saveAddrLabel}
                        onChange={(e) => setSaveAddrLabel(e.target.value)}
                        disabled={!saveAddrFlag}
                        className="flex-1 max-w-[130px] px-2 py-1 rounded-lg bg-background text-xs disabled:opacity-50"
                        placeholder={language === 'sq' ? 'p.sh. Shtëpia, Puna' : 'e.g. Home, Work'}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium mb-1.5">{t.checkout.notes}</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder={t.checkout.notesPlaceholder}
                    rows={2}
                    className="w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                  />
                </div>
              </div>

              {/* Force-location warning when missing */}
              {!hasLocation && (
                <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                      {language === 'sq' ? 'Lokacioni i kërkuar' : 'Location required'}
                    </p>
                    <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                      {language === 'sq'
                        ? 'Aktivizoni lokacionin GPS ose vendosni pinin në hartë.'
                        : 'Enable GPS or place a pin on the map.'}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isFormValid || submitting}
                  className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-3.5 px-4 rounded-xl bg-primary text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : !hasLocation ? <MapPin className="w-5 h-5" /> : <Send className="w-5 h-5" />}
                  {submitting ? 'Duke dërguar...' : !hasLocation ? (language === 'sq' ? 'AKTIVIZO LOKACIONIN' : 'ENABLE LOCATION') : 'POROSIT'}
                </button>
                <button
                  type="button"
                  onClick={handleWhatsAppFallback}
                  disabled={!isFormValid}
                  className="w-full flex items-center justify-center gap-2 text-xs font-medium py-2.5 px-4 rounded-xl bg-secondary text-muted-foreground transition-all hover:bg-secondary/80 disabled:opacity-50"
                >
                  <MessageCircle className="w-4 h-4" />
                  Backup: dërgo në WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Status modal handled globally via OrderTrackingPill */}
    </>
  );
};

export default CheckoutModal;
