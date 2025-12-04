import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

interface MeetingContextType {
  isInMeeting: boolean;
  currentMeetingId: string | null;
  setCurrentMeetingId: (id: string | null) => void;
}

const MeetingContext = createContext<MeetingContextType | undefined>(undefined);

export const MeetingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [currentMeetingId, setCurrentMeetingId] = useState<string | null>(null);
  
  // Check if we're on a meeting route
  const meetingMatch = location.pathname.match(/^\/meeting\/([^/]+)$/);
  const routeMeetingId = meetingMatch ? meetingMatch[1] : null;
  
  useEffect(() => {
    if (routeMeetingId) {
      setCurrentMeetingId(routeMeetingId);
    } else {
      setCurrentMeetingId(null);
    }
  }, [routeMeetingId]);
  
  const isInMeeting = currentMeetingId !== null;

  return (
    <MeetingContext.Provider value={{ isInMeeting, currentMeetingId, setCurrentMeetingId }}>
      {children}
    </MeetingContext.Provider>
  );
};

export const useMeeting = () => {
  const context = useContext(MeetingContext);
  if (context === undefined) {
    throw new Error('useMeeting must be used within a MeetingProvider');
  }
  return context;
};

