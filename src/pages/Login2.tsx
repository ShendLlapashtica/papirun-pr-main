import { useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import ConversationalAuth from '@/components/auth/ConversationalAuth';
import { useLanguage } from '@/contexts/LanguageContext';

// App-specific login — post-auth destination is /home (app shell).
// The web login at /login goes to / instead.
// Capacitor will hard-link to this route as its entry point.
const Login2 = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { language } = useLanguage();

  useEffect(() => {
    if (user) navigate('/home', { replace: true });
  }, [user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (user) return <Navigate to="/home" replace />;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <ConversationalAuth />
      </div>
      <div className="text-center pb-8">
        <button
          type="button"
          onClick={() => navigate('/home')}
          className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
        >
          {language === 'sq' ? 'Vazhdo pa llogari →' : 'Continue without account →'}
        </button>
      </div>
    </div>
  );
};

export default Login2;
