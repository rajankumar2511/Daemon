import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signup, getMe } from "../lib/api";
import { connectSocket } from "../Sockets/Socket";
import { toast } from "react-toastify";
import {
  User,
  Mail,
  Key,
  Eye,
  EyeOff,
  UserPlus,
  ArrowRight,
  CheckCircle,
  XCircle,
  MessageCircle,
  Video,
  AlertCircle
} from 'lucide-react';

const SignUpPage = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreeToTerms, setAgreeToTerms] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required";
    } else if (formData.fullName.trim().length < 2) {
      newErrors.fullName = "Name must be at least 2 characters";
    }
    
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    } else if (formData.password.length > 50) {
      newErrors.password = "Password must be less than 50 characters";
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    
    if (!agreeToTerms) {
      newErrors.terms = "You must agree to the terms and conditions";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    setIsLoading(true);

    try {
      console.log("[STEP 1] Signup request", { ...formData, password: "***" });

      const { confirmPassword, ...data } = formData;

      await signup(data);

      console.log("[STEP 1 SUCCESS] Account created");

      toast.success("Account created successfully! 🎉");

      console.log("[STEP 2] Verifying session...");
      
      // Verify session is established
      await getMe();
      
      console.log("[STEP 3] Establishing socket connection...");
      
      // Connect socket
      connectSocket();

      console.log("[STEP 4] Redirecting to home");

      navigate("/home");

    } catch (err) {
      console.error("[SIGNUP ERROR]", err);

      const message =
        typeof err.message === "string" && err.message.length < 100
          ? err.message
          : "Signup failed. Please try again.";

      toast.error(message);
      
      // Handle specific error cases
      if (message.toLowerCase().includes("email already exists")) {
        setErrors({ email: "An account with this email already exists" });
      }

    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrength = () => {
    const password = formData.password;
    if (!password) return { strength: 0, text: "", color: "" };
    
    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 10) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    const strengthMap = {
      0: { text: "Very Weak", color: "bg-red-500", width: "20%" },
      1: { text: "Weak", color: "bg-orange-500", width: "40%" },
      2: { text: "Fair", color: "bg-yellow-500", width: "60%" },
      3: { text: "Good", color: "bg-blue-500", width: "80%" },
      4: { text: "Strong", color: "bg-green-500", width: "100%" },
      5: { text: "Very Strong", color: "bg-green-600", width: "100%" },
    };
    
    return strengthMap[Math.min(strength, 5)];
  };

  const passwordStrength = getPasswordStrength();

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
                <span className="text-white">Join the</span>
                <br />
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent animate-gradient">
                  Revolution
                </span>
                <br />
                <span className="text-white">Today</span>
              </h1>
              <p className="text-gray-400 text-lg leading-relaxed max-w-md mx-auto lg:mx-0">
                Create your account and start experiencing the future of communication with ultra-fast messaging and crystal-clear calls.
              </p>
            </div>

            {/* Feature List */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3 text-gray-300 justify-center lg:justify-start">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-lg flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-sm">Real-time messaging with typing indicators</span>
              </div>
              <div className="flex items-center gap-3 text-gray-300 justify-center lg:justify-start">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-lg flex items-center justify-center">
                  <Video className="w-4 h-4 text-blue-400" />
                </div>
                <span className="text-sm">High-quality voice and video calls</span>
              </div>
              <div className="flex items-center gap-3 text-gray-300 justify-center lg:justify-start">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-500/20 to-blue-500/20 rounded-lg flex items-center justify-center">
                  <CheckCircle className="w-4 h-4 text-pink-400" />
                </div>
                <span className="text-sm">100% free with no hidden fees</span>
              </div>
            </div>
          </div>

          {/* Right Side - Sign Up Card */}
          <div className="flex-1 w-full max-w-md mx-auto lg:mx-0">
            <div className="relative">
              {/* Card Glow Effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur-xl opacity-30"></div>

              {/* Sign Up Card */}
              <div className="relative bg-[#111111]/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                {/* Card Header */}
                <div className="px-8 pt-8 pb-6 text-center border-b border-white/10">
                  <h3 className="text-2xl font-bold text-white mb-2">Create Account</h3>
                  <p className="text-gray-400 text-sm">Join Daemon and start messaging</p>
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
                  {/* Full Name Field */}
                  <div className="group">
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Full name
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors">
                        <User className="w-4 h-4" />
                      </div>
                      <input
                        name="fullName"
                        type="text"
                        placeholder="John Doe"
                        value={formData.fullName}
                        onChange={handleChange}
                        className="w-full pl-10 pr-3 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none text-white placeholder-gray-500 transition-all text-sm"
                        autoComplete="name"
                      />
                    </div>
                    {errors.fullName && (
                      <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.fullName}
                      </p>
                    )}
                  </div>

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
                        name="email"
                        type="email"
                        placeholder="john@example.com"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full pl-10 pr-3 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none text-white placeholder-gray-500 transition-all text-sm"
                        autoComplete="email"
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
                        placeholder="Create a password"
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full pl-10 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none text-white placeholder-gray-500 transition-all text-sm"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-purple-400 transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    
                    {/* Password Strength Indicator */}
                    {formData.password && (
                      <div className="mt-2 space-y-1">
                        <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${passwordStrength.color} transition-all duration-300`}
                            style={{ width: passwordStrength.width }}
                          ></div>
                        </div>
                        <p className="text-xs text-gray-400">
                          Password strength: <span className={passwordStrength.color.replace("bg-", "text-")}>{passwordStrength.text}</span>
                        </p>
                      </div>
                    )}
                    
                    {errors.password && (
                      <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.password}
                      </p>
                    )}
                  </div>

                  {/* Confirm Password Field */}
                  <div className="group">
                    <label className="block text-gray-300 text-sm font-medium mb-2">
                      Confirm password
                    </label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-purple-400 transition-colors">
                        <CheckCircle className="w-4 h-4" />
                      </div>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        placeholder="Confirm your password"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className="w-full pl-10 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 outline-none text-white placeholder-gray-500 transition-all text-sm"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-purple-400 transition-colors"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.confirmPassword}
                      </p>
                    )}
                    {formData.confirmPassword && formData.password === formData.confirmPassword && formData.password && (
                      <p className="text-green-400 text-xs mt-1 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Passwords match
                      </p>
                    )}
                  </div>

                  {/* Terms and Conditions */}
                  <div className="space-y-2">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={agreeToTerms}
                        onChange={(e) => {
                          setAgreeToTerms(e.target.checked);
                          if (errors.terms) setErrors({ ...errors, terms: "" });
                        }}
                        className="mt-0.5 w-4 h-4 rounded border-gray-600 bg-white/5 text-purple-500 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer"
                      />
                      <span className="text-gray-400 text-xs sm:text-sm group-hover:text-gray-300 transition-colors">
                        I agree to the{" "}
                        <Link to="/terms" className="text-purple-400 hover:text-purple-300 hover:underline">
                          Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link to="/privacy" className="text-purple-400 hover:text-purple-300 hover:underline">
                          Privacy Policy
                        </Link>
                      </span>
                    </label>
                    {errors.terms && (
                      <p className="text-red-400 text-xs flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.terms}
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
                        <span>Creating account...</span>
                      </div>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <UserPlus className="w-5 h-5" />
                        Create Account
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
                    <span className="px-3 bg-[#111111] text-gray-500">Secure signup</span>
                  </div>
                </div>

                {/* Login Link */}
                <div className="px-8 pb-8 text-center">
                  <p className="text-sm text-gray-400">
                    Already have an account?{" "}
                    <Link 
                      to="/login" 
                      className="text-purple-400 hover:text-purple-300 font-semibold hover:underline transition-all inline-flex items-center gap-1"
                    >
                      Sign in
                      <ArrowRight className="w-3 h-3" />
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

export default SignUpPage;