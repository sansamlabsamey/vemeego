-- Add "missed" status to participant status options
-- Note: This is a comment-only migration as the status is validated in application code
-- The database doesn't enforce enum types, but we document the change here

-- Add index for faster queries on participant status
CREATE INDEX IF NOT EXISTS idx_meeting_participants_status ON meeting_participants(status);

-- Add index for meeting status queries
CREATE INDEX IF NOT EXISTS idx_meetings_status ON meetings(status);

-- Add index for meeting type queries  
CREATE INDEX IF NOT EXISTS idx_meetings_type ON meetings(type);

