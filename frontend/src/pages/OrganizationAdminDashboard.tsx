import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Users, ArrowRight, Plus, FolderOpen, Building2, UserPlus, MoreVertical, Trash2, Mail } from 'lucide-react';
import { MEETINGS, Meeting, ORGANIZATION_USERS, User } from '../mockData';

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

const OrganizationAdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'organization'>('overview');

  const handleJoin = (id: string) => {
    navigate(`/meeting/${id}`);
  };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-10 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">Acme Corp Dashboard</h1>
          <p className="text-slate-500">Manage your organization and team members.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium transition-all ${
              activeTab === 'overview' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-600 hover:bg-white/50'
            }`}
          >
            Overview
          </button>
          <button 
            onClick={() => setActiveTab('organization')}
            className={`flex-1 md:flex-none px-5 py-2.5 rounded-xl font-medium transition-all ${
              activeTab === 'organization' 
                ? 'bg-white text-indigo-600 shadow-sm' 
                : 'text-slate-600 hover:bg-white/50'
            }`}
          >
            Organization
          </button>
        </div>
      </header>

      {activeTab === 'overview' && (
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
              <button className="w-full py-2.5 rounded-lg bg-white/20 backdrop-blur-sm border border-white/30 hover:bg-white/30 transition-colors text-sm font-medium flex items-center justify-center gap-2">
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

      {activeTab === 'organization' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-slate-700 flex items-center gap-2">
              <Users size={20} className="text-indigo-500" />
              Team Members
            </h2>
            <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/20">
              <UserPlus size={16} />
              Add Member
            </button>
          </div>

          <div className="grid gap-4">
            {ORGANIZATION_USERS.map(user => (
              <UserRow key={user.id} user={user} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizationAdminDashboard;
