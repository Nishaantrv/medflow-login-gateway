import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { externalSupabase } from '@/integrations/external-supabase/client';
import { callAgent } from '@/services/aiAgent';
import { Link } from 'react-router-dom';
import { Calendar, Pill, Bell, MessageSquare, Search, Clock, User, Heart, Droplets, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface Patient {
  id: string;
  full_name: string;
  age: number;
  blood_type: string;
  allergies: string[];
  primary_doctor_id: string;
}

interface Appointment {
  id: string;
  appointment_date: string;
  appointment_time: string;
  status: string;
  doctor: { full_name: string; specialization: string } | null;
}

interface Medication {
  id: string;
  medication_name: string;
  dosage: string;
  frequency: string;
  instructions: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
}

const cardStyle = "rounded-2xl border p-6" as const;
const cardClasses = "bg-[#0C0F1A] border-[#1A1F35]";

const statusColors: Record<string, string> = {
  scheduled: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  confirmed: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const notifIcons: Record<string, typeof Bell> = {
  appointment: Calendar,
  medication: Pill,
  alert: AlertTriangle,
  message: MessageSquare,
};

const PatientDashboard = () => {
  const { user } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [primaryDoctor, setPrimaryDoctor] = useState<string>('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [testCount, setTestCount] = useState<number | null>(null);
  const [aiTestResult, setAiTestResult] = useState<string | null>(null);
  const [aiTestLoading, setAiTestLoading] = useState(false);

  // Temporary test: query all patients and log results
  useEffect(() => {
    const testQuery = async () => {
      const { data, error } = await externalSupabase.from('patients').select('*');
      console.log('🧪 TEST - External Supabase patients query:', { data, error, count: data?.length });
      setTestCount(data?.length ?? 0);
    };
    testQuery();
  }, []);

  useEffect(() => {
    if (!user) return;

    const fetchData = async () => {
      setLoading(true);

      // 1. Get patient record
      const { data: patientData } = await externalSupabase
        .from('patients')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!patientData) {
        setLoading(false);
        return;
      }
      setPatient(patientData);

      // Parallel fetches
      const [apptRes, medRes, notifRes, docRes] = await Promise.all([
        // Upcoming appointments
        externalSupabase
          .from('appointments')
          .select('id, appointment_date, appointment_time, status, doctor:doctors(full_name, specialization)')
          .eq('patient_id', patientData.id)
          .in('status', ['scheduled', 'confirmed'])
          .gte('appointment_date', new Date().toISOString().split('T')[0])
          .order('appointment_date', { ascending: true })
          .limit(5),

        // Active medications
        externalSupabase
          .from('medications')
          .select('id, medication_name, dosage, frequency, instructions')
          .eq('patient_id', patientData.id)
          .eq('is_active', true),

        // Recent notifications
        externalSupabase
          .from('notifications')
          .select('id, type, title, message, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),

        // Primary doctor name
        patientData.primary_doctor_id
          ? externalSupabase
              .from('doctors')
              .select('full_name')
              .eq('id', patientData.primary_doctor_id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      setAppointments((apptRes.data as any) || []);
      setMedications((medRes.data as any) || []);
      setNotifications((notifRes.data as any) || []);
      if (docRes.data) setPrimaryDoctor((docRes.data as any).full_name);

      setLoading(false);
    };

    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="p-6 space-y-6" style={{ background: '#060810', minHeight: '100%' }}>
        <Skeleton className="h-40 w-full rounded-2xl bg-[#1A1F35]" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-72 rounded-2xl bg-[#1A1F35]" />
          ))}
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-400">
        <p>No patient record found for this account.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" style={{ background: '#060810', minHeight: '100%' }}>
      {/* Temporary Test Banner */}
      <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-300 text-sm font-mono">
        🧪 DB Connection Test: {testCount !== null ? `Found ${testCount} patient(s) in external Supabase` : 'Querying...'}
        <span className="block text-xs text-yellow-500 mt-1">Check browser console for full data. Remove this after verifying.</span>
      </div>
      {/* Welcome Card */}
      <div className={`${cardStyle} ${cardClasses}`}>
        <h1 className="text-2xl md:text-3xl font-bold text-white font-display mb-1">
          Welcome back, {patient.full_name} 👋
        </h1>
        <div className="flex flex-wrap items-center gap-4 mt-4 text-sm text-gray-400">
          <span className="flex items-center gap-1.5">
            <User size={14} className="text-teal-400" /> Age: {patient.age}
          </span>
          <span className="flex items-center gap-1.5">
            <Droplets size={14} className="text-red-400" /> {patient.blood_type}
          </span>
          {primaryDoctor && (
            <span className="flex items-center gap-1.5">
              <Heart size={14} className="text-teal-400" /> Dr. {primaryDoctor}
            </span>
          )}
        </div>
        {patient.allergies && patient.allergies.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {patient.allergies.map((allergy, i) => (
              <Badge key={i} className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs">
                ⚠️ {allergy}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* 3-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Appointments */}
        <div className={`${cardStyle} ${cardClasses}`}>
          <div className="flex items-center gap-2 mb-5">
            <Calendar size={18} className="text-teal-400" />
            <h2 className="text-lg font-semibold text-white font-display">Upcoming Appointments</h2>
          </div>
          {appointments.length === 0 ? (
            <p className="text-sm text-gray-500">No upcoming appointments.</p>
          ) : (
            <div className="space-y-4">
              {appointments.map((appt) => {
                const doc = Array.isArray(appt.doctor) ? appt.doctor[0] : appt.doctor;
                return (
                  <div key={appt.id} className="border-b border-[#1A1F35] pb-3 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">
                          Dr. {doc?.full_name || 'Unknown'}
                        </p>
                        <p className="text-xs text-gray-500">{doc?.specialization || ''}</p>
                      </div>
                      <Badge className={`text-[10px] border ${statusColors[appt.status] || statusColors.scheduled}`}>
                        {appt.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> {format(new Date(appt.appointment_date), 'MMM d, yyyy')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {appt.appointment_time}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Active Medications */}
        <div className={`${cardStyle} ${cardClasses}`}>
          <div className="flex items-center gap-2 mb-5">
            <Pill size={18} className="text-teal-400" />
            <h2 className="text-lg font-semibold text-white font-display">Active Medications</h2>
          </div>
          {medications.length === 0 ? (
            <p className="text-sm text-gray-500">No active medications.</p>
          ) : (
            <div className="space-y-4">
              {medications.map((med) => (
                <div key={med.id} className="border-b border-[#1A1F35] pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-medium text-white">{med.medication_name}</p>
                  <p className="text-xs text-teal-400 mt-0.5">{med.dosage} · {med.frequency}</p>
                  {med.instructions && (
                    <p className="text-xs text-gray-500 mt-1">{med.instructions}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Notifications */}
        <div className={`${cardStyle} ${cardClasses}`}>
          <div className="flex items-center gap-2 mb-5">
            <Bell size={18} className="text-teal-400" />
            <h2 className="text-lg font-semibold text-white font-display">Recent Updates</h2>
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-500">No recent notifications.</p>
          ) : (
            <div className="space-y-4">
              {notifications.map((notif) => {
                const Icon = notifIcons[notif.type] || Bell;
                return (
                  <div key={notif.id} className="flex gap-3 border-b border-[#1A1F35] pb-3 last:border-0 last:pb-0">
                    <div className="mt-0.5 shrink-0 w-7 h-7 rounded-lg bg-teal-500/10 flex items-center justify-center">
                      <Icon size={14} className="text-teal-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">{notif.title}</p>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">{notif.message}</p>
                      <p className="text-[10px] text-gray-600 mt-1">
                        {format(new Date(notif.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          to="/patient/chat"
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm font-medium hover:bg-teal-500/20 transition-colors"
        >
          <MessageSquare size={16} /> Chat with AI
        </Link>
        <Link
          to="/patient/appointments"
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm font-medium hover:bg-teal-500/20 transition-colors"
        >
          <Calendar size={16} /> Book Appointment
        </Link>
        <Link
          to="/patient/chat?prompt=symptom-check"
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 text-sm font-medium hover:bg-teal-500/20 transition-colors"
        >
          <Search size={16} /> Check Symptoms
        </Link>
        <button
          onClick={async () => {
            setAiTestLoading(true);
            setAiTestResult(null);
            try {
              const res = await callAgent({
                agent_type: 'patient_agent',
                message: 'What are 3 tips for staying healthy?',
                patient_context: patient ? { name: patient.full_name, allergies: patient.allergies } : undefined,
              });
              console.log('🤖 AI Agent Response:', res);
              setAiTestResult(res.reply);
            } catch (err) {
              console.error('🤖 AI Agent Error:', err);
              setAiTestResult(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
            } finally {
              setAiTestLoading(false);
            }
          }}
          disabled={aiTestLoading}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-medium hover:bg-yellow-500/20 transition-colors disabled:opacity-50"
        >
          🤖 {aiTestLoading ? 'Calling AI...' : 'Test AI Agent'}
        </button>
      </div>

      {/* AI Test Result */}
      {aiTestResult && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-200 text-sm">
          <p className="font-semibold text-yellow-400 mb-2">🤖 AI Agent Response:</p>
          <p className="whitespace-pre-wrap">{aiTestResult}</p>
          <span className="block text-xs text-yellow-500 mt-2">Remove this test after verifying.</span>
        </div>
      )}
    </div>
  );
};

export default PatientDashboard;
