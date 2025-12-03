import { useEffect, useState, useRef } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

export interface RealtimeSubscription {
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  schema?: string;
  table: string;
  filter?: string;
  callback: (payload: any) => void;
}

interface UseRealtimeChannelOptions {
  channelName: string;
  subscriptions?: RealtimeSubscription[];
  onBroadcast?: (event: string, payload: any) => void;
  onPresenceSync?: (state: any) => void;
  onPresenceJoin?: (key: string, currentPresences: any) => void;
  onPresenceLeave?: (key: string, leftPresences: any) => void;
}

export const useRealtimeChannel = ({
  channelName,
  subscriptions = [],
  onBroadcast,
  onPresenceSync,
  onPresenceJoin,
  onPresenceLeave,
}: UseRealtimeChannelOptions) => {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const subscriptionsRef = useRef(subscriptions);

  useEffect(() => {
    subscriptionsRef.current = subscriptions;
  }, [subscriptions]);

  const onBroadcastRef = useRef(onBroadcast);
  const onPresenceSyncRef = useRef(onPresenceSync);
  const onPresenceJoinRef = useRef(onPresenceJoin);
  const onPresenceLeaveRef = useRef(onPresenceLeave);

  useEffect(() => {
    onBroadcastRef.current = onBroadcast;
    onPresenceSyncRef.current = onPresenceSync;
    onPresenceJoinRef.current = onPresenceJoin;
    onPresenceLeaveRef.current = onPresenceLeave;
  }, [onBroadcast, onPresenceSync, onPresenceJoin, onPresenceLeave]);

  useEffect(() => {
    if (!channelName || !supabase) return;

    console.log('🔌 Setting up channel:', channelName); // Debug log

    // Cleanup previous channel if it exists
    if (channelRef.current) {
      console.log('🧹 Cleaning up previous channel');
      channelRef.current.unsubscribe();
    }

    const newChannel = supabase.channel(channelName, {
      config: {
        broadcast: { self: true },
        presence: { key: '' },
      },
    });

    // Subscribe to broadcast events
    newChannel.on('broadcast', { event: '*' }, (payload) => {
      if (onBroadcastRef.current) {
        onBroadcastRef.current(payload.event, payload.payload);
      }
    });
    
    // Subscribe to Postgres Changes
    // We use the initial subscriptions config to set up the channel
    // But inside the callback, we look up the matching subscription from the ref to get the latest callback
    subscriptions.forEach(({ event, schema = 'public', table, filter }) => {
      console.log(`📥 Subscribing to ${event} on ${table} with filter ${filter}`); // Debug log
      newChannel.on(
        'postgres_changes',
        {
          event,
          schema,
          table,
          filter,
        } as any,
        (payload) => {
          console.log(`📨 Received event ${event} on ${table}`); // Debug log
          // Find the matching subscription in the latest refs to call the latest callback
          const currentSub = subscriptionsRef.current.find(
            (s) => 
              s.event === event && 
              s.table === table && 
              (s.filter === filter || (!s.filter && !filter))
          );
          
          if (currentSub && currentSub.callback) {
            currentSub.callback(payload);
          }
        }
      );
    });

    // Subscribe to presence events
    newChannel.on('presence', { event: 'sync' }, () => {
      const state = newChannel.presenceState();
      if (onPresenceSyncRef.current) {
        onPresenceSyncRef.current(state);
      }
    });

    newChannel.on('presence', { event: 'join' }, ({ key, currentPresences }) => {
      if (onPresenceJoinRef.current) {
        onPresenceJoinRef.current(key, currentPresences);
      }
    });

    newChannel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
      if (onPresenceLeaveRef.current) {
        onPresenceLeaveRef.current(key, leftPresences);
      }
    });

    // Subscribe to channel
    newChannel.subscribe((status) => {
      console.log(`📡 Channel status for ${channelName}:`, status); // Debug log
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
        console.log('Unsubscribing from channel:', channelName);
        channelRef.current.unsubscribe();
        setChannel(null);
        setIsConnected(false);
      }
    };
  }, [channelName, JSON.stringify(subscriptions.map(s => ({...s, callback: undefined})))]);

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


