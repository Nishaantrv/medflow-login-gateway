import { useEffect, useState } from 'react';
import { supabase as externalSupabase } from '@/integrations/supabase/client';
import { analyzeReadability, getReadabilityLabel } from '@/services/readabilityScorer';
import { BarChart3, ArrowRight, Loader2, Target } from 'lucide-react';

interface SimplifiedCase {
    original: number;
    simplified: number;
}

const ReadabilityAnalytics = ({ userId }: { userId: string }) => {
    const [stats, setStats] = useState<{
        avgGrade: number;
        label: string;
        color: string;
        simplifiedCases: SimplifiedCase[];
    } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                // Fetch last 10 where it's a family agent message
                // User mentions role = 'assistant', indicating they might have a message-per-row schema
                // We'll try to accommodate that or fallback to the message/response pair schema
                const { data, error } = await (externalSupabase as any)
                    .from('chat_history')
                    .select('*')
                    .eq('agent_type', 'family_agent')
                    .order('created_at', { ascending: false })
                    .limit(20); // Get a bit more to find enough AI messages

                if (error) throw error;

                if (data && data.length > 0) {
                    let totalGrade = 0;
                    let count = 0;
                    const simplifiedCases: SimplifiedCase[] = [];

                    data.forEach((row: any) => {
                        // Support both schemas: 
                        // 1. Single content with role (role='assistant' or sender_type='assistant')
                        // 2. Pair with message/response (response is assistant)
                        const assistantText = row.role === 'assistant' || row.sender_type === 'assistant'
                            ? row.content
                            : row.response;

                        if (assistantText && count < 10) {
                            const analysis = analyzeReadability(assistantText);
                            totalGrade += analysis.grade;
                            count++;

                            // Detect simplification instruction in message
                            // This works for the message/response pair schema
                            if (row.message && row.message.includes("The following text is too complex")) {
                                const parts = row.message.split('\n\n');
                                const originalText = parts[parts.length - 1]; // Original text is usually at the end
                                if (originalText && originalText.length > 10) {
                                    const originalAnalysis = analyzeReadability(originalText);
                                    simplifiedCases.push({
                                        original: originalAnalysis.grade,
                                        simplified: analysis.grade
                                    });
                                }
                            }
                        }
                    });

                    const avgGrade = count > 0 ? Math.round((totalGrade / count) * 10) / 10 : 0;
                    const labelData = getReadabilityLabel(avgGrade);

                    setStats({
                        avgGrade,
                        label: labelData.label,
                        color: labelData.color,
                        simplifiedCases: simplifiedCases.slice(0, 3) // Show top 3
                    });
                }
            } catch (err) {
                console.error('Error fetching readability stats:', err);
            } finally {
                setLoading(false);
            }
        };

        if (userId) fetchStats();
    }, [userId]);

    if (loading) {
        return (
            <div className="glass-card p-6 border-white/5 flex flex-col items-center justify-center min-h-[200px]">
                <Loader2 className="animate-spin text-teal-500 mb-2" size={24} />
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Analyzing Clarity...</p>
            </div>
        );
    }

    const hasData = stats && stats.avgGrade > 0;
    const displayStats = stats || {
        avgGrade: 0,
        label: "No Data Found",
        color: "#6B7280",
        simplifiedCases: []
    };

    const targetGrade = 8;
    const progress = Math.min(100, (displayStats.avgGrade / 14) * 100);
    const isWithinTarget = hasData && displayStats.avgGrade <= targetGrade;

    // Progress color based on grade
    const progressColor = !hasData ? "#1A1F35" : (displayStats.avgGrade <= 8 ? '#10B981' : displayStats.avgGrade <= 10 ? '#EAB308' : '#EF4444');

    return (
        <div className="glass-card p-6 border-white/5 space-y-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-teal-500/10 transition-colors" />

            <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-teal-500/10 text-teal-400">
                        <BarChart3 size={14} />
                    </div>
                    <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Communication Clarity</h3>
                </div>
                <Target size={14} className={isWithinTarget ? "text-emerald-500" : "text-gray-600"} />
            </div>

            <div className="text-center py-2 relative z-10">
                {hasData ? (
                    <>
                        <p className="text-5xl font-black tracking-tighter mb-1" style={{ color: displayStats.color }}>
                            {displayStats.avgGrade}
                        </p>
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-widest opacity-80" style={{ color: displayStats.color }}>
                                {displayStats.label}
                            </span>
                        </div>
                    </>
                ) : (
                    <div className="py-4">
                        <p className="text-2xl font-black text-gray-700 uppercase tracking-tighter">Waiting for Chat</p>
                        <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-1">Send a message to see stats</p>
                    </div>
                )}
            </div>

            {hasData && displayStats.simplifiedCases.length > 0 && (
                <div className="space-y-2.5 relative z-10">
                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Auto-Simplification Impact</p>
                    <div className="space-y-2">
                        {displayStats.simplifiedCases.map((c, i) => (
                            <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-white/[0.02] border border-white/5 animate-in fade-in slide-in-from-right-2 duration-300" style={{ animationDelay: `${i * 100}ms` }}>
                                <div className="flex flex-col">
                                    <span className="text-[8px] text-gray-600 uppercase font-black">Original</span>
                                    <span className="text-xs font-bold text-gray-400">G{c.original}</span>
                                </div>
                                <ArrowRight size={10} className="text-teal-500/40" />
                                <div className="flex flex-col items-end">
                                    <span className="text-[8px] text-emerald-500/60 uppercase font-black">Targeted</span>
                                    <span className="text-xs font-bold text-emerald-400">G{c.simplified}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-3 relative z-10">
                <div className="flex justify-between items-end">
                    <div className="flex flex-col">
                        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Accessibility Target</span>
                        <span className="text-[8px] text-gray-600 font-medium">Goal: Grade ≤ 8.0</span>
                    </div>
                    {hasData && (
                        <span className="text-[10px] font-black uppercase tracking-tighter" style={{ color: progressColor }}>
                            {isWithinTarget ? "OPTIMAL" : displayStats.avgGrade <= 10 ? "MODERATE" : "COMPLEX"}
                        </span>
                    )}
                </div>
                <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <div
                        className="h-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                        style={{
                            width: `${progress}%`,
                            backgroundColor: progressColor,
                            boxShadow: hasData ? `0 0 12px ${progressColor}33` : 'none'
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default ReadabilityAnalytics;
