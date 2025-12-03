-- Migration: 004_enable_realtime_and_fix_status.sql
-- Description: Enable realtime for messaging tables and ensure user is active
-- Author: Antigravity
-- Date: 2024

-- 1. Add tables to supabase_realtime publication
-- We use DO block to avoid errors if publication doesn't exist (though it should on Supabase)
DO $$
BEGIN
    -- Add messages table
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    END IF;

    -- Add conversations table
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'conversations'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
    END IF;

    -- Add message_reactions table
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'message_reactions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;
    END IF;
END $$;

-- 2. Ensure the user is active so RLS policies pass
-- This fixes the issue where pending users can't see their own messages via realtime RLS
UPDATE users 
SET status = 'active' 
WHERE email = 'aneesh.raskar02@gmail.com';
