-- 1. Drop old tables/columns to start clean (Safely)
DROP TABLE IF EXISTS public.conversations CASCADE;

-- 2. Create conversations table referencing PROFILES instead of AUTH.USERS
-- This matches how the rest of the app uses db_id / profiles.id
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT,
    agent_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ensure chat_history has conversation_id
ALTER TABLE public.chat_history 
ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE;

-- 4. Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

-- 5. Policies using profiles link
-- We need to join with profiles to check auth.uid()
CREATE POLICY "Users can view their own conversations" 
ON public.conversations FOR SELECT 
USING (
    user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can insert their own conversations" 
ON public.conversations FOR INSERT 
WITH CHECK (
    user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

CREATE POLICY "Users can update their own conversations" 
ON public.conversations FOR UPDATE 
USING (
    user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid())
);

-- 6. Grant permissions
GRANT ALL ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
