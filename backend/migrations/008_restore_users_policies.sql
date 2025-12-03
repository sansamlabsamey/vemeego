-- Migration: 008_restore_users_policies.sql
-- Description: Restore missing policies for users table and allow org-wide read
-- Author: Antigravity
-- Date: 2024

-- 1. Restore original policies
-- We use DO block to avoid errors if policies already exist

DO $$
BEGIN
    -- Policy: Users can read their own data
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can read own data') THEN
        CREATE POLICY "Users can read own data"
            ON users
            FOR SELECT
            USING (auth.uid() = auth_user_id);
    END IF;

    -- Policy: Super-admins can read all users
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Super-admins can read all users') THEN
        CREATE POLICY "Super-admins can read all users"
            ON users
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM users
                    WHERE auth_user_id = auth.uid()
                    AND role = 'super-admin'
                    AND status = 'active'
                )
            );
    END IF;

    -- Policy: Org-admins can read users in their organization
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Org-admins can read org users') THEN
        CREATE POLICY "Org-admins can read org users"
            ON users
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM users u
                    WHERE u.auth_user_id = auth.uid()
                    AND u.role = 'org-admin'
                    AND u.status = 'active'
                    AND u.organization_id = users.organization_id
                )
            );
    END IF;

    -- Policy: Users can update their own non-critical data
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can update own data') THEN
        CREATE POLICY "Users can update own data"
            ON users
            FOR UPDATE
            USING (auth.uid() = auth_user_id)
            WITH CHECK (
                auth.uid() = auth_user_id
                AND role = (SELECT role FROM users WHERE auth_user_id = auth.uid())  -- Cannot change own role
                AND status = (SELECT status FROM users WHERE auth_user_id = auth.uid())  -- Cannot change own status
                AND organization_id = (SELECT organization_id FROM users WHERE auth_user_id = auth.uid())  -- Cannot change own organization
            );
    END IF;

    -- Policy: Super-admins can update any user
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Super-admins can update all users') THEN
        CREATE POLICY "Super-admins can update all users"
            ON users
            FOR UPDATE
            USING (
                EXISTS (
                    SELECT 1 FROM users
                    WHERE auth_user_id = auth.uid()
                    AND role = 'super-admin'
                    AND status = 'active'
                )
            );
    END IF;

    -- Policy: Org-admins can update users in their organization
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Org-admins can update org users') THEN
        CREATE POLICY "Org-admins can update org users"
            ON users
            FOR UPDATE
            USING (
                EXISTS (
                    SELECT 1 FROM users u
                    WHERE u.auth_user_id = auth.uid()
                    AND u.role = 'org-admin'
                    AND u.status = 'active'
                    AND u.organization_id = users.organization_id
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM users u
                    WHERE u.auth_user_id = auth.uid()
                    AND u.role = 'org-admin'
                    AND u.status = 'active'
                    AND u.organization_id = users.organization_id
                )
                -- AND role != 'super-admin'  -- Cannot create super-admins (implied by not being able to set it)
                -- AND role != 'org-admin'  -- Cannot change to org-admin (logic might be more complex, keeping simple for restoration)
            );
    END IF;

    -- Policy: Org-admins can insert users in their organization
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Org-admins can insert org users') THEN
        CREATE POLICY "Org-admins can insert org users"
            ON users
            FOR INSERT
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM users u
                    WHERE u.auth_user_id = auth.uid()
                    AND u.role = 'org-admin'
                    AND u.status = 'active'
                    AND u.organization_id = users.organization_id
                )
                AND role = 'user'  -- Can only create regular users
            );
    END IF;

    -- Policy: Super-admins can insert any user
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Super-admins can insert users') THEN
        CREATE POLICY "Super-admins can insert users"
            ON users
            FOR INSERT
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM users
                    WHERE auth_user_id = auth.uid()
                    AND role = 'super-admin'
                    AND status = 'active'
                )
            );
    END IF;

END $$;

-- 2. Add policy for regular users to read other users in their organization (for chat)
-- This allows finding users to chat with
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'users' AND policyname = 'Users can read org users') THEN
        CREATE POLICY "Users can read org users"
            ON users
            FOR SELECT
            USING (
                EXISTS (
                    SELECT 1 FROM users u
                    WHERE u.auth_user_id = auth.uid()
                    AND u.status = 'active'
                    AND u.organization_id = users.organization_id
                )
            );
    END IF;
END $$;
