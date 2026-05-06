import { useEffect, useState, useMemo } from 'react';
import { fetchDrivers, type DeliveryDriver } from '@/lib/driversApi';
import { fetchAllOrders, type OrderRecord } from '@/lib/ordersApi';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';
import { Bike, Clock, Activity, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';

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

      driverOrders.forEach((o) => {
        const eta = o.prepEtaMinutes || 30;
        totalEtaTime += eta;
        const execTime = (new Date(o.updatedAt).getTime() - new Date(o.createdAt).getTime()) / 60000;
        totalExecTime += execTime;
        if (o.driverRating) {
          if (o.driverRating >= 4) happy++;
          else if (o.driverRating >= 2) neutral++;
          else unhappy++;
        }
      });

      const avgExec = driverOrders.length ? totalExecTime / driverOrders.length : 0;
      const avgEta  = driverOrders.length ? totalEtaTime  / driverOrders.length : 0;
      const performance = avgEta > 0 ? (avgEta / avgExec) * 100 : 0;
      const pieTotal = happy + neutral + unhappy;

      // Dominant face
      let face = '—';
      if (pieTotal > 0) {
        if (happy >= neutral && happy >= unhappy) face = '😊';
        else if (unhappy > happy && unhappy >= neutral) face = '☹️';
        else face = '😐';
      }

      return { driver, completedCount: driverOrders.length, avgExec, avgEta, performance, happy, neutral, unhappy, pieTotal, face };
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
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                    style={{ background: stat.driver.color || '#6b7280' }}
                  >
                    {stat.driver.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-base">{stat.driver.name}</h3>
                    <p className="text-xs text-muted-foreground">{stat.completedCount} dërgesa</p>
                  </div>
                </div>
                {stat.driver.isActive
                  ? <span className="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold uppercase tracking-wider">Aktiv</span>
                  : <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Jo aktiv</span>
                }
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-background rounded-xl p-3 shadow-sm">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><Clock className="w-3 h-3"/> Reale</p>
                    <p className="font-semibold">{Math.round(stat.avgExec)} min</p>
                  </div>
                  <div className="bg-background rounded-xl p-3 shadow-sm">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> ETA</p>
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

                {/* Ratings PieChart */}
                <div className="bg-background rounded-xl p-3 shadow-sm">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Bike className="w-3 h-3"/> Vlerësimet
                  </p>
                  {stat.pieTotal > 0 ? (
                    <div className="flex items-center gap-3">
                      <PieChart width={72} height={72}>
                        <Pie
                          data={[
                            { name: '😊', value: stat.happy   || 0.001 },
                            { name: '😐', value: stat.neutral || 0.001 },
                            { name: '☹️', value: stat.unhappy || 0.001 },
                          ]}
                          cx={32} cy={32}
                          innerRadius={20} outerRadius={34}
                          dataKey="value"
                          stroke="none"
                          startAngle={90} endAngle={-270}
                        >
                          <Cell fill="#22c55e" />
                          <Cell fill="#f59e0b" />
                          <Cell fill="#ef4444" />
                        </Pie>
                        <Tooltip
                          formatter={(val: number, name: string) => [`${Math.round(val)} vlerësime`, name]}
                          contentStyle={{ fontSize: 11, borderRadius: 8 }}
                        />
                      </PieChart>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                          <span className="text-base leading-none">😊</span> {stat.happy}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-amber-500">
                          <span className="text-base leading-none">😐</span> {stat.neutral}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-red-500">
                          <span className="text-base leading-none">☹️</span> {stat.unhappy}
                        </div>
                      </div>
                      <div className="ml-auto text-3xl leading-none">{stat.face}</div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Asnjë vlerësim</p>
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
