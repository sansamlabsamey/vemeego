-- Migration: 005_debug_disable_rls.sql
-- Description: Temporarily disable RLS on messages table for debugging
-- Author: Antigravity
-- Date: 2024

ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
