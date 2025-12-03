-- Create storage buckets (Already executed, but keeping for reference)
-- INSERT INTO storage.buckets (id, name, public) VALUES ...

-- Policies for 'avatars' (Already executed partially, but re-listing for completeness)
-- CREATE POLICY "Avatars are publicly accessible" ...

-- Remaining Policies

-- Policies for 'avatars' (remaining)
-- Policies for 'avatars'
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'avatars' AND
    auth.uid() = owner
);

DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'avatars' AND
    auth.uid() = owner
);

DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'avatars' AND
    auth.uid() = owner
);


-- Policies for 'chat-files'
DROP POLICY IF EXISTS "Authenticated users can upload chat files" ON storage.objects;
CREATE POLICY "Authenticated users can upload chat files"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'chat-files' AND
    auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Users can read chat files from conversations they are in" ON storage.objects;
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


-- Policies for 'organization-files'

-- Shared Files: organization-files/{org_id}/shared/*
DROP POLICY IF EXISTS "Org members can upload shared files" ON storage.objects;
CREATE POLICY "Org members can upload shared files"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'organization-files' AND
    (storage.foldername(name))[2] = 'shared' AND
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
        AND u.organization_id::text = (storage.foldername(name))[1]
    )
);

DROP POLICY IF EXISTS "Org members can read shared files" ON storage.objects;
CREATE POLICY "Org members can read shared files"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'organization-files' AND
    (storage.foldername(name))[2] = 'shared' AND
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
        AND u.organization_id::text = (storage.foldername(name))[1]
    )
);

-- Personal Files: organization-files/{org_id}/personal/{user_id}/*
DROP POLICY IF EXISTS "Users can upload personal files" ON storage.objects;
CREATE POLICY "Users can upload personal files"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'organization-files' AND
    (storage.foldername(name))[2] = 'personal' AND
    (storage.foldername(name))[3] = auth.uid()::text AND
    EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
        AND u.organization_id::text = (storage.foldername(name))[1]
    )
);

DROP POLICY IF EXISTS "Users can read their own personal files" ON storage.objects;
CREATE POLICY "Users can read their own personal files"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'organization-files' AND
    (storage.foldername(name))[2] = 'personal' AND
    (storage.foldername(name))[3] = auth.uid()::text
);
