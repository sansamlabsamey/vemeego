from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional, List, Any
from ..core.supabase_client import get_client, get_admin_client
from ..routers.auth import get_current_active_user

router = APIRouter(
    prefix="/storage",
    tags=["storage"],
    responses={404: {"description": "Not found"}},
)

class StorageSignedUrlRequest(BaseModel):
    bucket: str
    path: str

@router.post("/upload-url")
async def create_upload_url(
    request: StorageSignedUrlRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Generate a signed upload URL for a file.
    """
    try:
        # Permission checks
        if request.bucket == "avatars":
            # Users can only upload to their own folder
            if not request.path.startswith(f"{current_user['id']}/"):
                raise HTTPException(status_code=403, detail="You can only upload avatars to your own folder")
        elif request.bucket in ["organization-files", "chat-files"]:
            # Users can only upload to their organization's folder
            if not request.path.startswith(f"{current_user['organization_id']}/"):
                raise HTTPException(status_code=403, detail="You can only upload files to your organization's folder")
        else:
            raise HTTPException(status_code=400, detail="Invalid bucket")

        supabase_client = get_admin_client()
        res = supabase_client.storage.from_(request.bucket).create_signed_upload_url(request.path)
        
        # Check for error in response if it returns a dict with error
        if isinstance(res, dict) and "error" in res:
             raise HTTPException(status_code=500, detail=res["error"])
             
        return res
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/url")
async def get_file_url(
    request: StorageSignedUrlRequest,
    current_user: dict = Depends(get_current_active_user)
):
    """
    Generate a signed URL for viewing/downloading a file.
    """
    try:
        # Permission checks
        if request.bucket in ["organization-files", "chat-files"]:
            # Users can only access files in their organization's folder
            if not request.path.startswith(f"{current_user['organization_id']}/"):
                raise HTTPException(status_code=403, detail="You can only access files in your organization's folder")
        
        # 60 seconds expiry for the signed URL
        supabase_client = get_admin_client()
        res = supabase_client.storage.from_(request.bucket).create_signed_url(request.path, 60)
        
        # Supabase python client returns string (url) or dict?
        # Usually returns dict with 'signedURL' key or similar
        return res
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list/{bucket}")
async def list_files(
    bucket: str,
    path: Optional[str] = None,
    current_user: dict = Depends(get_current_active_user)
):
    """
    List files in a bucket.
    """
    try:
        search_path = path if path else ""
        
        # Permission checks
        if bucket in ["organization-files", "chat-files"]:
            # Users can only list files in their organization's folder
            if not search_path.startswith(f"{current_user['organization_id']}"):
                 # If path doesn't start with org_id, we force it or reject?
                 # If path is empty, we should probably list the org folder?
                 # But list() takes a folder path.
                 # If user asks for root, we should only show their org folder?
                 # But list() returns items in the path.
                 # If I list "", I get all org folders. I shouldn't allow that.
                 if search_path == "" or search_path is None:
                     search_path = f"{current_user['organization_id']}"
                 elif not search_path.startswith(f"{current_user['organization_id']}"):
                     raise HTTPException(status_code=403, detail="You can only list files in your organization's folder")
        
        supabase_client = get_admin_client()
        res = supabase_client.storage.from_(bucket).list(search_path)
        return res
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
