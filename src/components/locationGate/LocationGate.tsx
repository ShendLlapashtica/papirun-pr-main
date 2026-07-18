import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { OrderLocation } from '@/lib/ordersApi';
import { getSavedLocationChoice, saveLocationChoice, clearLocationChoice } from '@/lib/locationGate';
import LocationGateStep1 from './LocationGateStep1';
import LocationBanner from './LocationBanner';

const LocationGate = () => {
  const { pathname } = useLocation();
  const [choice, setChoice] = useState<OrderLocation | null>(() => getSavedLocationChoice()?.branch ?? null);

  // Only gate the web homepage for now — everything else (app shell, product/offer
  // deep links, admin/driver/login/etc.) is untouched.
  if (pathname !== '/') return null;

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
