"""
Meetings Router
Handles meeting-related API endpoints.
"""

from typing import List, Optional
from uuid import UUID
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.core.exceptions import AppException
from app.middleware.auth import get_current_active_user
from app.services.meeting_service import MeetingService

router = APIRouter(prefix="/meetings", tags=["Meetings"])
meeting_service = MeetingService()

class ParticipantInput(BaseModel):
    user_id: Optional[UUID] = None
    email: Optional[str] = None
    name: Optional[str] = None
    role: str = "attendee"

class MeetingCreate(BaseModel):
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    type: str = "scheduled"
    is_open: bool = False
    participants: List[ParticipantInput] = []

class MeetingResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    start_time: datetime
    end_time: Optional[datetime] = None
    status: str
    type: str
    is_open: bool
    host_id: UUID
    room_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

class TokenResponse(BaseModel):
    token: str

@router.post("", response_model=MeetingResponse, status_code=status.HTTP_201_CREATED)
async def create_meeting(
    meeting_data: MeetingCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Create a new meeting.
    """
    try:
        participants_dict = [p.dict() for p in meeting_data.participants]
        meeting = await meeting_service.create_meeting(
            title=meeting_data.title,
            host_id=UUID(current_user["id"]),
            start_time=meeting_data.start_time,
            type=meeting_data.type,
            description=meeting_data.description,
            end_time=meeting_data.end_time,
            is_open=meeting_data.is_open,
            participants=participants_dict,
        )
        return meeting
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create meeting: {str(e)}",
        )

@router.get("", response_model=List[MeetingResponse])
async def get_meetings(
    current_user: dict = Depends(get_current_active_user),
):
    """
    Get all meetings for the current user.
    """
    try:
        meetings = await meeting_service.get_user_meetings(UUID(current_user["id"]))
        return meetings
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get meetings: {str(e)}",
        )

@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: UUID,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Get meeting details.
    """
    try:
        meeting = await meeting_service.get_meeting(meeting_id, UUID(current_user["id"]))
        return meeting
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get meeting: {str(e)}",
        )

@router.post("/{meeting_id}/token", response_model=TokenResponse)
async def generate_token(
    meeting_id: UUID,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Generate LiveKit access token for a meeting.
    """
    try:
        token = await meeting_service.generate_token(
            meeting_id,
            UUID(current_user["id"]),
            current_user["user_name"]
        )
        return {"token": token}
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate token: {str(e)}",
        )

@router.post("/{meeting_id}/invite", status_code=status.HTTP_200_OK)
async def invite_participant(
    meeting_id: UUID,
    participant: ParticipantInput,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Invite a participant to a meeting.
    """
    try:
        result = await meeting_service.invite_participant(
            meeting_id,
            UUID(current_user["id"]),
            participant.dict()
        )
        return result
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to invite participant: {str(e)}",
        )

class ChatMessageInput(BaseModel):
    content: str

@router.post("/{meeting_id}/chat", status_code=status.HTTP_201_CREATED)
async def send_chat_message(
    meeting_id: UUID,
    message: ChatMessageInput,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Send a chat message to the meeting.
    """
    try:
        result = await meeting_service.send_chat_message(
            meeting_id,
            UUID(current_user["id"]),
            current_user["user_name"],
            message.content
        )
        return result
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send message: {str(e)}",
        )

@router.get("/{meeting_id}/chat")
async def get_chat_messages(
    meeting_id: UUID,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Get chat history for a meeting.
    """
    try:
        messages = await meeting_service.get_chat_messages(
            meeting_id,
            UUID(current_user["id"])
        )
        return messages
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get messages: {str(e)}",
        )

class ParticipantStatusUpdate(BaseModel):
    status: str  # "accepted" or "declined"

@router.patch("/{meeting_id}/participants/{participant_id}/status", status_code=status.HTTP_200_OK)
async def update_participant_status(
    meeting_id: UUID,
    participant_id: UUID,
    status_update: ParticipantStatusUpdate,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Update participant status (accept/decline meeting invitation).
    """
    try:
        result = await meeting_service.update_participant_status(
            meeting_id,
            participant_id,
            UUID(current_user["id"]),
            status_update.status
        )
        return result
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update participant status: {str(e)}",
        )
