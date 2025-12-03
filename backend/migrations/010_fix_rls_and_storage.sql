-- Migration: 010_fix_rls_and_storage.sql
-- Description: Fix infinite recursion in RLS policies by using SECURITY DEFINER functions
-- Author: Antigravity
-- Date: 2024

-- 1. Create Helper Functions (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.users WHERE auth_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT organization_id FROM public.users WHERE auth_user_id = auth.uid();
$$;

-- 2. Fix Users Policies (Drop recursive ones and recreate)
DROP POLICY IF EXISTS "Org-admins can read org users" ON public.users;
CREATE POLICY "Org-admins can read org users"
ON public.users FOR SELECT
USING (
  get_my_role() = 'org-admin' AND
  organization_id = get_my_org_id()
);

DROP POLICY IF EXISTS "Org-admins can update org users" ON public.users;
CREATE POLICY "Org-admins can update org users"
ON public.users FOR UPDATE
USING (
  get_my_role() = 'org-admin' AND
  organization_id = get_my_org_id()
)
WITH CHECK (
  get_my_role() = 'org-admin' AND
  organization_id = get_my_org_id()
);

DROP POLICY IF EXISTS "Org-admins can insert org users" ON public.users;
CREATE POLICY "Org-admins can insert org users"
ON public.users FOR INSERT
WITH CHECK (
  get_my_role() = 'org-admin' AND
  organization_id = get_my_org_id() AND
  role = 'user'
);

-- 3. Fix Storage Policies (Drop potentially recursive or duplicate ones)

-- Avatars
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid() = owner
);

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'avatars' AND
    auth.uid() = owner
);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'avatars' AND
    auth.uid() = owner
);

-- Chat Files
DROP POLICY IF EXISTS "Authenticated users can upload chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read chat files from conversations they are in" ON storage.objects;

CREATE POLICY "Authenticated users can upload chat files"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'chat-files' AND
    auth.role() = 'authenticated'
);

CREATE POLICY "Users can read chat files from conversations they are in"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'chat-files' AND
    EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE (c.participant1_id = auth.uid() OR c.participant2_id = auth.uid())
        AND c.id::text = (storage.foldername(name))[1]
    )
);

-- Organization Files
DROP POLICY IF EXISTS "Org members can upload shared files" ON storage.objects;
DROP POLICY IF EXISTS "Org members can read shared files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload personal files" ON storage.objects;
DROP POLICY IF EXISTS "Users can read their own personal files" ON storage.objects;

CREATE POLICY "Org members can upload shared files"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'organization-files' AND
    (storage.foldername(name))[2] = 'shared' AND
    get_my_org_id()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Org members can read shared files"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'organization-files' AND
    (storage.foldername(name))[2] = 'shared' AND
    get_my_org_id()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload personal files"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'organization-files' AND
    (storage.foldername(name))[2] = 'personal' AND
    (storage.foldername(name))[3] = auth.uid()::text AND
    get_my_org_id()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can read their own personal files"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'organization-files' AND
    (storage.foldername(name))[2] = 'personal' AND
    (storage.foldername(name))[3] = auth.uid()::text
);
