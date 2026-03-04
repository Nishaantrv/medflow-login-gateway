import { useEffect, useRef, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase as externalSupabase } from '@/integrations/supabase/client';
import { callAgent, type ConversationMessage, type PatientContext } from '@/services/aiAgent';
import { Send, Brain, AlertTriangle, Plus, Search, MessageSquare, History, Clock } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  triage_level?: "EMERGENCY" | "URGENT" | "ROUTINE" | null;
  suggested_action?: string | null;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface PatientData {
  id: string;
  full_name: string;
  date_of_birth: string;
  blood_type: string;
  allergies: string[];
  chronic_conditions: string[];
  insurance_provider: string;
}

const quickChips = [
  { emoji: '📅', label: 'Book Appointment', message: 'I want to book a new appointment. Please show me available doctors and help me schedule it.' },
  { emoji: '💊', label: 'My Medications', message: 'Can you list my current active medications and their instructions?' },
  { emoji: '🔍', label: 'Check Symptoms', message: 'I want to check some symptoms I\'ve been experiencing. Can you help me understand what might be going on?' },
  { emoji: '📋', label: 'Lab Results', message: 'Can you help me understand my recent lab results and what they mean?' },
];

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

const TypingIndicator = () => (
  <div className="flex items-end gap-3 max-w-[80%]">
    <div className="shrink-0 w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center">
      <Brain size={16} className="text-teal-400" />
    </div>
    <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-[#0C0F1A] border border-[#1A1F35]">
      <div className="flex gap-1.5 items-center h-5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-teal-400 animate-bounce"
            style={{ animationDelay: `${i * 150}ms`, animationDuration: '0.8s' }}
          />
        ))}
      </div>
    </div>
  </div>
);

const TriageBadge = ({ level }: { level?: string | null }) => {
  if (level === 'EMERGENCY') {
    return (
      <Badge className="mb-2 bg-red-500/20 text-red-500 border-red-500/30 flex items-center gap-1.5 w-fit">
        <AlertTriangle size={12} /> Emergency: Seek Immediate Care
      </Badge>
    );
  }
  if (level === 'URGENT') {
    return (
      <Badge className="mb-2 bg-orange-500/20 text-orange-500 border-orange-500/30 flex items-center gap-1.5 w-fit">
        <AlertTriangle size={12} /> Urgent: Contact Doctor Soon
      </Badge>
    );
  }
  if (level === 'ROUTINE') {
    return (
      <Badge className="mb-2 bg-teal-500/20 text-teal-400 border-teal-500/30 flex items-center gap-1.5 w-fit">
        Routine: Monitor & Schedule Follow-up
      </Badge>
    );
  }
  return null;
};

const PatientChat = () => {
  const { user, db_id } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [patientContext, setPatientContext] = useState<PatientContext | undefined>();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConvId, setCurrentConvId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingHistory, setLoadingHistory] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Load patient data and build context
  useEffect(() => {
    if (!user) return;

    const loadContext = async () => {
      const { data: patient } = await externalSupabase
        .from('patients')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!patient) return;
      setPatientData(patient);

      const [medsRes, apptsRes] = await Promise.all([
        externalSupabase
          .from('medications')
          .select('medication_name, dosage, frequency')
          .eq('patient_id', patient.id)
          .eq('is_active', true),
        externalSupabase
          .from('appointments')
          .select('appointment_date, appointment_time, doctor:doctors(full_name)')
          .eq('patient_id', patient.id)
          .in('status', ['scheduled', 'confirmed'])
          .gte('appointment_date', new Date().toISOString().split('T')[0])
          .order('appointment_date', { ascending: true })
          .limit(3),
      ]);

      const ctx: PatientContext = {
        user_id: user.id,
        name: patient.full_name,
        age: patient.date_of_birth ? calculateAge(patient.date_of_birth) : undefined,
        blood_type: patient.blood_type,
        allergies: patient.allergies || [],
        chronic_conditions: patient.chronic_conditions || [],
        active_medications: (medsRes.data || []).map((m: any) => `${m.medication_name} ${m.dosage} (${m.frequency})`),
        upcoming_appointments: (apptsRes.data || []).map((a: any) => {
          const doc = Array.isArray(a.doctor) ? a.doctor[0] : a.doctor;
          return `${a.appointment_date} at ${a.appointment_time} with Dr. ${doc?.full_name || 'Unknown'}`;
        }),
        insurance: patient.insurance_provider,
      };
      setPatientContext(ctx);
    };

    loadContext();
    if (user?.id) {
      fetchConversations();
      checkDatabaseHealth();
    }
  }, [user?.id]);

  const checkDatabaseHealth = async () => {
    try {
      const { error } = await (externalSupabase as any).from('conversations').select('id').limit(1);
      if (error) {
        console.error("🚨 MEDFLOW DB ERROR: The 'conversations' table might be missing or unreachable. Details:", error);
      } else {
        console.log("✅ MEDFLOW DB: 'conversations' table is reachable.");
      }
    } catch (err) {
      console.error("🚨 MEDFLOW DB FATAL: Failed to query conversations table.", err);
    }
  };

  const fetchConversations = async () => {
    if (!user?.id) {
      console.log("⚠️ MEDFLOW: user.id is null, skipping conversations fetch.");
      return;
    }

    console.log("🔍 MEDFLOW: Fetching conversations for user:", user.id);
    const { data, error } = await (externalSupabase as any)
      .from('conversations')
      .select('*')
      .eq('user_id', user.id)
      .eq('agent_type', 'patient_agent')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error("❌ MEDFLOW: Error fetching conversations:", error);
      return;
    }

    console.log(`✅ MEDFLOW: Successfully fetched ${data?.length || 0} conversations.`);
    if (data) setConversations(data);
  };

  const loadConversation = async (convId: string) => {
    if (isTyping) return;
    setCurrentConvId(convId);
    setLoadingHistory(true);
    setMessages([]);

    try {
      const { data } = await (externalSupabase as any)
        .from('chat_history')
        .select('*')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true });

      if (data) {
        const history: ChatMessage[] = [];
        data.forEach((entry: any) => {
          history.push({
            id: `${entry.id}-user`,
            role: 'user',
            content: entry.message,
            timestamp: new Date(entry.created_at)
          });
          if (entry.response) {
            history.push({
              id: `${entry.id}-ai`,
              role: 'assistant',
              content: entry.response,
              timestamp: new Date(entry.created_at)
            });
          }
        });
        setMessages(history);
      }
    } catch (err) {
      console.error('Error loading history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const startNewChat = () => {
    if (isTyping) return;
    setCurrentConvId(null);
    setMessages([]);
    setSearchParams({});
  };

  // Handle auto-prompt from URL
  useEffect(() => {
    const promptValue = searchParams.get('prompt');
    if (promptValue === 'symptom-check' && patientContext && messages.length === 0 && !loadingHistory) {
      sendMessage("I want to check some symptoms I've been experiencing. Can you help me understand what might be going on?");
    }
  }, [searchParams, patientContext, messages.length, loadingHistory]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: ChatMessage = {
      id: generateId(),
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const history: ConversationMessage[] = messages
        .filter(m => m.role !== 'assistant' || !m.content.includes("Hello"))
        .map(m => ({ role: m.role, content: m.content }));

      const res = await callAgent({
        agent_type: 'patient_agent',
        message: text.trim(),
        patient_context: patientContext,
        conversation_history: history,
        user_id: db_id || undefined,
        conversation_id: currentConvId || undefined,
      });

      if (!currentConvId && res.conversation_id) {
        console.log("🆕 MEDFLOW: New conversation created:", res.conversation_id);
        setCurrentConvId(res.conversation_id);
        setTimeout(() => fetchConversations(), 500);
      }

      if ((res as any).db_error) {
        console.error("🚨 MEDFLOW BACKEND DB ERROR:", (res as any).db_error);
      }

      console.log("MedFlow AI Version:", (res as any).ai_version);

      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: res.reply,
        triage_level: res.triage_level,
        suggested_action: res.suggested_action,
        timestamp: new Date(),
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: 'I\'m sorry, I encountered an error. Please try again in a moment.',
        timestamp: new Date(),
      }]);
      console.error('Chat error:', err);
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  }, [messages, isTyping, patientContext, db_id, currentConvId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const filteredConversations = conversations.filter(c =>
    c.title?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex h-[calc(100vh-100px)] gap-6" style={{ background: '#060810' }}>
      {/* Sidebar */}
      <div className="w-80 flex flex-col bg-[#0C0F1A] border border-[#1A1F35] rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-[#1A1F35] space-y-4">
          <button
            onClick={startNewChat}
            disabled={isTyping}
            className="w-full flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50"
          >
            <Plus size={18} />
            <span>New Chat</span>
          </button>

          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-teal-400 transition-colors" size={16} />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#1A1F35]/30 border border-[#1A1F35] rounded-xl pl-10 pr-4 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-teal-500/50 transition-all"
            />
          </div>
        </div>

        <ScrollArea className="flex-1 px-2 py-4">
          <div className="space-y-1">
            <div className="px-3 mb-2">
              <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest flex items-center gap-2">
                <History size={12} /> Recent Conversations
              </span>
            </div>
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={cn(
                  "w-full flex flex-col gap-1 px-3 py-3 rounded-xl transition-all text-left group",
                  currentConvId === conv.id
                    ? "bg-teal-500/10 border border-teal-500/20"
                    : "hover:bg-white/5 border border-transparent"
                )}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare size={14} className={currentConvId === conv.id ? "text-teal-400" : "text-gray-500 group-hover:text-gray-400"} />
                  <span className={cn(
                    "text-xs font-semibold truncate",
                    currentConvId === conv.id ? "text-white" : "text-gray-400 group-hover:text-gray-200"
                  )}>
                    {conv.title || "Untitled Chat"}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 ml-5">
                  <Clock size={10} className="text-gray-600" />
                  <span className="text-[9px] text-gray-600 font-medium">
                    {format(new Date(conv.updated_at), 'MMM d, h:mm a')}
                  </span>
                </div>
              </button>
            ))}
            {filteredConversations.length === 0 && (
              <div className="px-3 py-8 text-center">
                <p className="text-xs text-gray-600 italic">No conversations found</p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-[#0C0F1A] border border-[#1A1F35] rounded-2xl overflow-hidden shadow-2xl relative">
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-hide">
          {messages.length === 0 && !loadingHistory && !isTyping && (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-6 animate-in fade-in duration-700">
              <div className="w-20 h-20 rounded-3xl bg-teal-500/10 flex items-center justify-center border border-teal-500/20 shadow-2xl shadow-teal-500/5">
                <Brain size={40} className="text-teal-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-2 font-display">MedFlow AI</h2>
                <p className="text-gray-500 text-sm leading-relaxed">
                  How can I help you with your health today?
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 w-full">
                {quickChips.map(chip => (
                  <button
                    key={chip.label}
                    onClick={() => sendMessage(chip.message)}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-[#1A1F35]/30 border border-[#1A1F35] hover:border-teal-500/40 hover:bg-teal-500/5 transition-all group"
                  >
                    <span className="text-2xl group-hover:scale-110 transition-transform">{chip.emoji}</span>
                    <span className="text-[10px] font-bold text-gray-400 group-hover:text-teal-400 uppercase tracking-widest">{chip.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {loadingHistory && (
            <div className="flex flex-col items-center justify-center h-full gap-4">
              <div className="w-10 h-10 border-2 border-teal-500/20 border-t-teal-500 rounded-full animate-spin" />
              <p className="text-xs text-gray-500 animate-pulse font-medium tracking-widest uppercase">Fetching history...</p>
            </div>
          )}

          {messages.map(msg => (
            <div
              key={msg.id}
              className={cn("flex animate-in fade-in slide-in-from-bottom-2 duration-300", msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {msg.role === 'assistant' && (
                <div className="flex items-start gap-4 max-w-[85%] md:max-w-[70%]">
                  <div className="shrink-0 w-8 h-8 rounded-lg bg-teal-500/20 flex items-center justify-center border border-teal-500/20">
                    <Brain size={18} className="text-teal-400" />
                  </div>
                  <div className="rounded-2xl rounded-tl-sm px-5 py-4 bg-[#1A1F35]/50 border border-[#1A1F35] text-sm text-gray-200 leading-relaxed shadow-lg shadow-black/20">
                    <TriageBadge level={msg.triage_level} />
                    <div className="prose prose-sm prose-invert max-w-none [&_p]:my-2 [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-1">
                      <ReactMarkdown>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    {msg.suggested_action && (
                      <div className="mt-4 pt-4 border-t border-[#1A1F35]">
                        <button
                          onClick={() => sendMessage(`I'd like to ${msg.suggested_action?.toLowerCase()} based on your suggestion.`)}
                          className="text-[10px] font-black text-teal-400 hover:text-teal-300 uppercase tracking-widest flex items-center gap-2 group"
                        >
                          Action: {msg.suggested_action} <span className="group-hover:translate-x-1 transition-transform">→</span>
                        </button>
                      </div>
                    )}
                    <p className="text-[9px] text-gray-600 mt-3 font-medium uppercase tracking-tighter">
                      {format(msg.timestamp, 'h:mm a')}
                    </p>
                  </div>
                </div>
              )}

              {msg.role === 'user' && (
                <div className="max-w-[85%] md:max-w-[70%]">
                  <div className="rounded-2xl rounded-tr-sm px-5 py-4 bg-teal-600 text-white shadow-xl shadow-teal-900/10 border border-teal-500/20">
                    <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    <p className="text-[9px] text-teal-200/60 mt-3 font-medium text-right uppercase tracking-tighter">
                      {format(msg.timestamp, 'h:mm a')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isTyping && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        <div className="p-6 bg-[#0C0F1A] border-t border-[#1A1F35] space-y-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {(messages.length > 0 || currentConvId) && quickChips.map(chip => (
              <button
                key={chip.label}
                onClick={() => sendMessage(chip.message)}
                disabled={isTyping}
                className="whitespace-nowrap px-3 py-1.5 rounded-lg bg-[#1A1F35] text-[10px] text-gray-400 hover:text-white border border-transparent hover:border-teal-500/30 transition-all font-bold tracking-tight disabled:opacity-50"
              >
                {chip.label.toUpperCase()}
              </button>
            ))}
          </div>

          <form
            onSubmit={handleSubmit}
            className="flex items-center gap-3"
          >
            <div className="flex-1 flex items-center gap-3 rounded-xl bg-[#1A1F35]/30 border border-[#1A1F35] px-4 py-3 focus-within:border-teal-500/50 focus-within:ring-1 focus-within:ring-teal-500/20 transition-all shadow-inner">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type a message..."
                disabled={isTyping}
                className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none disabled:opacity-50"
              />
            </div>
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="w-12 h-12 rounded-xl bg-teal-500 hover:bg-teal-600 text-white flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-lg shadow-teal-500/20"
            >
              <Send size={20} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </form>
          <p className="text-center text-[9px] text-gray-600 font-medium uppercase tracking-[0.2em]">
            MedFlow AI can make mistakes. Check important clinical info.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PatientChat;
