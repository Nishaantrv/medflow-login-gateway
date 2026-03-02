import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase as externalSupabase } from '@/integrations/supabase/client';
import { FileText, Clipboard, Search, Thermometer, Heart, Activity, Wind, Eye, Calendar, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface SoapNote {
  id: string;
  created_at: string;
  record_type: string;
  vitals: {
    temp: string;
    blood_pressure: string;
    heart_rate: string;
    oxygen_level: string;
  } | null;
  content: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  } | null;
  patient: {
    user: {
      full_name: string;
    } | null;
  } | null;
}

const DoctorSoapNotes = () => {
  const { db_id } = useAuth();
  const [notes, setNotes] = useState<SoapNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db_id) return;

    const fetchNotes = async () => {
      setLoading(true);
      try {
        const { data: doctorData } = await (externalSupabase as any)
          .from('doctors')
          .select('id')
          .eq('user_id', db_id)
          .maybeSingle();

        if (doctorData) {
          const { data, error } = await (externalSupabase as any)
            .from('medical_records')
            .select(`
              id,
              created_at,
              record_type,
              vitals,
              content,
              patient:patient_id (
                user:user_id (full_name)
              )
            `)
            .eq('doctor_id', doctorData.id)
            .order('created_at', { ascending: false });

          if (error) console.error('Error fetching SOAP notes:', error);
          if (data) setNotes(data as any);
        }
      } catch (err) {
        console.error('Error in fetchNotes:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotes();
  }, [db_id]);

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48 mb-6 bg-[#1A1F35]" />
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-2xl bg-[#1A1F35]" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" style={{ background: '#060810', minHeight: '100%' }}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1 font-display">SOAP Notes & Records</h1>
          <p className="text-gray-400 text-sm">Review clinical documentation and patient observations</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
            <input className="bg-[#0C0F1A] border border-[#1A1F35] rounded-xl pl-10 pr-4 py-2 text-sm text-gray-300 focus:outline-none focus:border-teal-500/50 w-full" placeholder="Search records..." />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {notes.length === 0 ? (
          <div className="text-center py-20 bg-[#0C0F1A] border border-[#1A1F35] rounded-2xl">
            <FileText className="mx-auto text-gray-700 mb-4" size={48} />
            <p className="text-gray-400">No medical records found.</p>
          </div>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="rounded-2xl border p-6 bg-[#0C0F1A] border-[#1A1F35] hover:border-teal-500/30 transition-all flex flex-col gap-6 group">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1A1F35] pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400 ring-1 ring-teal-500/20">
                    <Clipboard size={20} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white leading-tight">Record: {note.patient?.user?.full_name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-gray-500 flex items-center gap-1">
                        <Calendar size={10} className="text-teal-500" /> {format(new Date(note.created_at), 'MMMM d, yyyy')}
                      </span>
                      <span className="text-[10px] text-gray-500 flex items-center gap-1">
                        <Clock size={10} className="text-teal-500" /> {format(new Date(note.created_at), 'p')}
                      </span>
                    </div>
                  </div>
                </div>
                <Badge variant="outline" className="border-teal-500/30 text-teal-400 bg-teal-500/5 px-2 py-0.5 text-[10px] uppercase">
                  {note.record_type || 'Consultation'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-3 rounded-xl bg-[#1A1F35]/20 border border-[#1A1F35] flex items-center gap-3">
                  <Thermometer size={16} className="text-orange-400" />
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">Temp</p>
                    <p className="text-sm font-semibold text-white">{note.vitals?.temp || '98.6'}°F</p>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#1A1F35]/20 border border-[#1A1F35] flex items-center gap-3">
                  <Heart size={16} className="text-red-400" />
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">Heart Rate</p>
                    <p className="text-sm font-semibold text-white">{note.vitals?.heart_rate || '72'} BPM</p>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#1A1F35]/20 border border-[#1A1F35] flex items-center gap-3">
                  <Activity size={16} className="text-blue-400" />
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">BP</p>
                    <p className="text-sm font-semibold text-white">{note.vitals?.blood_pressure || '120/80'}</p>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#1A1F35]/20 border border-[#1A1F35] flex items-center gap-3">
                  <Wind size={16} className="text-cyan-400" />
                  <div>
                    <p className="text-[10px] text-gray-500 uppercase">Oxygen</p>
                    <p className="text-sm font-semibold text-white">{note.vitals?.oxygen_level || '98'}%</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-2">
                <div className="space-y-6">
                  <div className="relative pl-4 border-l-2 border-teal-500/30">
                    <h4 className="text-xs font-bold text-teal-500 uppercase mb-2 tracking-widest">Subjective</h4>
                    <p className="text-sm text-gray-400 leading-relaxed italic">"{note.content?.subjective || 'No subjective observations recorded.'}"</p>
                  </div>
                  <div className="relative pl-4 border-l-2 border-teal-500/30">
                    <h4 className="text-xs font-bold text-teal-500 uppercase mb-2 tracking-widest">Objective</h4>
                    <p className="text-sm text-gray-400 leading-relaxed italic">"{note.content?.objective || 'No objective findings recorded.'}"</p>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="relative pl-4 border-l-2 border-teal-500/30">
                    <h4 className="text-xs font-bold text-teal-500 uppercase mb-2 tracking-widest">Assessment</h4>
                    <div className="bg-teal-500/5 rounded-lg p-3 border border-teal-500/10">
                      <p className="text-sm font-medium text-white">{note.content?.assessment || 'Initial clinical assessment.'}</p>
                    </div>
                  </div>
                  <div className="relative pl-4 border-l-2 border-teal-500/30">
                    <h4 className="text-xs font-bold text-teal-500 uppercase mb-2 tracking-widest">Plan</h4>
                    <p className="text-sm text-gray-400 leading-relaxed italic">"{note.content?.plan || 'Follow standard treatment care plan.'}"</p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DoctorSoapNotes;
