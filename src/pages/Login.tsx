import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, ArrowRight, Loader2, ArrowLeft, Sparkles, User, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import logo from '@/assets/logo.png';

type Mode = 'login' | 'signup';
type Step = 'form' | 'code' | 'done';

const AppleIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
  </svg>
);

const GoogleIcon = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const Login = () => {
  const { requestOtp, verifyOtp, user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('login');
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const [oauthBusy, setOauthBusy] = useState<'google' | 'apple' | null>(null);

  useEffect(() => { if (user) navigate('/home', { replace: true }); }, [user, navigate]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const t = (sq: string, en: string) => (language === 'sq' ? sq : en);

  const sendCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) {
      toast.error(t('Shkruaj një email të vlefshëm', 'Enter a valid email'));
      return;
    }
    if (mode === 'signup') {
      if (!firstName.trim() || !lastName.trim()) {
        toast.error(t('Shkruaj emrin dhe mbiemrin', 'Enter first and last name'));
        return;
      }
    }
    setSending(true);
    const { error } = await requestOtp(trimmed, language);
    setSending(false);
    if (error) { toast.error(error.message); return; }
    setEmail(trimmed);
    setStep('code');
    setResendIn(45);
    toast.success(t('Kodi u dërgua në email', 'Code sent to your email'));
  };

  const handleVerify = async (value: string) => {
    if (value.length !== 6) return;
    setVerifying(true);
    const { error } = await verifyOtp(email, value);
    if (error) {
      setVerifying(false);
      setCode('');
      toast.error(t('Kod i pasaktë. Provo përsëri.', 'Invalid code. Try again.'));
      return;
    }
    // Save profile metadata for signups (best-effort, non-blocking)
    if (mode === 'signup') {
      try {
        const client = supabase as any;
        await client.auth.updateUser({
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            phone: phone.trim() || null,
            lang: language,
          },
        });
      } catch {}
    }
    setStep('done');
    setTimeout(() => {
      toast.success(t('Mirë se erdhe!', 'Welcome!'));
      navigate('/home', { replace: true });
    }, 350);
  };

  const handleOAuth = async (provider: 'google' | 'apple') => {
    setOauthBusy(provider);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/home`,
        }
      });
      if (error) {
        toast.error(error.message ?? 'OAuth failed');
        setOauthBusy(null);
        return;
      }
      // Browser is redirecting
      navigate('/home', { replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? 'OAuth failed');
      setOauthBusy(null);
    }
  };

  const slideVariants = {
    initial: { x: 40, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -40, opacity: 0 },
  };
  const spring = { type: 'spring' as const, stiffness: 320, damping: 30 };

  const inputStyle: React.CSSProperties = {
    background: 'hsl(0 0% 100% / 0.05)',
    border: '1px solid hsl(0 0% 100% / 0.1)',
  };
  const onInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'hsl(142 70% 45% / 0.5)';
    e.currentTarget.style.background = 'hsl(0 0% 100% / 0.07)';
  };
  const onInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = 'hsl(0 0% 100% / 0.1)';
    e.currentTarget.style.background = 'hsl(0 0% 100% / 0.05)';
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        background: 'radial-gradient(ellipse at top, hsl(220 30% 12%) 0%, hsl(222 40% 6%) 50%, hsl(222 47% 4%) 100%)',
      }}
    >
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[480px] h-[480px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(142 70% 45% / 0.18) 0%, transparent 70%)', filter: 'blur(40px)' }}
      />
      <div className="absolute bottom-0 right-0 w-[300px] h-[300px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, hsl(45 90% 55% / 0.08) 0%, transparent 70%)', filter: 'blur(60px)' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ ...spring, delay: 0.05 }}
        className="relative w-full max-w-sm rounded-[28px] p-6 shadow-2xl"
        style={{
          background: 'linear-gradient(180deg, hsl(220 25% 10% / 0.85) 0%, hsl(222 30% 7% / 0.95) 100%)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid hsl(0 0% 100% / 0.08)',
          boxShadow: '0 30px 80px -20px hsl(0 0% 0% / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.06)',
        }}
      >
        {/* Logo — natural aspect, jo i shtrirë */}
        <div className="text-center mb-5">
          <motion.img
            src={logo} alt="Papirun"
            className="w-12 h-12 mx-auto mb-2 rounded-2xl object-contain"
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ ...spring, delay: 0.1 }}
          />
          <h1 className="font-display font-semibold text-xl text-white tracking-tight">Papirun</h1>
          <p className="text-[11px] text-white/50 mt-0.5">House of Crunch</p>
        </div>

        <AnimatePresence mode="wait">
          {step === 'form' && (
            <motion.div
              key={`form-${mode}`}
              variants={slideVariants}
              initial="initial" animate="animate" exit="exit"
              transition={spring}
              className="space-y-3.5"
            >
              <div className="text-center mb-1">
                <h2 className="text-base font-semibold text-white">
                  {mode === 'login' ? t('Hyr në llogari', 'Sign in') : t('Krijo llogari', 'Create account')}
                </h2>
                <p className="text-[11px] text-white/50 mt-0.5">
                  {mode === 'login'
                    ? t('Vazhdo me email-in tënd', 'Continue with your email')
                    : t('Disa të dhëna për ty', 'A few details about you')}
                </p>
              </div>

              {mode === 'signup' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                    <input
                      type="text" autoComplete="given-name"
                      value={firstName} onChange={(e) => setFirstName(e.target.value)}
                      placeholder={t('Emri', 'First name')}
                      className="w-full h-12 pl-9 pr-3 rounded-2xl text-sm text-white placeholder:text-white/30 focus:outline-none transition-all"
                      style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur}
                    />
                  </div>
                  <div className="relative">
                    <input
                      type="text" autoComplete="family-name"
                      value={lastName} onChange={(e) => setLastName(e.target.value)}
                      placeholder={t('Mbiemri', 'Last name')}
                      className="w-full h-12 px-3 rounded-2xl text-sm text-white placeholder:text-white/30 focus:outline-none transition-all"
                      style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur}
                    />
                  </div>
                </div>
              )}

              {mode === 'signup' && (
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                  <input
                    type="tel" autoComplete="tel"
                    value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="+383 __ ___ ___"
                    className="w-full h-12 pl-10 pr-3 rounded-2xl text-sm text-white placeholder:text-white/30 focus:outline-none transition-all"
                    style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur}
                  />
                </div>
              )}

              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="email" inputMode="email" autoComplete="email" autoFocus
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendCode()}
                  placeholder="ti@example.com"
                  className="w-full h-14 pl-11 pr-4 rounded-2xl text-sm text-white placeholder:text-white/30 focus:outline-none transition-all"
                  style={inputStyle} onFocus={onInputFocus} onBlur={onInputBlur}
                />
              </div>

              <button
                type="button"
                onClick={sendCode}
                disabled={sending}
                className="w-full h-14 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60"
                style={{
                  background: 'linear-gradient(135deg, hsl(142 70% 45%) 0%, hsl(142 65% 38%) 100%)',
                  color: 'white',
                  boxShadow: '0 10px 30px -8px hsl(142 70% 45% / 0.5), inset 0 1px 0 hsl(0 0% 100% / 0.2)',
                }}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {sending ? t('Duke dërguar...', 'Sending...') : t('Vazhdo', 'Continue')}
                {!sending && <ArrowRight className="w-4 h-4" />}
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-[10px] uppercase tracking-widest text-white/40">{t('ose', 'or')}</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* OAuth */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleOAuth('apple')}
                  disabled={!!oauthBusy}
                  className="h-12 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold text-black active:scale-[0.98] transition-transform disabled:opacity-60"
                  style={{ background: '#fff' }}
                >
                  {oauthBusy === 'apple' ? <Loader2 className="w-4 h-4 animate-spin" /> : <AppleIcon className="w-4 h-4" />}
                  Apple
                </button>
                <button
                  type="button"
                  onClick={() => handleOAuth('google')}
                  disabled={!!oauthBusy}
                  className="h-12 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold text-black active:scale-[0.98] transition-transform disabled:opacity-60"
                  style={{ background: '#fff' }}
                >
                  {oauthBusy === 'google' ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon className="w-4 h-4" />}
                  Google
                </button>
              </div>

              {/* Mode switch */}
              <p className="text-center text-[12px] text-white/60 pt-2">
                {mode === 'login' ? (
                  <>
                    {t('Nuk keni llogari?', "Don't have an account?")}{' '}
                    <button
                      type="button"
                      onClick={() => setMode('signup')}
                      className="font-semibold underline-offset-2 hover:underline"
                      style={{ color: 'hsl(142 70% 55%)' }}
                    >
                      {t('Krijo llogari', 'Create account')}
                    </button>
                  </>
                ) : (
                  <>
                    {t('Keni llogari?', 'Already have an account?')}{' '}
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="font-semibold underline-offset-2 hover:underline"
                      style={{ color: 'hsl(142 70% 55%)' }}
                    >
                      {t('Hyr', 'Sign in')}
                    </button>
                  </>
                )}
              </p>

              <p className="text-center text-[10px] text-white/30 pt-1">
                <Link to="/" className="hover:text-white/60">{t('← Faqja kryesore', '← Back to home')}</Link>
              </p>
            </motion.div>
          )}

          {step === 'code' && (
            <motion.div
              key="code"
              variants={slideVariants}
              initial="initial" animate="animate" exit="exit"
              transition={spring}
              className="space-y-5"
            >
              <button
                type="button"
                onClick={() => { setStep('form'); setCode(''); }}
                className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> {t('Ndrysho emailin', 'Change email')}
              </button>

              <div className="text-center">
                <p className="text-sm text-white font-medium">{t('Kodi 6-shifror', '6-digit code')}</p>
                <p className="text-xs text-white/50 mt-1">
                  {t('Dërguar te', 'Sent to')} <span className="font-medium text-white">{email}</span>
                </p>
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
                    {[0,1,2,3,4,5].map((i) => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        className="h-14 w-11 text-lg font-semibold text-white rounded-xl border-0"
                        style={{
                          background: 'hsl(0 0% 100% / 0.05)',
                          border: '1px solid hsl(0 0% 100% / 0.1)',
                        } as any}
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              {verifying && (
                <div className="flex items-center justify-center gap-2 text-xs text-white/60">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> {t('Po verifikohet...', 'Verifying...')}
                </div>
              )}

              <div className="text-center">
                {resendIn > 0 ? (
                  <p className="text-[11px] text-white/40">
                    {t(`Ridërgo kodin pas ${resendIn}s`, `Resend code in ${resendIn}s`)}
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={sendCode}
                    disabled={sending}
                    className="text-xs font-medium hover:underline disabled:opacity-50"
                    style={{ color: 'hsl(142 70% 55%)' }}
                  >
                    {sending ? t('Duke dërguar...', 'Sending...') : t('Ridërgo kodin', 'Resend code')}
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {step === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              transition={spring}
              className="py-6 text-center"
            >
              <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3"
                style={{ background: 'hsl(142 70% 45% / 0.15)', border: '1px solid hsl(142 70% 45% / 0.4)' }}
              >
                <Sparkles className="w-6 h-6" style={{ color: 'hsl(142 70% 55%)' }} />
              </div>
              <p className="text-white font-semibold">{t('Mirë se erdhe!', 'Welcome!')}</p>
              <p className="text-xs text-white/50 mt-1">{t('Po hapet menyja…', 'Opening the menu…')}</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default Login;
