-- Migration: Use Broadcast for call notifications instead of Postgres Changes
-- This is more scalable and avoids RLS issues

-- Step 1: Create trigger function to broadcast call invitations when a participant is invited
CREATE OR REPLACE FUNCTION public.broadcast_call_invitation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
  meeting_record RECORD;
BEGIN
  -- Only broadcast for instant meetings (calls)
  SELECT * INTO meeting_record
  FROM meetings
  WHERE id = NEW.meeting_id;
  
  -- Only broadcast if it's an instant meeting and status is 'invited'
  IF meeting_record.type = 'instant' AND NEW.status = 'invited' THEN
    -- Broadcast to user-specific channel
    -- Topic format: user:{user_id}:calls
    PERFORM realtime.send(
      jsonb_build_object(
        'participant_id', NEW.id,
        'meeting_id', NEW.meeting_id,
        'user_id', NEW.user_id,
        'status', NEW.status,
        'meeting_title', meeting_record.title,
        'host_id', meeting_record.host_id,
        'created_at', NEW.created_at
      ),
      'call_invitation', -- Event name
      'user:' || NEW.user_id::text || ':calls', -- Topic
      true -- Private channel (requires auth)
    );
  END IF;
  
  RETURN NULL;
END;
$$;

-- Step 2: Create trigger for INSERT on meeting_participants
DROP TRIGGER IF EXISTS broadcast_call_invitation_trigger ON public.meeting_participants;
CREATE TRIGGER broadcast_call_invitation_trigger
AFTER INSERT ON public.meeting_participants
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_call_invitation();

-- Step 3: Create trigger function to broadcast call status updates
CREATE OR REPLACE FUNCTION public.broadcast_call_status_update()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
  meeting_record RECORD;
BEGIN
  -- Only broadcast for instant meetings (calls)
  SELECT * INTO meeting_record
  FROM meetings
  WHERE id = NEW.meeting_id;
  
  -- Only broadcast if it's an instant meeting and status changed to accepted/declined
  IF meeting_record.type = 'instant' AND 
     (NEW.status = 'accepted' OR NEW.status = 'declined') AND
     (OLD.status IS NULL OR OLD.status != NEW.status) THEN
    -- Broadcast to meeting-specific channel so caller can see the response
    -- Topic format: meeting:{meeting_id}:status
    PERFORM realtime.send(
      jsonb_build_object(
        'participant_id', NEW.id,
        'meeting_id', NEW.meeting_id,
        'user_id', NEW.user_id,
        'status', NEW.status,
        'joined_at', NEW.joined_at,
        'updated_at', NEW.updated_at
      ),
      'call_status_update', -- Event name
      'meeting:' || NEW.meeting_id::text || ':status', -- Topic
      true -- Private channel
    );
  END IF;
  
  RETURN NULL;
END;
$$;

-- Step 4: Create trigger for UPDATE on meeting_participants
DROP TRIGGER IF EXISTS broadcast_call_status_update_trigger ON public.meeting_participants;
CREATE TRIGGER broadcast_call_status_update_trigger
AFTER UPDATE ON public.meeting_participants
FOR EACH ROW
EXECUTE FUNCTION public.broadcast_call_status_update();

