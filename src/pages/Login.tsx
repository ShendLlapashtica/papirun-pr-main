import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import L from 'leaflet';
import {
  Mail, ArrowRight, Loader2, ArrowLeft, Sparkles,
  User, Phone, MapPin, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import logo from '@/assets/logo.png';

type Mode = 'signup' | 'login';
type Step = 'name' | 'location' | 'email' | 'otp' | 'done';

interface FormData {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  lat: number | null;
  lng: number | null;
  email: string;
}

const MAX_OTP = 5;
const COOLDOWN_SECS = 60;
const PRISHTINA = { lat: 42.662914, lng: 21.165503 };

// Vertical slide: enter from below, exit upward
const slideVariants = {
  initial: (dir: number) => ({ y: dir * 48, opacity: 0 }),
  animate: { y: 0, opacity: 1 },
  exit: (dir: number) => ({ y: dir * -48, opacity: 0 }),
};
const spring = { type: 'spring' as const, stiffness: 340, damping: 32 };

/* ─── shared style helpers ─────────────────────────────────── */
const inputBase =
  'w-full rounded-2xl text-sm text-white placeholder:text-white/30 focus:outline-none transition-all';
const inputStyle: React.CSSProperties = {
  background: 'hsl(0 0% 100% / 0.05)',
  border: '1px solid hsl(0 0% 100% / 0.1)',
};
const btnGreen: React.CSSProperties = {
  background: 'linear-gradient(135deg, hsl(142 70% 45%) 0%, hsl(142 65% 38%) 100%)',
  color: 'white',
  boxShadow: '0 10px 30px -8px hsl(142 70% 45% / 0.5), inset 0 1px 0 hsl(0 0% 100% / 0.2)',
};
const onIF = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = 'hsl(142 70% 45% / 0.6)';
  e.currentTarget.style.background = 'hsl(0 0% 100% / 0.08)';
};
const onIB = (e: React.FocusEvent<HTMLInputElement>) => {
  e.currentTarget.style.borderColor = 'hsl(0 0% 100% / 0.1)';
  e.currentTarget.style.background = 'hsl(0 0% 100% / 0.05)';
};

const Login = () => {
  const { requestOtp, verifyOtp, user } = useAuth();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('signup');
  const [step, setStep] = useState<Step>('name');
  const [dir, setDir] = useState(1);
  const [data, setData] = useState<FormData>({
    firstName: '', lastName: '', phone: '',
    address: '', lat: null, lng: null, email: '',
  });
  const [otp, setOtp] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sendCount, setSendCount] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  // Leaflet refs — stable across renders
  const mapElRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const dataRef = useRef(data);
  const [geoLoading, setGeoLoading] = useState(false);
  const [addrLoading, setAddrLoading] = useState(false);

  // Keep dataRef in sync without triggering map re-init
  useEffect(() => { dataRef.current = data; }, [data]);

  // Redirect already-logged-in users
  useEffect(() => {
    if (user) navigate('/home', { replace: true });
  }, [user, navigate]);

  // Cooldown tick
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  /* ─── reverse geocoder (useCallback so it stays stable) ───── */
  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    setAddrLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'Accept-Language': language === 'sq' ? 'sq,en' : 'en' } }
      );
      const json = await res.json();
      setData(prev => ({ ...prev, address: json.display_name ?? '', lat, lng }));
    } catch {
      setData(prev => ({ ...prev, lat, lng }));
    } finally {
      setAddrLoading(false);
    }
  }, [language]);

  // Keep a ref so the map event listeners always call the latest version
  const revGeoRef = useRef(reverseGeocode);
  useEffect(() => { revGeoRef.current = reverseGeocode; }, [reverseGeocode]);

  /* ─── Leaflet map lifecycle ─────────────────────────────────── */
  useEffect(() => {
    if (step !== 'location') {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
      return;
    }
    if (!mapElRef.current || mapRef.current) return;

    const initLat = dataRef.current.lat ?? PRISHTINA.lat;
    const initLng = dataRef.current.lng ?? PRISHTINA.lng;

    const map = L.map(mapElRef.current, {
      center: [initLat, initLng],
      zoom: 15,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { subdomains: 'abcd', maxZoom: 19 }
    ).addTo(map);

    const pinIcon = L.divIcon({
      html: `<div style="
        width:26px;height:26px;
        background:hsl(142 70% 45%);
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        border:3px solid #fff;
        box-shadow:0 4px 16px rgba(0,0,0,.5);
      "></div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 26],
      className: '',
    });

    const marker = L.marker([initLat, initLng], { icon: pinIcon, draggable: true }).addTo(map);
    markerRef.current = marker;
    mapRef.current = map;

    const pinMove = (lat: number, lng: number) => {
      marker.setLatLng([lat, lng]);
      revGeoRef.current(lat, lng);
    };

    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng();
      revGeoRef.current(lat, lng);
    });

    map.on('click', (e) => pinMove(e.latlng.lat, e.latlng.lng));

    // Request geolocation on first visit to location step
    if (!dataRef.current.lat) {
      setGeoLoading(true);
      navigator.geolocation?.getCurrentPosition(
        ({ coords }) => {
          map.flyTo([coords.latitude, coords.longitude], 16, { animate: true, duration: 1.2 });
          marker.setLatLng([coords.latitude, coords.longitude]);
          revGeoRef.current(coords.latitude, coords.longitude);
          setGeoLoading(false);
        },
        () => {
          setGeoLoading(false);
          revGeoRef.current(initLat, initLng);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      revGeoRef.current(initLat, initLng);
    }

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, [step]); // only react to step changes, not language/data

  /* ─── translation helper ────────────────────────────────────── */
  const t = useCallback((sq: string, en: string) => language === 'sq' ? sq : en, [language]);

  /* ─── navigation ────────────────────────────────────────────── */
  const go = (to: Step, d: 1 | -1 = 1) => { setDir(d); setStep(to); };

  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setMode(m);
    setOtp('');
    setSendCount(0);
    setCooldown(0);
    // direction: signup→login = forward(1), login→signup = back(-1)
    setDir(m === 'login' ? 1 : -1);
    setStep(m === 'signup' ? 'name' : 'email');
  };

  /* ─── step validations ──────────────────────────────────────── */
  const handleNameNext = () => {
    if (!data.firstName.trim() || !data.lastName.trim()) {
      toast.error(t('Shkruaj emrin dhe mbiemrin', 'Enter first and last name'));
      return;
    }
    go('location', 1);
  };

  const handleLocationNext = () => {
    if (!data.phone.trim()) {
      toast.error(t('Shkruaj numrin e telefonit', 'Enter your phone number'));
      return;
    }
    if (!data.address.trim()) {
      toast.error(t('Zgjidhni vendndodhjen në hartë', 'Select your location on the map'));
      return;
    }
    go('email', 1);
  };

  const sendOtp = async () => {
    const email = data.email.trim().toLowerCase();
    if (!email || !email.includes('@') || !email.includes('.')) {
      toast.error(t('Shkruaj një email të vlefshëm', 'Enter a valid email'));
      return;
    }
    if (sendCount >= MAX_OTP) {
      toast.error(t(`Limit i arritur (${MAX_OTP} kode). Provoni më vonë.`, `Limit reached (${MAX_OTP} codes). Try again later.`));
      return;
    }
    if (cooldown > 0) return;
    setSending(true);
    const { error } = await requestOtp(email, language);
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setData(p => ({ ...p, email }));
    setSendCount(c => c + 1);
    setCooldown(COOLDOWN_SECS);
    go('otp', 1);
    toast.success(t('Kodi u dërgua në email', 'Code sent to your email'));
  };

  const handleVerify = async (val: string) => {
    if (val.length !== 6) return;
    setVerifying(true);
    const { error } = await verifyOtp(data.email, val);
    if (error) {
      setVerifying(false);
      setOtp('');
      toast.error(t('Kod i pasaktë. Provo përsëri.', 'Invalid code. Try again.'));
      return;
    }
    // Persist profile metadata for new accounts
    if (mode === 'signup') {
      try {
        await supabase.auth.updateUser({
          data: {
            first_name: data.firstName.trim(),
            last_name: data.lastName.trim(),
            phone: data.phone.trim() || null,
            address: data.address.trim() || null,
            lat: data.lat,
            lng: data.lng,
            lang: language,
          },
        });
      } catch { /* non-blocking */ }
    }
    go('done', 1);
    setTimeout(() => {
      toast.success(t('Mirë se erdhe!', 'Welcome!'));
      navigate('/home', { replace: true });
    }, 500);
  };

  const resendOtp = async () => {
    if (cooldown > 0 || sendCount >= MAX_OTP || sending) return;
    setSending(true);
    const { error } = await requestOtp(data.email, language);
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setSendCount(c => c + 1);
    setCooldown(COOLDOWN_SECS);
    toast.success(t('Kodi u ridërgua', 'Code resent'));
  };

  /* ─── step-dot state ────────────────────────────────────────── */
  const stepOrder: Step[] = mode === 'signup'
    ? ['name', 'location', 'email', 'otp']
    : ['email', 'otp'];
  const currentIdx = stepOrder.indexOf(step);

  const isLocationStep = step === 'location';

  /* ──────────────────────────────────────────────────────────── */
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        background: 'radial-gradient(ellipse at top, hsl(220 30% 12%) 0%, hsl(222 40% 6%) 50%, hsl(222 47% 4%) 100%)',
      }}
    >
      {/* Ambient glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(142 70% 45% / 0.13) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(45 90% 55% / 0.08) 0%, transparent 70%)', filter: 'blur(60px)' }} />

      {/* ── Language toggle ─── */}
      <div className="absolute top-4 right-4 z-50 flex gap-1">
        {(['sq', 'en'] as const).map(lang => (
          <button
            key={lang}
            onClick={() => setLanguage(lang)}
            className="px-2.5 py-1 rounded-lg text-xs font-bold tracking-wide transition-all"
            style={language === lang ? {
              background: 'hsl(142 70% 45% / 0.18)',
              border: '1px solid hsl(142 70% 45% / 0.45)',
              color: 'hsl(142 70% 62%)',
            } : {
              color: 'hsl(0 0% 100% / 0.32)',
              border: '1px solid transparent',
            }}
          >
            {lang.toUpperCase()}
          </button>
        ))}
      </div>

      {/* ── Card — widens on map step ─── */}
      <div
        className={`relative w-full rounded-[28px] overflow-hidden transition-[max-width] duration-500 ease-out ${
          isLocationStep ? 'max-w-2xl' : 'max-w-sm'
        }`}
        style={{
          background: 'linear-gradient(180deg, hsl(220 25% 10% / 0.92) 0%, hsl(222 30% 7% / 0.97) 100%)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid hsl(0 0% 100% / 0.08)',
          boxShadow: '0 32px 80px -20px hsl(0 0% 0% / 0.7), inset 0 1px 0 hsl(0 0% 100% / 0.06)',
        }}
      >
        {/* ── Header ─── */}
        <div className="text-center pt-6 px-6">
          <motion.img
            src={logo} alt="Papirun"
            className="w-10 h-10 mx-auto mb-2 rounded-2xl object-contain"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...spring, delay: 0.08 }}
          />
          <h1 className="font-display font-semibold text-lg text-white tracking-tight">Papirun</h1>
          <p className="text-[10px] text-white/40 mt-0.5">House of Crunch</p>

          {/* Mode toggle — visible on name and email steps */}
          <AnimatePresence>
            {(step === 'name' || step === 'email') && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.2 }}
                className="mt-4 mb-0.5 flex gap-1 p-1 rounded-xl mx-auto w-fit"
                style={{ background: 'hsl(0 0% 100% / 0.04)', border: '1px solid hsl(0 0% 100% / 0.07)' }}
              >
                {(['signup', 'login'] as Mode[]).map(m => (
                  <button
                    key={m}
                    onClick={() => switchMode(m)}
                    className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95"
                    style={mode === m ? btnGreen : { color: 'hsl(0 0% 100% / 0.38)' }}
                  >
                    {m === 'signup' ? t('Regjistrohu', 'Sign Up') : t('Hyr', 'Log In')}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step progress dots */}
          {step !== 'done' && (
            <div className="flex gap-1.5 justify-center mt-3 mb-1">
              {stepOrder.map((s, i) => (
                <motion.div
                  key={s}
                  layout
                  className="rounded-full"
                  style={{ height: 5, background: i <= currentIdx ? 'hsl(142 70% 45%)' : 'hsl(0 0% 100% / 0.12)' }}
                  animate={{ width: i === currentIdx ? 22 : 5 }}
                  transition={spring}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── Step content ─── */}
        <div className="px-6 pb-2 pt-3">
          <AnimatePresence mode="wait" custom={dir}>

            {/* ── Step 1: Name & Last name ─── */}
            {step === 'name' && (
              <motion.div
                key="name" custom={dir}
                variants={slideVariants} initial="initial" animate="animate" exit="exit"
                transition={spring}
                className="space-y-4"
              >
                <div>
                  <h2 className="text-base font-semibold text-white leading-snug">
                    {t('Cili është emri dhe mbiemri juaj?', "What's your name?")}
                  </h2>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    {t('Do të shfaqet te porosia juaj', 'Shown on your order confirmations')}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/35" />
                    <input
                      type="text" autoComplete="given-name" autoFocus
                      value={data.firstName}
                      onChange={e => setData(p => ({ ...p, firstName: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && handleNameNext()}
                      placeholder={t('Emri', 'First name')}
                      className={`${inputBase} h-12 pl-9 pr-3`}
                      style={inputStyle} onFocus={onIF} onBlur={onIB}
                    />
                  </div>
                  <input
                    type="text" autoComplete="family-name"
                    value={data.lastName}
                    onChange={e => setData(p => ({ ...p, lastName: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && handleNameNext()}
                    placeholder={t('Mbiemri', 'Last name')}
                    className={`${inputBase} h-12 px-3`}
                    style={inputStyle} onFocus={onIF} onBlur={onIB}
                  />
                </div>

                <button
                  onClick={handleNameNext}
                  className="w-full h-12 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                  style={btnGreen}
                >
                  {t('Vazhdo', 'Continue')} <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* ── Step 2: Phone + Address + Leaflet map ─── */}
            {step === 'location' && (
              <motion.div
                key="location" custom={dir}
                variants={slideVariants} initial="initial" animate="animate" exit="exit"
                transition={spring}
                className="space-y-4"
              >
                <div className="flex items-start gap-2">
                  <button
                    onClick={() => go('name', -1)}
                    className="mt-0.5 p-1.5 rounded-xl hover:bg-white/5 transition-colors shrink-0"
                    style={{ color: 'hsl(0 0% 100% / 0.38)' }}
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <h2 className="text-base font-semibold text-white leading-snug">
                      {t("Ku jetoni dhe si mund t'ju kontaktojmë?", 'Where do you live & how can we reach you?')}
                    </h2>
                    <p className="text-[11px] text-white/40 mt-0.5">
                      {t('Klikoni hartën ose tërhiqni shënuesin', 'Tap the map or drag the pin')}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  {/* Left panel: phone + address */}
                  <div className="flex flex-col gap-2.5 sm:w-[196px] shrink-0">
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/35" />
                      <input
                        type="tel" autoComplete="tel" autoFocus
                        value={data.phone}
                        onChange={e => setData(p => ({ ...p, phone: e.target.value }))}
                        placeholder="+383 4_ ___ ___"
                        className={`${inputBase} h-11 pl-9 pr-3`}
                        style={inputStyle} onFocus={onIF} onBlur={onIB}
                      />
                    </div>

                    <div className="relative flex-1">
                      <MapPin className="absolute left-3 top-2.5 w-3.5 h-3.5 text-white/35 shrink-0" />
                      {addrLoading && (
                        <Loader2 className="absolute right-3 top-2.5 w-3 h-3 text-white/40 animate-spin" />
                      )}
                      <textarea
                        readOnly
                        value={data.address}
                        placeholder={
                          geoLoading
                            ? t('Duke gjetur vendndodhjen…', 'Locating you…')
                            : t('Klikoni hartën…', 'Tap the map…')
                        }
                        rows={5}
                        className={`${inputBase} pl-9 pr-3 pt-2 pb-2 resize-none`}
                        style={{
                          ...inputStyle,
                          cursor: 'default',
                          fontSize: '11px',
                          lineHeight: '1.45',
                        }}
                      />
                    </div>
                  </div>

                  {/* Right: Leaflet map */}
                  <div
                    className="flex-1 rounded-2xl overflow-hidden relative"
                    style={{
                      height: 230,
                      border: '1px solid hsl(0 0% 100% / 0.1)',
                      minWidth: 0,
                    }}
                  >
                    {geoLoading && (
                      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
                        style={{ background: 'hsl(0 0% 0% / 0.25)' }}>
                        <Loader2 className="w-5 h-5 animate-spin text-white/60" />
                      </div>
                    )}
                    <div ref={mapElRef} className="w-full h-full" />
                  </div>
                </div>

                <button
                  onClick={handleLocationNext}
                  className="w-full h-12 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                  style={btnGreen}
                >
                  {t('Vazhdo', 'Continue')} <ArrowRight className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* ── Step 3: Email ─── */}
            {step === 'email' && (
              <motion.div
                key="email" custom={dir}
                variants={slideVariants} initial="initial" animate="animate" exit="exit"
                transition={spring}
                className="space-y-4"
              >
                <div>
                  <h2 className="text-base font-semibold text-white leading-snug">
                    {t('Cila është adresa juaj e email-it?', "What's your email address?")}
                  </h2>
                  <p className="text-[11px] text-white/40 mt-0.5">
                    {t("Do t'ju dërgojmë një kod 6-shifror", "We'll send a 6-digit verification code")}
                  </p>
                </div>

                {mode === 'signup' && (
                  <button
                    onClick={() => go('location', -1)}
                    className="flex items-center gap-1.5 text-xs transition-colors"
                    style={{ color: 'hsl(0 0% 100% / 0.38)' }}
                  >
                    <ArrowLeft className="w-3 h-3" /> {t('Kthehu', 'Back')}
                  </button>
                )}

                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35" />
                  <input
                    type="email" inputMode="email" autoComplete="email" autoFocus
                    value={data.email}
                    onChange={e => setData(p => ({ ...p, email: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && sendOtp()}
                    placeholder="ti@example.com"
                    className={`${inputBase} h-14 pl-11 pr-4`}
                    style={inputStyle} onFocus={onIF} onBlur={onIB}
                  />
                </div>

                <button
                  onClick={sendOtp}
                  disabled={sending || sendCount >= MAX_OTP}
                  className="w-full h-14 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60"
                  style={btnGreen}
                >
                  {sending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Sparkles className="w-4 h-4" />}
                  {sending ? t('Duke dërguar…', 'Sending…') : t('Dërgo Kodin', 'Send Code')}
                  {!sending && <ArrowRight className="w-4 h-4" />}
                </button>

                {sendCount >= MAX_OTP && (
                  <p className="text-center text-[11px]" style={{ color: 'hsl(0 70% 65%)' }}>
                    {t('Keni arritur limitin e 5 kodeve.', 'You have reached the 5-code limit.')}
                  </p>
                )}
              </motion.div>
            )}

            {/* ── Step 4: 6-digit OTP ─── */}
            {step === 'otp' && (
              <motion.div
                key="otp" custom={dir}
                variants={slideVariants} initial="initial" animate="animate" exit="exit"
                transition={spring}
                className="space-y-5"
              >
                <button
                  onClick={() => go('email', -1)}
                  className="flex items-center gap-1.5 text-xs transition-colors"
                  style={{ color: 'hsl(0 0% 100% / 0.38)' }}
                >
                  <ArrowLeft className="w-3 h-3" />
                  {t('Ndrysho emailin', 'Change email')}
                </button>

                <div className="text-center">
                  <h2 className="text-base font-semibold text-white">
                    {t('Shkruani kodin me 6 shifra', 'Enter your 6-digit code')}
                  </h2>
                  <p className="text-[11px] text-white/40 mt-1">
                    {t('Dërguar te', 'Sent to')}{' '}
                    <span className="font-medium text-white">{data.email}</span>
                  </p>
                </div>

                {/* OTP slots */}
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={v => { setOtp(v); if (v.length === 6) handleVerify(v); }}
                    disabled={verifying}
                    autoFocus
                  >
                    <InputOTPGroup className="gap-2">
                      {[0, 1, 2, 3, 4, 5].map(i => (
                        <InputOTPSlot
                          key={i}
                          index={i}
                          className="h-14 w-11 text-lg font-semibold text-white rounded-xl border-0"
                          style={{
                            background: 'hsl(0 0% 100% / 0.05)',
                            border: '1px solid hsl(0 0% 100% / 0.12)',
                          } as React.CSSProperties}
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {verifying && (
                  <div className="flex items-center justify-center gap-2 text-xs text-white/50">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    {t('Po verifikohet…', 'Verifying…')}
                  </div>
                )}

                {/* Cooldown + resend */}
                <div className="text-center space-y-1.5">
                  {cooldown > 0 ? (
                    <div className="flex items-center justify-center gap-2.5">
                      <p className="text-[11px] text-white/35">
                        {t(`Ridërgo pas ${cooldown}s`, `Resend in ${cooldown}s`)}
                      </p>
                      {/* Circular progress ring */}
                      <svg width="18" height="18" className="-rotate-90 shrink-0">
                        <circle cx="9" cy="9" r="7" fill="none" stroke="hsl(0 0% 100% / 0.1)" strokeWidth="2" />
                        <circle
                          cx="9" cy="9" r="7" fill="none"
                          stroke="hsl(142 70% 45%)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeDasharray={`${(2 * Math.PI * 7).toFixed(2)}`}
                          strokeDashoffset={`${(2 * Math.PI * 7 * cooldown / COOLDOWN_SECS).toFixed(2)}`}
                        />
                      </svg>
                    </div>
                  ) : (
                    <button
                      onClick={resendOtp}
                      disabled={sending || sendCount >= MAX_OTP}
                      className="text-xs font-medium hover:underline underline-offset-2 disabled:opacity-40 transition-opacity"
                      style={{ color: 'hsl(142 70% 55%)' }}
                    >
                      {sending
                        ? t('Duke dërguar…', 'Sending…')
                        : t('Ridërgo kodin', 'Resend code')}
                    </button>
                  )}

                  <p className="text-[10px] text-white/20">
                    {t(`${sendCount} / ${MAX_OTP} kode të dërguara`, `${sendCount} / ${MAX_OTP} codes used`)}
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── Done ─── */}
            {step === 'done' && (
              <motion.div
                key="done" custom={dir}
                variants={slideVariants} initial="initial" animate="animate" exit="exit"
                transition={spring}
                className="py-8 text-center"
              >
                <motion.div
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ ...spring, delay: 0.1 }}
                  className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4"
                  style={{
                    background: 'hsl(142 70% 45% / 0.12)',
                    border: '2px solid hsl(142 70% 45% / 0.45)',
                  }}
                >
                  <Check className="w-7 h-7" style={{ color: 'hsl(142 70% 58%)' }} />
                </motion.div>
                <p className="font-semibold text-white">{t('Mirë se erdhe!', 'Welcome!')}</p>
                <p className="text-xs text-white/40 mt-1">{t('Po hapet menyja…', 'Opening the menu…')}</p>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* ── Footer ─── */}
        {step !== 'done' && (
          <div className="pb-5 text-center">
            <Link
              to="/"
              className="text-[10px] text-white/20 hover:text-white/50 transition-colors"
            >
              {t('← Faqja kryesore', '← Back to home')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
