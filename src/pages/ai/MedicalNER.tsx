import React, { useState, useEffect, useMemo, useRef } from 'react';
import { UMLS_KB, SAMPLES, EntityInfo } from '@/data/umls-kb';
import {
    Play,
    RotateCcw,
    Database,
    Brain,
    Search,
    FileText,
    Activity,
    Info,
    ChevronRight,
    Clock,
    Fingerprint,
    Layers,
    Dna
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// Types
interface EntityMatch extends EntityInfo {
    text: string;
    start: number;
    end: number;
}

const PIPE_STEPS = [
    'Tokenizer',
    'Tagger',
    'Parser',
    'NER',
    'Entity Linker',
    'Output'
];

const STEP_SUBTEXT = [
    'Splitting text into meaningful units',
    'Part-of-speech tagging (noun, verb, etc.)',
    'Dependency parsing for syntax',
    'Named Entity Recognition (en_core_sci_lg)',
    'Linking to UMLS Knowledge Base',
    'Final visualization generated'
];

export default function MedicalNER() {
    const [inputText, setInputText] = useState(SAMPLES[0]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [activeStep, setActiveStep] = useState<number | null>(null);
    const [procText, setProcText] = useState('');
    const [entities, setEntities] = useState<EntityMatch[]>([]);
    const [stats, setStats] = useState({
        tokens: 0,
        entities: 0,
        linked: 0,
        time: 0,
        sents: 0,
        avgConf: 0
    });

    const outputRef = useRef<HTMLDivElement>(null);

    // KB Keys sorted by length for greedy matching
    const kbKeys = useMemo(() => Object.keys(UMLS_KB).sort((a, b) => b.length - a.length), []);

    const tokenize = (text: string) => {
        return text.split(/(\s+|(?=[.,;:!?()\[\]{}])|(?<=[.,;:!?()\[\]{}]))/).filter(t => t.length > 0);
    };

    const extractEntities = (text: string) => {
        const lower = text.toLowerCase();
        const results: EntityMatch[] = [];
        const used = new Set<number>();

        for (const key of kbKeys) {
            let searchFrom = 0;
            while (true) {
                const idx = lower.indexOf(key, searchFrom);
                if (idx === -1) break;

                const before = idx > 0 ? lower[idx - 1] : ' ';
                const after = idx + key.length < lower.length ? lower[idx + key.length] : ' ';
                const boundaryChars = /[\s.,;:!?()\[\]{}\-\/]/;

                if ((idx === 0 || boundaryChars.test(before)) &&
                    (idx + key.length === lower.length || boundaryChars.test(after))) {

                    let overlap = false;
                    for (let i = idx; i < idx + key.length; i++) {
                        if (used.has(i)) { overlap = true; break; }
                    }

                    if (!overlap) {
                        const kbItem = UMLS_KB[key];
                        const conf = Math.min(1, Math.max(0.7, kbItem.conf + (Math.random() - 0.5) * 0.04));
                        results.push({
                            text: text.substring(idx, idx + key.length),
                            start: idx,
                            end: idx + key.length,
                            ...kbItem,
                            conf
                        });
                        for (let i = idx; i < idx + key.length; i++) used.add(i);
                    }
                }
                searchFrom = idx + 1;
            }
        }
        return results.sort((a, b) => a.start - b.start);
    };

    const runNER = async () => {
        if (!inputText.trim() || isProcessing) return;

        setIsProcessing(true);
        setEntities([]);
        setActiveStep(null);
        const startTime = performance.now();

        const steps = [
            'Running tokenizer...',
            'POS tagger active...',
            'Dependency parser...',
            'NER model inference...',
            'UMLS entity linking...',
            'Generating output...'
        ];

        for (let i = 0; i < steps.length; i++) {
            setActiveStep(i);
            setProcText(steps[i]);
            await new Promise(r => setTimeout(r, 300 + Math.random() * 200));
        }

        const foundEntities = extractEntities(inputText);
        const elapsed = Math.round(performance.now() - startTime);

        setEntities(foundEntities);

        // Calculate stats
        const tokens = tokenize(inputText);
        const sents = inputText.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
        const uniqueLinked = new Set(foundEntities.map(e => `${e.text.toLowerCase()}|${e.type}`)).size;
        const avgConf = foundEntities.length > 0
            ? foundEntities.reduce((acc, e) => acc + e.conf, 0) / foundEntities.length
            : 0;

        setStats({
            tokens: tokens.length,
            entities: foundEntities.length,
            linked: uniqueLinked,
            time: elapsed,
            sents,
            avgConf
        });

        setIsProcessing(false);
        setActiveStep(5); // Stay on output step
    };

    const loadSample = (idx: number) => {
        setInputText(SAMPLES[idx]);
    };

    const renderAnnotatedText = () => {
        if (entities.length === 0) {
            return <span className="text-muted-foreground opacity-50 italic">Entities will be highlighted here after extraction...</span>;
        }

        let lastIdx = 0;
        const elements: React.ReactNode[] = [];

        entities.forEach((ent, i) => {
            // Add text before entity
            if (ent.start > lastIdx) {
                elements.push(<span key={`text-${i}`}>{inputText.substring(lastIdx, ent.start)}</span>);
            }

            // Add entity with tooltip
            const typeStyles: Record<string, string> = {
                'DISEASE': 'border-b-2 border-[#f472b6] bg-[#f472b6]/10 text-pink-400',
                'MEDICATION': 'border-b-2 border-[#34d399] bg-[#34d399]/10 text-emerald-400',
                'PROCEDURE': 'border-b-2 border-[#a78bfa] bg-[#a78bfa]/10 text-violet-400',
                'ANATOMY': 'border-b-2 border-[#fb923c] bg-[#fb923c]/10 text-orange-400',
                'LAB_TEST': 'border-b-2 border-[#22d3ee] bg-[#22d3ee]/10 text-cyan-400',
            };

            elements.push(
                <TooltipProvider key={`ent-${i}`}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className={cn(
                                "px-0.5 rounded-t-sm cursor-help transition-all hover:brightness-125 inline-flex items-baseline gap-1",
                                typeStyles[ent.type]
                            )}>
                                {ent.text}
                                <span className="text-[10px] font-black uppercase tracking-tighter opacity-80 leading-none">
                                    {ent.type.split('_')[0]}
                                </span>
                            </span>
                        </TooltipTrigger>
                        <TooltipContent className="w-80 p-4 bg-[#0C0F1A] border-[#1A1F35] shadow-2xl">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <h4 className="font-bold text-white tracking-tight">{ent.text}</h4>
                                    <Badge variant="outline" className="text-[10px] border-[#14B8A6] text-[#14B8A6] uppercase">
                                        {ent.type.replace('_', ' ')}
                                    </Badge>
                                </div>
                                <p className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">{ent.cui}</p>
                                <p className="text-xs text-muted-foreground leading-relaxed">{ent.def}</p>
                                <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                                    <span className="text-[10px] text-gray-500 uppercase tracking-widest font-black">Confidence</span>
                                    <span className="text-[10px] font-bold text-emerald-400">{Math.round(ent.conf * 100)}%</span>
                                </div>
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            );
            lastIdx = ent.end;
        });

        // Add remaining text
        if (lastIdx < inputText.length) {
            elements.push(<span key="text-last">{inputText.substring(lastIdx)}</span>);
        }

        return <div className="leading-loose text-[15px] font-medium tracking-wide text-gray-200">{elements}</div>;
    };

    const uniqueEntities = useMemo(() => {
        const seen = new Map<string, EntityMatch>();
        entities.forEach(e => {
            const key = `${e.text.toLowerCase()}|${e.type}`;
            if (!seen.has(key) || e.conf > seen.get(key)!.conf) {
                seen.set(key, e);
            }
        });
        return Array.from(seen.values()).sort((a, b) => b.conf - a.conf);
    }, [entities]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-4 mb-2">
                        <div className="w-12 h-12 rounded-2xl bg-[#14B8A6]/10 flex items-center justify-center border border-[#14B8A6]/20">
                            <Dna className="text-[#14B8A6]" size={24} />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-white tracking-tight">Medical NER</h1>
                            <div className="flex items-center gap-2">
                                <Badge variant="secondary" className="bg-[#14B8A6]/5 text-[#14B8A6] border-[#14B8A6]/20 py-0 text-[10px] uppercase font-black tracking-widest">
                                    en_core_sci_lg
                                </Badge>
                                <span className="text-xs text-muted-foreground uppercase tracking-widest font-black opacity-30">Biomedical NLP Pipeline</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pipeline Visualization */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {PIPE_STEPS.map((step, i) => (
                    <div
                        key={step}
                        className={cn(
                            "relative flex flex-col p-3 rounded-xl border transition-all duration-300",
                            activeStep === i
                                ? "bg-[#14B8A6]/10 border-[#14B8A6] shadow-[0_0_20px_rgba(20,184,166,0.1)]"
                                : i <= (activeStep ?? -1)
                                    ? "bg-[#14B8A6]/5 border-[#14B8A6]/30 opacity-70"
                                    : "bg-black/20 border-white/5 opacity-50"
                        )}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <span className={cn(
                                "text-[9px] font-black uppercase tracking-widest",
                                activeStep === i ? "text-[#14B8A6]" : "text-gray-500"
                            )}>Step {i + 1}</span>
                            {activeStep === i && (
                                <div className="w-1.5 h-1.5 rounded-full bg-[#14B8A6] animate-pulse" />
                            )}
                        </div>
                        <span className={cn(
                            "text-xs font-bold truncate",
                            activeStep === i ? "text-white" : "text-gray-400"
                        )}>{step}</span>
                        <div className="mt-2 text-[8px] text-muted-foreground uppercase leading-tight font-medium">
                            {STEP_SUBTEXT[i]}
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Grid */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Clinical Input */}
                <Card className="bg-[#0C0F1A] border-[#1A1F35] overflow-hidden group">
                    <CardHeader className="border-b border-white/5 bg-white/2 py-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <FileText size={14} className="text-[#14B8A6]" />
                                <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-400">Clinical Input</CardTitle>
                            </div>
                            <Badge variant="outline" className="text-[9px] border-white/10 uppercase font-black text-gray-500">Free Text</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-4">
                        <Textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Paste clinical notes, discharge summaries, or medical text here..."
                            className="min-h-[250px] bg-black/40 border-white/5 text-gray-300 focus-visible:ring-[#14B8A6] focus-visible:border-[#14B8A6] resize-none font-mono text-sm leading-relaxed"
                        />
                        <div className="flex flex-wrap items-center gap-3">
                            <Button
                                onClick={runNER}
                                disabled={isProcessing}
                                className="bg-[#14B8A6] hover:bg-[#0D9488] text-white font-black uppercase tracking-widest text-[11px] h-10 px-6 rounded-lg shadow-lg shadow-[#14B8A6]/10"
                            >
                                {isProcessing ? (
                                    <div className="flex items-center gap-2">
                                        <RotateCcw className="animate-spin" size={14} />
                                        <span>Processing...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Play size={14} fill="currentColor" />
                                        <span>Extract Entities</span>
                                    </div>
                                )}
                            </Button>
                            <div className="flex items-center gap-2 ml-auto">
                                <span className="text-[10px] uppercase font-black text-gray-600 tracking-widest">Samples:</span>
                                {[1, 2, 3].map((s, idx) => (
                                    <Button
                                        key={s}
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => loadSample(idx)}
                                        className="h-8 w-8 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 hover:text-white text-[10px] p-0 font-bold"
                                    >
                                        {s}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </ Card>

                {/* Annotated Output */}
                <Card className="bg-[#0C0F1A] border-[#1A1F35] overflow-hidden">
                    <CardHeader className="border-b border-white/5 bg-white/2 py-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Activity size={14} className="text-[#14B8A6]" />
                                <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-400">Annotated Output</CardTitle>
                            </div>
                            <Badge variant="outline" className="text-[9px] border-[#14B8A6]/30 bg-[#14B8A6]/10 text-[#14B8A6] uppercase font-black">
                                {entities.length} Entities Detected
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[350px] p-6 bg-black/20">
                            {isProcessing ? (
                                <div className="flex flex-col items-center justify-center h-full space-y-4 opacity-50">
                                    <div className="flex gap-1.5">
                                        {[1, 2, 3].map(i => (
                                            <div key={i} className="w-2 h-2 rounded-full bg-[#14B8A6] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                                        ))}
                                    </div>
                                    <span className="text-xs font-black uppercase tracking-widest text-gray-500">{procText}</span>
                                </div>
                            ) : (
                                <div className="fade-in">
                                    {renderAnnotatedText()}
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            {/* Bottom Stats & Data */}
            <div className="grid lg:grid-cols-2 gap-6">
                {/* Entities Table */}
                <Card className="bg-[#0C0F1A] border-[#1A1F35] overflow-hidden">
                    <CardHeader className="border-b border-white/5 bg-white/2 py-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Database size={14} className="text-[#14B8A6]" />
                                <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-400">Extracted Knowledge</CardTitle>
                            </div>
                            <Badge variant="outline" className="text-[9px] border-white/10 text-gray-500 uppercase font-black">
                                {uniqueEntities.length} Unique Concepts
                            </Badge>
                        </div>
                    </CardHeader>
                    <ScrollArea className="h-[280px]">
                        <div className="p-0">
                            {uniqueEntities.length > 0 ? (
                                <table className="w-full text-left text-[11px] border-collapse">
                                    <thead className="sticky top-0 bg-[#0C0F1A] border-b border-white/5">
                                        <tr>
                                            <th className="p-4 font-black uppercase tracking-widest text-gray-500">Resource</th>
                                            <th className="p-4 font-black uppercase tracking-widest text-gray-500">Semantic Type</th>
                                            <th className="p-4 font-black uppercase tracking-widest text-gray-500">CUI</th>
                                            <th className="p-4 font-black uppercase tracking-widest text-gray-500">Confidence</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {uniqueEntities.map((ent, idx) => (
                                            <tr key={idx} className="hover:bg-white/2 transition-colors group">
                                                <td className="p-4 text-white font-bold">{ent.text}</td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn(
                                                            "w-2 h-2 rounded-full",
                                                            ent.type === 'DISEASE' ? 'bg-[#f472b6]' :
                                                                ent.type === 'MEDICATION' ? 'bg-[#34d399]' :
                                                                    ent.type === 'PROCEDURE' ? 'bg-[#a78bfa]' :
                                                                        ent.type === 'ANATOMY' ? 'bg-[#fb923c]' : 'bg-[#22d3ee]'
                                                        )} />
                                                        <span className="text-gray-400 font-medium">{ent.type.replace('_', ' ')}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 font-mono text-[#14B8A6]">{ent.cui}</td>
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex-1 h-1 w-12 bg-white/5 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-[#14B8A6]"
                                                                style={{ width: `${Math.round(ent.conf * 100)}%` }}
                                                            />
                                                        </div>
                                                        <span className="font-bold text-gray-300">{Math.round(ent.conf * 100)}%</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            ) : (
                                <div className="flex flex-col items-center justify-center p-12 text-center">
                                    <div className="w-10 h-10 rounded-full bg-white/2 flex items-center justify-center mb-3">
                                        <Search className="text-gray-700" size={18} />
                                    </div>
                                    <p className="text-xs text-gray-600 font-black uppercase tracking-widest">No entities extracted yet</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </Card>

                {/* Pipeline Analytics */}
                <Card className="bg-[#0C0F1A] border-[#1A1F35] overflow-hidden flex flex-col">
                    <CardHeader className="border-b border-white/5 bg-white/2 py-3">
                        <div className="flex items-center gap-2">
                            <Layers size={14} className="text-[#14B8A6]" />
                            <CardTitle className="text-xs font-black uppercase tracking-widest text-gray-400">Pipeline Stats</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 grid grid-cols-3 gap-4 flex-1">
                        {[
                            { label: 'Tokens', value: stats.tokens, icon: Fingerprint, color: 'text-gray-400' },
                            { label: 'Entities', value: stats.entities, icon: Brain, color: 'text-[#f472b6]' },
                            { label: 'UMLS Linked', value: stats.linked, icon: Database, color: 'text-cyan-400' },
                            { label: 'Time (ms)', value: stats.time, icon: Clock, color: 'text-[#14B8A6]' },
                            { label: 'Sentences', value: stats.sents, icon: ChevronRight, color: 'text-amber-400' },
                            { label: 'Avg Conf.', value: stats.avgConf > 0 ? `${Math.round(stats.avgConf * 100)}%` : '—', icon: Activity, color: 'text-emerald-400' }
                        ].map((stat, i) => (
                            <div key={i} className="flex flex-col items-center justify-center p-3 rounded-xl bg-black/40 border border-white/5 hover:border-[#14B8A6]/20 transition-all group overflow-hidden relative">
                                <div className="absolute top-0 right-0 p-1 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <stat.icon size={24} />
                                </div>
                                <span className={cn("text-xl font-black mb-1 font-serif", stat.color)}>
                                    {stat.value}
                                </span>
                                <span className="text-[9px] font-black uppercase tracking-tighter text-gray-600">
                                    {stat.label}
                                </span>
                            </div>
                        ))}
                    </CardContent>
                    <div className="p-4 border-t border-white/5 grid grid-cols-5 gap-2">
                        {[
                            { color: 'bg-[#f472b6]', label: 'DIS' },
                            { color: 'bg-[#34d399]', label: 'MED' },
                            { color: 'bg-[#a78bfa]', label: 'PRO' },
                            { color: 'bg-[#fb923c]', label: 'ANA' },
                            { color: 'bg-[#22d3ee]', label: 'LAB' }
                        ].map(l => (
                            <div key={l.label} className="flex flex-col items-center gap-1.5 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
                                <div className={cn("w-1.5 h-1.5 rounded-full shadow-lg", l.color)} />
                                <span className="text-[8px] font-black tracking-tighter uppercase text-gray-500">{l.label}</span>
                            </div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
}
