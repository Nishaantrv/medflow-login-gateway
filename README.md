# 🏥 MedFlow AI - Intelligent Healthcare Gateway

MedFlow AI is an advanced, AI-driven healthcare management platform that provides distinct, context-aware portals for patients, doctors, hospital administrators, and family members. It leverages real-time data and LLM-powered agents to streamline clinical workflows and improve patient care.

---

## 📈 Current Project Progress Summary

This project has successfully completed the core architecture, multi-role dashboard systems, and the underlying AI microservices. Below is a detailed breakdown of the functionality implemented to date.

### 1. 🔐 Core Infrastructure & Security
- **Supabase Integration**: Robust backend using Supabase for authentication, real-time database, and edge functions.
- **Role-Based Access Control (RBAC)**: Secure redirection logic based on user roles (`patient`, `doctor`, `admin`, `family`).
- **Unified Login Experience**: A stunning, high-contrast dark medical theme login interface.
- **Relational Database Schema**: 12+ optimized tables for patients, appointments, clinical records, medications, hospital resources, and more.

### 2. 🤖 AI Agent Ecosystem (`src/services/aiAgent.ts`)
- **Centralized AI Service**: An extensible API gateway connecting the frontend to specialized LLM agents via Supabase Edge Functions.
- **Context-Aware Processing**: Capability to feed patient history, lab results, and real-time status into AI prompts for accurate medical summaries.
- **Conversation State**: Persistent chat history storage for continuous interactions with AI assistants.
- **Multilingual Support**: Edge functions configured to handle diverse clinical queries.

---

## 🖥️ Portals & Features (What's Done)

### 🩺 Doctor Dashboard
- **Schedule Management**: Full calendar/list view of upcoming clinical appointments.
- **My Patients**: Filterable database of assigned patients with clinical status markers.
- **AI SOAP Note Generator**: Intelligent tool to convert raw transcribed text into structured **S**ubjective, **O**bjective, **A**ssessment, and **P**lan notes.
- **Clinical Analytics**: Quick stats for patient volume and clinical tasks.

### 👤 Patient Portal
- **Health Dashboard**: Real-time view of vital health metrics and upcoming appointments.
- **Medication Management**: List of active prescriptions with dosage details.
- **AI Health Companion**: WhatsApp-style chat interface for medical queries and symptom triage.
- **Appointment Booking**: Integrated scheduling system for specialty and doctor selection.

### 🏢 Hospital Admin (Hospital Agent)
- **Bed Management**: Real-time grid of hospital bed occupancy across different departments.
- **Staff Scheduling**: Unified view of doctors, nurses, and administrative staff shifts.
- **Financial Gateway**: Billing and financial overview dashboard for hospital operations.
- **Operational Stats**: Admissions, discharges, and occupancy rate visuals.

### 👨‍👩‍👧 Family Portal
- **Patient Status**: Plain-language updates on a loved one's clinical status (powered by AI translation).
- **Visit Scheduler**: Tool to coordinate hospital visits according to facility policies.
- **Support Chat**: Direct channel for family members to ask administrative or general health questions.

---

## 🛠️ Tech Stack
- **Frontend**: Vite, React, TypeScript.
- **Styling**: Tailwind CSS, Shadcn UI, Framer Motion (micro-animations).
- **Backend**: Supabase (Auth, DB, Edge Functions).
- **AI**: Claude 3.5 Sonnet / GPT-4o via Edge Functions.
- **State Management**: React Query (TanStack Query) for seamless data fetching.

## 🚀 How to Run Locally
1. **Clone & Install**:
   ```bash
   git clone <repo-url>
   cd medflow-login-gateway
   npm install
   ```
2. **Setup Env**: Create a `.env` file with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. **Start Development**:
   ```bash
   npm run dev
   ```

---

## 📅 Roadmap: What's Next?
- [ ] **Cross-Agent Notifications**: Real-time push alerts when a SOAP note is signed or a lab result arrives.
- [ ] **Bed Admission Flow**: Finalize the "Admit" button logic in the Admin Bed View.
- [ ] **Symptom Triage Logic**: Enhance the Patient Agent's ability to trigger emergency alerts.
- [ ] **Performance Polish**: Optimization of loading skeletons and edge-case error handling.
