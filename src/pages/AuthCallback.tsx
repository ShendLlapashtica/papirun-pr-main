import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

/**
 * AuthCallback — handles magic-link redirects.
 * Supabase places the session info either as a hash fragment (#access_token=…)
 * or as a `?code=…` query param (PKCE). We try both, then redirect to /home.
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        // PKCE flow: ?code=... → exchange for a session.
        const url = new URL(window.location.href);
        const code = url.searchParams.get('code');
        if (code) {
          const { error: exchErr } = await supabase.auth.exchangeCodeForSession(code);
          if (exchErr) throw exchErr;
        }
        // Implicit flow places tokens in the URL hash; supabase-js detects it
        // automatically via detectSessionInUrl. Just verify a session exists.
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          // Give supabase-js a moment to parse the hash.
          await new Promise((r) => setTimeout(r, 300));
        }
        navigate('/home', { replace: true });
      } catch (e: any) {
        setError(e?.message ?? 'Authentication failed');
      }
    };
    run();
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      {error ? (
        <>
          <p className="text-sm text-destructive font-semibold">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold"
          >
            Kthehu te login
          </button>
        </>
      ) : (
        <>
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-foreground/70">Duke u kyçur…</p>
        </>
      )}
    </div>
  );
};

export default AuthCallback;
