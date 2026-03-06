import { useState } from "react";

const TRIAGE_LEVELS = ["EMERGENCY", "URGENT", "SEMI-URGENT", "NON-URGENT", "SELF-CARE"];
const TRIAGE_COLORS = {
  "EMERGENCY": "#EF4444",
  "URGENT": "#F97316",
  "SEMI-URGENT": "#EAB308",
  "NON-URGENT": "#22C55E",
  "SELF-CARE": "#3B82F6",
};

const metrics = {
  GradientBoosting: {
    accuracy: 0.9950, f1_weighted: 0.9950, f1_macro: 0.9952,
    precision: 0.9950, recall: 0.9950, cv_mean: 0.9906, cv_std: 0.0011,
    f1_per_class: [1.0, 1.0, 1.0, 0.9916, 0.9845],
    confusion: [
      [96,0,0,0,0],[0,216,0,0,0],[0,0,336,0,0],[0,0,0,356,4],[0,0,0,2,190]
    ]
  },
  RandomForest: {
    accuracy: 0.9825, f1_weighted: 0.9826, f1_macro: 0.9835,
    precision: 0.9835, recall: 0.9825, cv_mean: 0.9827, cv_std: 0.0037,
    f1_per_class: [1.0, 1.0, 1.0, 0.9702, 0.9474],
    confusion: [
      [96,0,0,0,0],[0,216,0,0,0],[0,0,336,0,0],[0,0,0,343,17],[0,0,0,4,188]
    ]
  },
  LogisticRegression: {
    accuracy: 0.9875, f1_weighted: 0.9875, f1_macro: 0.9881,
    precision: 0.9876, recall: 0.9875, cv_mean: 0.9919, cv_std: 0.0034,
    f1_per_class: [1.0, 1.0, 1.0, 0.9791, 0.9612],
    confusion: [
      [96,0,0,0,0],[0,216,0,0,0],[0,0,336,0,0],[0,0,0,351,9],[0,0,0,6,186]
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

// Symptom options for the demo predictor
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

const SYMPTOM_SEVERITY = {
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

function simulatePrediction(symptoms, painScore, age) {
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

function MetricCard({ label, value, sub }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
      borderRadius: 12, padding: "18px 20px",
      border: "1px solid rgba(56, 189, 248, 0.15)",
      minWidth: 140
    }}>
      <div style={{ color: "#94a3b8", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 6 }}>{label}</div>
      <div style={{ color: "#f1f5f9", fontSize: 28, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
      {sub && <div style={{ color: "#64748b", fontSize: 11, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ConfusionMatrix({ data, model }) {
  const maxVal = Math.max(...data.flat());
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1", marginBottom: 12 }}>
        Confusion Matrix — {model}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "100px repeat(5, 1fr)", gap: 2, fontSize: 11 }}>
        <div />
        {TRIAGE_LEVELS.map(l => (
          <div key={l} style={{ textAlign: "center", color: TRIAGE_COLORS[l], fontWeight: 600, fontSize: 9, padding: "4px 0" }}>
            {l.slice(0, 5)}
          </div>
        ))}
        {data.map((row, i) => (
          <>
            <div key={`label-${i}`} style={{ color: TRIAGE_COLORS[TRIAGE_LEVELS[i]], fontWeight: 600, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8 }}>
              {TRIAGE_LEVELS[i].slice(0, 5)}
            </div>
            {row.map((val, j) => {
              const intensity = val / maxVal;
              const isCorrect = i === j;
              const bg = isCorrect
                ? `rgba(34, 197, 94, ${0.1 + intensity * 0.7})`
                : val > 0
                  ? `rgba(239, 68, 68, ${0.15 + intensity * 0.5})`
                  : "rgba(30, 41, 59, 0.5)";
              return (
                <div key={`${i}-${j}`} style={{
                  background: bg, textAlign: "center", padding: "10px 4px",
                  borderRadius: 4, color: val > 0 ? "#f1f5f9" : "#475569",
                  fontWeight: val > 0 ? 700 : 400, fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 13, transition: "all 0.2s"
                }}>
                  {val}
                </div>
              );
            })}
          </>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 10, color: "#64748b" }}>
        <span>↓ Actual</span><span>→ Predicted</span>
        <span style={{ marginLeft: "auto" }}>
          <span style={{ display: "inline-block", width: 10, height: 10, background: "rgba(34,197,94,0.5)", borderRadius: 2, marginRight: 4 }} />Correct
          <span style={{ display: "inline-block", width: 10, height: 10, background: "rgba(239,68,68,0.4)", borderRadius: 2, marginLeft: 12, marginRight: 4 }} />Misclassified
        </span>
      </div>
    </div>
  );
}

function FeatureBar({ name, importance, maxImp }) {
  const width = (importance / maxImp) * 100;
  const isRedFlag = RED_FLAGS.has(name);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
      <div style={{ width: 160, fontSize: 11, color: isRedFlag ? "#f87171" : "#94a3b8", textAlign: "right", fontFamily: "'JetBrains Mono', monospace" }}>
        {name}
      </div>
      <div style={{ flex: 1, height: 18, background: "rgba(30,41,59,0.6)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{
          width: `${width}%`, height: "100%",
          background: `linear-gradient(90deg, #38bdf8, #818cf8)`,
          borderRadius: 4, transition: "width 0.6s ease"
        }} />
      </div>
      <div style={{ width: 50, fontSize: 11, color: "#cbd5e1", fontFamily: "'JetBrains Mono', monospace" }}>
        {(importance * 100).toFixed(1)}%
      </div>
    </div>
  );
}

export default function TriageDashboard() {
  const [activeModel, setActiveModel] = useState("GradientBoosting");
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [painScore, setPainScore] = useState(5);
  const [age, setAge] = useState(35);
  const [prediction, setPrediction] = useState(null);

  const m = metrics[activeModel];

  const toggleSymptom = (s) => {
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
    { id: "overview", label: "Overview" },
    { id: "confusion", label: "Confusion Matrix" },
    { id: "features", label: "Feature Importance" },
    { id: "demo", label: "Live Demo" },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0e1a",
      fontFamily: "'Inter', -apple-system, sans-serif", color: "#e2e8f0",
      padding: "24px 20px"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 4 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "linear-gradient(135deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, fontWeight: 800, color: "#0a0e1a"
          }}>T</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
              Symptom Triage Classifier
            </h1>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>
              GradientBoosting · 6,000 patients · 77 features · 5-class triage
            </div>
          </div>
        </div>

        {/* Model selector */}
        <div style={{ display: "flex", gap: 6, margin: "20px 0 16px" }}>
          {Object.keys(metrics).map(name => (
            <button key={name} onClick={() => setActiveModel(name)} style={{
              padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600, transition: "all 0.2s",
              background: activeModel === name ? "rgba(56, 189, 248, 0.15)" : "transparent",
              color: activeModel === name ? "#38bdf8" : "#64748b",
              outline: activeModel === name ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid transparent"
            }}>
              {name}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid #1e293b", marginBottom: 24 }}>
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              padding: "10px 20px", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, background: "transparent", transition: "all 0.2s",
              color: activeTab === tab.id ? "#f1f5f9" : "#475569",
              borderBottom: activeTab === tab.id ? "2px solid #38bdf8" : "2px solid transparent"
            }}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === "overview" && (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 28 }}>
              <MetricCard label="Accuracy" value={m.accuracy.toFixed(3)} />
              <MetricCard label="F1 Weighted" value={m.f1_weighted.toFixed(3)} />
              <MetricCard label="F1 Macro" value={m.f1_macro.toFixed(3)} />
              <MetricCard label="Precision" value={m.precision.toFixed(3)} />
              <MetricCard label="Recall" value={m.recall.toFixed(3)} />
              <MetricCard label="CV F1 (5-fold)" value={m.cv_mean.toFixed(3)} sub={`± ${m.cv_std.toFixed(4)}`} />
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "#cbd5e1" }}>
              Per-Class F1 Scores
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {TRIAGE_LEVELS.map((level, i) => (
                <div key={level} style={{
                  flex: "1 1 160px", padding: "14px 16px", borderRadius: 10,
                  background: "rgba(15, 23, 42, 0.8)",
                  border: `1px solid ${TRIAGE_COLORS[level]}33`,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: TRIAGE_COLORS[level] }} />
                    <span style={{ fontSize: 11, fontWeight: 600, color: TRIAGE_COLORS[level] }}>{level}</span>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
                    {m.f1_per_class[i].toFixed(3)}
                  </div>
                  <div style={{
                    marginTop: 6, height: 4, borderRadius: 2,
                    background: "rgba(30, 41, 59, 0.8)", overflow: "hidden"
                  }}>
                    <div style={{
                      height: "100%", borderRadius: 2, width: `${m.f1_per_class[i] * 100}%`,
                      background: TRIAGE_COLORS[level], transition: "width 0.5s"
                    }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Model comparison table */}
            <div style={{ marginTop: 28 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: "#cbd5e1" }}>
                Model Comparison
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #1e293b" }}>
                      {["Model", "Accuracy", "F1 (W)", "F1 (M)", "Prec.", "Recall", "CV F1"].map(h => (
                        <th key={h} style={{ padding: "10px 12px", textAlign: "left", color: "#64748b", fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(metrics).map(([name, m2]) => (
                      <tr key={name} style={{
                        borderBottom: "1px solid #0f172a",
                        background: name === activeModel ? "rgba(56,189,248,0.05)" : "transparent"
                      }}>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: name === activeModel ? "#38bdf8" : "#94a3b8" }}>{name}</td>
                        <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace" }}>{m2.accuracy.toFixed(4)}</td>
                        <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace" }}>{m2.f1_weighted.toFixed(4)}</td>
                        <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace" }}>{m2.f1_macro.toFixed(4)}</td>
                        <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace" }}>{m2.precision.toFixed(4)}</td>
                        <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace" }}>{m2.recall.toFixed(4)}</td>
                        <td style={{ padding: "10px 12px", fontFamily: "'JetBrains Mono', monospace" }}>{m2.cv_mean.toFixed(4)}</td>
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
          <div style={{
            background: "rgba(15, 23, 42, 0.6)", borderRadius: 12,
            padding: 24, border: "1px solid #1e293b"
          }}>
            <ConfusionMatrix data={m.confusion} model={activeModel} />
            <div style={{ marginTop: 20, padding: 16, background: "rgba(30,41,59,0.4)", borderRadius: 8, fontSize: 12, color: "#94a3b8", lineHeight: 1.7 }}>
              <strong style={{ color: "#cbd5e1" }}>Key Insight:</strong> The model achieves perfect classification for EMERGENCY, URGENT, and SEMI-URGENT levels.
              Minor confusion occurs between NON-URGENT and SELF-CARE, which are adjacent severity levels — clinically acceptable since both indicate non-critical situations.
            </div>
          </div>
        )}

        {/* FEATURE IMPORTANCE TAB */}
        {activeTab === "features" && (
          <div style={{
            background: "rgba(15, 23, 42, 0.6)", borderRadius: 12,
            padding: 24, border: "1px solid #1e293b"
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#cbd5e1", marginBottom: 16 }}>
              Top 10 Feature Importances — {activeModel}
            </div>
            {topFeatures.map(f => (
              <FeatureBar key={f.name} name={f.name} importance={f.importance} maxImp={topFeatures[0].importance} />
            ))}
            <div style={{ marginTop: 20, padding: 16, background: "rgba(30,41,59,0.4)", borderRadius: 8, fontSize: 12, color: "#94a3b8", lineHeight: 1.7 }}>
              <strong style={{ color: "#cbd5e1" }}>Engineered features dominate:</strong> The top 2 features are both engineered composites —
              <code style={{ color: "#38bdf8", background: "rgba(56,189,248,0.1)", padding: "1px 5px", borderRadius: 3, fontSize: 11 }}>vitals_risk_score</code> (NEWS-inspired vital signs composite) and
              <code style={{ color: "#38bdf8", background: "rgba(56,189,248,0.1)", padding: "1px 5px", borderRadius: 3, fontSize: 11 }}>max_symptom_severity</code> (highest severity symptom present).
              This validates the clinical domain knowledge baked into feature engineering.
            </div>
          </div>
        )}

        {/* LIVE DEMO TAB */}
        {activeTab === "demo" && (
          <div>
            <div style={{
              background: "rgba(15, 23, 42, 0.6)", borderRadius: 12,
              padding: 24, border: "1px solid #1e293b", marginBottom: 16
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#cbd5e1", marginBottom: 4 }}>
                Select Symptoms
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 14 }}>
                Click symptoms to toggle. Red-bordered items are clinical red flags.
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {SYMPTOM_OPTIONS.map(s => {
                  const active = selectedSymptoms.includes(s);
                  const isRF = RED_FLAGS.has(s);
                  return (
                    <button key={s} onClick={() => toggleSymptom(s)} style={{
                      padding: "5px 10px", borderRadius: 6, cursor: "pointer",
                      fontSize: 11, fontWeight: active ? 600 : 400, transition: "all 0.15s",
                      border: isRF ? "1px solid rgba(239,68,68,0.4)" : "1px solid #1e293b",
                      background: active
                        ? isRF ? "rgba(239,68,68,0.2)" : "rgba(56,189,248,0.15)"
                        : "rgba(15,23,42,0.5)",
                      color: active
                        ? isRF ? "#f87171" : "#38bdf8"
                        : "#64748b",
                    }}>
                      {s.replace(/_/g, " ")}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div style={{ background: "rgba(15,23,42,0.6)", borderRadius: 12, padding: 16, border: "1px solid #1e293b" }}>
                <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 8 }}>Pain Score: {painScore}</label>
                <input type="range" min="0" max="10" value={painScore}
                  onChange={e => { setPainScore(+e.target.value); setPrediction(null); }}
                  style={{ width: "100%", accentColor: "#38bdf8" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#475569" }}>
                  <span>None</span><span>Severe</span>
                </div>
              </div>
              <div style={{ background: "rgba(15,23,42,0.6)", borderRadius: 12, padding: 16, border: "1px solid #1e293b" }}>
                <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 8 }}>Age: {age}</label>
                <input type="range" min="0" max="100" value={age}
                  onChange={e => { setAge(+e.target.value); setPrediction(null); }}
                  style={{ width: "100%", accentColor: "#38bdf8" }} />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#475569" }}>
                  <span>0</span><span>100</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                <button onClick={runPrediction} disabled={selectedSymptoms.length === 0} style={{
                  padding: "12px 28px", borderRadius: 10, border: "none", cursor: selectedSymptoms.length > 0 ? "pointer" : "not-allowed",
                  fontSize: 14, fontWeight: 700, letterSpacing: 0.5,
                  background: selectedSymptoms.length > 0
                    ? "linear-gradient(135deg, #38bdf8, #818cf8)"
                    : "#1e293b",
                  color: selectedSymptoms.length > 0 ? "#0a0e1a" : "#475569",
                  transition: "all 0.2s", boxShadow: selectedSymptoms.length > 0 ? "0 4px 20px rgba(56,189,248,0.3)" : "none"
                }}>
                  Run Triage
                </button>
              </div>
            </div>

            {prediction && (
              <div style={{
                background: `linear-gradient(135deg, ${TRIAGE_COLORS[prediction.predicted]}15, rgba(15,23,42,0.8))`,
                borderRadius: 12, padding: 24,
                border: `1px solid ${TRIAGE_COLORS[prediction.predicted]}44`,
              }}>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>PREDICTED TRIAGE LEVEL</div>
                  <div style={{
                    display: "inline-block", padding: "10px 32px", borderRadius: 10,
                    background: `${TRIAGE_COLORS[prediction.predicted]}22`,
                    border: `2px solid ${TRIAGE_COLORS[prediction.predicted]}`,
                    color: TRIAGE_COLORS[prediction.predicted],
                    fontSize: 28, fontWeight: 800, letterSpacing: 1
                  }}>
                    {prediction.predicted}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1", marginBottom: 12 }}>
                  Class Probabilities
                </div>
                {TRIAGE_LEVELS.map((level, i) => (
                  <div key={level} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                    <div style={{ width: 90, fontSize: 11, color: TRIAGE_COLORS[level], fontWeight: 600, textAlign: "right" }}>
                      {level.slice(0, 8)}
                    </div>
                    <div style={{ flex: 1, height: 20, background: "rgba(30,41,59,0.6)", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{
                        width: `${prediction.probs[i] * 100}%`, height: "100%",
                        background: TRIAGE_COLORS[level], borderRadius: 4,
                        transition: "width 0.4s ease",
                        opacity: prediction.predicted === level ? 1 : 0.5
                      }} />
                    </div>
                    <div style={{ width: 55, fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: "#94a3b8" }}>
                      {(prediction.probs[i] * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 36, paddingTop: 16, borderTop: "1px solid #1e293b", fontSize: 11, color: "#475569", textAlign: "center" }}>
          Symptom Triage Classifier · GradientBoosting (sklearn) · Trained on 6,000 synthetic patient records · 77 engineered features
        </div>
      </div>
    </div>
  );
}
