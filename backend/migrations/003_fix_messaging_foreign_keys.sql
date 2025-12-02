-- Migration: 003_fix_messaging_foreign_keys.sql
-- Description: Fix foreign key constraints for messages table to have explicit names
-- Author: System
-- Date: 2024

-- Drop existing foreign key constraints if they exist (they might be auto-named)
DO $$ 
BEGIN
    -- Drop reply_to_id foreign key if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%reply_to%' 
        AND conrelid = 'messages'::regclass
    ) THEN
        ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_reply_to_id_fkey;
    END IF;
    
    -- Drop forwarded_from_id foreign key if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname LIKE '%forwarded_from%' 
        AND conrelid = 'messages'::regclass
    ) THEN
        ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_forwarded_from_id_fkey;
    END IF;
END $$;

-- Add foreign key constraints with explicit names
ALTER TABLE messages
ADD CONSTRAINT messages_reply_to_id_fkey
FOREIGN KEY (reply_to_id) REFERENCES messages(id) ON DELETE SET NULL;

ALTER TABLE messages
ADD CONSTRAINT messages_forwarded_from_id_fkey
FOREIGN KEY (forwarded_from_id) REFERENCES messages(id) ON DELETE SET NULL;

-- Ensure the foreign key for forwarded_from_user_id exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'messages_forwarded_from_user_id_fkey'
        AND conrelid = 'messages'::regclass
    ) THEN
        ALTER TABLE messages
        ADD CONSTRAINT messages_forwarded_from_user_id_fkey
        FOREIGN KEY (forwarded_from_user_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END $$;

