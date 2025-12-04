import { useEffect, useState, useRef } from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase, authenticateSupabaseClient } from "../utils/supabase";

export interface RealtimeSubscription {
  event: "INSERT" | "UPDATE" | "DELETE" | "*";
  schema?: string;
  table: string;
  filter?: string;
  callback: (payload: any) => void;
}

interface UseRealtimeChannelOptions {
  channelName: string | null; // Allow null to prevent subscriptions with invalid names
  subscriptions?: RealtimeSubscription[];
  onBroadcast?: (event: string, payload: any) => void;
  onPresenceSync?: (state: any) => void;
  onPresenceJoin?: (key: string, currentPresences: any) => void;
  onPresenceLeave?: (key: string, leftPresences: any) => void;
  isPrivate?: boolean; // Whether the channel is private (for Broadcast authorization)
}

export const useRealtimeChannel = ({
  channelName,
  subscriptions = [],
  onBroadcast,
  onPresenceSync,
  onPresenceJoin,
  onPresenceLeave,
  isPrivate = false,
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
    if (!supabase) {
      console.warn("⚠️ Supabase client not initialized");
      return;
    }
    if (
      !channelName ||
      channelName === "null" ||
      channelName.includes(":null")
    ) {
      if (channelRef.current) {
        console.log(
          "Unsubscribing because channelName is null or invalid:",
          channelName
        );
        channelRef.current.unsubscribe();
        channelRef.current = null;
        setChannel(null);
        setIsConnected(false);
      }
      return;
    }

    // Ensure Supabase client is authenticated before setting up subscription
    const setupChannel = async () => {
      const accessToken = localStorage.getItem("access_token");
      const refreshToken = localStorage.getItem("refresh_token");

      if (accessToken) {
        try {
          await authenticateSupabaseClient(
            accessToken,
            refreshToken || undefined
          );
          // Wait longer to ensure auth is fully propagated to realtime connection
          // This is critical for RLS policies to work correctly with Postgres Changes
          await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (error) {
          console.error("Failed to authenticate before channel setup:", error);
        }
      }

      console.log("🔌 Setting up channel:", channelName);

      // CRITICAL: Ensure auth token is set on realtime connection BEFORE creating channel
      // This must happen before .channel() for Postgres Changes to work with RLS
      if (accessToken) {
        supabase.realtime.setAuth(accessToken);
        console.log(
          "🔐 Set auth token on realtime connection for channel:",
          channelName,
          "(before channel creation)"
        );
        // Small delay to ensure auth is propagated
        await new Promise((resolve) => setTimeout(resolve, 50));
      } else {
        console.warn("⚠️ No access token available for channel:", channelName);
      }

      // Cleanup previous channel if it exists
      if (channelRef.current) {
        console.log(
          "🧹 Cleaning up previous channel",
          channelRef.current.topic
        );
        channelRef.current.unsubscribe();
      }

      const newChannel = supabase.channel(channelName, {
        config: {
          broadcast: { self: true },
          presence: { key: "" },
          private: isPrivate, // Set private flag for Broadcast authorization
        },
      });

      // Subscribe to broadcast events
      newChannel.on("broadcast", { event: "*" }, (payload) => {
        if (onBroadcastRef.current) {
          onBroadcastRef.current(payload.event, payload.payload);
        }
      });

      // Subscribe to Postgres Changes
      // We use the initial subscriptions config to set up the channel
      // But inside the callback, we look up the matching subscription from the ref to get the latest callback
      subscriptions.forEach(({ event, schema = "public", table, filter }) => {
        console.log(
          `📥 Subscribing to ${event} on ${table} with filter ${
            filter || "none"
          }`
        );

        // Build the subscription config
        const subscriptionConfig: any = {
          event,
          schema,
          table,
        };

        // Only add filter if it's provided and not empty
        // Some filters can cause "mismatch between server and client bindings" errors
        if (filter && filter.trim() !== "") {
          subscriptionConfig.filter = filter;
        }

        newChannel.on("postgres_changes", subscriptionConfig, (payload) => {
          console.log(`📨 Received event ${event} on ${table}:`, payload); // Debug log
          console.log(`📨 Payload details:`, {
            eventType: payload.eventType,
            new: payload.new,
            old: payload.old,
            schema: payload.schema,
            table: payload.table,
          });

          // Find the matching subscription in the latest refs to call the latest callback
          const currentSub = subscriptionsRef.current.find(
            (s) =>
              s.event === event &&
              s.table === table &&
              (s.filter === filter || (!s.filter && !filter))
          );

          if (currentSub && currentSub.callback) {
            console.log(`✅ Calling callback for ${event} on ${table}`);
            try {
              currentSub.callback(payload);
            } catch (error) {
              console.error(
                `❌ Error in callback for ${event} on ${table}:`,
                error
              );
            }
          } else {
            console.warn(
              `⚠️ No matching subscription found for ${event} on ${table}`
            );
          }
        });
      });

      // Subscribe to presence events
      newChannel.on("presence", { event: "sync" }, () => {
        const state = newChannel.presenceState();
        if (onPresenceSyncRef.current) {
          onPresenceSyncRef.current(state);
        }
      });

      newChannel.on(
        "presence",
        { event: "join" },
        ({ key, currentPresences }) => {
          if (onPresenceJoinRef.current) {
            onPresenceJoinRef.current(key, currentPresences);
          }
        }
      );

      newChannel.on(
        "presence",
        { event: "leave" },
        ({ key, leftPresences }) => {
          if (onPresenceLeaveRef.current) {
            onPresenceLeaveRef.current(key, leftPresences);
          }
        }
      );

      // Subscribe to channel
      newChannel.subscribe((status, err) => {
        console.log(`📡 Channel status for ${channelName}:`, status, err); // Debug log
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          console.log("✅ Connected to channel:", channelName);
          // Verify auth is still set after subscription
          const currentToken = localStorage.getItem("access_token");
          if (currentToken && supabase) {
            supabase.realtime.setAuth(currentToken);
            console.log(
              `🔐 Re-verified auth token after subscription to ${channelName}`
            );
          }
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Channel error:", channelName, err);
          setIsConnected(false);
        } else if (status === "TIMED_OUT") {
          console.error("❌ Channel subscription timed out:", channelName);
          setIsConnected(false);
        } else if (status === "CLOSED") {
          console.warn("⚠️ Channel closed:", channelName);
          setIsConnected(false);
        } else {
          console.warn(
            `⚠️ Unexpected channel status for ${channelName}:`,
            status,
            err
          );
        }
      });

      setChannel(newChannel);
      channelRef.current = newChannel;
    };

    setupChannel();

    return () => {
      if (channelRef.current) {
        console.log("Unsubscribing from channel:", channelName);
        channelRef.current.unsubscribe();
        setChannel(null);
        setIsConnected(false);
      }
    };
  }, [
    channelName,
    JSON.stringify(subscriptions.map((s) => ({ ...s, callback: undefined }))),
  ]);

  const sendBroadcast = async (event: string, payload: any) => {
    if (!supabase) {
      console.warn("Supabase client not initialized");
      return false;
    }
    if (!channelRef.current || !isConnected) {
      console.error("Channel not connected");
      return false;
    }

    try {
      await channelRef.current.send({
        type: "broadcast",
        event,
        payload,
      });
      return true;
    } catch (error) {
      console.error("Error sending broadcast:", error);
      return false;
    }
  };

  const trackPresence = async (presence: any) => {
    if (!supabase) {
      console.warn("Supabase client not initialized");
      return false;
    }
    if (!channelRef.current || !isConnected) {
      console.error("Channel not connected");
      return false;
    }

    try {
      await channelRef.current.track(presence);
      return true;
    } catch (error) {
      console.error("Error tracking presence:", error);
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
