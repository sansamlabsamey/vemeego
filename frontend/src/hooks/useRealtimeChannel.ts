import { useEffect, useState, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

interface UseRealtimeChannelOptions {
  channelName: string;
  onMessage?: (payload: any) => void;
  onPresenceSync?: (state: any) => void;
  onPresenceJoin?: (key: string, currentPresences: any) => void;
  onPresenceLeave?: (key: string, leftPresences: any) => void;
}

export const useRealtimeChannel = ({
  channelName,
  onMessage,
  onPresenceSync,
  onPresenceJoin,
  onPresenceLeave,
}: UseRealtimeChannelOptions) => {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!channelName || !supabase) return;

    const newChannel = supabase.channel(channelName, {
      config: {
        broadcast: { self: true },
        presence: { key: '' },
      },
    });

    // Subscribe to broadcast events (for manual broadcasts)
    if (onMessage) {
      newChannel.on('broadcast', { event: 'message' }, (payload) => {
        onMessage(payload);
      });
    }
    
    // Subscribe to Postgres Changes for messages table
    // This listens for INSERT events on the messages table filtered by conversation_id
    if (channelName.startsWith('conversation:')) {
      const conversationId = channelName.replace('conversation:', '');
      newChannel
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            // Format the message similar to backend response
            if (payload.new && onMessage) {
              const message = payload.new;
              // Fetch sender info if not included
              onMessage({
                event: 'message',
                payload: {
                  id: message.id,
                  conversation_id: message.conversation_id,
                  sender_id: message.sender_id,
                  content: message.content,
                  content_type: message.content_type,
                  reply_to_id: message.reply_to_id,
                  forwarded_from_id: message.forwarded_from_id,
                  forwarded_from_user_id: message.forwarded_from_user_id,
                  is_edited: message.is_edited,
                  is_deleted: message.is_deleted,
                  created_at: message.created_at,
                  updated_at: message.updated_at,
                  reactions: [],
                },
              });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${conversationId}`,
          },
          (payload) => {
            // Handle message updates (edits, deletes)
            if (payload.new && onMessage) {
              onMessage({
                event: 'message_update',
                payload: payload.new,
              });
            }
          }
        );
    }

    // Subscribe to presence events
    if (onPresenceSync) {
      newChannel.on('presence', { event: 'sync' }, () => {
        const state = newChannel.presenceState();
        onPresenceSync(state);
      });
    }

    if (onPresenceJoin) {
      newChannel.on('presence', { event: 'join' }, ({ key, currentPresences }) => {
        onPresenceJoin(key, currentPresences);
      });
    }

    if (onPresenceLeave) {
      newChannel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        onPresenceLeave(key, leftPresences);
      });
    }

    // Subscribe to channel
    newChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        console.log('Connected to channel:', channelName);
      } else if (status === 'CHANNEL_ERROR') {
        console.error('Channel error:', channelName);
        setIsConnected(false);
      }
    });

    setChannel(newChannel);
    channelRef.current = newChannel;

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        setChannel(null);
        setIsConnected(false);
      }
    };
  }, [channelName, onMessage, onPresenceSync, onPresenceJoin, onPresenceLeave]);

  const sendBroadcast = async (event: string, payload: any) => {
    if (!supabase) {
      console.warn('Supabase client not initialized');
      return false;
    }
    if (!channelRef.current || !isConnected) {
      console.error('Channel not connected');
      return false;
    }

    try {
      await channelRef.current.send({
        type: 'broadcast',
        event,
        payload,
      });
      return true;
    } catch (error) {
      console.error('Error sending broadcast:', error);
      return false;
    }
  };

  const trackPresence = async (presence: any) => {
    if (!supabase) {
      console.warn('Supabase client not initialized');
      return false;
    }
    if (!channelRef.current || !isConnected) {
      console.error('Channel not connected');
      return false;
    }

    try {
      await channelRef.current.track(presence);
      return true;
    } catch (error) {
      console.error('Error tracking presence:', error);
      return false;
    }
  };

  return {
    channel,
    isConnected,
    sendBroadcast,
    trackPresence,
  };
};


