"""
Organization Router
Handles organization-related API endpoints including:
- Listing organizations (super-admin)
- Getting organization details
- Updating organization subscription (super-admin)
"""

from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional

from app.core.exceptions import (
    AuthorizationError,
    BadRequestError,
    NotFoundError,
)
from app.middleware.auth import (
    get_current_active_user,
    require_super_admin,
    require_org_admin,
)
from app.models.organization import (
    OrganizationListResponse,
    OrganizationResponse,
    OrganizationSubscriptionUpdate,
    OrganizationWithStats,
)
from app.models.user import UserRole, UserResponse

router = APIRouter(prefix="/organizations", tags=["Organizations"])


@router.get("", response_model=OrganizationListResponse)
async def list_organizations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = None,
    subscription_plan: Optional[str] = None,
    current_user: dict = Depends(require_super_admin),
):
    """
    List all organizations (super-admin only).

    Returns a paginated list of organizations with optional filtering.

    **Requires super-admin authentication.**
    """
    try:
        from app.core.supabase_client import get_admin_client

        admin_client = get_admin_client()
        
        # Build query
        query = admin_client.table("organizations").select("*, users(count)", count="exact")
        
        if search:
            query = query.ilike("name", f"%{search}%")
            
        if subscription_plan:
            query = query.eq("subscription_plan", subscription_plan)
            
        # Pagination
        start = (page - 1) * page_size
        end = start + page_size - 1
        
        query = query.range(start, end).order("created_at", desc=True)
        
        response = query.execute()
        
        if not response.data:
            return {
                "organizations": [],
                "total": 0,
                "page": page,
                "page_size": page_size,
                "total_pages": 0,
            }
            
        total_count = response.count or 0
        total_pages = (total_count + page_size - 1) // page_size
        
        organizations = []
        for org in response.data:
            # Extract count from users relation if present
            # Supabase returns it as [{'count': N}]
            user_count = 0
            if "users" in org and org["users"]:
                user_count = org["users"][0]["count"]
            
            # Remove users field to match model
            if "users" in org:
                del org["users"]
                
            org["current_users"] = user_count
            organizations.append(OrganizationResponse(**org))

        return {
            "organizations": organizations,
            "total": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages,
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch organizations: {str(e)}",
        )


@router.get("/{organization_id}", response_model=OrganizationWithStats)
async def get_organization(
    organization_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Get organization details with statistics.
    
    Super-admins can view any organization.
    Org-admins/users can only view their own organization.
    """
    try:
        # Check permissions
        if current_user["role"] != UserRole.SUPER_ADMIN:
            if str(current_user["organization_id"]) != organization_id:
                raise AuthorizationError("You can only view your own organization")

        from app.core.supabase_client import get_admin_client

        admin_client = get_admin_client()
        
        # Get organization
        org_response = (
            admin_client.table("organizations")
            .select("*")
            .eq("id", organization_id)
            .single()
            .execute()
        )
        
        if not org_response.data:
            raise NotFoundError("Organization not found")
            
        org_data = org_response.data
        
        # Get stats (simplified for now)
        # In a real app, we'd query users count, storage usage, etc.
        users_count = (
            admin_client.table("users")
            .select("id", count="exact", head=True)
            .eq("organization_id", organization_id)
            .execute()
        )
        
        active_users_count = (
            admin_client.table("users")
            .select("id", count="exact", head=True)
            .eq("organization_id", organization_id)
            .eq("status", "active")
            .execute()
        )
        
        pending_users_count = (
            admin_client.table("users")
            .select("id", count="exact", head=True)
            .eq("organization_id", organization_id)
            .eq("status", "pending")
            .execute()
        )
        
        return {
            **org_data,
            "current_users": users_count.count or 0,
            "active_users": active_users_count.count or 0,
            "pending_users": pending_users_count.count or 0,
            "current_storage_gb": 0.0, # Placeholder
        }
        
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except NotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch organization details: {str(e)}",
        )


@router.get("/{organization_id}/members", response_model=list[UserResponse])
async def list_organization_members(
    organization_id: str,
    current_user: dict = Depends(get_current_active_user),
):
    """
    List all members of an organization.
    
    Returns all users belonging to the specified organization.
    Accessible by Super Admin and Org Admin of the organization.
    """
    try:
        # Check permissions
        if current_user["role"] != UserRole.SUPER_ADMIN:
            if str(current_user["organization_id"]) != organization_id:
                raise AuthorizationError("You can only view members of your own organization")

        from app.core.supabase_client import get_admin_client

        admin_client = get_admin_client()
        
        # Get users
        response = (
            admin_client.table("users")
            .select("*")
            .eq("organization_id", organization_id)
            .order("created_at", desc=True)
            .execute()
        )
        
        if not response.data:
            return []
            
        return [UserResponse(**user) for user in response.data]
        
    except AuthorizationError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch organization members: {str(e)}",
        )
