import { useEffect, useState, useMemo } from 'react';
import { fetchDrivers, type DeliveryDriver } from '@/lib/driversApi';
import { fetchAllOrders, type OrderRecord } from '@/lib/ordersApi';
import { Bike, Clock, Star, TrendingUp, TrendingDown, Activity, CheckCircle2 } from 'lucide-react';

export default function DriversKPI() {
  const [drivers, setDrivers] = useState<DeliveryDriver[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);

  useEffect(() => {
    fetchDrivers().then(setDrivers).catch(console.error);
    fetchAllOrders().then(setOrders).catch(console.error);
  }, []);

  const stats = useMemo(() => {
    return drivers.map((driver) => {
      const driverOrders = orders.filter((o) => o.assignedDriverId === driver.id && o.status === 'completed');
      let totalExecTime = 0;
      let totalEtaTime = 0;
      let happy = 0;
      let neutral = 0;
      let unhappy = 0;
      let ratingCount = 0;

      driverOrders.forEach((o) => {
        // Calculate ETA
        const eta = o.prepEtaMinutes || 30; // default 30 min if not set
        totalEtaTime += eta;

        // Calculate real time based on status history (out_for_delivery -> completed)
        // Note: For a more accurate real time, we need actual timestamps. 
        // We will approximate using createdAt to updatedAt of completed order
        const created = new Date(o.createdAt).getTime();
        const completed = new Date(o.updatedAt).getTime();
        const execTime = (completed - created) / (1000 * 60); // minutes
        totalExecTime += execTime;

        if (o.driverRating) {
          ratingCount++;
          if (o.driverRating >= 5) happy++;
          else if (o.driverRating >= 3) neutral++;
          else unhappy++;
        }
      });

      const avgExec = driverOrders.length ? totalExecTime / driverOrders.length : 0;
      const avgEta = driverOrders.length ? totalEtaTime / driverOrders.length : 0;
      const performance = avgEta > 0 ? (avgEta / avgExec) * 100 : 0; // >100% means faster than ETA
      
      const pieTotal = happy + neutral + unhappy;

      return {
        driver,
        completedCount: driverOrders.length,
        avgExec,
        avgEta,
        performance,
        happy,
        neutral,
        unhappy,
        pieTotal
      };
    });
  }, [drivers, orders]);

  return (
    <div className="space-y-6">
      <div className="bg-card rounded-3xl p-6 shadow-card">
        <h2 className="text-xl font-bold font-display mb-4">Performanca e Shoferëve (KPI)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div key={stat.driver.id} className="bg-secondary/40 rounded-2xl p-5 border border-border/50">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <Bike className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">{stat.driver.name}</h3>
                    <p className="text-xs text-muted-foreground">{stat.completedCount} dërgesa</p>
                  </div>
                </div>
                {stat.driver.isActive ? (
                  <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold uppercase tracking-wider">Aktiv</span>
                ) : (
                  <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Jo aktiv</span>
                )}
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-background rounded-xl p-3 shadow-sm">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Clock className="w-3 h-3"/> Reale</p>
                    <p className="font-semibold">{Math.round(stat.avgExec)} min</p>
                  </div>
                  <div className="bg-background rounded-xl p-3 shadow-sm">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Pritur (ETA)</p>
                    <p className="font-semibold">{Math.round(stat.avgEta)} min</p>
                  </div>
                </div>

                <div className="bg-background rounded-xl p-3 shadow-sm flex items-center justify-between">
                  <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                    <Activity className="w-3.5 h-3.5" /> Efiçienca
                  </p>
                  <p className={`font-bold text-sm flex items-center gap-1 ${stat.performance >= 100 ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {stat.performance >= 100 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                    {stat.performance.toFixed(1)}%
                  </p>
                </div>

                <div className="bg-background rounded-xl p-3 shadow-sm">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2 flex items-center gap-1"><Star className="w-3 h-3"/> Vlerësimet e Klientëve</p>
                  {stat.pieTotal > 0 ? (
                    <div className="flex h-4 rounded-full overflow-hidden mt-2">
                      <div style={{ width: `${(stat.happy / stat.pieTotal) * 100}%` }} className="bg-emerald-500" title={`Të kënaqur: ${stat.happy}`} />
                      <div style={{ width: `${(stat.neutral / stat.pieTotal) * 100}%` }} className="bg-amber-400" title={`Neutral: ${stat.neutral}`} />
                      <div style={{ width: `${(stat.unhappy / stat.pieTotal) * 100}%` }} className="bg-red-500" title={`Të pakënaqur: ${stat.unhappy}`} />
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Asnjë vlerësim</p>
                  )}
                  {stat.pieTotal > 0 && (
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 font-medium">
                      <span>😊 {stat.happy}</span>
                      <span>😐 {stat.neutral}</span>
                      <span>☹️ {stat.unhappy}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {stats.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground text-sm">
              Nuk ka shoferë të regjistruar ende.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
