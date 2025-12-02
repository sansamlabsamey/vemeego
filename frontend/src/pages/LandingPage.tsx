
import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Video, Check, ArrowRight, Sparkles, Shield, Zap, Globe, 
  Users, MessageSquare, Mic, Play, Layout, Smartphone,
  Twitter, Linkedin, Github, Facebook, LogOut, Settings, LayoutDashboard, User as UserIcon
} from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';

const LandingPage = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    logout();
    setShowDropdown(false);
  };

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900 selection:bg-indigo-100">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Video size={20} className="text-white" />
            </div>
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-600">
              Lumina
            </span>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
              <a href="#features" className="hover:text-indigo-600 transition-colors">Features</a>
              <a href="#use-cases" className="hover:text-indigo-600 transition-colors">Use Cases</a>
              <a href="#pricing" className="hover:text-indigo-600 transition-colors">Pricing</a>
            </div>
            
            {isAuthenticated ? (
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
                >
                  <span className="text-sm font-medium text-slate-700 hidden sm:block">
                    {user?.user_name || 'User'}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 border border-indigo-200">
                    <UserIcon size={16} />
                  </div>
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 py-2 animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-4 py-2 border-b border-slate-50 mb-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">{user?.user_name}</p>
                      <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                    </div>
                    
                    <button 
                      onClick={() => navigate('/dashboard')}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2 transition-colors"
                    >
                      <LayoutDashboard size={16} />
                      Dashboard
                    </button>
                    
                    <button 
                      onClick={() => navigate('/dashboard')}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 flex items-center gap-2 transition-colors"
                    >
                      <Settings size={16} />
                      Settings
                    </button>
                    
                    <div className="my-1 border-t border-slate-50" />
                    
                    <button 
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                    >
                      <LogOut size={16} />
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link 
                to="/login" 
                className="px-6 py-2.5 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-indigo-600 transition-all shadow-lg hover:shadow-indigo-500/25"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[1000px] bg-indigo-50 rounded-full blur-3xl -z-10 opacity-60" />
        <div className="absolute bottom-0 right-0 w-[800px] h-[800px] bg-blue-50 rounded-full blur-3xl -z-10 opacity-60" />

        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-sm font-medium animate-in fade-in slide-in-from-bottom-4 duration-700">
              <Sparkles size={16} />
              <span>New: AI Agent Mode is now live</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
              Meetings that <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-blue-600">think with you.</span>
            </h1>
            <p className="text-xl text-slate-500 leading-relaxed max-w-lg animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
              Experience the future of collaboration with Lumina. Crystal clear video, intelligent summaries, and an AI assistant that handles the busy work.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-300">
              <Link 
                to="/signup" 
                className="px-8 py-4 rounded-2xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/30 flex items-center justify-center gap-2"
              >
                Get Started Free <ArrowRight size={20} />
              </Link>
              <button className="px-8 py-4 rounded-2xl bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                View Demo
              </button>
            </div>
            <div className="flex items-center gap-4 text-sm text-slate-500 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-400">
              <div className="flex -space-x-2">
                {[1,2,3,4].map(i => (
                  <div key={i} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white" />
                ))}
              </div>
              <p>Trusted by 10,000+ teams worldwide</p>
            </div>
          </div>
          <div className="relative animate-in fade-in zoom-in duration-1000 delay-200">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl border border-slate-200 bg-white">
              <img 
                src="https://images.unsplash.com/photo-1758691736975-9f7f643d178e" 
                alt="App Dashboard" 
                className="w-full h-auto object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
              
              {/* Floating UI Elements */}
              <div className="absolute bottom-8 left-8 right-8 p-4 rounded-2xl bg-white/90 backdrop-blur-xl border border-white/50 shadow-lg flex items-center gap-4 animate-in slide-in-from-bottom duration-1000 delay-500">
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                  <Sparkles size={24} />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">AI Summary Ready</p>
                  <p className="text-sm text-slate-500">Your meeting notes have been generated.</p>
                </div>
                <button className="ml-auto px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium">View</button>
              </div>
            </div>
            {/* Decorative blobs */}
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-400/20 rounded-full blur-2xl -z-10" />
            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-400/20 rounded-full blur-2xl -z-10" />
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-10 border-y border-slate-100 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-6 text-center">
          <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-8">Powering next-gen companies</p>
          <div className="flex flex-wrap justify-center gap-12 opacity-50 grayscale">
            {['Acme Corp', 'GlobalTech', 'Nebula', 'Circle', 'FoxRun'].map((brand, i) => (
              <span key={i} className="text-xl font-bold text-slate-800">{brand}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-20">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">More than just video calling</h2>
            <p className="text-lg text-slate-500">Lumina is an intelligent workspace designed to make your meetings more productive, inclusive, and actionable.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                icon: Sparkles,
                title: "AI-Powered Summaries",
                desc: "Never take notes again. Lumina automatically transcribes and summarizes your meetings, highlighting key decisions and action items."
              },
              {
                icon: Globe,
                title: "Real-time Translation",
                desc: "Break down language barriers with live caption translation in over 40 languages. Speak globally, understand locally."
              },
              {
                icon: Layout,
                title: "Interactive Whiteboards",
                desc: "Collaborate visually with built-in whiteboards. Draw, diagram, and brainstorm together in real-time without leaving the call."
              },
              {
                icon: Shield,
                title: "Enterprise-Grade Security",
                desc: "Your data is yours. We use end-to-end encryption and comply with SOC2, GDPR, and HIPAA standards to keep your conversations private."
              },
              {
                icon: Zap,
                title: "Low-Latency HD Video",
                desc: "Our adaptive bitrate technology ensures crystal clear 4K video and lag-free audio, even on low-bandwidth connections."
              },
              {
                icon: Smartphone,
                title: "Seamless Mobile App",
                desc: "Take your meetings anywhere. Our fully featured mobile app lets you join, host, and collaborate from your phone or tablet."
              }
            ].map((feature, i) => (
              <div key={i} className="group">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <feature.icon size={28} />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">{feature.title}</h3>
                <p className="text-slate-500 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="use-cases" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-6">Built for every way you work</h2>
              <p className="text-lg text-slate-500 mb-8">Whether you're running a daily standup, closing a sales deal, or hosting a company-wide all-hands, Lumina adapts to your needs.</p>
              
              <div className="space-y-6">
                {[
                  { title: "Remote Teams", desc: "Keep your distributed team aligned with persistent chat and async video updates." },
                  { title: "Sales & Customer Success", desc: "Record demos and share clips instantly. Integrate with your CRM to log activity automatically." },
                  { title: "Hiring & Interviews", desc: "Streamline your hiring process with collaborative coding pads and scorecard integrations." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center shrink-0 mt-1">
                      <Check size={14} />
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900">{item.title}</h4>
                      <p className="text-slate-500 text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-blue-600 rounded-3xl transform rotate-3 opacity-20 blur-lg" />
              <img 
                src="https://images.unsplash.com/photo-1664526937033-fe2c11f1be25" 
                alt="Collaboration" 
                className="relative rounded-3xl shadow-2xl border border-white/50"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-lg text-slate-500">Start for free, upgrade when you need more power.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Tier */}
            <div className="p-8 rounded-3xl border border-slate-200 bg-white hover:border-indigo-200 transition-colors">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Starter</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-slate-900">$0</span>
                <span className="text-slate-500">/month</span>
              </div>
              <p className="text-slate-500 text-sm mb-8">Perfect for individuals and small projects.</p>
              <Link to="/signup" className="block w-full py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold text-center hover:bg-slate-200 transition-colors mb-8">
                Start For Free
              </Link>
              <ul className="space-y-4 text-sm text-slate-600">
                <li className="flex items-center gap-3"><Check size={16} className="text-green-500" /> Up to 40 minutes per meeting</li>
                <li className="flex items-center gap-3"><Check size={16} className="text-green-500" /> 100 participants</li>
                <li className="flex items-center gap-3"><Check size={16} className="text-green-500" /> Unlimited 1:1 meetings</li>
                <li className="flex items-center gap-3"><Check size={16} className="text-green-500" /> Basic AI summaries</li>
              </ul>
            </div>

            {/* Pro Tier */}
            <div className="p-8 rounded-3xl border-2 border-indigo-600 bg-white relative shadow-xl">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1 rounded-full bg-indigo-600 text-white text-xs font-bold uppercase tracking-wide">
                Most Popular
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Pro</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-slate-900">$20</span>
                <span className="text-slate-500">/month</span>
              </div>
              <p className="text-slate-500 text-sm mb-8">For growing teams that need more power.</p>
              <Link to="/signup" className="block w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-center hover:bg-indigo-700 transition-colors mb-8">
                Start Free Trial
              </Link>
              <ul className="space-y-4 text-sm text-slate-600">
                <li className="flex items-center gap-3"><Check size={16} className="text-indigo-600" /> Unlimited meeting duration</li>
                <li className="flex items-center gap-3"><Check size={16} className="text-indigo-600" /> Upto 150 participants in webinar</li>
                <li className="flex items-center gap-3"><Check size={16} className="text-indigo-600" /> Cloud recording (10GB)</li>
                <li className="flex items-center gap-3"><Check size={16} className="text-indigo-600" /> Advanced AI Assistant</li>
                <li className="flex items-center gap-3"><Check size={16} className="text-indigo-600" /> Custom branding</li>
              </ul>
            </div>

            {/* Enterprise Tier */}
            <div className="p-8 rounded-3xl border border-slate-200 bg-white hover:border-indigo-200 transition-colors">
              <h3 className="text-xl font-bold text-slate-900 mb-2">Business</h3>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-slate-900">$60</span>
                <span className="text-slate-500">/month</span>
              </div>
              <p className="text-slate-500 text-sm mb-8">Advanced control and support for large orgs.</p>
              <Link to="/signup" className="block w-full py-3 rounded-xl bg-slate-100 text-slate-700 font-semibold text-center hover:bg-slate-200 transition-colors mb-8">
                Get Started
              </Link>
              <ul className="space-y-4 text-sm text-slate-600">
                <li className="flex items-center gap-3"><Check size={16} className="text-green-500" /> Upto 500 participants in webinar</li>
                <li className="flex items-center gap-3"><Check size={16} className="text-green-500" /> Unlimited cloud recording</li>
                <li className="flex items-center gap-3"><Check size={16} className="text-green-500" /> In-meeting AI assistant</li>
                <li className="flex items-center gap-3"><Check size={16} className="text-green-500" /> Transcript translation</li>
                <li className="flex items-center gap-3"><Check size={16} className="text-green-500" /> 24/7 Priority Support</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-slate-900 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-[url('https://images.unsplash.com/photo-1664526937033-fe2c11f1be25')] bg-cover bg-center opacity-10" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to transform your meetings?</h2>
          <p className="text-xl text-indigo-200 mb-10">Join thousands of teams who have switched to Lumina for a smarter, faster, and more collaborative experience.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link 
              to="/signup" 
              className="px-8 py-4 rounded-2xl bg-indigo-600 text-white font-semibold hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/30"
            >
              Start Your Free Trial
            </Link>
            <button className="px-8 py-4 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold hover:bg-white/20 transition-all">
              Talk to Sales
            </button>
          </div>
        </div>
      </section>

      {/* Detailed Footer */}
      <footer className="bg-white border-t border-slate-100 pt-20 pb-10 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-10 mb-16">
          <div className="col-span-2 lg:col-span-2">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
                <Video size={16} className="text-white" />
              </div>
              <span className="text-xl font-bold text-slate-900">Lumina</span>
            </div>
            <p className="text-slate-500 mb-6 max-w-xs">
              The AI-first video conferencing platform designed for the modern workforce. Connect, collaborate, and create together.
            </p>
            <div className="flex gap-4">
              <a href="#" className="p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"><Twitter size={20} /></a>
              <a href="#" className="p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"><Linkedin size={20} /></a>
              <a href="#" className="p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"><Github size={20} /></a>
              <a href="#" className="p-2 rounded-full bg-slate-100 text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"><Facebook size={20} /></a>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold text-slate-900 mb-6">Product</h4>
            <ul className="space-y-4 text-sm text-slate-500">
              <li><a href="#" className="hover:text-indigo-600">Features</a></li>
              <li><a href="#" className="hover:text-indigo-600">AI Assistant</a></li>
              <li><a href="#" className="hover:text-indigo-600">Integrations</a></li>
              <li><a href="#" className="hover:text-indigo-600">Enterprise</a></li>
              <li><a href="#" className="hover:text-indigo-600">Pricing</a></li>
              <li><a href="#" className="hover:text-indigo-600">Changelog</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-6">Company</h4>
            <ul className="space-y-4 text-sm text-slate-500">
              <li><a href="#" className="hover:text-indigo-600">About Us</a></li>
              <li><a href="#" className="hover:text-indigo-600">Careers</a> <span className="text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full ml-1">Hiring</span></li>
              <li><a href="#" className="hover:text-indigo-600">Blog</a></li>
              <li><a href="#" className="hover:text-indigo-600">Contact</a></li>
              <li><a href="#" className="hover:text-indigo-600">Partners</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-slate-900 mb-6">Legal</h4>
            <ul className="space-y-4 text-sm text-slate-500">
              <li><a href="#" className="hover:text-indigo-600">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-indigo-600">Terms of Service</a></li>
              <li><a href="#" className="hover:text-indigo-600">Cookie Policy</a></li>
              <li><a href="#" className="hover:text-indigo-600">Security</a></li>
              <li><a href="#" className="hover:text-indigo-600">Status</a></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-slate-400">© 2025 Lumina Inc. All rights reserved.</p>
          <div className="flex gap-8 text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>All systems operational</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
