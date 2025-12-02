import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Video,
  Mail,
  Lock,
  ArrowRight,
  User,
  Phone,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { API_ENDPOINTS } from "../config";

import { useAuth } from "../contexts/AuthContext";

const Signup = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    user_name: "",
    phone_number: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.user_name) {
      setError("Please fill in all required fields");
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long");
      return false;
    }

    if (!/[A-Z]/.test(formData.password)) {
      setError("Password must contain at least one uppercase letter");
      return false;
    }

    if (!/[a-z]/.test(formData.password)) {
      setError("Password must contain at least one lowercase letter");
      return false;
    }

    if (!/[0-9]/.test(formData.password)) {
      setError("Password must contain at least one number");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(API_ENDPOINTS.AUTH.SIGNUP, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          user_name: formData.user_name,
          phone_number: formData.phone_number || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Signup failed");
      }

      setSuccess(true);

      // Store tokens if returned
      if (data.access_token) {
        localStorage.setItem("access_token", data.access_token);
        localStorage.setItem("refresh_token", data.refresh_token);
      }

      // Store user info temporarily to proceed to organization setup
      localStorage.setItem("signup_user_id", data.user_id);
      localStorage.setItem("signup_email", data.email);

      // Redirect to organization setup after 2 seconds
      setTimeout(() => {
        navigate("/complete-organization-setup", {
          state: {
            userId: data.user_id,
            email: data.email,
          },
        });
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Signup failed. Please try again.");
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
            Start your journey with Lumina
          </h2>
          <p className="text-lg text-indigo-100 leading-relaxed mb-8">
            Join thousands of teams who have transformed their remote meetings
            with AI-powered collaboration tools.
          </p>

          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="text-green-400 flex-shrink-0" size={20} />
              <p className="text-indigo-100">No credit card required</p>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="text-green-400 flex-shrink-0" size={20} />
              <p className="text-indigo-100">30-day free trial</p>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className="text-green-400 flex-shrink-0" size={20} />
              <p className="text-indigo-100">Cancel anytime</p>
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
              Create your account
            </h1>
            <p className="text-slate-500">
              Get started with your organization's communication platform
            </p>
          </div>

          {success ? (
            <div className="p-6 rounded-xl bg-green-50 border border-green-200">
              <div className="flex items-start gap-3">
                <CheckCircle
                  className="text-green-500 flex-shrink-0 mt-0.5"
                  size={24}
                />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-green-800 mb-2">
                    Account Created Successfully!
                  </h3>
                  <p className="text-sm text-green-700 mb-2">
                    Your account has been created and verified.
                  </p>
                  <p className="text-sm text-green-700">
                    Redirecting you to organization setup...
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
                  <AlertCircle
                    className="text-red-500 flex-shrink-0 mt-0.5"
                    size={20}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-800">Error</p>
                    <p className="text-sm text-red-600 mt-1">{error}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={20}
                  />
                  <input
                    type="text"
                    name="user_name"
                    required
                    value={formData.user_name}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                    placeholder="John Doe"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={20}
                  />
                  <input
                    type="email"
                    name="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                    placeholder="name@company.com"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={20}
                  />
                  <input
                    type="tel"
                    name="phone_number"
                    value={formData.phone_number}
                    onChange={handleChange}
                    className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                    placeholder="+1 (555) 000-0000"
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={20}
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    required
                    value={formData.password}
                    onChange={handleChange}
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
                <p className="text-xs text-slate-500 mt-2">
                  Must be at least 8 characters with uppercase, lowercase, and
                  number
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Lock
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    size={20}
                  />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    name="confirmPassword"
                    required
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="w-full pl-11 pr-12 py-3 rounded-xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                    placeholder="••••••••"
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
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
                    Continue to Organization Setup <ArrowRight size={20} />
                  </>
                )}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link
              to="/login"
              className="font-semibold text-indigo-600 hover:text-indigo-700"
            >
              Sign in
            </Link>
          </p>

          <p className="text-center text-xs text-slate-400">
            By signing up, you agree to our{" "}
            <a href="#" className="underline hover:text-slate-600">
              Terms of Service
            </a>{" "}
            and{" "}
            <a href="#" className="underline hover:text-slate-600">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
