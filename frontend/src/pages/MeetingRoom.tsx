import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  LiveKitRoom,
  VideoConference,
  GridLayout,
  ParticipantTile,
  useTracks,
  RoomAudioRenderer,
  ControlBar,
  useRoomContext,
  TrackToggle,
} from '@livekit/components-react';
import '@livekit/components-styles';
import { Track, RoomEvent } from 'livekit-client';
import { api } from '../utils/api';
import { API_ENDPOINTS } from '../config';
import { Loader2, MessageSquare, PhoneOff } from 'lucide-react';
import MeetingChat from '../components/MeetingChat';

// Custom disconnect button that properly cleans up tracks
const CustomDisconnectButton = ({ meetingId, onDisconnect }: { meetingId: string; onDisconnect: () => void }) => {
  const room = useRoomContext();

  const handleDisconnect = async () => {
    try {
      // Stop all local tracks before disconnecting
      const localParticipant = room.localParticipant;
      
      // Unpublish all tracks
      for (const publication of localParticipant.trackPublications.values()) {
        if (publication.track) {
          try {
            await localParticipant.unpublishTrack(publication.track);
          } catch (err) {
            console.warn('Error unpublishing track:', err);
          }
        }
      }

      // Small delay to ensure cleanup
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Disconnect from room
      await room.disconnect();
      
      // Notify backend that participant left (triggers auto-end logic)
      try {
        await api.post(API_ENDPOINTS.MEETINGS.LEAVE(meetingId));
      } catch (error) {
        console.error('Failed to notify backend of leave:', error);
        // Continue anyway
      }
      
      // Navigate after disconnect
      onDisconnect();
    } catch (error) {
      console.error('Error during disconnect:', error);
      // Try to notify backend anyway
      try {
        await api.post(API_ENDPOINTS.MEETINGS.LEAVE(meetingId));
      } catch (err) {
        // Ignore
      }
      // Navigate anyway
      onDisconnect();
    }
  };

  return (
    <button
      onClick={handleDisconnect}
      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors"
    >
      <PhoneOff size={20} />
      Leave
    </button>
  );
};

const MeetingRoom = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [token, setToken] = useState<string>("");
  const [meeting, setMeeting] = useState<any>(null);
  const [error, setError] = useState<string>("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // Get previous path from location state or use browser history
  const previousPath = (location.state as any)?.from || null;
  
  // Function to navigate back to previous page
  const navigateBack = () => {
    if (previousPath) {
      navigate(previousPath);
    } else {
      // Try to go back in browser history, fallback to dashboard if no history
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/dashboard?tab=meetings');
      }
    }
  };

  useEffect(() => {
    const fetchMeetingAndToken = async () => {
      if (!id) return;

      try {
        // Fetch meeting details
        const meetingRes = await api.get(API_ENDPOINTS.MEETINGS.DETAIL(id));
        const meetingData = meetingRes.data;
        setMeeting(meetingData);

        // Check if meeting is completed or not answered
        if (meetingData.status === "completed" || meetingData.status === "not_answered") {
          setError("This meeting has ended and cannot be rejoined.");
          return;
        }

        // Fetch token
        const tokenRes = await api.post(API_ENDPOINTS.MEETINGS.TOKEN(id));
        setToken(tokenRes.data.token);
      } catch (err: any) {
        console.error("Failed to join meeting:", err);
        console.error("Error details:", err.response?.data);
        setError(err.response?.data?.detail || "Failed to join meeting");
      }
    };

    fetchMeetingAndToken();
  }, [id]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Error</h2>
          <p className="text-slate-400 mb-4">{error}</p>
          <button
            onClick={navigateBack}
            className="px-4 py-2 bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!token || !meeting) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
          <p>Joining meeting...</p>
        </div>
      </div>
    );
  }

  return (
    <LiveKitRoom
      video={true}
      audio={true}
      token={token}
      serverUrl={process.env.REACT_APP_LIVEKIT_URL}
      data-lk-theme="default"
      style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}
      onDisconnected={async (reason) => {
        console.log('Disconnected from room:', reason);
        // Notify backend that participant left
        if (id) {
          try {
            await api.post(API_ENDPOINTS.MEETINGS.LEAVE(id));
          } catch (error) {
            console.error('Failed to notify backend of disconnect:', error);
          }
        }
        // Small delay to ensure cleanup completes
        setTimeout(() => {
          navigateBack();
        }, 100);
      }}
    >
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative">
          <MyVideoConference meeting={meeting} />
          <DebugListener />
        </div>
        
        {isChatOpen && (
          <div className="w-80 h-full border-l border-slate-700 bg-slate-900">
            <MeetingChat meetingId={id!} onClose={() => setIsChatOpen(false)} />
          </div>
        )}
      </div>
      
      <RoomAudioRenderer />
      
      {/* Custom Control Bar */}
      <div className="p-4 bg-slate-900 border-t border-slate-700 flex items-center justify-center gap-4">
        <div className="flex items-center gap-2 bg-slate-800/50 p-2 rounded-2xl border border-slate-700/50 backdrop-blur-sm">
          <TrackToggle source={Track.Source.Microphone} showIcon={true} className="lk-button" />
          <TrackToggle source={Track.Source.Camera} showIcon={true} className="lk-button" />
          <TrackToggle source={Track.Source.ScreenShare} showIcon={true} className="lk-button" />
          
          <button
            onClick={() => setIsChatOpen(!isChatOpen)}
            className={`lk-button ${isChatOpen ? 'lk-button-active' : ''}`}
            title="Chat"
          >
            <MessageSquare size={20} />
          </button>

          <div className="w-px h-8 bg-slate-700 mx-2" />
          
          <CustomDisconnectButton 
            meetingId={id!}
            onDisconnect={() => {
              setTimeout(() => {
                navigateBack();
              }, 100);
            }}
          />
        </div>
      </div>
    </LiveKitRoom>
  );
};

const DebugListener = () => {
  const room = useRoomContext();
  
  useEffect(() => {
    const handleData = (payload: Uint8Array, participant: any, kind: any, topic: any) => {
      const str = new TextDecoder().decode(payload);
      console.log('DEBUG LISTENER: Data received', { topic, kind, str });
    };
    
    room.on(RoomEvent.DataReceived, handleData);
    return () => {
      room.off(RoomEvent.DataReceived, handleData);
    };
  }, [room]);
  
  return null;
};

function MyVideoConference({ meeting }: { meeting: any }) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  // Wrap GridLayout in error boundary to catch LiveKit internal errors during disconnect
  return (
    <ErrorBoundary>
      <GridLayout tracks={tracks} style={{ height: '100%' }}>
        <ParticipantTile />
      </GridLayout>
    </ErrorBoundary>
  );
}

// Simple error boundary to catch LiveKit layout errors during disconnect
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Only log if it's not the expected LiveKit disconnect error
    if (!error.message.includes('Element not part of the array')) {
      console.error('GridLayout error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Return empty div during disconnect to prevent white screen
      return <div style={{ height: '100%', backgroundColor: '#0f172a' }} />;
    }

    return this.props.children;
  }
}

export default MeetingRoom;
