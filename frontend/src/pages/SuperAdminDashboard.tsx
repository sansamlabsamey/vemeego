import React, { useState } from 'react';
import { Building2, Users, MoreVertical, Trash2, Plus, Search, Shield, Activity } from 'lucide-react';
import { ORGANIZATIONS, Organization } from '../mockData';

const OrganizationRow = ({ org }: { org: Organization }) => (
  <div className="flex items-center justify-between p-4 rounded-xl bg-white/50 border border-white/50 hover:bg-white/80 transition-all group">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/20">
        {org.name.charAt(0)}
      </div>
      <div>
        <h4 className="font-semibold text-slate-800">{org.name}</h4>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            org.plan === 'Enterprise' ? 'bg-purple-100 text-purple-700' : 
            org.plan === 'Pro' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-600'
          }`}>
            {org.plan} Plan
          </span>
          <span>•</span>
          <span>{org.users.length} Users</span>
        </div>
      </div>
    </div>
    <div className="flex items-center gap-4">
      <div className="text-right hidden md:block">
        <p className="text-sm font-medium text-slate-700">Active</p>
        <p className="text-xs text-slate-500">Last active 2m ago</p>
      </div>
      <button className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
        <Trash2 size={18} />
      </button>
      <button className="p-2 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors">
        <MoreVertical size={18} />
      </button>
    </div>
  </div>
);

const SuperAdminDashboard = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredOrgs = ORGANIZATIONS.filter(org => 
    org.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-10 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">Super Admin Console</h1>
          <p className="text-slate-500">Manage all organizations and platform settings.</p>
        </div>
        <button className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40">
          <Plus size={20} />
          Add Organization
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-white/50 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-xl bg-indigo-100 text-indigo-600">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Total Organizations</p>
              <h3 className="text-2xl font-bold text-slate-800">{ORGANIZATIONS.length}</h3>
            </div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
            <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: '70%' }}></div>
          </div>
          <p className="text-xs text-slate-500">+2 this month</p>
        </div>

        <div className="p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-white/50 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Total Users</p>
              <h3 className="text-2xl font-bold text-slate-800">1,234</h3>
            </div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
            <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: '85%' }}></div>
          </div>
          <p className="text-xs text-slate-500">+12% from last month</p>
        </div>

        <div className="p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-white/50 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-xl bg-green-100 text-green-600">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">System Health</p>
              <h3 className="text-2xl font-bold text-slate-800">98.9%</h3>
            </div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
            <div className="bg-green-500 h-1.5 rounded-full" style={{ width: '98%' }}></div>
          </div>
          <p className="text-xs text-slate-500">All systems operational</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-xl font-semibold text-slate-700 flex items-center gap-2">
            <Shield size={20} className="text-indigo-500" />
            Organizations
          </h2>
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={20} />
            <input 
              type="text" 
              placeholder="Search organizations..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/50 border border-white/50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-slate-600 placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="grid gap-4">
          {filteredOrgs.map(org => (
            <OrganizationRow key={org.id} org={org} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
