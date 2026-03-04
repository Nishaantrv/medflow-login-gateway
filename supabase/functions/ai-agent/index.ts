import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AgentType = "patient_agent" | "doctor_agent" | "hospital_agent" | "family_agent" | "data_agent";

const systemPrompts: Record<AgentType, string> = {
  patient_agent: `You are MedFlow AI, a compassionate and knowledgeable medical assistant for patients. 

RESPONSE FORMAT:
You MUST respond with a JSON object in this exact format:
{
  "reply": "Your markdown-formatted response here",
  "triage_level": "EMERGENCY" | "URGENT" | "ROUTINE" | null
}

SYMPTOM TRIAGE: 
If a patient describes symptoms, identify the urgency level:
- EMERGENCY: For life-threatening symptoms. Advise immediate ER or 911.
- URGENT: For symptoms needing care within 24-48 hours.
- ROUTINE: For minor issues or general health questions.

Always remind patients to consult their doctor for serious concerns. If given patient context (allergies, medications, conditions), tailor your responses accordingly.`,

  doctor_agent: `You are MedFlow AI, a clinical decision support assistant for physicians.

RESPONSE FORMAT:
You MUST respond with a JSON object in this exact format:
{
  "reply": "Your professional clinical summary or response here",
  "action_items": ["item 1", "item 2"] | null
}

Provide concise, medically accurate responses. Reference clinical guidelines when applicable.`,

  hospital_agent: `You are MedFlow AI, a hospital operations assistant. Respond with a JSON object: {"reply": "..."}. Provide data-driven recommendations and actionable insights.`,

  family_agent: `You are MedFlow AI, a caring health liaison for family members. Respond with a JSON object: {"reply": "..."}. Translate medical jargon into simple terms.`,

  data_agent: `You are MedFlow AI, a medical data analysis assistant. Respond with a JSON object: {"reply": "..."}. Focus on actionable insights while maintaining patient privacy.`,
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
