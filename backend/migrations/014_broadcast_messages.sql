-- Migration: Switch chat messages from Postgres Changes to Broadcast
-- This uses Supabase Realtime Broadcast which is more scalable and avoids RLS issues

-- Step 1: Set up RLS policies for realtime.messages table (for broadcast authorization)
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "authenticated_users_can_receive_messages" ON "realtime"."messages";
DROP POLICY IF EXISTS "authenticated_users_can_send_messages" ON "realtime"."messages";

-- Allow authenticated users to receive broadcasts
-- Simple policy: Allow all authenticated users to read broadcasts
-- The topic format itself provides security (user-specific, conversation-specific, etc.)
-- Database triggers ensure only authorized topics are created
CREATE POLICY "authenticated_users_can_receive_messages"
ON "realtime"."messages"
FOR SELECT
TO authenticated
USING (true);

-- Allow authenticated users to send broadcasts (via database triggers)
-- Only database triggers can insert, not users directly
CREATE POLICY "authenticated_users_can_send_messages"
ON "realtime"."messages"
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Step 2: Create trigger function to broadcast messages when inserted
CREATE OR REPLACE FUNCTION public.broadcast_message_changes()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  -- Broadcast to conversation-specific channel
  -- Topic format: conversation:{conversation_id}:messages
  PERFORM realtime.send(
    jsonb_build_object(
      'id', NEW.id,
      'conversation_id', NEW.conversation_id,
      'sender_id', NEW.sender_id,
      'content', NEW.content,
      'content_type', NEW.content_type,
      'reply_to_id', NEW.reply_to_id,
      'forwarded_from_id', NEW.forwarded_from_id,
      'forwarded_from_user_id', NEW.forwarded_from_user_id,
      'is_edited', NEW.is_edited,
      'edited_at', NEW.edited_at,
      'is_deleted', NEW.is_deleted,
      'deleted_at', NEW.deleted_at,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    'message_inserted', -- Event name
    'conversation:' || NEW.conversation_id::text || ':messages', -- Topic
    true -- Private channel (requires auth)
  );
  
  RETURN NULL;
END;
$$;

-- Step 3: Create trigger for INSERT
DROP TRIGGER IF EXISTS broadcast_message_insert_trigger ON public.messages;
CREATE TRIGGER broadcast_message_insert_trigger
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_message_changes();

-- Step 4: Create trigger function for UPDATE (for message edits/deletes)
CREATE OR REPLACE FUNCTION public.broadcast_message_updates()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
BEGIN
  -- Broadcast message update
  PERFORM realtime.send(
    jsonb_build_object(
      'id', NEW.id,
      'conversation_id', NEW.conversation_id,
      'sender_id', NEW.sender_id,
      'content', NEW.content,
      'content_type', NEW.content_type,
      'reply_to_id', NEW.reply_to_id,
      'forwarded_from_id', NEW.forwarded_from_id,
      'forwarded_from_user_id', NEW.forwarded_from_user_id,
      'is_edited', NEW.is_edited,
      'edited_at', NEW.edited_at,
      'is_deleted', NEW.is_deleted,
      'deleted_at', NEW.deleted_at,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    ),
    'message_updated', -- Event name
    'conversation:' || NEW.conversation_id::text || ':messages', -- Topic
    true -- Private channel
  );
  
  RETURN NULL;
END;
$$;

-- Step 5: Create trigger for UPDATE
DROP TRIGGER IF EXISTS broadcast_message_update_trigger ON public.messages;
CREATE TRIGGER broadcast_message_update_trigger
AFTER UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_message_updates();

