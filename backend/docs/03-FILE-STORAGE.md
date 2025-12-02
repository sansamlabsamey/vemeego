# File Storage Implementation Guide

## Overview
This document provides a comprehensive guide for implementing file storage using Supabase Storage in the FastAPI backend. The system handles document uploads, access control, signed URLs, and integrates with the React frontend through secure APIs.

## Table of Contents
1. [Architecture](#architecture)
2. [Storage Buckets](#storage-buckets)
3. [Backend Implementation](#backend-implementation)
4. [Security & Access Control](#security--access-control)
5. [File Validation](#file-validation)
6. [API Endpoints](#api-endpoints)
7. [Frontend Integration](#frontend-integration)
8. [Best Practices](#best-practices)

---

## Architecture

### Storage Flow
```
Frontend → FastAPI API → Supabase Storage
    ↓           ↓              ↓
Validation  Processing    S3 Storage
    ↓           ↓              ↓
Metadata    Database        Bucket
    ↓
Response with signed URL
```

### Key Principles
1. **Backend-Only Upload**: Frontend never directly uploads to Supabase Storage
2. **Signed URLs**: Use time-limited signed URLs for secure file access
3. **Validation**: Validate file type, size, and content server-side
4. **RLS Integration**: Storage bucket policies aligned with database RLS
5. **Metadata Tracking**: Store file metadata in database for querying

---

## Storage Buckets

### Bucket Organization

#### 1. User Avatars Bucket
```yaml
Name: avatars
Public: true
File Size Limit: 5 MB
Allowed MIME Types: image/jpeg, image/png, image/webp, image/gif
Path Structure: {user_id}/{filename}
RLS: Users can upload their own avatar
```

#### 2. Organization Assets Bucket
```yaml
Name: organization-assets
Public: false
File Size Limit: 10 MB
Allowed MIME Types: image/*, application/pdf
Path Structure: {organization_id}/{asset_type}/{filename}
RLS: Org admins and super admins only
```

#### 3. Meeting Documents Bucket
```yaml
Name: meeting-documents
Public: false
File Size Limit: 50 MB
Allowed MIME Types: 
  - Documents: application/pdf, application/msword, .docx, .xlsx, .pptx
  - Images: image/*
  - Archives: application/zip
Path Structure: {organization_id}/{meeting_id}/{user_id}/{filename}
RLS: Meeting participants can access
```

#### 4. Meeting Recordings Bucket
```yaml
Name: meeting-recordings
Public: false
File Size Limit: 2 GB
Allowed MIME Types: video/mp4, video/webm, audio/mpeg, audio/wav
Path Structure: {organization_id}/{meeting_id}/{recording_id}/{filename}
RLS: Organization members based on recording settings
```

#### 5. Chat Attachments Bucket
```yaml
Name: chat-attachments
Public: false
File Size Limit: 20 MB
Allowed MIME Types: image/*, application/pdf, application/zip
Path Structure: {organization_id}/{meeting_id}/{user_id}/{timestamp}_{filename}
RLS: Meeting participants can access
```

### Bucket Creation via Supabase Dashboard

1. Go to **Storage** in Supabase Dashboard
2. Click **New Bucket**
3. Configure:
   - Bucket name
   - Public/Private setting
   - File size limits
   - Allowed MIME types
4. Save and configure RLS policies

### Bucket Creation via SQL

```sql
-- Create buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('organization-assets', 'organization-assets', false, 10485760, ARRAY['image/*', 'application/pdf']),
  ('meeting-documents', 'meeting-documents', false, 52428800, ARRAY['application/pdf', 'application/msword', 'image/*']),
  ('meeting-recordings', 'meeting-recordings', false, 2147483648, ARRAY['video/mp4', 'video/webm', 'audio/mpeg']),
  ('chat-attachments', 'chat-attachments', false, 20971520, ARRAY['image/*', 'application/pdf', 'application/zip']);
```

---

## Backend Implementation

### 1. Storage Service

**File: `app/services/storage_service.py`**

```python
from typing import Optional, BinaryIO, Dict, Any, List
from fastapi import UploadFile, HTTPException, status
from app.core.supabase import supabase, supabase_admin
from app.core.security import AuthorizationError
import os
import uuid
import mimetypes
from datetime import datetime, timedelta
import magic  # python-magic for file type detection
import hashlib

class StorageService:
    """
    Service for handling file storage operations with Supabase Storage.
    """
    
    # File size limits (bytes)
    MAX_AVATAR_SIZE = 5 * 1024 * 1024  # 5 MB
    MAX_DOCUMENT_SIZE = 50 * 1024 * 1024  # 50 MB
    MAX_RECORDING_SIZE = 2 * 1024 * 1024 * 1024  # 2 GB
    MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024  # 20 MB
    
    # Allowed MIME types
    ALLOWED_IMAGE_TYPES = [
        'image/jpeg', 'image/png', 'image/webp', 'image/gif'
    ]
    
    ALLOWED_DOCUMENT_TYPES = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain',
    ]
    
    ALLOWED_VIDEO_TYPES = [
        'video/mp4', 'video/webm', 'video/quicktime'
    ]
    
    ALLOWED_AUDIO_TYPES = [
        'audio/mpeg', 'audio/wav', 'audio/mp3'
    ]
    
    @staticmethod
    def validate_file_type(file: UploadFile, allowed_types: List[str]) -> bool:
        """
        Validate file MIME type using python-magic.
        More secure than trusting the uploaded content-type.
        """
        # Read first 2KB for magic detection
        file_start = file.file.read(2048)
        file.file.seek(0)  # Reset file pointer
        
        # Detect actual MIME type
        mime = magic.from_buffer(file_start, mime=True)
        
        # Check against allowed types
        for allowed in allowed_types:
            if allowed.endswith('/*'):
                # Wildcard matching (e.g., 'image/*')
                prefix = allowed[:-2]
                if mime.startswith(prefix):
                    return True
            elif mime == allowed:
                return True
        
        return False
    
    @staticmethod
    def validate_file_size(file: UploadFile, max_size: int) -> bool:
        """
        Validate file size.
        """
        file.file.seek(0, 2)  # Seek to end
        size = file.file.tell()
        file.file.seek(0)  # Reset
        
        return size <= max_size
    
    @staticmethod
    def generate_safe_filename(original_filename: str) -> str:
        """
        Generate safe filename with UUID prefix.
        """
        # Get file extension
        _, ext = os.path.splitext(original_filename)
        
        # Generate UUID-based filename
        safe_name = f"{uuid.uuid4()}{ext.lower()}"
        
        return safe_name
    
    @staticmethod
    def calculate_file_hash(file: BinaryIO) -> str:
        """
        Calculate SHA-256 hash of file content.
        """
        sha256_hash = hashlib.sha256()
        
        # Read file in chunks
        for chunk in iter(lambda: file.read(4096), b""):
            sha256_hash.update(chunk)
        
        file.seek(0)  # Reset file pointer
        
        return sha256_hash.hexdigest()
    
    @staticmethod
    async def upload_avatar(
        user_id: str,
        file: UploadFile
    ) -> Dict[str, Any]:
        """
        Upload user avatar to avatars bucket.
        """
        # Validate file type
        if not StorageService.validate_file_type(file, StorageService.ALLOWED_IMAGE_TYPES):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file type. Only images are allowed."
            )
        
        # Validate file size
        if not StorageService.validate_file_size(file, StorageService.MAX_AVATAR_SIZE):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File too large. Maximum size is {StorageService.MAX_AVATAR_SIZE / 1024 / 1024}MB."
            )
        
        # Generate safe filename
        safe_filename = StorageService.generate_safe_filename(file.filename)
        storage_path = f"{user_id}/{safe_filename}"
        
        # Upload to Supabase Storage
        try:
            file_content = await file.read()
            
            response = supabase.storage.from_("avatars").upload(
                path=storage_path,
                file=file_content,
                file_options={
                    "content-type": file.content_type,
                    "cache-control": "3600",
                    "upsert": "true"  # Replace if exists
                }
            )
            
            # Get public URL (avatars bucket is public)
            public_url = supabase.storage.from_("avatars").get_public_url(storage_path)
            
            # Update user avatar_url in database
            await supabase.table("users").update({
                "avatar_url": public_url,
                "updated_at": "now()"
            }).eq("id", user_id).execute()
            
            return {
                "url": public_url,
                "path": storage_path,
                "filename": safe_filename,
                "size": len(file_content)
            }
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload avatar: {str(e)}"
            )
    
    @staticmethod
    async def upload_meeting_document(
        user_id: str,
        organization_id: str,
        meeting_id: str,
        file: UploadFile
    ) -> Dict[str, Any]:
        """
        Upload document to meeting-documents bucket.
        """
        # Validate file type
        allowed_types = (
            StorageService.ALLOWED_DOCUMENT_TYPES + 
            StorageService.ALLOWED_IMAGE_TYPES
        )
        
        if not StorageService.validate_file_type(file, allowed_types):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file type."
            )
        
        # Validate file size
        if not StorageService.validate_file_size(file, StorageService.MAX_DOCUMENT_SIZE):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File too large. Maximum size is {StorageService.MAX_DOCUMENT_SIZE / 1024 / 1024}MB."
            )
        
        # Generate safe filename and path
        safe_filename = StorageService.generate_safe_filename(file.filename)
        storage_path = f"{organization_id}/{meeting_id}/{user_id}/{safe_filename}"
        
        try:
            file_content = await file.read()
            file_size = len(file_content)
            
            # Calculate file hash for deduplication/verification
            from io import BytesIO
            file_hash = StorageService.calculate_file_hash(BytesIO(file_content))
            
            # Upload to Supabase Storage
            response = supabase.storage.from_("meeting-documents").upload(
                path=storage_path,
                file=file_content,
                file_options={
                    "content-type": file.content_type,
                    "cache-control": "3600",
                    "upsert": "false"
                }
            )
            
            # Store metadata in database
            file_record = await supabase.table("files").insert({
                "uploaded_by_user_id": user_id,
                "organization_id": organization_id,
                "meeting_id": meeting_id,
                "file_name": file.filename,
                "file_size_bytes": file_size,
                "mime_type": file.content_type,
                "file_extension": os.path.splitext(file.filename)[1],
                "storage_bucket": "meeting-documents",
                "storage_path": storage_path,
                "file_category": StorageService._categorize_file(file.content_type),
                "access_level": "organization",
                "upload_status": "completed",
                "metadata": {
                    "original_filename": file.filename,
                    "file_hash": file_hash
                }
            }).execute()
            
            return {
                "file_id": file_record.data[0]["id"],
                "filename": file.filename,
                "size": file_size,
                "path": storage_path,
                "mime_type": file.content_type
            }
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to upload document: {str(e)}"
            )
    
    @staticmethod
    async def get_signed_url(
        bucket: str,
        path: str,
        expires_in: int = 3600
    ) -> str:
        """
        Generate signed URL for private file access.
        
        Args:
            bucket: Storage bucket name
            path: File path in bucket
            expires_in: URL expiration time in seconds (default 1 hour)
        
        Returns:
            Signed URL string
        """
        try:
            response = supabase.storage.from_(bucket).create_signed_url(
                path=path,
                expires_in=expires_in
            )
            
            if not response or 'signedURL' not in response:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="File not found"
                )
            
            return response['signedURL']
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to generate signed URL: {str(e)}"
            )
    
    @staticmethod
    async def download_file(
        bucket: str,
        path: str
    ) -> bytes:
        """
        Download file content from storage.
        """
        try:
            response = supabase.storage.from_(bucket).download(path)
            return response
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found"
            )
    
    @staticmethod
    async def delete_file(
        bucket: str,
        path: str,
        file_id: Optional[str] = None
    ) -> bool:
        """
        Delete file from storage and update database.
        """
        try:
            # Delete from storage
            supabase.storage.from_(bucket).remove([path])
            
            # Soft delete in database
            if file_id:
                await supabase.table("files").update({
                    "is_deleted": True,
                    "deleted_at": "now()"
                }).eq("id", file_id).execute()
            
            return True
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to delete file: {str(e)}"
            )
    
    @staticmethod
    async def list_files(
        bucket: str,
        prefix: str = "",
        limit: int = 100,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        List files in a bucket with optional prefix filter.
        """
        try:
            response = supabase.storage.from_(bucket).list(
                path=prefix,
                options={
                    "limit": limit,
                    "offset": offset,
                    "sortBy": {
                        "column": "created_at",
                        "order": "desc"
                    }
                }
            )
            
            return response
            
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to list files: {str(e)}"
            )
    
    @staticmethod
    def _categorize_file(mime_type: str) -> str:
        """
        Categorize file based on MIME type.
        """
        if mime_type.startswith('image/'):
            return 'image'
        elif mime_type.startswith('video/'):
            return 'video'
        elif mime_type.startswith('audio/'):
            return 'audio'
        elif mime_type in StorageService.ALLOWED_DOCUMENT_TYPES:
            return 'document'
        else:
            return 'other'
```

---

## Security & Access Control

### Storage RLS Policies

#### 1. Avatars Bucket (Public)

```sql
-- Users can upload to their own folder
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Anyone can view avatars (public bucket)
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');
```

#### 2. Meeting Documents Bucket (Private)

```sql
-- Users can upload to their organization's meetings
CREATE POLICY "Users upload meeting documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'meeting-documents'
    AND (storage.foldername(name))[1] IN (
        SELECT organization_id::text FROM public.users
        WHERE id = auth.uid()
    )
);

-- Users can view documents in their organization's meetings
CREATE POLICY "Users view organization meeting documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'meeting-documents'
    AND (storage.foldername(name))[1] IN (
        SELECT organization_id::text FROM public.users
        WHERE id = auth.uid()
    )
);

-- Users can delete their own uploaded documents
CREATE POLICY "Users delete own documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'meeting-documents'
    AND (storage.foldername(name))[3] = auth.uid()::text
);

-- Org admins can delete any documents in their org
CREATE POLICY "Org admins delete org documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'meeting-documents'
    AND (storage.foldername(name))[1] IN (
        SELECT organization_id::text FROM public.users
        WHERE id = auth.uid()
        AND role IN ('super-admin', 'org-admin')
    )
);
```

#### 3. Meeting Recordings Bucket (Private)

```sql
-- Only hosts can upload recordings
CREATE POLICY "Hosts upload recordings"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'meeting-recordings'
    AND (storage.foldername(name))[2]::uuid IN (
        SELECT id FROM public.meetings
        WHERE host_user_id = auth.uid()
    )
);

-- Organization members can view recordings
CREATE POLICY "Organization members view recordings"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'meeting-recordings'
    AND (storage.foldername(name))[1] IN (
        SELECT organization_id::text FROM public.users
        WHERE id = auth.uid()
    )
);
```

### Application-Level Authorization

```python
# In storage_service.py

async def verify_file_access(
    user_id: str,
    user_role: str,
    organization_id: str,
    file_id: str
) -> bool:
    """
    Verify user has access to file based on business logic.
    """
    # Get file metadata
    file_response = await supabase.table("files").select(
        "organization_id, uploaded_by_user_id, meeting_id, access_level"
    ).eq("id", file_id).single().execute()
    
    if not file_response.data:
        return False
    
    file_data = file_response.data
    
    # Super admins can access everything
    if user_role == "super-admin":
        return True
    
    # Check access level
    if file_data["access_level"] == "public":
        return True
    
    if file_data["access_level"] == "private":
        return file_data["uploaded_by_user_id"] == user_id
    
    if file_data["access_level"] == "organization":
        return file_data["organization_id"] == organization_id
    
    return False
```

---

## File Validation

### 1. MIME Type Validation

```python
import magic

def validate_mime_type(file: UploadFile, allowed_types: List[str]) -> bool:
    """
    Validate MIME type using python-magic.
    Don't trust Content-Type header!
    """
    # Read file content
    file_content = file.file.read(2048)
    file.file.seek(0)
    
    # Detect actual MIME type
    mime = magic.from_buffer(file_content, mime=True)
    
    # Verify against allowed types
    return mime in allowed_types
```

### 2. File Size Validation

```python
def validate_file_size(file: UploadFile, max_size: int) -> bool:
    """
    Validate file size.
    """
    file.file.seek(0, 2)  # Seek to end
    size = file.file.tell()
    file.file.seek(0)  # Reset to beginning
    
    return size <= max_size
```

### 3. Virus Scanning (Optional)

```python
import clamd

def scan_file_for_virus(file_content: bytes) -> bool:
    """
    Scan file for viruses using ClamAV.
    Returns True if clean, False if infected.
    """
    try:
        cd = clamd.ClamdUnixSocket()
        result = cd.scan_stream(file_content)
        
        # Check result
        if result and 'stream' in result:
            status = result['stream'][0]
            return status == 'OK'
        
        return False
        
    except Exception as e:
        # Log error and fail safely
        logger.error(f"Virus scan failed: {e}")
        return False
```

### 4. Image Processing (Optional)

```python
from PIL import Image
from io import BytesIO

def optimize_image(
    file_content: bytes,
    max_width: int = 1920,
    max_height: int = 1920,
    quality: int = 85
) -> bytes:
    """
    Optimize and resize image.
    """
    img = Image.open(BytesIO(file_content))
    
    # Resize if too large
    if img.width > max_width or img.height > max_height:
        img.thumbnail((max_width, max_height), Image.LANCZOS)
    
    # Convert RGBA to RGB if needed
    if img.mode == 'RGBA':
        background = Image.new('RGB', img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[3])
        img = background
    
    # Save with compression
    output = BytesIO()
    img.save(output, format='JPEG', quality=quality, optimize=True)
    
    return output.getvalue()
```

---

## API Endpoints

### Storage Router

**File: `app/routers/storage.py`**

```python
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query
from app.core.security import get_current_user
from app.services.storage_service import StorageService
from typing import Dict, Any, Optional

router = APIRouter(prefix="/storage", tags=["Storage"])
storage_service = StorageService()

@router.post("/upload/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Upload user avatar.
    """
    return await storage_service.upload_avatar(
        user_id=current_user["id"],
        file=file
    )

@router.post("/upload/meeting-document/{meeting_id}")
async def upload_meeting_document(
    meeting_id: str,
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Upload document to meeting.
    """
    return await storage_service.upload_meeting_document(
        user_id=current_user["id"],
        organization_id=current_user["organization_id"],
        meeting_id=meeting_id,
        file=file
    )

@router.post("/upload/chat-attachment/{meeting_id}")
async def upload_chat_attachment(
    meeting_id: str,
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Upload file as chat attachment.
    """
    return await storage_service.upload_chat_attachment(
        user_id=current_user["id"],
        organization_id=current_user["organization_id"],
        meeting_id=meeting_id,
        file=file
    )

@router.get("/download/{file_id}")
async def download_file(
    file_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get signed URL for file download.
    """
    # Verify access
    has_access = await storage_service.verify_file_access(
        user_id=current_user["id"],
        user_role=current_user["role"],
        organization_id=current_user["organization_id"],
        file_id=file_id
    )
    
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Get file metadata
    file_data = await supabase.table("files").select(
        "storage_bucket, storage_path, file_name"
    ).eq("id", file_id).single().execute()
    
    if not file_data.data:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Generate signed URL
    signed_url = await storage_service.get_signed_url(
        bucket=file_data.data["storage_bucket"],
        path=file_data.data["storage_path"],
        expires_in=3600  # 1 hour
    )
    
    return {
        "url": signed_url,
        "filename": file_data.data["file_name"],
        "expires_in": 3600
    }

@router.delete("/delete/{file_id}")
async def delete_file(
    file_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Delete file.
    """
    # Get file metadata
    file_data = await supabase.table("files").select(
        "storage_bucket, storage_path, uploaded_by_user_id, organization_id"
    ).eq("id", file_id).single().execute()
    
    if not file_data.data:
        raise HTTPException(status_code=404, detail="File not found")
    
    # Check permission
    can_delete = (
        current_user["role"] == "super-admin" or
        file_data.data["uploaded_by_user_id"] == current_user["id"] or
        (current_user["role"] == "org-admin" and 
         file_data.data["organization_id"] == current_user["organization_id"])
    )
    
    if not can_delete:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Delete file
    await storage_service.delete_file(
        bucket=file_data.data["storage_bucket"],
        path=file_data.data["storage_path"],
        file_id=file_id
    )
    
    return {"message": "File deleted successfully"}

@router.get("/list")
async def list_files(
    meeting_id: Optional[str] = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    List files with optional filters.
    """
    query = supabase.table("files").select(
        "id, file_name, file_size_bytes, mime_type, file_category, "
        "created_at, uploaded_by_user_id, meeting_id"
    )
    
    # Filter by organization
    query = query.eq("organization_id", current_user["organization_id"])
    
    # Optional meeting filter
    if meeting_id:
        query = query.eq("meeting_id", meeting_id)
    
    # Filter out deleted files
    query = query.eq("is_deleted", False)
    
    # Pagination
    query = query.range(offset, offset + limit - 1)
    
    # Order by created_at desc
    query = query.order("created_at", desc=True)
    
    response = await query.execute()
    
    return {
        "files": response.data,
        "count": len(response.data),
        "limit": limit,
        "offset": offset
    }
```

---

## Frontend Integration

### 1. File Upload Component

```typescript
// components/FileUpload.tsx
import React, { useState } from 'react';
import axios from 'axios';

interface FileUploadProps {
  uploadType: 'avatar' | 'document' | 'attachment';
  meetingId?: string;
  onUploadComplete: (fileData: any) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  uploadType,
  meetingId,
  onUploadComplete
}) => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      let endpoint = '/api/storage/upload/';
      switch (uploadType) {
        case 'avatar':
          endpoint += 'avatar';
          break;
        case 'document':
          endpoint += `meeting-document/${meetingId}`;
          break;
        case 'attachment':
          endpoint += `chat-attachment/${meetingId}`;
          break;
      }
      
      const response = await axios.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total!
          );
          setProgress(percentCompleted);
        }
      });
      
      onUploadComplete(response.data);
      
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };
  
  return (
    <div>
      <input
        type="file"
        onChange={handleFileChange}
        disabled={uploading}
      />
      {uploading && (
        <div className="progress-bar">
          <div style={{ width: `${progress}%` }}>{progress}%</div>
        </div>
      )}
    </div>
  );
};
```

### 2. File Download Hook

```typescript
// hooks/useFileDownload.ts
import { useState } from 'react';
import axios from 'axios';

export const useFileDownload = () => {
  const [downloading, setDownloading] = useState(false);
  
  const downloadFile = async (fileId: string, filename: string) => {
    setDownloading(true);
    
    try {
      // Get signed URL
      const { data } = await axios.get(
        `/api/storage/download/${fileId}`,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        }
      );
      
      // Download file from signed URL
      const response = await axios.get(data.url, {
        responseType: 'blob'
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };
  
  return { downloadFile, downloading };
};
```

### 3. File List Component

```typescript
// components/FileList.tsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useFileDownload } from '../hooks/useFileDownload';

interface File {
  id: string;
  file_name: string;
  file_size_bytes: number;
  mime_type: string;
  created_at: string;
}

export const FileList: React.FC<{ meetingId?: string }> = ({ meetingId }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const { downloadFile, downloading } = useFileDownload();
  
  useEffect(() => {
    loadFiles();
  }, [meetingId]);
  
  const loadFiles = async () => {
    try {
      const params = meetingId ? { meeting_id: meetingId } : {};
      
      const { data } = await axios.get('/api/storage/list', {
        params,
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      
      setFiles(data.files);
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };
  
  if (loading) return <div>Loading files...</div>;
  
  return (
    <div className="file-list">
      {files.map(file => (
        <div key={file.id} className="file-item">
          <div>
            <strong>{file.file_name}</strong>
            <span>{formatFileSize(file.file_size_bytes)}</span>
            <span>{new Date(file.created_at).toLocaleDateString()}</span>
          </div>
          <button
            onClick={() => downloadFile(file.id, file.file_name)}
            disabled={downloading}
          >
            Download
          </button>
        </div>
      ))}
    </div>
  );
};
```

---

## Best Practices

### 1. Security

✅ **DO:**
- Validate file types server-side using magic numbers
- Enforce file size limits
- Use signed URLs for private files
- Implement virus scanning for user uploads
- Store file metadata in database
- Use RLS policies on storage buckets
- Rate limit upload endpoints
- Log all file operations

❌ **DON'T:**
- Trust client-provided MIME types
- Allow unlimited file sizes
- Expose storage paths to clients
- Skip file validation
- Store sensitive data in public buckets
- Use predictable file names

### 2. Performance

✅ **DO:**
- Stream large files instead of loading into memory
- Implement chunked uploads for large files
- Use CDN for public files
- Compress images before storage
- Cache signed URLs (with caution)
- Implement pagination for file lists
- Use background jobs for processing

❌ **DON'T:**
- Load entire files into memory
- Generate new signed URLs on every request
- Skip compression for large images
- Return all files without pagination

### 3. User Experience

✅ **DO:**
- Show upload progress
- Support drag-and-drop
- Display file previews
- Provide clear error messages
- Allow bulk uploads
- Show file thumbnails
- Enable file search/filter

❌ **DON'T:**
- Block UI during uploads
- Show technical error messages
- Require separate uploads for each file
- Hide upload status

### 4. Storage Management

✅ **DO:**
- Implement file retention policies
- Clean up orphaned files
- Monitor storage usage
- Set up backup procedures
- Track download statistics
- Implement soft deletes
- Archive old files

❌ **DON'T:**
- Keep deleted files forever
- Ignore storage limits
- Skip backups
- Delete files permanently immediately

---

## Summary

This file storage implementation provides:
- ✅ Secure file uploads through backend
- ✅ Multiple storage buckets for different use cases
- ✅ Comprehensive validation and security
- ✅ RLS policies for access control
- ✅ Signed URLs for private file access
- ✅ Frontend integration examples
- ✅ Best practices for production use

**Next Steps:**
1. Set up storage buckets in Supabase
2. Configure RLS policies
3. Implement storage service in backend
4. Create API endpoints
5. Integrate with frontend
6. Test file operations
7. Configure virus scanning (optional)
8. Set up monitoring and alerts