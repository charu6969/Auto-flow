'use client';

import { Bot, Instagram, ArrowRight, Zap, Shield, BarChart3 } from 'lucide-react';

export default function LoginPage() {
  const handleLogin = () => {
    window.location.href = '/api/auth/instagram';
  };

  return (
    <div className="min-h-screen bg-surface-50 flex">
      {/* Left Panel — Hero */}
      <div className="hidden lg:flex lg:flex-1 relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-40 right-10 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full bg-white/15 blur-3xl" />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-16 max-w-xl">
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center mb-8">
            <Bot className="w-7 h-7 text-white" />
          </div>

          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Automate your Instagram DMs
          </h1>
          <p className="text-brand-200 text-lg mb-12 leading-relaxed">
            Turn comment keywords into instant DM replies. Grow your audience, nurture leads, and close sales — all on autopilot.
          </p>

          <div className="space-y-5">
            {[
              { icon: Zap, title: 'Instant Responses', desc: 'Reply to comments within seconds, 24/7' },
              { icon: Shield, title: 'Rate-Limited & Safe', desc: 'Built-in protections to keep your account safe' },
              { icon: BarChart3, title: 'Full Analytics', desc: 'Track every DM sent and optimize your triggers' },
            ].map((item) => (
              <div key={item.title} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                  <item.icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{item.title}</p>
                  <p className="text-brand-300 text-sm">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel — Login */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md animate-page-enter">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-lg">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="text-xl font-bold text-surface-900">ReplyBot</span>
              <span className="block text-xs text-surface-400 font-medium">DM Automation</span>
            </div>
          </div>

          <div className="card p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-surface-900 tracking-tight">
                Welcome back
              </h2>
              <p className="text-surface-500 mt-2 text-sm">
                Connect your Instagram account to get started
              </p>
            </div>

            <button
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5
                         bg-gradient-to-r from-[#833AB4] via-[#FD1D1D] to-[#F77737]
                         text-white font-semibold rounded-xl
                         hover:opacity-90 transition-all duration-200
                         shadow-lg shadow-pink-500/20 hover:shadow-xl hover:shadow-pink-500/30
                         active:scale-[0.98]"
              id="login-instagram-btn"
            >
              <Instagram className="w-5 h-5" />
              <span>Continue with Instagram</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>

            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3 text-xs text-surface-400">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <span>We'll never post without your permission</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-surface-400">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <span>Requires a Business or Creator Instagram account</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-surface-400">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                <span>Your data is encrypted and secure</span>
              </div>
            </div>
          </div>

          <p className="text-center text-xs text-surface-400 mt-6">
            By connecting, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
