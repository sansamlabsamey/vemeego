import React, { useState, useEffect } from "react";
import {
  Building2,
  Users,
  Calendar,
  CreditCard,
  Database,
  Trash2,
  X,
  CheckCircle,
  XCircle,
  Shield,
  Loader2,
} from "lucide-react";
import { API_ENDPOINTS } from "../config";

interface Organization {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  subscription_plan: string;
  subscription_status: string;
  subscription_end_date: string | null;
  max_users: number;
  max_storage_gb: number;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  current_users?: number;
  active_users?: number;
  pending_users?: number;
}

const OrganizationDetailModal = ({
  organization,
  onClose,
}: {
  organization: Organization;
  onClose: () => void;
}) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case "ENTERPRISE":
        return "bg-purple-100 text-purple-700";
      case "PRO":
        return "bg-blue-100 text-blue-700";
      case "FREE":
        return "bg-slate-100 text-slate-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-700";
      case "TRIAL":
        return "bg-yellow-100 text-yellow-700";
      case "SUSPENDED":
        return "bg-red-100 text-red-700";
      case "EXPIRED":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div className="fixed inset-0 backdrop-blur-md flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-blue-600 p-6 rounded-t-2xl">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white font-bold text-2xl border-2 border-white/30">
                {organization.name.charAt(0)}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">
                  {organization.name}
                </h2>
                <p className="text-indigo-100 text-sm">
                  {organization.description || "No description"}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors text-white"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-indigo-100">
                  <CreditCard size={20} className="text-indigo-600" />
                </div>
                <span className="text-sm font-medium text-slate-600">
                  Subscription
                </span>
              </div>
              <div className="flex flex-col gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold w-fit ${getPlanColor(organization.subscription_plan)}`}
                >
                  {organization.subscription_plan}
                </span>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-semibold w-fit ${getStatusColor(organization.subscription_status)}`}
                >
                  {organization.subscription_status}
                </span>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-blue-50 border border-blue-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Users size={20} className="text-blue-600" />
                </div>
                <span className="text-sm font-medium text-slate-600">
                  Users
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-800">
                  {organization.current_users || 0}
                </span>
                <span className="text-sm text-slate-500">
                  / {organization.max_users}
                </span>
              </div>
              <div className="w-full bg-blue-100 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${Math.min(((organization.current_users || 0) / organization.max_users) * 100, 100)}%`,
                  }}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-green-50 border border-green-100">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 rounded-lg bg-green-100">
                  <Database size={20} className="text-green-600" />
                </div>
                <span className="text-sm font-medium text-slate-600">
                  Storage
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-800">
                  {organization.max_storage_gb}
                </span>
                <span className="text-sm text-slate-500">GB</span>
              </div>
              <p className="text-xs text-slate-500 mt-2">Storage limit</p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Organization Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Building2 size={20} className="text-indigo-500" />
                Organization Information
              </h3>
              <div className="space-y-3 p-4 rounded-xl bg-slate-50">
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">
                    Organization ID
                  </label>
                  <p className="text-sm text-slate-800 font-mono mt-1">
                    {organization.id}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">
                    Name
                  </label>
                  <p className="text-sm text-slate-800 font-semibold mt-1">
                    {organization.name}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">
                    Description
                  </label>
                  <p className="text-sm text-slate-600 mt-1">
                    {organization.description || "No description provided"}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">
                    Status
                  </label>
                  <div className="flex items-center gap-2 mt-1">
                    {organization.is_deleted ? (
                      <>
                        <XCircle size={16} className="text-red-500" />
                        <span className="text-sm text-red-600 font-medium">
                          Deleted
                        </span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} className="text-green-500" />
                        <span className="text-sm text-green-600 font-medium">
                          Active
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Subscription Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <Shield size={20} className="text-indigo-500" />
                Subscription Details
              </h3>
              <div className="space-y-3 p-4 rounded-xl bg-slate-50">
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">
                    Plan
                  </label>
                  <p className="text-sm text-slate-800 font-semibold mt-1">
                    {organization.subscription_plan}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">
                    Status
                  </label>
                  <p className="text-sm text-slate-800 font-semibold mt-1">
                    {organization.subscription_status}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">
                    End Date
                  </label>
                  <p className="text-sm text-slate-800 mt-1">
                    {organization.subscription_end_date
                      ? formatDate(organization.subscription_end_date)
                      : "No expiration"}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">
                    Max Users
                  </label>
                  <p className="text-sm text-slate-800 font-semibold mt-1">
                    {organization.max_users.toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 uppercase">
                    Storage Limit
                  </label>
                  <p className="text-sm text-slate-800 font-semibold mt-1">
                    {organization.max_storage_gb} GB
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Timestamps */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <Calendar size={20} className="text-indigo-500" />
              Timeline
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50">
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase">
                  Created At
                </label>
                <p className="text-sm text-slate-800 mt-1">
                  {formatDate(organization.created_at)}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500 uppercase">
                  Last Updated
                </label>
                <p className="text-sm text-slate-800 mt-1">
                  {formatDate(organization.updated_at)}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-colors"
            >
              Close
            </button>
            <button className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-500/30">
              Edit Organization
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const OrganizationRow = ({
  organization,
  onClick,
}: {
  organization: Organization;
  onClick: () => void;
}) => {
  const getPlanColor = (plan: string) => {
    switch (plan) {
      case "ENTERPRISE":
        return "bg-purple-100 text-purple-700";
      case "PRO":
        return "bg-blue-100 text-blue-700";
      case "FREE":
        return "bg-slate-100 text-slate-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-700";
      case "TRIAL":
        return "bg-yellow-100 text-yellow-700";
      case "SUSPENDED":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-5 rounded-xl bg-white/60 backdrop-blur-md border border-white/50 hover:bg-white/90 hover:shadow-lg transition-all cursor-pointer group"
    >
      <div className="flex items-center gap-4 flex-1">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/20">
          {organization.name.charAt(0)}
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors">
            {organization.name}
          </h4>
          <p className="text-sm text-slate-500 line-clamp-1">
            {organization.description || "No description"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden md:flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${getPlanColor(organization.subscription_plan)}`}
          >
            {organization.subscription_plan}
          </span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(organization.subscription_status)}`}
          >
            {organization.subscription_status}
          </span>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-sm text-slate-600">
          <Users size={16} className="text-slate-400" />
          <span className="font-medium">{organization.current_users || 0}</span>
          <span className="text-slate-400">/ {organization.max_users}</span>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-sm text-slate-600">
          <Database size={16} className="text-slate-400" />
          <span className="font-medium">{organization.max_storage_gb} GB</span>
        </div>

        <div className="w-px h-8 bg-slate-200 hidden md:block" />

        <button
          onClick={(e) => {
            e.stopPropagation();
            // Handle delete
          }}
          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >
          <Trash2 size={18} />
        </button>
      </div>
    </div>
  );
};

const Organizations = () => {
  const [selectedOrganization, setSelectedOrganization] =
    useState<Organization | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchOrganizations = async () => {
      try {
        setIsLoading(true);
        const token = localStorage.getItem("access_token");
        if (!token) return;

        const response = await fetch(`${API_ENDPOINTS.ORGANIZATIONS.LIST}?page=1&page_size=100`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setOrganizations(data.organizations);
        } else {
          setError("Failed to fetch organizations");
        }
      } catch (err) {
        console.error("Error fetching organizations:", err);
        setError("An error occurred while loading organizations");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrganizations();
  }, []);

  const filteredOrganizations = organizations.filter(
    (org) =>
      org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      org.description?.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mx-auto mb-4" />
          <p className="text-slate-500">Loading organizations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">
          Organizations
        </h1>
        <p className="text-slate-500">
          Manage all organizations and their subscriptions
        </p>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="p-5 rounded-xl bg-white/60 backdrop-blur-md border border-white/50 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-indigo-100">
              <Building2 size={20} className="text-indigo-600" />
            </div>
            <span className="text-sm font-medium text-slate-600">Total</span>
          </div>
          <p className="text-3xl font-bold text-slate-800">
            {organizations.length}
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white/60 backdrop-blur-md border border-white/50 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green-100">
              <CheckCircle size={20} className="text-green-600" />
            </div>
            <span className="text-sm font-medium text-slate-600">Active</span>
          </div>
          <p className="text-3xl font-bold text-slate-800">
            {
              organizations.filter(
                (o) => o.subscription_status === "ACTIVE",
              ).length
            }
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white/60 backdrop-blur-md border border-white/50 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-yellow-100">
              <Calendar size={20} className="text-yellow-600" />
            </div>
            <span className="text-sm font-medium text-slate-600">Trial</span>
          </div>
          <p className="text-3xl font-bold text-slate-800">
            {
              organizations.filter(
                (o) => o.subscription_status === "TRIAL",
              ).length
            }
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white/60 backdrop-blur-md border border-white/50 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-100">
              <Users size={20} className="text-blue-600" />
            </div>
            <span className="text-sm font-medium text-slate-600">
              Total Users
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-800">
            {organizations.reduce(
              (sum, org) => sum + (org.current_users || 0),
              0,
            )}
          </p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Building2
            className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Search organizations by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl bg-white/60 backdrop-blur-md border border-white/50 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none text-slate-700 placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Organizations List */}
      <div className="space-y-3">
        {filteredOrganizations.length > 0 ? (
          filteredOrganizations.map((org) => (
            <OrganizationRow
              key={org.id}
              organization={org}
              onClick={() => setSelectedOrganization(org)}
            />
          ))
        ) : (
          <div className="text-center py-12">
            <Building2 size={48} className="text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No organizations found</p>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedOrganization && (
        <OrganizationDetailModal
          organization={selectedOrganization}
          onClose={() => setSelectedOrganization(null)}
        />
      )}
    </div>
  );
};

export default Organizations;
