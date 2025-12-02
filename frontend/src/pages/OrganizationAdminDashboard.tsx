import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Users, ArrowRight, Plus, FolderOpen, Building2, UserPlus, MoreVertical, Trash2, Mail, Copy, Check } from 'lucide-react';
import { MEETINGS, Meeting, ORGANIZATION_USERS, User } from '../mockData';
import Meetings from './Meetings';
import CalendarPage from './CalendarPage';
import Chat from './Chat';
import Files from './Files';
import Settings from './Settings';

interface MeetingCardProps {
  meeting: Meeting;
  onJoin: (id: string) => void;
}

const MeetingCard = ({ meeting, onJoin }: MeetingCardProps) => (
  <div className="group relative p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-white/50 shadow-sm hover:shadow-xl hover:bg-white/80 transition-all duration-300">
    <div className="flex justify-between items-start mb-4">
      <div>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mb-2
          ${meeting.status === 'Live Now' 
            ? 'bg-red-100 text-red-600 animate-pulse' 
            : 'bg-indigo-50 text-indigo-600'
          }`}>
          {meeting.status === 'Live Now' && <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5" />}
          {meeting.status}
        </span>
        <h3 className="text-lg font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">
          {meeting.title}
        </h3>
      </div>
      <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
        <ArrowRight size={20} />
      </div>
    </div>
    
    <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500 mb-6">
      <div className="flex items-center gap-1.5">
        <Clock size={16} />
        {meeting.time}
      </div>
      <div className="flex items-center gap-1.5">
        <Users size={16} />
        {meeting.participants.length} attendees
      </div>
    </div>

    <div className="flex items-center justify-between">
      <div className="flex -space-x-2">
        {meeting.participants.map((p, i) => (
          <img 
            key={p.id} 
            src={p.avatar} 
            alt={p.name}
            className="w-8 h-8 rounded-full border-2 border-white ring-1 ring-slate-100"
            style={{ zIndex: 10 - i }}
          />
        ))}
      </div>
      <button 
        onClick={() => onJoin(meeting.id)}
        className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/20"
      >
        Join Room
      </button>
    </div>
  </div>
);

const UserRow = ({ user }: { user: User }) => (
  <div className="flex items-center justify-between p-4 rounded-xl bg-white/50 border border-white/50 hover:bg-white/80 transition-all group">
    <div className="flex items-center gap-4">
      <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
      <div>
        <h4 className="font-semibold text-slate-800">{user.name}</h4>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Mail size={14} />
          {user.email}
        </div>
      </div>
    </div>
    <div className="flex items-center gap-4">
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
        user.role === 'Admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
      }`}>
        {user.role}
      </span>
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
        user.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
      }`}>
        {user.status}
      </span>
      <button className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
        <Trash2 size={18} />
      </button>
    </div>
  </div>
);

interface OrganizationAdminDashboardProps {
  activeTab: string;
}

import { X, Loader2 } from 'lucide-react';
import { api } from '../utils/api';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const InviteModal = ({ isOpen, onClose, onSuccess }: InviteModalProps) => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [magicLink, setMagicLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    setMagicLink(null);

    try {
      const response = await api.post('/auth/invite-user', {
        email,
        user_name: name,
      });
      setSuccess('Invitation created successfully!');
      if (response.data.magic_link) {
        setMagicLink(response.data.magic_link);
      }
      // Don't close immediately if we have a link to show
      if (!response.data.magic_link) {
        setEmail('');
        setName('');
        setTimeout(() => {
          onSuccess();
          onClose();
          setSuccess(null);
        }, 2000);
      } else {
        onSuccess(); // Refresh list in background
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to send invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (magicLink) {
      navigator.clipboard.writeText(magicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setEmail('');
    setName('');
    setMagicLink(null);
    setSuccess(null);
    setError(null);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-lg font-semibold text-slate-800">Invite Team Member</h3>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">
              {error}
            </div>
          )}
          {success && !magicLink && (
            <div className="p-3 rounded-lg bg-green-50 text-green-600 text-sm border border-green-100">
              {success}
            </div>
          )}

          {magicLink ? (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-green-50 border border-green-100 text-center">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3 text-green-600">
                  <Check size={24} />
                </div>
                <h4 className="font-semibold text-green-900 mb-1">Invitation Created!</h4>
                <p className="text-sm text-green-700">Share this magic link with {name}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Magic Link</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={magicLink}
                    className="flex-1 px-4 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 text-sm focus:outline-none"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors flex items-center gap-2"
                  >
                    {copied ? <Check size={18} /> : <Copy size={18} />}
                  </button>
                </div>
              </div>

              <button
                onClick={handleClose}
                className="w-full py-2.5 rounded-lg border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Full Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                  placeholder="john@example.com"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Creating Invite...
                    </>
                  ) : (
                    <>
                      <Mail size={18} />
                      Create Invitation
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

import { useAuth } from '../contexts/AuthContext';
import { API_ENDPOINTS } from '../config';

const OrganizationAdminDashboard = ({ activeTab }: OrganizationAdminDashboardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [internalTab, setInternalTab] = useState<'overview' | 'organization'>('overview');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [orgName, setOrgName] = useState<string>('Organization');

  const [members, setMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);

  const fetchOrgDetails = React.useCallback(async () => {
    if (user?.organization_id) {
      try {
        const [orgRes, membersRes] = await Promise.all([
          api.get(API_ENDPOINTS.ORGANIZATIONS.DETAIL(user.organization_id)),
          api.get(`${API_ENDPOINTS.ORGANIZATIONS.DETAIL(user.organization_id)}/members`)
        ]);
        setOrgName(orgRes.data.name);
        setMembers(membersRes.data);
      } catch (error) {
        console.error('Failed to fetch organization details:', error);
      }
    }
  }, [user?.organization_id]);

  React.useEffect(() => {
    fetchOrgDetails();
  }, [fetchOrgDetails]);

  const handleJoin = (id: string) => {
    navigate(`/meeting/${id}`);
  };

  if (activeTab === 'meetings') return <Meetings />;
  if (activeTab === 'calendar') return <CalendarPage />;
  if (activeTab === 'chat') return <Chat />;
  if (activeTab === 'files') return <Files />;
  if (activeTab === 'settings') return <Settings />;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 relative">
      <InviteModal 
        isOpen={isInviteModalOpen} 
        onClose={() => setIsInviteModalOpen(false)} 
        onSuccess={() => {
          fetchOrgDetails();
        }} 
      />

      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-10 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">{orgName} Dashboard</h1>
          <p className="text-slate-500">Manage your organization and team members.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={() => setInternalTab('overview')}
            className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium transition-all ${
              internalTab === 'overview' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-600 hover:bg-white/50'
            }`}
          >
            Overview
          </button>
          <button 
            onClick={() => setInternalTab('organization')}
            className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium transition-all ${
              internalTab === 'organization' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-600 hover:bg-white/50'
            }`}
          >
            Organization
          </button>
        </div>
      </header>

      {internalTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-semibold text-slate-700 flex items-center gap-2">
              <Calendar size={20} className="text-indigo-500" />
              Today's Schedule
            </h2>
            <div className="grid gap-4">
              {MEETINGS.map(meeting => (
                <MeetingCard key={meeting.id} meeting={meeting} onJoin={handleJoin} />
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-slate-700">Quick Actions</h2>
            <div className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-xl shadow-indigo-500/20">
              <h3 className="text-lg font-bold mb-2">Invite Team Members</h3>
              <p className="text-indigo-100 text-sm mb-4">
                Add new members to your organization to start collaborating.
              </p>
              <button 
                onClick={() => setIsInviteModalOpen(true)}
                className="w-full py-2.5 rounded-lg bg-white/20 backdrop-blur-sm border border-white/30 hover:bg-white/30 transition-colors text-sm font-medium flex items-center justify-center gap-2"
              >
                <UserPlus size={16} />
                Invite Member
              </button>
            </div>

            <div className="p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-white/50 shadow-sm">
              <h3 className="font-semibold text-slate-800 mb-4">Organization Stats</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-indigo-50 text-indigo-900">
                  <span className="text-sm font-medium">Total Members</span>
                  <span className="text-lg font-bold">12</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-blue-50 text-blue-900">
                  <span className="text-sm font-medium">Active Projects</span>
                  <span className="text-lg font-bold">8</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-purple-50 text-purple-900">
                  <span className="text-sm font-medium">Storage Used</span>
                  <span className="text-lg font-bold">45%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {internalTab === 'organization' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-slate-700 flex items-center gap-2">
              <Users size={20} className="text-indigo-500" />
              Team Members
            </h2>
            <button 
              onClick={() => setIsInviteModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20"
            >
              <UserPlus size={16} />
              Add Member
            </button>
          </div>

          <div className="grid gap-4">
            {isLoadingMembers ? (
              <div className="flex justify-center py-8">
                <Loader2 size={32} className="animate-spin text-indigo-600" />
              </div>
            ) : (
              members.map(member => (
                <UserRow key={member.id} user={{
                  id: member.id,
                  name: member.user_name,
                  email: member.email,
                  role: member.role === 'org-admin' ? 'Admin' : 'Member',
                  status: member.status === 'active' ? 'Active' : 'Pending',
                  avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(member.user_name)}&background=random`
                }} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationAdminDashboard;
