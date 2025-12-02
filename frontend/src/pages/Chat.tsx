import React, { useState } from 'react';
import MessagingList from '../components/MessagingList';
import ChatWindow from '../components/ChatWindow';

const Chat = () => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedParticipant, setSelectedParticipant] = useState<{
    id: string;
    user_name: string;
    email: string;
  } | null>(null);

  const handleSelectConversation = (
    conversationId: string,
    participant: { id: string; user_name: string; email: string }
  ) => {
    setSelectedConversationId(conversationId);
    setSelectedParticipant(participant);
  };

  const handleBack = () => {
    setSelectedConversationId(null);
    setSelectedParticipant(null);
  };

  return (
    <div className="h-full w-full flex bg-white/50 backdrop-blur-sm relative overflow-hidden" style={{ height: '100%', maxHeight: '100%' }}>
      {/* Chat Sidebar */}
      <div
        className={`
        w-full md:w-80 border-r border-slate-200 flex flex-col bg-white/40 absolute md:static h-full z-10 transition-transform duration-300 overflow-hidden
        ${selectedConversationId ? '-translate-x-full md:translate-x-0' : 'translate-x-0'}
      `}
      >
        <MessagingList
          onSelectConversation={handleSelectConversation}
          selectedConversationId={selectedConversationId || undefined}
        />
      </div>

      {/* Chat Area */}
      <div
        className={`
        flex-1 flex flex-col bg-white/20 absolute md:static h-full z-20 transition-transform duration-300 bg-[#f0f4f8] md:bg-transparent overflow-hidden
        ${selectedConversationId ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
      `}
      >
        <ChatWindow
          conversationId={selectedConversationId}
          participant={selectedParticipant}
          onBack={handleBack}
        />
      </div>
    </div>
  );
};

export default Chat;
