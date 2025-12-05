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
from app.core.logger import log_warning, log_debug

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

        try:
            meeting_response = (
                self.admin_client.table("meetings")
                .insert(meeting_data)
                .execute()
            )

            if not meeting_response.data:
                raise BadRequestError("Failed to create meeting: No data returned")
        except Exception as e:
            # Handle Supabase/PostgREST errors
            error_msg = str(e)
            error_code = None
            
            # Try to extract error details from exception
            if hasattr(e, 'message'):
                if isinstance(e.message, dict):
                    error_msg = e.message.get('message', str(e))
                    error_code = e.message.get('code', '')
                elif isinstance(e.message, str):
                    error_msg = e.message
            elif hasattr(e, 'code'):
                error_code = str(e.code)
            
            # Check for specific error codes
            if error_code == '42P01' or 'does not exist' in error_msg.lower():
                raise BadRequestError(
                    f"Database error: {error_msg}. "
                    "Please ensure migrations have been run."
                )
            
            raise BadRequestError(f"Failed to create meeting: {error_msg}")

        meeting = meeting_response.data[0]
        meeting_id = meeting["id"]

        # Add host as participant
        host_participant = {
            "meeting_id": meeting_id,
            "user_id": str(host_id),
            "role": "host",
            "status": "accepted",
        }
        try:
            host_response = (
                self.admin_client.table("meeting_participants")
                .insert(host_participant)
                .execute()
            )
            host_participant_data = host_response.data[0] if host_response.data else None
        except Exception as e:
            # If host participant insert fails, log but continue
            # The meeting was created successfully
            error_msg = str(e)
            log_warning(f"Failed to add host as participant: {error_msg}")
            # Try to continue - meeting is created, just participant record failed
            host_participant_data = None

        # Add other participants and collect their IDs
        created_participants = []
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
                try:
                    participants_response = (
                        self.admin_client.table("meeting_participants")
                        .insert(participants_data)
                        .execute()
                    )
                    created_participants = participants_response.data or []
                except Exception as e:
                    # If participant insertion fails, log but continue
                    # The meeting was created successfully
                    error_msg = str(e)
                    log_warning(f"Failed to add participants: {error_msg}")
                    # Continue without participants - meeting is still created
                    created_participants = []

        # Build participants list (host + other participants)
        # Note: If participant insertion failed, this list may be empty
        # but the meeting is still successfully created
        all_participants = []
        if host_participant_data:
            all_participants.append(host_participant_data)
        all_participants.extend(created_participants)
        
        # Add participant IDs to meeting response for frontend
        meeting["participants"] = all_participants

        # Return the meeting even if participant insertion had issues
        # The meeting itself was created successfully
        return meeting

    async def get_meeting(self, meeting_id: UUID, user_id: UUID) -> Dict[str, Any]:
        """
        Get meeting details.
        """
        meeting_response = (
            self.admin_client.table("meetings")
            .select("*")
            .eq("id", str(meeting_id))
            .execute()
        )

        if not meeting_response.data or len(meeting_response.data) == 0:
            raise NotFoundError("Meeting not found")

        meeting = meeting_response.data[0]

        # Check access
        if not meeting["is_open"] and str(meeting["host_id"]) != str(user_id):
            # Check if participant
            participant_response = (
                self.admin_client.table("meeting_participants")
                .select("*")
                .eq("meeting_id", str(meeting_id))
                .eq("user_id", str(user_id))
                .execute()
            )
            if not participant_response.data or len(participant_response.data) == 0:
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
            .execute()
        )
        
        # Handle case where participant doesn't exist yet (e.g., for open meetings)
        if participant_response.data and len(participant_response.data) > 0:
            role = participant_response.data[0].get("role", "attendee")
        else:
            # If no participant record exists, check if meeting is open
            # For open meetings, allow joining as attendee
            if meeting.get("is_open", False):
                role = "attendee"
            else:
                raise AuthorizationError("You are not a participant in this meeting")
        
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
        
        log_debug(f"Generated token for user {user_id} in room '{meeting['room_name']}'")
        log_debug(f"Grants - can_publish: {can_publish}, can_subscribe: {can_subscribe}, can_publish_data: {can_publish_data}")

        return token.to_jwt()

    async def get_user_meetings(self, user_id: UUID) -> List[Dict[str, Any]]:
        """
        Get all meetings for a user (hosted or invited).
        Includes participant status for filtering missed calls.
        """
        # This is complex to query directly with Supabase client in one go if we want OR condition across tables.
        # Simplest is to query meetings where host_id = user_id OR id IN (select meeting_id from participants where user_id = user_id)
        
        # Get meetings where user is participant (with status)
        participating_response = (
            self.admin_client.table("meeting_participants")
            .select("meeting_id, status")
            .eq("user_id", str(user_id))
            .execute()
        )
        
        meeting_ids = [p["meeting_id"] for p in participating_response.data or []]
        participant_status_map = {p["meeting_id"]: p["status"] for p in participating_response.data or []}
        
        # Get meetings hosted by user or in meeting_ids
        meetings_response = (
            self.admin_client.table("meetings")
            .select("*")
            .or_(f"host_id.eq.{user_id},id.in.({','.join(meeting_ids) if meeting_ids else '00000000-0000-0000-0000-000000000000'})")
            .order("start_time", desc=True)
            .execute()
        )
        
        meetings = meetings_response.data or []
        
        # Add participant status to each meeting for filtering
        for meeting in meetings:
            meeting_id = meeting["id"]
            if meeting_id in participant_status_map:
                meeting["user_participant_status"] = participant_status_map[meeting_id]
            elif str(meeting["host_id"]) == str(user_id):
                meeting["user_participant_status"] = "host"
        
        return meetings

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
        
        log_debug(f"Message saved to database: {message['id']}")
        log_debug(f"Client should publish this message via LiveKit for E2EE rooms")
            
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
        participant_id can be either the participant record ID or a user_id (for lookup).
        """
        # First, try to find the participant record
        # If participant_id looks like a UUID and matches a participant record, use it
        # Otherwise, treat it as a user_id and look up the participant
        participant = None
        
        # Try as participant record ID first
        participant_response = (
            self.admin_client.table("meeting_participants")
            .select("*")
            .eq("id", str(participant_id))
            .eq("meeting_id", str(meeting_id))
            .execute()
        )
        participant = participant_response.data[0] if participant_response.data and len(participant_response.data) > 0 else None
        
        # If that fails, try as user_id
        if not participant:
            try:
                participant = await self.get_participant_by_user(meeting_id, UUID(participant_id))
            except:
                pass
        
        # If still not found, try direct user_id lookup
        if not participant:
            participant_response = (
                self.admin_client.table("meeting_participants")
                .select("*")
                .eq("meeting_id", str(meeting_id))
                .eq("user_id", str(participant_id))
                .execute()
            )
            participant = participant_response.data[0] if participant_response.data and len(participant_response.data) > 0 else None
        
        if not participant:
            raise NotFoundError("Participant not found")
        
        # Verify the participant belongs to the user OR the user is the meeting host
        # This allows hosts to cancel calls (update recipient status) and participants to accept/decline
        meeting = await self.get_meeting(meeting_id, user_id)
        is_participant_owner = str(participant["user_id"]) == str(user_id)
        is_meeting_host = str(meeting["host_id"]) == str(user_id)
        
        if not (is_participant_owner or is_meeting_host):
            raise AuthorizationError("You can only update your own participant status or if you are the meeting host")
        
        actual_participant_id = participant["id"]
        
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
            .eq("id", str(actual_participant_id))
            .execute()
        )
        
        if not response.data:
            raise BadRequestError("Failed to update participant status")
        
        return response.data[0]

    async def get_invited_participants(self, user_id: UUID) -> List[Dict[str, Any]]:
        """
        Get recent meeting participants where the user is invited (status = 'invited').
        Only returns invites from the last 5 minutes to avoid showing stale calls.
        Only returns instant meetings (calls), not scheduled meetings.
        """
        from datetime import timedelta
        
        # Only get invites from the last 5 minutes
        five_minutes_ago = (datetime.utcnow() - timedelta(minutes=5)).isoformat()
        
        # First get all recent participants
        participants_response = (
            self.admin_client.table("meeting_participants")
            .select("*")
            .eq("user_id", str(user_id))
            .eq("status", "invited")
            .gte("created_at", five_minutes_ago)
            .order("created_at", desc=True)
            .execute()
        )
        
        participants = participants_response.data or []
        if not participants:
            return []
        
        # Get meeting IDs and fetch meetings to filter by type
        meeting_ids = [p["meeting_id"] for p in participants]
        
        # Fetch meetings to check their type
        meetings_response = (
            self.admin_client.table("meetings")
            .select("id, type")
            .in_("id", meeting_ids)
            .execute()
        )
        
        # Create a map of meeting_id -> type
        meeting_types = {m["id"]: m["type"] for m in (meetings_response.data or [])}
        
        # Filter to only include instant meetings (calls), not scheduled meetings
        valid_participants = [
            p for p in participants 
            if meeting_types.get(p["meeting_id"]) == "instant"
        ]
        
        return valid_participants

    async def get_participant_by_user(
        self,
        meeting_id: UUID,
        user_id: UUID,
    ) -> Optional[Dict[str, Any]]:
        """
        Get participant record by meeting_id and user_id.
        """
        try:
            response = (
                self.admin_client.table("meeting_participants")
                .select("*")
                .eq("meeting_id", str(meeting_id))
                .eq("user_id", str(user_id))
                .execute()
            )
            return response.data[0] if response.data and len(response.data) > 0 else None
        except Exception:
            return None

    async def leave_meeting(
        self,
        meeting_id: UUID,
        user_id: UUID,
    ) -> Dict[str, Any]:
        """
        Mark participant as having left the meeting.
        This triggers auto-end logic if needed.
        """
        # Get participant record
        participant = await self.get_participant_by_user(meeting_id, user_id)
        if not participant:
            raise NotFoundError("Participant not found")
        
        # Update participant to mark as left
        update_data = {
            "left_at": datetime.utcnow().isoformat(),
            "status": "declined"  # Mark as declined since they left
        }
        
        response = (
            self.admin_client.table("meeting_participants")
            .update(update_data)
            .eq("id", str(participant["id"]))
            .execute()
        )
        
        if not response.data:
            raise BadRequestError("Failed to update participant leave status")
        
        # Check if meeting should auto-end
        await self._check_and_end_meeting_if_needed(meeting_id)
        
        return response.data[0]

    async def _check_and_end_meeting_if_needed(self, meeting_id: UUID) -> None:
        """
        Check if meeting should auto-end based on participant count and meeting type.
        - 1-1 calls (instant type with 2 participants): end when only 1 participant remains
        - Scheduled/webinars: end when all participants leave
        """
        # Get meeting details
        meeting_response = (
            self.admin_client.table("meetings")
            .select("*")
            .eq("id", str(meeting_id))
            .execute()
        )
        
        if not meeting_response.data:
            return
        
        meeting = meeting_response.data[0]
        
        # Don't end if already completed or cancelled
        if meeting["status"] in ["completed", "cancelled"]:
            return
        
        # Get all participants
        participants_response = (
            self.admin_client.table("meeting_participants")
            .select("*")
            .eq("meeting_id", str(meeting_id))
            .execute()
        )
        
        participants = participants_response.data or []
        
        # Count active participants (not declined, not missed, not left)
        active_participants = [
            p for p in participants
            if p.get("status") not in ["declined", "missed"]
            and p.get("left_at") is None
        ]
        
        should_end = False
        
        # Check auto-end conditions
        if meeting["type"] == "instant":
            # 1-1 call: end when only 1 participant remains (or less)
            # Check total participants to determine if it's a 1-1 call
            total_participants = len([p for p in participants if p.get("user_id")])  # Only count users, not external
            if total_participants == 2 and len(active_participants) <= 1:
                should_end = True
            elif len(active_participants) == 0:
                # All participants left
                should_end = True
        else:
            # Scheduled meeting or webinar: end when all participants leave
            if len(active_participants) == 0:
                should_end = True
        
        if should_end:
            host_id = UUID(meeting.get("host_id")) if meeting.get("host_id") else None
            await self.end_meeting(meeting_id, host_id)

    async def end_meeting(
        self,
        meeting_id: UUID,
        host_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        End a meeting: close room, clear chats, mark as completed.
        """
        # Get meeting
        meeting_response = (
            self.admin_client.table("meetings")
            .select("*")
            .eq("id", str(meeting_id))
            .execute()
        )
        
        if not meeting_response.data:
            raise NotFoundError("Meeting not found")
        
        meeting = meeting_response.data[0]
        
        # Don't end if already completed or cancelled
        if meeting["status"] in ["completed", "cancelled"]:
            return meeting
        
        # Close LiveKit room if room_name exists
        if meeting.get("room_name"):
            try:
                # Use LiveKit API to delete/close the room
                livekit_api = api.LiveKitAPI(
                    self.livekit_url,
                    self.livekit_api_key,
                    self.livekit_api_secret
                )
                # Delete room to close it
                livekit_api.delete_room(api.DeleteRoomRequest(room=meeting["room_name"]))
            except Exception as e:
                # Log but don't fail if room deletion fails
                # Room will be cleaned up automatically by LiveKit after inactivity
                log_warning(f"Failed to close LiveKit room: {str(e)}")
        
        # Clear meeting chat messages
        try:
            self.admin_client.table("meeting_chat_messages") \
                .delete() \
                .eq("meeting_id", str(meeting_id)) \
                .execute()
        except Exception as e:
            log_warning(f"Failed to clear chat messages: {str(e)}")
        
        # Update meeting status to completed
        update_data = {
            "status": "completed",
            "end_time": datetime.utcnow().isoformat(),
        }
        
        response = (
            self.admin_client.table("meetings")
            .update(update_data)
            .eq("id", str(meeting_id))
            .execute()
        )
        
        if not response.data:
            raise BadRequestError("Failed to end meeting")
        
        return response.data[0]

    async def mark_call_as_missed(
        self,
        meeting_id: UUID,
        participant_id: UUID,
    ) -> Dict[str, Any]:
        """
        Mark a call as missed when participant doesn't answer.
        For instant calls, this will also mark the meeting as "not_answered" and close the room.
        """
        # Get meeting first to check if it's an instant call
        meeting_response = (
            self.admin_client.table("meetings")
            .select("*")
            .eq("id", str(meeting_id))
            .execute()
        )
        
        if not meeting_response.data:
            raise NotFoundError("Meeting not found")
        
        meeting = meeting_response.data[0]
        
        # Get participant
        participant_response = (
            self.admin_client.table("meeting_participants")
            .select("*")
            .eq("id", str(participant_id))
            .eq("meeting_id", str(meeting_id))
            .execute()
        )
        
        if not participant_response.data:
            raise NotFoundError("Participant not found")
        
        participant = participant_response.data[0]
        
        # Only mark as missed if still in "invited" status
        if participant.get("status") != "invited":
            return participant
        
        # Update participant to missed
        update_data = {"status": "missed"}
        
        response = (
            self.admin_client.table("meeting_participants")
            .update(update_data)
            .eq("id", str(participant_id))
            .execute()
        )
        
        if not response.data:
            raise BadRequestError("Failed to mark call as missed")
        
        # If this is an instant call (1-1 call) and the participant is marked as missed,
        # mark the meeting as "not_answered" and close the room
        if meeting.get("type") == "instant" and meeting.get("status") not in ["completed", "cancelled", "not_answered"]:
            # Check if this is a 1-1 call (only 2 participants total)
            all_participants_response = (
                self.admin_client.table("meeting_participants")
                .select("*")
                .eq("meeting_id", str(meeting_id))
                .execute()
            )
            
            all_participants = all_participants_response.data or []
            user_participants = [p for p in all_participants if p.get("user_id")]
            
            # If it's a 1-1 call (2 participants) and one is marked as missed, mark meeting as not_answered
            if len(user_participants) == 2:
                # Check if any participant is missed
                has_missed = any(p.get("status") == "missed" for p in all_participants)
                
                if has_missed:
                    # Mark meeting as not_answered and close it
                    await self._mark_meeting_as_not_answered(meeting_id, meeting)
        
        return response.data[0]

    async def _mark_meeting_as_not_answered(
        self,
        meeting_id: UUID,
        meeting: Dict[str, Any],
    ) -> None:
        """
        Mark a meeting as not_answered and close the room.
        This is called when an instant call is not answered.
        """
        # Close LiveKit room if room_name exists
        if meeting.get("room_name"):
            try:
                # Use LiveKit API to delete/close the room
                livekit_api = api.LiveKitAPI(
                    self.livekit_url,
                    self.livekit_api_key,
                    self.livekit_api_secret
                )
                # Delete room to close it
                livekit_api.delete_room(api.DeleteRoomRequest(room=meeting["room_name"]))
            except Exception as e:
                # Log but don't fail if room deletion fails
                # Room will be cleaned up automatically by LiveKit after inactivity
                log_warning(f"Failed to close LiveKit room: {str(e)}")
        
        # Clear meeting chat messages (if any)
        try:
            self.admin_client.table("meeting_chat_messages") \
                .delete() \
                .eq("meeting_id", str(meeting_id)) \
                .execute()
        except Exception as e:
            log_warning(f"Failed to clear chat messages: {str(e)}")
        
        # Update meeting status to not_answered
        update_data = {
            "status": "not_answered",
            "end_time": datetime.utcnow().isoformat(),
        }
        
        try:
            self.admin_client.table("meetings") \
                .update(update_data) \
                .eq("id", str(meeting_id)) \
                .execute()
        except Exception as e:
            log_warning(f"Failed to mark meeting as not_answered: {str(e)}")