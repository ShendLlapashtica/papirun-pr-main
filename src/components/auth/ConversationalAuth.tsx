import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, ArrowLeft, ArrowRight, Loader2, Mail, MapPin, Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import AddressMapPicker from '@/components/checkout/AddressMapPicker';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import logo from '@/assets/logo.png';

type Mode = 'signup' | 'login';
type StepId = 'name' | 'contact' | 'email' | 'otp';

const SIGNUP_STEPS: StepId[] = ['name', 'contact', 'email', 'otp'];
const LOGIN_STEPS: StepId[] = ['email', 'otp'];
const MAX_SENDS = 5;
const COOLDOWN_SECS = 60;

interface AuthFormData {
  emri: string;
  mbiemri: string;
  numriTelefonit: string;
  vendbanimi: string;
  position: [number, number] | null;
  email: string;
}

// Vertical slide, like the ordering flow: current card slides up and out,
// the next one slides up into focus from below.
const stepVariants = {
  enter: (dir: number) => ({ y: dir > 0 ? 48 : -48, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (dir: number) => ({ y: dir > 0 ? -48 : 48, opacity: 0 }),
};
const spring = { type: 'spring' as const, stiffness: 320, damping: 30 };

// Exact CheckoutModal input/button styling for visual parity
const inputClass =
  'w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-secondary border-0 text-sm focus:ring-2 focus:ring-primary/20 transition-all';
const primaryBtnClass =
  'w-full flex items-center justify-center gap-2 text-sm font-semibold py-3.5 px-4 rounded-xl bg-primary text-primary-foreground transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50';

const ConversationalAuth = () => {
  const { language, setLanguage, t } = useLanguage();

  const [mode, setMode] = useState<Mode>('signup');
  const [stepIndex, setStepIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [formData, setFormData] = useState<AuthFormData>({
    emri: '', mbiemri: '', numriTelefonit: '', vendbanimi: '', position: null, email: '',
  });
  const [code, setCode] = useState('');
  const [sentEmail, setSentEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [sendCount, setSendCount] = useState(0);
  const [emailServiceDown, setEmailServiceDown] = useState(false);

  const steps = mode === 'signup' ? SIGNUP_STEPS : LOGIN_STEPS;
  const step = steps[stepIndex];

  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [resendIn]);

  const goNext = () => { setDirection(1); setStepIndex((i) => Math.min(i + 1, steps.length - 1)); };
  const goBack = () => { setDirection(-1); setStepIndex((i) => Math.max(i - 1, 0)); };

  // formData and the resend cooldown/cap survive a mode switch on purpose:
  // typed data isn't lost on a round trip, and toggling can't bypass the limit.
  const switchMode = (m: Mode) => {
    if (m === mode) return;
    setDirection(-1);
    setMode(m);
    setStepIndex(0);
    setCode('');
  };

  const handleMapSelect = useCallback(
    ({ fullAddress, position }: { address: string; fullAddress: string; position: [number, number] }) => {
      setFormData((prev) => ({ ...prev, vendbanimi: fullAddress, position }));
    },
    [],
  );

  const handleNameNext = () => {
    if (!formData.emri.trim() || !formData.mbiemri.trim()) {
      toast.error(t.auth.nameRequired);
      return;
    }
    goNext();
  };

  const hasLocation = formData.position !== null && formData.vendbanimi.trim().length > 0;

  const handleContactNext = () => {
    if (!formData.numriTelefonit.trim()) {
      toast.error(t.auth.phoneRequired);
      return;
    }
    if (!hasLocation) {
      toast.error(t.auth.locationRequiredHint);
      return;
    }
    goNext();
  };

  const sendOtp = async () => {
    const email = formData.email.trim().toLowerCase();
    if (!/\S+@\S+\.\S+/.test(email)) {
      toast.error(t.auth.invalidEmail);
      return;
    }
    if (sendCount >= MAX_SENDS) {
      toast.error(t.auth.maxSendsReached);
      return;
    }
    if (sending) return;
    if (resendIn > 0) {
      // Same email within cooldown: the previous code is still valid — just
      // advance. Different email: surface the cooldown instead of failing silently.
      if (step === 'email' && email === sentEmail) {
        goNext();
        return;
      }
      toast.error(language === 'sq'
        ? `Prisni ${resendIn}s para se të kërkoni kod të ri`
        : `Wait ${resendIn}s before requesting a new code`);
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/auth/send-tan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, lang: language }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string; wait?: number }));
        if (body.error === 'cooldown') {
          setResendIn(body.wait ?? COOLDOWN_SECS);
          toast.error(language === 'sq'
            ? `Prisni ${body.wait ?? 60}s para se të kërkoni kod të ri`
            : `Wait ${body.wait ?? 60}s before requesting a new code`);
        } else if (body.error === 'limit') {
          setSendCount(MAX_SENDS);
          toast.error(t.auth.maxSendsReached);
        } else if (body.error === 'email_not_configured') {
          setEmailServiceDown(true);
        } else {
          toast.error(t.auth.sendFailed);
        }
        return;
      }
      setFormData((p) => ({ ...p, email }));
      setSentEmail(email);
      setCode('');
      setSendCount((c) => c + 1);
      setResendIn(COOLDOWN_SECS);
      toast.success(t.auth.codeSent);
      if (step === 'email') goNext();
    } catch {
      toast.error(t.auth.sendFailed);
    } finally {
      setSending(false);
    }
  };

  const handleVerify = async (value: string) => {
    if (verifying || value.length !== 6) return;
    setVerifying(true);
    try {
      // Our own TAN check — no Supabase auth email was ever involved.
      const res = await fetch('/api/auth/verify-tan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: sentEmail,
          code: value,
          profile: mode === 'signup' ? {
            emri: formData.emri.trim(),
            mbiemri: formData.mbiemri.trim(),
            numriTelefonit: formData.numriTelefonit.trim(),
            vendbanimi: formData.vendbanimi.trim(),
            latitude: formData.position?.[0] ?? null,
            longitude: formData.position?.[1] ?? null,
            lang: language,
          } : null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({} as { error?: string }));
        setVerifying(false);
        setCode('');
        if (body.error === 'expired') toast.error(t.auth.codeExpired);
        else if (body.error === 'too_many_attempts') toast.error(t.auth.maxSendsReached);
        else toast.error(t.auth.invalidCode);
        return;
      }
      const { token_hash } = await res.json();
      // Exchange the server-minted token hash for a local session. Purely an
      // internal API call — no email, no link, the user never leaves the page.
      let { error } = await supabase.auth.verifyOtp({ token_hash, type: 'email' });
      if (error) {
        ({ error } = await supabase.auth.verifyOtp({
          token_hash,
          type: 'magiclink' as 'email',
        }));
      }
      if (error) {
        setVerifying(false);
        setCode('');
        toast.error(t.auth.invalidCode);
        return;
      }
      // Session established: onAuthStateChange flips `user` and AuthGate
      // unmounts this component — no setState past this point.
      toast.success(t.auth.welcome);
    } catch {
      setVerifying(false);
      setCode('');
      toast.error(t.auth.sendFailed);
    }
  };

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-4 py-8">
      <div
        className={`w-full bg-background border border-border rounded-2xl shadow-xl overflow-hidden transition-all duration-300 ${
          step === 'contact' ? 'max-w-lg' : 'max-w-md'
        }`}
      >
        {/* Brand header — mirrors the checkout card header bar */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <img src={logo} alt="Papirun" className="w-9 h-9 rounded-xl object-contain" />
            <div>
              <h1 className="font-display font-bold text-base leading-tight">Papirun</h1>
              <p className="text-[10px] text-muted-foreground">{t.header.slogan}</p>
            </div>
          </div>
          <div className="flex gap-1 bg-secondary rounded-full p-1">
            {(['sq', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLanguage(l)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                  language === l ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          {/* Sign Up / Log In toggle — first step of each mode only */}
          <AnimatePresence initial={false}>
            {stepIndex === 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="flex gap-1 bg-secondary rounded-full p-1 w-fit mx-auto">
                  {(['signup', 'login'] as Mode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => switchMode(m)}
                      className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                        mode === m ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'
                      }`}
                    >
                      {m === 'signup' ? t.auth.signUp : t.auth.logIn}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Step progress dots */}
          <div className="flex gap-1.5 justify-center">
            {steps.map((s, i) => (
              <motion.div
                key={s}
                layout
                className={`h-1.5 rounded-full ${i <= stepIndex ? 'bg-primary' : 'bg-border'}`}
                animate={{ width: i === stepIndex ? 20 : 6 }}
                transition={spring}
              />
            ))}
          </div>

          <AnimatePresence mode="wait" custom={direction} initial={false}>
            <motion.div
              key={`${mode}-${step}`}
              custom={direction}
              variants={stepVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={spring}
            >
              {step === 'name' && (
                <form
                  className="space-y-4"
                  onSubmit={(e) => { e.preventDefault(); handleNameNext(); }}
                >
                  <div>
                    <h2 className="font-display font-bold text-lg sm:text-xl leading-snug">{t.auth.stepNameTitle}</h2>
                    <p className="text-xs text-muted-foreground mt-1">{t.auth.stepNameHint}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      autoComplete="given-name"
                      autoFocus
                      value={formData.emri}
                      onChange={(e) => setFormData((p) => ({ ...p, emri: e.target.value }))}
                      placeholder={t.auth.firstNamePlaceholder}
                      className={inputClass}
                    />
                    <input
                      type="text"
                      autoComplete="family-name"
                      value={formData.mbiemri}
                      onChange={(e) => setFormData((p) => ({ ...p, mbiemri: e.target.value }))}
                      placeholder={t.auth.lastNamePlaceholder}
                      className={inputClass}
                    />
                  </div>
                  <button type="submit" className={primaryBtnClass}>
                    {t.auth.next} <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              )}

              {/* No <form> here: AddressMapPicker has its own search form and
                  nested forms would let its submit bubble into a step advance. */}
              {step === 'contact' && (
                <div className="space-y-4">
                  <div className="flex items-start gap-2">
                    <button
                      type="button"
                      onClick={goBack}
                      className="mt-0.5 p-1.5 rounded-full hover:bg-muted transition-colors shrink-0 text-muted-foreground"
                      aria-label={t.auth.back}
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h2 className="font-display font-bold text-lg sm:text-xl leading-snug">{t.auth.stepContactTitle}</h2>
                      <p className="text-xs text-muted-foreground mt-1">{t.auth.stepContactHint}</p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium mb-1.5">{t.checkout.phone}</label>
                    <input
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      autoFocus
                      value={formData.numriTelefonit}
                      onChange={(e) => setFormData((p) => ({ ...p, numriTelefonit: e.target.value }))}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleContactNext(); } }}
                      placeholder={t.auth.phonePlaceholder}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium mb-1.5">{t.checkout.address}</label>
                    <input
                      type="text"
                      readOnly
                      value={formData.vendbanimi}
                      placeholder={t.auth.addressPlaceholder}
                      className={`w-full px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl border-0 text-sm transition-all mb-2 ${
                        formData.vendbanimi
                          ? 'bg-primary/10 ring-2 ring-primary/30 text-foreground'
                          : 'bg-secondary text-muted-foreground'
                      }`}
                    />
                    <AddressMapPicker selectedPosition={formData.position} onSelectAddress={handleMapSelect} />
                  </div>

                  {!hasLocation && (
                    <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">{t.auth.locationRequired}</p>
                        <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">{t.auth.locationRequiredHint}</p>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleContactNext}
                    disabled={!formData.numriTelefonit.trim() || !hasLocation}
                    className={primaryBtnClass}
                  >
                    {hasLocation ? <ArrowRight className="w-4 h-4" /> : <MapPin className="w-4 h-4" />}
                    {hasLocation ? t.auth.next : t.auth.locationRequired}
                  </button>
                </div>
              )}

              {step === 'email' && (
                <form
                  className="space-y-4"
                  onSubmit={(e) => { e.preventDefault(); sendOtp(); }}
                >
                  <div className="flex items-start gap-2">
                    {mode === 'signup' && (
                      <button
                        type="button"
                        onClick={goBack}
                        className="mt-0.5 p-1.5 rounded-full hover:bg-muted transition-colors shrink-0 text-muted-foreground"
                        aria-label={t.auth.back}
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                    )}
                    <div>
                      <h2 className="font-display font-bold text-lg sm:text-xl leading-snug">{t.auth.stepEmailTitle}</h2>
                      <p className="text-xs text-muted-foreground mt-1">{t.auth.stepEmailHint}</p>
                    </div>
                  </div>

                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoFocus
                      value={formData.email}
                      onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                      placeholder={t.auth.emailPlaceholder}
                      className={`${inputClass} pl-9 sm:pl-10`}
                    />
                  </div>

                  <button type="submit" disabled={sending || sendCount >= MAX_SENDS || emailServiceDown} className={primaryBtnClass}>
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {t.auth.sendCode}
                  </button>

                  {emailServiceDown && (
                    <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700 dark:text-amber-300">
                        {language === 'sq'
                          ? 'Shërbimi i emailit po konfigurohet. Provo pak më vonë.'
                          : 'Email delivery is being set up. Try again soon.'}
                      </p>
                    </div>
                  )}

                  {sendCount >= MAX_SENDS && (
                    <p className="text-center text-xs text-destructive">{t.auth.maxSendsReached}</p>
                  )}
                </form>
              )}

              {step === 'otp' && (
                <div className="space-y-5">
                  <button
                    type="button"
                    onClick={goBack}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="w-3 h-3" /> {t.auth.changeEmail}
                  </button>

                  <div className="text-center">
                    <h2 className="font-display font-bold text-lg sm:text-xl leading-snug">{t.auth.stepOtpTitle}</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t.auth.sentTo} <span className="font-medium text-foreground">{sentEmail}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">{t.auth.codeExpires}</p>
                  </div>

                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={code}
                      onChange={(v) => { setCode(v); if (v.length === 6) handleVerify(v); }}
                      disabled={verifying}
                      autoFocus
                    >
                      <InputOTPGroup className="gap-2">
                        {[0, 1, 2, 3, 4, 5].map((i) => (
                          <InputOTPSlot
                            key={i}
                            index={i}
                            className="h-12 w-10 sm:h-14 sm:w-11 text-lg font-semibold rounded-xl first:rounded-l-xl last:rounded-r-xl border border-input bg-secondary ring-primary/30"
                          />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  {verifying && (
                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t.auth.verifying}
                    </div>
                  )}

                  <div className="text-center space-y-1.5">
                    {resendIn > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        {language === 'sq' ? `Rikërko kodin pas ${resendIn}s` : `Resend code in ${resendIn}s`}
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={sendOtp}
                        disabled={sending || sendCount >= MAX_SENDS}
                        className="text-xs font-semibold text-primary hover:underline underline-offset-2 disabled:opacity-50 transition-opacity"
                      >
                        {sending ? (language === 'sq' ? 'Duke dërguar…' : 'Sending…') : t.auth.resend}
                      </button>
                    )}
                    <p className="text-[10px] text-muted-foreground/60">
                      {sendCount} / {MAX_SENDS} {t.auth.codesUsed}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default ConversationalAuth;
