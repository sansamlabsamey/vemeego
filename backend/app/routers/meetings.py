"""
Meetings Router
Handles meeting-related API endpoints.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status

from app.core.exceptions import AppException
from app.middleware.auth import get_current_active_user
from app.models.meeting import (
    ChatMessageInput,
    LiveKitTokenResponse,
    MeetingCreate,
    MeetingResponse,
    ParticipantInput,
    ParticipantStatusUpdate,
)
from app.services.meeting_service import MeetingService

router = APIRouter(prefix="/meetings", tags=["Meetings"])
meeting_service = MeetingService()

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

@router.post("/{meeting_id}/token", response_model=LiveKitTokenResponse)
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

@router.get("/participants/invited")
async def get_invited_participants(
    current_user: dict = Depends(get_current_active_user),
):
    """
    Get all meeting participants where the current user is invited.
    """
    try:
        participants = await meeting_service.get_invited_participants(
            UUID(current_user["id"])
        )
        return participants
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get invited participants: {str(e)}",
        )

@router.get("/{meeting_id}/participants/by-user/{user_id}")
async def get_participant_by_user(
    meeting_id: UUID,
    user_id: UUID,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Get participant record by meeting_id and user_id.
    Only accessible by the user themselves or the meeting host.
    """
    try:
        # Verify access - user must be the requested user or the meeting host
        meeting = await meeting_service.get_meeting(meeting_id, UUID(current_user["id"]))
        
        # Check if current user is the requested user or the host
        if str(current_user["id"]) != str(user_id) and str(meeting["host_id"]) != str(current_user["id"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own participant record or if you are the meeting host"
            )
        
        participant = await meeting_service.get_participant_by_user(
            meeting_id,
            user_id
        )
        
        if not participant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Participant not found"
            )
        
        return participant
    except HTTPException:
        raise
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get participant: {str(e)}",
        )


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

@router.post("/{meeting_id}/leave", status_code=status.HTTP_200_OK)
async def leave_meeting(
    meeting_id: UUID,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Leave a meeting. This will trigger auto-end logic if needed.
    """
    try:
        result = await meeting_service.leave_meeting(
            meeting_id,
            UUID(current_user["id"])
        )
        return result
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to leave meeting: {str(e)}",
        )

@router.post("/{meeting_id}/end", status_code=status.HTTP_200_OK)
async def end_meeting(
    meeting_id: UUID,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Manually end a meeting (host only). Closes room, clears chats, marks as completed.
    """
    try:
        # Verify user is host
        meeting = await meeting_service.get_meeting(meeting_id, UUID(current_user["id"]))
        if str(meeting["host_id"]) != str(current_user["id"]):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only the meeting host can end the meeting"
            )
        
        result = await meeting_service.end_meeting(meeting_id)
        return result
    except HTTPException:
        raise
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to end meeting: {str(e)}",
        )

@router.post("/{meeting_id}/participants/{participant_id}/missed", status_code=status.HTTP_200_OK)
async def mark_call_as_missed(
    meeting_id: UUID,
    participant_id: UUID,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Mark a call as missed. Can be called by the participant or host.
    """
    try:
        # Verify access - get meeting first
        meeting = await meeting_service.get_meeting(meeting_id, UUID(current_user["id"]))
        
        # Get participant by ID (not by user_id)
        from app.core.supabase_client import get_admin_client
        admin_client = get_admin_client()
        participant_response = (
            admin_client.table("meeting_participants")
            .select("*")
            .eq("id", str(participant_id))
            .eq("meeting_id", str(meeting_id))
            .execute()
        )
        
        if not participant_response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Participant not found"
            )
        
        participant = participant_response.data[0]
        
        # Allow if user is the participant or the host
        is_participant = participant.get("user_id") and str(participant.get("user_id")) == str(current_user["id"])
        is_host = str(meeting["host_id"]) == str(current_user["id"])
        
        if not (is_participant or is_host):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only mark your own calls as missed or if you are the host"
            )
        
        result = await meeting_service.mark_call_as_missed(meeting_id, participant_id)
        return result
    except HTTPException:
        raise
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to mark call as missed: {str(e)}",
        )
