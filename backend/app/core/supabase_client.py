"""
Supabase client initialization and utility functions.
Provides both regular and admin clients for Supabase operations.
"""

from functools import lru_cache
from typing import Optional

from gotrue.errors import AuthApiError
from supabase import Client, create_client

from app.core.config import settings
from app.core.logger import log_error


def _is_valid_supabase_config() -> bool:
    """Check if Supabase configuration is valid."""
    return (
        settings.SUPABASE_URL
        and settings.SUPABASE_URL != ""
        and not settings.SUPABASE_URL.startswith("https://your-project")
        and settings.SUPABASE_ANON_KEY
        and settings.SUPABASE_ANON_KEY != ""
        and settings.SUPABASE_ANON_KEY != "your-anon-key-here"
        and settings.SUPABASE_SERVICE_ROLE_KEY
        and settings.SUPABASE_SERVICE_ROLE_KEY != ""
        and settings.SUPABASE_SERVICE_ROLE_KEY != "your-service-role-key-here"
    )


class SupabaseClient:
    """Wrapper class for Supabase client operations."""

    def __init__(self):
        self._client: Optional[Client] = None
        self._admin_client: Optional[Client] = None

    @property
    def client(self) -> Client:
        """Get or create regular Supabase client with anon key."""
        if self._client is None:
            if not _is_valid_supabase_config():
                raise ValueError(
                    "Invalid Supabase configuration. Please set SUPABASE_URL, "
                    "SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in your .env file. "
                    "Get these from your Supabase project dashboard: Settings -> API"
                )
            self._client = create_client(
                supabase_url=settings.SUPABASE_URL,
                supabase_key=settings.SUPABASE_ANON_KEY,
            )
        return self._client

    @property
    def admin_client(self) -> Client:
        """Get or create admin Supabase client with service role key."""
        if self._admin_client is None:
            if not _is_valid_supabase_config():
                raise ValueError(
                    "Invalid Supabase configuration. Please set SUPABASE_URL, "
                    "SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY in your .env file. "
                    "Get these from your Supabase project dashboard: Settings -> API"
                )
            self._admin_client = create_client(
                supabase_url=settings.SUPABASE_URL,
                supabase_key=settings.SUPABASE_SERVICE_ROLE_KEY,
            )
        return self._admin_client


@lru_cache()
def get_supabase_client() -> SupabaseClient:
    """
    Get cached Supabase client instance.

    Returns:
        SupabaseClient: Singleton instance of Supabase client wrapper
    """
    return SupabaseClient()


def clear_supabase_client_cache():
    """
    Clear the cached Supabase client instance.
    Useful when configuration changes or after schema updates.
    """
    get_supabase_client.cache_clear()


def get_client() -> Client:
    """
    Get regular Supabase client (with anon key).
    Use this for user-facing operations.

    Returns:
        Client: Supabase client instance
    """
    return get_supabase_client().client


def get_admin_client() -> Client:
    """
    Get admin Supabase client (with service role key).
    WARNING: This bypasses RLS policies. Use with caution!

    Returns:
        Client: Supabase admin client instance
    """
    return get_supabase_client().admin_client


async def verify_user_token(token: str) -> dict:
    """
    Verify a user's JWT token and return user data.

    Args:
        token: JWT token from Authorization header

    Returns:
        dict: User data from token

    Raises:
        AuthApiError: If token is invalid or expired
    """
    try:
        client = get_client()
        # Use get_user to verify token server-side
        response = client.auth.get_user(token)

        if not response or not response.user:
            raise AuthApiError("Invalid token", 401)

        return {
            "id": response.user.id,
            "email": response.user.email,
            "role": response.user.user_metadata.get("role"),
            "email_verified": response.user.email_confirmed_at is not None,
            "user_metadata": response.user.user_metadata,
            "app_metadata": response.user.app_metadata,
        }
    except AuthApiError as e:
        raise e
    except Exception as e:
        raise AuthApiError(f"Token verification failed: {str(e)}", 401)


async def get_user_by_id(user_id: str) -> Optional[dict]:
    """
    Get user data by user ID using admin client.

    Args:
        user_id: UUID of the user

    Returns:
        dict: User data or None if not found
    """
    try:
        admin_client = get_admin_client()
        response = admin_client.auth.admin.get_user_by_id(user_id)

        if response and response.user:
            return {
                "id": response.user.id,
                "email": response.user.email,
                "role": response.user.user_metadata.get("role"),
                "email_verified": response.user.email_confirmed_at is not None,
                "user_metadata": response.user.user_metadata,
                "app_metadata": response.user.app_metadata,
                "created_at": response.user.created_at,
                "updated_at": response.user.updated_at,
            }
        return None
    except Exception as e:
        log_error(f"Error fetching user: {e}")
        return None


async def update_user_metadata(user_id: str, metadata: dict) -> bool:
    """
    Update user metadata using admin client.

    Args:
        user_id: UUID of the user
        metadata: Metadata to update

    Returns:
        bool: True if successful, False otherwise
    """
    try:
        admin_client = get_admin_client()
        admin_client.auth.admin.update_user_by_id(user_id, {"user_metadata": metadata})
        return True
    except Exception as e:
        log_error(f"Error updating user metadata: {e}")
        return False
