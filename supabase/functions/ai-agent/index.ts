import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AgentType = "patient_agent" | "doctor_agent" | "hospital_agent" | "family_agent" | "data_agent";

const systemPrompts: Record<AgentType, string> = {
  patient_agent: `You are MedFlow AI. You MUST use tools to retrieve real patient data.
  
  RULES:
  1. Use 'get_available_doctors' if asked about doctors or booking.
  2. Use 'get_medications' if asked about meds/prescriptions.
  3. Use 'book_appointment' to schedule. 
  4. NEVER say "I don't have access" - you HAVE access via these tools.
  5. Respond ONLY with the JSON format below.

  RESPONSE FORMAT (JSON ONLY):
  {
    "reply": "Markdown response",
    "triage_level": "EMERGENCY" | "URGENT" | "ROUTINE" | null,
    "suggested_action": "string" | null
  }`,

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
- You have access to tools to fetch the patient's health data and medications (if permitted).
- Use 'get_medications' to see what the family member is taking (respecting privacy checks).
- Use 'book_appointment' to schedule visits on behalf of the family member.

Response format: {"reply": "...", "sentiment": "reassuring" | "informative"}`,

  data_agent: `You are MedFlow AI, the Clinical Data Scientist. You analyze trends across the entire MedFlow population while strictly adhering to HIPAA and privacy standards.
- Detect disease outbreaks or health trends in specific demographics.
- Generate population health reports for administrators.
- Focus on actionable predictive insights.

Response format: {"reply": "...", "insight_score": 0.0-1.0}`,
};

const tools = [
  {
    type: "function",
    function: {
      name: "get_available_doctors",
      description: "Get a list of available doctors and their specializations.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "book_appointment",
      description: "Book an appointment for a patient.",
      parameters: {
        type: "object",
        properties: {
          doctor_id: { type: "string", description: "The ID of the doctor" },
          date: { type: "string", description: "Date in YYYY-MM-DD format" },
          time: { type: "string", description: "Time in HH:MM format (e.g., 09:00, 14:30)" }
        },
        required: ["doctor_id", "date", "time"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_medications",
      description: "Get the list of active medications for the patient.",
      parameters: { type: "object", properties: {} }
    }
  }
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agent_type, message, user_message, patient_context, conversation_history, user_id, conversation_id } = await req.json();
    const finalUserMessage = message || user_message;

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    if (!agent_type || !systemPrompts[agent_type as AgentType]) {
      return new Response(
        JSON.stringify({ error: `Invalid agent_type. Must be one of: ${Object.keys(systemPrompts).join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[AI-AGENT] Processing ${agent_type} request`);

    // Resolve the internal stable ID for persistence
    let profileId = user_id;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
        if (authUser) {
          profileId = authUser.id; // Use Auth ID as the stable reference
          console.log(`[AI-AGENT] Using Auth ID for persistence: ${profileId}`);
        }
      } catch (authErr) {
        console.error("[AI-AGENT] Auth resolving error:", authErr);
      }
    }

    const systemContent = systemPrompts[agent_type as AgentType];
    let currentMessages = [
      { role: "system", content: systemContent },
      ...(conversation_history || []),
      {
        role: "user",
        content: `Patient Context: ${JSON.stringify(patient_context || {})}\n\nMessage: ${finalUserMessage}`
      },
    ];

    // First call to OpenAI - Remove response_format to allow easier tool triggering
    let response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: currentMessages,
        tools: tools,
        tool_choice: "auto",
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    let openaiData = await response.json();
    let assistantMessage = openaiData.choices[0].message;

    // Handle initial tool calls if any
    if (assistantMessage.tool_calls) {
      console.log(`[AI-AGENT] Using tools: ${assistantMessage.tool_calls.map((t: any) => t.function.name).join(", ")}`);
      currentMessages.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const argsData = toolCall.function.arguments;
        let args = {};
        try {
          args = JSON.parse(argsData);
        } catch (e) {
          console.error("Failed to parse tool arguments:", argsData);
        }

        let toolOutput;

        try {
          if (functionName === "get_available_doctors") {
            const { data } = await supabase.from('doctors').select('id, specialization, user:user_id(full_name)');
            toolOutput = JSON.stringify(data || []);
          } else if (functionName === "get_medications") {
            let patientId = patient_context?.id;

            if (agent_type === "family_agent") {
              const { data: member } = await supabase.from('family_members').select('patient_id, can_view_medications').eq('user_id', user_id).maybeSingle();
              if (member?.can_view_medications) {
                patientId = member.patient_id;
              } else {
                toolOutput = "Permission denied: Family member cannot view medications.";
              }
            } else if (!patientId && user_id) {
              const { data: patient } = await supabase.from('patients').select('id').eq('user_id', user_id).maybeSingle();
              patientId = patient?.id;
            }

            if (patientId && !toolOutput) {
              const { data } = await supabase.from('medications').select('*').eq('patient_id', patientId).eq('is_active', true);
              toolOutput = JSON.stringify(data || []);
            } else if (!toolOutput) {
              toolOutput = "Patient record not found.";
            }
          } else if (functionName === "book_appointment") {
            let patientId = patient_context?.id;

            if (agent_type === "family_agent") {
              const { data: member } = await supabase.from('family_members').select('patient_id').eq('user_id', user_id).maybeSingle();
              patientId = member?.patient_id;
            } else if (!patientId && user_id) {
              const { data: patient } = await supabase.from('patients').select('id').eq('user_id', user_id).maybeSingle();
              patientId = patient?.id;
            }

            if (patientId) {
              const { data, error } = await supabase.from('appointments').insert({
                patient_id: patientId,
                doctor_id: (args as any).doctor_id,
                scheduled_date: (args as any).date,
                scheduled_time: (args as any).time,
                status: 'scheduled'
              }).select().single();

              if (error) {
                toolOutput = `Error booking: ${error.message}`;
              } else {
                toolOutput = `Success: Appointment booked (ID: ${data.id})`;
              }
            } else {
              toolOutput = "Patient record not found.";
            }
          }
        } catch (err: any) {
          toolOutput = `Error executing tool: ${err.message}`;
        }

        currentMessages.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: functionName,
          content: toolOutput || "No data returned",
        });
      }

      // Second call to get final response - enforce JSON mode here
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: currentMessages,
          response_format: { type: "json_object" },
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI Final Resp Error: ${response.status} - ${errorText}`);
      }

      openaiData = await response.json();
    }

    const rawContent = openaiData.choices[0].message.content;
    if (!rawContent) {
      throw new Error("AI returned empty final content");
    }
    let parsedContent;
    try {
      if (rawContent.trim().startsWith('{')) {
        parsedContent = JSON.parse(rawContent);
      } else {
        parsedContent = { reply: rawContent };
      }
      parsedContent.ai_version = "v1.3-tools";
    } catch (e) {
      console.error("Failed to parse AI JSON response:", rawContent);
      parsedContent = { reply: rawContent, ai_version: "v1.3-tools-err" };
    }

    const reply = parsedContent.reply;

    // STORE IN DATABASE
    let finalConversationId = conversation_id;
    let dbPersistenceError = null;

    if (supabaseUrl && supabaseServiceKey) {
      try {
        // If no conversation_id, create a new conversation
        if (!finalConversationId && profileId) {
          const title = finalUserMessage.substring(0, 50) + (finalUserMessage.length > 50 ? "..." : "");
          const { data: newConv, error: convError } = await supabase.from("conversations").insert({
            user_id: profileId,
            agent_type: agent_type,
            title: title
          }).select().single();

          if (!convError && newConv) {
            finalConversationId = newConv.id;
          } else if (convError) {
            console.error("Error creating conversation:", convError);
            dbPersistenceError = `ConvError: ${convError.message}`;
          }
        }

        const { error: dbError } = await supabase.from("chat_history").insert({
          user_id: profileId || null,
          conversation_id: finalConversationId || null,
          agent_type: agent_type,
          message: finalUserMessage,
          response: reply,
          sender_type: 'user'
        });
        if (dbError) {
          console.error("Error storing chat history:", dbError);
          dbPersistenceError = dbPersistenceError ? `${dbPersistenceError} | Chat History Error: ${dbError.message}` : `Chat History Error: ${dbError.message}`;
        }

        if (finalConversationId) {
          await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", finalConversationId);
        }
      } catch (err: any) {
        console.error("Database persistence error:", err);
        dbPersistenceError = `Internal Persistence Exception: ${err.message}`;
      }
    }

    return new Response(
      JSON.stringify({ ...parsedContent, conversation_id: finalConversationId, db_error: dbPersistenceError }),
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
