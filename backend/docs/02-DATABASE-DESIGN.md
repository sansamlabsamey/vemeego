# Database Schema & Design Guide

## Overview
This document defines the complete database schema for the video conferencing application using Supabase Postgres. The design follows best practices for relational databases, implements proper normalization, and includes comprehensive Row Level Security (RLS) policies.

## Table of Contents
1. [Schema Organization](#schema-organization)
2. [Naming Conventions](#naming-conventions)
3. [Core Tables](#core-tables)
4. [Relationships](#relationships)
5. [Indexes](#indexes)
6. [RLS Policies](#rls-policies)
7. [Functions & Triggers](#functions--triggers)
8. [Migrations](#migrations)

---

## Schema Organization

### Supabase Managed Schemas
These schemas are created and managed by Supabase:

- **`auth`**: User authentication, sessions, MFA
- **`storage`**: File storage metadata and buckets
- **`realtime`**: Real-time subscriptions and messages
- **`extensions`**: PostgreSQL extensions

**⚠️ Important**: Never modify Supabase managed schemas directly.

### Application Schemas

- **`public`**: Main application tables (default schema)
- **`audit`**: Audit logs and history (optional, for compliance)
- **`analytics`**: Analytics and reporting tables (optional)

---

## Naming Conventions

### Tables
- Use **plural nouns** in **snake_case**: `users`, `organizations`, `meeting_participants`
- Avoid abbreviations unless universally understood
- Keep names descriptive but concise (< 30 characters)

### Columns
- Use **singular nouns** in **snake_case**: `user_id`, `created_at`, `is_active`
- Primary keys: `id` (UUID)
- Foreign keys: `{table_name}_id` (e.g., `organization_id`, `user_id`)
- Timestamps: `created_at`, `updated_at`, `deleted_at`
- Boolean fields: prefix with `is_` or `has_` (e.g., `is_active`, `has_camera`)

### Constraints
- Primary key: `{table_name}_pkey`
- Foreign key: `{table_name}_{column_name}_fkey`
- Unique: `{table_name}_{column_name}_key`
- Check: `{table_name}_{column_name}_check`
- Index: `idx_{table_name}_{column_name}`

---

## Core Tables

### 1. Users Table

Extends Supabase `auth.users` with application-specific data.

```sql
CREATE TABLE public.users (
    -- Primary key references auth.users
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Basic information
    email TEXT NOT NULL UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    phone TEXT,
    bio TEXT,
    
    -- Role-based access control
    role TEXT NOT NULL DEFAULT 'user' 
        CHECK (role IN ('super-admin', 'org-admin', 'user')),
    
    -- Organization relationship
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    
    -- Account status
    is_active BOOLEAN DEFAULT true NOT NULL,
    email_verified BOOLEAN DEFAULT false NOT NULL,
    
    -- Preferences
    timezone TEXT DEFAULT 'UTC',
    language TEXT DEFAULT 'en',
    notification_preferences JSONB DEFAULT '{"email": true, "push": true, "sms": false}'::jsonb,
    
    -- Activity tracking
    last_sign_in_at TIMESTAMPTZ,
    last_active_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_organization_id ON public.users(organization_id);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_is_active ON public.users(is_active) WHERE is_active = true;
CREATE INDEX idx_users_deleted_at ON public.users(deleted_at) WHERE deleted_at IS NULL;

-- Comments
COMMENT ON TABLE public.users IS 'Application users with extended profile information';
COMMENT ON COLUMN public.users.role IS 'User role: super-admin, org-admin, or user';
COMMENT ON COLUMN public.users.notification_preferences IS 'User notification settings in JSON format';
```

### 2. Organizations Table

```sql
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basic information
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT,
    logo_url TEXT,
    website TEXT,
    
    -- Contact information
    primary_email TEXT,
    primary_phone TEXT,
    
    -- Address
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    postal_code TEXT,
    
    -- Plan and limits
    plan_type TEXT DEFAULT 'free' CHECK (plan_type IN ('free', 'starter', 'business', 'enterprise')),
    max_users INTEGER DEFAULT 10,
    max_storage_gb INTEGER DEFAULT 5,
    max_meeting_duration_minutes INTEGER DEFAULT 60,
    
    -- Status
    is_active BOOLEAN DEFAULT true NOT NULL,
    suspended_at TIMESTAMPTZ,
    suspension_reason TEXT,
    
    -- Settings
    settings JSONB DEFAULT '{
        "allow_guest_users": false,
        "require_meeting_password": false,
        "enable_recording": true,
        "enable_chat": true,
        "enable_screen_share": true,
        "default_meeting_duration": 60
    }'::jsonb,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_organizations_slug ON public.organizations(slug);
CREATE INDEX idx_organizations_is_active ON public.organizations(is_active) WHERE is_active = true;
CREATE INDEX idx_organizations_plan_type ON public.organizations(plan_type);

-- Comments
COMMENT ON TABLE public.organizations IS 'Organizations/companies using the platform';
COMMENT ON COLUMN public.organizations.slug IS 'URL-friendly unique identifier';
COMMENT ON COLUMN public.organizations.settings IS 'Organization-wide settings and preferences';
```

### 3. Meetings Table

```sql
CREATE TABLE public.meetings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Basic information
    title TEXT NOT NULL,
    description TEXT,
    meeting_code TEXT NOT NULL UNIQUE, -- e.g., "abc-def-ghi"
    
    -- Ownership
    host_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    -- Schedule
    scheduled_start_time TIMESTAMPTZ NOT NULL,
    scheduled_end_time TIMESTAMPTZ NOT NULL,
    actual_start_time TIMESTAMPTZ,
    actual_end_time TIMESTAMPTZ,
    
    -- Meeting settings
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern TEXT, -- e.g., "daily", "weekly", "monthly"
    recurrence_end_date DATE,
    
    max_participants INTEGER DEFAULT 100,
    requires_password BOOLEAN DEFAULT false,
    password_hash TEXT,
    
    allow_guests BOOLEAN DEFAULT false,
    enable_waiting_room BOOLEAN DEFAULT true,
    enable_recording BOOLEAN DEFAULT false,
    enable_chat BOOLEAN DEFAULT true,
    enable_screen_share BOOLEAN DEFAULT true,
    
    -- Status
    status TEXT DEFAULT 'scheduled' 
        CHECK (status IN ('scheduled', 'in_progress', 'ended', 'cancelled')),
    
    -- Recording
    is_recorded BOOLEAN DEFAULT false,
    recording_url TEXT,
    recording_started_at TIMESTAMPTZ,
    recording_ended_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT valid_schedule CHECK (scheduled_end_time > scheduled_start_time),
    CONSTRAINT valid_actual_times CHECK (
        actual_end_time IS NULL OR 
        actual_start_time IS NULL OR 
        actual_end_time > actual_start_time
    )
);

-- Indexes
CREATE INDEX idx_meetings_meeting_code ON public.meetings(meeting_code);
CREATE INDEX idx_meetings_host_user_id ON public.meetings(host_user_id);
CREATE INDEX idx_meetings_organization_id ON public.meetings(organization_id);
CREATE INDEX idx_meetings_status ON public.meetings(status);
CREATE INDEX idx_meetings_scheduled_start ON public.meetings(scheduled_start_time);
CREATE INDEX idx_meetings_is_recurring ON public.meetings(is_recurring) WHERE is_recurring = true;

-- Comments
COMMENT ON TABLE public.meetings IS 'Video conference meetings/rooms';
COMMENT ON COLUMN public.meetings.meeting_code IS 'Unique code for joining meeting';
COMMENT ON COLUMN public.meetings.status IS 'Current status: scheduled, in_progress, ended, cancelled';
```

### 4. Meeting Participants Table

```sql
CREATE TABLE public.meeting_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    
    -- Guest information (if user_id is NULL)
    guest_name TEXT,
    guest_email TEXT,
    
    -- Participation details
    role TEXT DEFAULT 'participant' 
        CHECK (role IN ('host', 'co-host', 'participant', 'observer')),
    
    joined_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    
    -- Permissions
    can_share_screen BOOLEAN DEFAULT true,
    can_use_chat BOOLEAN DEFAULT true,
    can_unmute BOOLEAN DEFAULT true,
    can_start_video BOOLEAN DEFAULT true,
    
    -- Status
    is_muted BOOLEAN DEFAULT false,
    is_video_on BOOLEAN DEFAULT false,
    is_screen_sharing BOOLEAN DEFAULT false,
    is_hand_raised BOOLEAN DEFAULT false,
    
    -- Connection info
    connection_quality TEXT CHECK (connection_quality IN ('excellent', 'good', 'fair', 'poor')),
    ip_address INET,
    user_agent TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT participant_identity CHECK (
        user_id IS NOT NULL OR guest_name IS NOT NULL
    ),
    CONSTRAINT valid_participation_time CHECK (
        left_at IS NULL OR joined_at IS NULL OR left_at > joined_at
    )
);

-- Indexes
CREATE INDEX idx_meeting_participants_meeting_id ON public.meeting_participants(meeting_id);
CREATE INDEX idx_meeting_participants_user_id ON public.meeting_participants(user_id);
CREATE INDEX idx_meeting_participants_joined_at ON public.meeting_participants(joined_at);

-- Comments
COMMENT ON TABLE public.meeting_participants IS 'Participants in meetings (users and guests)';
COMMENT ON COLUMN public.meeting_participants.role IS 'Participant role: host, co-host, participant, observer';
```

### 5. Messages Table

```sql
CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    sender_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    
    -- Guest sender (if sender_user_id is NULL)
    sender_guest_name TEXT,
    
    -- Message content
    content TEXT NOT NULL,
    message_type TEXT DEFAULT 'text' 
        CHECK (message_type IN ('text', 'file', 'system', 'announcement')),
    
    -- For file messages
    file_url TEXT,
    file_name TEXT,
    file_size_bytes BIGINT,
    file_mime_type TEXT,
    
    -- Threading
    parent_message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
    thread_count INTEGER DEFAULT 0,
    
    -- Status
    is_edited BOOLEAN DEFAULT false,
    edited_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    
    -- Reactions
    reactions JSONB DEFAULT '[]'::jsonb, -- [{"emoji": "👍", "user_id": "uuid", "created_at": "timestamp"}]
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT sender_identity CHECK (
        sender_user_id IS NOT NULL OR sender_guest_name IS NOT NULL
    )
);

-- Indexes
CREATE INDEX idx_messages_meeting_id ON public.messages(meeting_id);
CREATE INDEX idx_messages_sender_user_id ON public.messages(sender_user_id);
CREATE INDEX idx_messages_parent_message_id ON public.messages(parent_message_id);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX idx_messages_is_deleted ON public.messages(is_deleted) WHERE is_deleted = false;

-- Comments
COMMENT ON TABLE public.messages IS 'Chat messages within meetings';
COMMENT ON COLUMN public.messages.message_type IS 'Type: text, file, system, announcement';
COMMENT ON COLUMN public.messages.reactions IS 'Array of reaction objects with emoji and user info';
```

### 6. Meeting Invitations Table

```sql
CREATE TABLE public.meeting_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    invited_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Invitee
    invitee_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    invitee_email TEXT, -- For users not in system yet
    
    -- Status
    status TEXT DEFAULT 'pending' 
        CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
    
    responded_at TIMESTAMPTZ,
    
    -- Invitation details
    message TEXT,
    role TEXT DEFAULT 'participant' 
        CHECK (role IN ('host', 'co-host', 'participant', 'observer')),
    
    -- Token for external invites
    invitation_token TEXT UNIQUE,
    token_expires_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Constraints
    CONSTRAINT invitee_identity CHECK (
        invitee_user_id IS NOT NULL OR invitee_email IS NOT NULL
    )
);

-- Indexes
CREATE INDEX idx_meeting_invitations_meeting_id ON public.meeting_invitations(meeting_id);
CREATE INDEX idx_meeting_invitations_invitee_user_id ON public.meeting_invitations(invitee_user_id);
CREATE INDEX idx_meeting_invitations_invitee_email ON public.meeting_invitations(invitee_email);
CREATE INDEX idx_meeting_invitations_status ON public.meeting_invitations(status);
CREATE INDEX idx_meeting_invitations_token ON public.meeting_invitations(invitation_token);

-- Comments
COMMENT ON TABLE public.meeting_invitations IS 'Meeting invitations sent to users';
COMMENT ON COLUMN public.meeting_invitations.invitation_token IS 'Secure token for external invite links';
```

### 7. Files Table

```sql
CREATE TABLE public.files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    uploaded_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL, -- Optional meeting context
    
    -- File information
    file_name TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    mime_type TEXT NOT NULL,
    file_extension TEXT,
    
    -- Storage
    storage_bucket TEXT NOT NULL, -- Supabase storage bucket name
    storage_path TEXT NOT NULL, -- Path within bucket
    
    -- File type categorization
    file_category TEXT DEFAULT 'other' 
        CHECK (file_category IN ('document', 'image', 'video', 'audio', 'other')),
    
    -- Access control
    is_public BOOLEAN DEFAULT false,
    access_level TEXT DEFAULT 'organization' 
        CHECK (access_level IN ('private', 'organization', 'public')),
    
    -- Status
    upload_status TEXT DEFAULT 'completed' 
        CHECK (upload_status IN ('pending', 'uploading', 'completed', 'failed')),
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    
    -- Virus scan (if implemented)
    is_scanned BOOLEAN DEFAULT false,
    scan_result TEXT CHECK (scan_result IN ('clean', 'infected', 'pending')),
    scanned_at TIMESTAMPTZ,
    
    -- Download tracking
    download_count INTEGER DEFAULT 0,
    last_downloaded_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_files_uploaded_by_user_id ON public.files(uploaded_by_user_id);
CREATE INDEX idx_files_organization_id ON public.files(organization_id);
CREATE INDEX idx_files_meeting_id ON public.files(meeting_id);
CREATE INDEX idx_files_file_category ON public.files(file_category);
CREATE INDEX idx_files_is_deleted ON public.files(is_deleted) WHERE is_deleted = false;
CREATE INDEX idx_files_created_at ON public.files(created_at DESC);

-- Comments
COMMENT ON TABLE public.files IS 'Metadata for files stored in Supabase Storage';
COMMENT ON COLUMN public.files.storage_path IS 'Full path in Supabase Storage bucket';
```

### 8. Recordings Table

```sql
CREATE TABLE public.recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Relationships
    meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    recorded_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    -- Recording information
    title TEXT NOT NULL,
    duration_seconds INTEGER,
    file_size_bytes BIGINT,
    
    -- Storage
    storage_bucket TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    video_url TEXT,
    audio_url TEXT, -- Optional separate audio track
    transcript_url TEXT, -- Optional transcript
    
    -- Processing status
    processing_status TEXT DEFAULT 'pending' 
        CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed')),
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    
    -- Access control
    is_public BOOLEAN DEFAULT false,
    access_level TEXT DEFAULT 'organization' 
        CHECK (access_level IN ('private', 'organization', 'public')),
    requires_password BOOLEAN DEFAULT false,
    password_hash TEXT,
    
    -- View tracking
    view_count INTEGER DEFAULT 0,
    last_viewed_at TIMESTAMPTZ,
    
    -- Timestamps
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ,
    
    -- Constraints
    CONSTRAINT valid_recording_time CHECK (
        ended_at IS NULL OR ended_at > started_at
    )
);

-- Indexes
CREATE INDEX idx_recordings_meeting_id ON public.recordings(meeting_id);
CREATE INDEX idx_recordings_organization_id ON public.recordings(organization_id);
CREATE INDEX idx_recordings_recorded_by_user_id ON public.recordings(recorded_by_user_id);
CREATE INDEX idx_recordings_processing_status ON public.recordings(processing_status);
CREATE INDEX idx_recordings_created_at ON public.recordings(created_at DESC);

-- Comments
COMMENT ON TABLE public.recordings IS 'Meeting recordings metadata';
COMMENT ON COLUMN public.recordings.processing_status IS 'Video processing status';
```

### 9. Notifications Table

```sql
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Recipient
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Notification content
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    notification_type TEXT NOT NULL 
        CHECK (notification_type IN (
            'meeting_invite', 'meeting_started', 'meeting_reminder',
            'message_mention', 'file_shared', 'recording_ready',
            'system', 'other'
        )),
    
    -- Context
    related_meeting_id UUID REFERENCES public.meetings(id) ON DELETE SET NULL,
    related_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    related_file_id UUID REFERENCES public.files(id) ON DELETE SET NULL,
    
    -- Action URL
    action_url TEXT,
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    
    -- Delivery
    sent_via_email BOOLEAN DEFAULT false,
    sent_via_push BOOLEAN DEFAULT false,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_notification_type ON public.notifications(notification_type);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Comments
COMMENT ON TABLE public.notifications IS 'User notifications';
COMMENT ON COLUMN public.notifications.notification_type IS 'Type of notification for filtering and styling';
```

### 10. Audit Logs Table (Optional but Recommended)

```sql
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Actor
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    actor_email TEXT,
    actor_role TEXT,
    
    -- Action
    action TEXT NOT NULL, -- e.g., 'user.created', 'meeting.started', 'file.uploaded'
    resource_type TEXT NOT NULL, -- e.g., 'user', 'meeting', 'file'
    resource_id UUID,
    
    -- Context
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    
    -- Request details
    ip_address INET,
    user_agent TEXT,
    request_method TEXT,
    request_path TEXT,
    
    -- Changes
    old_values JSONB,
    new_values JSONB,
    
    -- Status
    status TEXT CHECK (status IN ('success', 'failure', 'pending')),
    error_message TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Indexes
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON public.audit_logs(resource_type);
CREATE INDEX idx_audit_logs_organization_id ON public.audit_logs(organization_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- Comments
COMMENT ON TABLE public.audit_logs IS 'Audit trail for security and compliance';
COMMENT ON COLUMN public.audit_logs.action IS 'Action performed, dot-notation (e.g., user.created)';
```

---

## Relationships

### Entity Relationship Diagram (ERD)

```
auth.users (Supabase)
    ↓ (1:1)
users
    ↓ (N:1)
organizations
    ↓ (1:N)
meetings
    ↓ (1:N)
├── meeting_participants
├── messages
├── meeting_invitations
├── files (optional)
└── recordings

users
    ↓ (1:N)
├── files
├── notifications
└── audit_logs (actor)
```

### Foreign Key Constraints Summary

```sql
-- users → organizations
ALTER TABLE public.users 
    ADD CONSTRAINT users_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES public.organizations(id) ON DELETE SET NULL;

-- meetings → users (host)
ALTER TABLE public.meetings 
    ADD CONSTRAINT meetings_host_user_id_fkey 
    FOREIGN KEY (host_user_id) 
    REFERENCES public.users(id) ON DELETE CASCADE;

-- meetings → organizations
ALTER TABLE public.meetings 
    ADD CONSTRAINT meetings_organization_id_fkey 
    FOREIGN KEY (organization_id) 
    REFERENCES public.organizations(id) ON DELETE CASCADE;

-- And so on for other tables...
```

---

## Indexes

### Index Strategy

1. **Primary Keys**: Automatically indexed (UUID)
2. **Foreign Keys**: Index all foreign key columns
3. **Query Patterns**: Index columns frequently used in WHERE, JOIN, ORDER BY
4. **Composite Indexes**: For queries filtering on multiple columns
5. **Partial Indexes**: For filtered queries (e.g., WHERE is_deleted = false)

### Performance Indexes

```sql
-- Composite index for common meeting queries
CREATE INDEX idx_meetings_org_status_schedule ON public.meetings(
    organization_id, status, scheduled_start_time
) WHERE deleted_at IS NULL;

-- Composite index for participant lookups
CREATE INDEX idx_participants_meeting_joined ON public.meeting_participants(
    meeting_id, joined_at
) WHERE left_at IS NULL;

-- Full-text search index for meeting titles
CREATE INDEX idx_meetings_title_search ON public.meetings 
    USING gin(to_tsvector('english', title));

-- Full-text search index for messages
CREATE INDEX idx_messages_content_search ON public.messages 
    USING gin(to_tsvector('english', content));
```

---

## RLS Policies

### Enable RLS on All Tables

```sql
-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
```

### Helper Function for Authorization

```sql
-- Function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND role = 'super-admin'
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is org admin
CREATE OR REPLACE FUNCTION public.is_org_admin(org_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.users
        WHERE id = auth.uid()
        AND organization_id = org_id
        AND role IN ('super-admin', 'org-admin')
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's organization
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT organization_id FROM public.users
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Users Table RLS Policies

```sql
-- Super admins can do everything
CREATE POLICY "super_admins_all_users" ON public.users
    FOR ALL
    USING (public.is_super_admin());

-- Org admins can view users in their org
CREATE POLICY "org_admins_view_org_users" ON public.users
    FOR SELECT
    USING (
        organization_id = public.get_user_organization_id()
        AND public.is_org_admin(organization_id)
    );

-- Org admins can update users in their org (limited fields)
CREATE POLICY "org_admins_update_org_users" ON public.users
    FOR UPDATE
    USING (
        organization_id = public.get_user_organization_id()
        AND public.is_org_admin(organization_id)
    )
    WITH CHECK (
        -- Cannot change critical fields
        role = (SELECT role FROM public.users WHERE id = users.id)
        AND organization_id = (SELECT organization_id FROM public.users WHERE id = users.id)
    );

-- Users can view their own profile
CREATE POLICY "users_view_own_profile" ON public.users
    FOR SELECT
    USING (id = auth.uid());

-- Users can update their own profile (limited fields)
CREATE POLICY "users_update_own_profile" ON public.users
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (
        -- Cannot change role, org, or status
        role = (SELECT role FROM public.users WHERE id = auth.uid())
        AND organization_id = (SELECT organization_id FROM public.users WHERE id = auth.uid())
        AND is_active = (SELECT is_active FROM public.users WHERE id = auth.uid())
    );
```

### Organizations Table RLS Policies

```sql
-- Super admins can do everything with organizations
CREATE POLICY "super_admins_all_orgs" ON public.organizations
    FOR ALL
    USING (public.is_super_admin());

-- Org admins can manage their own organization
CREATE POLICY "org_admins_manage_own_org" ON public.organizations
    FOR ALL
    USING (public.is_org_admin(id));

-- Users can view their organization
CREATE POLICY "users_view_own_org" ON public.organizations
    FOR SELECT
    USING (id = public.get_user_organization_id());
```

### Meetings Table RLS Policies

```sql
-- Super admins see all meetings
CREATE POLICY "super_admins_all_meetings" ON public.meetings
    FOR ALL
    USING (public.is_super_admin());

-- Org admins see organization meetings
CREATE POLICY "org_admins_org_meetings" ON public.meetings
    FOR SELECT
    USING (public.is_org_admin(organization_id));

-- Users can view meetings in their organization
CREATE POLICY "users_view_org_meetings" ON public.meetings
    FOR SELECT
    USING (organization_id = public.get_user_organization_id());

-- Meeting hosts can manage their meetings
CREATE POLICY "hosts_manage_own_meetings" ON public.meetings
    FOR ALL
    USING (host_user_id = auth.uid());

-- Participants can view meetings they're invited to
CREATE POLICY "participants_view_invited_meetings" ON public.meetings
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.meeting_participants
            WHERE meeting_id = meetings.id
            AND user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.meeting_invitations
            WHERE meeting_id = meetings.id
            AND invitee_user_id = auth.uid()
            AND status = 'accepted'
        )
    );
```

### Messages Table RLS Policies

```sql
-- Users can view messages in meetings they're part of
CREATE POLICY "view_meeting_messages" ON public.messages
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.meeting_participants
            WHERE meeting_id = messages.meeting_id
            AND user_id = auth.uid()
        )
    );

-- Users can insert messages in meetings they're part of
CREATE POLICY "insert_meeting_messages" ON public.messages
    FOR INSERT
    WITH CHECK (
        sender_user_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.meeting_participants
            WHERE meeting_id = messages.meeting_id
            AND user_id = auth.uid()
        )
    );

-- Users can update their own messages
CREATE POLICY "update_own_messages" ON public.messages
    FOR UPDATE
    USING (sender_user_id = auth.uid())
    WITH CHECK (sender_user_id = auth.uid());

-- Users can delete their own messages (soft delete)
CREATE POLICY "delete_own_messages" ON public.messages
    FOR UPDATE
    USING (sender_user_id = auth.uid())
    WITH CHECK (is_deleted = true);
```

### Files Table RLS Policies

```sql
-- Users can view files based on access level
CREATE POLICY "view_files_by_access_level" ON public.files
    FOR SELECT
    USING (
        is_public = true
        OR (access_level = 'organization' AND organization_id = public.get_user_organization_id())
        OR (access_level = 'private' AND uploaded_by_user_id = auth.uid())
        OR public.is_super_admin()
    );

-- Users can upload files to their organization
CREATE POLICY "users_upload_files" ON public.files
    FOR INSERT
    WITH CHECK (
        uploaded_by_user_id = auth.uid()
        AND organization_id = public.get_user_organization_id()
    );

-- Users can update their own files
CREATE POLICY "users_update_own_files" ON public.files
    FOR UPDATE
    USING (uploaded_by_user_id = auth.uid());

-- Users can delete their own files
CREATE POLICY "users_delete_own_files" ON public.files
    FOR DELETE
    USING (uploaded_by_user_id = auth.uid());
```

---

## Functions & Triggers

### 1. Auto-update Timestamps

```sql
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.meetings
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Apply to other tables...
```

### 2. Sync Auth User with Application User

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, email_verified)
    VALUES (
        NEW.id,
        NEW.email,
        NEW.email_confirmed_at IS NOT NULL
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
```

### 3. Generate Meeting Code

```sql
CREATE OR REPLACE FUNCTION public.generate_meeting_code()
RETURNS TEXT AS $$
DECLARE
    code TEXT;
    exists BOOLEAN;
BEGIN
    LOOP
        -- Generate code like "abc-def-ghi"
        code := LOWER(
            CHR(97 + FLOOR(RANDOM() * 26)::INT) ||
            CHR(97 + FLOOR(RANDOM() * 26)::INT) ||
            CHR(97 + FLOOR(RANDOM() * 26)::INT) || '-' ||
            CHR(97 + FLOOR(RANDOM() * 26)::INT) ||
            CHR(97 + FLOOR(RANDOM() * 26)::INT) ||
            CHR(97 + FLOOR(RANDOM() * 26)::INT) || '-' ||
            CHR(97 + FLOOR(RANDOM() * 26)::INT) ||
            CHR(97 + FLOOR(RANDOM() * 26)::INT) ||
            CHR(97 + FLOOR(RANDOM() * 26)::INT)
        );
        
        -- Check if code exists
        SELECT EXISTS(SELECT 1 FROM public.meetings WHERE meeting_code = code) INTO exists;
        EXIT WHEN NOT exists;
    END LOOP;
    
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate meeting code
CREATE OR REPLACE FUNCTION public.set_meeting_code()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.meeting_code IS NULL THEN
        NEW.meeting_code := public.generate_meeting_code();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_meeting_code BEFORE INSERT ON public.meetings
    FOR EACH ROW EXECUTE FUNCTION public.set_meeting_code();
```

### 4. Audit Log Trigger

```sql
CREATE OR REPLACE FUNCTION public.create_audit_log()
RETURNS TRIGGER AS $$
DECLARE
    user_role TEXT;
    user_email TEXT;
BEGIN
    SELECT role, email INTO user_role, user_email
    FROM public.users WHERE id = auth.uid();
    
    INSERT INTO public.audit_logs (
        user_id,
        actor_email,
        actor_role,
        action,
        resource_type,
        resource_id,
        old_values,
        new_values,
        status
    ) VALUES (
        auth.uid(),
        user_email,
        user_role,
        TG_TABLE_NAME || '.' || TG_OP,
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
        'success'
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to sensitive tables
CREATE TRIGGER audit_users AFTER INSERT OR UPDATE OR DELETE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();

CREATE TRIGGER audit_organizations AFTER INSERT OR UPDATE OR DELETE ON public.organizations
    FOR EACH ROW EXECUTE FUNCTION public.create_audit_log();
```

---

## Migrations

### Migration Strategy

Use Supabase CLI for migrations:

```bash
# Initialize migrations
supabase init

# Create new migration
supabase migration new initial_schema

# Apply migrations locally
supabase db push

# Apply to production
supabase db push --linked
```

### Migration File Structure

```
supabase/
├── migrations/
│   ├── 20240101000000_initial_schema.sql
│   ├── 20240101000001_create_users_table.sql
│   ├── 20240101000002_create_organizations_table.sql
│   ├── 20240101000003_create_meetings_table.sql
│   ├── 20240101000004_create_rls_policies.sql
│   └── 20240101000005_create_functions_triggers.sql
└── seed.sql
```

### Seed Data Example

```sql
-- seed.sql

-- Insert default organization
INSERT INTO public.organizations (id, name, slug, plan_type)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'Default Organization', 'default', 'free');

-- Insert super admin (after auth.users created via Supabase Auth)
-- This would be done programmatically after user signs up
```

---

## Best Practices

### 1. Data Integrity
- ✅ Always use foreign key constraints
- ✅ Use CHECK constraints for enums and validation
- ✅ Set appropriate ON DELETE actions (CASCADE, SET NULL, RESTRICT)
- ✅ Use NOT NULL where appropriate

### 2. Performance
- ✅ Index foreign keys
- ✅ Index frequently queried columns
- ✅ Use partial indexes for filtered queries
- ✅ Monitor query performance with EXPLAIN ANALYZE

### 3. Security
- ✅ Enable RLS on all public tables
- ✅ Create least-privilege policies
- ✅ Test policies thoroughly
- ✅ Use SECURITY DEFINER carefully
- ✅ Never expose sensitive data in policies

### 4. Maintenance
- ✅ Use migrations for schema changes
- ✅ Version control all schema changes
- ✅ Document complex queries and logic
- ✅ Regular backup and recovery testing
- ✅ Monitor database size and performance

---

## Summary

This database schema provides:
- ✅ Comprehensive data model for video conferencing
- ✅ Proper normalization and relationships
- ✅ Role-based access control via RLS
- ✅ Audit logging for compliance
- ✅ Scalable architecture
- ✅ Security best practices
- ✅ Performance optimization

**Next Steps:**
1. Create migration files
2. Set up local database
3. Test RLS policies
4. Implement API layer (see `05-API-DESIGN.md`)