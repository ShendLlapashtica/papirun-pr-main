import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { OrderLocation } from '@/lib/ordersApi';
import { getSavedLocationChoice, saveLocationChoice, clearLocationChoice, isGateExemptRoute } from '@/lib/locationGate';
import LocationGateStep1 from './LocationGateStep1';
import LocationBanner from './LocationBanner';

const LocationGate = () => {
  const { pathname } = useLocation();
  const [choice, setChoice] = useState<OrderLocation | null>(() => getSavedLocationChoice()?.branch ?? null);

  // Applies to every customer ordering surface (homepage, product pages, offer
  // pages) so the banner/gate is visible wherever someone could reach checkout
  // from — not just the homepage. App shell and staff/utility routes are exempt.
  if (isGateExemptRoute(pathname)) return null;

  const handlePick = (branch: OrderLocation) => {
    saveLocationChoice({ branch });
    setChoice(branch);
  };

  const handleChange = () => {
    clearLocationChoice();
    setChoice(null);
  };

  if (!choice) return <LocationGateStep1 onPick={handlePick} />;

  return <LocationBanner branch={choice} onChange={handleChange} />;
};

export default LocationGate;
