import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Users, ArrowRight, Plus, FolderOpen, X, Loader2, Lock, Check, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../utils/api';
import { API_ENDPOINTS } from '../config';
import { MEETINGS, Meeting } from '../mockData';
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

const ChangePasswordModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { refreshUser } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await api.post(API_ENDPOINTS.AUTH.UPDATE_PASSWORD, {
        new_password: password,
      });
      setSuccess(true);
      await refreshUser();
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 className="text-lg font-semibold text-slate-800">Set Your Password</h3>
          {!success && (
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <X size={20} />
            </button>
          )}
        </div>
        
        <div className="p-6">
          {success ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4 text-green-600">
                <Check size={32} />
              </div>
              <h4 className="text-xl font-bold text-slate-800 mb-2">Password Set!</h4>
              <p className="text-slate-500">Your account is now fully secured.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-red-50 text-red-600 text-sm border border-red-100">
                  {error}
                </div>
              )}
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">New Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="Min. 8 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Confirm Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    placeholder="Re-enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
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
                      Setting Password...
                    </>
                  ) : (
                    'Set Password'
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

interface UserDashboardProps {
  activeTab: string;
}

const UserDashboard = ({ activeTab }: UserDashboardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  useEffect(() => {
    if (user && !user.is_verified) {
      setIsPasswordModalOpen(true);
    }
  }, [user]);

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
      <ChangePasswordModal 
        isOpen={isPasswordModalOpen} 
        onClose={() => setIsPasswordModalOpen(false)} 
      />
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-10 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">
            Good Morning, {user?.user_name || 'User'}
          </h1>
          {user?.organization_name && (
            <p className="text-slate-500 font-medium">{user.organization_name}</p>
          )}
          <p className="text-slate-500 text-sm mt-1">You have 3 meetings scheduled for today.</p>
        </div>
        <button className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40">
          <Plus size={20} />
          New Meeting
        </button>
      </header>

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
            <h3 className="text-lg font-bold mb-2">AI Assistant</h3>
            <p className="text-indigo-100 text-sm mb-4">
              Prepare for your next meeting. Ask Lumina to summarize previous notes.
            </p>
            <button className="w-full py-2.5 rounded-lg bg-white/20 backdrop-blur-sm border border-white/30 hover:bg-white/30 transition-colors text-sm font-medium">
              Open Assistant
            </button>
          </div>

          <div className="p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-white/50 shadow-sm">
            <h3 className="font-semibold text-slate-800 mb-4">Recent Files</h3>
            <div className="space-y-3">
              {['Q3_Roadmap.pdf', 'Design_System_v2.fig', 'Budget_2025.xlsx'].map((file, i) => (
                <div key={i} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/50 transition-colors cursor-pointer">
                  <div className="w-8 h-8 rounded bg-indigo-50 flex items-center justify-center text-indigo-600">
                    <FolderOpen size={16} />
                  </div>
                  <span className="text-sm text-slate-600">{file}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;
