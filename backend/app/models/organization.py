"""
Pydantic models for Organization-related operations.
Handles request/response validation for organization endpoints.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class SubscriptionPlan:
    """Subscription plan constants."""

    FREE = "FREE"
    BASIC = "BASIC"
    PREMIUM = "PREMIUM"
    ENTERPRISE = "ENTERPRISE"


class SubscriptionStatus:
    """Subscription status constants."""

    ACTIVE = "ACTIVE"
    INACTIVE = "INACTIVE"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


# ============================================================================
# Base Models
# ============================================================================


class OrganizationBase(BaseModel):
    """Base organization model with common fields."""

    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    logo_url: Optional[str] = None


class OrganizationCreate(OrganizationBase):
    """Model for creating a new organization."""

    subscription_plan: str = Field(default=SubscriptionPlan.FREE)
    max_users: int = Field(default=10, ge=1)
    max_storage_gb: int = Field(default=1, ge=1)

    @field_validator("subscription_plan")
    @classmethod
    def validate_subscription_plan(cls, v: str) -> str:
        """Validate subscription plan."""
        valid_plans = [
            SubscriptionPlan.FREE,
            SubscriptionPlan.BASIC,
            SubscriptionPlan.PREMIUM,
            SubscriptionPlan.ENTERPRISE,
        ]
        if v not in valid_plans:
            raise ValueError(f"Subscription plan must be one of: {', '.join(valid_plans)}")
        return v


class OrganizationUpdate(BaseModel):
    """Model for updating organization information."""

    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    logo_url: Optional[str] = None


class OrganizationSubscriptionUpdate(BaseModel):
    """Model for updating organization subscription (super-admin only)."""

    subscription_plan: Optional[str] = None
    subscription_status: Optional[str] = None
    subscription_end_date: Optional[datetime] = None
    max_users: Optional[int] = Field(None, ge=1)
    max_storage_gb: Optional[int] = Field(None, ge=1)

    @field_validator("subscription_plan")
    @classmethod
    def validate_subscription_plan(cls, v: Optional[str]) -> Optional[str]:
        """Validate subscription plan."""
        if v is None:
            return v
        valid_plans = [
            SubscriptionPlan.FREE,
            SubscriptionPlan.BASIC,
            SubscriptionPlan.PREMIUM,
            SubscriptionPlan.ENTERPRISE,
        ]
        if v not in valid_plans:
            raise ValueError(f"Subscription plan must be one of: {', '.join(valid_plans)}")
        return v

    @field_validator("subscription_status")
    @classmethod
    def validate_subscription_status(cls, v: Optional[str]) -> Optional[str]:
        """Validate subscription status."""
        if v is None:
            return v
        valid_statuses = [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.INACTIVE,
            SubscriptionStatus.CANCELLED,
            SubscriptionStatus.EXPIRED,
        ]
        if v not in valid_statuses:
            raise ValueError(f"Subscription status must be one of: {', '.join(valid_statuses)}")
        return v


# ============================================================================
# Response Models
# ============================================================================


class OrganizationResponse(OrganizationBase):
    """Model for organization response."""

    id: UUID
    subscription_plan: str
    subscription_status: str
    subscription_end_date: Optional[datetime] = None
    max_users: int
    max_storage_gb: int
    created_at: datetime
    updated_at: datetime
    is_deleted: bool
    current_users: Optional[int] = 0

    model_config = {"from_attributes": True}


class OrganizationWithStats(OrganizationResponse):
    """Organization response with usage statistics."""

    current_users: int = 0
    current_storage_gb: float = 0.0
    active_users: int = 0
    pending_users: int = 0


class OrganizationListResponse(BaseModel):
    """Model for paginated organization list response."""

    organizations: list[OrganizationResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ============================================================================
# Org-Admin Signup with Organization
# ============================================================================


class OrgAdminSignup(BaseModel):
    """Model for org-admin signup with organization details."""

    # User details
    email: str = Field(..., min_length=1)
    password: str = Field(..., min_length=8)
    user_name: str = Field(..., min_length=1, max_length=255)
    phone_number: Optional[str] = Field(None, max_length=50)
    job_title: Optional[str] = Field(None, max_length=255)

    # Organization details
    organization_name: str = Field(..., min_length=1, max_length=255)
    organization_description: Optional[str] = None

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


class OrgAdminSignupResponse(BaseModel):
    """Response after org-admin signup."""

    message: str
    user_id: UUID
    organization_id: UUID
    status: str
    email: str


class ApproveOrgAdminRequest(BaseModel):
    """Request to approve org-admin (super-admin action)."""

    user_id: UUID
    approved: bool = True
    subscription_plan: Optional[str] = Field(default=SubscriptionPlan.FREE)
    max_users: Optional[int] = Field(default=10, ge=1)
    max_storage_gb: Optional[int] = Field(default=1, ge=1)

    @field_validator("subscription_plan")
    @classmethod
    def validate_subscription_plan(cls, v: Optional[str]) -> Optional[str]:
        """Validate subscription plan."""
        if v is None:
            return v
        valid_plans = [
            SubscriptionPlan.FREE,
            SubscriptionPlan.BASIC,
            SubscriptionPlan.PREMIUM,
            SubscriptionPlan.ENTERPRISE,
        ]
        if v not in valid_plans:
            raise ValueError(f"Subscription plan must be one of: {', '.join(valid_plans)}")
        return v


# ============================================================================
# Query Parameters
# ============================================================================


class OrganizationQueryParams(BaseModel):
    """Query parameters for organization list."""

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    subscription_plan: Optional[str] = None
    subscription_status: Optional[str] = None
    search: Optional[str] = None


# ============================================================================
# Organization Setup (Step 2 of Signup)
# ============================================================================


class OrganizationSetup(BaseModel):
    """Model for organization setup after user signup."""

    organization_name: str = Field(..., min_length=1, max_length=255)
    organization_description: Optional[str] = None
    selected_plan: str = Field(..., description="Plan selection: STARTER, PRO, or BUSINESS")
    max_users: Optional[int] = Field(
        None, ge=1, description="Maximum number of users (optional, defaults based on plan)"
    )
    max_storage_gb: Optional[int] = Field(
        None, ge=1, description="Maximum storage in GB (optional, defaults based on plan)"
    )

    @field_validator("selected_plan")
    @classmethod
    def validate_selected_plan(cls, v: str) -> str:
        """Validate selected plan."""
        valid_plans = ["STARTER", "PRO", "BUSINESS"]
        if v not in valid_plans:
            raise ValueError(f"Selected plan must be one of: {', '.join(valid_plans)}")
        return v


class OrganizationSetupResponse(BaseModel):
    """Response after organization setup."""

    message: str
    organization_id: UUID
    organization_name: str
    selected_plan: str
    status: str
    max_users: int
    max_storage_gb: int
