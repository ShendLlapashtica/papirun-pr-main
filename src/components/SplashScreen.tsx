import { useEffect, useState } from 'react';
import logo from '@/assets/logo.png';

const SPLASH_KEY = 'papirun_splash_shown';

const SplashScreen = ({ onDone }: { onDone: () => void }) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem(SPLASH_KEY, '1');
      setTimeout(onDone, 300);
    }, 1200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className={`fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      <img
        src={logo}
        alt="Papirun"
        className="w-28 h-28 rounded-3xl shadow-card animate-in fade-in zoom-in-90 duration-700"
      />
      <h1 className="font-display font-bold text-2xl mt-5 text-foreground animate-in fade-in slide-in-from-bottom-2 duration-700 delay-150">
        Papirun
      </h1>
      <p className="text-sm text-muted-foreground mt-1 animate-in fade-in duration-700 delay-300">
        House of Crunch!
      </p>
    </div>
  );
};

export const shouldShowSplash = () => sessionStorage.getItem(SPLASH_KEY) !== '1';

export default SplashScreen;
