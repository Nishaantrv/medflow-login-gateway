# 🏥 MedFlow AI - Intelligent Healthcare Gateway

MedFlow AI is a state-of-the-art, AI-driven healthcare management platform designed to revolutionize the clinical experience. It provides distinct, context-aware portals for **Patients**, **Doctors**, **Hospital Administrators**, and **Family Members**, all unified by a powerful multi-agent AI ecosystem.

---

## 🌟 Key Highlights

- **Multi-Agent Architecture**: Discrete AI agents tailored for clinical, administrative, and patient support roles.
- **Intelligent Chat Persistence**: ChatGPT-style sidebar with unified session tracking across all devices.
- **Native AI Tooling**: Real-time integration with medical databases for medications, doctor availability, and scheduling.
- **Premium Design Logic**: High-contrast dark medical theme with fluid animations and responsive layouts.
- **Predictive Intelligence**: AI-powered features like Predictive Discharge and Automated Clinical Summaries.

---

## 📖 Build History & Walkthroughs

The project was developed over a 5-day intensive build. You can explore the detailed evolution here:

- [📅 Day 1: Database & AI Foundation](./docs/walkthroughs/day1.md)
- [📅 Day 2: Patient Agent & Appointments](./docs/walkthroughs/day2.md)
- [📅 Day 3: Doctor Agent & Clinical SOAP Notes](./docs/walkthroughs/day3.md)
- [📅 Day 4: Hospital & Family Ecosystem](./docs/walkthroughs/day4.md)
- [📅 Day 5: Premium UI & Final Integration](./docs/walkthroughs/day5.md)

---

## 🤖 AI Agent Ecosystem & Tooling

MedFlow AI leverages a sophisticated `ai-agent` edge function (GPT-4o / GPT-4o-mini) with **Native Tool-Calling Capabilities**:

- **Real-Time Data Access**: Agents use tools like `get_medications` and `get_available_doctors` to fetch live database records.
- **Action-Oriented Assistant**: The assistant can perform state-changing operations like `book_appointment` directly through natural language.
- **Clinical Copilot**: Assists doctors with SOAP note generation, patient briefings, and diagnostic suggestions.
- **24/7 Support**: Provides symptom triage and health record navigation for patients and family members.

---

## 📂 Intelligent Chat Persistence

The Patient Portal now features a fully-persistent, ChatGPT-style conversation system:

- **Unified Identity Sync**: Conversations are tied to your Auth ID, ensuring history is available across any device or session.
- **Sidebar Organization**: A sleek left sidebar groups recent chats with auto-generated titles for easy navigation.
- **State Preservation**: Switch between topics or start a "New Chat" without losing previous progress.
- **Searchable History**: Integrated search to quickly find past medical guidance or appointment details.

---

## 🖥️ Portals & Features

### 🩺 Doctor Portal (The Clinical Hub)
- **AI SOAP Note Generator**: Converts raw clinical notes into professional, structured records automatically.
- **Intelligent Briefing Cards**: Provides a concise AI-generated summary of a patient's entire history before a consultation.
- **Smart Patient Queue**: Real-time tracking of patient status with visual urgency markers.
- **E-Prescribing & Labs**: Integrated order management for medications and diagnostic tests.

### 👤 Patient Portal (The Personal Health Companion)
- **AI Health Bot**: A WhatsApp-style interface for instant health questions and clinical support.
- **Smart Appointments**: Intelligent scheduling with specialty-based doctor matching.
- **Health Snapshot**: Real-time vital monitoring and active medication tracking.
- **Secure Records**: One-tap access to labs, imaging, and past clinical summaries.

### 🏢 Admin Portal (The Hospital Command Center)
- **Predictive Bed Management**: Visual grid of all hospital beds with AI-driven discharge predictions.
- **Operational Insights**: Real-time analytics on admissions, occupancy rates, and staff efficiency.
- **Staff Rostering**: Unified scheduling system with role-based filters (Nurses, MDs, Admins).
- **Billing Intelligence**: Overview of financial operations and billing cycles.

### 👨‍👩‍👧 Family Portal (The Care Circle)
- **Plain-Language Updates**: AI-powered "translation" of clinical statuses into clear, jargon-free updates for family members.
- **Visit Scheduling**: Seamless coordination of hospital visits aligned with facility policies.
- **Direct Care-Line**: Secure communication channel for administrative or general inquiries.

---

## 🛠️ Technology Stack

- **Frontend**: `Vite`, `React 18`, `TypeScript`
- **Styling**: `Tailwind CSS`, `Shadcn UI`, `Lucide Icons`, `Framer Motion`
- **Backend**: `Supabase` (Auth, PostgreSQL, Realtime)
- **AI Microservices**: `Supabase Edge Functions` + `OpenAI Tool Calling`
- **Data Fetching**: `React Query` (TanStack Query)
- **Navigation**: `React Router v6`

---

## 🚀 Local Development

1. **Prerequisites**: Ensure you have [Node.js](https://nodejs.org/) installed.
2. **Clone & Install**:
   ```bash
   git clone <repo-url>
   cd medflow-login-gateway
   npm install
   ```
3. **Environment Setup**:
   - Create a `.env` file in the root directory.
   - Add your credentials:
     ```env
     VITE_SUPABASE_URL=your_supabase_url
     VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```
4. **Run the App**:
   ```bash
   npm run dev
   ```

---

## ✅ Final Project Status: 100% COMPLETED (Extended v1.5)
All milestones and the **advanced chat persistence/tooling layer** have been successfully implemented, verified, and pushed. MedFlow AI is a production-ready healthcare demonstration platform.
