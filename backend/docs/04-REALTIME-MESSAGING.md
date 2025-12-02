# Real-time Messaging Implementation Guide

## Overview
This document provides a comprehensive guide for implementing real-time messaging and live features using Supabase Realtime in the FastAPI backend. The system supports broadcast messaging, presence tracking, and selective use of Postgres Changes for the video conferencing application.

## Table of Contents
1. [Architecture](#architecture)
2. [Realtime Features](#realtime-features)
3. [Backend Implementation](#backend-implementation)
4. [Channel Management](#channel-management)
5. [Message Broadcasting](#message-broadcasting)
6. [Presence Tracking](#presence-tracking)
7. [Database Changes (Limited Use)](#database-changes-limited-use)
8. [Frontend Integration](#frontend-integration)
9. [Performance Optimization](#performance-optimization)
10. [Best Practices](#best-practices)

---

## Architecture

### Realtime Flow
```
Frontend WebSocket → Supabase Realtime → Backend Broadcast
                            ↓
                      Channel Management
                            ↓
                    ┌───────┴───────┐
                    ↓               ↓
              Broadcast         Presence
              Messages          Tracking
                    ↓               ↓
              All Clients    State Sync
```

### Key Principles
1. **Server-Side Management**: Backend manages channel lifecycle and authorization
2. **Broadcast for Ephemeral Data**: Use Broadcast for chat, cursor positions, reactions
3. **Presence for User Status**: Track who's online, in meetings, typing, etc.
4. **Limited Postgres Changes**: Only use for critical data sync (performance concern)
5. **Authorization**: Implement RLS-like authorization for realtime events

---

## Realtime Features

### Feature Matrix

| Feature | Method | Use Case | Performance |
|---------|--------|----------|-------------|
| Chat Messages | Broadcast | In-meeting chat | High |
| Typing Indicators | Broadcast | Show who's typing | High |
| Cursor Positions | Broadcast | Collaborative features | High |
| Reactions | Broadcast | Emoji reactions | High |
| User Presence | Presence | Who's online/in meeting | High |
| Meeting State | Broadcast | Meeting status changes | High |
| Message History | Postgres Changes | Sync stored messages | Low* |
| Participant Join/Leave | Broadcast + Presence | Real-time participant list | High |

*Postgres Changes have scalability limitations - use sparingly

---

## Backend Implementation

### 1. Realtime Service

**File: `app/services/realtime_service.py`**

```python
from typing import Dict, Any, Optional, List, Callable
from supabase import create_client, Client
from app.core.supabase import supabase
from app.core.config import settings
import logging
import asyncio
import json

logger = logging.getLogger(__name__)

class RealtimeService:
    """
    Service for managing Supabase Realtime operations.
    Handles channels, broadcasts, and presence tracking.
    """
    
    def __init__(self):
        self.channels: Dict[str, Any] = {}
        self.presence_states: Dict[str, Dict] = {}
    
    async def create_meeting_channel(
        self,
        meeting_id: str,
        user_id: str,
        user_name: str
    ) -> str:
        """
        Create and subscribe to a meeting channel.
        
        Channel naming: meeting:{meeting_id}
        """
        channel_name = f"meeting:{meeting_id}"
        
        try:
            # Create channel
            channel = supabase.channel(channel_name)
            
            # Set up event handlers
            def on_subscribe(status, err):
                if status == "SUBSCRIBED":
                    logger.info(f"Subscribed to channel: {channel_name}")
                    # Track presence
                    asyncio.create_task(
                        channel.track({
                            "user_id": user_id,
                            "user_name": user_name,
                            "joined_at": datetime.now().isoformat(),
                            "status": "active"
                        })
                    )
                else:
                    logger.error(f"Subscription error: {err}")
            
            # Subscribe to broadcast events
            await channel.on_broadcast(
                event="message",
                callback=self._handle_message_broadcast
            ).on_broadcast(
                event="typing",
                callback=self._handle_typing_broadcast
            ).on_broadcast(
                event="reaction",
                callback=self._handle_reaction_broadcast
            ).on_presence_sync(
                callback=self._handle_presence_sync
            ).on_presence_join(
                callback=self._handle_presence_join
            ).on_presence_leave(
                callback=self._handle_presence_leave
            ).subscribe(on_subscribe)
            
            # Store channel reference
            self.channels[channel_name] = channel
            
            return channel_name
            
        except Exception as e:
            logger.error(f"Error creating channel: {e}")
            raise
    
    async def broadcast_message(
        self,
        meeting_id: str,
        event: str,
        payload: Dict[str, Any]
    ) -> bool:
        """
        Broadcast message to all channel subscribers.
        
        Args:
            meeting_id: Meeting ID
            event: Event name (message, typing, reaction, etc.)
            payload: Event data
        """
        channel_name = f"meeting:{meeting_id}"
        
        try:
            if channel_name not in self.channels:
                logger.warning(f"Channel not found: {channel_name}")
                return False
            
            channel = self.channels[channel_name]
            
            await channel.send_broadcast(event, payload)
            
            logger.info(f"Broadcasted {event} to {channel_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error broadcasting message: {e}")
            return False
    
    async def track_presence(
        self,
        meeting_id: str,
        user_id: str,
        state: Dict[str, Any]
    ) -> bool:
        """
        Update user presence state.
        
        State can include:
        - status: active, away, busy
        - is_muted: boolean
        - is_video_on: boolean
        - is_screen_sharing: boolean
        """
        channel_name = f"meeting:{meeting_id}"
        
        try:
            if channel_name not in self.channels:
                return False
            
            channel = self.channels[channel_name]
            
            await channel.track({
                "user_id": user_id,
                **state,
                "updated_at": datetime.now().isoformat()
            })
            
            return True
            
        except Exception as e:
            logger.error(f"Error tracking presence: {e}")
            return False
    
    async def untrack_presence(
        self,
        meeting_id: str,
        user_id: str
    ) -> bool:
        """
        Remove user from presence tracking.
        Called when user leaves meeting.
        """
        channel_name = f"meeting:{meeting_id}"
        
        try:
            if channel_name not in self.channels:
                return False
            
            channel = self.channels[channel_name]
            await channel.untrack()
            
            return True
            
        except Exception as e:
            logger.error(f"Error untracking presence: {e}")
            return False
    
    async def get_presence_state(
        self,
        meeting_id: str
    ) -> Dict[str, Any]:
        """
        Get current presence state for all users in channel.
        """
        channel_name = f"meeting:{meeting_id}"
        
        if channel_name in self.presence_states:
            return self.presence_states[channel_name]
        
        return {}
    
    async def leave_channel(self, meeting_id: str) -> bool:
        """
        Leave and clean up channel.
        """
        channel_name = f"meeting:{meeting_id}"
        
        try:
            if channel_name in self.channels:
                channel = self.channels[channel_name]
                await channel.unsubscribe()
                del self.channels[channel_name]
                
                if channel_name in self.presence_states:
                    del self.presence_states[channel_name]
                
                logger.info(f"Left channel: {channel_name}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error leaving channel: {e}")
            return False
    
    # Event handlers
    def _handle_message_broadcast(self, payload):
        """Handle incoming chat messages."""
        logger.info(f"Message received: {payload}")
        # Additional processing if needed
    
    def _handle_typing_broadcast(self, payload):
        """Handle typing indicators."""
        logger.debug(f"Typing indicator: {payload}")
    
    def _handle_reaction_broadcast(self, payload):
        """Handle emoji reactions."""
        logger.info(f"Reaction received: {payload}")
    
    def _handle_presence_sync(self, payload):
        """Handle presence synchronization."""
        channel_name = payload.get('channel')
        if channel_name:
            self.presence_states[channel_name] = payload.get('state', {})
        logger.info(f"Presence synced: {channel_name}")
    
    def _handle_presence_join(self, payload):
        """Handle user joining presence."""
        logger.info(f"User joined: {payload}")
        # Update presence state
        channel_name = payload.get('channel')
        if channel_name and channel_name in self.presence_states:
            user_id = payload.get('user_id')
            if user_id:
                self.presence_states[channel_name][user_id] = payload
    
    def _handle_presence_leave(self, payload):
        """Handle user leaving presence."""
        logger.info(f"User left: {payload}")
        # Remove from presence state
        channel_name = payload.get('channel')
        if channel_name and channel_name in self.presence_states:
            user_id = payload.get('user_id')
            if user_id and user_id in self.presence_states[channel_name]:
                del self.presence_states[channel_name][user_id]


# Singleton instance
realtime_service = RealtimeService()
```

---

## Channel Management

### Channel Naming Convention

```python
# Channel naming patterns
CHANNEL_PATTERNS = {
    "meeting": "meeting:{meeting_id}",           # Meeting-specific channel
    "organization": "org:{org_id}",              # Organization-wide channel
    "user": "user:{user_id}",                    # User-specific notifications
    "direct": "dm:{user1_id}:{user2_id}"         # Direct messages (future)
}

def get_channel_name(channel_type: str, **kwargs) -> str:
    """
    Generate channel name from pattern.
    
    Examples:
        get_channel_name("meeting", meeting_id="123")
        get_channel_name("organization", org_id="456")
    """
    pattern = CHANNEL_PATTERNS.get(channel_type)
    if not pattern:
        raise ValueError(f"Invalid channel type: {channel_type}")
    
    return pattern.format(**kwargs)
```

### Channel Authorization

```python
async def authorize_channel_access(
    user_id: str,
    user_role: str,
    organization_id: str,
    channel_name: str
) -> bool:
    """
    Verify user has permission to access channel.
    Implements RLS-like authorization for realtime.
    """
    # Parse channel name
    channel_type, channel_id = channel_name.split(":", 1)
    
    if channel_type == "meeting":
        # Check if user is participant or invited
        response = await supabase.table("meeting_participants").select("id").eq(
            "meeting_id", channel_id
        ).eq("user_id", user_id).execute()
        
        if response.data:
            return True
        
        # Check invitations
        invite_response = await supabase.table("meeting_invitations").select("id").eq(
            "meeting_id", channel_id
        ).eq("invitee_user_id", user_id).eq("status", "accepted").execute()
        
        return bool(invite_response.data)
    
    elif channel_type == "org":
        # Check if user belongs to organization
        return channel_id == organization_id
    
    elif channel_type == "user":
        # User can only access their own channel
        return channel_id == user_id
    
    return False
```

---

## Message Broadcasting

### Chat Messages

```python
# In routers/realtime.py

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from app.core.security import get_current_user
from app.services.realtime_service import realtime_service

router = APIRouter(prefix="/realtime", tags=["Realtime"])

@router.post("/meeting/{meeting_id}/message")
async def send_chat_message(
    meeting_id: str,
    message: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Send chat message to meeting channel.
    Message is both stored in DB and broadcast.
    """
    # Store message in database
    message_record = await supabase.table("messages").insert({
        "meeting_id": meeting_id,
        "sender_user_id": current_user["id"],
        "content": message,
        "message_type": "text"
    }).execute()
    
    # Broadcast to all participants
    await realtime_service.broadcast_message(
        meeting_id=meeting_id,
        event="message",
        payload={
            "id": message_record.data[0]["id"],
            "sender_id": current_user["id"],
            "sender_name": current_user["full_name"],
            "content": message,
            "timestamp": message_record.data[0]["created_at"]
        }
    )
    
    return {
        "message_id": message_record.data[0]["id"],
        "status": "sent"
    }
```

### Typing Indicators

```python
@router.post("/meeting/{meeting_id}/typing")
async def send_typing_indicator(
    meeting_id: str,
    is_typing: bool,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Broadcast typing indicator.
    Ephemeral - not stored in database.
    """
    await realtime_service.broadcast_message(
        meeting_id=meeting_id,
        event="typing",
        payload={
            "user_id": current_user["id"],
            "user_name": current_user["full_name"],
            "is_typing": is_typing
        }
    )
    
    return {"status": "broadcasted"}
```

### Reactions

```python
@router.post("/meeting/{meeting_id}/reaction")
async def send_reaction(
    meeting_id: str,
    message_id: str,
    emoji: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Add reaction to message.
    Store in DB and broadcast.
    """
    # Update message reactions in database
    message = await supabase.table("messages").select("reactions").eq(
        "id", message_id
    ).single().execute()
    
    reactions = message.data.get("reactions", [])
    reactions.append({
        "emoji": emoji,
        "user_id": current_user["id"],
        "created_at": datetime.now().isoformat()
    })
    
    await supabase.table("messages").update({
        "reactions": reactions
    }).eq("id", message_id).execute()
    
    # Broadcast reaction
    await realtime_service.broadcast_message(
        meeting_id=meeting_id,
        event="reaction",
        payload={
            "message_id": message_id,
            "emoji": emoji,
            "user_id": current_user["id"],
            "user_name": current_user["full_name"]
        }
    )
    
    return {"status": "reaction_added"}
```

---

## Presence Tracking

### Join Meeting

```python
@router.post("/meeting/{meeting_id}/join")
async def join_meeting(
    meeting_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Join meeting and start presence tracking.
    """
    # Verify access
    has_access = await authorize_channel_access(
        user_id=current_user["id"],
        user_role=current_user["role"],
        organization_id=current_user["organization_id"],
        channel_name=f"meeting:{meeting_id}"
    )
    
    if not has_access:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Create channel and track presence
    channel_name = await realtime_service.create_meeting_channel(
        meeting_id=meeting_id,
        user_id=current_user["id"],
        user_name=current_user["full_name"]
    )
    
    # Update participant record in database
    await supabase.table("meeting_participants").insert({
        "meeting_id": meeting_id,
        "user_id": current_user["id"],
        "role": "participant",
        "joined_at": "now()"
    }).execute()
    
    # Broadcast join event
    await realtime_service.broadcast_message(
        meeting_id=meeting_id,
        event="participant_joined",
        payload={
            "user_id": current_user["id"],
            "user_name": current_user["full_name"],
            "avatar_url": current_user.get("avatar_url")
        }
    )
    
    return {
        "channel": channel_name,
        "status": "joined"
    }
```

### Update Presence State

```python
@router.post("/meeting/{meeting_id}/presence")
async def update_presence(
    meeting_id: str,
    state: Dict[str, Any],
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Update user presence state (muted, video on, etc.).
    """
    # Validate state keys
    allowed_keys = {
        "is_muted", "is_video_on", "is_screen_sharing",
        "is_hand_raised", "status"
    }
    
    filtered_state = {
        k: v for k, v in state.items() if k in allowed_keys
    }
    
    # Track presence
    await realtime_service.track_presence(
        meeting_id=meeting_id,
        user_id=current_user["id"],
        state=filtered_state
    )
    
    # Update database record
    await supabase.table("meeting_participants").update(
        filtered_state
    ).eq("meeting_id", meeting_id).eq("user_id", current_user["id"]).execute()
    
    return {"status": "presence_updated"}
```

### Leave Meeting

```python
@router.post("/meeting/{meeting_id}/leave")
async def leave_meeting(
    meeting_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Leave meeting and stop presence tracking.
    """
    # Untrack presence and leave channel
    await realtime_service.untrack_presence(
        meeting_id=meeting_id,
        user_id=current_user["id"]
    )
    
    await realtime_service.leave_channel(meeting_id)
    
    # Update participant record
    await supabase.table("meeting_participants").update({
        "left_at": "now()"
    }).eq("meeting_id", meeting_id).eq("user_id", current_user["id"]).execute()
    
    # Broadcast leave event
    await realtime_service.broadcast_message(
        meeting_id=meeting_id,
        event="participant_left",
        payload={
            "user_id": current_user["id"],
            "user_name": current_user["full_name"]
        }
    )
    
    return {"status": "left"}
```

### Get Presence State

```python
@router.get("/meeting/{meeting_id}/presence")
async def get_meeting_presence(
    meeting_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get current presence state of all meeting participants.
    """
    presence = await realtime_service.get_presence_state(meeting_id)
    
    return {
        "meeting_id": meeting_id,
        "participants": presence,
        "count": len(presence)
    }
```

---

## Database Changes (Limited Use)

### When to Use Postgres Changes

⚠️ **Use Sparingly** - Postgres Changes have performance limitations:
- Every change triggers authorization checks for ALL subscribers
- Single-threaded processing maintains order
- Can become bottleneck with many users

✅ **Good Use Cases:**
- Critical data sync (meeting start/end)
- Infrequent updates
- Small number of subscribers

❌ **Bad Use Cases:**
- Chat messages (use Broadcast)
- Typing indicators (use Broadcast)
- Frequent updates (use Broadcast)
- Large subscriber count

### Enable Postgres Changes

```sql
-- Enable replication for specific table
ALTER TABLE public.meetings REPLICA IDENTITY FULL;

-- Create publication
CREATE PUBLICATION supabase_realtime FOR TABLE public.meetings;
```

### Subscribe to Database Changes

```python
async def subscribe_to_meeting_changes(meeting_id: str):
    """
    Subscribe to database changes for meeting table.
    Use only for critical updates.
    """
    channel = supabase.channel(f"db:meeting:{meeting_id}")
    
    def handle_insert(payload):
        logger.info(f"Meeting inserted: {payload}")
    
    def handle_update(payload):
        logger.info(f"Meeting updated: {payload}")
        # Broadcast meeting status change
        if 'new' in payload and 'status' in payload['new']:
            asyncio.create_task(
                realtime_service.broadcast_message(
                    meeting_id=meeting_id,
                    event="meeting_status_changed",
                    payload={
                        "status": payload['new']['status'],
                        "updated_at": payload['new']['updated_at']
                    }
                )
            )
    
    def handle_delete(payload):
        logger.info(f"Meeting deleted: {payload}")
    
    # Subscribe to changes
    await channel.on_postgres_changes(
        event="INSERT",
        schema="public",
        table="meetings",
        filter=f"id=eq.{meeting_id}",
        callback=handle_insert
    ).on_postgres_changes(
        event="UPDATE",
        schema="public",
        table="meetings",
        filter=f"id=eq.{meeting_id}",
        callback=handle_update
    ).on_postgres_changes(
        event="DELETE",
        schema="public",
        table="meetings",
        filter=f"id=eq.{meeting_id}",
        callback=handle_delete
    ).subscribe()
```

---

## Frontend Integration

### WebSocket Connection (React)

```typescript
// hooks/useRealtimeChannel.ts
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

export const useRealtimeChannel = (channelName: string) => {
  const [channel, setChannel] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  
  useEffect(() => {
    const newChannel = supabase.channel(channelName);
    
    newChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        console.log('Connected to channel:', channelName);
      }
    });
    
    setChannel(newChannel);
    
    return () => {
      newChannel.unsubscribe();
      setIsConnected(false);
    };
  }, [channelName]);
  
  return { channel, isConnected };
};
```

### Chat Component

```typescript
// components/MeetingChat.tsx
import React, { useState, useEffect } from 'react';
import { useRealtimeChannel } from '../hooks/useRealtimeChannel';
import axios from 'axios';

interface Message {
  id: string;
  sender_name: string;
  content: string;
  timestamp: string;
}

export const MeetingChat: React.FC<{ meetingId: string }> = ({ meetingId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const { channel, isConnected } = useRealtimeChannel(`meeting:${meetingId}`);
  
  useEffect(() => {
    if (!channel) return;
    
    // Listen for messages
    channel.on('broadcast', { event: 'message' }, (payload: any) => {
      setMessages(prev => [...prev, payload.payload]);
    });
    
  }, [channel]);
  
  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    
    try {
      await axios.post(
        `/api/realtime/meeting/${meetingId}/message`,
        { message: newMessage },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('access_token')}`
          }
        }
      );
      
      setNewMessage('');
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };
  
  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map(msg => (
          <div key={msg.id} className="message">
            <strong>{msg.sender_name}:</strong> {msg.content}
          </div>
        ))}
      </div>
      <div className="input-area">
        <input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Type a message..."
        />
        <button onClick={sendMessage} disabled={!isConnected}>
          Send
        </button>
      </div>
    </div>
  );
};
```

### Presence Component

```typescript
// components/ParticipantList.tsx
import React, { useState, useEffect } from 'react';
import { useRealtimeChannel } from '../hooks/useRealtimeChannel';

interface Participant {
  user_id: string;
  user_name: string;
  is_muted: boolean;
  is_video_on: boolean;
  status: string;
}

export const ParticipantList: React.FC<{ meetingId: string }> = ({ meetingId }) => {
  const [participants, setParticipants] = useState<Record<string, Participant>>({});
  const { channel } = useRealtimeChannel(`meeting:${meetingId}`);
  
  useEffect(() => {
    if (!channel) return;
    
    // Listen for presence sync
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      setParticipants(state);
    });
    
    // Listen for joins
    channel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
      console.log('User joined:', newPresences);
    });
    
    // Listen for leaves
    channel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      console.log('User left:', leftPresences);
    });
    
  }, [channel]);
  
  return (
    <div className="participants">
      <h3>Participants ({Object.keys(participants).length})</h3>
      {Object.entries(participants).map(([key, participant]) => (
        <div key={key} className="participant">
          <span>{participant.user_name}</span>
          {participant.is_muted && <span>🔇</span>}
          {participant.is_video_on && <span>📹</span>}
        </div>
      ))}
    </div>
  );
};
```

---

## Performance Optimization

### 1. Connection Pooling

```python
# Limit concurrent realtime connections
MAX_CONNECTIONS_PER_USER = 3
MAX_CHANNELS_PER_USER = 5

class ConnectionManager:
    def __init__(self):
        self.user_connections: Dict[str, List[str]] = {}
    
    def can_connect(self, user_id: str) -> bool:
        connections = self.user_connections.get(user_id, [])
        return len(connections) < MAX_CONNECTIONS_PER_USER
    
    def add_connection(self, user_id: str, channel: str):
        if user_id not in self.user_connections:
            self.user_connections[user_id] = []
        self.user_connections[user_id].append(channel)
    
    def remove_connection(self, user_id: str, channel: str):
        if user_id in self.user_connections:
            self.user_connections[user_id].remove(channel)
```

### 2. Message Batching

```python
class MessageBatcher:
    """Batch multiple messages to reduce broadcast calls."""
    
    def __init__(self, batch_size: int = 10, batch_timeout: float = 0.5):
        self.batch_size = batch_size
        self.batch_timeout = batch_timeout
        self.pending_messages: List[Dict] = []
        self.last_flush = time.time()
    
    async def add_message(self, meeting_id: str, message: Dict):
        self.pending_messages.append({
            "meeting_id": meeting_id,
            "message": message
        })
        
        # Flush if batch is full or timeout reached
        if len(self.pending_messages) >= self.batch_size or \
           time.time() - self.last_flush > self.batch_timeout:
            await self.flush()
    
    async def flush(self):
        if not self.pending_messages:
            return
        
        # Group by meeting
        by_meeting = {}
        for item in self.pending_messages:
            meeting_id = item["meeting_id"]
            if meeting_id not in by_meeting:
                by_meeting[meeting_id] = []
            by_meeting[meeting_id].append(item["message"])
        
        # Broadcast batches
        for meeting_id, messages in by_meeting.items():
            await realtime_service.broadcast_message(
                meeting_id=meeting_id,
                event="message_batch",
                payload={"messages": messages}
            )
        
        self.pending_messages = []
        self.last_flush = time.time()
```

### 3. Rate Limiting

```python
from slowapi import Limiter

limiter = Limiter(key_func=get_remote_address)

@router.post("/meeting/{meeting_id}/message")
@limiter.limit("30/minute")  # 30 messages per minute
async def send_message_rate_limited(
    request: Request,
    meeting_id: str,
    message: str,
    current_user: Dict = Depends(get_current_user)
):
    # ... implementation
    pass
```

---

## Best Practices

### 1. Use the Right Tool

✅ **Broadcast:**
- Chat messages
- Typing indicators
- Reactions
- Cursor positions
- Ephemeral data
- High-frequency updates

✅ **Presence:**
- User online status
- Meeting participation
- User state (muted, video on)
- Connection quality

❌ **Postgres Changes:**
- Chat messages (use Broadcast!)
- User status (use Presence!)
- High-frequency updates

### 2. Authorization

✅ **DO:**
- Verify channel access before subscribing
- Implement server-side authorization checks
- Use RLS policies where applicable
- Log access attempts
- Rate limit broadcasts

❌ **DON'T:**
- Trust client-side channel access
- Skip authorization checks
- Expose sensitive data in broadcasts
- Allow unlimited broadcasts

### 3. Error Handling

```python
async def safe_broadcast(meeting_id: str, event: str, payload: Dict):
    """
    Broadcast with error handling and retry.
    """
    max_retries = 3
    retry_delay = 1  # seconds
    
    for attempt in range(max_retries):
        try:
            await realtime_service.broadcast_message(
                meeting_id=meeting_id,
                event=event,
                payload=payload
            )
            return True
        except Exception as e:
            logger.error(f"Broadcast failed (attempt {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(retry_delay)
    
    return False
```

### 4. Monitoring

```python
# Track metrics
class RealtimeMetrics:
    active_channels: int = 0
    total_broadcasts: int = 0
    failed_broadcasts: int = 0
    average_latency: float = 0.0
    
    @classmethod
    def record_broadcast(cls, success: bool, latency: float):
        cls.total_broadcasts += 1
        if not success:
            cls.failed_broadcasts += 1
        cls.average_latency = (
            (cls.average_latency * (cls.total_broadcasts - 1) + latency) 
            / cls.total_broadcasts
        )

# Expose metrics endpoint
@router.get("/metrics")
async def get_realtime_metrics():
    return {
        "active_channels": RealtimeMetrics.active_channels,
        "total_broadcasts": RealtimeMetrics.total_broadcasts,
        "failed_broadcasts": RealtimeMetrics.failed_broadcasts,
        "success_rate": 1 - (RealtimeMetrics.failed_broadcasts / max(RealtimeMetrics.total_broadcasts, 1)),
        "average_latency_ms": RealtimeMetrics.average_latency * 1000
    }
```

---

## Summary

This realtime implementation provides:
- ✅ Broadcast for ephemeral messaging
- ✅ Presence for user status tracking
- ✅ Selective Postgres Changes usage
- ✅ Channel-based architecture
- ✅ Authorization and security
- ✅ Performance optimization
- ✅ Frontend integration examples
- ✅ Production-ready patterns

**Key Takeaways:**
1. **Use Broadcast** for most real-time features (chat, reactions, typing)
2. **Use Presence** for user status and state
3. **Limit Postgres Changes** - performance bottleneck with many users
4. **Implement Authorization** - don't rely solely on RLS
5. **Monitor Performance** - track metrics and optimize

**Next Steps:**
1. Set up Realtime in Supabase Dashboard
2. Implement backend realtime service
3. Create channel management
4. Add authorization checks
5. Integrate with frontend
6. Test with multiple users
7. Monitor performance
8. Optimize as needed