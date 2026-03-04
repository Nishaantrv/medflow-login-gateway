-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    title TEXT,
    agent_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add conversation_id to chat_history
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='chat_history' AND column_name='conversation_id') THEN
        ALTER TABLE chat_history ADD COLUMN conversation_id UUID REFERENCES conversations(id);
    END IF;
END $$;

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Drop policy if exists to avoid errors on retry
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own conversations') THEN
        DROP POLICY "Users can manage their own conversations" ON conversations;
    END IF;
END $$;

CREATE POLICY "Users can manage their own conversations" ON conversations
    FOR ALL USING (auth.uid() = user_id);
