import React, { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Phone, PhoneOff, Video, X } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useMeeting } from "../contexts/MeetingContext";
import { supabase, authenticateSupabaseClient } from "../utils/supabase";
import { api } from "../utils/api";
import { API_ENDPOINTS } from "../config";
import Avatar from "./Avatar";

interface IncomingCallProps {
  // No props needed, it manages its own state via Supabase subscription
}

interface IncomingCallData {
  participantId: string;
  meetingId: string;
  meetingTitle: string;
  hostId: string;
  callerName: string;
  callerAvatar?: string;
}

const IncomingCallOverlay: React.FC<IncomingCallProps> = () => {
  const { user } = useAuth();
  const { isInMeeting, currentMeetingId } = useMeeting();
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(
    null
  );
  const [processedCallIds, setProcessedCallIds] = useState<Set<string>>(
    new Set()
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user || !supabase) return;

    // Authenticate Supabase client with user's JWT token
    // This is critical for RLS policies to work with Postgres Changes
    const accessToken = localStorage.getItem("access_token");
    const refreshToken = localStorage.getItem("refresh_token");

    if (!accessToken) {
      console.warn(
        "⚠️ No access token found, Supabase client not authenticated"
      );
      return;
    }

    // Authenticate first, then set up subscription
    // Use async to ensure auth completes before subscription
    const setupSubscription = async () => {
      try {
        await authenticateSupabaseClient(
          accessToken,
          refreshToken || undefined
        );
        console.log("🔐 Authenticated Supabase client for realtime");

        // Wait a bit longer to ensure auth is fully propagated to realtime connection
        // This is critical for Broadcast authorization to work correctly
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Double-check auth is set right before subscription
        // CRITICAL: For private channels, auth must be set on realtime connection
        const currentToken = localStorage.getItem("access_token");
        if (currentToken && supabase) {
          supabase.realtime.setAuth(currentToken);
          console.log(
            "🔐 Re-verified auth token right before subscription setup"
          );
          // Small delay after setting auth to ensure it's propagated
          await new Promise((resolve) => setTimeout(resolve, 100));
        }

        // Now set up the subscription
        setupCallSubscription();
      } catch (error) {
        console.error("❌ Failed to authenticate Supabase client:", error);
      }
    };

    // Helper function to handle incoming call
    const handleIncomingCall = async (participant: any) => {
      try {
        const meetingRes = await api.get(
          API_ENDPOINTS.MEETINGS.DETAIL(participant.meeting_id)
        );
        const meeting = meetingRes.data;

        console.log("Incoming call meeting details:", meeting);

        // Fetch caller (host) information
        let callerName = "Unknown";
        let callerAvatar: string | undefined;

        try {
          // Get organization members to find caller info
          const membersRes = await api.get(API_ENDPOINTS.MESSAGING.MEMBERS);
          const caller = membersRes.data.find(
            (m: any) => m.id === meeting.host_id
          );
          if (caller) {
            callerName = caller.user_name || caller.email || "Unknown";
            callerAvatar = caller.avatar_url;
          }
        } catch (err) {
          console.error("Failed to fetch caller info:", err);
          // Fallback: use meeting title or host ID
          callerName = meeting.title?.replace("Call with ", "") || "Unknown";
        }

        setIncomingCall({
          participantId: participant.id,
          meetingId: participant.meeting_id,
          meetingTitle: meeting.title,
          hostId: meeting.host_id,
          callerName,
          callerAvatar,
        });
      } catch (err) {
        console.error("Failed to fetch meeting details for call", err);
      }
    };

    let channelCleanup: (() => void) | null = null;

    const setupCallSubscription = () => {
      if (!supabase) return;

      // CRITICAL: Ensure auth token is set on realtime connection BEFORE creating channel
      // This is required for Broadcast authorization (private channels)
      const accessToken = localStorage.getItem("access_token");
      if (!accessToken) {
        console.error(
          "❌ No access token available for realtime subscription!"
        );
        return;
      }

      // CRITICAL: Set auth on realtime connection RIGHT BEFORE creating the channel
      // This must happen immediately before .channel() for private channels to work
      // The token must be a valid Supabase JWT (which it is, since backend uses Supabase Auth)
      try {
        supabase.realtime.setAuth(accessToken);
        console.log(
          "🔐 Set auth token on realtime connection for incoming calls (before channel creation)"
        );
      } catch (authError) {
        console.error("❌ Failed to set realtime auth:", authError);
        return;
      }

      // Subscribe to Broadcast channel for call invitations
      // Channel format: user:{user_id}:calls (matches database trigger topic)
      const channel = supabase
        .channel(`user:${user.id}:calls`, {
          config: {
            broadcast: { self: false },
            presence: { key: "" },
            private: true, // Private channel for Broadcast authorization
          },
        })
        .on("broadcast", { event: "call_invitation" }, async (payload) => {
          console.log("📞 Incoming call broadcast received:", payload);
          const callData = payload.payload;

          // Check if call data has required fields
          if (
            !callData ||
            !callData.participant_id ||
            !callData.meeting_id ||
            !callData.user_id
          ) {
            console.error("📞 Invalid call data in broadcast:", callData);
            return;
          }

          // Double-check user_id (should already be filtered by topic, but verify)
          if (callData.user_id !== user.id) {
            console.log(
              "📞 Ignoring call for different user:",
              callData.user_id,
              "!=",
              user.id
            );
            return;
          }

          // Only process if we haven't processed this call yet
          if (!processedCallIds.has(callData.participant_id)) {
            console.log(
              "📞 Processing incoming call for participant:",
              callData.participant_id
            );
            setProcessedCallIds((prev) =>
              new Set(prev).add(callData.participant_id)
            );

            // Create participant object in the format expected by handleIncomingCall
            const participant = {
              id: callData.participant_id,
              meeting_id: callData.meeting_id,
              user_id: callData.user_id,
              status: callData.status,
            };

            await handleIncomingCall(participant);
          } else {
            console.log(
              "📞 Ignoring already processed call:",
              callData.participant_id
            );
          }
        })
        .subscribe(async (status, err) => {
          console.log("📞 Incoming call subscription status:", status, err);
          if (status === "SUBSCRIBED") {
            console.log(
              "✅ Successfully subscribed to incoming calls (Broadcast)"
            );
          } else if (status === "CHANNEL_ERROR") {
            console.error("❌ Error subscribing to incoming calls:", err);
            // If authorization error, try re-authenticating
            if (err && err.message && err.message.includes("Unauthorized")) {
              console.log(
                "🔄 Attempting to re-authenticate for private channel..."
              );
              const currentToken = localStorage.getItem("access_token");
              if (currentToken && supabase) {
                supabase.realtime.setAuth(currentToken);
                // Try subscribing again after a short delay
                setTimeout(() => {
                  channel.subscribe();
                }, 500);
              }
            }
          } else if (status === "TIMED_OUT") {
            console.error("❌ Subscription timed out");
          } else if (status === "CLOSED") {
            console.warn("⚠️ Subscription closed");
          } else {
            console.warn("⚠️ Unexpected subscription status:", status);
          }
        });

      // Store cleanup function
      channelCleanup = () => {
        console.log("🧹 Cleaning up incoming calls channel");
        supabase.removeChannel(channel);
      };
    };

    // Start the async setup
    setupSubscription();

    // Cleanup function
    return () => {
      if (channelCleanup) {
        channelCleanup();
      }
    };
  }, [user]);

  const handleReject = useCallback(async () => {
    if (!incomingCall || !user) return;

    // Stop ringtone
    if (audioRef.current) {
      audioRef.current.pause();
    }

    // Mark call as missed (not answered)
    try {
      await api.post(
        API_ENDPOINTS.MEETINGS.MARK_MISSED(
          incomingCall.meetingId,
          incomingCall.participantId
        )
      );
    } catch (error) {
      console.error("Failed to mark call as missed:", error);
      // Fallback to declined if missed endpoint fails
      try {
        await api.patch(
          API_ENDPOINTS.MEETINGS.UPDATE_PARTICIPANT_STATUS(
            incomingCall.meetingId,
            incomingCall.participantId
          ),
          { status: "declined" }
        );
      } catch (err) {
        console.error("Failed to decline call:", err);
      }
    }

    setIncomingCall(null);
    // Clean up processed call IDs after a delay to prevent memory buildup
    // Keep IDs for 10 minutes to prevent duplicate notifications
    setTimeout(() => {
      setProcessedCallIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(incomingCall?.participantId || "");
        return newSet;
      });
    }, 10 * 60 * 1000); // 10 minutes
  }, [incomingCall, user]);

  useEffect(() => {
    if (incomingCall) {
      // Play ringtone
      audioRef.current = new Audio("/ringtone.wav");
      audioRef.current.loop = true;
      audioRef.current
        .play()
        .catch((e) => console.error("Audio play failed", e));

      // Auto reject after 1 minute (marks as missed)
      timeoutRef.current = setTimeout(() => {
        handleReject();
      }, 60000);

      return () => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }
  }, [incomingCall, handleReject]);

  const handleAccept = async () => {
    if (!incomingCall || !user) return;

    // Stop ringtone
    if (audioRef.current) {
      audioRef.current.pause();
    }

    // Update participant status to accepted
    try {
      await api.patch(
        API_ENDPOINTS.MEETINGS.UPDATE_PARTICIPANT_STATUS(
          incomingCall.meetingId,
          incomingCall.participantId
        ),
        { status: "accepted" }
      );

      // If in another meeting, navigate will trigger leave
      // Navigate to new meeting
      navigate(`/meeting/${incomingCall.meetingId}`);
      setIncomingCall(null);
    } catch (error) {
      console.error("Failed to accept call:", error);
      // Navigate anyway
      navigate(`/meeting/${incomingCall.meetingId}`);
      setIncomingCall(null);
    }
  };

  const handleLeaveAndJoin = async () => {
    if (!incomingCall || !user) return;

    // Stop ringtone
    if (audioRef.current) {
      audioRef.current.pause();
    }

    // Update participant status to accepted
    try {
      await api.patch(
        API_ENDPOINTS.MEETINGS.UPDATE_PARTICIPANT_STATUS(
          incomingCall.meetingId,
          incomingCall.participantId
        ),
        { status: "accepted" }
      );

      // Navigate to new meeting (this will automatically leave the current one)
      navigate(`/meeting/${incomingCall.meetingId}`);
      setIncomingCall(null);
    } catch (error) {
      console.error("Failed to accept call:", error);
      navigate(`/meeting/${incomingCall.meetingId}`);
      setIncomingCall(null);
    }
  };

  if (!incomingCall) return null;

  // If user is in another meeting, show Teams-like toast
  if (isInMeeting && currentMeetingId !== incomingCall.meetingId) {
    return (
      <div className="fixed top-4 right-4 z-[9999] animate-in slide-in-from-top duration-300">
        <div className="bg-slate-900 rounded-2xl shadow-2xl border border-slate-700 p-4 min-w-[320px] max-w-md">
          <div className="flex items-start gap-3">
            <div className="relative flex-shrink-0">
              <Avatar
                url={incomingCall.callerAvatar}
                name={incomingCall.callerName}
                size="md"
                className="ring-2 ring-indigo-500/50"
              />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                <Video size={10} className="text-white" />
              </div>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {incomingCall.callerName}
                  </p>
                  <p className="text-xs text-slate-400">Incoming call</p>
                </div>
                <button
                  onClick={handleReject}
                  className="flex-shrink-0 p-1 hover:bg-slate-800 rounded-lg transition-colors"
                  title="Dismiss"
                >
                  <X size={16} className="text-slate-400" />
                </button>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={handleReject}
                  className="flex-1 px-4 py-2 bg-slate-800 hover:bg-red-500/20 text-slate-300 hover:text-red-400 rounded-lg text-sm font-medium transition-all border border-slate-700 hover:border-red-500/50 flex items-center justify-center gap-2"
                >
                  <PhoneOff size={16} />
                  Decline
                </button>
                <button
                  onClick={handleLeaveAndJoin}
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2"
                >
                  <Phone size={16} />
                  Leave & Join
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Full screen overlay when not in a meeting
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-8 max-w-sm w-full border border-slate-700">
        <div className="relative">
          <Avatar
            url={incomingCall.callerAvatar}
            name={incomingCall.callerName}
            size="xl"
            className="ring-4 ring-indigo-500/50 animate-pulse"
          />
          <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 rounded-full border-4 border-slate-900 flex items-center justify-center">
            <Video size={16} className="text-white" />
          </div>
        </div>

        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold text-white">Incoming Call...</h3>
          <p className="text-slate-400 text-lg">{incomingCall.callerName}</p>
        </div>

        <div className="flex items-center gap-8 w-full justify-center">
          <button
            onClick={handleReject}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-16 h-16 rounded-full bg-red-500/20 group-hover:bg-red-500 flex items-center justify-center transition-all border-2 border-red-500">
              <PhoneOff
                size={28}
                className="text-red-500 group-hover:text-white"
              />
            </div>
            <span className="text-sm text-slate-400 group-hover:text-white">
              Decline
            </span>
          </button>

          <button
            onClick={handleAccept}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-16 h-16 rounded-full bg-green-500/20 group-hover:bg-green-500 flex items-center justify-center transition-all border-2 border-green-500 animate-bounce">
              <Phone
                size={28}
                className="text-green-500 group-hover:text-white"
              />
            </div>
            <span className="text-sm text-slate-400 group-hover:text-white">
              Accept
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallOverlay;
