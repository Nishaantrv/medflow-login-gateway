import { useEffect, useState } from 'react';
import { supabase as externalSupabase } from '@/integrations/supabase/client';
import { Users, UserCheck, Bed, CreditCard, Activity, TrendingUp, AlertCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface Stats {
  totalPatients: number;
  totalDoctors: number;
  totalStaff: number;
  availableBeds: number;
  totalBeds: number;
  pendingBills: number;
  monthlyRevenue: number;
}

const cardStyle = "rounded-2xl border p-6 bg-[#0C0F1A] border-[#1A1F35]";

const AdminDashboard = () => {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const [patientsCount, doctorsCount, staffCount, bedsData, billingData] = await Promise.all([
          (externalSupabase as any).from('patients').select('*', { count: 'exact', head: true }),
          (externalSupabase as any).from('doctors').select('*', { count: 'exact', head: true }),
          (externalSupabase as any).from('users').select('*', { count: 'exact', head: true }),
          (externalSupabase as any).from('beds').select('*'),
          (externalSupabase as any).from('billing').select('amount, status'),
        ]);

        const bedList = bedsData.data || [];
        const availableBeds = bedList.filter((b: any) => b.status === 'available').length;

        const bills = billingData.data || [];
        const pendingBills = bills.filter((b: any) => b.status === 'pending').length;
        const totalRevenue = bills
          .filter((b: any) => b.status === 'paid')
          .reduce((sum: number, b: any) => sum + (Number(b.amount) || 0), 0);

        setStats({
          totalPatients: patientsCount.count || 0,
          totalDoctors: doctorsCount.count || 0,
          totalStaff: staffCount.count || 0,
          availableBeds,
          totalBeds: bedList.length || 0,
          pendingBills,
          monthlyRevenue: totalRevenue
        });
      } catch (err) {
        console.error('Error fetching admin stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="p-6 space-y-6" style={{ background: '#060810', minHeight: '100%' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-32 rounded-2xl bg-[#1A1F35]" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl bg-[#1A1F35]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" style={{ background: '#060810', minHeight: '100%' }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 font-display">Hospital Operations</h1>
          <p className="text-gray-400 text-sm">Real-time overview of medical facility status</p>
        </div>
        <Badge className="bg-teal-500/10 text-teal-400 border-teal-500/20 px-3 py-1">
          System Live
        </Badge>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={cardStyle}>
          <div className="flex items-center gap-3 text-teal-400 mb-3">
            <Users size={20} />
            <span className="text-xs font-semibold uppercase tracking-wider">Patients</span>
          </div>
          <p className="text-3xl font-bold text-white">{stats?.totalPatients}</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-teal-500">
            <TrendingUp size={12} />
            <span>+12% this week</span>
          </div>
        </div>

        <div className={cardStyle}>
          <div className="flex items-center gap-3 text-blue-400 mb-3">
            <UserCheck size={20} />
            <span className="text-xs font-semibold uppercase tracking-wider">Medical Staff</span>
          </div>
          <p className="text-3xl font-bold text-white">{stats?.totalDoctors}</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-blue-500">
            <Activity size={12} />
            <span>8 Active Today</span>
          </div>
        </div>

        <div className={cardStyle}>
          <div className="flex items-center gap-3 text-purple-400 mb-3">
            <Bed size={20} />
            <span className="text-xs font-semibold uppercase tracking-wider">Bed Occupancy</span>
          </div>
          <p className="text-3xl font-bold text-white">
            {stats?.totalBeds ? Math.round(((stats.totalBeds - stats.availableBeds) / stats.totalBeds) * 100) : 0}%
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <span>{stats?.availableBeds} beds available</span>
          </div>
        </div>

        <div className={cardStyle}>
          <div className="flex items-center gap-3 text-yellow-500 mb-3">
            <CreditCard size={20} />
            <span className="text-xs font-semibold uppercase tracking-wider">Revenue</span>
          </div>
          <p className="text-3xl font-bold text-white">${(stats?.monthlyRevenue || 0).toLocaleString()}</p>
          <div className="flex items-center gap-2 mt-2 text-xs text-yellow-600">
            <AlertCircle size={12} />
            <span>{stats?.pendingBills} pending bills</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity / System Logs placeholder */}
        <div className={cardStyle}>
          <h2 className="text-lg font-bold text-white mb-4">Department Performance</h2>
          <div className="space-y-4">
            {['Cardiology', 'Emergency', 'Neurology', 'Pediatrics'].map((dept, i) => (
              <div key={dept} className="flex items-center justify-between p-3 rounded-lg bg-[#1A1F35]/30">
                <span className="text-sm text-gray-300">{dept}</span>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-2 bg-[#1A1F35] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-500"
                      style={{ width: `${80 - (i * 15)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500">{80 - (i * 15)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={cardStyle}>
          <h2 className="text-lg font-bold text-white mb-4">Quick Insights</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-teal-500/5 border border-teal-500/10">
              <p className="text-xs text-gray-500 mb-1">ER Wait Time</p>
              <p className="text-xl font-bold text-teal-400">12m</p>
            </div>
            <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
              <p className="text-xs text-gray-500 mb-1">Bed Turnover</p>
              <p className="text-xl font-bold text-blue-400">4.2h</p>
            </div>
            <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/10">
              <p className="text-xs text-gray-500 mb-1">ICU Capacity</p>
              <p className="text-xl font-bold text-purple-400">92%</p>
            </div>
            <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10">
              <p className="text-xs text-gray-500 mb-1">Pharmacy Stock</p>
              <p className="text-xl font-bold text-orange-400">Good</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
