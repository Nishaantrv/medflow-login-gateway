"""
=============================================================================
  SYMPTOM TRIAGE CLASSIFIER — AI Medical Triage System
=============================================================================
  Replaces GPT-4o for triage with a trained ML model (GradientBoosting/XGBoost)
  
  Pipeline:
    1. Synthetic medical data generation (realistic symptom profiles)
    2. Feature engineering (symptom encoding, risk scoring, interaction features)
    3. Multi-model training (GradientBoosting, RandomForest, LogisticRegression)
    4. Comprehensive evaluation (confusion matrix, F1, precision, recall, ROC-AUC)
    5. Model export for production deployment
  
  Triage Levels:
    - EMERGENCY (Red)    : Life-threatening, immediate attention
    - URGENT (Orange)    : Serious, needs prompt care  
    - SEMI-URGENT (Yellow): Moderate, can wait briefly
    - NON-URGENT (Green) : Minor, routine care appropriate
    - SELF-CARE (Blue)   : Home management sufficient
=============================================================================
"""

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import json
import pickle
import os
import warnings
warnings.filterwarnings('ignore')

from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import (
    classification_report, confusion_matrix, f1_score,
    precision_score, recall_score, accuracy_score,
    roc_auc_score, roc_curve, auc
)
from sklearn.calibration import CalibratedClassifierCV
from sklearn.pipeline import Pipeline
from sklearn.utils.class_weight import compute_class_weight

# ─── Output directories ─────────────────────────────────────────────────────
OUTPUT_DIR = "/home/claude/triage_output"
os.makedirs(OUTPUT_DIR, exist_ok=True)

RANDOM_STATE = 42
np.random.seed(RANDOM_STATE)

# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 1: MEDICAL KNOWLEDGE BASE & SYNTHETIC DATA GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

# Master symptom registry with medical severity weights
SYMPTOM_REGISTRY = {
    # Symptom: (base_severity 0-10, is_red_flag)
    "chest_pain": (9, True),
    "shortness_of_breath": (8, True),
    "severe_bleeding": (9, True),
    "unconsciousness": (10, True),
    "seizure": (9, True),
    "severe_allergic_reaction": (9, True),
    "stroke_symptoms": (10, True),
    "heart_palpitations": (7, False),
    "high_fever": (7, False),
    "moderate_fever": (4, False),
    "low_fever": (2, False),
    "severe_headache": (6, False),
    "mild_headache": (2, False),
    "abdominal_pain_severe": (7, False),
    "abdominal_pain_mild": (3, False),
    "nausea": (3, False),
    "vomiting": (4, False),
    "persistent_vomiting": (6, False),
    "diarrhea": (3, False),
    "dizziness": (4, False),
    "fainting": (7, True),
    "cough": (2, False),
    "persistent_cough": (4, False),
    "wheezing": (5, False),
    "sore_throat": (2, False),
    "runny_nose": (1, False),
    "body_aches": (2, False),
    "fatigue": (2, False),
    "chronic_fatigue": (4, False),
    "joint_pain": (3, False),
    "back_pain": (3, False),
    "severe_back_pain": (6, False),
    "skin_rash": (2, False),
    "severe_rash": (5, False),
    "minor_cut": (1, False),
    "sprain": (3, False),
    "fracture_suspected": (6, False),
    "burn_minor": (2, False),
    "burn_severe": (8, True),
    "eye_pain": (4, False),
    "vision_changes": (7, True),
    "ear_pain": (3, False),
    "numbness_tingling": (5, False),
    "confusion": (8, True),
    "difficulty_swallowing": (5, False),
    "blood_in_urine": (6, False),
    "blood_in_stool": (6, False),
    "swollen_limb": (4, False),
    "insomnia": (2, False),
    "anxiety": (3, False),
    "panic_attack": (5, False),
}

ALL_SYMPTOMS = list(SYMPTOM_REGISTRY.keys())

TRIAGE_LEVELS = ["EMERGENCY", "URGENT", "SEMI-URGENT", "NON-URGENT", "SELF-CARE"]

# Symptom profiles that map to each triage level
TRIAGE_PROFILES = {
    "EMERGENCY": {
        "must_have_one_of": [
            ["chest_pain", "shortness_of_breath"],
            ["unconsciousness"],
            ["seizure"],
            ["stroke_symptoms"],
            ["severe_allergic_reaction"],
            ["severe_bleeding"],
            ["burn_severe", "confusion"],
            ["chest_pain", "numbness_tingling"],
            ["confusion", "high_fever"],
            ["shortness_of_breath", "heart_palpitations", "chest_pain"],
        ],
        "optional": ["dizziness", "nausea", "vomiting", "high_fever", "confusion", "fainting"],
        "age_range": (0, 100),
        "vital_sign_ranges": {
            "heart_rate": (120, 180),
            "systolic_bp": (60, 90),
            "temperature": (39.5, 41.5),
            "spo2": (80, 92),
            "respiratory_rate": (24, 40),
        },
    },
    "URGENT": {
        "must_have_one_of": [
            ["high_fever", "persistent_vomiting"],
            ["abdominal_pain_severe"],
            ["severe_headache", "vision_changes"],
            ["fracture_suspected"],
            ["blood_in_urine"],
            ["blood_in_stool"],
            ["severe_back_pain", "numbness_tingling"],
            ["wheezing", "shortness_of_breath"],
            ["high_fever", "severe_rash"],
            ["fainting", "dizziness"],
            ["heart_palpitations", "dizziness"],
            ["persistent_vomiting", "abdominal_pain_severe"],
        ],
        "optional": ["nausea", "fatigue", "body_aches", "dizziness", "moderate_fever", "anxiety"],
        "age_range": (0, 100),
        "vital_sign_ranges": {
            "heart_rate": (100, 130),
            "systolic_bp": (85, 105),
            "temperature": (38.5, 40.0),
            "spo2": (90, 95),
            "respiratory_rate": (20, 28),
        },
    },
    "SEMI-URGENT": {
        "must_have_one_of": [
            ["moderate_fever", "persistent_cough"],
            ["abdominal_pain_mild", "vomiting"],
            ["severe_headache"],
            ["severe_rash"],
            ["sprain"],
            ["eye_pain"],
            ["ear_pain", "moderate_fever"],
            ["chronic_fatigue", "joint_pain"],
            ["difficulty_swallowing", "sore_throat"],
            ["dizziness", "nausea"],
            ["back_pain", "numbness_tingling"],
            ["panic_attack"],
            ["swollen_limb"],
        ],
        "optional": ["fatigue", "body_aches", "nausea", "low_fever", "anxiety", "insomnia"],
        "age_range": (5, 95),
        "vital_sign_ranges": {
            "heart_rate": (80, 110),
            "systolic_bp": (100, 140),
            "temperature": (37.5, 39.0),
            "spo2": (94, 97),
            "respiratory_rate": (16, 22),
        },
    },
    "NON-URGENT": {
        "must_have_one_of": [
            ["cough", "runny_nose"],
            ["sore_throat"],
            ["mild_headache"],
            ["abdominal_pain_mild"],
            ["skin_rash"],
            ["back_pain"],
            ["joint_pain"],
            ["ear_pain"],
            ["low_fever", "body_aches"],
            ["diarrhea"],
            ["burn_minor"],
        ],
        "optional": ["fatigue", "runny_nose", "body_aches", "insomnia"],
        "age_range": (2, 90),
        "vital_sign_ranges": {
            "heart_rate": (65, 95),
            "systolic_bp": (110, 140),
            "temperature": (36.8, 38.0),
            "spo2": (96, 100),
            "respiratory_rate": (12, 20),
        },
    },
    "SELF-CARE": {
        "must_have_one_of": [
            ["runny_nose"],
            ["mild_headache"],
            ["minor_cut"],
            ["body_aches"],
            ["fatigue"],
            ["insomnia"],
            ["sore_throat"],
            ["cough"],
        ],
        "optional": ["fatigue", "runny_nose"],
        "age_range": (10, 70),
        "vital_sign_ranges": {
            "heart_rate": (60, 90),
            "systolic_bp": (110, 135),
            "temperature": (36.2, 37.5),
            "spo2": (97, 100),
            "respiratory_rate": (12, 18),
        },
    },
}

# Comorbidity profiles
COMORBIDITIES = [
    "diabetes", "hypertension", "asthma", "copd", "heart_disease",
    "kidney_disease", "liver_disease", "immunocompromised", "pregnancy", "none"
]


def generate_patient_record(triage_level, patient_id):
    """Generate a single realistic patient record for a given triage level."""
    profile = TRIAGE_PROFILES[triage_level]
    
    # Select symptom combo
    symptom_combo = profile["must_have_one_of"][
        np.random.randint(len(profile["must_have_one_of"]))
    ]
    
    # Add optional symptoms
    n_optional = np.random.randint(0, min(3, len(profile["optional"])) + 1)
    if n_optional > 0:
        optional_selected = list(np.random.choice(
            profile["optional"], size=n_optional, replace=False
        ))
        symptom_combo = list(set(symptom_combo + optional_selected))
    
    # Build symptom vector (binary)
    symptom_vector = {s: 0 for s in ALL_SYMPTOMS}
    for s in symptom_combo:
        if s in symptom_vector:
            symptom_vector[s] = 1
    
    # Demographics
    age_low, age_high = profile["age_range"]
    age = np.random.randint(age_low, age_high + 1)
    sex = np.random.choice([0, 1])  # 0=Female, 1=Male
    
    # Vital signs with noise
    vitals = {}
    for vital, (low, high) in profile["vital_sign_ranges"].items():
        base = np.random.uniform(low, high)
        noise = np.random.normal(0, (high - low) * 0.05)
        vitals[vital] = round(base + noise, 1)
    
    # Comorbidities (higher severity patients more likely to have them)
    severity_idx = TRIAGE_LEVELS.index(triage_level)
    comorbidity_prob = max(0.1, 0.5 - severity_idx * 0.08)
    has_comorbidity = np.random.random() < comorbidity_prob
    comorbidity = np.random.choice(COMORBIDITIES[:-1]) if has_comorbidity else "none"
    
    # Duration of symptoms in hours
    duration_ranges = {
        "EMERGENCY": (0.1, 6),
        "URGENT": (1, 48),
        "SEMI-URGENT": (6, 168),
        "NON-URGENT": (24, 336),
        "SELF-CARE": (12, 504),
    }
    dur_low, dur_high = duration_ranges[triage_level]
    symptom_duration_hours = round(np.random.uniform(dur_low, dur_high), 1)
    
    # Pain score (0-10)
    pain_ranges = {
        "EMERGENCY": (7, 10),
        "URGENT": (5, 9),
        "SEMI-URGENT": (3, 7),
        "NON-URGENT": (1, 5),
        "SELF-CARE": (0, 3),
    }
    p_low, p_high = pain_ranges[triage_level]
    pain_score = np.random.randint(p_low, p_high + 1)
    
    record = {
        "patient_id": patient_id,
        **symptom_vector,
        "age": age,
        "sex": sex,
        "heart_rate": vitals["heart_rate"],
        "systolic_bp": vitals["systolic_bp"],
        "temperature": vitals["temperature"],
        "spo2": vitals["spo2"],
        "respiratory_rate": vitals["respiratory_rate"],
        "comorbidity": comorbidity,
        "symptom_duration_hours": symptom_duration_hours,
        "pain_score": pain_score,
        "triage_level": triage_level,
    }
    
    return record


def generate_dataset(n_samples=5000):
    """Generate full synthetic dataset with class distribution."""
    # Realistic class distribution (more non-urgent than emergency)
    class_distribution = {
        "EMERGENCY": 0.08,
        "URGENT": 0.18,
        "SEMI-URGENT": 0.28,
        "NON-URGENT": 0.30,
        "SELF-CARE": 0.16,
    }
    
    records = []
    patient_id = 1
    
    for level, proportion in class_distribution.items():
        n = int(n_samples * proportion)
        for _ in range(n):
            records.append(generate_patient_record(level, patient_id))
            patient_id += 1
    
    df = pd.DataFrame(records)
    # Shuffle
    df = df.sample(frac=1, random_state=RANDOM_STATE).reset_index(drop=True)
    
    print(f"Generated {len(df)} patient records")
    print(f"\nClass distribution:")
    print(df['triage_level'].value_counts().sort_index())
    
    return df


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 2: FEATURE ENGINEERING
# ═══════════════════════════════════════════════════════════════════════════════

def engineer_features(df):
    """Create medically-informed engineered features."""
    df = df.copy()
    
    # 1. Symptom count
    symptom_cols = ALL_SYMPTOMS
    df['symptom_count'] = df[symptom_cols].sum(axis=1)
    
    # 2. Red flag symptom count
    red_flags = [s for s, (_, is_rf) in SYMPTOM_REGISTRY.items() if is_rf]
    df['red_flag_count'] = df[red_flags].sum(axis=1)
    
    # 3. Weighted severity score
    df['severity_score'] = sum(
        df[s] * SYMPTOM_REGISTRY[s][0] for s in symptom_cols if s in df.columns
    )
    
    # 4. Max symptom severity present
    df['max_symptom_severity'] = 0
    for s in symptom_cols:
        if s in df.columns:
            mask = df[s] == 1
            sev = SYMPTOM_REGISTRY[s][0]
            df.loc[mask, 'max_symptom_severity'] = df.loc[mask, 'max_symptom_severity'].clip(lower=sev)
    
    # 5. Vital sign composite scores
    # NEWS-inspired (National Early Warning Score)
    df['hr_deviation'] = np.abs(df['heart_rate'] - 75)  # deviation from normal
    df['bp_risk'] = (df['systolic_bp'] < 100).astype(int) + (df['systolic_bp'] < 90).astype(int)
    df['temp_deviation'] = np.abs(df['temperature'] - 37.0)
    df['spo2_risk'] = (100 - df['spo2']).clip(lower=0)
    df['rr_deviation'] = np.abs(df['respiratory_rate'] - 16)
    
    # 6. Composite vitals risk score
    df['vitals_risk_score'] = (
        (df['hr_deviation'] / 20).clip(upper=3) +
        df['bp_risk'] * 2 +
        (df['temp_deviation'] / 1.0).clip(upper=3) +
        (df['spo2_risk'] / 3).clip(upper=3) +
        (df['rr_deviation'] / 5).clip(upper=3)
    )
    
    # 7. Age risk factor
    df['age_risk'] = 0.0
    df.loc[df['age'] < 5, 'age_risk'] = 2.0
    df.loc[df['age'] > 65, 'age_risk'] = 1.5
    df.loc[df['age'] > 80, 'age_risk'] = 2.5
    
    # 8. Interaction features
    df['severity_x_vitals'] = df['severity_score'] * df['vitals_risk_score']
    df['redflag_x_age_risk'] = df['red_flag_count'] * df['age_risk']
    df['pain_x_duration'] = df['pain_score'] * np.log1p(df['symptom_duration_hours'])
    
    # 9. Encode comorbidity
    comorbidity_risk = {
        "none": 0, "diabetes": 1, "hypertension": 1, "asthma": 1,
        "copd": 2, "heart_disease": 2, "kidney_disease": 2,
        "liver_disease": 2, "immunocompromised": 3, "pregnancy": 1.5
    }
    df['comorbidity_risk'] = df['comorbidity'].map(comorbidity_risk).fillna(0)
    df['has_comorbidity'] = (df['comorbidity'] != 'none').astype(int)
    
    # 10. Log-transform duration
    df['log_duration'] = np.log1p(df['symptom_duration_hours'])
    
    return df


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 3: MODEL TRAINING & EVALUATION
# ═══════════════════════════════════════════════════════════════════════════════

def prepare_data(df):
    """Prepare features and labels for training."""
    # Define feature columns (exclude patient_id, triage_level, comorbidity string)
    exclude_cols = ['patient_id', 'triage_level', 'comorbidity']
    feature_cols = [c for c in df.columns if c not in exclude_cols]
    
    X = df[feature_cols].values
    
    # Encode target
    le = LabelEncoder()
    le.classes_ = np.array(TRIAGE_LEVELS)
    y = le.transform(df['triage_level'])
    
    return X, y, feature_cols, le


def train_and_evaluate(X_train, X_test, y_train, y_test, feature_cols, label_encoder):
    """Train multiple models and compare."""
    
    # Compute class weights for imbalanced data
    class_weights = compute_class_weight('balanced', classes=np.unique(y_train), y=y_train)
    sample_weights = np.array([class_weights[y] for y in y_train])
    
    models = {
        "GradientBoosting": GradientBoostingClassifier(
            n_estimators=200,
            max_depth=5,
            learning_rate=0.1,
            min_samples_split=10,
            min_samples_leaf=5,
            subsample=0.8,
            random_state=RANDOM_STATE,
        ),
        "RandomForest": RandomForestClassifier(
            n_estimators=200,
            max_depth=10,
            min_samples_split=10,
            min_samples_leaf=5,
            class_weight='balanced',
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
        "LogisticRegression": LogisticRegression(
            max_iter=1000,
            class_weight='balanced',
            random_state=RANDOM_STATE,
            C=1.0,
        ),
    }
    
    results = {}
    
    for name, model in models.items():
        print(f"\n{'='*60}")
        print(f"  Training: {name}")
        print(f"{'='*60}")
        
        # Scale for Logistic Regression
        if name == "LogisticRegression":
            scaler = StandardScaler()
            X_train_scaled = scaler.fit_transform(X_train)
            X_test_scaled = scaler.transform(X_test)
            model.fit(X_train_scaled, y_train)
            y_pred = model.predict(X_test_scaled)
            y_proba = model.predict_proba(X_test_scaled)
        elif name == "GradientBoosting":
            model.fit(X_train, y_train, sample_weight=sample_weights)
            y_pred = model.predict(X_test)
            y_proba = model.predict_proba(X_test)
        else:
            model.fit(X_train, y_train)
            y_pred = model.predict(X_test)
            y_proba = model.predict_proba(X_test)
        
        # Cross-validation
        cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_STATE)
        if name == "LogisticRegression":
            pipeline = Pipeline([('scaler', StandardScaler()), ('model', model)])
            cv_scores = cross_val_score(pipeline, X_train, y_train, cv=cv, scoring='f1_weighted')
        else:
            cv_scores = cross_val_score(model, X_train, y_train, cv=cv, scoring='f1_weighted')
        
        # Metrics
        acc = accuracy_score(y_test, y_pred)
        f1_w = f1_score(y_test, y_pred, average='weighted')
        f1_macro = f1_score(y_test, y_pred, average='macro')
        prec_w = precision_score(y_test, y_pred, average='weighted')
        rec_w = recall_score(y_test, y_pred, average='weighted')
        
        # Per-class F1
        f1_per_class = f1_score(y_test, y_pred, average=None)
        
        results[name] = {
            "model": model,
            "y_pred": y_pred,
            "y_proba": y_proba,
            "accuracy": acc,
            "f1_weighted": f1_w,
            "f1_macro": f1_macro,
            "precision_weighted": prec_w,
            "recall_weighted": rec_w,
            "f1_per_class": f1_per_class,
            "cv_f1_mean": cv_scores.mean(),
            "cv_f1_std": cv_scores.std(),
        }
        
        print(f"  Accuracy:           {acc:.4f}")
        print(f"  F1 (weighted):      {f1_w:.4f}")
        print(f"  F1 (macro):         {f1_macro:.4f}")
        print(f"  Precision (weighted):{prec_w:.4f}")
        print(f"  Recall (weighted):  {rec_w:.4f}")
        print(f"  CV F1 (5-fold):     {cv_scores.mean():.4f} ± {cv_scores.std():.4f}")
        print(f"\n  Per-class F1 scores:")
        for i, level in enumerate(TRIAGE_LEVELS):
            print(f"    {level:15s}: {f1_per_class[i]:.4f}")
        
        print(f"\n  Classification Report:")
        print(classification_report(y_test, y_pred, target_names=TRIAGE_LEVELS))
    
    return results


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 4: VISUALIZATION
# ═══════════════════════════════════════════════════════════════════════════════

# Professional color palette
COLORS = {
    "EMERGENCY": "#DC2626",
    "URGENT": "#EA580C", 
    "SEMI-URGENT": "#D97706",
    "NON-URGENT": "#059669",
    "SELF-CARE": "#2563EB",
}

PALETTE_BG = "#0F172A"
PALETTE_CARD = "#1E293B"
PALETTE_TEXT = "#E2E8F0"
PALETTE_ACCENT = "#38BDF8"
PALETTE_GRID = "#334155"


def set_dark_style():
    """Configure matplotlib for dark theme."""
    plt.rcParams.update({
        'figure.facecolor': PALETTE_BG,
        'axes.facecolor': PALETTE_CARD,
        'axes.edgecolor': PALETTE_GRID,
        'axes.labelcolor': PALETTE_TEXT,
        'text.color': PALETTE_TEXT,
        'xtick.color': PALETTE_TEXT,
        'ytick.color': PALETTE_TEXT,
        'grid.color': PALETTE_GRID,
        'grid.alpha': 0.3,
        'font.family': 'sans-serif',
        'font.size': 11,
    })


def plot_confusion_matrix(y_test, y_pred, model_name, filepath):
    """Plot a beautiful confusion matrix."""
    set_dark_style()
    
    cm = confusion_matrix(y_test, y_pred)
    cm_normalized = cm.astype('float') / cm.sum(axis=1)[:, np.newaxis]
    
    fig, axes = plt.subplots(1, 2, figsize=(18, 7))
    
    for idx, (data, title, fmt) in enumerate([
        (cm, f"{model_name} — Confusion Matrix (Counts)", "d"),
        (cm_normalized, f"{model_name} — Confusion Matrix (Normalized)", ".2f"),
    ]):
        ax = axes[idx]
        
        # Custom colormap
        cmap = sns.color_palette("YlOrRd", as_cmap=True) if idx == 0 else sns.color_palette("Blues", as_cmap=True)
        
        sns.heatmap(
            data, annot=True, fmt=fmt, cmap=cmap, ax=ax,
            xticklabels=TRIAGE_LEVELS, yticklabels=TRIAGE_LEVELS,
            linewidths=0.5, linecolor=PALETTE_BG,
            cbar_kws={'shrink': 0.8},
            annot_kws={'size': 11, 'weight': 'bold'},
        )
        ax.set_title(title, fontsize=13, fontweight='bold', pad=15)
        ax.set_xlabel('Predicted', fontsize=11, fontweight='bold')
        ax.set_ylabel('Actual', fontsize=11, fontweight='bold')
        ax.tick_params(axis='both', labelsize=9)
        plt.setp(ax.get_xticklabels(), rotation=30, ha='right')
        plt.setp(ax.get_yticklabels(), rotation=0)
    
    plt.tight_layout(pad=2)
    plt.savefig(filepath, dpi=200, bbox_inches='tight', facecolor=PALETTE_BG)
    plt.close()
    print(f"  Saved: {filepath}")


def plot_model_comparison(results, filepath):
    """Bar chart comparing all models across metrics."""
    set_dark_style()
    
    metrics = ['accuracy', 'f1_weighted', 'f1_macro', 'precision_weighted', 'recall_weighted']
    metric_labels = ['Accuracy', 'F1 (Weighted)', 'F1 (Macro)', 'Precision', 'Recall']
    
    model_names = list(results.keys())
    n_models = len(model_names)
    n_metrics = len(metrics)
    
    fig, ax = plt.subplots(figsize=(14, 6))
    
    bar_width = 0.22
    x = np.arange(n_metrics)
    
    model_colors = ['#38BDF8', '#A78BFA', '#FB923C']
    
    for i, model in enumerate(model_names):
        values = [results[model][m] for m in metrics]
        bars = ax.bar(x + i * bar_width, values, bar_width, label=model,
                      color=model_colors[i], edgecolor='none', alpha=0.9)
        
        for bar, val in zip(bars, values):
            ax.text(bar.get_x() + bar.get_width()/2., bar.get_height() + 0.005,
                    f'{val:.3f}', ha='center', va='bottom', fontsize=9, fontweight='bold')
    
    ax.set_ylim(0, 1.12)
    ax.set_xticks(x + bar_width)
    ax.set_xticklabels(metric_labels, fontsize=11)
    ax.set_ylabel('Score', fontsize=12, fontweight='bold')
    ax.set_title('Model Comparison — Evaluation Metrics', fontsize=14, fontweight='bold', pad=15)
    ax.legend(loc='upper right', fontsize=10, framealpha=0.8)
    ax.grid(axis='y', alpha=0.2)
    
    plt.tight_layout()
    plt.savefig(filepath, dpi=200, bbox_inches='tight', facecolor=PALETTE_BG)
    plt.close()
    print(f"  Saved: {filepath}")


def plot_per_class_f1(results, filepath):
    """Per-class F1 scores for all models."""
    set_dark_style()
    
    fig, ax = plt.subplots(figsize=(14, 6))
    
    model_names = list(results.keys())
    model_colors = ['#38BDF8', '#A78BFA', '#FB923C']
    
    bar_width = 0.22
    x = np.arange(len(TRIAGE_LEVELS))
    
    for i, model in enumerate(model_names):
        f1_scores = results[model]['f1_per_class']
        bars = ax.bar(x + i * bar_width, f1_scores, bar_width, label=model,
                      color=model_colors[i], edgecolor='none', alpha=0.9)
        for bar, val in zip(bars, f1_scores):
            ax.text(bar.get_x() + bar.get_width()/2., bar.get_height() + 0.008,
                    f'{val:.2f}', ha='center', va='bottom', fontsize=9, fontweight='bold')
    
    ax.set_ylim(0, 1.15)
    ax.set_xticks(x + bar_width)
    ax.set_xticklabels(TRIAGE_LEVELS, fontsize=10)
    ax.set_ylabel('F1 Score', fontsize=12, fontweight='bold')
    ax.set_title('Per-Class F1 Scores by Model', fontsize=14, fontweight='bold', pad=15)
    ax.legend(loc='upper right', fontsize=10, framealpha=0.8)
    ax.grid(axis='y', alpha=0.2)
    
    # Color code the x-axis labels
    for j, label in enumerate(ax.get_xticklabels()):
        label.set_color(list(COLORS.values())[j])
        label.set_fontweight('bold')
    
    plt.tight_layout()
    plt.savefig(filepath, dpi=200, bbox_inches='tight', facecolor=PALETTE_BG)
    plt.close()
    print(f"  Saved: {filepath}")


def plot_feature_importance(model, feature_cols, filepath, top_n=20):
    """Feature importance for the best model."""
    set_dark_style()
    
    importances = model.feature_importances_
    indices = np.argsort(importances)[-top_n:]
    
    fig, ax = plt.subplots(figsize=(10, 8))
    
    colors = plt.cm.viridis(np.linspace(0.3, 0.9, top_n))
    
    bars = ax.barh(range(top_n), importances[indices], color=colors, edgecolor='none')
    ax.set_yticks(range(top_n))
    ax.set_yticklabels([feature_cols[i] for i in indices], fontsize=10)
    ax.set_xlabel('Importance', fontsize=12, fontweight='bold')
    ax.set_title(f'Top {top_n} Feature Importances (GradientBoosting)', fontsize=14, fontweight='bold', pad=15)
    ax.grid(axis='x', alpha=0.2)
    
    plt.tight_layout()
    plt.savefig(filepath, dpi=200, bbox_inches='tight', facecolor=PALETTE_BG)
    plt.close()
    print(f"  Saved: {filepath}")


def plot_roc_curves(y_test, results, filepath):
    """One-vs-Rest ROC curves for the best model."""
    set_dark_style()
    
    best_model_name = max(results, key=lambda k: results[k]['f1_weighted'])
    y_proba = results[best_model_name]['y_proba']
    
    fig, ax = plt.subplots(figsize=(10, 8))
    
    triage_colors = list(COLORS.values())
    
    from sklearn.preprocessing import label_binarize
    y_test_bin = label_binarize(y_test, classes=list(range(len(TRIAGE_LEVELS))))
    
    for i, (level, color) in enumerate(zip(TRIAGE_LEVELS, triage_colors)):
        fpr, tpr, _ = roc_curve(y_test_bin[:, i], y_proba[:, i])
        roc_auc = auc(fpr, tpr)
        ax.plot(fpr, tpr, color=color, lw=2.5, label=f'{level} (AUC={roc_auc:.3f})')
    
    ax.plot([0, 1], [0, 1], 'w--', lw=1, alpha=0.3)
    ax.set_xlabel('False Positive Rate', fontsize=12, fontweight='bold')
    ax.set_ylabel('True Positive Rate', fontsize=12, fontweight='bold')
    ax.set_title(f'ROC Curves — {best_model_name} (One-vs-Rest)', fontsize=14, fontweight='bold', pad=15)
    ax.legend(loc='lower right', fontsize=10, framealpha=0.8)
    ax.grid(alpha=0.2)
    
    plt.tight_layout()
    plt.savefig(filepath, dpi=200, bbox_inches='tight', facecolor=PALETTE_BG)
    plt.close()
    print(f"  Saved: {filepath}")


def plot_cross_validation(results, filepath):
    """Cross-validation comparison."""
    set_dark_style()
    
    fig, ax = plt.subplots(figsize=(10, 5))
    
    model_names = list(results.keys())
    means = [results[m]['cv_f1_mean'] for m in model_names]
    stds = [results[m]['cv_f1_std'] for m in model_names]
    
    model_colors = ['#38BDF8', '#A78BFA', '#FB923C']
    
    bars = ax.bar(model_names, means, yerr=stds, color=model_colors,
                  edgecolor='none', alpha=0.9, capsize=8, error_kw={'lw': 2, 'color': PALETTE_TEXT})
    
    for bar, mean, std in zip(bars, means, stds):
        ax.text(bar.get_x() + bar.get_width()/2., bar.get_height() + std + 0.01,
                f'{mean:.4f} ± {std:.4f}', ha='center', fontsize=11, fontweight='bold')
    
    ax.set_ylim(0, 1.15)
    ax.set_ylabel('F1 Score (Weighted)', fontsize=12, fontweight='bold')
    ax.set_title('5-Fold Cross-Validation Comparison', fontsize=14, fontweight='bold', pad=15)
    ax.grid(axis='y', alpha=0.2)
    
    plt.tight_layout()
    plt.savefig(filepath, dpi=200, bbox_inches='tight', facecolor=PALETTE_BG)
    plt.close()
    print(f"  Saved: {filepath}")


# ═══════════════════════════════════════════════════════════════════════════════
# SECTION 5: MODEL EXPORT & REPORT
# ═══════════════════════════════════════════════════════════════════════════════

def export_model(model, feature_cols, label_encoder, results):
    """Export the best model and metadata for production."""
    best_name = max(results, key=lambda k: results[k]['f1_weighted'])
    best_model = results[best_name]['model']
    
    # Save model
    model_path = os.path.join(OUTPUT_DIR, "triage_model.pkl")
    with open(model_path, 'wb') as f:
        pickle.dump(best_model, f)
    
    # Save metadata
    metadata = {
        "model_type": best_name,
        "triage_levels": TRIAGE_LEVELS,
        "feature_columns": feature_cols,
        "symptom_registry": {k: {"severity": v[0], "is_red_flag": v[1]} for k, v in SYMPTOM_REGISTRY.items()},
        "metrics": {
            "accuracy": float(results[best_name]['accuracy']),
            "f1_weighted": float(results[best_name]['f1_weighted']),
            "f1_macro": float(results[best_name]['f1_macro']),
            "precision_weighted": float(results[best_name]['precision_weighted']),
            "recall_weighted": float(results[best_name]['recall_weighted']),
            "cv_f1_mean": float(results[best_name]['cv_f1_mean']),
            "cv_f1_std": float(results[best_name]['cv_f1_std']),
            "f1_per_class": {TRIAGE_LEVELS[i]: float(v) for i, v in enumerate(results[best_name]['f1_per_class'])},
        },
    }
    
    meta_path = os.path.join(OUTPUT_DIR, "model_metadata.json")
    with open(meta_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"\n  Model exported: {model_path}")
    print(f"  Metadata exported: {meta_path}")
    
    return metadata


# ═══════════════════════════════════════════════════════════════════════════════
# MAIN PIPELINE
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    print("=" * 70)
    print("  SYMPTOM TRIAGE CLASSIFIER — Training Pipeline")
    print("=" * 70)
    
    # Step 1: Generate data
    print("\n▸ Step 1: Generating synthetic medical data...")
    df = generate_dataset(n_samples=6000)
    
    # Save raw dataset
    df.to_csv(os.path.join(OUTPUT_DIR, "triage_dataset.csv"), index=False)
    print(f"  Dataset saved to {OUTPUT_DIR}/triage_dataset.csv")
    
    # Step 2: Feature engineering
    print("\n▸ Step 2: Engineering features...")
    df = engineer_features(df)
    print(f"  Total features: {len(df.columns) - 3}")  # minus id, target, comorbidity str
    
    # Step 3: Prepare data
    print("\n▸ Step 3: Preparing train/test split...")
    X, y, feature_cols, le = prepare_data(df)
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=RANDOM_STATE, stratify=y
    )
    print(f"  Train: {X_train.shape[0]} samples")
    print(f"  Test:  {X_test.shape[0]} samples")
    print(f"  Features: {X_train.shape[1]}")
    
    # Step 4: Train and evaluate
    print("\n▸ Step 4: Training models...")
    results = train_and_evaluate(X_train, X_test, y_train, y_test, feature_cols, le)
    
    # Step 5: Visualizations
    print("\n▸ Step 5: Generating visualizations...")
    
    best_name = max(results, key=lambda k: results[k]['f1_weighted'])
    
    plot_confusion_matrix(
        y_test, results[best_name]['y_pred'], best_name,
        os.path.join(OUTPUT_DIR, "confusion_matrix.png")
    )
    plot_model_comparison(results, os.path.join(OUTPUT_DIR, "model_comparison.png"))
    plot_per_class_f1(results, os.path.join(OUTPUT_DIR, "per_class_f1.png"))
    plot_feature_importance(
        results[best_name]['model'], feature_cols,
        os.path.join(OUTPUT_DIR, "feature_importance.png")
    )
    plot_roc_curves(y_test, results, os.path.join(OUTPUT_DIR, "roc_curves.png"))
    plot_cross_validation(results, os.path.join(OUTPUT_DIR, "cross_validation.png"))
    
    # Step 6: Export
    print("\n▸ Step 6: Exporting model...")
    metadata = export_model(results[best_name]['model'], feature_cols, le, results)
    
    # Final summary
    print("\n" + "=" * 70)
    print("  TRAINING COMPLETE — SUMMARY")
    print("=" * 70)
    print(f"\n  Best Model:        {best_name}")
    print(f"  Accuracy:          {metadata['metrics']['accuracy']:.4f}")
    print(f"  F1 (weighted):     {metadata['metrics']['f1_weighted']:.4f}")
    print(f"  F1 (macro):        {metadata['metrics']['f1_macro']:.4f}")
    print(f"  CV F1:             {metadata['metrics']['cv_f1_mean']:.4f} ± {metadata['metrics']['cv_f1_std']:.4f}")
    print(f"\n  Per-class F1:")
    for level, f1 in metadata['metrics']['f1_per_class'].items():
        print(f"    {level:15s}: {f1:.4f}")
    
    print(f"\n  Output files in: {OUTPUT_DIR}/")
    print("  ├── triage_model.pkl")
    print("  ├── model_metadata.json")
    print("  ├── triage_dataset.csv")
    print("  ├── confusion_matrix.png")
    print("  ├── model_comparison.png")
    print("  ├── per_class_f1.png")
    print("  ├── feature_importance.png")
    print("  ├── roc_curves.png")
    print("  └── cross_validation.png")
    
    return results, metadata


if __name__ == "__main__":
    results, metadata = main()
