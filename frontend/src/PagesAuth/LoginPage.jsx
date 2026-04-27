import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { apiRequest, getMe } from "../lib/api";
import { connectSocket } from "../Sockets/Socket";
import { toast } from "react-toastify";
import { 
  Bolt, 
  Shield, 
  CloudUpload, 
  Mail, 
  Key, 
  Eye, 
  EyeOff, 
  LogIn,
  AlertCircle,
  XCircle
} from 'lucide-react';

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/home";

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const err = {};
    if (!formData.email.trim()) {
      err.email = "Email required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      err.email = "Please enter a valid email address";
    }
    if (!formData.password.trim()) {
      err.password = "Password required";
    } else if (formData.password.length < 6) {
      err.password = "Password must be at least 6 characters";
    }
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      await apiRequest("/auth/login", {
        method: "POST",
        body: formData,
      });

      await getMe();
      connectSocket();

      toast.success("Login successful! 🎉");
      navigate(from, { replace: true });
    } catch (err) {
      console.error("[Login] Error:", err);
      const message = err.message || "Login failed. Please try again.";
      setErrors({ server: message });
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#0a0a0a]">
      {/* Modern Animated Background */}
      <div className="absolute inset-0">
        {/* Gradient Mesh */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#1e1b4b_0%,_#0a0a0a_50%,_#000000_100%)]"></div>

        {/* Animated Gradient Lines */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute w-[200%] h-[200%] top-[-50%] left-[-50%] animate-spin-slow">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500/10 to-transparent rotate-45"></div>
          </div>
        </div>

        {/* Glowing Orbs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-600 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-pulse-slow"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-600 rounded-full mix-blend-screen filter blur-3xl opacity-20 animate-pulse-slow animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-pink-600 rounded-full mix-blend-screen filter blur-3xl opacity-10 animate-pulse-slow animation-delay-4000"></div>

        {/* Dot Pattern */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.02)_1px,_transparent_1px)] bg-[size:24px_24px]"></div>

        {/* Diagonal Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(45deg,_rgba(255,255,255,0.01)_1px,_transparent_1px)] bg-[size:40px_40px]"></div>
      </div>

      {/* Main Container */}
      <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-16 lg:gap-24">

          {/* Left Side - Brand Section */}
          <div className="flex-1 max-w-xl mx-auto lg:mx-0 text-center lg:text-left">
            {/* Static Logo */}
            <div className="relative inline-block mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur-2xl opacity-50"></div>
              <div className="relative flex items-center gap-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 backdrop-blur-sm px-6 py-3 rounded-2xl border border-white/10">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center shadow-xl">
                  <span className="text-white text-3xl font-black tracking-tight">D</span>
                </div>
                <div>
                  <h2 className="text-4xl font-black bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent tracking-tight">
                    DAEMON
                  </h2>
                  <p className="text-xs text-gray-400">Real-time Messaging Platform</p>
                </div>
              </div>
            </div>

            {/* Hero Section */}
            <div className="space-y-6 mb-8">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black leading-tight">
                <span className="text-white">Start</span>
                <br />
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent animate-gradient">
                  Connecting
                </span>
                <br />
                <span className="text-white">Instantly</span>
              </h1>
              <p className="text-gray-400 text-lg leading-relaxed max-w-md mx-auto lg:mx-0">
                Experience the future of communication with ultra-fast messaging, crystal-clear calls, and seamless file sharing.
              </p>
            </div>

            {/* Feature List */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3 text-gray-300 justify-center lg:justify-start">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-lg flex items-center justify-center">
                  <Bolt className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-sm">Lightning fast message delivery (&lt;100ms)</span>
              </div>
              <div className="flex items-center gap-3 text-gray-300 justify-center lg:justify-start">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-lg flex items-center justify-center">
                  <Shield className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-sm">End-to-end encrypted conversations</span>
              </div>
              <div className="flex items-center gap-3 text-gray-300 justify-center lg:justify-start">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-lg flex items-center justify-center">
                  <CloudUpload className="w-4 h-4 text-pink-400" />
                </div>
                <span className="text-sm">Cloud sync across all your devices</span>
              </div>
            </div>
          </div>

          {/* Right Side - Login Card */}
          <div className="flex-1 w-full max-w-md mx-auto lg:mx-0">
            <div className="relative">
              {/* Card Glow Effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur-xl opacity-30"></div>

              {/* Login Card */}
              <div className="relative bg-[#111111]/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                {/* Card Header */}
                <div className="px-8 pt-8 pb-6 text-center border-b border-white/10">
                  <h3 className="text-2xl font-bold text-white mb-2">Welcome back</h3>
                  <p className="text-gray-400 text-sm">Please enter your details</p>
                </div>

                {/* Server Error */}
                {errors.server && (
                  <div className="mx-8 mt-6 p-3 bg-red-500/10 border border-red-500/20 rounded-xl animate-shake">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-red-500/20 rounded-full flex items-center justify-center">
                        <XCircle className="w-4 h-4 text-red-400" />
                      </div>
                      <p className="text-red-400 text-sm flex-1">{errors.server}</p>
                    </div>
                  </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
                  {/* Email Field */}
                  <div className="group">
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Email address
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full pl-10 pr-3 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none text-white placeholder-gray-500 transition-all text-sm"
                        placeholder="john@example.com"
                      />
                    </div>
                    {errors.email && (
                      <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.email}
                      </p>
                    )}
                  </div>

                  {/* Password Field */}
                  <div className="group">
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors">
                        <Key className="w-4 h-4" />
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full pl-10 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none text-white placeholder-gray-500 transition-all text-sm"
                        placeholder="Enter your password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-purple-400 transition-colors"
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.password}
                      </p>
                    )}
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold rounded-xl hover:from-purple-600 hover:to-blue-600 transition-all duration-200 transform hover:scale-[1.02] active:scale-100 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    {isLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Signing in...</span>
                      </div>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <LogIn className="w-5 h-5" />
                        Sign In
                      </span>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative px-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10"></div>
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-3 bg-[#111111] text-gray-500">Secure login</span>
                  </div>
                </div>

                {/* Footer Link */}
                <div className="px-8 pb-8 text-center">
                  <p className="text-sm text-gray-400">
                    New to DAEMON?{" "}
                    <Link to="/signup" className="text-purple-400 hover:text-purple-300 font-semibold hover:underline transition-all">
                      Create account
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin-slow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        
        @keyframes pulse-slow {
          0%, 100% {
            opacity: 0.2;
            transform: scale(1);
          }
          50% {
            opacity: 0.4;
            transform: scale(1.1);
          }
        }
        
        @keyframes gradient {
          0%, 100% {
            background-position: 0% 50%;
          }
          50% {
            background-position: 100% 50%;
          }
        }
        
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }
        
        .animate-spin-slow {
          animation: spin-slow 20s linear infinite;
        }
        
        .animate-pulse-slow {
          animation: pulse-slow 6s ease-in-out infinite;
        }
        
        .animate-gradient {
          background-size: 200% auto;
          animation: gradient 3s linear infinite;
        }
        
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
        
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};

export default LoginPage;