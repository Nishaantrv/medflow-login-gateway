# 🏥 MedFlow AI MVP Build Roadmap

## ✅ DAY 1: Database + Data Interpreter Agent (COMPLETED)
- [x] **Database Setup**
  - [x] Create Supabase project.
  - [x] Execute `database-schema.sql` (12 tables with data).
  - [x] Enable email/password authentication.
- [x] **Account Initialization**
  - [x] Create test accounts for Patient, Doctor, Admin, and Family roles.
- [x] **UI Foundation (Lovable)**
  - [x] Connect Lovable to Supabase.
  - [x] Build dark medical theme login page with role-based redirection.
- [x] **AI Core Integration**
  - [x] Deploy Supabase Edge Function `ai-agent` with Claude API.
  - [x] Implement system prompts logic and chat history storage.

---

## ⏳ DAY 2: Patient Agent (Chatbot + Appointments)
- [ ] **Patient Dashboard**
  - [ ] Welcome message with patient name.
  - [ ] Upcoming appointments list.
  - [ ] Active medications view.
  - [ ] Floating chat button.
- [ ] **Patient Chat Interface**
  - [ ] WhatsApp-style UI.
  - [ ] Integration with `patient_agent` via Edge Function.
  - [ ] Context inclusion (profile, meds, records).
- [ ] **Appointment Booking**
  - [ ] specialty/doctor selection.
  - [ ] Calendar date/time picker.
  - [ ] Confirmation and database storage.
- [ ] **Symptom Triage**
  - [ ] AI-driven triage (Emergency/Urgent/Routine).
  - [ ] Recommended actions display.

---

## 📅 DAY 3: Doctor Agent (Dashboard + Clinical Tools)
- [ ] **Doctor Dashboard**
  - [ ] Today's appointment schedule.
  - [ ] Patient queue with status badges.
  - [ ] Quick stats overview.
- [ ] **Patient Briefing Card**
  - [ ] Comprehensive clinical summary (allergies, meds, labs).
  - [ ] AI-generated briefing paragraph.
- [ ] **SOAP Note Generator**
  - [ ] Raw text to structured SOAP note conversion via AI.
  - [ ] "Save to Records" functionality.
- [ ] **Order Management**
  - [ ] Lab/Imaging order checkboxes.
  - [ ] Medication prescriber panel.

---

## 🏥 DAY 4: Hospital Agent + Family Agent
- [ ] **Admin Dashboard**
  - [ ] Bed occupancy overview.
  - [ ] Stats (admissions, discharges, appointment volume).
- [ ] **Bed Management Board**
  - [ ] Visual grid of departments/beds.
  - [ ] Color-coded availability and "Admit" flow.
- [ ] **Staff Schedule View**
  - [ ] Role-based color coding and filters.
- [ ] **Family Portal**
  - [ ] Patient health status updates.
  - [ ] AI-driven plain language translations of medical records.
- [ ] **Visit Scheduler**
  - [ ] Family visiting form and policy display.

---

## 🚀 DAY 5: Integration + Polish + Demo
- [ ] **Cross-Agent Notification Flow**
  - [ ] Automate alerts for new SOAP notes/orders.
- [ ] **Role-Based Navigation**
  - [ ] Sidebar/Top nav tailored to current user role.
- [ ] **Demo Scenarios Setup**
  - [ ] Scenario 1: ER Discharge (Sarah).
  - [ ] Scenario 2: Cardiology Follow-up (Raj).
  - [ ] Scenario 3: Admin Operations.
- [ ] **Final Polish**
  - [ ] Loading skeletons, empty states, and mobile responsiveness.
  - [ ] Deployment via Lovable.
