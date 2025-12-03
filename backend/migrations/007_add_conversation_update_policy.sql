-- Migration: 007_add_conversation_update_policy.sql
-- Description: Add UPDATE policy for conversations table
-- Author: Antigravity
-- Date: 2024

CREATE POLICY "Users can update own conversations"
    ON conversations
    FOR UPDATE
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
