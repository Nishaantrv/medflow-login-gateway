import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type AgentType = "patient_agent" | "doctor_agent" | "hospital_agent" | "family_agent" | "data_agent";

const systemPrompts: Record<AgentType, string> = {
  patient_agent: `You are MedFlow AI, a compassionate and knowledgeable medical assistant for patients. You help patients understand their health conditions, medications, symptoms, and provide general health guidance. Always remind patients to consult their doctor for serious concerns. Be empathetic, clear, and use simple language. If given patient context (allergies, medications, conditions), tailor your responses accordingly.`,

  doctor_agent: `You are MedFlow AI, a clinical decision support assistant for physicians. You help with differential diagnoses, treatment protocols, drug interactions, and evidence-based medicine. Provide concise, medically accurate responses. Reference clinical guidelines when applicable. You can help draft SOAP notes, suggest lab orders, and review patient histories. Always present information professionally.`,

  hospital_agent: `You are MedFlow AI, a hospital operations assistant for administrators. You help with bed management optimization, staff scheduling, resource allocation, billing inquiries, and operational efficiency. Provide data-driven recommendations and actionable insights. Be concise and focused on operational metrics.`,

  family_agent: `You are MedFlow AI, a caring health liaison for family members of patients. You help family members understand their loved one's health status, medications, treatment plans, and care instructions in simple terms. Be compassionate and reassuring while providing accurate information. Encourage them to speak with the care team for detailed medical questions.`,

  data_agent: `You are MedFlow AI, a medical data analysis assistant. You help analyze patient data, identify trends, generate summaries, and provide insights from medical records. Present data clearly and highlight important findings. Focus on actionable insights while maintaining patient privacy.`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agent_type, message, patient_context, conversation_history } = await req.json();

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

    let systemContent = systemPrompts[agent_type as AgentType];

    // Append patient context if provided
    if (patient_context) {
      systemContent += `\n\nPatient Context:\n${JSON.stringify(patient_context, null, 2)}`;
    }

    const messages = [
      { role: "system", content: systemContent },
      ...(conversation_history || []),
      { role: "user", content: message },
    ];

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ error: "AI service error", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "No response generated.";

    return new Response(
      JSON.stringify({ reply, usage: data.usage }),
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
