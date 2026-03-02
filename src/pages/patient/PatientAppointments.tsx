import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase as externalSupabase } from '@/integrations/supabase/client';
import { Calendar, Clock, User, ChevronRight, Search, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

interface Appointment {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  status: string;
  doctor: {
    id: string;
    specialization: string;
    user: { full_name: string } | null;
  } | null;
}

const PatientAppointments = () => {
  const { db_id } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db_id) return;

    const fetchAppointments = async () => {
      setLoading(true);
      try {
        // 1. Get the patient record first
        const { data: patientData } = await (externalSupabase as any)
          .from('patients')
          .select('id')
          .eq('user_id', db_id)
          .maybeSingle();

        if (patientData) {
          // 2. Fetch all appointments for this patient
          const { data, error } = await (externalSupabase as any)
            .from('appointments')
            .select(`
              id, 
              scheduled_date, 
              scheduled_time, 
              status,
              doctor:doctor_id (
                id,
                specialization,
                user:user_id (full_name)
              )
            `)
            .eq('patient_id', patientData.id)
            .order('scheduled_date', { ascending: false });

          if (data) setAppointments(data as any);
        }
      } catch (err) {
        console.error('Error fetching appointments:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [db_id]);

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
      confirmed: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
      completed: 'bg-green-500/10 text-green-400 border-green-500/20',
      cancelled: 'bg-red-500/10 text-red-500 border-red-500/20',
    };
    return <Badge className={colors[status] || 'bg-gray-500/10 text-gray-400'}>{status}</Badge>;
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-10 w-48 bg-[#1A1F35]" />
          <Skeleton className="h-10 w-32 bg-[#1A1F35]" />
        </div>
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-2xl bg-[#1A1F35]" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" style={{ background: '#060810', minHeight: '100%' }}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 font-display">My Appointments</h1>
          <p className="text-gray-400 text-sm">View and manage your scheduled hospital visits</p>
        </div>
        <Button className="bg-teal-500 hover:bg-teal-600 text-white rounded-xl">
          <Plus size={18} className="mr-2" /> Book New
        </Button>
      </div>

      <div className="space-y-4">
        {appointments.length === 0 ? (
          <div className="text-center py-20 bg-[#0C0F1A] border border-[#1A1F35] rounded-2xl">
            <Calendar className="mx-auto text-gray-700 mb-4" size={48} />
            <p className="text-gray-400">No appointments found.</p>
          </div>
        ) : (
          appointments.map((appt) => (
            <div key={appt.id} className="rounded-2xl border p-5 bg-[#0C0F1A] border-[#1A1F35] hover:border-teal-500/30 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400">
                  <User size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Dr. {appt.doctor?.user?.full_name || 'Medical Practitioner'}</h3>
                  <p className="text-sm text-teal-400">{appt.doctor?.specialization || 'Department'}</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <div className="flex flex-col">
                  <span className="text-xs text-gray-500 uppercase tracking-wider mb-1">Date & Time</span>
                  <div className="flex items-center gap-3 text-sm text-white">
                    <span className="flex items-center gap-1.5"><Calendar size={14} className="text-gray-500" /> {format(new Date(appt.scheduled_date), 'MMM d, yyyy')}</span>
                    <span className="flex items-center gap-1.5"><Clock size={14} className="text-gray-500" /> {appt.scheduled_time}</span>
                  </div>
                </div>
                <div className="flex flex-col min-w-[100px]">
                  <span className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</span>
                  {getStatusBadge(appt.status)}
                </div>
                <button className="p-2 rounded-xl bg-[#1A1F35] text-gray-400 hover:text-white transition-colors">
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

export default PatientAppointments;
