-- Migration: 006_revert_rls_disable.sql
-- Description: Re-enable RLS on messages table
-- Author: Antigravity
-- Date: 2024

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
