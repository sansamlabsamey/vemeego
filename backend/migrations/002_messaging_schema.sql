-- Migration: 002_messaging_schema.sql
-- Description: Create messaging schema for conversations and messages with Teams-like features
-- Author: System
-- Date: 2024

-- ============================================================================
-- TABLES
-- ============================================================================

-- Conversations table (1-on-1 conversations between users in same organization)
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    participant1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    participant2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    last_message_id UUID, -- Reference to messages table (added after messages table)
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    -- Ensure unique conversation between two users
    CONSTRAINT unique_conversation UNIQUE (participant1_id, participant2_id),
    -- Ensure participants are different
    CONSTRAINT different_participants CHECK (participant1_id != participant2_id)
);

-- Add foreign key constraint for last_message_id after messages table is created
-- This will be done after the messages table creation

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    content_type VARCHAR(50) DEFAULT 'text' CHECK (content_type IN ('text', 'markdown')),
    reply_to_id UUID REFERENCES messages(id) ON DELETE SET NULL, -- For reply functionality
    forwarded_from_id UUID REFERENCES messages(id) ON DELETE SET NULL, -- For forward functionality
    forwarded_from_user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Original sender if forwarded
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key constraint for last_message_id in conversations table
ALTER TABLE conversations
ADD CONSTRAINT conversations_last_message_id_fkey
FOREIGN KEY (last_message_id) REFERENCES messages(id) ON DELETE SET NULL;

-- Message reactions table (for emoji reactions)
CREATE TABLE IF NOT EXISTS message_reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(50) NOT NULL, -- Emoji character or unified code
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Ensure one reaction per user per message per emoji
    CONSTRAINT unique_user_message_emoji UNIQUE (message_id, user_id, emoji)
);

-- Pinned messages table
CREATE TABLE IF NOT EXISTS pinned_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    pinned_by_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Ensure one pin per message per conversation
    CONSTRAINT unique_pinned_message UNIQUE (conversation_id, message_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Conversations indexes
CREATE INDEX idx_conversations_participant1 ON conversations(participant1_id);
CREATE INDEX idx_conversations_participant2 ON conversations(participant2_id);
CREATE INDEX idx_conversations_organization ON conversations(organization_id);
CREATE INDEX idx_conversations_last_message_at ON conversations(last_message_at DESC NULLS LAST);
CREATE INDEX idx_conversations_is_deleted ON conversations(is_deleted) WHERE is_deleted = FALSE;

-- Messages indexes
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_reply_to ON messages(reply_to_id) WHERE reply_to_id IS NOT NULL;
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX idx_messages_is_deleted ON messages(is_deleted) WHERE is_deleted = FALSE;

-- Message reactions indexes
CREATE INDEX idx_message_reactions_message ON message_reactions(message_id);
CREATE INDEX idx_message_reactions_user ON message_reactions(user_id);

-- Pinned messages indexes
CREATE INDEX idx_pinned_messages_conversation ON pinned_messages(conversation_id);
CREATE INDEX idx_pinned_messages_message ON pinned_messages(message_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update conversation's last message
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_deleted = FALSE THEN
        UPDATE conversations
        SET 
            last_message_id = NEW.id,
            last_message_at = NEW.created_at,
            updated_at = NOW()
        WHERE id = NEW.conversation_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update conversation when new message is inserted
CREATE TRIGGER trigger_update_conversation_on_message
    AFTER INSERT ON messages
    FOR EACH ROW
    WHEN (NEW.is_deleted = FALSE)
    EXECUTE FUNCTION update_conversation_last_message();

-- Function to get or create conversation between two users
CREATE OR REPLACE FUNCTION get_or_create_conversation(
    p_user1_id UUID,
    p_user2_id UUID,
    p_organization_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_conversation_id UUID;
    v_user1_id UUID;
    v_user2_id UUID;
BEGIN
    -- Ensure consistent ordering (smaller ID first)
    IF p_user1_id < p_user2_id THEN
        v_user1_id := p_user1_id;
        v_user2_id := p_user2_id;
    ELSE
        v_user1_id := p_user2_id;
        v_user2_id := p_user1_id;
    END IF;

    -- Try to find existing conversation
    SELECT id INTO v_conversation_id
    FROM conversations
    WHERE participant1_id = v_user1_id
      AND participant2_id = v_user2_id
      AND is_deleted = FALSE;

    -- Create if doesn't exist
    IF v_conversation_id IS NULL THEN
        INSERT INTO conversations (participant1_id, participant2_id, organization_id)
        VALUES (v_user1_id, v_user2_id, p_organization_id)
        RETURNING id INTO v_conversation_id;
    END IF;

    RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on tables
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pinned_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CONVERSATIONS TABLE POLICIES
-- ============================================================================

-- Policy: Users can read conversations they are part of
CREATE POLICY "Users can read own conversations"
    ON conversations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = conversations.participant1_id
              AND users.auth_user_id = auth.uid()
              AND users.status = 'active'
        )
        OR
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = conversations.participant2_id
              AND users.auth_user_id = auth.uid()
              AND users.status = 'active'
        )
    );

-- Policy: Users can create conversations within their organization
CREATE POLICY "Users can create conversations in org"
    ON conversations
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = conversations.participant1_id
              AND users.auth_user_id = auth.uid()
              AND users.organization_id = conversations.organization_id
              AND users.status = 'active'
        )
        AND
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = conversations.participant2_id
              AND users.organization_id = conversations.organization_id
              AND users.status = 'active'
        )
    );

-- ============================================================================
-- MESSAGES TABLE POLICIES
-- ============================================================================

-- Policy: Users can read messages in conversations they are part of
CREATE POLICY "Users can read messages in own conversations"
    ON messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
              AND (
                  conversations.participant1_id IN (
                      SELECT id FROM users WHERE auth_user_id = auth.uid() AND status = 'active'
                  )
                  OR
                  conversations.participant2_id IN (
                      SELECT id FROM users WHERE auth_user_id = auth.uid() AND status = 'active'
                  )
              )
        )
    );

-- Policy: Users can send messages in conversations they are part of
CREATE POLICY "Users can send messages in own conversations"
    ON messages
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = messages.sender_id
              AND users.auth_user_id = auth.uid()
              AND users.status = 'active'
        )
        AND
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
              AND (
                  conversations.participant1_id = messages.sender_id
                  OR
                  conversations.participant2_id = messages.sender_id
              )
        )
    );

-- Policy: Users can update their own messages
CREATE POLICY "Users can update own messages"
    ON messages
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = messages.sender_id
              AND users.auth_user_id = auth.uid()
              AND users.status = 'active'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = messages.sender_id
              AND users.auth_user_id = auth.uid()
              AND users.status = 'active'
        )
    );

-- Policy: Users can delete their own messages (soft delete)
CREATE POLICY "Users can delete own messages"
    ON messages
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = messages.sender_id
              AND users.auth_user_id = auth.uid()
              AND users.status = 'active'
        )
    );

-- ============================================================================
-- MESSAGE_REACTIONS TABLE POLICIES
-- ============================================================================

-- Policy: Users can read reactions on messages they can see
CREATE POLICY "Users can read reactions on visible messages"
    ON message_reactions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM messages
            JOIN conversations ON conversations.id = messages.conversation_id
            WHERE messages.id = message_reactions.message_id
              AND (
                  conversations.participant1_id IN (
                      SELECT id FROM users WHERE auth_user_id = auth.uid() AND status = 'active'
                  )
                  OR
                  conversations.participant2_id IN (
                      SELECT id FROM users WHERE auth_user_id = auth.uid() AND status = 'active'
                  )
              )
        )
    );

-- Policy: Users can add reactions to messages they can see
CREATE POLICY "Users can add reactions to visible messages"
    ON message_reactions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = message_reactions.user_id
              AND users.auth_user_id = auth.uid()
              AND users.status = 'active'
        )
        AND
        EXISTS (
            SELECT 1 FROM messages
            JOIN conversations ON conversations.id = messages.conversation_id
            WHERE messages.id = message_reactions.message_id
              AND (
                  conversations.participant1_id IN (
                      SELECT id FROM users WHERE auth_user_id = auth.uid() AND status = 'active'
                  )
                  OR
                  conversations.participant2_id IN (
                      SELECT id FROM users WHERE auth_user_id = auth.uid() AND status = 'active'
                  )
              )
        )
    );

-- Policy: Users can remove their own reactions
CREATE POLICY "Users can remove own reactions"
    ON message_reactions
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = message_reactions.user_id
              AND users.auth_user_id = auth.uid()
              AND users.status = 'active'
        )
    );

-- ============================================================================
-- PINNED_MESSAGES TABLE POLICIES
-- ============================================================================

-- Policy: Users can read pinned messages in conversations they are part of
CREATE POLICY "Users can read pinned messages in own conversations"
    ON pinned_messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = pinned_messages.conversation_id
              AND (
                  conversations.participant1_id IN (
                      SELECT id FROM users WHERE auth_user_id = auth.uid() AND status = 'active'
                  )
                  OR
                  conversations.participant2_id IN (
                      SELECT id FROM users WHERE auth_user_id = auth.uid() AND status = 'active'
                  )
              )
        )
    );

-- Policy: Users can pin messages in conversations they are part of
CREATE POLICY "Users can pin messages in own conversations"
    ON pinned_messages
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = pinned_messages.pinned_by_id
              AND users.auth_user_id = auth.uid()
              AND users.status = 'active'
        )
        AND
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = pinned_messages.conversation_id
              AND (
                  conversations.participant1_id IN (
                      SELECT id FROM users WHERE auth_user_id = auth.uid() AND status = 'active'
                  )
                  OR
                  conversations.participant2_id IN (
                      SELECT id FROM users WHERE auth_user_id = auth.uid() AND status = 'active'
                  )
              )
        )
    );

-- Policy: Users can unpin messages they pinned
CREATE POLICY "Users can unpin own pinned messages"
    ON pinned_messages
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = pinned_messages.pinned_by_id
              AND users.auth_user_id = auth.uid()
              AND users.status = 'active'
        )
    );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE conversations IS '1-on-1 conversations between users in the same organization';
COMMENT ON TABLE messages IS 'Messages in conversations with support for replies, forwards, reactions, and markdown';
COMMENT ON TABLE message_reactions IS 'Emoji reactions on messages';
COMMENT ON TABLE pinned_messages IS 'Pinned messages in conversations';

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant access to tables
GRANT SELECT, INSERT, UPDATE ON conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON message_reactions TO authenticated;
GRANT SELECT, INSERT, DELETE ON pinned_messages TO authenticated;

-- Grant access to sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================

