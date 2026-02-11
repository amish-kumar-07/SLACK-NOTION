'use client'
import { useState } from 'react';
import { Eye, EyeOff, ArrowRight, Sparkles, Layers, Mail, Lock, User, Shield, Users } from 'lucide-react';
import { useRouter } from "next/navigation";
import { useToast } from '@/app/context/ToastContext';
const BASE_URL = process.env.NEXT_PUBLIC_API_URL!;

// Signup Page Component
function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user' // default role
  });
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const toast = useToast();

  const validateEmail = (email: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  };

  const validateForm = () => {
    const newErrors = { email: '', password: '' };

    if (!validateEmail(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    setErrors(newErrors);
    return !newErrors.email && !newErrors.password;
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          password: formData.password,
          role: formData.role
        })
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error("No User Created!");
        setIsLoading(false);
        return;
      }
      toast.success("User Created");
      setIsLoading(false);
      onNavigate('/pages/auth/login');
      return;
    }
    catch (err) {
      toast.error(err+"");
      setIsLoading(false);
      return;
    }
  };

  function onNavigate(pages: string): void {
    if (pages.includes('login')) {
      router.push("/pages/auth/login");
      return;
    }
    router.push(pages)
  }

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-linear-to-brrom-purple-900/20 via-transparent to-pink-900/20" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-linear-to-br from-purple-500 to-pink-500">
              <Layers className="w-8 h-8 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">CollabAI</span>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <h1 className="text-5xl font-bold text-white leading-tight">
            One workspace.
            <br />
            <span className="bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Infinite possibilities.
            </span>
          </h1>
          <p className="text-xl text-gray-300 max-w-md">
            Chat, documents, and whiteboards — all in one place. Collaborate in real-time with your team.
          </p>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-gray-400">
              <Sparkles className="w-5 h-5 text-purple-400" />
              <span>Real-time sync</span>
            </div>
            <div className="flex items-center gap-2 text-gray-400">
              <Sparkles className="w-5 h-5 text-pink-400" />
              <span>Team collaboration</span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-gray-500 text-sm">
          © 2025 CollabAI. All rights reserved.
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-950">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 justify-center mb-8">
            <div className="p-2 rounded-xl bg-linear-to-br from-purple-500 to-pink-500">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">CollabAI</span>
          </div>

          <div className="text-center">
            <h2 className="text-3xl font-bold text-white">Create your account</h2>
            <p className="mt-2 text-gray-400">
              Start collaborating with your team today
            </p>
          </div>

          <div className="space-y-6">
            {/* Full Name Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-200">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="John Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Email Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-200">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => {
                    setFormData({ ...formData, email: e.target.value });
                    setErrors({ ...errors, email: '' });
                  }}
                  className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>
              {errors.email && (
                <p className="text-sm text-red-400">{errors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-200">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => {
                    setFormData({ ...formData, password: e.target.value });
                    setErrors({ ...errors, password: '' });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSubmit(e);
                    }
                  }}
                  className="w-full pl-10 pr-12 py-3 bg-slate-900 border border-slate-800 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-red-400">{errors.password}</p>
              )}
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-200">Account Type</label>
              <div className="grid grid-cols-2 gap-3">
                {/* User Option */}
                <label
                  className={`relative flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${formData.role === 'user'
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                    }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="user"
                    checked={formData.role === 'user'}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="sr-only"
                  />
                  <div className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.role === 'user' ? 'border-purple-500' : 'border-gray-600'
                    }`}>
                    {formData.role === 'user' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-400" />
                      <span className="text-white font-medium text-sm">User</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Standard access</p>
                  </div>
                </label>

                {/* Admin Option */}
                <label
                  className={`relative flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition-all ${formData.role === 'admin'
                      ? 'border-pink-500 bg-pink-500/10'
                      : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                    }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value="admin"
                    checked={formData.role === 'admin'}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    className="sr-only"
                  />
                  <div className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.role === 'admin' ? 'border-pink-500' : 'border-gray-600'
                    }`}>
                    {formData.role === 'admin' && (
                      <div className="w-2.5 h-2.5 rounded-full bg-pink-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-pink-400" />
                      <span className="text-white font-medium text-sm">Admin</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Full control</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={isLoading}
              className="w-full py-3 bg-linear-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2 font-semibold group disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Create account
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </div>

          {/* Toggle to Login */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => onNavigate('auth/login')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              Already have an account? <span className="text-purple-400 font-medium">Sign in</span>
            </button>
          </div>

          {/* Back to Home */}
          <button
            onClick={() => onNavigate('/')}
            className="w-full text-center text-gray-500 hover:text-gray-300 transition-colors text-sm"
          >
            ← Back to home
          </button>
        </div>
      </div>
    </div>
  );
}

export default SignupPage;