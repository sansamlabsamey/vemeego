import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Video,
  Mail,
  Lock,
  ArrowRight,
  Github,
  Chrome,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { login, isAuthenticated } = useAuth();

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await login(email, password);
      // Navigation will be handled by the AuthContext or ProtectedRoute based on user status
      // But we can default to dashboard and let the router redirect if needed
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left Side - Visual */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative overflow-hidden items-center justify-center p-12">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1664526937033-fe2c11f1be25')] bg-cover bg-center opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/90 to-blue-900/90 mix-blend-multiply" />

        <div className="relative z-10 max-w-lg text-white">
          <div className="w-16 h-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center mb-8 border border-white/20">
            <Video size={32} className="text-white" />
          </div>
          <h2 className="text-4xl font-bold mb-6">
            Connect with your team, anywhere.
          </h2>
          <p className="text-lg text-indigo-100 leading-relaxed mb-8">
            "Lumina has completely transformed how we handle remote meetings.
            The AI features are a game changer."
          </p>
          <div className="flex items-center gap-4">
            <img
              src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDQ2NDN8MHwxfHNlYXJjaHwzfHxwcm9mZXNzaW9uYWwlMjBoZWFkc2hvdHxlbnwwfHx8fDE3NjQyMjAwNTB8MA&ixlib=rb-4.1.0&q=85"
              alt="User"
              className="w-12 h-12 rounded-full border-2 border-white/30"
            />
            <div>
              <p className="font-semibold">Sarah Chen</p>
              <p className="text-sm text-indigo-200">
                Engineering Manager at TechCorp
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center lg:text-left">
            <Link
              to="/"
              className="inline-flex items-center gap-2 mb-8 lg:hidden"
            >
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                <Video size={16} className="text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">Lumina</span>
            </Link>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Welcome back
            </h1>
            <p className="text-slate-500">
              Enter your details to access your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
                <AlertCircle
                  className="text-red-500 flex-shrink-0 mt-0.5"
                  size={20}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-red-800">
                    Authentication Error
                  </p>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={20}
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                  placeholder="name@company.com"
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={20}
                />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-12 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                  placeholder="••••••••"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-500/30 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-slate-500">
                Or continue with
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors font-medium text-slate-700">
              <Chrome size={20} /> Google
            </button>
            <button className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors font-medium text-slate-700">
              <Github size={20} /> GitHub
            </button>
          </div>

          <p className="text-center text-sm text-slate-500">
            Don't have an account?{" "}
            <Link
              to="/signup"
              className="font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
