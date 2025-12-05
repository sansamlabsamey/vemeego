"""
Pydantic models for Meeting-related operations.
Handles request/response validation for meeting endpoints.
"""

from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


# ============================================================================
# Constants
# ============================================================================

class MeetingType:
    """Meeting type constants."""

    INSTANT = "instant"
    SCHEDULED = "scheduled"
    WEBINAR = "webinar"


class MeetingStatus:
    """Meeting status constants."""

    SCHEDULED = "scheduled"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    NOT_ANSWERED = "not_answered"


class ParticipantRole:
    """Participant role constants."""

    HOST = "host"
    ASSISTANT = "assistant"
    ATTENDEE = "attendee"


class ParticipantStatus:
    """Participant status constants."""

    INVITED = "invited"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    JOINED = "joined"
    MISSED = "missed"


# ============================================================================
# Base Models
# ============================================================================


class MeetingBase(BaseModel):
    """Base meeting model with common fields."""

    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    type: str = Field(default=MeetingType.SCHEDULED)
    is_open: bool = Field(default=False, description="If true, anyone with link can join")


class ParticipantInput(BaseModel):
    """Model for meeting participant input."""

    user_id: Optional[UUID] = None
    email: Optional[str] = Field(None, max_length=255)
    name: Optional[str] = Field(None, max_length=255)
    role: str = Field(default=ParticipantRole.ATTENDEE)

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        """Validate participant role."""
        valid_roles = [
            ParticipantRole.HOST,
            ParticipantRole.ASSISTANT,
            ParticipantRole.ATTENDEE,
        ]
        if v not in valid_roles:
            raise ValueError(f"Role must be one of: {', '.join(valid_roles)}")
        return v

    @model_validator(mode="after")
    def validate_participant_identifier(self):
        """Ensure either user_id or email is provided."""
        if not self.user_id and not self.email:
            raise ValueError("Either user_id or email must be provided")
        return self


# ============================================================================
# Request Models
# ============================================================================


class MeetingCreate(MeetingBase):
    """Model for creating a new meeting."""

    participants: List[ParticipantInput] = Field(default_factory=list)

    @field_validator("type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        """Validate meeting type."""
        valid_types = [
            MeetingType.INSTANT,
            MeetingType.SCHEDULED,
            MeetingType.WEBINAR,
        ]
        if v not in valid_types:
            raise ValueError(f"Type must be one of: {', '.join(valid_types)}")
        return v


class MeetingUpdate(BaseModel):
    """Model for updating meeting information."""

    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: Optional[str] = None
    is_open: Optional[bool] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: Optional[str]) -> Optional[str]:
        """Validate meeting status."""
        if v is None:
            return v
        valid_statuses = [
            MeetingStatus.SCHEDULED,
            MeetingStatus.ACTIVE,
            MeetingStatus.COMPLETED,
            MeetingStatus.CANCELLED,
            MeetingStatus.NOT_ANSWERED,
        ]
        if v not in valid_statuses:
            raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
        return v


class ParticipantStatusUpdate(BaseModel):
    """Model for updating participant status."""

    status: str = Field(..., description="Status: 'accepted' or 'declined'")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        """Validate participant status."""
        valid_statuses = [ParticipantStatus.ACCEPTED, ParticipantStatus.DECLINED]
        if v not in valid_statuses:
            raise ValueError(f"Status must be one of: {', '.join(valid_statuses)}")
        return v


class ChatMessageInput(BaseModel):
    """Model for sending a chat message in a meeting."""

    content: str = Field(..., min_length=1, max_length=10000)


# ============================================================================
# Response Models
# ============================================================================


class ParticipantResponse(BaseModel):
    """Model for participant response."""

    id: UUID
    meeting_id: UUID
    user_id: Optional[UUID] = None
    email: Optional[str] = None
    name: Optional[str] = None
    role: str
    status: str
    joined_at: Optional[datetime] = None
    left_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MeetingResponse(MeetingBase):
    """Model for meeting response."""

    id: UUID
    status: str
    host_id: UUID
    room_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    participants: Optional[List[ParticipantResponse]] = None

    model_config = {"from_attributes": True}


class MeetingChatMessageResponse(BaseModel):
    """Model for meeting chat message response."""

    id: UUID
    meeting_id: UUID
    sender_id: Optional[UUID] = None
    sender_name: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class LiveKitTokenResponse(BaseModel):
    """Model for LiveKit access token response."""

    token: str


# ============================================================================
# List/Query Models
# ============================================================================


class MeetingListResponse(BaseModel):
    """Model for paginated meeting list response."""

    meetings: List[MeetingResponse]
    total: int
    page: int = 1
    page_size: int = 20
    total_pages: int


class MeetingQueryParams(BaseModel):
    """Query parameters for meeting list."""

    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)
    type: Optional[str] = None
    status: Optional[str] = None
    host_id: Optional[UUID] = None
    search: Optional[str] = None

