import { supabase } from "@/integrations/supabase/client";

export type AgentType = "patient_agent" | "doctor_agent" | "hospital_agent" | "family_agent" | "data_agent";

export interface PatientContext {
  name?: string;
  age?: number;
  blood_type?: string;
  allergies?: string[];
  medications?: string[];
  conditions?: string[];
  [key: string]: unknown;
}

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentResponse {
  reply: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export async function callAgent({
  agent_type,
  message,
  patient_context,
  conversation_history,
}: {
  agent_type: AgentType;
  message: string;
  patient_context?: PatientContext;
  conversation_history?: ConversationMessage[];
}): Promise<AgentResponse> {
  const { data, error } = await supabase.functions.invoke("ai-agent", {
    body: { agent_type, message, patient_context, conversation_history },
  });

  if (error) {
    console.error("AI agent call failed:", error);
    throw new Error(error.message || "Failed to call AI agent");
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data as AgentResponse;
}
