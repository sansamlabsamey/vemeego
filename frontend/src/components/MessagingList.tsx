import React, { useState, useEffect } from 'react';
import { Search, MessageSquare } from 'lucide-react';
import { api } from '../utils/api';
import { API_ENDPOINTS } from '../config';
import { useAuth } from '../contexts/AuthContext';

interface Conversation {
  id: string;
  participant1_id: string;
  participant1_name: string;
  participant2_id: string;
  participant2_name: string;
  last_message_content?: string;
  last_message_at?: string;
  other_participant?: {
    id: string;
    user_name: string;
    email: string;
  };
}

interface Member {
  id: string;
  user_name: string;
  email: string;
  role: string;
}

interface MessagingListProps {
  onSelectConversation: (conversationId: string, participant: any) => void;
  selectedConversationId?: string;
}

const MessagingList: React.FC<MessagingListProps> = ({
  onSelectConversation,
  selectedConversationId,
}) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user?.organization_id) return;

    try {
      setIsLoading(true);
      const [conversationsRes, membersRes] = await Promise.all([
        api.get(API_ENDPOINTS.MESSAGING.CONVERSATIONS),
        api.get(API_ENDPOINTS.MESSAGING.MEMBERS),
      ]);

      setConversations(conversationsRes.data.conversations || []);
      setMembers(membersRes.data || []);
    } catch (error) {
      console.error('Failed to load conversations/members:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartConversation = async (memberId: string) => {
    try {
      const response = await api.post(API_ENDPOINTS.MESSAGING.START_CONVERSATION(memberId));
      const conversationId = response.data.conversation_id;

      // Find the member
      const member = members.find((m) => m.id === memberId);
      if (member && conversationId) {
        onSelectConversation(conversationId, {
          id: member.id,
          user_name: member.user_name,
          email: member.email,
        });
        // Reload conversations to update list
        loadData();
      }
    } catch (error: any) {
      console.error('Failed to start conversation:', error);
      // Show user-friendly error message
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to start conversation';
      alert(errorMessage);
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    const otherParticipant = conv.other_participant || {
      user_name: conv.participant1_id === user?.id ? conv.participant2_name : conv.participant1_name,
    };
    return otherParticipant.user_name?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const filteredMembers = members.filter((member) =>
    member.user_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Show conversations first (if any), then members
  const hasConversations = filteredConversations.length > 0;

  return (
    <div className="h-full flex flex-col bg-white/40 overflow-hidden">
      <div className="p-4 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Messages</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* Conversations List */}
            {hasConversations && (
              <div className="p-2">
                {filteredConversations.map((conv) => {
                  const otherParticipant = conv.other_participant || {
                    id: conv.participant1_id === user?.id ? conv.participant2_id : conv.participant1_id,
                    user_name: conv.participant1_id === user?.id ? conv.participant2_name : conv.participant1_name,
                    email: '',
                  };

                  const isSelected = selectedConversationId === conv.id;
                  const lastMessageTime = conv.last_message_at
                    ? new Date(conv.last_message_at).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : '';

                  return (
                    <div
                      key={conv.id}
                      onClick={() =>
                        onSelectConversation(conv.id, {
                          id: otherParticipant.id,
                          user_name: otherParticipant.user_name,
                          email: otherParticipant.email,
                        })
                      }
                      className={`p-4 flex items-center gap-3 hover:bg-white/60 cursor-pointer transition-colors rounded-lg mb-1 ${
                        isSelected ? 'bg-white/80 border-l-4 border-indigo-500' : ''
                      }`}
                    >
                      <div className="relative">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                          {otherParticipant.user_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1">
                          <h3 className="font-semibold text-slate-800 truncate">
                            {otherParticipant.user_name}
                          </h3>
                          {lastMessageTime && (
                            <span className="text-xs text-slate-400 ml-2">{lastMessageTime}</span>
                          )}
                        </div>
                        {conv.last_message_content && (
                          <p className="text-sm text-slate-500 truncate">
                            {conv.last_message_content}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Members List (when no conversations or as additional list) */}
            {(!hasConversations || searchQuery) && (
              <div className="p-2">
                <div className="px-2 py-1 text-xs font-semibold text-slate-500 uppercase mb-2">
                  {hasConversations ? 'Other Members' : 'Organization Members'}
                </div>
                {filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    onClick={() => handleStartConversation(member.id)}
                    className="p-4 flex items-center gap-3 hover:bg-white/60 cursor-pointer transition-colors rounded-lg mb-1"
                  >
                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                      {member.user_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-800 truncate">{member.user_name}</h3>
                      <p className="text-xs text-slate-500 truncate">{member.email}</p>
                    </div>
                    <MessageSquare size={16} className="text-slate-400" />
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MessagingList;


