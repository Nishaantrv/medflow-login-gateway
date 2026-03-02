import { useEffect, useState } from 'react';
import { supabase as externalSupabase } from '@/integrations/supabase/client';
import { Bed, CheckCircle2, XCircle, Search, Filter } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface BedData {
  id: string;
  bed_number: string;
  department: string;
  floor: number;
  status: 'available' | 'occupied' | 'maintenance' | 'reserved';
}

const AdminBeds = () => {
  const [beds, setBeds] = useState<BedData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBeds = async () => {
      setLoading(true);
      // Fixed: Using bed_number for ordering since room_number doesn't exist in your schema
      const { data, error } = await (externalSupabase as any)
        .from('beds')
        .select('id, bed_number, department, floor, status')
        .order('bed_number', { ascending: true });

      if (error) {
        console.error('❌ ERROR - Fetching Beds:', error);
      }

      if (data) setBeds(data);
      setLoading(false);
    };
    fetchBeds();
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available': return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Available</Badge>;
      case 'occupied': return <Badge className="bg-red-500/20 text-red-500 border-red-500/30">Occupied</Badge>;
      case 'maintenance': return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Maintenance</Badge>;
      case 'reserved': return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Reserved</Badge>;
      default: return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48 mb-6 bg-[#1A1F35]" />
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <Skeleton key={i} className="h-32 rounded-2xl bg-[#1A1F35]" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" style={{ background: '#060810', minHeight: '100%' }}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 font-display">Bed Management</h1>
          <p className="text-gray-400 text-sm">Real-time occupancy and allocation tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input className="bg-[#0C0F1A] border border-[#1A1F35] rounded-xl pl-10 pr-4 py-2 text-sm text-gray-300 focus:outline-none focus:border-teal-500/50 w-full md:w-64" placeholder="Search beds..." />
          </div>
          <button className="p-2 rounded-xl bg-[#0C0F1A] border border-[#1A1F35] text-gray-400 hover:text-white transition-colors">
            <Filter size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {beds.map((bed) => (
          <div key={bed.id} className="rounded-2xl border p-5 bg-[#0C0F1A] border-[#1A1F35] hover:border-teal-500/30 transition-all group">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-2 rounded-lg ${bed.status === 'available' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                <Bed size={20} />
              </div>
              {getStatusBadge(bed.status)}
            </div>

            <h3 className="text-lg font-bold text-white mb-1">Bed {bed.bed_number}</h3>
            <p className="text-sm text-gray-500 mb-4">Floor {bed.floor} · {bed.department}</p>

            <div className="flex items-center justify-between pt-4 border-t border-[#1A1F35]">
              <span className="text-xs text-gray-600 uppercase tracking-wider">Hospital Bed</span>
              <button className="text-xs text-teal-400 font-medium hover:underline opacity-0 group-hover:opacity-100 transition-opacity">
                Manage
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminBeds;
