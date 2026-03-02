import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase as externalSupabase } from '@/integrations/supabase/client';
import { Heart, Calendar, Pill, User, ShieldCheck, Activity, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface FamilyMember {
  patient_id: string;
  relationship: string;
  can_view_records: boolean;
  can_view_medications: boolean;
}

interface Patient {
  id: string;
  full_name: string;
  blood_type: string;
  allergies: string[];
}

const cardStyle = "rounded-2xl border p-6 bg-[#0C0F1A] border-[#1A1F35]";

const FamilyDashboard = () => {
  const { db_id } = useAuth();
  const [member, setMember] = useState<FamilyMember | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db_id) {
      setLoading(false);
      return;
    }

    const fetchFamilyData = async () => {
      setLoading(true);
      try {
        // 1. Get family member link
        const { data: memberData } = await (externalSupabase as any)
          .from('family_members')
          .select('*')
          .eq('user_id', db_id)
          .maybeSingle();

        if (memberData) {
          setMember(memberData);

          // 2. Get the linked patient's basic info
          const { data: patientUser } = await (externalSupabase as any)
            .from('patients')
            .select('id, user:user_id(full_name), blood_type, allergies')
            .eq('id', memberData.patient_id)
            .maybeSingle();

          if (patientUser) {
            setPatient({
              id: patientUser.id,
              full_name: patientUser.user?.full_name || 'Relative',
              blood_type: patientUser.blood_type,
              allergies: patientUser.allergies || [],
            });

            // 3. Parallel fetch of health data if authorized
            const fetches = [];

            // Always show appointments for family
            fetches.push(
              (externalSupabase as any)
                .from('appointments')
                .select('id, scheduled_date, scheduled_time, status, doctor:doctor_id(id)')
                .eq('patient_id', patientUser.id)
                .order('scheduled_date', { ascending: true })
                .limit(3)
            );

            if (memberData.can_view_medications) {
              fetches.push(
                (externalSupabase as any)
                  .from('medications')
                  .select('*')
                  .eq('patient_id', patientUser.id)
                  .eq('is_active', true)
              );
            }

            const responses = await Promise.all(fetches);
            setAppointments(responses[0].data || []);
            if (responses[1]) setMedications(responses[1].data || []);
          }
        }
      } catch (err) {
        console.error('Error fetching family dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchFamilyData();
  }, [db_id]);

  if (loading) {
    return (
      <div className="p-6 space-y-6" style={{ background: '#060810', minHeight: '100%' }}>
        <Skeleton className="h-40 w-full rounded-2xl bg-[#1A1F35]" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64 rounded-2xl bg-[#1A1F35]" />
          <Skeleton className="h-64 rounded-2xl bg-[#1A1F35]" />
        </div>
      </div>
    );
  }

  if (!member || !patient) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-gray-400 space-y-4 text-center px-4">
        <ShieldCheck size={48} className="text-gray-600 mb-2" />
        <p className="max-w-xs text-lg font-medium text-white">No active patient linkage found.</p>
        <p className="text-sm opacity-60">To view health data, you must be registered as a family guardian for a patient in our system.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" style={{ background: '#060810', minHeight: '100%' }}>
      {/* Patient Header Card */}
      <div className={`${cardStyle} flex flex-col md:flex-row items-center gap-6 border-teal-500/20`}>
        <div className="w-20 h-20 rounded-full bg-teal-500/10 flex items-center justify-center text-teal-400 border border-teal-500/20">
          <User size={36} />
        </div>
        <div className="text-center md:text-left flex-1">
          <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white font-display">Monitoring: {patient.full_name}</h1>
            <Badge className="bg-teal-500/10 text-teal-400 border-teal-500/20">{member.relationship}</Badge>
          </div>
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-1.5"><Activity size={14} className="text-teal-400" /> Patient Status: Stable</span>
            <span className="flex items-center gap-1.5"><Heart size={14} className="text-red-400" /> Blood Type: {patient.blood_type}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appointments Section */}
        <div className={cardStyle}>
          <div className="flex items-center gap-2 mb-6">
            <Calendar size={20} className="text-teal-400" />
            <h2 className="text-lg font-bold text-white">Upcoming Appointments</h2>
          </div>
          <div className="space-y-4">
            {appointments.length === 0 ? (
              <p className="text-sm text-gray-500">No scheduled visits.</p>
            ) : (
              appointments.map((appt) => (
                <div key={appt.id} className="p-4 rounded-xl bg-[#1A1F35]/30 border border-[#1A1F35]">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-white font-medium">Follow-up Consultation</p>
                    <Badge className="text-[10px] border-yellow-500/30 text-yellow-400 bg-yellow-500/10">
                      {appt.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {format(new Date(appt.scheduled_date), 'MMM d, yyyy')}</span>
                    <span className="flex items-center gap-1"><Clock size={12} /> {appt.scheduled_time}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Medications Section */}
        <div className={cardStyle}>
          <div className="flex items-center gap-2 mb-6">
            <Pill size={20} className="text-pink-400" />
            <h2 className="text-lg font-bold text-white">Current Medications</h2>
          </div>
          {!member.can_view_medications ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-gray-500 border border-dashed border-[#1A1F35] rounded-xl">
              <ShieldCheck size={24} className="mb-2 opacity-20" />
              <p className="text-xs max-w-[200px]">You do not have permission to view medication details.</p>
            </div>
          ) : medications.length === 0 ? (
            <p className="text-sm text-gray-500">No active medications found.</p>
          ) : (
            <div className="space-y-4">
              {medications.map((med) => (
                <div key={med.id} className="flex gap-4 p-4 rounded-xl bg-[#1A1F35]/30 border border-[#1A1F35]">
                  <div className="w-10 h-10 shrink-0 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-400">
                    <Pill size={20} />
                  </div>
                  <div>
                    <p className="text-white font-medium">{med.name}</p>
                    <p className="text-xs text-pink-400">{med.dosage} · {med.frequency}</p>
                    {med.instructions && (
                      <p className="text-[10px] text-gray-500 mt-1 italic">{med.instructions}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Access Permissions Banner */}
      <div className="p-4 rounded-xl bg-teal-500/5 border border-teal-500/10 flex items-center gap-3">
        <ShieldCheck size={16} className="text-teal-400 shrink-0" />
        <p className="text-xs text-gray-500">
          You have authorized access to view {patient.full_name}'s {member.can_view_medications ? 'medications and ' : ''}appointments.
          Contact the hospital directly for detailed medical records.
        </p>
      </div>
    </div>
  );
};

export default FamilyDashboard;
