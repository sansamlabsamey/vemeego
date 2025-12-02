"""
Message-related Pydantic models for request/response validation.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class MessageBase(BaseModel):
    """Base message model with common fields."""
    content: str = Field(..., min_length=1, max_length=10000)
    content_type: str = Field(default="text", pattern="^(text|markdown)$")
    reply_to_id: Optional[UUID] = None
    forwarded_from_id: Optional[UUID] = None


class MessageCreate(MessageBase):
    """Model for creating a new message."""
    conversation_id: UUID
    forwarded_from_user_id: Optional[UUID] = None


class MessageUpdate(BaseModel):
    """Model for updating a message."""
    content: str = Field(..., min_length=1, max_length=10000)


class MessageResponse(BaseModel):
    """Model for message response."""
    id: UUID
    conversation_id: UUID
    sender_id: UUID
    sender_name: str
    sender_avatar: Optional[str] = None
    content: str
    content_type: str
    reply_to_id: Optional[UUID] = None
    reply_to_content: Optional[str] = None
    reply_to_sender_name: Optional[str] = None
    forwarded_from_id: Optional[UUID] = None
    forwarded_from_user_id: Optional[UUID] = None
    forwarded_from_user_name: Optional[str] = None
    is_edited: bool
    edited_at: Optional[datetime] = None
    is_deleted: bool
    deleted_at: Optional[datetime] = None
    reactions: list[dict] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    """Model for conversation response."""
    id: UUID
    participant1_id: UUID
    participant1_name: str
    participant1_avatar: Optional[str] = None
    participant2_id: UUID
    participant2_name: str
    participant2_avatar: Optional[str] = None
    last_message_id: Optional[UUID] = None
    last_message_content: Optional[str] = None
    last_message_at: Optional[datetime] = None
    unread_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MessageReactionCreate(BaseModel):
    """Model for creating a message reaction."""
    emoji: str = Field(..., min_length=1, max_length=50)


class MessageReactionResponse(BaseModel):
    """Model for message reaction response."""
    id: UUID
    message_id: UUID
    user_id: UUID
    user_name: str
    emoji: str
    created_at: datetime

    class Config:
        from_attributes = True


class PinMessageRequest(BaseModel):
    """Model for pinning a message."""
    message_id: UUID


class ConversationListResponse(BaseModel):
    """Model for conversation list response."""
    conversations: list[ConversationResponse]
    total: int


