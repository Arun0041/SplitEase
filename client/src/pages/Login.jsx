import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { user } = useAuth();

  if (user) return <Navigate to="/" replace />;

  const handleGoogleLogin = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    window.location.href = `${apiUrl}/auth/google`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface relative overflow-hidden px-4">
      {/* Animated gradient orbs */}
      <div className="absolute top-1/4 -left-20 w-72 h-72 bg-brand-600/20 rounded-full blur-3xl" style={{ animation: 'float 8s ease-in-out infinite' }} />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-accent-500/15 rounded-full blur-3xl" style={{ animation: 'float 10s ease-in-out infinite 3s' }} />
      <div className="absolute top-10 right-1/4 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" style={{ animation: 'float 12s ease-in-out infinite 1s' }} />

      <div className="w-full max-w-sm glass rounded-3xl p-10 text-center relative" style={{ animation: 'slide-up 0.5s ease-out' }}>
        <div className="relative z-10">
          {/* Logo */}
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-brand-500 to-accent-400 rounded-2xl flex items-center justify-center shadow-lg glow-brand mb-6">
            <span className="text-2xl font-extrabold text-white">S</span>
          </div>

          <h1 className="text-3xl font-extrabold gradient-text mb-2">SplitEase</h1>
          <p className="text-sm font-medium text-slate-400 mb-10">
            Fair and easy expense splitting for everyone.
          </p>

          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 glass-light rounded-2xl font-bold text-white hover:bg-white/10 hover:-translate-y-0.5 transition-all shadow-lg"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09A6.97 6.97 0 015.49 12c0-.72.13-1.43.35-2.09V7.07H2.18A11 11 0 001 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <p className="mt-8 text-xs text-slate-500">
            Secure login powered by Google OAuth 2.0
          </p>
        </div>
      </div>
    </div>
  );
}
