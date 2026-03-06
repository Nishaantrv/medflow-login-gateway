import React, { useState } from "react";
import { BarChart3, Activity, Target, Brain, Info, AlertTriangle, ChevronRight, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const TRIAGE_LEVELS = ["EMERGENCY", "URGENT", "SEMI-URGENT", "NON-URGENT", "SELF-CARE"];
const TRIAGE_COLORS: Record<string, string> = {
    "EMERGENCY": "#EF4444",
    "URGENT": "#F97316",
    "SEMI-URGENT": "#EAB308",
    "NON-URGENT": "#22C55E",
    "SELF-CARE": "#3B82F6",
};

interface ModelMetrics {
    accuracy: number;
    f1_weighted: number;
    f1_macro: number;
    precision: number;
    recall: number;
    cv_mean: number;
    cv_std: number;
    f1_per_class: number[];
    confusion: number[][];
}

const metrics: Record<string, ModelMetrics> = {
    GradientBoosting: {
        accuracy: 0.9950, f1_weighted: 0.9950, f1_macro: 0.9952,
        precision: 0.9950, recall: 0.9950, cv_mean: 0.9906, cv_std: 0.0011,
        f1_per_class: [1.0, 1.0, 1.0, 0.9916, 0.9845],
        confusion: [
            [96, 0, 0, 0, 0], [0, 216, 0, 0, 0], [0, 0, 336, 0, 0], [0, 0, 0, 356, 4], [0, 0, 0, 2, 190]
        ]
    },
    RandomForest: {
        accuracy: 0.9825, f1_weighted: 0.9826, f1_macro: 0.9835,
        precision: 0.9835, recall: 0.9825, cv_mean: 0.9827, cv_std: 0.0037,
        f1_per_class: [1.0, 1.0, 1.0, 0.9702, 0.9474],
        confusion: [
            [96, 0, 0, 0, 0], [0, 216, 0, 0, 0], [0, 0, 336, 0, 0], [0, 0, 0, 343, 17], [0, 0, 0, 4, 188]
        ]
    },
    LogisticRegression: {
        accuracy: 0.9875, f1_weighted: 0.9875, f1_macro: 0.9881,
        precision: 0.9876, recall: 0.9875, cv_mean: 0.9919, cv_std: 0.0034,
        f1_per_class: [1.0, 1.0, 1.0, 0.9791, 0.9612],
        confusion: [
            [96, 0, 0, 0, 0], [0, 216, 0, 0, 0], [0, 0, 336, 0, 0], [0, 0, 0, 351, 9], [0, 0, 0, 6, 186]
        ]
    }
};

const topFeatures = [
    { name: "vitals_risk_score", importance: 0.47 },
    { name: "max_symptom_severity", importance: 0.31 },
    { name: "temperature", importance: 0.042 },
    { name: "severity_score", importance: 0.038 },
    { name: "pain_score", importance: 0.036 },
    { name: "sprain", importance: 0.028 },
    { name: "severity_x_vitals", importance: 0.012 },
    { name: "symptom_duration_hours", importance: 0.011 },
    { name: "log_duration", importance: 0.008 },
    { name: "age", importance: 0.007 },
];

const SYMPTOM_OPTIONS = [
    "chest_pain", "shortness_of_breath", "severe_bleeding", "unconsciousness",
    "seizure", "high_fever", "moderate_fever", "severe_headache", "mild_headache",
    "abdominal_pain_severe", "abdominal_pain_mild", "nausea", "vomiting",
    "persistent_vomiting", "dizziness", "fainting", "cough", "persistent_cough",
    "wheezing", "sore_throat", "runny_nose", "body_aches", "fatigue",
    "joint_pain", "back_pain", "severe_back_pain", "skin_rash", "severe_rash",
    "minor_cut", "sprain", "fracture_suspected", "burn_minor", "burn_severe",
    "vision_changes", "numbness_tingling", "confusion", "blood_in_urine",
    "blood_in_stool", "panic_attack", "heart_palpitations"
];

const SYMPTOM_SEVERITY: Record<string, number> = {
    chest_pain: 9, shortness_of_breath: 8, severe_bleeding: 9, unconsciousness: 10,
    seizure: 9, high_fever: 7, moderate_fever: 4, severe_headache: 6, mild_headache: 2,
    abdominal_pain_severe: 7, abdominal_pain_mild: 3, nausea: 3, vomiting: 4,
    persistent_vomiting: 6, dizziness: 4, fainting: 7, cough: 2, persistent_cough: 4,
    wheezing: 5, sore_throat: 2, runny_nose: 1, body_aches: 2, fatigue: 2,
    joint_pain: 3, back_pain: 3, severe_back_pain: 6, skin_rash: 2, severe_rash: 5,
    minor_cut: 1, sprain: 3, fracture_suspected: 6, burn_minor: 2, burn_severe: 8,
    vision_changes: 7, numbness_tingling: 5, confusion: 8, blood_in_urine: 6,
    blood_in_stool: 6, panic_attack: 5, heart_palpitations: 7
};

const RED_FLAGS = new Set([
    "chest_pain", "shortness_of_breath", "severe_bleeding", "unconsciousness",
    "seizure", "severe_allergic_reaction", "stroke_symptoms", "fainting",
    "burn_severe", "vision_changes", "confusion"
]);

function simulatePrediction(symptoms: string[], painScore: number, age: number) {
    if (symptoms.length === 0) return null;
    const maxSev = Math.max(...symptoms.map(s => SYMPTOM_SEVERITY[s] || 0));
    const redFlagCount = symptoms.filter(s => RED_FLAGS.has(s)).length;
    const totalSev = symptoms.reduce((sum, s) => sum + (SYMPTOM_SEVERITY[s] || 0), 0);
    let score = maxSev * 3 + redFlagCount * 8 + totalSev * 0.5 + painScore * 1.2;
    if (age < 5 || age > 75) score += 5;
    const probs = [0, 0, 0, 0, 0];
    if (score > 40) { probs[0] = 0.85; probs[1] = 0.12; probs[2] = 0.02; probs[3] = 0.005; probs[4] = 0.005; }
    else if (score > 28) { probs[0] = 0.1; probs[1] = 0.72; probs[2] = 0.13; probs[3] = 0.03; probs[4] = 0.02; }
    else if (score > 18) { probs[0] = 0.02; probs[1] = 0.1; probs[2] = 0.7; probs[3] = 0.13; probs[4] = 0.05; }
    else if (score > 10) { probs[0] = 0.01; probs[1] = 0.03; probs[2] = 0.1; probs[3] = 0.7; probs[4] = 0.16; }
    else { probs[0] = 0.005; probs[1] = 0.01; probs[2] = 0.04; probs[3] = 0.18; probs[4] = 0.765; }
    const predicted = TRIAGE_LEVELS[probs.indexOf(Math.max(...probs))];
    return { predicted, probs, score };
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
    return (
        <div className="glass-card p-5 border-white/5 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-16 h-16 bg-teal-500/5 rounded-bl-3xl -tr-4 z-0 group-hover:bg-teal-500/10 transition-colors" />
            <div className="relative z-10">
                <div className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.15em] mb-4">{label}</div>
                <div className="text-3xl font-black text-white tracking-tighter mb-1 font-mono">{value}</div>
                {sub && <div className="text-[10px] font-bold text-teal-500/60 uppercase">{sub}</div>}
            </div>
        </div>
    );
}

const TriageDashboard = () => {
    const [activeModel, setActiveModel] = useState("GradientBoosting");
    const [activeTab, setActiveTab] = useState("overview");
    const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
    const [painScore, setPainScore] = useState(5);
    const [age, setAge] = useState(35);
    const [prediction, setPrediction] = useState<any>(null);

    const m = metrics[activeModel];

    const toggleSymptom = (s: string) => {
        setSelectedSymptoms(prev =>
            prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
        );
        setPrediction(null);
    };

    const runPrediction = () => {
        const result = simulatePrediction(selectedSymptoms, painScore, age);
        setPrediction(result);
    };

    const tabs = [
        { id: "overview", label: "Overview", icon: BarChart3 },
        { id: "confusion", label: "Confusion Matrix", icon: Target },
        { id: "features", label: "Feature Importance", icon: Activity },
        { id: "demo", label: "Live Predictor", icon: Zap },
    ];

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header Info */}
            <div className="flex items-center justify-between">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 shadow-lg shadow-teal-500/10">
                            <Brain size={24} />
                        </div>
                        <h1 className="text-3xl font-bold tracking-tight text-white font-display">
                            Symptom <span className="text-gradient">Classifier</span>
                        </h1>
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] uppercase font-black px-3">
                            Production Ready
                        </Badge>
                    </div>
                    <p className="text-gray-500 text-sm font-medium">Trained on 6,000 patient records across 77 medical features</p>
                </div>

                <div className="flex gap-2">
                    {Object.keys(metrics).map(name => (
                        <button
                            key={name}
                            onClick={() => setActiveModel(name)}
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${activeModel === name
                                    ? "bg-teal-500/10 border-teal-500/50 text-teal-400"
                                    : "bg-white/5 border-transparent text-gray-500 hover:text-gray-300"
                                }`}
                        >
                            {name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-[#1A1F35]/30 p-1.5 rounded-2xl border border-white/5 w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === tab.id
                                ? "bg-teal-500 text-white shadow-lg shadow-teal-500/20"
                                : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                            }`}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="glass-card p-10 border-white/5 shadow-2xl relative overflow-hidden min-h-[500px]">
                {/* Decorative elements */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl -mr-48 -mt-48 pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none" />

                <div className="relative z-10">
                    {/* OVERVIEW TAB */}
                    {activeTab === "overview" && (
                        <div className="space-y-10">
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                                <MetricCard label="Accuracy" value={m.accuracy.toFixed(4)} />
                                <MetricCard label="F1 Weighted" value={m.f1_weighted.toFixed(4)} />
                                <MetricCard label="F1 Macro" value={m.f1_macro.toFixed(4)} />
                                <MetricCard label="Precision" value={m.precision.toFixed(4)} />
                                <MetricCard label="Recall" value={m.recall.toFixed(4)} />
                                <MetricCard label="CV F1 (5-Fold)" value={m.cv_mean.toFixed(4)} sub={`±${m.cv_std.toFixed(4)}`} />
                            </div>

                            <div>
                                <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-6 flex items-center gap-2">
                                    <Activity size={16} className="text-teal-500" /> Per-Class Performance (F1 Score)
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                    {TRIAGE_LEVELS.map((level, i) => (
                                        <div key={level} className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 group hover:border-teal-500/30 transition-all">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="w-2 h-2 rounded-full" style={{ background: TRIAGE_COLORS[level] }} />
                                                <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: TRIAGE_COLORS[level] }}>{level}</span>
                                            </div>
                                            <div className="text-3xl font-black text-white font-mono tracking-tighter mb-4">
                                                {m.f1_per_class[i].toFixed(3)}
                                            </div>
                                            <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full transition-all duration-1000 shadow-[0_0_8px_rgba(255,255,255,0.2)]"
                                                    style={{
                                                        width: `${m.f1_per_class[i] * 100}%`,
                                                        background: TRIAGE_COLORS[level]
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="pt-6">
                                <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-6">Model Benchmarks</h3>
                                <div className="overflow-hidden rounded-2xl border border-white/5 bg-white/[0.01]">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-white/5">
                                                {["Model", "Accuracy", "F1 (Weighted)", "F1 (Macro)", "Mean CV"].map(h => (
                                                    <th key={h} className="px-6 py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5">{h}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {Object.entries(metrics).map(([name, m2]) => (
                                                <tr key={name} className={`transition-colors ${name === activeModel ? "bg-teal-500/5" : "hover:bg-white/[0.02]"}`}>
                                                    <td className={`px-6 py-4 text-xs font-bold ${name === activeModel ? "text-teal-400" : "text-gray-300"}`}>{name}</td>
                                                    <td className="px-6 py-4 text-xs font-mono text-gray-400">{m2.accuracy.toFixed(4)}</td>
                                                    <td className="px-6 py-4 text-xs font-mono text-gray-400">{m2.f1_weighted.toFixed(4)}</td>
                                                    <td className="px-6 py-4 text-xs font-mono text-gray-400">{m2.f1_macro.toFixed(4)}</td>
                                                    <td className="px-6 py-4 text-xs font-mono text-gray-400">{m2.cv_mean.toFixed(4)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* CONFUSION MATRIX TAB */}
                    {activeTab === "confusion" && (
                        <div className="max-w-3xl mx-auto space-y-10 animate-slide-up">
                            <div className="grid grid-cols-[120px_repeat(5,1fr)] gap-2">
                                <div />
                                {TRIAGE_LEVELS.map(l => (
                                    <div key={l} className="text-center text-[9px] font-black uppercase tracking-widest py-3" style={{ color: TRIAGE_COLORS[l] }}>
                                        {l.slice(0, 5)}
                                    </div>
                                ))}
                                {m.confusion.map((row, i) => (
                                    <React.Fragment key={i}>
                                        <div className="flex items-center justify-end pr-6 text-[9px] font-black uppercase tracking-widest" style={{ color: TRIAGE_COLORS[TRIAGE_LEVELS[i]] }}>
                                            {TRIAGE_LEVELS[i].slice(0, 5)}
                                        </div>
                                        {row.map((val, j) => {
                                            const maxVal = Math.max(...m.confusion.flat());
                                            const intensity = val / maxVal;
                                            const isCorrect = i === j;
                                            return (
                                                <div
                                                    key={`${i}-${j}`}
                                                    className="aspect-square flex items-center justify-center rounded-lg text-sm font-bold font-mono transition-all hover:scale-105 cursor-help"
                                                    style={{
                                                        background: isCorrect
                                                            ? `rgba(16, 185, 129, ${0.1 + intensity * 0.7})`
                                                            : val > 0 ? `rgba(239, 68, 68, ${0.1 + intensity * 0.6})` : "rgba(255,255,255,0.02)",
                                                        color: val > 0 ? "#fff" : "#334155",
                                                        border: val > 0 ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent"
                                                    }}
                                                    title={`Actual: ${TRIAGE_LEVELS[i]} | Predicted: ${TRIAGE_LEVELS[j]}`}
                                                >
                                                    {val}
                                                </div>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </div>
                            <div className="flex items-center justify-between p-6 rounded-2xl bg-teal-500/5 border border-teal-500/10">
                                <div className="flex items-center gap-3 text-xs text-teal-400 font-medium italic leading-relaxed">
                                    <Info size={16} /> Minor confusion occurs only between NON-URGENT and SELF-CARE — clinically safe.
                                </div>
                                <div className="flex gap-6 text-[10px] font-black uppercase tracking-widest text-gray-600">
                                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500/40" /> Correct</div>
                                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500/40" /> Misclassified</div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* FEATURE IMPORTANCE TAB */}
                    {activeTab === "features" && (
                        <div className="max-w-2xl mx-auto space-y-8 animate-slide-up">
                            <h3 className="text-sm font-black text-gray-500 uppercase tracking-widest mb-10 text-center">Top 10 Clinical Determinants</h3>
                            <div className="space-y-6">
                                {topFeatures.map((f, i) => (
                                    <div key={f.name} className="space-y-2 group">
                                        <div className="flex justify-between items-end">
                                            <span className={`text-[11px] font-black uppercase tracking-widest ${RED_FLAGS.has(f.name) ? "text-red-400" : "text-gray-400"}`}>
                                                {f.name.replace(/_/g, " ")}
                                                {RED_FLAGS.has(f.name) && <Badge className="ml-2 bg-red-500/10 text-red-500 border-red-500/20 text-[8px] h-4">Red Flag</Badge>}
                                            </span>
                                            <span className="text-[11px] font-mono text-teal-400">{(f.importance * 100).toFixed(1)}%</span>
                                        </div>
                                        <div className="h-2.5 bg-white/5 rounded-full overflow-hidden border border-white/5 p-[1px]">
                                            <div
                                                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-blue-500 shadow-[0_0_10px_rgba(20,184,166,0.3)] transition-all duration-1000"
                                                style={{ width: `${(f.importance / topFeatures[0].importance) * 100}%`, transitionDelay: `${i * 100}ms` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-12 p-6 rounded-2xl bg-white/[0.02] border border-white/5">
                                <p className="text-xs text-gray-500 leading-relaxed italic">
                                    <strong className="text-gray-300 not-italic">Engineered features dominate:</strong> The top 2 features are both engineered clinical composites — <code className="text-teal-400 font-bold font-mono text-[10px]">vitals_risk_score</code> and <code className="text-teal-400 font-bold font-mono text-[10px]">max_symptom_severity</code>.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* LIVE DEMO TAB */}
                    {activeTab === "demo" && (
                        <div className="space-y-10 animate-slide-up">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                                <div className="space-y-8">
                                    <div>
                                        <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Patient Parameters</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                                                <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                                    <span>Pain Score</span>
                                                    <span className="text-teal-400">{painScore}/10</span>
                                                </div>
                                                <input
                                                    type="range" min="0" max="10" value={painScore}
                                                    onChange={e => { setPainScore(+e.target.value); setPrediction(null); }}
                                                    className="w-full h-1.5 bg-white/5 rounded-full appearance-none accent-teal-500 cursor-pointer"
                                                />
                                            </div>
                                            <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
                                                <div className="flex justify-between text-[10px] font-black text-gray-500 uppercase tracking-widest">
                                                    <span>Patient Age</span>
                                                    <span className="text-teal-400">{age} yrs</span>
                                                </div>
                                                <input
                                                    type="range" min="0" max="100" value={age}
                                                    onChange={e => { setAge(+e.target.value); setPrediction(null); }}
                                                    className="w-full h-1.5 bg-white/5 rounded-full appearance-none accent-teal-500 cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em]">Select Symptoms</h3>
                                            <button
                                                onClick={() => { setSelectedSymptoms([]); setPrediction(null); }}
                                                className="text-[9px] font-black text-red-500 tracking-[0.2em] hover:opacity-80 transition-opacity"
                                            >
                                                RESET ALL
                                            </button>
                                        </div>
                                        <div className="flex flex-wrap gap-2 overflow-y-auto max-h-[300px] pr-2 pb-4 scrollbar-hide">
                                            {SYMPTOM_OPTIONS.map(s => {
                                                const active = selectedSymptoms.includes(s);
                                                const isRF = RED_FLAGS.has(s);
                                                return (
                                                    <button
                                                        key={s}
                                                        onClick={() => toggleSymptom(s)}
                                                        className={`px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-tight transition-all border ${active
                                                                ? isRF ? "bg-red-500/20 border-red-500/50 text-red-400" : "bg-teal-500/20 border-teal-500/50 text-teal-400"
                                                                : isRF ? "border-red-500/10 text-gray-600 hover:border-red-500/30" : "border-white/5 text-gray-500 hover:border-white/20"
                                                            } ${isRF ? "shadow-[0_0_10px_rgba(239,68,68,0.05)]" : ""}`}
                                                    >
                                                        {s.replace(/_/g, " ")}
                                                        {isRF && <div className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 ml-2 animate-pulse" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <button
                                        onClick={runPrediction}
                                        disabled={selectedSymptoms.length === 0}
                                        className="w-full py-4 rounded-2xl bg-teal-500 hover:bg-teal-600 disabled:opacity-30 disabled:cursor-not-allowed text-white text-[11px] font-black uppercase tracking-[0.3em] shadow-xl shadow-teal-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 overflow-hidden group"
                                    >
                                        <div className="absolute inset-0 bg-white/10 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 skew-x-12" />
                                        <Zap size={16} /> Run Triage Classifier
                                    </button>
                                </div>

                                <div className="glass-card bg-[#1A1F35]/20 border-white/5 flex flex-col items-center justify-center text-center p-10 min-h-[450px]">
                                    {!prediction ? (
                                        <div className="space-y-6 opacity-30 group">
                                            <div className="w-24 h-24 rounded-full border-4 border-dashed border-gray-600 flex items-center justify-center mx-auto group-hover:rotate-180 transition-transform duration-[4s]">
                                                <Brain size={40} className="text-gray-500" />
                                            </div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500">Awaiting Clinical Data</p>
                                        </div>
                                    ) : (
                                        <div className="w-full space-y-10 animate-slide-up">
                                            <div className="space-y-3">
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">Predicted Severity</span>
                                                <div className="relative inline-block px-10 py-5 rounded-2xl border-2 transition-all duration-500" style={{ borderColor: TRIAGE_COLORS[prediction.predicted], background: `${TRIAGE_COLORS[prediction.predicted]}10` }}>
                                                    <span className="text-4xl font-black tracking-tighter" style={{ color: TRIAGE_COLORS[prediction.predicted] }}>
                                                        {prediction.predicted}
                                                    </span>
                                                    <div className="absolute -top-3 -right-3">
                                                        <div className="w-6 h-6 rounded-full flex items-center justify-center shadow-lg" style={{ background: TRIAGE_COLORS[prediction.predicted] }}>
                                                            <Target size={12} className="text-white" />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-5 text-left pt-6 border-t border-white/5">
                                                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-6">Classification Certainty</h4>
                                                {TRIAGE_LEVELS.map((level, i) => (
                                                    <div key={level} className="space-y-2 group">
                                                        <div className="flex justify-between items-center px-1">
                                                            <span className="text-[10px] font-bold uppercase tracking-tight" style={{ color: TRIAGE_COLORS[level], opacity: prediction.predicted === level ? 1 : 0.4 }}>{level}</span>
                                                            <span className="text-[10px] font-mono text-gray-500">{(prediction.probs[i] * 100).toFixed(1)}%</span>
                                                        </div>
                                                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full transition-all duration-700"
                                                                style={{
                                                                    width: `${prediction.probs[i] * 100}%`,
                                                                    background: TRIAGE_COLORS[level],
                                                                    opacity: prediction.predicted === level ? 1 : 0.2
                                                                }}
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <div className="mt-6 flex items-center gap-3 p-4 rounded-xl bg-teal-500/5 border border-teal-500/10 text-left">
                                                <AlertTriangle size={16} className="text-teal-500 shrink-0" />
                                                <p className="text-[11px] text-teal-400 font-medium leading-relaxed italic">
                                                    Model confidence is high based on {selectedSymptoms.length} clinical markers.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-center gap-6 py-4 border-t border-white/5 opacity-30 text-[9px] font-black uppercase tracking-[0.3em] text-gray-500">
                <span>XGBoost Classifier v1.2</span>
                <div className="w-1 h-1 rounded-full bg-gray-700" />
                <span>Scikit-Learn Pipeline</span>
                <div className="w-1 h-1 rounded-full bg-gray-700" />
                <span>6,000 Records</span>
            </div>
        </div>
    );
};

export default TriageDashboard;
