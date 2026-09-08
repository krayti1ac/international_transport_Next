'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface ExecutiveChartsProps {
  trendData: { name: string; revenue: number; expenses: number }[];
  fleetStatus: { active: number; in_transit: number; maintenance: number; inactive: number };
}

const COLORS = {
  active: '#10b981', // أخضر
  in_transit: '#3b82f6', // أزرق
  maintenance: '#f59e0b', // برتقالي
  inactive: '#ef4444', // أحمر
};

export function ExecutiveCharts({ trendData, fleetStatus }: ExecutiveChartsProps) {
  const pieData = [
    { name: 'متاح للتحميل', value: fleetStatus.active, color: COLORS.active },
    { name: 'في رحلة دولية', value: fleetStatus.in_transit, color: COLORS.in_transit },
    { name: 'في الصيانة', value: fleetStatus.maintenance, color: COLORS.maintenance },
    { name: 'متوقف', value: fleetStatus.inactive, color: COLORS.inactive },
  ].filter(item => item.value > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 shadow-xs border-border">
        <CardHeader>
          <CardTitle className="text-base font-amiri text-foreground">
            التدفق المالي: الإيرادات مقابل المصروفات التشغيلية (MAD)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} 
                  tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} 
                />
                <Tooltip 
                  cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: '1px solid hsl(var(--border))', 
                    backgroundColor: 'hsl(var(--card))',
                    color: 'hsl(var(--foreground))',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' 
                  }}
                  formatter={(value) => [new Intl.NumberFormat('fr-MA').format(Number(value || 0)) + ' MAD', '']}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="revenue" name="الإيرادات" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="expenses" name="المصروفات" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-xs border-border">
        <CardHeader>
          <CardTitle className="text-base font-amiri text-foreground">التوزيع التشغيلي للأسطول</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={110}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: '1px solid hsl(var(--border))', 
                    backgroundColor: 'hsl(var(--card))',
                    color: 'hsl(var(--foreground))',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' 
                  }}
                  formatter={(value) => [`${value} مركبة`, '']}
                />
                <Legend iconType="circle" layout="vertical" verticalAlign="bottom" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

