import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { PhoneOff, Video } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../utils/supabase';
import { api } from '../utils/api';
import { API_ENDPOINTS } from '../config';
import Avatar from './Avatar';

interface OutgoingCallOverlayProps {
  meetingId: string;
  participantId: string;
  participantName: string;
  participantAvatar?: string;
  onCancel: () => void;
}

const OutgoingCallOverlay: React.FC<OutgoingCallOverlayProps> = ({
  meetingId,
  participantId,
  participantName,
  participantAvatar,
  onCancel,
}) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [callStatus, setCallStatus] = useState<'calling' | 'accepted' | 'declined' | 'timeout'>('calling');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user || !meetingId) return;

    // CRITICAL: Ensure auth token is set on realtime connection BEFORE creating channel
    // This is required for Broadcast authorization (private channels)
    const accessToken = localStorage.getItem("access_token");
    if (!accessToken || !supabase) {
      console.error("❌ No access token or Supabase client available for outgoing call");
      return;
    }
    
    supabase.realtime.setAuth(accessToken);
    console.log("🔐 Set auth token on realtime connection for outgoing call (before channel creation)");

    // Subscribe to Broadcast channel for call status updates
    // Channel format: meeting:{meetingId}:status (matches database trigger topic)
    const channel = supabase
      .channel(`meeting:${meetingId}:status`, {
        config: {
          broadcast: { self: false },
          presence: { key: "" },
          private: true, // Private channel for Broadcast authorization
        },
      })
      .on(
        'broadcast',
        { event: 'call_status_update' },
        async (payload) => {
          console.log("📞 Call status update broadcast received:", payload);
          const statusData = payload.payload;
          
          // Check if this is the participant we're calling
          // participantId could be either the participant record ID or the user_id
          const isTargetParticipant = 
            statusData.participant_id === participantId || 
            statusData.user_id === participantId;
          
          if (isTargetParticipant) {
            if (statusData.status === 'accepted') {
              setCallStatus('accepted');
              // Navigate to meeting after a short delay
              setTimeout(() => {
                navigate(`/meeting/${meetingId}`);
                onCancel();
              }, 500);
            } else if (statusData.status === 'declined') {
              setCallStatus('declined');
              setTimeout(() => {
                onCancel();
              }, 2000);
            }
          }
        }
      )
      .subscribe((status, err) => {
        console.log("📞 Outgoing call subscription status:", status, err);
        if (status === "SUBSCRIBED") {
          console.log("✅ Successfully subscribed to outgoing call status (Broadcast)");
        } else if (status === "CHANNEL_ERROR") {
          console.error("❌ Error subscribing to outgoing call status:", err);
        }
      });

    // Auto timeout after 1 minute
    timeoutRef.current = setTimeout(() => {
      setCallStatus('timeout');
      setTimeout(() => {
        onCancel();
      }, 2000);
    }, 60000);

    return () => {
      supabase.removeChannel(channel);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [user, meetingId, participantId, navigate, onCancel]);

  const handleCancel = async () => {
    // Update participant status to declined if still calling
    if (callStatus === 'calling') {
      try {
        // Backend API now handles both participant_id and user_id lookups
        await api.patch(
          API_ENDPOINTS.MEETINGS.UPDATE_PARTICIPANT_STATUS(meetingId, participantId),
          { status: 'declined' }
        );
      } catch (error) {
        console.error('Failed to cancel call:', error);
        // Continue with cancel even if API call fails
      }
    }
    onCancel();
  };

  if (callStatus === 'accepted') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
          <p className="text-white text-lg">Call accepted! Joining meeting...</p>
        </div>
      </div>
    );
  }

  if (callStatus === 'declined') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
          <p className="text-red-400 text-lg">Call declined</p>
        </div>
      </div>
    );
  }

  if (callStatus === 'timeout') {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
          <p className="text-slate-400 text-lg">No answer</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-8 max-w-sm w-full border border-slate-700">
        <div className="relative">
          <Avatar
            url={participantAvatar}
            name={participantName}
            size="xl"
            className="ring-4 ring-indigo-500/50"
          />
          <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-indigo-500 rounded-full border-4 border-slate-900 flex items-center justify-center">
            <Video size={16} className="text-white" />
          </div>
        </div>
        
        <div className="text-center space-y-2">
          <h3 className="text-2xl font-bold text-white">Calling...</h3>
          <p className="text-slate-400 text-lg">{participantName}</p>
        </div>

        <div className="flex items-center justify-center w-full">
          <button
            onClick={handleCancel}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-16 h-16 rounded-full bg-red-500/20 group-hover:bg-red-500 flex items-center justify-center transition-all border-2 border-red-500">
              <PhoneOff size={28} className="text-red-500 group-hover:text-white" />
            </div>
            <span className="text-sm text-slate-400 group-hover:text-white">Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default OutgoingCallOverlay;

