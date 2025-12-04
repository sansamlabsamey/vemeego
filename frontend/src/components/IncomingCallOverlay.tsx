import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, PhoneOff, Video, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useMeeting } from '../contexts/MeetingContext';
import { supabase } from '../utils/supabase';
import { api } from '../utils/api';
import { API_ENDPOINTS } from '../config';
import Avatar from './Avatar';

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
  const [incomingCall, setIncomingCall] = useState<IncomingCallData | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!user) return;

    // Check for existing invited participants on mount
    const checkExistingInvites = async () => {
      try {
        const { data: participants, error } = await supabase
          .from('meeting_participants')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'invited')
          .order('created_at', { ascending: false })
          .limit(1);

        if (error) {
          console.error("Error checking existing invites:", error);
          return;
        }

        if (participants && participants.length > 0) {
          const participant = participants[0];
          await handleIncomingCall(participant);
        }
      } catch (err) {
        console.error("Failed to check existing invites:", err);
      }
    };

    // Helper function to handle incoming call
    const handleIncomingCall = async (participant: any) => {
      try {
        const meetingRes = await api.get(API_ENDPOINTS.MEETINGS.DETAIL(participant.meeting_id));
        const meeting = meetingRes.data;
        
        console.log("Incoming call meeting details:", meeting);
        
        // Fetch caller (host) information
        let callerName = 'Unknown';
        let callerAvatar: string | undefined;
        
        try {
          // Get organization members to find caller info
          const membersRes = await api.get(API_ENDPOINTS.MESSAGING.MEMBERS);
          const caller = membersRes.data.find((m: any) => m.id === meeting.host_id);
          if (caller) {
            callerName = caller.user_name || caller.email || 'Unknown';
            callerAvatar = caller.avatar_url;
          }
        } catch (err) {
          console.error("Failed to fetch caller info:", err);
          // Fallback: use meeting title or host ID
          callerName = meeting.title?.replace('Call with ', '') || 'Unknown';
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

    // Check for existing invites
    checkExistingInvites();

    // Subscribe to meeting_participants table for new invites
    const channel = supabase
      .channel('incoming_calls')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'meeting_participants',
          filter: `user_id=eq.${user.id}`,
        },
        async (payload) => {
          console.log("Incoming call payload:", payload);
          const newParticipant = payload.new;
          if (newParticipant.status === 'invited') {
            await handleIncomingCall(newParticipant);
          }
        }
      )
      .subscribe((status) => {
        console.log("Incoming call subscription status:", status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (incomingCall) {
      // Play ringtone
      audioRef.current = new Audio('/ringtone.wav');
      audioRef.current.loop = true;
      audioRef.current.play().catch(e => console.error("Audio play failed", e));

      // Auto reject after 1 minute
      timeoutRef.current = setTimeout(() => {
        if (incomingCall) {
          handleReject();
        }
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
  }, [incomingCall]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAccept = async () => {
    if (!incomingCall || !user) return;
    
    // Stop ringtone
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    // Update participant status to accepted
    try {
      await api.patch(
        API_ENDPOINTS.MEETINGS.UPDATE_PARTICIPANT_STATUS(incomingCall.meetingId, incomingCall.participantId),
        { status: 'accepted' }
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
        API_ENDPOINTS.MEETINGS.UPDATE_PARTICIPANT_STATUS(incomingCall.meetingId, incomingCall.participantId),
        { status: 'accepted' }
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

  const handleReject = async () => {
    if (!incomingCall || !user) return;

    // Stop ringtone
    if (audioRef.current) {
      audioRef.current.pause();
    }

    // Update participant status to declined
    try {
      await api.patch(
        API_ENDPOINTS.MEETINGS.UPDATE_PARTICIPANT_STATUS(incomingCall.meetingId, incomingCall.participantId),
        { status: 'declined' }
      );
    } catch (error) {
      console.error("Failed to decline call:", error);
    }

    setIncomingCall(null);
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
                  <p className="text-sm font-semibold text-white truncate">{incomingCall.callerName}</p>
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
              <PhoneOff size={28} className="text-red-500 group-hover:text-white" />
            </div>
            <span className="text-sm text-slate-400 group-hover:text-white">Decline</span>
          </button>

          <button
            onClick={handleAccept}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-16 h-16 rounded-full bg-green-500/20 group-hover:bg-green-500 flex items-center justify-center transition-all border-2 border-green-500 animate-bounce">
              <Phone size={28} className="text-green-500 group-hover:text-white" />
            </div>
            <span className="text-sm text-slate-400 group-hover:text-white">Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallOverlay;
