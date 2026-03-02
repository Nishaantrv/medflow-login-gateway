import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase as externalSupabase } from '@/integrations/supabase/client';
import { Calendar, Clock, User, ChevronRight, Activity, Bell } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface VisitData {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  patient_name?: string;
  doctor: {
    specialization: string;
    user: { full_name: string } | null;
  } | null;
}

const FamilyVisits = () => {
  const { db_id } = useAuth();
  const [visits, setVisits] = useState<VisitData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db_id) return;

    const fetchFamilyVisits = async () => {
      setLoading(true);
      try {
        // 1. Get the linked patient for this family member
        const { data: familyData } = await (externalSupabase as any)
          .from('family_members')
          .select(`
            patient_id,
            patient:patient_id (
              user:user_id (full_name)
            )
          `)
          .eq('user_id', db_id)
          .maybeSingle();

        if (familyData?.patient_id) {
          const patientName = familyData.patient?.user?.full_name || 'Relative';

          // 2. Fetch appointments for the linked patient
          const { data, error } = await (externalSupabase as any)
            .from('appointments')
            .select(`
              id,
              scheduled_date,
              scheduled_time,
              status,
              doctor:doctor_id (
                specialization,
                user:user_id (full_name)
              )
            `)
            .eq('patient_id', familyData.patient_id)
            .order('scheduled_date', { ascending: false });

          if (data) {
            setVisits(data.map((v: any) => ({ ...v, patient_name: patientName })) as any);
          }
          if (error) console.error('Error fetching visits:', error);
        }
      } catch (err) {
        console.error('Error in fetchFamilyVisits:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFamilyVisits();
  }, [db_id]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48 mb-6 bg-[#1A1F35]" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-2xl bg-[#1A1F35]" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" style={{ background: '#060810', minHeight: '100%' }}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 font-display">Visit Schedule</h1>
          <p className="text-gray-400 text-sm">Monitor upcoming appointments for your family members</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-teal-400 font-medium px-4 py-2 bg-teal-500/5 border border-teal-500/10 rounded-xl">
          <Bell size={14} /> SMS Alerts Enabled
        </div>
      </div>

      <div className="space-y-4">
        {visits.length === 0 ? (
          <div className="text-center py-20 bg-[#0C0F1A] border border-[#1A1F35] rounded-2xl">
            <Calendar className="mx-auto text-gray-700 mb-4" size={48} />
            <p className="text-gray-400">No upcoming visits scheduled.</p>
          </div>
        ) : (
          visits.map((visit) => (
            <div key={visit.id} className="rounded-2xl border p-5 bg-[#0C0F1A] border-[#1A1F35] hover:border-teal-500/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400 border border-teal-500/20">
                  <User size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white leading-tight">Patient: {visit.patient_name}</h3>
                  <p className="text-sm text-gray-500">Dr. {visit.doctor?.user?.full_name} · <span className="text-teal-400">{visit.doctor?.specialization}</span></p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-8">
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 uppercase tracking-wider mb-1">Appointment Time</span>
                  <div className="flex items-center gap-3 text-sm text-white font-medium">
                    <span className="flex items-center gap-1.5"><Calendar size={14} className="text-teal-500" /> {format(new Date(visit.scheduled_date), 'MMM d, yyyy')}</span>
                    <span className="flex items-center gap-1.5"><Clock size={14} className="text-teal-500" /> {visit.scheduled_time}</span>
                  </div>
                </div>
                <div className="flex flex-col min-w-[100px]">
                  <span className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</span>
                  <Badge className={`uppercase text-[10px] ${visit.status === 'confirmed' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'}`}>
                    {visit.status}
                  </Badge>
                </div>
                <button className="p-2 rounded-xl bg-[#1A1F35] text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100">
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default FamilyVisits;
