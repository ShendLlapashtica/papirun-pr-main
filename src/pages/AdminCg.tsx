import { useState } from 'react';
import { LogOut, Package, Users2 } from 'lucide-react';
import { Toaster } from '@/components/ui/sonner';
import OrdersReview from '@/components/admin/OrdersReview';
import DriversKPI from '@/components/admin/DriversKPI';

const ADMINCG_PASS = 'Pass123';
const ADMINCG_AUTH_KEY = 'papirun_admincg_authed';

// Blue-shifted CSS variable overrides for the Çagllavicë admin
const BLUE_THEME: React.CSSProperties = {
  '--primary': '213 94% 49%',
  '--primary-foreground': '0 0% 100%',
  '--ring': '213 94% 49%',
} as React.CSSProperties;

export default function AdminCg() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    () => localStorage.getItem(ADMINCG_AUTH_KEY) === 'true'
  );
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'orders' | 'drivers'>('orders');
  const [caglOnly, setCaglOnly] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMINCG_PASS) {
      localStorage.setItem(ADMINCG_AUTH_KEY, 'true');
      setIsAuthenticated(true);
    } else {
      setError('Fjalëkalim i gabuar');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(ADMINCG_AUTH_KEY);
    setIsAuthenticated(false);
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-blue-950 flex items-center justify-center p-4">
        <Toaster />
        <div className="w-full max-w-sm bg-white/5 backdrop-blur rounded-3xl p-8 border border-white/10 shadow-2xl">
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center mx-auto mb-4 border border-blue-400/30">
              <span className="text-3xl">🗺</span>
            </div>
            <h1 className="font-bold text-2xl text-white">Papirun Çagllavicë</h1>
            <p className="text-blue-300 text-sm mt-1">Paneli i Administratorit</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Fjalëkalimi"
              className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-blue-300/50 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/50"
            />
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-400 text-white font-semibold text-sm transition-colors"
            >
              Hyr
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={BLUE_THEME} className="min-h-screen bg-background">
      <Toaster />

      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-lg border-b border-border/50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center border border-blue-400/30">
              <span className="text-lg">🗺</span>
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight text-blue-700 dark:text-blue-400">Papirun Çagllavicë</h1>
              <p className="text-[10px] text-muted-foreground">Admin Panel</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-secondary rounded-full p-1">
            {([
              { key: 'orders', label: 'Porositë', Icon: Package },
              { key: 'drivers', label: 'Shoferët', Icon: Users2 },
            ] as const).map(({ key, label, Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  activeTab === key
                    ? 'bg-blue-500 text-white shadow'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-secondary text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {/* Çagllavicë filter toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCaglOnly((v) => !v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                  caglOnly
                    ? 'bg-blue-500 text-white border-blue-500 shadow'
                    : 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-400/30 hover:bg-blue-500/20'
                }`}
              >
                <span className="text-base leading-none">🗺</span>
                {caglOnly ? 'Vetëm Çagllavicë · aktiv' : 'Vetëm Çagllavicë'}
              </button>
              {caglOnly && (
                <span className="text-xs text-muted-foreground">
                  Duke shfaqur vetëm porositë e Çagllavicës
                </span>
              )}
            </div>
            <OrdersReview caglOnly={caglOnly} />
          </div>
        )}

        {activeTab === 'drivers' && <DriversKPI />}
      </div>
    </div>
  );
}
