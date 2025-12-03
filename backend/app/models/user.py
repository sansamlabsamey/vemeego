"""
Pydantic models for User-related operations.
Handles request/response validation for user endpoints.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserRole:
    """User role constants."""

    SUPER_ADMIN = "super-admin"
    ORG_ADMIN = "org-admin"
    USER = "user"


class UserStatus:
    """User status constants."""

    ACTIVE = "active"
    PENDING = "pending"
    SUSPENDED = "suspended"
    DELETED = "deleted"


# ============================================================================
# Base Models
# ============================================================================


class UserBase(BaseModel):
    """Base user model with common fields."""

    email: EmailStr
    user_name: str = Field(..., min_length=1, max_length=255)
    phone_number: Optional[str] = Field(None, max_length=50)
    job_title: Optional[str] = Field(None, max_length=255)
    url: Optional[str] = None
    transcription_enabled: bool = False
    transcription_language: str = Field(default="en", max_length=10)


class UserCreate(UserBase):
    """Model for creating a new user."""

    password: Optional[str] = Field(None, min_length=8)
    role: str = Field(default=UserRole.USER)
    organization_id: Optional[UUID] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: Optional[str]) -> Optional[str]:
        """Validate password strength."""
        if v is None:
            return v

        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")

        # Check for at least one uppercase letter
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")

        # Check for at least one lowercase letter
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")

        # Check for at least one digit
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")

        return v

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        """Validate user role."""
        valid_roles = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.USER]
        if v not in valid_roles:
            raise ValueError(f"Role must be one of: {', '.join(valid_roles)}")
        return v


class UserUpdate(BaseModel):
    """Model for updating user information."""

    user_name: Optional[str] = Field(None, min_length=1, max_length=255)
    phone_number: Optional[str] = Field(None, max_length=50)
    job_title: Optional[str] = Field(None, max_length=255)
    url: Optional[str] = None
    transcription_enabled: Optional[bool] = None
    transcription_language: Optional[str] = Field(None, max_length=10)
    current_status: Optional[int] = None


class UserStatusUpdate(BaseModel):
    """Model for updating user status (admin only)."""

    status: str = Field(...)

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        """Validate user status."""
        valid_statuses = [
            UserStatus.ACTIVE,
            UserStatus.PENDING,
            UserStatus.SUSPENDED,
            UserStatus.DELETED,
        ]
        if v not in valid_statuses:
            raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
        return v


class UserRoleUpdate(BaseModel):
    """Model for updating user role (super-admin only)."""

    role: str = Field(...)

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        """Validate user role."""
        valid_roles = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.USER]
        if v not in valid_roles:
            raise ValueError(f"Role must be one of: {', '.join(valid_roles)}")
        return v


# ============================================================================
# Response Models
# ============================================================================


class UserResponse(UserBase):
    """Model for user response."""

    id: UUID
    auth_user_id: Optional[UUID] = None
    role: str
    status: str
    face_id: Optional[str] = None
    current_status: int
    organization_id: Optional[UUID] = None
    last_login: Optional[datetime] = None
    is_verified: bool
    is_deleted: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserListResponse(BaseModel):
    """Model for paginated user list response."""

    users: list[UserResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class UserWithOrganization(UserResponse):
    """User response with organization details."""

    organization_name: Optional[str] = None


# ============================================================================
# Authentication Models
# ============================================================================


class UserSignUp(BaseModel):
    """Model for user signup (org-admin)."""

    email: EmailStr
    password: str = Field(..., min_length=8)
    user_name: str = Field(..., min_length=1, max_length=255)
    phone_number: Optional[str] = Field(None, max_length=50)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password strength."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")

        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")

        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")

        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")

        return v


class UserSignIn(BaseModel):
    """Model for user signin."""

    email: EmailStr
    password: str = Field(..., min_length=1)
    keep_me_signed_in: bool = False


class UserInvite(BaseModel):
    """Model for inviting a user (creates account with magic link)."""

    email: EmailStr
    user_name: str = Field(..., min_length=1, max_length=255)
    job_title: Optional[str] = Field(None, max_length=255)
    phone_number: Optional[str] = Field(None, max_length=50)


class PasswordReset(BaseModel):
    """Model for password reset request."""

    email: EmailStr


class PasswordUpdate(BaseModel):
    """Model for updating password."""

    current_password: Optional[str] = Field(None, min_length=1)
    new_password: str = Field(..., min_length=8)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        """Validate new password strength."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")

        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")

        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")

        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")

        return v


class TokenResponse(BaseModel):
    """Model for authentication token response."""

    access_token: str
    token_type: str = "bearer"
    refresh_token: Optional[str] = None
    expires_in: int
    user: UserResponse


class RefreshTokenRequest(BaseModel):
    """Model for refresh token request."""

    refresh_token: str


# ============================================================================
# Super Admin Creation
# ============================================================================


class SuperAdminCreate(BaseModel):
    """Model for creating super admin via script."""

    email: EmailStr
    password: str = Field(..., min_length=8)
    user_name: str = Field(..., min_length=1, max_length=255)

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        """Validate password strength."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")

        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")

        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")

        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")

        return v


# ============================================================================
# Query Parameters
# ============================================================================


class UserQueryParams(BaseModel):
    """Query parameters for user list."""

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    role: Optional[str] = None
    status: Optional[str] = None
    organization_id: Optional[UUID] = None
    search: Optional[str] = None
