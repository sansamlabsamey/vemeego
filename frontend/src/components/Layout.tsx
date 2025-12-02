import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquare,
  FolderOpen,
  Settings,
  Video,
  LogOut,
  Sparkles,
  Menu,
  X,
  LucideIcon,
  Shield,
  Calendar,
  Building2,
} from "lucide-react";
import AgentView from "./AgentView";
import { useAuth } from "../contexts/AuthContext";

interface SidebarItemProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}

const SidebarItem = ({
  icon: Icon,
  label,
  active,
  onClick,
}: SidebarItemProps) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
      ${
        active
          ? "bg-white/80 shadow-sm text-indigo-600"
          : "text-slate-500 hover:bg-white/50 hover:text-indigo-500"
      }`}
  >
    <Icon
      size={20}
      className={
        active
          ? "text-indigo-600"
          : "text-slate-400 group-hover:text-indigo-500"
      }
    />
    <span className="font-medium">{label}</span>
  </button>
);

interface LayoutProps {
  children?: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const Layout = ({ children, activeTab, onTabChange }: LayoutProps) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isAgentMode, setIsAgentMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleTabClick = (tab: string) => {
    onTabChange(tab);
    closeMobileMenu();
  };

  return (
    <div className="flex h-screen w-full bg-[#f0f4f8] overflow-hidden font-sans text-slate-800 relative">
      {/* Background Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-200/30 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-200/30 blur-[120px] pointer-events-none" />

      {/* Mobile Header */}
      <div className="md:hidden absolute top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-white/50 flex items-center justify-between px-4 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Video size={18} className="text-white" />
          </div>
          <span className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-600">
            Lumina
          </span>
        </div>
        <button
          onClick={toggleMobileMenu}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar (Desktop & Mobile) */}
      <aside
        className={`
        fixed md:static inset-y-0 left-0 z-40 w-64 bg-white/90 md:bg-white/30 backdrop-blur-xl md:backdrop-blur-sm border-r border-white/40
        transform transition-transform duration-300 ease-in-out flex flex-col justify-between p-6
        ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
      `}
      >
        <div className="mt-16 md:mt-0">
          <div className="hidden md:flex items-center gap-2 mb-10 px-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Video size={18} className="text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-600">
              Lumina
            </span>
          </div>

          {/* Agent Mode Toggle */}
          <div className="mb-8 px-2">
            <button
              onClick={() => {
                setIsAgentMode(!isAgentMode);
                closeMobileMenu();
              }}
              className={`w-full p-3 rounded-xl flex items-center gap-3 transition-all duration-300 border
                ${
                  isAgentMode
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/30"
                    : "bg-white/50 text-slate-600 border-white/50 hover:bg-white/80"
                }`}
            >
              <div
                className={`p-1.5 rounded-lg ${isAgentMode ? "bg-white/20" : "bg-indigo-100 text-indigo-600"}`}
              >
                <Sparkles size={18} />
              </div>
              <div className="text-left">
                <p className="text-xs font-medium opacity-80">Mode</p>
                <p className="text-sm font-bold">
                  {isAgentMode ? "AI Agent" : "Manual"}
                </p>
              </div>
            </button>
          </div>

          <nav className="space-y-2">
            <SidebarItem
              icon={LayoutDashboard}
              label="Dashboard"
              active={activeTab === "dashboard"}
              onClick={() => handleTabClick("dashboard")}
            />
            {user?.role === "super-admin" && (
              <SidebarItem
                icon={Building2}
                label="Organizations"
                active={activeTab === "organizations"}
                onClick={() => handleTabClick("organizations")}
              />
            )}
            <SidebarItem
              icon={Calendar}
              label="Meetings"
              active={activeTab === "meetings"}
              onClick={() => handleTabClick("meetings")}
            />
            <SidebarItem
              icon={Calendar}
              label="Calendar"
              active={activeTab === "calendar"}
              onClick={() => handleTabClick("calendar")}
            />
            {user?.role !== "super-admin" && (
              <>
                <SidebarItem
                  icon={MessageSquare}
                  label="Chat"
                  active={activeTab === "chat"}
                  onClick={() => handleTabClick("chat")}
                />
                <SidebarItem
                  icon={FolderOpen}
                  label="Files"
                  active={activeTab === "files"}
                  onClick={() => handleTabClick("files")}
                />
              </>
            )}
            <SidebarItem
              icon={Settings}
              label="Settings"
              active={activeTab === "settings"}
              onClick={() => handleTabClick("settings")}
            />
          </nav>
        </div>

        <div className="px-4 py-4 rounded-2xl bg-gradient-to-br from-white/60 to-white/30 border border-white/50 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-bold border-2 border-white shadow-sm">
              {user?.user_name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-700">
                {user?.user_name || "User"}
              </p>
              <p className="text-xs text-slate-500 capitalize">
                {user?.role?.replace("-", " ") || "User"}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-slate-500 hover:text-red-500 transition-colors"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Overlay for mobile menu */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden"
          onClick={closeMobileMenu}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 h-full overflow-hidden relative z-0 pt-16 md:pt-0">
        {isAgentMode ? <AgentView /> : children}
      </main>
    </div>
  );
};

export default Layout;
