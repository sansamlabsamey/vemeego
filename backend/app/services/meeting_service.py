"""
Meeting Service
Handles meeting management and LiveKit integration.
"""

import os
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID

from livekit import api
from app.core.exceptions import (
    AuthorizationError,
    BadRequestError,
    NotFoundError,
)
from app.core.supabase_client import get_admin_client

from app.core.config import settings

class MeetingService:
    """Service class for meeting operations."""

    def __init__(self):
        self.admin_client = get_admin_client()
        self.livekit_url = settings.LIVEKIT_URL
        self.livekit_api_key = settings.LIVEKIT_API_KEY
        self.livekit_api_secret = settings.LIVEKIT_API_SECRET

    async def create_meeting(
        self,
        title: str,
        host_id: UUID,
        start_time: datetime,
        type: str = "scheduled",
        description: Optional[str] = None,
        end_time: Optional[datetime] = None,
        is_open: bool = False,
        participants: List[Dict[str, Any]] = [],
    ) -> Dict[str, Any]:
        """
        Create a new meeting.
        """
        # Create meeting record
        meeting_data = {
            "title": title,
            "description": description,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat() if end_time else None,
            "type": type,
            "status": "scheduled",
            "is_open": is_open,
            "host_id": str(host_id),
            "room_name": f"room_{datetime.utcnow().timestamp()}", # Generate unique room name
        }

        meeting_response = (
            self.admin_client.table("meetings")
            .insert(meeting_data)
            .execute()
        )

        if not meeting_response.data:
            raise BadRequestError("Failed to create meeting")

        meeting = meeting_response.data[0]
        meeting_id = meeting["id"]

        # Add host as participant
        host_participant = {
            "meeting_id": meeting_id,
            "user_id": str(host_id),
            "role": "host",
            "status": "accepted",
        }
        self.admin_client.table("meeting_participants").insert(host_participant).execute()

        # Add other participants
        if participants:
            participants_data = []
            for p in participants:
                p_data = {
                    "meeting_id": meeting_id,
                    "role": p.get("role", "attendee"),
                    "status": "invited",
                }
                if p.get("user_id"):
                    p_data["user_id"] = str(p["user_id"])
                elif p.get("email"):
                    p_data["email"] = p["email"]
                    p_data["name"] = p.get("name")
                
                participants_data.append(p_data)
            
            if participants_data:
                self.admin_client.table("meeting_participants").insert(participants_data).execute()

        return meeting

    async def get_meeting(self, meeting_id: UUID, user_id: UUID) -> Dict[str, Any]:
        """
        Get meeting details.
        """
        meeting_response = (
            self.admin_client.table("meetings")
            .select("*")
            .eq("id", str(meeting_id))
            .single()
            .execute()
        )

        if not meeting_response.data:
            raise NotFoundError("Meeting not found")

        meeting = meeting_response.data

        # Check access
        if not meeting["is_open"] and str(meeting["host_id"]) != str(user_id):
            # Check if participant
            participant_response = (
                self.admin_client.table("meeting_participants")
                .select("*")
                .eq("meeting_id", str(meeting_id))
                .eq("user_id", str(user_id))
                .single()
                .execute()
            )
            if not participant_response.data:
                raise AuthorizationError("You are not invited to this meeting")

        return meeting

    async def generate_token(self, meeting_id: UUID, user_id: UUID, user_name: str) -> str:
        """
        Generate LiveKit access token.
        """
        meeting = await self.get_meeting(meeting_id, user_id)
        
        # Get participant role
        participant_response = (
            self.admin_client.table("meeting_participants")
            .select("role")
            .eq("meeting_id", str(meeting_id))
            .eq("user_id", str(user_id))
            .single()
            .execute()
        )
        
        role = participant_response.data["role"] if participant_response.data else "attendee"
        
        # Define permissions based on role and meeting type
        can_publish = True
        can_subscribe = True
        can_publish_data = True
        
        if meeting["type"] == "webinar" and role == "attendee":
            # In webinar, attendees start with mic/cam off and need permission
            # However, LiveKit token permissions control if they CAN publish at all.
            # If we set can_publish=False, they can NEVER unmute unless we update token or metadata.
            # Better approach: Allow publish but client-side mute default, and use LiveKit room metadata 
            # or data messages to control "hand raise" / "allow to speak".
            # Or use LiveKit's ingress/egress for strict webinars.
            # For simplicity as per requirements: "participants that joined using the link will not be able to control their mic, camera or share screen until the host allows them."
            # We can set can_publish=False initially. When host allows, we regenerate token or update participant permissions.
            can_publish = False

        token = api.AccessToken(
            self.livekit_api_key,
            self.livekit_api_secret
        ).with_identity(str(user_id)) \
        .with_name(user_name) \
        .with_grants(api.VideoGrants(
            room_join=True,
            room=meeting["room_name"],
            can_publish=can_publish,
            can_subscribe=can_subscribe,
            can_publish_data=can_publish_data,
        ))
        
        print(f"DEBUG: Generated token for user {user_id} in room '{meeting['room_name']}'")
        print(f"DEBUG: Grants - can_publish: {can_publish}, can_subscribe: {can_subscribe}, can_publish_data: {can_publish_data}")

        return token.to_jwt()

    async def get_user_meetings(self, user_id: UUID) -> List[Dict[str, Any]]:
        """
        Get all meetings for a user (hosted or invited).
        """
        # This is complex to query directly with Supabase client in one go if we want OR condition across tables.
        # Simplest is to query meetings where host_id = user_id OR id IN (select meeting_id from participants where user_id = user_id)
        
        # Get meetings where user is participant
        participating_response = (
            self.admin_client.table("meeting_participants")
            .select("meeting_id")
            .eq("user_id", str(user_id))
            .execute()
        )
        
        meeting_ids = [p["meeting_id"] for p in participating_response.data or []]
        
        # Get meetings hosted by user or in meeting_ids
        meetings_response = (
            self.admin_client.table("meetings")
            .select("*")
            .or_(f"host_id.eq.{user_id},id.in.({','.join(meeting_ids) if meeting_ids else '00000000-0000-0000-0000-000000000000'})")
            .order("start_time", desc=True)
            .execute()
        )
        
        return meetings_response.data or []

    async def invite_participant(
        self,
        meeting_id: UUID,
        host_id: UUID,
        participant_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """
        Invite a participant to a meeting.
        """
        # Verify host
        meeting = await self.get_meeting(meeting_id, host_id)
        if str(meeting["host_id"]) != str(host_id):
            # Check if user is an assistant host (future scope), for now only host can invite
            raise AuthorizationError("Only the host can invite participants")

        p_data = {
            "meeting_id": str(meeting_id),
            "role": participant_data.get("role", "attendee"),
            "status": "invited",
        }
        
        if participant_data.get("user_id"):
            p_data["user_id"] = str(participant_data["user_id"])
        elif participant_data.get("email"):
            p_data["email"] = participant_data["email"]
            p_data["name"] = participant_data.get("name")
        else:
            raise BadRequestError("User ID or Email required")

        # Check if already participant
        existing = (
            self.admin_client.table("meeting_participants")
            .select("*")
            .eq("meeting_id", str(meeting_id))
            .eq("user_id", p_data.get("user_id"))
            .execute()
        )
        
        if existing.data:
            # Update status to invited if they declined previously, or just return existing
            return existing.data[0]

        response = (
            self.admin_client.table("meeting_participants")
            .insert(p_data)
            .execute()
        )

        if not response.data:
            raise BadRequestError("Failed to invite participant")
            
        return response.data[0]

    async def send_chat_message(
        self,
        meeting_id: UUID,
        user_id: UUID,
        user_name: str,
        content: str,
    ) -> Dict[str, Any]:
        """
        Send a chat message to the meeting.
        Saves to DB and publishes to LiveKit room.
        """
        # Verify access
        meeting = await self.get_meeting(meeting_id, user_id)
        
        # Save to DB
        message_data = {
            "meeting_id": str(meeting_id),
            "sender_id": str(user_id),
            "sender_name": user_name,
            "content": content,
        }
        
        response = (
            self.admin_client.table("meeting_chat_messages")
            .insert(message_data)
            .execute()
        )
        
        if not response.data:
            raise BadRequestError("Failed to send message")
            
        message = response.data[0]
        
        # Note: For E2EE rooms, server-side send_data doesn't work because the server
        # doesn't have encryption keys. The client must publish the message via LiveKit.
        # The backend only persists the message to the database.
        # The client will publish it via room.localParticipant.publishData() after
        # receiving this response.
        
        print(f"DEBUG: Message saved to database: {message['id']}")
        print(f"DEBUG: Client should publish this message via LiveKit for E2EE rooms")
            
        return message

    async def get_chat_messages(
        self,
        meeting_id: UUID,
        user_id: UUID,
    ) -> List[Dict[str, Any]]:
        """
        Get chat history for a meeting.
        """
        # Verify access
        await self.get_meeting(meeting_id, user_id)
        
        response = (
            self.admin_client.table("meeting_chat_messages")
            .select("*")
            .eq("meeting_id", str(meeting_id))
            .order("created_at", desc=False)
            .execute()
        )
        
        return response.data or []

    async def update_participant_status(
        self,
        meeting_id: UUID,
        participant_id: UUID,
        user_id: UUID,
        new_status: str,
    ) -> Dict[str, Any]:
        """
        Update participant status (accept/decline meeting invitation).
        """
        # Verify the participant belongs to the user
        participant_response = (
            self.admin_client.table("meeting_participants")
            .select("*")
            .eq("id", str(participant_id))
            .eq("meeting_id", str(meeting_id))
            .eq("user_id", str(user_id))
            .single()
            .execute()
        )
        
        if not participant_response.data:
            raise NotFoundError("Participant not found or access denied")
        
        # Validate status
        if new_status not in ["accepted", "declined"]:
            raise BadRequestError("Status must be 'accepted' or 'declined'")
        
        # Update status
        update_data = {"status": new_status}
        if new_status == "accepted":
            update_data["joined_at"] = datetime.utcnow().isoformat()
        
        response = (
            self.admin_client.table("meeting_participants")
            .update(update_data)
            .eq("id", str(participant_id))
            .execute()
        )
        
        if not response.data:
            raise BadRequestError("Failed to update participant status")
        
        return response.data[0]
