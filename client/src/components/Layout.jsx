import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-surface relative">
      {/* Ambient background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl" style={{ animation: 'pulse-glow 6s ease-in-out infinite' }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl" style={{ animation: 'pulse-glow 8s ease-in-out infinite 2s' }} />
      </div>

      <nav className="glass sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <span className="w-9 h-9 bg-gradient-to-br from-brand-500 to-accent-400 rounded-xl flex items-center justify-center text-white text-sm font-extrabold shadow-lg group-hover:scale-110 transition-transform">
              S
            </span>
            <span className="text-xl font-extrabold text-white tracking-tight">
              Split<span className="gradient-text">Ease</span>
            </span>
          </Link>

          <div className="flex items-center gap-3">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-9 h-9 rounded-full ring-2 ring-brand-500/50 shadow-lg" />
            ) : (
              <span className="w-9 h-9 rounded-full bg-brand-600/30 text-brand-300 flex items-center justify-center font-bold ring-2 ring-brand-500/30">
                {user?.name?.charAt(0)}
              </span>
            )}
            <span className="font-semibold text-slate-300 hidden md:block">{user?.name}</span>
            <button
              onClick={handleLogout}
              className="ml-1 px-3.5 py-1.5 text-xs font-bold text-slate-400 glass-light rounded-lg hover:text-rose-400 hover:border-rose-500/30 transition-all"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
