import React, { useState, useEffect } from "react";
import { Building2, Users, Activity, ArrowRight, Check, X, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { API_ENDPOINTS } from "../config";
import { useAuth } from "../contexts/AuthContext";
import Organizations from "./Organizations";
import Meetings from "./Meetings";
import CalendarPage from "./CalendarPage";
import Settings from "./Settings";

interface SuperAdminDashboardProps {
  activeTab: string;
}

const SuperAdminDashboard = ({ activeTab }: SuperAdminDashboardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalOrgs: 0,
    totalUsers: 0, // This would need a separate API or sum of orgs
    pendingRequests: 0,
  });
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("access_token");
      if (!token) return;

      const headers = {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      };

      // Fetch pending requests
      const pendingRes = await fetch(`${API_ENDPOINTS.BASE_URL}/auth/pending-org-admins`, {
        headers,
      });
      
      if (pendingRes.ok) {
        const pendingData = await pendingRes.json();
        setPendingRequests(pendingData);
        setStats(prev => ({ ...prev, pendingRequests: pendingData.length }));
      }

      // Fetch organizations count
      const orgsRes = await fetch(`${API_ENDPOINTS.BASE_URL}/organizations?page=1&page_size=1`, {
        headers,
      });

      if (orgsRes.ok) {
        const orgsData = await orgsRes.json();
        setStats(prev => ({ ...prev, totalOrgs: orgsData.total }));
      }

      // Fetch user stats
      const statsRes = await fetch(`${API_ENDPOINTS.BASE_URL}/auth/stats`, {
        headers,
      });

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(prev => ({ ...prev, totalUsers: statsData.total_users }));
      }

    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
      setError("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleApproval = async (userId: string, approved: boolean) => {
    try {
      setActionLoading(userId);
      const token = localStorage.getItem("access_token");
      
      const response = await fetch(`${API_ENDPOINTS.BASE_URL}/auth/approve-org-admin`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: userId,
          approved: approved,
          subscription_plan: "FREE", // Default for now, could be dynamic
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to process request");
      }

      // Refresh data
      await fetchData();
    } catch (err) {
      console.error("Approval action failed", err);
      alert("Failed to process request. Please try again.");
    } finally {
      setActionLoading(null);
    }
  };

  if (activeTab === 'organizations') return <Organizations />;
  if (activeTab === 'meetings') return <Meetings />;
  if (activeTab === 'calendar') return <CalendarPage />;
  if (activeTab === 'settings') return <Settings />;

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 md:mb-10 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">
            Super Admin Console
          </h1>
          <p className="text-slate-500">
            Manage all organizations and platform settings.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-white/50 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-xl bg-indigo-100 text-indigo-600">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">
                Total Organizations
              </p>
              <h3 className="text-2xl font-bold text-slate-800">
                {stats.totalOrgs}
              </h3>
            </div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
            <div
              className="bg-indigo-500 h-1.5 rounded-full"
              style={{ width: "70%" }}
            ></div>
          </div>
          <p className="text-xs text-slate-500">Active organizations</p>
        </div>

        <div className="p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-white/50 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
              <Users size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">Total Users</p>
              <h3 className="text-2xl font-bold text-slate-800">{stats.totalUsers}</h3>
            </div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
            <div
              className="bg-blue-500 h-1.5 rounded-full"
              style={{ width: "85%" }}
            ></div>
          </div>
          <p className="text-xs text-slate-500">Across all organizations</p>
        </div>

        <div className="p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-white/50 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-xl bg-green-100 text-green-600">
              <Activity size={24} />
            </div>
            <div>
              <p className="text-sm text-slate-500 font-medium">
                System Health
              </p>
              <h3 className="text-2xl font-bold text-slate-800">98.9%</h3>
            </div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
            <div
              className="bg-green-500 h-1.5 rounded-full"
              style={{ width: "98%" }}
            ></div>
          </div>
          <p className="text-xs text-slate-500">All systems operational</p>
        </div>
      </div>

      {/* Pending Approvals Section */}
      {pendingRequests.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xl font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <AlertCircle className="text-amber-500" size={24} />
            Pending Approvals
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {pendingRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-slate-900">{req.user_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-600">{req.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                        {new Date(req.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => handleApproval(req.id, true)}
                            disabled={actionLoading === req.id}
                            className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50"
                            title="Approve"
                          >
                            <Check size={18} />
                          </button>
                          <button 
                            onClick={() => handleApproval(req.id, false)}
                            disabled={actionLoading === req.id}
                            className="p-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors disabled:opacity-50"
                            title="Reject"
                          >
                            <X size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions Section */}
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-slate-700">Quick Actions</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* View All Organizations Card */}
          <div
            className="p-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-xl bg-white/20 backdrop-blur-sm">
                <Building2 size={24} />
              </div>
              <ArrowRight
                size={24}
                className="group-hover:translate-x-1 transition-transform"
              />
            </div>
            <h3 className="text-xl font-bold mb-2">Manage Organizations</h3>
            <p className="text-indigo-100 text-sm mb-4">
              View and manage all {stats.totalOrgs} organizations on the
              platform
            </p>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold">
                {stats.totalOrgs} Total Organizations
              </span>
            </div>
          </div>

          {/* Platform Settings Card */}
          <div className="p-6 rounded-2xl bg-white/60 backdrop-blur-md border border-white/50 shadow-sm hover:shadow-lg transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="p-3 rounded-xl bg-slate-100">
                <Activity size={24} className="text-slate-600" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-slate-800 mb-2">
              Platform Settings
            </h3>
            <p className="text-slate-600 text-sm mb-4">
              Configure system-wide settings and preferences
            </p>
            <button className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
              Open Settings →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
