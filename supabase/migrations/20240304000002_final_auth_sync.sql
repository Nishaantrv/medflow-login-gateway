-- FINAL CLEAN FIX: Use auth.users(id) as the source of truth
-- This avoids the "Profile mismatch" that has been causing invisible chats.

-- 1. Standardize the table
DROP TABLE IF EXISTS public.conversations CASCADE;

CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- LINK TO AUTH, NOT PROFILES
    title TEXT,
    agent_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Link chat history
ALTER TABLE public.chat_history 
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE;

-- 3. Standard RLS Policies
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- Policy is simple now: if my auth.uid() matches the owner, I can see it.
CREATE POLICY "Users can manage their own conversations" 
ON public.conversations FOR ALL
USING (auth.uid() = user_id);

GRANT ALL ON public.conversations TO authenticated, service_role;
