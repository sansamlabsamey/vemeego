import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  MoreVertical,
  Send,
  Smile,
  Reply,
  Forward,
  Pin,
  Trash2,
  Edit2,
  Check,
  X,
} from 'lucide-react';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import ReactMarkdown from 'react-markdown';
import { api } from '../utils/api';
import { API_ENDPOINTS } from '../config';
import { useRealtimeChannel, RealtimeSubscription } from '../hooks/useRealtimeChannel';
import { useAuth } from '../contexts/AuthContext';

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  content: string;
  content_type: string;
  reply_to_id?: string;
  reply_to_content?: string;
  reply_to_sender_name?: string;
  forwarded_from_id?: string;
  forwarded_from_user_id?: string;
  forwarded_from_user_name?: string;
  is_edited: boolean;
  edited_at?: string;
  is_deleted: boolean;
  reactions: Array<{
    id: string;
    user_id: string;
    user_name: string;
    emoji: string;
  }>;
  created_at: string;
}

interface ChatWindowProps {
  conversationId: string | null;
  participant: {
    id: string;
    user_name: string;
    email: string;
  } | null;
  onBack: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ conversationId, participant, onBack }) => {
  console.log('🔄 ChatWindow rendering', { conversationId }); // Debug log
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const channelName = conversationId ? `conversation:${conversationId}` : null;

  const handleBroadcast = React.useCallback((event: string, payload: any) => {
    if (event === 'message' && payload) {
       // Handle manual broadcast if we still use it
    }
  }, []);

  const subscriptions = React.useMemo<RealtimeSubscription[]>(() => conversationId ? [
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
      callback: (payload: any) => {
        const newMsg = payload.new;
        console.log('📨 New message received:', newMsg.id);  // ✅ Debug log
        
        // Avoid duplicates
        setMessages((prev) => {
          if (prev.find((m) => m.id === newMsg.id)) return prev;
          
          // If sender info is missing (from Postgres Changes), fetch it
          // Always ensure sender_name is present to avoid render crashes
          const messageWithSender = {
            ...newMsg,
            sender_name: newMsg.sender_name || 'Loading...',
            reactions: [], // Initialize reactions
          };

          return [...prev, messageWithSender];
        });
        
        // If sender info is missing, reload messages to get full data
        if (!newMsg.sender_name && newMsg.sender_id) {
          // Use a slight delay to ensure the API has the latest data
          setTimeout(() => {
            loadMessages();
          }, 500);
        } else {
          scrollToBottom();
        }
      },
    },
    {
      event: 'UPDATE',
      table: 'messages',
      filter: `conversation_id=eq.${conversationId}`,
      callback: (payload: any) => {
        const updatedMsg = payload.new;
        setMessages((prev) =>
          prev.map((msg) => (msg.id === updatedMsg.id ? { ...msg, ...updatedMsg } : msg))
        );
      },
    },
    {
      event: 'INSERT',
      table: 'message_reactions',
      // No filter by conversation_id available on message_reactions table
      // Rely on RLS and client-side filtering
      callback: (payload: any) => {
        const reaction = payload.new;
        setMessages((prev) => 
          prev.map((msg) => {
            if (msg.id === reaction.message_id) {
              // Check if reaction already exists to avoid duplicates
              const exists = msg.reactions?.some(
                (r) => r.user_id === reaction.user_id && r.emoji === reaction.emoji
              );
              if (exists) return msg;

              return {
                ...msg,
                reactions: [...(msg.reactions || []), {
                  id: reaction.id,
                  user_id: reaction.user_id,
                  user_name: '', // We don't have user_name here, will need to fetch or ignore
                  emoji: reaction.emoji
                }]
              };
            }
            return msg;
          })
        );
        // Ideally we should fetch the user details, but for now we'll just reload if needed
        // or we can just show the reaction count without user names until reload
      },
    },
    {
      event: 'DELETE',
      table: 'message_reactions',
      callback: (payload: any) => {
        const reaction = payload.old;
        setMessages((prev) => 
          prev.map((msg) => {
            if (msg.id === reaction.message_id) {
              return {
                ...msg,
                reactions: (msg.reactions || []).filter(
                  (r) => !(r.user_id === reaction.user_id && r.emoji === reaction.emoji)
                  // Note: payload.old might only contain ID if replica identity is default
                  // If so, we might need to rely on ID if available, or reload
                )
              };
            }
            return msg;
          })
        );
        // If we can't reliably delete locally (e.g. missing ID in payload), reload
        if (!reaction.message_id) {
           loadMessages(); 
        }
      },
    },
    {
      event: '*',
      table: 'pinned_messages',
      filter: `conversation_id=eq.${conversationId}`,
      callback: () => {
        // Just reload messages to update pinned status if we were showing it
        // Or if we had a pinned messages list, update that.
        // For now, ChatWindow doesn't explicitly show pinned messages list, 
        // but maybe we want to show a toast or something.
      },
    }
  ] : [], [conversationId]);

  const { sendBroadcast } = useRealtimeChannel({
    channelName,
    subscriptions,
    onBroadcast: handleBroadcast
  });


  useEffect(() => {
    if (conversationId) {
      loadMessages();
    } else {
      setMessages([]);
    }
  }, [conversationId]);

  useEffect(() => {
    // Only scroll if we're near the bottom (within 100px) or if it's a new message
    if (messagesContainerRef.current && messages.length > 0) {
      const container = messagesContainerRef.current;
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      if (isNearBottom) {
        // scrollToBottom();
      }
    }
  }, [messages]);

  const loadMessages = async () => {
    if (!conversationId) return;

    try {
      setIsLoading(true);
      const response = await api.get(API_ENDPOINTS.MESSAGING.MESSAGES(conversationId));
      setMessages(response.data || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToBottom = () => {
    // Scroll the messages container directly instead of using scrollIntoView
    // This prevents scrolling the entire page
    if (messagesContainerRef.current) {
      const container = messagesContainerRef.current;
      // Use scrollTo instead of scrollTop for smoother scrolling and to prevent page scroll
      container.scrollTo({
        top: container.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  const handleSendMessage = async () => {
    if (!conversationId || !newMessage.trim()) return;

    try {
      const messageData: any = {
        conversation_id: conversationId,
        content: newMessage,
        content_type: 'markdown',
      };

      if (replyingTo) {
        messageData.reply_to_id = replyingTo.id;
      }

      if (forwardingMessage) {
        messageData.forwarded_from_id = forwardingMessage.id;
        messageData.forwarded_from_user_id = forwardingMessage.sender_id;
      }

      const response = await api.post(API_ENDPOINTS.MESSAGING.SEND_MESSAGE, messageData);
      const sentMessage = response.data;

      // Add to messages list (Postgres Changes will also trigger, but this provides immediate feedback)
      setMessages((prev) => {
        // Avoid duplicates (in case Postgres Changes also adds it)
        if (prev.find((m) => m.id === sentMessage.id)) return prev;
        return [...prev, sentMessage];
      });
      
      // Scroll to bottom immediately
      scrollToBottom();
      
      // Note: We don't need to manually broadcast since Postgres Changes will handle it
      // But we can still use broadcast for typing indicators, reactions, etc.

      // Reset
      setNewMessage('');
      setReplyingTo(null);
      setForwardingMessage(null);
      setShowEmojiPicker(false);
      
      // Scroll to bottom after message is added (use requestAnimationFrame for better performance)
      // Use a small delay to ensure DOM is updated
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // scrollToBottom();
        });
      });
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleEditMessage = async () => {
    if (!editingMessage || !newMessage.trim()) return;

    try {
      await api.put(API_ENDPOINTS.MESSAGING.UPDATE_MESSAGE(editingMessage.id), {
        content: newMessage,
      });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === editingMessage.id
            ? { ...msg, content: newMessage, is_edited: true }
            : msg
        )
      );

      setEditingMessage(null);
      setNewMessage('');
    } catch (error) {
      console.error('Failed to edit message:', error);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!window.confirm('Are you sure you want to delete this message?')) return;

    try {
      await api.delete(API_ENDPOINTS.MESSAGING.DELETE_MESSAGE(messageId));
      setMessages((prev) => prev.filter((msg) => msg.id !== messageId));
    } catch (error) {
      console.error('Failed to delete message:', error);
    }
  };

  const handleAddReaction = async (messageId: string, emoji: string) => {
    try {
      await api.post(API_ENDPOINTS.MESSAGING.ADD_REACTION(messageId), { emoji });
      loadMessages(); // Reload to get updated reactions
    } catch (error) {
      console.error('Failed to add reaction:', error);
    }
  };

  const handleRemoveReaction = async (messageId: string, emoji: string) => {
    try {
      await api.delete(API_ENDPOINTS.MESSAGING.REMOVE_REACTION(messageId, emoji));
      loadMessages(); // Reload to get updated reactions
    } catch (error) {
      console.error('Failed to remove reaction:', error);
    }
  };

  const handlePinMessage = async (messageId: string) => {
    if (!conversationId) return;

    try {
      await api.post(API_ENDPOINTS.MESSAGING.PIN_MESSAGE(conversationId), {
        message_id: messageId,
      });
      // Show success toast or notification
    } catch (error) {
      console.error('Failed to pin message:', error);
    }
  };

  const onEmojiClick = (emojiData: EmojiClickData) => {
    setNewMessage((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return date.toLocaleDateString();
  };

  if (!conversationId || !participant) {
    return (
      <div className="flex-1 flex items-center justify-center bg-white/20">
        <div className="text-center text-slate-500">
          <p className="text-lg">Select a conversation to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="flex-1 flex flex-col bg-white/20 relative h-full overflow-hidden" 
      style={{ 
        height: '100%', 
        maxHeight: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white/40 backdrop-blur-md flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="md:hidden p-2 -ml-2 hover:bg-slate-100 rounded-full text-slate-600"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
            {participant.user_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="font-bold text-slate-800">{participant.user_name}</h3>
            <span className="text-xs text-green-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Online
            </span>
          </div>
        </div>
        <button className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
          <MoreVertical size={20} />
        </button>
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 p-6 overflow-y-auto space-y-4 min-h-0"
        style={{ 
          scrollBehavior: 'auto',
          overscrollBehavior: 'contain',
          maxHeight: '100%',
          overflowAnchor: 'none',
          WebkitOverflowScrolling: 'touch',
          position: 'relative'
        }}
        onScroll={(e) => {
          // Prevent scroll from bubbling up to parent
          e.stopPropagation();
        }}
      >
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-slate-500 py-8">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwn = message.sender_id === user?.id;
            const hasReactions = message.reactions && message.reactions.length > 0;

            return (
              <div
                key={message.id}
                className={`flex gap-3 group ${isOwn ? 'flex-row-reverse' : ''}`}
                onMouseEnter={() => setSelectedMessage(message)}
                onMouseLeave={() => setSelectedMessage(null)}
              >
                {!isOwn && (
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs flex-shrink-0">
                    {message.sender_name.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className={`max-w-md ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                  {!isOwn && (
                    <span className="text-xs text-slate-500 mb-1">{message.sender_name}</span>
                  )}

                  {/* Reply Preview */}
                  {message.reply_to_content && (
                    <div className="mb-1 p-2 bg-slate-100 rounded-lg border-l-4 border-indigo-500 text-xs text-slate-600">
                      <div className="font-semibold">
                        {message.reply_to_sender_name || 'User'}
                      </div>
                      <div className="truncate">{message.reply_to_content}</div>
                    </div>
                  )}

                  {/* Forwarded Label */}
                  {message.forwarded_from_user_name && (
                    <div className="mb-1 text-xs text-slate-500 flex items-center gap-1">
                      <Forward size={12} />
                      Forwarded from {message.forwarded_from_user_name}
                    </div>
                  )}

                  {/* Message Content */}
                  <div
                    className={`p-3 rounded-2xl shadow-sm ${
                      isOwn
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-white text-slate-700 rounded-tl-none'
                    }`}
                  >
                    {message.content_type === 'markdown' ? (
                      <div className={isOwn ? 'prose prose-invert prose-sm max-w-none' : 'prose prose-sm max-w-none'}>
                        {/* <ReactMarkdown>{message.content}</ReactMarkdown> */}
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    )}

                    {message.is_edited && (
                      <span className="text-xs opacity-70 ml-2">(edited)</span>
                    )}
                  </div>

                  {/* Reactions */}
                  {hasReactions && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {Object.entries(
                        message.reactions.reduce((acc: any, r: any) => {
                          if (!acc[r.emoji]) acc[r.emoji] = [];
                          acc[r.emoji].push(r);
                          return acc;
                        }, {})
                      ).map(([emoji, reactions]: [string, any]) => (
                        <button
                          key={emoji}
                          onClick={() => {
                            const userReaction = reactions.find(
                              (r: any) => r.user_id === user?.id
                            );
                            if (userReaction) {
                              handleRemoveReaction(message.id, emoji);
                            } else {
                              handleAddReaction(message.id, emoji);
                            }
                          }}
                          className={`px-2 py-1 rounded-full text-xs border ${
                            reactions.find((r: any) => r.user_id === user?.id)
                              ? 'bg-indigo-100 border-indigo-300'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          {emoji} {reactions.length}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Message Actions (on hover) */}
                  {selectedMessage?.id === message.id && (
                    <div
                      className={`mt-1 flex gap-1 ${isOwn ? 'flex-row-reverse' : ''}`}
                    >
                      {isOwn && (
                        <>
                          <button
                            onClick={() => {
                              setEditingMessage(message);
                              setNewMessage(message.content);
                            }}
                            className="p-1 hover:bg-slate-100 rounded text-slate-600"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleDeleteMessage(message.id)}
                            className="p-1 hover:bg-red-100 rounded text-red-600"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => setReplyingTo(message)}
                        className="p-1 hover:bg-slate-100 rounded text-slate-600"
                        title="Reply"
                      >
                        <Reply size={14} />
                      </button>
                      <button
                        onClick={() => setForwardingMessage(message)}
                        className="p-1 hover:bg-slate-100 rounded text-slate-600"
                        title="Forward"
                      >
                        <Forward size={14} />
                      </button>
                      <button
                        onClick={() => handlePinMessage(message.id)}
                        className="p-1 hover:bg-slate-100 rounded text-slate-600"
                        title="Pin"
                      >
                        <Pin size={14} />
                      </button>
                      <button
                        onClick={() => handleAddReaction(message.id, '👍')}
                        className="p-1 hover:bg-slate-100 rounded text-slate-600"
                        title="React"
                      >
                        <Smile size={14} />
                      </button>
                    </div>
                  )}

                  <span className="text-xs text-slate-400 mt-1">
                    {formatTime(message.created_at)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} style={{ height: '1px' }} />
      </div>

      {/* Reply Preview */}
      {replyingTo && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Reply size={16} className="text-indigo-600" />
            <span className="text-slate-600">Replying to {replyingTo.sender_name}</span>
            <span className="text-slate-400 truncate max-w-xs">{replyingTo.content}</span>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 hover:bg-slate-200 rounded"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Forward Preview */}
      {forwardingMessage && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Forward size={16} className="text-indigo-600" />
            <span className="text-slate-600">Forwarding message</span>
          </div>
          <button
            onClick={() => setForwardingMessage(null)}
            className="p-1 hover:bg-slate-200 rounded"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Edit Preview */}
      {editingMessage && (
        <div className="px-4 py-2 bg-indigo-50 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Edit2 size={16} className="text-indigo-600" />
            <span className="text-indigo-600">Editing message</span>
          </div>
          <button
            onClick={() => {
              setEditingMessage(null);
              setNewMessage('');
            }}
            className="p-1 hover:bg-indigo-200 rounded"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="p-4 bg-white/60 border-t border-slate-200 relative flex-shrink-0">
        {/* {showEmojiPicker && (
          <div className="absolute bottom-full right-4 mb-2 z-50">
            <EmojiPicker onEmojiClick={onEmojiClick} />
          </div>
        )} */}

        <div className="flex gap-2">
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
          >
            <Smile size={20} />
          </button>

          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  e.stopPropagation();
                  if (editingMessage) {
                    handleEditMessage();
                  } else {
                    handleSendMessage();
                  }
                }
              }}
              placeholder={editingMessage ? 'Edit your message...' : 'Type a message...'}
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>

          {editingMessage ? (
            <>
              <button
                onClick={() => {
                  setEditingMessage(null);
                  setNewMessage('');
                }}
                className="p-2.5 hover:bg-slate-100 rounded-xl text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
              <button
                onClick={handleEditMessage}
                className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
              >
                <Check size={20} />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSendMessage();
              }}
              disabled={!newMessage.trim()}
              className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;


