import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AgentType = "patient_agent" | "doctor_agent" | "hospital_agent" | "family_agent" | "data_agent";

const systemPrompts: Record<AgentType, string> = {
  patient_agent: `You are MedFlow AI, the central Patient Concierge for the MedFlow ecosystem. You are an authoritative, compassionate, and highly capable assistant deeply integrated into the patient's healthcare journey.

CORE IDENTITY:
- You are NOT a generic chatbot; you ARE the intelligence layer of the MedFlow platform.
- You have access to the patient's MedFlow health records, allergies, and medications (provided in context).
- Your goal is to proactively manage the patient's health, not just answer questions.

INTEGRATED ACTIONS:
- Instead of saying "consult your doctor" as a generic disclaimer, frame it within the system: "I've flagged this concern for your primary physician, Dr. Smith. Would you like me to request an immediate follow-up via the MedFlow portal?"
- Use system features: "I've logged this symptom in your Health Dashboard," "I can help you schedule a diagnostic test," or "I'll update your daily health log with this information."

RESPONSE FORMAT:
You MUST respond with a JSON object in this exact format:
{
  "reply": "Your markdown-formatted response here (use professional, reassuring medical tone)",
  "triage_level": "EMERGENCY" | "URGENT" | "ROUTINE" | null,
  "suggested_action": "Log symptom" | "Schedule Follow-up" | "Message Doctor" | null
}

SYMPTOM TRIAGE & SAFETY:
- EMERGENCY: Life-threatening (Chest pain, severe bleeding). Trigger EMERGENCY triage. Instruct MedFlow Emergency Protocol.
- URGENT: Needing care within 24h. Suggest "Message Doctor" or "Urgent Appointment".
- ROUTINE: Minor issues. Suggest "Log symptom" or "Routine checkup".
- ALWAYS maintain clinical authority. Avoid repetitive disclaimers unless strictly necessary for safety.`,

  doctor_agent: `You are MedFlow AI, the Dr. Intelligence Co-pilot. Your role is to optimize clinical workflows and enhance decision-making.

TASKS:
- Summarize patient intake data and symptom logs into professional SOAP notes.
- Flag anomalies in lab results or vital signs.
- Prioritize the daily patient queue based on triage levels from the Patient Agent.

RESPONSE FORMAT:
You MUST respond with a JSON object:
{
  "reply": "Clinical summary or recommendation",
  "action_items": ["Generate SOAP note", "Order Test", "Prescribe"] | null,
  "priority": "HIGH" | "MEDIUM" | "LOW"
}`,

  hospital_agent: `You are MedFlow AI, the Hospital Operations Architect. Focus on efficiency, resource allocation, and predictive analytics.
- Monitor bed occupancy and discharge predictions.
- Identify bottlenecks in department workflows.
- Provide data-driven operational insights.

Response format: {"reply": "...", "operational_metric": "string", "urgency": 1-10}`,

  family_agent: `You are MedFlow AI, the Family Health Liaison. Your goal is to provide peace of mind and clear communication to loved ones.
- Translate complex medical status updates into clear, empathetic language.
- Coordinate family visits and wellness requirements.
- Maintain a bridges of communication between the clinical team and the family portal.

Response format: {"reply": "...", "sentiment": "reassuring" | "informative"}`,

  data_agent: `You are MedFlow AI, the Clinical Data Scientist. You analyze trends across the entire MedFlow population while strictly adhering to HIPAA and privacy standards.
- Detect disease outbreaks or health trends in specific demographics.
- Generate population health reports for administrators.
- Focus on actionable predictive insights.

Response format: {"reply": "...", "insight_score": 0.0-1.0}`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agent_type, message, user_message, patient_context, conversation_history, user_id } = await req.json();

    const finalUserMessage = message || user_message;

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    if (!agent_type || !systemPrompts[agent_type as AgentType]) {
      return new Response(
        JSON.stringify({ error: `Invalid agent_type. Must be one of: ${Object.keys(systemPrompts).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemContent = systemPrompts[agent_type as AgentType];

    const messages = [
      { role: "system", content: systemContent },
      ...(conversation_history || []),
      {
        role: "user",
        content: `Patient Context: ${JSON.stringify(patient_context || {})}\n\nMessage: ${finalUserMessage}`
      },
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI service error", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiData = await response.json();
    const rawContent = openaiData.choices[0].message.content;

    let parsedContent;
    try {
      parsedContent = JSON.parse(rawContent);
    } catch (e) {
      console.error("Failed to parse AI JSON response:", rawContent);
      throw new Error("Invalid AI response format");
    }

    const reply = parsedContent.reply;

    // STORE IN DATABASE
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { error: dbError } = await supabase.from("chat_history").insert({
        user_id: user_id || null,
        agent_type: agent_type,
        message: finalUserMessage,
        response: reply,
        sender_type: 'user'
      });

      if (dbError) console.error("Error storing chat history:", dbError);
    }

    return new Response(
      JSON.stringify(parsedContent),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("ai-agent error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
