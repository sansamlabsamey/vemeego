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

    // Subscribe to participant status updates
    // We need to check both by participant ID and by user_id since we might have either
    const channel = supabase
      .channel(`outgoing_call_${meetingId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'meeting_participants',
          filter: `meeting_id=eq.${meetingId}`,
        },
        async (payload) => {
          const updatedParticipant = payload.new;
          
          // Check if this is the participant we're calling
          // participantId could be either the participant record ID or the user_id
          const isTargetParticipant = 
            updatedParticipant.id === participantId || 
            updatedParticipant.user_id === participantId;
          
          if (isTargetParticipant) {
            if (updatedParticipant.status === 'accepted') {
              setCallStatus('accepted');
              // Navigate to meeting after a short delay
              setTimeout(() => {
                navigate(`/meeting/${meetingId}`);
                onCancel();
              }, 500);
            } else if (updatedParticipant.status === 'declined') {
              setCallStatus('declined');
              setTimeout(() => {
                onCancel();
              }, 2000);
            }
          }
        }
      )
      .subscribe();

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
        // Try to find the participant record if participantId is actually a user_id
        const { data: participantData } = await supabase
          .from('meeting_participants')
          .select('id')
          .eq('meeting_id', meetingId)
          .eq('user_id', participantId)
          .single();

        const actualParticipantId = participantData?.id || participantId;
        
        await api.patch(
          API_ENDPOINTS.MEETINGS.UPDATE_PARTICIPANT_STATUS(meetingId, actualParticipantId),
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

