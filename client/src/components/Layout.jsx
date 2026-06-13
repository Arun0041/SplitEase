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
    <div className="min-h-screen bg-slate-50 relative">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <span className="text-xl font-extrabold text-slate-900 tracking-tight">
              SplitEase
            </span>
          </Link>

          <div className="flex items-center gap-4">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-8 h-8 rounded-full ring-1 ring-slate-200 shadow-sm" />
            ) : (
              <span className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold ring-1 ring-slate-200">
                {user?.name?.charAt(0)}
              </span>
            )}
            <span className="font-bold text-sm text-slate-700 hidden md:block">{user?.name}</span>
            <div className="w-px h-5 bg-slate-200 mx-1 hidden md:block"></div>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-900 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
