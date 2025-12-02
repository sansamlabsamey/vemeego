"""
Authentication Middleware
Validates JWT tokens and extracts user information from requests.
"""

from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.exceptions import AuthenticationError, AuthorizationError
from app.core.supabase_client import get_admin_client, verify_user_token
from app.models.user import UserRole, UserStatus

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Get current authenticated user from JWT token.

    Args:
        credentials: HTTP Bearer credentials from Authorization header

    Returns:
        dict: User data from database

    Raises:
        HTTPException: If token is invalid or user not found
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        # Verify token with Supabase
        auth_user = await verify_user_token(token)

        if not auth_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Get full user profile from database
        admin_client = get_admin_client()
        user_response = (
            admin_client.table("users")
            .select("*")
            .eq("auth_user_id", auth_user["id"])
            .single()
            .execute()
        )

        if not user_response.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User profile not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user_data = user_response.data

        # Check if user is active
        if user_data["status"] != UserStatus.ACTIVE:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User account is {user_data['status']}",
            )

        return user_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_active_user(
    current_user: dict = Depends(get_current_user),
) -> dict:
    """
    Get current active user (must have active status).

    Args:
        current_user: Current user from get_current_user

    Returns:
        dict: Active user data

    Raises:
        HTTPException: If user is not active
    """
    if current_user["status"] != UserStatus.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"User account is {current_user['status']}",
        )

    return current_user


async def get_current_user_allow_pending(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    """
    Get current authenticated user allowing pending status.
    Used for organization setup where user hasn't been approved yet.

    Args:
        credentials: HTTP Bearer credentials from Authorization header

    Returns:
        dict: User data from database

    Raises:
        HTTPException: If token is invalid or user not found
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        # Verify token with Supabase
        auth_user = await verify_user_token(token)

        if not auth_user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        # Get full user profile from database
        admin_client = get_admin_client()
        user_response = (
            admin_client.table("users")
            .select("*")
            .eq("auth_user_id", auth_user["id"])
            .single()
            .execute()
        )

        if not user_response.data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User profile not found",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user_data = user_response.data

        # Allow both active and pending users
        if user_data["status"] not in [UserStatus.ACTIVE, UserStatus.PENDING]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User account is {user_data['status']}",
            )

        return user_data

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Authentication failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def require_super_admin(
    current_user: dict = Depends(get_current_active_user),
) -> dict:
    """
    Require user to be super-admin.

    Args:
        current_user: Current active user

    Returns:
        dict: Super-admin user data

    Raises:
        HTTPException: If user is not super-admin
    """
    if current_user["role"] != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super-admin access required",
        )

    return current_user


async def require_org_admin(
    current_user: dict = Depends(get_current_active_user),
) -> dict:
    """
    Require user to be org-admin or super-admin.

    Args:
        current_user: Current active user

    Returns:
        dict: Org-admin or super-admin user data

    Raises:
        HTTPException: If user is not org-admin or super-admin
    """
    if current_user["role"] not in [UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Organization admin access required",
        )

    return current_user


async def require_role(required_roles: list[str]):
    """
    Require user to have one of the specified roles.

    Args:
        required_roles: List of allowed roles

    Returns:
        Function that checks user role
    """

    async def role_checker(current_user: dict = Depends(get_current_active_user)) -> dict:
        if current_user["role"] not in required_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role: {', '.join(required_roles)}",
            )
        return current_user

    return role_checker


async def verify_organization_access(
    organization_id: str,
    current_user: dict = Depends(get_current_active_user),
) -> bool:
    """
    Verify that user has access to the specified organization.

    Args:
        organization_id: Organization ID to check
        current_user: Current active user

    Returns:
        bool: True if user has access

    Raises:
        HTTPException: If user doesn't have access
    """
    # Super-admin has access to all organizations
    if current_user["role"] == UserRole.SUPER_ADMIN:
        return True

    # Check if user belongs to the organization
    if str(current_user.get("organization_id")) != str(organization_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this organization",
        )

    return True


async def get_optional_user(
    authorization: Optional[str] = Header(None),
) -> Optional[dict]:
    """
    Get current user if authenticated, otherwise return None.
    Useful for endpoints that can work with or without authentication.

    Args:
        authorization: Authorization header

    Returns:
        Optional[dict]: User data if authenticated, None otherwise
    """
    if not authorization or not authorization.startswith("Bearer "):
        return None

    try:
        token = authorization.replace("Bearer ", "")
        auth_user = await verify_user_token(token)

        if not auth_user:
            return None

        admin_client = get_admin_client()
        user_response = (
            admin_client.table("users")
            .select("*")
            .eq("auth_user_id", auth_user["id"])
            .single()
            .execute()
        )

        if not user_response.data:
            return None

        return user_response.data

    except Exception:
        return None
