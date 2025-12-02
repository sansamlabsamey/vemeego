-- Migration: 001_initial_schema.sql
-- Description: Create initial database schema for users and organizations
-- Author: System
-- Date: 2024

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

-- User role enum
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('super-admin', 'org-admin', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- User status enum
DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'pending', 'suspended', 'deleted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Subscription plan enum
DO $$ BEGIN
    CREATE TYPE subscription_plan AS ENUM ('FREE', 'BASIC', 'PREMIUM', 'ENTERPRISE');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Subscription status enum
DO $$ BEGIN
    CREATE TYPE subscription_status AS ENUM ('ACTIVE', 'INACTIVE', 'CANCELLED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url TEXT,
    subscription_plan subscription_plan DEFAULT 'FREE',
    subscription_status subscription_status DEFAULT 'ACTIVE',
    subscription_end_date TIMESTAMP WITH TIME ZONE,
    max_users INTEGER DEFAULT 10,
    max_storage_gb INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE
);

-- Users table (extends auth.users)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    status user_status NOT NULL DEFAULT 'pending',
    face_id VARCHAR(255) UNIQUE,
    url TEXT,
    current_status INTEGER DEFAULT 1000,
    phone_number VARCHAR(50),
    job_title VARCHAR(255),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    transcription_enabled BOOLEAN DEFAULT FALSE,
    transcription_language VARCHAR(10) DEFAULT 'en',
    last_login TIMESTAMP WITH TIME ZONE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Users indexes
CREATE INDEX idx_users_auth_user_id ON users(auth_user_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_organization_id ON users(organization_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_is_deleted ON users(is_deleted);

-- Organizations indexes
CREATE INDEX idx_organizations_is_deleted ON organizations(is_deleted);
CREATE INDEX idx_organizations_subscription_status ON organizations(subscription_status);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users table
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for organizations table
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON organizations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTION: Sync auth.users with public.users
-- ============================================================================

-- This function automatically creates a user record in public.users
-- when a new user signs up in auth.users
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (
        auth_user_id,
        email,
        user_name,
        role,
        status,
        is_verified
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'user_name', NEW.email),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'user'),
        COALESCE((NEW.raw_user_meta_data->>'status')::user_status, 'pending'),
        NEW.email_confirmed_at IS NOT NULL
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync new auth users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- FUNCTION: Update user verification status
-- ============================================================================

-- This function updates the is_verified status when email is confirmed
CREATE OR REPLACE FUNCTION handle_user_email_verified()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
        UPDATE public.users
        SET is_verified = TRUE
        WHERE auth_user_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to sync email verification
CREATE TRIGGER on_auth_user_email_verified
    AFTER UPDATE OF email_confirmed_at ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_user_email_verified();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- USERS TABLE POLICIES
-- ============================================================================

-- Policy: Users can read their own data
CREATE POLICY "Users can read own data"
    ON users
    FOR SELECT
    USING (auth.uid() = auth_user_id);

-- Policy: Super-admins can read all users
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

-- Policy: Org-admins can read users in their organization
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

-- Policy: Users can update their own non-critical data
CREATE POLICY "Users can update own data"
    ON users
    FOR UPDATE
    USING (auth.uid() = auth_user_id)
    WITH CHECK (
        auth.uid() = auth_user_id
        AND role = OLD.role  -- Cannot change own role
        AND status = OLD.status  -- Cannot change own status
        AND organization_id = OLD.organization_id  -- Cannot change own organization
    );

-- Policy: Super-admins can update any user
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

-- Policy: Org-admins can update users in their organization
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
        AND role != 'super-admin'  -- Cannot create super-admins
        AND role != 'org-admin'  -- Cannot change to org-admin
    );

-- Policy: Org-admins can insert users in their organization
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

-- Policy: Super-admins can insert any user
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

-- ============================================================================
-- ORGANIZATIONS TABLE POLICIES
-- ============================================================================

-- Policy: Users can read their own organization
CREATE POLICY "Users can read own organization"
    ON organizations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.organization_id = organizations.id
            AND users.auth_user_id = auth.uid()
        )
    );

-- Policy: Super-admins can read all organizations
CREATE POLICY "Super-admins can read all organizations"
    ON organizations
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_user_id = auth.uid()
            AND role = 'super-admin'
            AND status = 'active'
        )
    );

-- Policy: Org-admins can update their organization
CREATE POLICY "Org-admins can update own organization"
    ON organizations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.organization_id = organizations.id
            AND users.auth_user_id = auth.uid()
            AND users.role = 'org-admin'
            AND users.status = 'active'
        )
    );

-- Policy: Super-admins can update any organization
CREATE POLICY "Super-admins can update all organizations"
    ON organizations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE auth_user_id = auth.uid()
            AND role = 'super-admin'
            AND status = 'active'
        )
    );

-- Policy: Anyone can insert organization (for signup)
CREATE POLICY "Allow organization creation on signup"
    ON organizations
    FOR INSERT
    WITH CHECK (true);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS user_role AS $$
DECLARE
    user_role_value user_role;
BEGIN
    SELECT role INTO user_role_value
    FROM users
    WHERE auth_user_id = user_id;

    RETURN user_role_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is super-admin
CREATE OR REPLACE FUNCTION is_super_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users
        WHERE auth_user_id = user_id
        AND role = 'super-admin'
        AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is org-admin
CREATE OR REPLACE FUNCTION is_org_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users
        WHERE auth_user_id = user_id
        AND role = 'org-admin'
        AND status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE organizations IS 'Organizations/companies that use the platform';
COMMENT ON TABLE users IS 'User profiles extending auth.users with additional information';

COMMENT ON COLUMN users.auth_user_id IS 'Reference to auth.users table';
COMMENT ON COLUMN users.status IS 'User account status: active, pending, suspended, deleted';
COMMENT ON COLUMN users.role IS 'User role: super-admin, org-admin, or user';
COMMENT ON COLUMN users.current_status IS 'User current status code (1000 = available, etc.)';

-- ============================================================================
-- GRANTS
-- ============================================================================

-- Grant usage on schemas
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant access to tables
GRANT SELECT, INSERT, UPDATE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON organizations TO authenticated;

-- Grant access to sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
