"""
Messaging Router
Handles all messaging-related API endpoints.
"""

from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.core.exceptions import AppException
from app.middleware.auth import get_current_active_user
from app.models.message import (
    ConversationListResponse,
    ConversationResponse,
    MessageCreate,
    MessageReactionCreate,
    MessageResponse,
    MessageUpdate,
    PinMessageRequest,
)
from app.services.messaging_service import MessagingService

router = APIRouter(prefix="/messaging", tags=["Messaging"])

messaging_service = MessagingService()


@router.get("/conversations", response_model=ConversationListResponse)
async def get_conversations(
    current_user: dict = Depends(get_current_active_user),
):
    """
    Get all conversations for the current user.
    Returns conversations sorted by last message time (latest first).
    """
    try:
        if not current_user.get("organization_id"):
            return ConversationListResponse(conversations=[], total=0)

        conversations = await messaging_service.get_conversations(
            user_id=UUID(current_user["id"]),
            organization_id=UUID(current_user["organization_id"]),
        )

        # Format as ConversationResponse
        formatted_conversations = []
        for conv in conversations:
            other_participant = conv.get("other_participant", {})
            formatted_conversations.append(
                ConversationResponse(
                    id=UUID(conv["id"]),
                    participant1_id=UUID(conv["participant1_id"]),
                    participant1_name=conv["participant1_name"],
                    participant1_avatar=conv.get("participant1_avatar"),
                    participant2_id=UUID(conv["participant2_id"]),
                    participant2_name=conv["participant2_name"],
                    participant2_avatar=conv.get("participant2_avatar"),
                    last_message_id=UUID(conv["last_message_id"]) if conv.get("last_message_id") else None,
                    last_message_content=conv.get("last_message_content"),
                    last_message_at=conv.get("last_message_at"),
                    unread_count=0,  # TODO: Implement unread count
                    created_at=conv["created_at"],
                    updated_at=conv["updated_at"],
                )
            )

        return ConversationListResponse(
            conversations=formatted_conversations, total=len(formatted_conversations)
        )
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get conversations: {str(e)}",
        )


@router.get("/members", response_model=List[dict])
async def get_organization_members(
    current_user: dict = Depends(get_current_active_user),
):
    """
    Get all active members in the user's organization.
    Returns members sorted alphabetically by name.
    """
    try:
        if not current_user.get("organization_id"):
            return []

        members = await messaging_service.get_organization_members(
            organization_id=UUID(current_user["organization_id"]),
            current_user_id=UUID(current_user["id"]),
        )

        return members
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get members: {str(e)}",
        )


@router.post("/conversations/{user_id}/start")
async def start_conversation(
    user_id: UUID,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Start or get a conversation with another user in the same organization.
    """
    try:
        if not current_user.get("organization_id"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User must belong to an organization",
            )

        conversation = await messaging_service.get_or_create_conversation(
            user1_id=UUID(current_user["id"]),
            user2_id=user_id,
            organization_id=UUID(current_user["organization_id"]),
        )

        return {"conversation_id": conversation["id"]}
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to start conversation: {str(e)}",
        )


@router.get("/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_messages(
    conversation_id: UUID,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: dict = Depends(get_current_active_user),
):
    """
    Get messages in a conversation.
    """
    try:
        messages = await messaging_service.get_messages(
            conversation_id=conversation_id,
            user_id=UUID(current_user["id"]),
            limit=limit,
            offset=offset,
        )

        # Format as MessageResponse
        formatted_messages = []
        for msg in messages:
            formatted_messages.append(
                MessageResponse(
                    id=UUID(msg["id"]),
                    conversation_id=UUID(msg["conversation_id"]),
                    sender_id=UUID(msg["sender_id"]),
                    sender_name=msg["sender_name"],
                    sender_avatar=msg.get("sender_avatar"),
                    content=msg["content"],
                    content_type=msg["content_type"],
                    reply_to_id=UUID(msg["reply_to_id"]) if msg.get("reply_to_id") else None,
                    reply_to_content=msg.get("reply_to_content"),
                    reply_to_sender_name=msg.get("reply_to_sender_name"),
                    forwarded_from_id=UUID(msg["forwarded_from_id"]) if msg.get("forwarded_from_id") else None,
                    forwarded_from_user_id=UUID(msg["forwarded_from_user_id"]) if msg.get("forwarded_from_user_id") else None,
                    forwarded_from_user_name=msg.get("forwarded_from_user_name"),
                    is_edited=msg["is_edited"],
                    edited_at=msg.get("edited_at"),
                    is_deleted=msg["is_deleted"],
                    deleted_at=msg.get("deleted_at"),
                    reactions=msg.get("reactions", []),
                    created_at=msg["created_at"],
                    updated_at=msg["updated_at"],
                )
            )

        return formatted_messages
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get messages: {str(e)}",
        )


@router.post("/messages", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    message_data: MessageCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Send a new message.
    """
    try:
        message = await messaging_service.send_message(
            message_data=message_data,
            sender_id=UUID(current_user["id"]),
        )

        # Format response
        return MessageResponse(
            id=UUID(message["id"]),
            conversation_id=UUID(message["conversation_id"]),
            sender_id=UUID(message["sender_id"]),
            sender_name=current_user["user_name"],
            sender_avatar=None,
            content=message["content"],
            content_type=message.get("content_type", "text"),
            reply_to_id=UUID(message["reply_to_id"]) if message.get("reply_to_id") else None,
            reply_to_content=None,
            reply_to_sender_name=None,
            forwarded_from_id=UUID(message["forwarded_from_id"]) if message.get("forwarded_from_id") else None,
            forwarded_from_user_id=UUID(message["forwarded_from_user_id"]) if message.get("forwarded_from_user_id") else None,
            forwarded_from_user_name=None,
            is_edited=False,
            edited_at=None,
            is_deleted=False,
            deleted_at=None,
            reactions=[],
            created_at=message["created_at"],
            updated_at=message["updated_at"],
        )
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to send message: {str(e)}",
        )


@router.put("/messages/{message_id}", response_model=MessageResponse)
async def update_message(
    message_id: UUID,
    message_data: MessageUpdate,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Update a message (edit).
    """
    try:
        message = await messaging_service.update_message(
            message_id=message_id,
            message_data=message_data,
            user_id=UUID(current_user["id"]),
        )

        # Format response
        return MessageResponse(
            id=UUID(message["id"]),
            conversation_id=UUID(message["conversation_id"]),
            sender_id=UUID(message["sender_id"]),
            sender_name=current_user["user_name"],
            sender_avatar=None,
            content=message["content"],
            content_type=message.get("content_type", "text"),
            reply_to_id=UUID(message["reply_to_id"]) if message.get("reply_to_id") else None,
            reply_to_content=None,
            reply_to_sender_name=None,
            forwarded_from_id=UUID(message["forwarded_from_id"]) if message.get("forwarded_from_id") else None,
            forwarded_from_user_id=UUID(message["forwarded_from_user_id"]) if message.get("forwarded_from_user_id") else None,
            forwarded_from_user_name=None,
            is_edited=message.get("is_edited", False),
            edited_at=message.get("edited_at"),
            is_deleted=message.get("is_deleted", False),
            deleted_at=message.get("deleted_at"),
            reactions=[],
            created_at=message["created_at"],
            updated_at=message["updated_at"],
        )
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update message: {str(e)}",
        )


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    message_id: UUID,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Delete a message (soft delete).
    """
    try:
        await messaging_service.delete_message(
            message_id=message_id,
            user_id=UUID(current_user["id"]),
        )
        return None
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete message: {str(e)}",
        )


@router.post("/messages/{message_id}/reactions", status_code=status.HTTP_201_CREATED)
async def add_reaction(
    message_id: UUID,
    reaction_data: MessageReactionCreate,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Add a reaction to a message.
    """
    try:
        reaction = await messaging_service.add_reaction(
            message_id=message_id,
            reaction_data=reaction_data,
            user_id=UUID(current_user["id"]),
        )
        return reaction
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add reaction: {str(e)}",
        )


@router.delete("/messages/{message_id}/reactions/{emoji}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_reaction(
    message_id: UUID,
    emoji: str,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Remove a reaction from a message.
    """
    try:
        await messaging_service.remove_reaction(
            message_id=message_id,
            emoji=emoji,
            user_id=UUID(current_user["id"]),
        )
        return None
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to remove reaction: {str(e)}",
        )


@router.post("/conversations/{conversation_id}/pin", status_code=status.HTTP_201_CREATED)
async def pin_message(
    conversation_id: UUID,
    pin_data: PinMessageRequest,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Pin a message in a conversation.
    """
    try:
        pinned = await messaging_service.pin_message(
            conversation_id=conversation_id,
            message_id=pin_data.message_id,
            user_id=UUID(current_user["id"]),
        )
        return pinned
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to pin message: {str(e)}",
        )


@router.delete("/conversations/{conversation_id}/pin/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unpin_message(
    conversation_id: UUID,
    message_id: UUID,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Unpin a message from a conversation.
    """
    try:
        await messaging_service.unpin_message(
            conversation_id=conversation_id,
            message_id=message_id,
            user_id=UUID(current_user["id"]),
        )
        return None
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to unpin message: {str(e)}",
        )


@router.get("/conversations/{conversation_id}/pinned", response_model=List[dict])
async def get_pinned_messages(
    conversation_id: UUID,
    current_user: dict = Depends(get_current_active_user),
):
    """
    Get pinned messages in a conversation.
    """
    try:
        pinned = await messaging_service.get_pinned_messages(
            conversation_id=conversation_id,
            user_id=UUID(current_user["id"]),
        )
        return pinned
    except AppException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get pinned messages: {str(e)}",
        )


