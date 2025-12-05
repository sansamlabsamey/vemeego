import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Users, ArrowRight, Video, Plus, X, Loader2, Mail, UserPlus, XCircle, Search, Check } from 'lucide-react';
import { api } from '../utils/api';
import { API_ENDPOINTS } from '../config';
import { useAuth } from '../contexts/AuthContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';

interface Meeting {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  status: string;
  type: string;
  is_open: boolean;
  host_id: string;
  participants: any[]; // We might need to fetch participants separately or include them in response
}

interface MeetingCardProps {
  meeting: Meeting;
  onJoin: (meeting: Meeting) => void;
}

const MeetingCard = ({ meeting, onJoin }: MeetingCardProps) => {
  const startTime = new Date(meeting.start_time);
  const isLive = new Date() >= startTime && (!meeting.end_time || new Date() <= new Date(meeting.end_time));
  
  return (
    <div className="group relative p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-white/50 shadow-sm hover:shadow-xl hover:bg-white/80 transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <div>
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mb-2
            ${isLive 
              ? 'bg-red-100 text-red-600 animate-pulse' 
              : meeting.status === 'scheduled'
              ? 'bg-indigo-50 text-indigo-600'
              : meeting.status === 'not_answered'
              ? 'bg-orange-50 text-orange-600'
              : meeting.status === 'completed'
              ? 'bg-green-50 text-green-600'
              : 'bg-slate-100 text-slate-600'
            }`}>
            {isLive && <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />}
            {isLive ? 'Live Now' : meeting.status === 'not_answered' ? 'Not Answered' : meeting.status}
          </span>
          <h3 className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
            {meeting.title}
          </h3>
          <p className="text-xs text-slate-500 mt-1">{meeting.type} • {meeting.is_open ? 'Open' : 'Closed'}</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
          <ArrowRight size={20} />
        </div>
      </div>
      
      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-6">
        <div className="flex items-center gap-1.5">
          <Clock size={16} />
          {startTime.toLocaleString()}
        </div>
        {/* <div className="flex items-center gap-1.5">
          <Users size={16} />
          {meeting.participants?.length || 0} attendees
        </div> */}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex -space-x-2">
          {/* Placeholder for participants avatars */}
          {/* {meeting.participants?.slice(0, 3).map((p, i) => (
            <div key={i} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white ring-1 ring-slate-100 flex items-center justify-center text-xs font-bold text-slate-500" style={{ zIndex: 10 - i }}>
              {p.name?.[0]}
            </div>
          ))} */}
        </div>
        {meeting.status === "completed" || meeting.status === "not_answered" ? (
          <div className="px-4 py-2 rounded-lg bg-slate-200 text-slate-500 text-sm font-medium cursor-not-allowed">
            {meeting.status === "not_answered" ? "Not Answered" : "Meeting Ended"}
          </div>
        ) : (
          <button 
            onClick={() => onJoin(meeting)}
            className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/20"
          >
            {isLive ? 'Join Room' : 'View Details'}
          </button>
        )}
      </div>
    </div>
  );
};

interface OrganizationMember {
  id: string;
  user_name: string;
  email: string;
  role: string;
  status: string;
}

interface EmailParticipant {
  email: string;
  name?: string;
  isExternal?: boolean;
  userId?: string;
}

const Meetings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filteredMeetings, setFilteredMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [activeTab, setActiveTab] = useState("regular");
  const [filter, setFilter] = useState<"all" | "missed" | "scheduled" | "webinar">("all");
  
  // Organization members for participant selection
  const [organizationMembers, setOrganizationMembers] = useState<OrganizationMember[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  
  // Regular meeting form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startTime, setStartTime] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<EmailParticipant[]>([]);
  const [participantSearch, setParticipantSearch] = useState("");
  const [showParticipantDropdown, setShowParticipantDropdown] = useState(false);
  const participantDropdownRef = useRef<HTMLDivElement>(null);
  const participantInputRef = useRef<HTMLInputElement>(null);
  
  // Webinar form state
  const [webinarTitle, setWebinarTitle] = useState("");
  const [webinarDescription, setWebinarDescription] = useState("");
  const [webinarStartTime, setWebinarStartTime] = useState("");
  const [assistantId, setAssistantId] = useState<string>("");
  const [maxParticipants, setMaxParticipants] = useState<number>(100);
  const [emailParticipants, setEmailParticipants] = useState<EmailParticipant[]>([]);
  const [emailInput, setEmailInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchMeetings();
    if (showScheduleModal && user?.organization_id) {
      fetchOrganizationMembers();
    }
  }, [showScheduleModal, user?.organization_id]);

  const fetchMeetings = async () => {
    try {
      setIsLoading(true);
      const response = await api.get(API_ENDPOINTS.MEETINGS.LIST);
      setMeetings(response.data);
    } catch (error) {
      console.error("Failed to fetch meetings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter meetings based on selected filter
  useEffect(() => {
    let filtered = meetings;
    
    if (filter === "missed") {
      // Get meetings where user has a participant record with "missed" status
      // OR meetings with status "not_answered" where user is not the host (receiver)
      filtered = meetings.filter(m => {
        const userStatus = (m as any).user_participant_status;
        const isHost = m.host_id === user?.id;
        
        // Show in missed calls if:
        // 1. User's participant status is "missed", OR
        // 2. Meeting status is "not_answered" and user is not the host (receiver)
        return userStatus === "missed" || (m.status === "not_answered" && !isHost);
      });
    } else if (filter === "scheduled") {
      filtered = meetings.filter(m => m.type === "scheduled");
    } else if (filter === "webinar") {
      filtered = meetings.filter(m => m.type === "webinar");
    }
    
    setFilteredMeetings(filtered);
  }, [meetings, filter, user?.id]);

  const fetchOrganizationMembers = async () => {
    try {
      setIsLoadingMembers(true);
      const response = await api.get(API_ENDPOINTS.MESSAGING.MEMBERS);
      setOrganizationMembers(response.data || []);
    } catch (error) {
      console.error("Failed to fetch organization members:", error);
      setOrganizationMembers([]);
    } finally {
      setIsLoadingMembers(false);
    }
  };

  const handleJoin = async (meeting: Meeting) => {
    // Don't allow joining completed or not_answered meetings
    if (meeting.status === "completed" || meeting.status === "not_answered") {
      alert("This meeting has ended and cannot be rejoined.");
      return;
    }
    navigate(`/meeting/${meeting.id}`);
  };

  // Filter organization members based on search
  const filteredMembers = organizationMembers.filter(member => {
    const searchLower = participantSearch.toLowerCase();
    return member.user_name.toLowerCase().includes(searchLower) || 
           member.email.toLowerCase().includes(searchLower);
  });

  // Check if search input is a valid email
  const isEmail = (text: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(text.trim());
  };

  // Check if email belongs to an organization member
  const findMemberByEmail = (email: string) => {
    return organizationMembers.find(m => m.email.toLowerCase() === email.toLowerCase());
  };

  const addParticipant = (member?: OrganizationMember, email?: string) => {
    if (member) {
      // Add organization member
      const exists = selectedParticipants.some(p => p.userId === member.id);
      if (!exists) {
        setSelectedParticipants(prev => [...prev, {
          email: member.email,
          name: member.user_name,
          userId: member.id,
          isExternal: false
        }]);
      }
    } else if (email && isEmail(email)) {
      // Check if it's an organization member
      const orgMember = findMemberByEmail(email);
      if (orgMember) {
        const exists = selectedParticipants.some(p => p.userId === orgMember.id);
        if (!exists) {
          setSelectedParticipants(prev => [...prev, {
            email: orgMember.email,
            name: orgMember.user_name,
            userId: orgMember.id,
            isExternal: false
          }]);
        }
      } else {
        // External participant
        const exists = selectedParticipants.some(p => p.email.toLowerCase() === email.toLowerCase() && !p.userId);
        if (!exists) {
          setSelectedParticipants(prev => [...prev, {
            email: email.trim(),
            isExternal: true
          }]);
        }
      }
    }
    setParticipantSearch("");
    setShowParticipantDropdown(false);
  };

  const removeParticipant = (email: string, userId?: string) => {
    setSelectedParticipants(prev => 
      prev.filter(p => !(p.email.toLowerCase() === email.toLowerCase() && (userId ? p.userId === userId : !p.userId)))
    );
  };

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        participantDropdownRef.current && 
        !participantDropdownRef.current.contains(event.target as Node) &&
        participantInputRef.current &&
        !participantInputRef.current.contains(event.target as Node)
      ) {
        setShowParticipantDropdown(false);
      }
    };

    if (showParticipantDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showParticipantDropdown]);

  const addEmailParticipant = () => {
    if (!emailInput.trim()) return;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailInput.trim())) {
      alert("Please enter a valid email address");
      return;
    }

    // Check if email already exists
    if (emailParticipants.some(p => p.email.toLowerCase() === emailInput.trim().toLowerCase())) {
      alert("This email is already added");
      return;
    }

    setEmailParticipants(prev => [...prev, {
      email: emailInput.trim(),
      name: nameInput.trim() || undefined
    }]);
    setEmailInput("");
    setNameInput("");
  };

  const removeEmailParticipant = (email: string) => {
    setEmailParticipants(prev => prev.filter(p => p.email !== email));
  };

  const handleScheduleRegular = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startTime) return;

    try {
      setIsSubmitting(true);
      
      // Build participants array from selected participants
      const participants = selectedParticipants.map(p => {
        if (p.userId) {
          return {
            user_id: p.userId,
            role: "attendee"
          };
        } else {
          return {
            email: p.email,
            name: p.name,
            role: "attendee"
          };
        }
      });

      await api.post(API_ENDPOINTS.MEETINGS.CREATE, {
        title,
        description,
        start_time: new Date(startTime).toISOString(),
        type: "scheduled",
        is_open: isOpen,
        participants
      });
      
      setShowScheduleModal(false);
      fetchMeetings();
      resetForms();
    } catch (error) {
      console.error("Failed to schedule meeting:", error);
      alert("Failed to schedule meeting");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScheduleWebinar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webinarTitle || !webinarStartTime) return;
    if (!assistantId) {
      alert("Please select an assistant for the webinar");
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Build participants array
      const participants: any[] = [];
      
      // Add assistant
      participants.push({
        user_id: assistantId,
        role: "assistant"
      });
      
      // Add email-based participants
      emailParticipants.forEach(p => {
        participants.push({
          email: p.email,
          name: p.name,
          role: "attendee"
        });
      });

      await api.post(API_ENDPOINTS.MEETINGS.CREATE, {
        title: webinarTitle,
        description: webinarDescription,
        start_time: new Date(webinarStartTime).toISOString(),
        type: "webinar",
        is_open: false, // Webinars are typically not open
        participants
        // Note: max_participants not yet supported by backend
      });
      
      setShowScheduleModal(false);
      fetchMeetings();
      resetForms();
    } catch (error) {
      console.error("Failed to schedule webinar:", error);
      alert("Failed to schedule webinar");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForms = () => {
    // Reset regular meeting form
    setTitle("");
    setDescription("");
    setStartTime("");
    setIsOpen(false);
    setSelectedParticipants([]);
    setParticipantSearch("");
    setShowParticipantDropdown(false);
    
    // Reset webinar form
    setWebinarTitle("");
    setWebinarDescription("");
    setWebinarStartTime("");
    setAssistantId("");
    setMaxParticipants(100);
    setEmailParticipants([]);
    setEmailInput("");
    setNameInput("");
    setActiveTab("regular");
  };

  const handleCloseModal = () => {
    setShowScheduleModal(false);
    resetForms();
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 relative">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-10 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">My Meetings</h1>
          <p className="text-slate-500">View your upcoming and past meeting history.</p>
        </div>
        <button 
          onClick={() => setShowScheduleModal(true)}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40"
        >
          <Video size={20} />
          Schedule Meeting
        </button>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filter === "all"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
              : "bg-white/60 text-slate-600 hover:bg-white/80 border border-slate-200"
          }`}
        >
          All Meetings
        </button>
        <button
          onClick={() => setFilter("missed")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filter === "missed"
              ? "bg-red-600 text-white shadow-lg shadow-red-500/20"
              : "bg-white/60 text-slate-600 hover:bg-white/80 border border-slate-200"
          }`}
        >
          Missed Calls
        </button>
        <button
          onClick={() => setFilter("scheduled")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filter === "scheduled"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
              : "bg-white/60 text-slate-600 hover:bg-white/80 border border-slate-200"
          }`}
        >
          Scheduled
        </button>
        <button
          onClick={() => setFilter("webinar")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            filter === "webinar"
              ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20"
              : "bg-white/60 text-slate-600 hover:bg-white/80 border border-slate-200"
          }`}
        >
          Webinars
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredMeetings.length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-500">
                {filter === "all" 
                  ? "No meetings found. Schedule one to get started!"
                  : `No ${filter === "missed" ? "missed calls" : filter === "scheduled" ? "scheduled meetings" : "webinars"} found.`
                }
              </div>
            ) : (
              filteredMeetings.map(meeting => (
                <MeetingCard key={meeting.id} meeting={meeting} onJoin={() => handleJoin(meeting)} />
              ))
            )}
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && (
        <>
          {/* Overlay - covers main content area, excludes sidebar on desktop */}
          <div className="fixed inset-y-0 left-0 right-0 md:left-64 z-[90] bg-black/50 backdrop-blur-sm" />
          {/* Modal Content */}
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col pointer-events-auto">
            {/* Gradient Header */}
            <div className="bg-gradient-to-r from-indigo-600 to-blue-600 p-6 rounded-t-2xl">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white border-2 border-white/30">
                    <Video size={24} className="text-white" />
                  </div>
                  <h3 className="font-bold text-xl text-white">Schedule Meeting</h3>
                </div>
                <button 
                  onClick={handleCloseModal} 
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-white to-slate-50/30">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="px-6 pt-6">
                  <TabsList className="grid w-full grid-cols-2 bg-slate-100/50 p-1 rounded-xl">
                    <TabsTrigger 
                      value="regular" 
                      className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm rounded-lg"
                    >
                      Regular Meeting
                    </TabsTrigger>
                    <TabsTrigger 
                      value="webinar"
                      className="data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm rounded-lg"
                    >
                      Webinar
                    </TabsTrigger>
                  </TabsList>
                </div>

                {/* Regular Meeting Tab */}
                <TabsContent value="regular" className="px-6 py-6 space-y-5">
                  <form onSubmit={handleScheduleRegular} className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Meeting Title</label>
                      <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm hover:shadow-md"
                        placeholder="Enter meeting title"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm hover:shadow-md resize-none"
                        placeholder="Optional description"
                        rows={3}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Date & Time</label>
                      <input
                        type="datetime-local"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm hover:shadow-md"
                        required
                      />
                    </div>
                    
                    <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isOpen}
                          onChange={(e) => setIsOpen(e.target.checked)}
                          className="w-5 h-5 rounded text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        />
                        <div>
                          <span className="text-sm font-medium text-slate-700">Set as Open Meeting</span>
                          <p className="text-xs text-slate-500 mt-0.5">Anyone with the link can join</p>
                        </div>
                      </label>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Add Participants</label>
                      <div className="relative">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={18} />
                          <input
                            ref={participantInputRef}
                            type="text"
                            value={participantSearch}
                            onChange={(e) => {
                              setParticipantSearch(e.target.value);
                              setShowParticipantDropdown(true);
                            }}
                            onFocus={() => setShowParticipantDropdown(true)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && participantSearch.trim()) {
                                e.preventDefault();
                                if (isEmail(participantSearch)) {
                                  addParticipant(undefined, participantSearch);
                                } else if (filteredMembers.length > 0) {
                                  addParticipant(filteredMembers[0]);
                                }
                              }
                            }}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                            placeholder="Search by name or email, or enter external email"
                          />
                        </div>
                        
                        {/* Dropdown */}
                        {showParticipantDropdown && (participantSearch.trim() || filteredMembers.length > 0) && (
                          <div
                            ref={participantDropdownRef}
                            className="absolute z-50 w-full mt-1 bg-white rounded-xl border border-slate-200 shadow-lg max-h-60 overflow-y-auto"
                          >
                            {isLoadingMembers ? (
                              <div className="flex justify-center py-4">
                                <Loader2 size={20} className="animate-spin text-indigo-600" />
                              </div>
                            ) : (
                              <>
                                {/* Organization Members */}
                                {filteredMembers.length > 0 && (
                                  <div className="p-2">
                                    <div className="px-2 py-1.5 text-xs font-semibold text-slate-500 uppercase">Organization Members</div>
                                    {filteredMembers.map((member) => {
                                      const isSelected = selectedParticipants.some(p => p.userId === member.id);
                                      return (
                                        <div
                                          key={member.id}
                                          onClick={() => addParticipant(member)}
                                          className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                                            isSelected 
                                              ? 'bg-indigo-50 text-indigo-700' 
                                              : 'hover:bg-slate-50'
                                          }`}
                                        >
                                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
                                            {member.user_name.charAt(0).toUpperCase()}
                                          </div>
                                          <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-700 truncate">{member.user_name}</p>
                                            <p className="text-xs text-slate-500 truncate">{member.email}</p>
                                          </div>
                                          {isSelected && <Check size={16} className="text-indigo-600" />}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                                
                                {/* External Email Option */}
                                {isEmail(participantSearch) && !findMemberByEmail(participantSearch) && (
                                  <div className="p-2 border-t border-slate-100">
                                    <div
                                      onClick={() => addParticipant(undefined, participantSearch)}
                                      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors"
                                    >
                                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                                        <Mail size={16} className="text-slate-500" />
                                      </div>
                                      <div className="flex-1">
                                        <p className="text-sm font-medium text-slate-700">Add as external participant</p>
                                        <p className="text-xs text-slate-500">{participantSearch}</p>
                                      </div>
                                      <UserPlus size={16} className="text-indigo-600" />
                                    </div>
                                  </div>
                                )}
                                
                                {filteredMembers.length === 0 && !isEmail(participantSearch) && participantSearch.trim() && (
                                  <div className="p-4 text-center text-sm text-slate-500">
                                    No members found. Enter an email to add external participant.
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Selected Participants */}
                      {selectedParticipants.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {selectedParticipants.map((participant, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-2.5 bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg border border-indigo-100"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                                  participant.isExternal 
                                    ? 'bg-slate-400' 
                                    : 'bg-gradient-to-br from-indigo-500 to-blue-600'
                                }`}>
                                  {participant.name ? participant.name.charAt(0).toUpperCase() : participant.email.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-slate-700">
                                    {participant.name || participant.email}
                                  </p>
                                  <p className="text-xs text-slate-500">
                                    {participant.email}
                                    {participant.isExternal && (
                                      <span className="ml-1 px-1.5 py-0.5 bg-slate-200 text-slate-600 rounded text-[10px] font-medium">
                                        External
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeParticipant(participant.email, participant.userId)}
                                className="p-1 hover:bg-red-100 rounded-full text-slate-400 hover:text-red-600 transition-colors"
                              >
                                <XCircle size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-6 flex gap-3 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={handleCloseModal}
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-all shadow-sm hover:shadow-md"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold hover:from-indigo-700 hover:to-blue-700 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                        Schedule Meeting
                      </button>
                    </div>
                  </form>
                </TabsContent>

                {/* Webinar Tab */}
                <TabsContent value="webinar" className="px-6 py-6 space-y-5">
                  <form onSubmit={handleScheduleWebinar} className="space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Webinar Title</label>
                      <input
                        type="text"
                        value={webinarTitle}
                        onChange={(e) => setWebinarTitle(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm hover:shadow-md"
                        placeholder="Enter webinar title"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
                      <textarea
                        value={webinarDescription}
                        onChange={(e) => setWebinarDescription(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm hover:shadow-md resize-none"
                        placeholder="Optional description"
                        rows={3}
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Date & Time</label>
                      <input
                        type="datetime-local"
                        value={webinarStartTime}
                        onChange={(e) => setWebinarStartTime(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm hover:shadow-md"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Select Assistant from Organization</label>
                      {isLoadingMembers ? (
                        <div className="flex justify-center py-4">
                          <Loader2 size={20} className="animate-spin text-indigo-600" />
                        </div>
                      ) : (
                        <select
                          value={assistantId}
                          onChange={(e) => setAssistantId(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm hover:shadow-md"
                          required
                        >
                          <option value="">Select an assistant</option>
                          {organizationMembers.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.user_name} ({member.email})
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">Maximum Participants</label>
                      <input
                        type="number"
                        value={maxParticipants}
                        onChange={(e) => setMaxParticipants(parseInt(e.target.value) || 100)}
                        min={1}
                        max={1000}
                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm hover:shadow-md"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Add Participants by Email</label>
                      <div className="flex gap-2 mb-2">
                        <input
                          type="email"
                          value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addEmailParticipant();
                            }
                          }}
                          className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                          placeholder="Enter email address"
                        />
                        <input
                          type="text"
                          value={nameInput}
                          onChange={(e) => setNameInput(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addEmailParticipant();
                            }
                          }}
                          className="flex-1 px-4 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                          placeholder="Name (optional)"
                        />
                        <button
                          type="button"
                          onClick={addEmailParticipant}
                          className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
                        >
                          <UserPlus size={16} />
                          Add
                        </button>
                      </div>
                      
                      {emailParticipants.length > 0 && (
                        <div className="space-y-2 max-h-32 overflow-y-auto border border-slate-200 rounded-xl p-3">
                          {emailParticipants.map((participant, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-2 bg-slate-50 rounded-lg"
                            >
                              <div>
                                <p className="text-sm font-medium text-slate-700">{participant.email}</p>
                                {participant.name && (
                                  <p className="text-xs text-slate-500">{participant.name}</p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeEmailParticipant(participant.email)}
                                className="p-1 hover:bg-slate-200 rounded-full text-slate-500"
                              >
                                <XCircle size={16} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-6 flex gap-3 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={handleCloseModal}
                        className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-all shadow-sm hover:shadow-md"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold hover:from-indigo-700 hover:to-blue-700 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                      >
                        {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                        Schedule Webinar
                      </button>
                    </div>
                  </form>
                </TabsContent>
              </Tabs>
            </div>
          </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Meetings;
