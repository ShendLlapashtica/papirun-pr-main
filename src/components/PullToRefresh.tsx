import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

const THRESHOLD = 70;
const MAX_PULL = 120;

const PullToRefresh = ({ onRefresh, children }: { onRefresh: () => Promise<void> | void; children: ReactNode }) => {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 5 || refreshing) return;
      startY.current = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null || refreshing) return;
      const delta = e.touches[0].clientY - startY.current;
      if (delta > 0 && window.scrollY <= 0) {
        setPull(Math.min(delta * 0.5, MAX_PULL));
      }
    };
    const onTouchEnd = async () => {
      if (startY.current === null) return;
      const finalPull = pull;
      startY.current = null;
      if (finalPull >= THRESHOLD && !refreshing) {
        setRefreshing(true);
        setPull(THRESHOLD);
        try { await onRefresh(); } finally {
          setRefreshing(false);
          setPull(0);
        }
      } else {
        setPull(0);
      }
    };

    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [pull, refreshing, onRefresh]);

  return (
    <>
      <div
        className="fixed top-0 left-0 right-0 flex items-center justify-center pointer-events-none z-30 transition-transform"
        style={{ transform: `translateY(${pull - 40}px)`, opacity: pull / THRESHOLD }}
      >
        <div className="bg-background shadow-card rounded-full w-10 h-10 flex items-center justify-center">
          <Loader2 className={`w-4 h-4 text-primary ${refreshing ? 'animate-spin' : ''}`} />
        </div>
      </div>
      <div style={{ transform: `translateY(${pull}px)`, transition: pull === 0 ? 'transform 0.2s' : 'none' }}>
        {children}
      </div>
    </>
  );
};

export default PullToRefresh;
