"""
Messaging Service
Handles all messaging-related business logic including:
- Conversations management
- Message CRUD operations
- Message reactions
- Pinned messages
- Real-time messaging via Supabase Realtime
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from app.core.exceptions import (
    AuthorizationError,
    BadRequestError,
    NotFoundError,
)
from app.core.supabase_client import get_admin_client
from app.models.message import (
    ConversationResponse,
    MessageCreate,
    MessageReactionCreate,
    MessageResponse,
    MessageUpdate,
)


class MessagingService:
    """Service class for messaging operations."""

    def __init__(self):
        self.admin_client = get_admin_client()

    async def get_or_create_conversation(
        self, user1_id: UUID, user2_id: UUID, organization_id: UUID
    ) -> Dict[str, Any]:
        """
        Get or create a conversation between two users.

        Args:
            user1_id: First user ID
            user2_id: Second user ID
            organization_id: Organization ID

        Returns:
            Dict with conversation data
        """
        # Verify both users belong to the same organization
        user1_response = (
            self.admin_client.table("users")
            .select("*")
            .eq("id", str(user1_id))
            .single()
            .execute()
        )

        user2_response = (
            self.admin_client.table("users")
            .select("*")
            .eq("id", str(user2_id))
            .single()
            .execute()
        )

        if not user1_response.data or not user2_response.data:
            raise NotFoundError("One or both users not found")

        if str(user1_response.data["organization_id"]) != str(organization_id):
            raise AuthorizationError("User 1 does not belong to this organization")

        if str(user2_response.data["organization_id"]) != str(organization_id):
            raise AuthorizationError("User 2 does not belong to this organization")

        # Ensure consistent ordering (smaller ID first) for database consistency
        # Convert to strings for comparison to avoid UUID comparison issues
        user1_str = str(user1_id)
        user2_str = str(user2_id)
        
        # Swap if needed to ensure participant1_id < participant2_id
        if user1_str > user2_str:
            user1_str, user2_str = user2_str, user1_str

        # Try to find existing conversation (don't use .single() as it throws if no rows)
        existing_conv = (
            self.admin_client.table("conversations")
            .select("*")
            .eq("participant1_id", user1_str)
            .eq("participant2_id", user2_str)
            .eq("is_deleted", False)
            .limit(1)
            .execute()
        )

        if existing_conv.data and len(existing_conv.data) > 0:
            return existing_conv.data[0]

        # Create new conversation
        new_conv = (
            self.admin_client.table("conversations")
            .insert(
                {
                    "participant1_id": user1_str,
                    "participant2_id": user2_str,
                    "organization_id": str(organization_id),
                }
            )
            .execute()
        )

        if not new_conv.data:
            raise BadRequestError("Failed to create conversation")

        return new_conv.data[0]

    async def get_conversations(
        self, user_id: UUID, organization_id: UUID
    ) -> List[Dict[str, Any]]:
        """
        Get all conversations for a user in their organization.

        Args:
            user_id: User ID
            organization_id: Organization ID

        Returns:
            List of conversations with participant info
        """
        # Get conversations where user is participant1 or participant2
        conversations_response = (
            self.admin_client.table("conversations")
            .select(
                "*",
                "participant1:users!conversations_participant1_id_fkey(id,user_name,email)",
                "participant2:users!conversations_participant2_id_fkey(id,user_name,email)",
            )
            .or_(
                f"participant1_id.eq.{user_id},participant2_id.eq.{user_id}"
            )
            .eq("organization_id", str(organization_id))
            .eq("is_deleted", False)
            .order("last_message_at", desc=True)
            .order("created_at", desc=True)
            .execute()
        )

        conversations = conversations_response.data or []

        # Format conversations
        formatted_conversations = []
        for conv in conversations:
            # Determine the other participant
            if str(conv["participant1"]["id"]) == str(user_id):
                other_participant = conv["participant2"]
            else:
                other_participant = conv["participant1"]

            # Get last message if exists
            last_message = None
            if conv.get("last_message_id"):
                msg_response = (
                    self.admin_client.table("messages")
                    .select("*")
                    .eq("id", conv["last_message_id"])
                    .single()
                    .execute()
                )
                if msg_response.data:
                    last_message = msg_response.data

            formatted_conversations.append(
                {
                    "id": conv["id"],
                    "participant1_id": conv["participant1_id"],
                    "participant1_name": conv["participant1"]["user_name"],
                    "participant1_avatar": None,  # Add avatar URL if available
                    "participant2_id": conv["participant2_id"],
                    "participant2_name": conv["participant2"]["user_name"],
                    "participant2_avatar": None,  # Add avatar URL if available
                    "other_participant": other_participant,
                    "last_message_id": conv.get("last_message_id"),
                    "last_message_content": last_message.get("content") if last_message else None,
                    "last_message_at": conv.get("last_message_at"),
                    "created_at": conv["created_at"],
                    "updated_at": conv["updated_at"],
                }
            )

        return formatted_conversations

    async def get_organization_members(
        self, organization_id: UUID, current_user_id: UUID
    ) -> List[Dict[str, Any]]:
        """
        Get all active members in an organization (excluding current user).

        Args:
            organization_id: Organization ID
            current_user_id: Current user ID (to exclude)

        Returns:
            List of organization members
        """
        members_response = (
            self.admin_client.table("users")
            .select("id,user_name,email,role,status")
            .eq("organization_id", str(organization_id))
            .eq("status", "active")
            .neq("id", str(current_user_id))
            .eq("is_deleted", False)
            .order("user_name")
            .execute()
        )

        return members_response.data or []

    async def get_messages(
        self, conversation_id: UUID, user_id: UUID, limit: int = 50, offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get messages in a conversation.

        Args:
            conversation_id: Conversation ID
            user_id: User ID (for authorization check)
            limit: Number of messages to fetch
            offset: Offset for pagination

        Returns:
            List of messages with reactions
        """
        # Verify user has access to conversation
        conversation_response = (
            self.admin_client.table("conversations")
            .select("*")
            .eq("id", str(conversation_id))
            .single()
            .execute()
        )

        if not conversation_response.data:
            raise NotFoundError("Conversation not found")

        conv = conversation_response.data
        if str(conv["participant1_id"]) != str(user_id) and str(
            conv["participant2_id"]
        ) != str(user_id):
            raise AuthorizationError("You don't have access to this conversation")

        # Get messages
        # Try with foreign key relationship first, fallback if it fails
        try:
            messages_response = (
                self.admin_client.table("messages")
                .select(
                    "*",
                    "sender:users!messages_sender_id_fkey(id,user_name,email)",
                    "reply_to:messages!messages_reply_to_id_fkey(id,content,sender_id,sender:users!messages_sender_id_fkey(user_name))",
                )
                .eq("conversation_id", str(conversation_id))
                .eq("is_deleted", False)
                .order("created_at", desc=True)
                .limit(limit)
                .offset(offset)
                .execute()
            )
        except Exception as e:
            # Fallback: fetch without reply_to relationship if foreign key constraint doesn't exist
            # This can happen if the migration hasn't been run yet
            messages_response = (
                self.admin_client.table("messages")
                .select(
                    "*",
                    "sender:users!messages_sender_id_fkey(id,user_name,email)",
                )
                .eq("conversation_id", str(conversation_id))
                .eq("is_deleted", False)
                .order("created_at", desc=True)
                .limit(limit)
                .offset(offset)
                .execute()
            )

        messages = messages_response.data or []
        
        # Check if reply_to relationships were fetched by checking if any message has reply_to data
        has_reply_to_data = any(msg.get("reply_to") for msg in messages if msg.get("reply_to_id"))
        
        # If reply_to relationships weren't fetched, fetch them manually for messages that have reply_to_id
        reply_to_ids = [msg.get("reply_to_id") for msg in messages if msg.get("reply_to_id")]
        reply_to_data = {}
        if reply_to_ids and not has_reply_to_data:
            # Fetch reply_to messages manually
            try:
                reply_to_response = (
                    self.admin_client.table("messages")
                    .select(
                        "id,content,sender_id",
                        "sender:users!messages_sender_id_fkey(id,user_name)",
                    )
                    .in_("id", reply_to_ids)
                    .execute()
                )
                for reply_msg in reply_to_response.data or []:
                    reply_to_data[str(reply_msg["id"])] = reply_msg
            except Exception:
                pass  # If this fails, we'll just not include reply_to data

        # Get reactions for all messages
        message_ids = [msg["id"] for msg in messages]
        reactions = {}
        if message_ids:
            reactions_response = (
                self.admin_client.table("message_reactions")
                .select(
                    "*",
                    "user:users!message_reactions_user_id_fkey(id,user_name)",
                )
                .in_("message_id", message_ids)
                .execute()
            )

            for reaction in reactions_response.data or []:
                msg_id = reaction["message_id"]
                if msg_id not in reactions:
                    reactions[msg_id] = []
                reactions[msg_id].append(reaction)

        # Format messages
        formatted_messages = []
        for msg in reversed(messages):  # Reverse to show oldest first
            sender = msg.get("sender", {})
            reply_to = msg.get("reply_to")
            
            # If reply_to wasn't fetched via relationship, use manually fetched data
            if not reply_to and msg.get("reply_to_id"):
                reply_to = reply_to_data.get(str(msg.get("reply_to_id")))
            
            # Handle reply_to sender name
            reply_to_sender_name = None
            if reply_to:
                reply_to_sender = reply_to.get("sender", {})
                reply_to_sender_name = reply_to_sender.get("user_name") if reply_to_sender else None

            formatted_msg = {
                "id": msg["id"],
                "conversation_id": msg["conversation_id"],
                "sender_id": msg["sender_id"],
                "sender_name": sender.get("user_name", "Unknown"),
                "sender_avatar": None,
                "content": msg["content"],
                "content_type": msg.get("content_type", "text"),
                "reply_to_id": msg.get("reply_to_id"),
                "reply_to_content": reply_to.get("content") if reply_to else None,
                "reply_to_sender_name": reply_to_sender_name,
                "forwarded_from_id": msg.get("forwarded_from_id"),
                "forwarded_from_user_id": msg.get("forwarded_from_user_id"),
                "forwarded_from_user_name": None,  # Can be fetched if needed
                "is_edited": msg.get("is_edited", False),
                "edited_at": msg.get("edited_at"),
                "is_deleted": msg.get("is_deleted", False),
                "deleted_at": msg.get("deleted_at"),
                "reactions": reactions.get(str(msg["id"]), []),
                "created_at": msg["created_at"],
                "updated_at": msg["updated_at"],
            }
            formatted_messages.append(formatted_msg)

        return formatted_messages

    async def send_message(
        self, message_data: MessageCreate, sender_id: UUID
    ) -> Dict[str, Any]:
        """
        Send a new message.

        Args:
            message_data: Message creation data
            sender_id: Sender user ID

        Returns:
            Dict with created message data
        """
        # Verify sender has access to conversation
        conversation_response = (
            self.admin_client.table("conversations")
            .select("*")
            .eq("id", str(message_data.conversation_id))
            .single()
            .execute()
        )

        if not conversation_response.data:
            raise NotFoundError("Conversation not found")

        conv = conversation_response.data
        if str(conv["participant1_id"]) != str(sender_id) and str(
            conv["participant2_id"]
        ) != str(sender_id):
            raise AuthorizationError("You don't have access to this conversation")

        # Create message
        message_dict = {
            "conversation_id": str(message_data.conversation_id),
            "sender_id": str(sender_id),
            "content": message_data.content,
            "content_type": message_data.content_type,
            "reply_to_id": str(message_data.reply_to_id) if message_data.reply_to_id else None,
            "forwarded_from_id": (
                str(message_data.forwarded_from_id) if message_data.forwarded_from_id else None
            ),
            "forwarded_from_user_id": (
                str(message_data.forwarded_from_user_id)
                if message_data.forwarded_from_user_id
                else None
            ),
        }

        # Insert message (without select - insert doesn't support select chaining)
        message_response = (
            self.admin_client.table("messages")
            .insert(message_dict)
            .execute()
        )

        if not message_response.data:
            raise BadRequestError("Failed to create message")

        inserted_message = message_response.data[0]
        message_id = inserted_message["id"]
        
        # Fetch the message with related data (sender info)
        try:
            message_with_sender = (
                self.admin_client.table("messages")
                .select(
                    "*",
                    "sender:users!messages_sender_id_fkey(id,user_name,email)",
                )
                .eq("id", message_id)
                .single()
                .execute()
            )
            message = message_with_sender.data
        except Exception:
            # Fallback: use the inserted message and fetch sender separately
            message = inserted_message
            try:
                sender_response = (
                    self.admin_client.table("users")
                    .select("id,user_name,email")
                    .eq("id", str(message["sender_id"]))
                    .single()
                    .execute()
                )
                message["sender"] = sender_response.data if sender_response.data else {}
            except Exception:
                message["sender"] = {}
        
        # Format message for response (similar to get_messages format)
        sender = message.get("sender", {})
        formatted_message = {
            "id": message["id"],
            "conversation_id": message["conversation_id"],
            "sender_id": message["sender_id"],
            "sender_name": sender.get("user_name", "Unknown"),
            "sender_avatar": None,
            "content": message["content"],
            "content_type": message.get("content_type", "text"),
            "reply_to_id": message.get("reply_to_id"),
            "reply_to_content": None,
            "reply_to_sender_name": None,
            "forwarded_from_id": message.get("forwarded_from_id"),
            "forwarded_from_user_id": message.get("forwarded_from_user_id"),
            "forwarded_from_user_name": None,
            "is_edited": message.get("is_edited", False),
            "edited_at": message.get("edited_at"),
            "is_deleted": message.get("is_deleted", False),
            "deleted_at": message.get("deleted_at"),
            "reactions": [],
            "created_at": message["created_at"],
            "updated_at": message["updated_at"],
        }

        return formatted_message

    async def update_message(
        self, message_id: UUID, message_data: MessageUpdate, user_id: UUID
    ) -> Dict[str, Any]:
        """
        Update a message (edit).

        Args:
            message_id: Message ID
            message_data: Message update data
            user_id: User ID (must be message sender)

        Returns:
            Dict with updated message data
        """
        # Get message
        message_response = (
            self.admin_client.table("messages")
            .select("*")
            .eq("id", str(message_id))
            .single()
            .execute()
        )

        if not message_response.data:
            raise NotFoundError("Message not found")

        message = message_response.data

        # Verify user is the sender
        if str(message["sender_id"]) != str(user_id):
            raise AuthorizationError("You can only edit your own messages")

        # Update message
        update_data = {
            "content": message_data.content,
            "is_edited": True,
            "edited_at": datetime.utcnow().isoformat(),
        }

        updated_response = (
            self.admin_client.table("messages")
            .update(update_data)
            .eq("id", str(message_id))
            .execute()
        )

        if not updated_response.data:
            raise BadRequestError("Failed to update message")

        return updated_response.data[0]

    async def delete_message(self, message_id: UUID, user_id: UUID) -> bool:
        """
        Delete a message (soft delete).

        Args:
            message_id: Message ID
            user_id: User ID (must be message sender)

        Returns:
            bool: True if successful
        """
        # Get message
        message_response = (
            self.admin_client.table("messages")
            .select("*")
            .eq("id", str(message_id))
            .single()
            .execute()
        )

        if not message_response.data:
            raise NotFoundError("Message not found")

        message = message_response.data

        # Verify user is the sender
        if str(message["sender_id"]) != str(user_id):
            raise AuthorizationError("You can only delete your own messages")

        # Soft delete
        self.admin_client.table("messages").update(
            {
                "is_deleted": True,
                "deleted_at": datetime.utcnow().isoformat(),
            }
        ).eq("id", str(message_id)).execute()

        return True

    async def add_reaction(
        self, message_id: UUID, reaction_data: MessageReactionCreate, user_id: UUID
    ) -> Dict[str, Any]:
        """
        Add a reaction to a message.

        Args:
            message_id: Message ID
            reaction_data: Reaction data
            user_id: User ID

        Returns:
            Dict with reaction data
        """
        # Verify user has access to message
        message_response = (
            self.admin_client.table("messages")
            .select("conversation_id")
            .eq("id", str(message_id))
            .single()
            .execute()
        )

        if not message_response.data:
            raise NotFoundError("Message not found")

        # Check conversation access
        conversation_response = (
            self.admin_client.table("conversations")
            .select("*")
            .eq("id", message_response.data["conversation_id"])
            .single()
            .execute()
        )

        if not conversation_response.data:
            raise NotFoundError("Conversation not found")

        conv = conversation_response.data
        if str(conv["participant1_id"]) != str(user_id) and str(
            conv["participant2_id"]
        ) != str(user_id):
            raise AuthorizationError("You don't have access to this message")

        # Add or update reaction
        reaction_dict = {
            "message_id": str(message_id),
            "user_id": str(user_id),
            "emoji": reaction_data.emoji,
        }

        reaction_response = (
            self.admin_client.table("message_reactions")
            .upsert(reaction_dict, on_conflict="message_id,user_id,emoji")
            .execute()
        )

        if not reaction_response.data:
            raise BadRequestError("Failed to add reaction")

        return reaction_response.data[0]

    async def remove_reaction(
        self, message_id: UUID, emoji: str, user_id: UUID
    ) -> bool:
        """
        Remove a reaction from a message.

        Args:
            message_id: Message ID
            emoji: Emoji to remove
            user_id: User ID

        Returns:
            bool: True if successful
        """
        self.admin_client.table("message_reactions").delete().eq(
            "message_id", str(message_id)
        ).eq("user_id", str(user_id)).eq("emoji", emoji).execute()

        return True

    async def pin_message(
        self, conversation_id: UUID, message_id: UUID, user_id: UUID
    ) -> Dict[str, Any]:
        """
        Pin a message in a conversation.

        Args:
            conversation_id: Conversation ID
            message_id: Message ID
            user_id: User ID

        Returns:
            Dict with pinned message data
        """
        # Verify user has access to conversation
        conversation_response = (
            self.admin_client.table("conversations")
            .select("*")
            .eq("id", str(conversation_id))
            .single()
            .execute()
        )

        if not conversation_response.data:
            raise NotFoundError("Conversation not found")

        conv = conversation_response.data
        if str(conv["participant1_id"]) != str(user_id) and str(
            conv["participant2_id"]
        ) != str(user_id):
            raise AuthorizationError("You don't have access to this conversation")

        # Pin message
        pin_dict = {
            "conversation_id": str(conversation_id),
            "message_id": str(message_id),
            "pinned_by_id": str(user_id),
        }

        pin_response = (
            self.admin_client.table("pinned_messages")
            .upsert(pin_dict, on_conflict="conversation_id,message_id")
            .execute()
        )

        if not pin_response.data:
            raise BadRequestError("Failed to pin message")

        return pin_response.data[0]

    async def unpin_message(
        self, conversation_id: UUID, message_id: UUID, user_id: UUID
    ) -> bool:
        """
        Unpin a message from a conversation.

        Args:
            conversation_id: Conversation ID
            message_id: Message ID
            user_id: User ID

        Returns:
            bool: True if successful
        """
        # Verify user has access
        conversation_response = (
            self.admin_client.table("conversations")
            .select("*")
            .eq("id", str(conversation_id))
            .single()
            .execute()
        )

        if not conversation_response.data:
            raise NotFoundError("Conversation not found")

        conv = conversation_response.data
        if str(conv["participant1_id"]) != str(user_id) and str(
            conv["participant2_id"]
        ) != str(user_id):
            raise AuthorizationError("You don't have access to this conversation")

        # Unpin message
        self.admin_client.table("pinned_messages").delete().eq(
            "conversation_id", str(conversation_id)
        ).eq("message_id", str(message_id)).execute()

        return True

    async def get_pinned_messages(
        self, conversation_id: UUID, user_id: UUID
    ) -> List[Dict[str, Any]]:
        """
        Get pinned messages in a conversation.

        Args:
            conversation_id: Conversation ID
            user_id: User ID

        Returns:
            List of pinned messages
        """
        # Verify user has access
        conversation_response = (
            self.admin_client.table("conversations")
            .select("*")
            .eq("id", str(conversation_id))
            .single()
            .execute()
        )

        if not conversation_response.data:
            raise NotFoundError("Conversation not found")

        conv = conversation_response.data
        if str(conv["participant1_id"]) != str(user_id) and str(
            conv["participant2_id"]
        ) != str(user_id):
            raise AuthorizationError("You don't have access to this conversation")

        # Get pinned messages
        pinned_response = (
            self.admin_client.table("pinned_messages")
            .select(
                "*",
                "message:messages!pinned_messages_message_id_fkey(*,sender:users!messages_sender_id_fkey(id,user_name))",
            )
            .eq("conversation_id", str(conversation_id))
            .order("created_at", desc=True)
            .execute()
        )

        return pinned_response.data or []

